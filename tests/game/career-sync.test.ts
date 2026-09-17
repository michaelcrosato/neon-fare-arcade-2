import assert from "node:assert/strict";
import test from "node:test";

import { makeCareerState, type CareerState } from "../../game/career";
import {
  CLOUD_SAVE_FILENAME,
  careerFingerprint,
  isPristineCareer,
  makeCloudSave,
  planCareerSync,
  readCloudSave,
  summarizeCareer,
} from "../../game/career-sync";

function career(overrides: Partial<CareerState> = {}): CareerState {
  return { ...makeCareerState(), ...overrides };
}

const played = career({
  bank: 220,
  runsCompleted: 4,
  lifetimeFare: 540,
  lifetimeScore: 9_100,
  lifetimeDeliveries: 6,
});

test("the cloud save filename is stable so a save series is never orphaned", () => {
  assert.equal(CLOUD_SAVE_FILENAME, "neon-fare-career-v1.json");
});

test("cloud saves wrap a career with the timestamp the caller supplies", () => {
  assert.deepEqual(makeCloudSave(played, 1_700), { version: 1, updatedAt: 1_700, career: played });
});

test("reading a cloud save normalizes the payload and rejects junk", () => {
  assert.equal(readCloudSave(null), null);
  assert.equal(readCloudSave("nope"), null);
  assert.equal(readCloudSave({ version: 1, updatedAt: 5 }), null);

  // A malformed career is repaired rather than discarded: progress is precious.
  assert.deepEqual(readCloudSave({ updatedAt: "bad", career: { bank: 12.7, owned: ["bad-id"] } }), {
    version: 1,
    updatedAt: 0,
    career: career({ bank: 12 }),
  });
});

test("a career is pristine only before any progress is banked", () => {
  assert.equal(isPristineCareer(makeCareerState()), true);
  assert.equal(isPristineCareer(played), false);
});

test("fingerprints ignore the order items were bought in", () => {
  const boughtOneWay = career({ owned: ["neon-loft", "garage-base", "boost-locker"] });
  const boughtTheOther = career({ owned: ["neon-loft", "boost-locker", "garage-base"] });
  assert.equal(careerFingerprint(boughtOneWay), careerFingerprint(boughtTheOther));
  assert.notEqual(careerFingerprint(boughtOneWay), careerFingerprint(makeCareerState()));
});

test("a missing remote save uploads the local career", () => {
  assert.deepEqual(planCareerSync(makeCloudSave(played, 10), null), { kind: "upload" });
});

test("identical careers need no transfer even when saved at different times", () => {
  assert.deepEqual(
    planCareerSync(makeCloudSave(played, 10), makeCloudSave(played, 99)),
    { kind: "in-sync" },
  );
});

test("a fresh device adopts the account's career instead of overwriting it", () => {
  assert.deepEqual(
    planCareerSync(makeCloudSave(makeCareerState(), 99), makeCloudSave(played, 10)),
    { kind: "adopt" },
  );
});

test("signing in for the first time uploads local progress over an untouched account", () => {
  assert.deepEqual(
    planCareerSync(makeCloudSave(played, 10), makeCloudSave(makeCareerState(), 99)),
    { kind: "upload" },
  );
});

test("the further-along save wins outright, regardless of which clock is later", () => {
  const ahead = career({ ...played, runsCompleted: 9, lifetimeFare: 900, lifetimeScore: 20_000, lifetimeDeliveries: 11 });

  // A stale clock on the winning device must not cost the player their runs.
  assert.deepEqual(planCareerSync(makeCloudSave(ahead, 1), makeCloudSave(played, 5_000)), { kind: "upload" });
  assert.deepEqual(planCareerSync(makeCloudSave(played, 5_000), makeCloudSave(ahead, 1)), { kind: "adopt" });
});

test("genuinely divergent progress asks the player instead of silently dropping a career", () => {
  const moreRuns = career({ ...played, runsCompleted: 9 });
  const moreDeliveries = career({ ...played, lifetimeDeliveries: 30 });
  const plan = planCareerSync(makeCloudSave(moreRuns, 10), makeCloudSave(moreDeliveries, 20));

  assert.equal(plan.kind, "choose");
  assert.deepEqual(plan.kind === "choose" && plan.local, {
    runsCompleted: 9, bank: 220, lifetimeFare: 540, lifetimeScore: 9_100, lifetimeDeliveries: 6, updatedAt: 10,
  });
  assert.deepEqual(plan.kind === "choose" && plan.remote, {
    runsCompleted: 4, bank: 220, lifetimeFare: 540, lifetimeScore: 9_100, lifetimeDeliveries: 30, updatedAt: 20,
  });
});

test("equal progress spent differently is a conflict, because bank is not monotonic", () => {
  const saved = career({ ...played, bank: 220 });
  const spent = career({ ...played, bank: 20, owned: ["neon-loft"] });
  assert.equal(planCareerSync(makeCloudSave(saved, 10), makeCloudSave(spent, 20)).kind, "choose");
});

test("summaries expose exactly the fields the conflict chooser shows", () => {
  assert.deepEqual(summarizeCareer(makeCloudSave(played, 42)), {
    runsCompleted: 4, bank: 220, lifetimeFare: 540, lifetimeScore: 9_100, lifetimeDeliveries: 6, updatedAt: 42,
  });
});
