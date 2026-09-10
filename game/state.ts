import {
  BLUE,
  BONE,
  CYAN,
  ALL_FARES_MASK,
  MUTED_RED,
  ORANGE,
  PINK,
  RED,
  ROAD_SPACING,
  RUN_TIME,
  TAXI_START,
  WHITE,
} from "./config";
import {
  ALL_COURIER_MASK,
  activeCourierContract,
  createCourierOfferOrder,
} from "./courier";
import {
  DEFAULT_DRIVING_TRAIT_ID,
  drivingTraitPackage,
} from "./driving-traits";
import {
  DEFAULT_FARE_RUN_SEED,
  createFareMarket,
} from "./fare-market";
import { mulberry32, rightHandTrafficLane } from "./math";
import type { DrivingModel, DrivingTraitId, Game, RunKind, TrafficCar } from "./model";
import { makeSimulationVehicleState } from "./simulation-vehicle";
import { sampleSpecialRoad, specialRoadLength } from "./road-network";
import { containingRegionForPosition } from "./regions";
import { makeVehicleRoadMotion } from "./vehicle-road-contact";
import { ROAD_SURFACE_HEIGHT } from "./roads/contact";
import { makeArcadeVehicleState } from "./arcade-handling";

export function makeTraffic(): TrafficCar[] {
  const random = mulberry32(0xc0ffee);
  const colors = [RED, CYAN, WHITE, MUTED_RED, BLUE, ORANGE, PINK, BONE] as const;
  const pathRoads = new Map<number, string>([
    [6, "cypress-causeway"],
    [7, "pacific-coast-drive"],
    [8, "aurora-boulevard"],
    [10, "northstar-highway"],
    [12, "apex-circle"],
    [14, "pinehook-loop"],
    [16, "lantern-bay-loop"],
    [17, "sunset-boulevard"],
    [18, "crosstown-boulevard"],
    [20, "mirror-lake-road"],
    [22, "market-circle"],
    [24, "silver-run-switchbacks"],
    [26, "painted-canyon-drive"],
    [27, "citrus-scenic-loop"],
    [28, "starfall-drive"],
    [30, "sundown-highway"],
    [32, "copper-loop"],
    [33, "mariposa-drive"],
    [34, "arroyo-road"],
    [25, "blackwater-trace"],
    [35, "stormwall-levee-road"],
  ]);
  return Array.from({ length: 36 }, (_, index) => {
    const horizontal = index % 2 === 0;
    let dir = (index % 4 < 2 ? 1 : -1) as 1 | -1;
    const road = (((index * 3) % 9) - 4) * ROAD_SPACING;
    const pathRoadId = pathRoads.get(index) ?? null;
    const randomPosition = random();
    const speed = 7 + random() * 5;
    if (pathRoadId) {
      if (pathRoadId.endsWith("circle")) dir = 1;
      const progress = randomPosition * specialRoadLength(pathRoadId);
      const sample = sampleSpecialRoad(pathRoadId, progress, 2.25 * dir);
      if (!sample) throw new Error(`Missing traffic road ${pathRoadId}`);
      return {
        x: sample.point.x,
        y: sample.point.y,
        z: sample.point.z + ROAD_SURFACE_HEIGHT,
        pitch: -Math.atan(sample.grade) * dir,
        roll: sample.bank * dir,
        heading: sample.heading + (dir < 0 ? Math.PI : 0),
        motion: { kind: "path", roadId: pathRoadId, progress },
        dir,
        speed,
        color: colors[index % colors.length],
        activeAt: index < 14 ? 0 : index < 26 ? 18 : 38,
        cooldown: 0,
      };
    }
    return {
      x: horizontal
        ? -150 + randomPosition * 300
        : rightHandTrafficLane("y", road, dir),
      y: horizontal
        ? rightHandTrafficLane("x", road, dir)
        : -150 + randomPosition * 300,
      heading: horizontal
        ? (dir > 0 ? 0 : Math.PI)
        : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      motion: { kind: "grid", axis: horizontal ? "x" : "y" },
      dir,
      speed,
      color: colors[index % colors.length],
      activeAt: index < 14 ? 0 : index < 26 ? 18 : 38,
      cooldown: 0,
    };
  });
}

