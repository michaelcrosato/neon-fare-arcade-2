import { makeCareerState, normalizeCareerState, type CareerState } from "./career";

/**
 * Rules for reconciling one career across devices. Saves live in the player's
 * own Google Drive appDataFolder, so this module owns only the decisions --
 * what a save looks like and which side wins when two devices disagree.
 * Transport, tokens and browser clocks stay in `app/`, which is why every
 * timestamp here arrives as an argument.
 */

export const CLOUD_SAVE_FILENAME = "neon-fare-career-v1.json";

export type CloudSave = { version: 1; updatedAt: number; career: CareerState };

export type CareerSummary = {
  runsCompleted: number;
  bank: number;
  lifetimeFare: number;
  lifetimeScore: number;
  lifetimeDeliveries: number;
  updatedAt: number;
};

export type SyncPlan =
  | { kind: "in-sync" }
  | { kind: "upload" }
  | { kind: "adopt" }
  | { kind: "choose"; local: CareerSummary; remote: CareerSummary };

function wholeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * Every collection inside a CareerState is a set, so ordering carries no
 * meaning: two devices that bought the same upgrades in a different order hold
 * the same save and must not be reported as a conflict.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${key}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function careerFingerprint(career: CareerState) {
  return canonical(career);
}

const PRISTINE_FINGERPRINT = careerFingerprint(makeCareerState());

export function isPristineCareer(career: CareerState) {
  return careerFingerprint(career) === PRISTINE_FINGERPRINT;
}

/**
 * Totals that only ever grow while playing. Bank is deliberately absent: it is
 * spendable, so a smaller bank can mean a further-along career, and ranking by
 * it would hand the win to whichever device had hoarded rather than upgraded.
 */
function progressOf(career: CareerState): readonly number[] {
  return [
    career.runsCompleted,
    career.lifetimeFare,
    career.lifetimeScore,
    career.lifetimeDeliveries,
    career.owned.length,
    career.furnishings.owned.length,
  ];
}

function atLeastAsFar(career: CareerState, other: CareerState) {
  const left = progressOf(career);
  const right = progressOf(other);
  return left.every((value, index) => value >= right[index]);
}

export function makeCloudSave(career: CareerState, updatedAt: number): CloudSave {
  return { version: 1, updatedAt: wholeNumber(updatedAt), career };
}

/** Repairs a malformed payload rather than discarding it: progress is precious. */
export function readCloudSave(raw: unknown): CloudSave | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as { updatedAt?: unknown; career?: unknown };
  if (!value.career || typeof value.career !== "object") return null;
  return { version: 1, updatedAt: wholeNumber(value.updatedAt), career: normalizeCareerState(value.career) };
}

export function summarizeCareer(save: CloudSave): CareerSummary {
  return {
    runsCompleted: save.career.runsCompleted,
    bank: save.career.bank,
    lifetimeFare: save.career.lifetimeFare,
    lifetimeScore: save.career.lifetimeScore,
    lifetimeDeliveries: save.career.lifetimeDeliveries,
    updatedAt: save.updatedAt,
  };
}

/**
 * Ranks by banked progress rather than by timestamp, because a device with a
 * wrong clock would otherwise erase a career that is plainly further along.
 * Timestamps are reported to the player in a conflict, never used to decide one.
 */
export function planCareerSync(local: CloudSave, remote: CloudSave | null): SyncPlan {
  if (!remote) return { kind: "upload" };
  if (careerFingerprint(local.career) === careerFingerprint(remote.career)) return { kind: "in-sync" };
  if (isPristineCareer(local.career)) return { kind: "adopt" };
  if (isPristineCareer(remote.career)) return { kind: "upload" };

  const localAhead = atLeastAsFar(local.career, remote.career);
  const remoteAhead = atLeastAsFar(remote.career, local.career);
  if (localAhead && !remoteAhead) return { kind: "upload" };
  if (remoteAhead && !localAhead) return { kind: "adopt" };

  // Neither side contains the other: both hold runs the other never saw.
  return { kind: "choose", local: summarizeCareer(local), remote: summarizeCareer(remote) };
}
