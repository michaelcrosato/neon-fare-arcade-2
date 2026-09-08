import { clamp, distance, mulberry32 } from "./math";
import { DISPLAY_METERS_PER_WORLD_UNIT } from "./config";
import { cityRouteDistance } from "./fare-market";
import type {
  CourierContractId,
  CourierHandling,
  CourierMapMarker,
  Game,
  Vec2,
  VenueRef,
} from "./model";
import { creditRunTime, quickTimeBonus } from "./run-rules";

export type CourierStop = {
  venue: VenueRef;
  entrance: Vec2;
};

export type CourierContract = {
  id: CourierContractId;
  title: string;
  cargo: string;
  client: string;
  handling: CourierHandling;
  origin: CourierStop;
  destination: CourierStop;
};

const stop = (id: string, kind: VenueRef["kind"], label: string, x: number, y: number): CourierStop => ({
  venue: { id, kind, label },
  entrance: { x, y },
});

/**
 * Authored courier routes intentionally span several districts and interior
 * families. Stable venue IDs are checked against generated portal metadata in
 * tests so world edits cannot silently strand a contract.
 */
export const COURIER_CONTRACTS: readonly CourierContract[] = [
  {
    id: "paper-rush",
    title: "PAPER RUSH",
    cargo: "SIGNED BLUEPRINTS",
    client: "INKWORKS",
    handling: "rush",
    origin: stop("venue:-1:0:office", "office", "APEX BUSINESS", -14.348, 18.44),
    destination: stop("venue:-2:-2:lobby", "apartment", "SUNSET HEIGHTS", -47.092, -58.752),
  },
  {
    id: "turbo-parts",
    title: "TURBO PARTS",
    cargo: "TUNED INJECTOR",
    client: "SPLASHLINE",
    handling: "fragile",
    origin: stop("venue:-5:-2:desk", "garage", "SPLASHLINE", -161.516, -50.92),
    destination: stop("venue:-1:0:office", "office", "APEX BUSINESS", -14.348, 18.44),
  },
  {
    id: "civic-seal",
    title: "CIVIC SEAL",
    cargo: "SEALED RECORDS",
    client: "RUSH DEPOT",
    handling: "standard",
    origin: stop("venue:6:-4:dispatch", "warehouse", "RUSH DEPOT", 237.916, -119.488),
    destination: stop("venue:1:1:desk", "civic", "CIVIC CENTER", 54, 53.12),
  },
  {
    id: "machine-core",
    title: "MACHINE CORE",
    cargo: "CALIBRATED ROTOR",
    client: "VOLT WORKS",
    handling: "fragile",
    origin: stop("venue:-3:-9:dispatch", "factory", "VOLT WORKS", -93.344, -303.008),
    destination: stop("venue:9:8:office", "marina", "BLUE LINE MARINA", 335.576, 313.172),
  },
  {
    id: "lost-case",
    title: "LOST CASE",
    cargo: "GUEST LUGGAGE",
    client: "FLASH MOTEL",
    handling: "rush",
    origin: stop("venue:-5:-1:lobby", "motel", "FLASH MOTEL", -168.776, -13.424),
    destination: stop("venue:9:-2:unit", "residence", "BRICK ROW", 339.58, -54),
  },
  {
    id: "cold-crate",
    title: "COLD CRATE",
    cargo: "HARBOR PRODUCE",
    client: "BLUE LINE",
    handling: "standard",
    origin: stop("venue:9:8:office", "marina", "BLUE LINE MARINA", 335.576, 313.172),
    destination: stop("venue:5:2:landmark", "hotel", "APEX HOTEL", 196.5, 95.55),
  },
] as const;

export const ALL_COURIER_MASK = (1 << COURIER_CONTRACTS.length) - 1;
export const COURIER_PICKUP_TAXI_RADIUS = 18;
export const COURIER_HANDOFF_TAXI_RADIUS = 18;