export function makeGame(
  drivingTraitId: DrivingTraitId = DEFAULT_DRIVING_TRAIT_ID,
  runSeed = DEFAULT_FARE_RUN_SEED,
  runKind: RunKind = "timed",
  requestedDrivingModel: DrivingModel = "arcade",
): Game {
  const drivingTrait = drivingTraitPackage(drivingTraitId);
  const drivingModel: DrivingModel = runKind === "free-run" ? requestedDrivingModel : "arcade";
  const normalizedSeed = runSeed >>> 0;
  const initialFareRegion = containingRegionForPosition(TAXI_START.x, TAXI_START.y)!;
  const initialFareMarket = createFareMarket(normalizedSeed, 0, [], initialFareRegion);
  return {
    x: TAXI_START.x,
    towRecovery: null,
    y: TAXI_START.y,
    z: 0,
    roadMotion: makeVehicleRoadMotion(),
    arcadeVehicle: makeArcadeVehicleState(),
    vx: 0,
    vy: 0,
    heading: TAXI_START.heading,
    speed: 0,
    steering: 0,
    brakeInputHeld: false,
    brakeDriftKick: 0,
    brakeDriftCooldown: 0,
    drivingTraitId,
    drivingModel,
    simulationVehicle: makeSimulationVehicleState(),
    runKind,
    timeLeft: RUN_TIME,
    score: 0,
    fare: 0,
    boost: drivingModel === "simulation" ? 0 : drivingTrait.modifiers.initialBoost,
    combo: 1,
    deliveries: 0,
    collisions: 0,
    bestMultiplier: 1,
    runSeed: normalizedSeed,
    fareJobs: initialFareMarket.jobs,
    fareCycle: 0,
    fareDispatchEnabled: true,
    fareStreamAnchor: { x: TAXI_START.x, y: TAXI_START.y },
    fareStreamRevision: 0,
    fareStreamCheckAt: 0,
    fareServiceRegionId: initialFareRegion.id,
    usedFareRiderIdsByRegion: initialFareMarket.usedFareRiderIdsByRegion,
    // The generator reserves index zero for the visible opening pickup.
    jobIndex: 0,
    availableFareMask: ALL_FARES_MASK,
    onboard: false,
    jobStartedAt: 0,
    tripHadCollision: false,
    passengerReview: null,
    activeCourier: null,
    customDestination: null,
    availableCourierMask: ALL_COURIER_MASK,
    courierOfferOrder: createCourierOfferOrder(normalizedSeed, 0),
    courierCycle: 0,
    courierDeliveries: 0,
    elapsed: 0,
    countdown: 3,
    collisionCooldown: 0,
    objectiveDwell: 0,
    objectiveLockUntil: 0,
    message: "",
    messageUntil: 0,
    drifting: false,
    driftIntensity: 0,
    driftAngle: 0,
    boosting: false,
    driftBank: 0,
    driftScoreCarry: 0,
    lastBeep: 11,
    traffic: makeTraffic(),
    particles: [],
    player: { kind: "driving" },
    interactionHeld: false,
    homeRechargeUsed: false,
    gasTimePurchases: 0,
    installedUpgrades: [],
  };
}

export function activePassengerJob(game: Game) {
  return game.fareJobs[game.jobIndex % game.fareJobs.length];
}

export function getObjective(game: Game): import("./model").WorldPoint {
  const courier = activeCourierContract(game);
  if (courier && game.activeCourier) {
    return game.activeCourier.stage === "pickup"
      ? courier.origin.entrance
      : courier.destination.entrance;
  }
  if (!game.fareDispatchEnabled && !game.onboard) return { x: game.x, y: game.y, ...(game.z ? { z: game.z } : {}) };
  const job = activePassengerJob(game);
  return game.onboard ? job.dropoff : job.pickup;
}

/**
 * The visible/dwell objective lives at the curb. GPS ends at a verified road
 * pose so guidance never asks the taxi to mount the sidewalk.
 */
export function getNavigationTarget(game: Game) {
  if (game.customDestination) return game.customDestination;
  const courier = activeCourierContract(game);
  if (courier && game.activeCourier) {
    return game.activeCourier.stage === "pickup"
      ? courier.origin.entrance
      : courier.destination.entrance;
  }
  if (!game.fareDispatchEnabled && !game.onboard) return { x: game.x, y: game.y };
  const job = activePassengerJob(game);
  return game.onboard ? job.dropoffApproach : job.pickupApproach;
}

export function getObjectiveLabel(game: Game) {
  const courier = activeCourierContract(game);
  if (courier && game.activeCourier) {
    return game.activeCourier.stage === "pickup"
      ? `COURIER PICKUP · ${courier.origin.venue.label}`
      : `DELIVER ${courier.cargo} · ${courier.destination.venue.label}`;
  }
  if (!game.fareDispatchEnabled && !game.onboard) return "ROAM FREELY";
  const job = activePassengerJob(game);
  if (job.regionalTransfer) {
    return game.onboard
      ? `REGIONAL DROP · ${job.regionalTransfer.destinationRegionName}`
      : `REGIONAL FARE · ${job.rider}`;
  }
  return game.onboard
    ? `DROP ${job.rider} · ${job.destination}`
    : `PICK UP ${job.rider}`;
}

export function getObjectiveKey(game: Game) {
  if (game.activeCourier) return `courier:${game.activeCourier.contractId}:${game.activeCourier.stage}`;
  if (!game.fareDispatchEnabled && !game.onboard) return "off-duty";
  return `passenger:${activePassengerJob(game).id}:${game.onboard ? "drop" : "pickup"}`;
}

export function getNavigationKey(game: Game) {
  if (game.customDestination) {
    return `waypoint:${game.customDestination.x.toFixed(2)}:${game.customDestination.y.toFixed(2)}`;
  }
  return getObjectiveKey(game);
}

export function getNavigationLabel(game: Game) {
  return game.customDestination ? "CUSTOM DESTINATION" : getObjectiveLabel(game);
}

export function getNavigationType(game: Game) {
  return game.customDestination ? "waypoint" as const : getObjectiveType(game);
}

export function getObjectiveType(game: Game) {
  if (game.activeCourier) return game.activeCourier.stage === "pickup" ? "courier-pickup" : "courier-drop";
  if (!game.fareDispatchEnabled && !game.onboard) return "roam";
  return game.onboard ? "drop" : "pickup";
}
