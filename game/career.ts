import type { Game, RunRecord, RunUpgradeId } from "./model";
import { isTimedRun } from "./run-rules";

export const CAREER_STORAGE_KEY = "neon-fare-career-v1";

export type CareerItemId =
  | "neon-loft"
  | "garage-base"
  | "boost-locker"
  | "dispatch-desk"
  | RunUpgradeId;

export type CareerState = {
  version: 1;
  bank: number;
  owned: CareerItemId[];
  runsCompleted: number;
  lifetimeFare: number;
  lifetimeScore: number;
  lifetimeDeliveries: number;
};

export type CareerItem = {
  id: CareerItemId;
  name: string;
  category: "PROPERTY" | "HOME BASE" | "UPGRADE";
  cost: number;
  description: string;
  effect: string;
  requires: readonly CareerItemId[];
  vendor: "home" | "gas";
};

export const CAREER_ITEMS = [
  {
    id: "neon-loft",
    name: "STARTER LOFT",
    category: "PROPERTY",
    cost: 150,
    description: "Claim Neon Lofts as your permanent apartment and unlock its home-base upgrades.",
    effect: "APARTMENT OWNERSHIP · UPGRADE ACCESS",
    requires: [],
    vendor: "home",
  },
  {
    id: "garage-base",
    name: "GARAGE HOME BASE",
    category: "HOME BASE",
    cost: 300,
    description: "Add a workshop bay and one complete boost refill during every shift.",
    effect: "1× FULL BOOST REFILL PER RUN",
    requires: ["neon-loft"],
    vendor: "home",
  },
  {
    id: "boost-locker",
    name: "TURBO LOCKER",
    category: "UPGRADE",
    cost: 125,
    description: "Keep a tuned boost canister ready for the next taxi run.",
    effect: "START FUTURE RUNS AT 65% BOOST",
    requires: ["garage-base"],
    vendor: "home",
  },
  {
    id: "dispatch-desk",
    name: "DISPATCH DESK",
    category: "UPGRADE",
    cost: 140,
    description: "Install a route scanner and prep every future Arcade Shift before leaving home.",
    effect: "+5 SEC AT THE START OF FUTURE ARCADE SHIFTS",
    requires: ["neon-loft"],
    vendor: "home",
  },
  {
    id: "boost-cooler",
    name: "BOOST COOLER",
    category: "UPGRADE",
    cost: 180,
    description: "Keep the turbo charge colder so every boost tank lasts longer.",
    effect: "12% SLOWER BOOST DRAIN",
    requires: [],
    vendor: "gas",
  },
  {
    id: "boost-overdrive",
    name: "BOOST OVERDRIVE",
    category: "UPGRADE",
    cost: 260,
    description: "Replace the boost governor with a high-flow controller built for long straightaways.",
    effect: "BOOSTED SPEED CAP · +60 KM/H",
    requires: [],
    vendor: "gas",
  },
  {
    id: "rally-tires",
    name: "RALLY TIRES",
    category: "UPGRADE",
    cost: 160,
    description: "Chunky street rubber keeps more momentum when a shortcut leaves the asphalt.",
    effect: "26% LESS OFF-ROAD DRAG",
    requires: [],
    vendor: "gas",
  },
  {
    id: "impact-bars",
    name: "IMPACT BARS",
    category: "UPGRADE",
    cost: 200,
    description: "Reinforce the cab so hard hits spill half as much stored boost.",
    effect: "50% LESS COLLISION BOOST LOSS",
    requires: [],
    vendor: "gas",
  },
] as const satisfies readonly CareerItem[];

export const HOME_CAREER_ITEMS = CAREER_ITEMS.filter((item) => item.vendor === "home");
export const GAS_CAREER_ITEMS = CAREER_ITEMS.filter((item) => item.vendor === "gas");

const careerIds = new Set<CareerItemId>(CAREER_ITEMS.map((item) => item.id));

export function makeCareerState(): CareerState {
  return {
    version: 1,
    bank: 0,
    owned: [],
    runsCompleted: 0,
    lifetimeFare: 0,
    lifetimeScore: 0,
    lifetimeDeliveries: 0,
  };
}

function safeWholeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function normalizeCareerState(raw: unknown): CareerState {
  if (!raw || typeof raw !== "object") return makeCareerState();
  const candidate = raw as Partial<CareerState>;
  const owned = Array.isArray(candidate.owned)
    ? candidate.owned.filter((id): id is CareerItemId => careerIds.has(id as CareerItemId))
    : [];
  return {
    version: 1,
    bank: safeWholeNumber(candidate.bank),
    owned: [...new Set(owned)],
    runsCompleted: safeWholeNumber(candidate.runsCompleted),
    lifetimeFare: safeWholeNumber(candidate.lifetimeFare),
    lifetimeScore: safeWholeNumber(candidate.lifetimeScore),
    lifetimeDeliveries: safeWholeNumber(candidate.lifetimeDeliveries),
  };
}

/** One-time compatibility credit for players with run logs from before careers. */
export function careerFromRunRecords(records: readonly RunRecord[]): CareerState {
  return records.reduce<CareerState>((career, record) => ({
    ...career,
    bank: career.bank + safeWholeNumber(record.fare),
    runsCompleted: career.runsCompleted + 1,
    lifetimeFare: career.lifetimeFare + safeWholeNumber(record.fare),
    lifetimeScore: career.lifetimeScore + safeWholeNumber(record.score),
    lifetimeDeliveries: career.lifetimeDeliveries + safeWholeNumber(record.deliveries),
  }), makeCareerState());
}

export function bankCareerRun(
  career: CareerState,
  result: Pick<Game, "fare" | "score" | "deliveries">,
): CareerState {
  const fare = safeWholeNumber(result.fare);
  return {
    ...career,
    bank: career.bank + fare,
    runsCompleted: career.runsCompleted + 1,
    lifetimeFare: career.lifetimeFare + fare,
    lifetimeScore: career.lifetimeScore + safeWholeNumber(result.score),
    lifetimeDeliveries: career.lifetimeDeliveries + safeWholeNumber(result.deliveries),
  };
}

export function careerOwns(career: CareerState, id: CareerItemId) {
  return career.owned.includes(id);
}

export type CareerPurchaseResult =
  | { status: "purchased"; state: CareerState; item: CareerItem }
  | { status: "owned" | "locked" | "insufficient"; state: CareerState; item: CareerItem };

export function purchaseCareerItem(career: CareerState, id: CareerItemId): CareerPurchaseResult {
  const item = CAREER_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown career item: ${id}`);
  if (careerOwns(career, id)) return { status: "owned", state: career, item };
  if (item.requires.some((requirement) => !careerOwns(career, requirement))) {
    return { status: "locked", state: career, item };
  }
  if (career.bank < item.cost) return { status: "insufficient", state: career, item };
  return {
    status: "purchased",
    item,
    state: {
      ...career,
      bank: career.bank - item.cost,
      owned: [...career.owned, id],
    },
  };
}

/** Permanent career modifiers apply once, when a fresh run is created. */
export function applyCareerRunBonuses(game: Game, career: CareerState) {
  if (game.drivingModel === "arcade" && careerOwns(career, "boost-locker")) {
    game.boost = Math.max(game.boost, 65);
  }
  if (isTimedRun(game) && careerOwns(career, "dispatch-desk")) {
    game.timeLeft = Math.min(99, game.timeLeft + 5);
  }
  game.installedUpgrades = GAS_CAREER_ITEMS
    .map((item) => item.id)
    .filter((id): id is RunUpgradeId => careerOwns(career, id));
}

export type HomeRechargeResult = "recharged" | "locked" | "used" | "not-home" | "simulation-disabled";

/** The garage service is simulation state, not a React-only button effect. */
export function rechargeTaxiAtHome(game: Game, career: CareerState): HomeRechargeResult {
  const atHome = game.player.kind === "walking"
    && game.player.location.kind === "interior"
    && game.player.location.venue.kind === "home";
  if (!atHome) return "not-home";
  if (!careerOwns(career, "garage-base")) return "locked";
  if (game.drivingModel === "simulation") return "simulation-disabled";
  if (game.homeRechargeUsed) return "used";
  game.boost = 100;
  game.homeRechargeUsed = true;
  return "recharged";
}