const contractIndex = new Map(COURIER_CONTRACTS.map((contract, index) => [contract.id, index]));
const contractsById = new Map(COURIER_CONTRACTS.map((contract) => [contract.id, contract]));
const courierStopVenueIds = new Set(COURIER_CONTRACTS.flatMap((contract) => [
  contract.origin.venue.id,
  contract.destination.venue.id,
]));

export function courierContract(id: CourierContractId) {
  const contract = contractsById.get(id);
  if (!contract) throw new Error(`Unknown courier contract: ${id}`);
  return contract;
}

export function activeCourierContract(game: Game) {
  return game.activeCourier ? courierContract(game.activeCourier.contractId) : null;
}

export function createCourierOfferOrder(runSeed: number, cycle: number) {
  const random = mulberry32((
    (runSeed >>> 0)
    ^ Math.imul(cycle + 3, 0x27d4eb2d)
    ^ 0xc0a71e2
  ) >>> 0);
  const order = COURIER_CONTRACTS.map((contract) => contract.id);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

export type CourierDistanceQuote = {
  pickupDistance: number;
  deliveryDistance: number;
  totalDistance: number;
  routeMeters: number;
  approachSeconds: number;
  completionSeconds: number;
  totalSeconds: number;
  parSeconds: number;
  baseScore: number;
  estimatedCash: number;
};

function courierQuoteFromDistances(
  contract: CourierContract,
  pickupDistance: number,
  deliveryDistance: number,
): CourierDistanceQuote {
  const totalDistance = pickupDistance + deliveryDistance;
  const cleanBaseline = contract.handling === "fragile" ? 260 : 200;
  const baseScore = 260 + Math.round(totalDistance * 5.2);
  const approachSeconds = clamp(Math.round(3 + pickupDistance / 90), 3, 12);
  const completionSeconds = clamp(Math.round(5 + deliveryDistance / 75), 6, 18);
  return {
    pickupDistance,
    deliveryDistance,
    totalDistance,
    routeMeters: Math.round(totalDistance * DISPLAY_METERS_PER_WORLD_UNIT),
    approachSeconds,
    completionSeconds,
    totalSeconds: approachSeconds + completionSeconds,
    parSeconds: clamp(totalDistance / 17 + 14, 18, 78),
    baseScore,
    estimatedCash: Math.max(18, Math.round((baseScore + cleanBaseline) / 42)),
  };
}

export function courierDistanceQuote(
  contract: CourierContract,
  taxiPoint: Vec2 = contract.origin.entrance,
) {
  return courierQuoteFromDistances(
    contract,
    cityRouteDistance(taxiPoint, contract.origin.entrance),
    cityRouteDistance(contract.origin.entrance, contract.destination.entrance),
  );
}

export function courierContractDistance(
  contract: CourierContract,
  taxiPoint: Vec2 = contract.origin.entrance,
) {
  return courierDistanceQuote(contract, taxiPoint).totalDistance;
}

export function courierOfferCash(
  contract: CourierContract,
  taxiPoint: Vec2 = contract.origin.entrance,
) {
  return courierDistanceQuote(contract, taxiPoint).estimatedCash;
}

export function availableCourierContracts(game: Game) {
  return game.courierOfferOrder.map(courierContract).filter((contract) => {
    const index = contractIndex.get(contract.id) ?? -1;
    return index >= 0 && (game.availableCourierMask & (1 << index)) !== 0;
  });
}

export type CourierAcceptResult =
  | { status: "accepted"; contract: CourierContract; bonusSeconds: number }
  | { status: "passenger-onboard" | "active" | "unavailable"; contract: CourierContract };

export function acceptCourierContract(game: Game, id: CourierContractId): CourierAcceptResult {
  const contract = courierContract(id);
  if (game.onboard) return { status: "passenger-onboard", contract };
  if (game.activeCourier) return { status: "active", contract };
  const index = contractIndex.get(id) ?? -1;
  if (index < 0 || (game.availableCourierMask & (1 << index)) === 0) {
    return { status: "unavailable", contract };
  }
  const quote = courierDistanceQuote(contract, game);
  const bonusSeconds = creditRunTime(game, quote.approachSeconds);
  game.activeCourier = {
    contractId: id,
    stage: "pickup",
    acceptedAt: game.elapsed,
    pickedUpAt: 0,
    approachDistance: quote.pickupDistance,
    deliveryDistance: quote.deliveryDistance,
    hadCollision: false,
    loadedInTaxi: false,
  };
  game.availableCourierMask &= ~(1 << index);
  game.objectiveDwell = 0;
  game.objectiveLockUntil = game.elapsed + 0.2;
  game.message = "COURIER RUN ACCEPTED!";
  game.messageUntil = game.elapsed + 1.6;
  return { status: "accepted", contract, bonusSeconds };
}

export function venueHasCourierCounter(venue: VenueRef) {
  return courierStopVenueIds.has(venue.id);
}

export function venueHasCourierBoard(venue: VenueRef) {
  return venue.kind === "home"
    || venue.kind === "office"
    || venue.kind === "warehouse"
    || venue.kind === "market"
    || venue.kind === "garage"
    || venue.kind === "civic"
    || venue.kind === "terminal";
}

export type CourierCounterPrompt = {
  label: string;
  detail: string;
  priority: number;
};

export function courierCounterPrompt(game: Game, venue: VenueRef): CourierCounterPrompt {
  const active = game.activeCourier;
  if (!active) return { label: "COURIER COUNTER", detail: "TAKE A JOB FROM A DISPATCH BOARD", priority: 4 };
  const contract = courierContract(active.contractId);
  const expected = active.stage === "pickup" ? contract.origin : contract.destination;
  if (venue.id !== expected.venue.id) {
    return {
      label: "WRONG COUNTER",
      detail: `${active.stage === "pickup" ? "COLLECT AT" : "DELIVER TO"} ${expected.venue.label}`,
      priority: 3,
    };
  }
  if (active.stage === "pickup" && distance(game, contract.origin.entrance) > COURIER_PICKUP_TAXI_RADIUS) {
    return { label: "BRING TAXI CLOSER", detail: `PARK AT ${contract.origin.venue.label}`, priority: 0 };
  }
  if (active.stage === "dropoff" && !active.loadedInTaxi) {
    return { label: "RETURN TO TAXI", detail: "LOAD THE PACKAGE BEFORE DELIVERY", priority: 0 };
  }
  if (active.stage === "dropoff" && distance(game, contract.destination.entrance) > COURIER_HANDOFF_TAXI_RADIUS) {
    return { label: "BRING TAXI CLOSER", detail: `PARK AT ${contract.destination.venue.label}`, priority: 0 };
  }
  return active.stage === "pickup"
    ? { label: `PICK UP ${contract.cargo}`, detail: `${contract.handling.toUpperCase()} · THEN RETURN TO TAXI`, priority: 0 }
    : { label: `HAND OFF ${contract.cargo}`, detail: `DELIVER TO ${contract.destination.venue.label}`, priority: 0 };
}

export type CourierCounterEvent =
  | {
      type: "courier-pickup";
      contractId: CourierContractId;
      cargo: string;
      destination: string;
    }
  | {
      type: "courier-dropoff";
      contractId: CourierContractId;
      cargo: string;
      destination: string;
      fareAward: number;
      scoreAward: number;
      bonusSeconds: number;
      multiplier: number;
    }
  | {
      type: "courier-blocked";
      reason: "no-contract" | "wrong-venue" | "pickup-taxi-too-far" | "return-to-taxi" | "taxi-too-far";
    };

export function markCourierLoadedInTaxi(game: Game) {
  const active = game.activeCourier;
  if (!active || active.stage !== "dropoff" || active.loadedInTaxi) return null;
  active.loadedInTaxi = true;
  game.message = "PACKAGE LOADED!";
  game.messageUntil = game.elapsed + 1.5;
  return courierContract(active.contractId);
}

export function resolveCourierCounter(game: Game, venue: VenueRef): CourierCounterEvent {
  const active = game.activeCourier;
  if (!active) return { type: "courier-blocked", reason: "no-contract" };
  const contract = courierContract(active.contractId);
  const expected = active.stage === "pickup" ? contract.origin : contract.destination;
  if (venue.id !== expected.venue.id) return { type: "courier-blocked", reason: "wrong-venue" };

  if (active.stage === "pickup") {
    if (distance(game, contract.origin.entrance) > COURIER_PICKUP_TAXI_RADIUS) {
      return { type: "courier-blocked", reason: "pickup-taxi-too-far" };
    }
    active.stage = "dropoff";
    active.pickedUpAt = game.elapsed;
    active.hadCollision = false;
    active.loadedInTaxi = false;
    game.score += 75;
    game.boost = Math.min(100, game.boost + 8);
    game.message = "PARCEL SECURED!";
    game.messageUntil = game.elapsed + 1.5;
    return {
      type: "courier-pickup",
      contractId: contract.id,
      cargo: contract.cargo,
      destination: contract.destination.venue.label,
    };
  }

  if (!active.loadedInTaxi) return { type: "courier-blocked", reason: "return-to-taxi" };
  if (distance(game, contract.destination.entrance) > COURIER_HANDOFF_TAXI_RADIUS) {
    return { type: "courier-blocked", reason: "taxi-too-far" };
  }

  const quote = courierQuoteFromDistances(
    contract,
    active.approachDistance,
    active.deliveryDistance,
  );
  const totalTime = Math.max(1, game.elapsed - active.acceptedAt);
  const quickRate = contract.handling === "rush" ? 40 : 30;
  const quick = quickTimeBonus(
    game,
    Math.round(Math.max(0, quote.parSeconds - totalTime) * quickRate),
  );
  const clean = active.hadCollision ? 0 : contract.handling === "fragile" ? 260 : 200;
  if (!active.hadCollision) game.combo = Math.min(3, game.combo + 0.5);
  else game.combo = 1;
  game.bestMultiplier = Math.max(game.bestMultiplier, game.combo);
  const earned = Math.round((quote.baseScore + quick + clean) * game.combo);
  const fareAward = Math.max(18, Math.round(earned / 42));
  const bonusSeconds = creditRunTime(game, quote.completionSeconds);
  game.score += earned;
  game.fare += fareAward;
  game.deliveries += 1;
  game.courierDeliveries += 1;
  game.boost = Math.min(100, game.boost + 24);
  game.message = "COURIER COMPLETE!";
  game.messageUntil = game.elapsed + 1.8;
  game.activeCourier = null;
  if (game.availableCourierMask === 0) {
    game.availableCourierMask = ALL_COURIER_MASK;
    game.courierCycle += 1;
    game.courierOfferOrder = createCourierOfferOrder(game.runSeed, game.courierCycle);
  }
  return {
    type: "courier-dropoff",
    contractId: contract.id,
    cargo: contract.cargo,
    destination: contract.destination.venue.label,
    fareAward,
    scoreAward: earned,
    bonusSeconds,
    multiplier: game.combo,
  };
}

export function courierMapMarkers(game: Game): CourierMapMarker[] {
  const active = activeCourierContract(game);
  if (active && game.activeCourier) {
    const phase = game.activeCourier.stage;
    const stopPoint = phase === "pickup" ? active.origin.entrance : active.destination.entrance;
    const label = phase === "pickup" ? active.origin.venue.label : active.destination.venue.label;
    return [{ id: active.id, label, point: stopPoint, active: true, phase }];
  }
  return availableCourierContracts(game).map((contract) => ({
    id: contract.id,
    label: contract.origin.venue.label,
    point: contract.origin.entrance,
    active: false,
    phase: "pickup" as const,
  }));
}
