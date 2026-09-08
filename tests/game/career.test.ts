import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCareerRunBonuses,
  bankCareerRun,
  careerFromRunRecords,
  makeCareerState,
  normalizeCareerState,
  purchaseCareerItem,
  rechargeTaxiAtHome,
  type CareerState,
} from "../../game/career";
import { makeGame } from "../../game/state";

function fundedCareer(bank = 1_000): CareerState {
  return { ...makeCareerState(), bank };
}

test("career saves normalize malformed data and migrate legacy run fare", () => {
  assert.deepEqual(normalizeCareerState(null), makeCareerState());
  assert.deepEqual(normalizeCareerState({
    bank: 42.9,
    owned: ["neon-loft", "boost-cooler", "boost-overdrive", "bad-id", "neon-loft"],
    runsCompleted: -2,
    lifetimeFare: 90,
    lifetimeScore: Number.NaN,
    lifetimeDeliveries: 3.8,
  }), {
    version: 1,
    bank: 42,
    owned: ["neon-loft", "boost-cooler", "boost-overdrive"],
    runsCompleted: 0,
    lifetimeFare: 90,
    lifetimeScore: 0,
    lifetimeDeliveries: 3,
  });
  assert.deepEqual(careerFromRunRecords([
    { score: 1_000, fare: 48, deliveries: 1, rank: "C", date: "AUG 9" },
    { score: 2_500, fare: 112, deliveries: 2, rank: "B", date: "AUG 10" },
  ]), {
    version: 1,
    bank: 160,
    owned: [],
    runsCompleted: 2,
    lifetimeFare: 160,
    lifetimeScore: 3_500,
    lifetimeDeliveries: 3,
  });
});

test("run fare banks once per explicit result and purchases enforce prerequisites", () => {
  const banked = bankCareerRun(makeCareerState(), { fare: 180, score: 3_200, deliveries: 3 });
  assert.deepEqual(banked, {
    version: 1,
    bank: 180,
    owned: [],
    runsCompleted: 1,
    lifetimeFare: 180,
    lifetimeScore: 3_200,
    lifetimeDeliveries: 3,
  });
  assert.equal(purchaseCareerItem(banked, "garage-base").status, "locked");
  const loft = purchaseCareerItem(banked, "neon-loft");
  assert.equal(loft.status, "purchased");
  assert.equal(loft.state.bank, 30);
  assert.deepEqual(loft.state.owned, ["neon-loft"]);
  assert.equal(purchaseCareerItem(loft.state, "neon-loft").status, "owned");
  assert.equal(purchaseCareerItem(loft.state, "dispatch-desk").status, "insufficient");
});

test("career upgrades affect only fresh runs and the home garage refills once", () => {
  const career: CareerState = {
    ...fundedCareer(),
    owned: ["neon-loft", "garage-base", "boost-locker", "dispatch-desk"],
  };
  const game = makeGame();
  applyCareerRunBonuses(game, career);
  assert.equal(game.boost, 65);
  assert.equal(game.timeLeft, 80);

  const home = { id: "venue:0:0:home", kind: "home" as const, label: "NEON LOFTS" };
  game.player = {
    kind: "walking",
    actor: { x: 0, y: 0, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "interior", venue: home, returnPose: { x: 0, y: 0, heading: 0 } },
  };
  game.boost = 12;
  assert.equal(rechargeTaxiAtHome(game, career), "recharged");
  assert.equal(game.boost, 100);
  assert.equal(game.homeRechargeUsed, true);
  game.boost = 25;
  assert.equal(rechargeTaxiAtHome(game, career), "used");
  assert.equal(game.boost, 25);
});

test("Free Run applies handling upgrades without manufacturing timer seconds", () => {
  const career: CareerState = {
    ...fundedCareer(),
    owned: ["neon-loft", "garage-base", "boost-locker", "dispatch-desk", "rally-tires"],
  };
  const game = makeGame("street-ace", 808, "free-run");
  applyCareerRunBonuses(game, career);
  assert.equal(game.timeLeft, 75);
  assert.equal(game.boost, 65);
  assert.deepEqual(game.installedUpgrades, ["rally-tires"]);

  const simulation = makeGame("street-ace", 809, "free-run", "simulation");
  applyCareerRunBonuses(simulation, career);
  assert.equal(simulation.boost, 0);
  simulation.player = {
    kind: "walking",
    actor: { x: 0, y: 0, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: {
      kind: "interior",
      venue: { id: "venue:0:0:home", kind: "home", label: "NEON LOFTS" },
      returnPose: { x: 0, y: 0, heading: 0 },
    },
  };
  assert.equal(rechargeTaxiAtHome(simulation, career), "simulation-disabled");
  assert.equal(simulation.homeRechargeUsed, false);
});
