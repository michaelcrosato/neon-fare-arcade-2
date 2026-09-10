import { makeArcadeVehicleState } from "./arcade-handling";
import { taxiNearBuilding } from "./collision";
import { setCustomDestination } from "./custom-destination";
import { destinationCardsForPlace } from "./destination-cards";
import { landmarkDestinationStops } from "./fare-placement";
import { markFarePickedUp } from "./fare-selection";
import type { Game, WorldPoint } from "./model";
import { closestClearRecoveryRoad } from "./recovery";
import { roadLanePose, type RoadLanePose } from "./road-lanes";
import { isRoadSurface } from "./road-network";
import { isPlayablePoint } from "./regions";
import { makeSimulationVehicleState } from "./simulation-vehicle";
import { activePassengerJob } from "./state";
import { groundAt, makeVehicleRoadMotion } from "./vehicle-road-contact";
import { CityStream } from "./world";

export type DevelopmentAction =
  | { kind: "route-landmark" | "teleport-landmark" | "load-fare"; placeId: string; occasion?: number }
  | { kind: "reset-taxi" | "refill-boost" | "clear-traffic" | "teleport-pickup" | "teleport-dropoff" | "step" }
  | { kind: "restart"; seed: number };

export type DevelopmentActionResult = { ok: boolean; message: string };

function clearArrivalPose(game: Game, point: WorldPoint, heading: number): RoadLanePose | null {
  const lane = roadLanePose(point, heading);
  const support = groundAt(point, .85, lane.roadId, lane.heading);
  const pose = { ...lane, x: point.x, y: point.y, z: support.height, roadId: support.roadId };
  if (!isPlayablePoint(pose.x, pose.y, 2.6) || !isRoadSurface(pose) || support.normal.z < .75) return null;
  if (game.traffic.some(car => game.elapsed >= car.activeAt && Math.abs((car.z ?? 0) - pose.z) < 2
    && Math.hypot(car.x - pose.x, car.y - pose.y) < 8)) return null;
  const world = new CityStream().update(pose.x, pose.y, 1);
  if (taxiNearBuilding(world, pose.x, pose.y, pose.heading, .45, pose.z)) return null;
  const c = Math.cos(pose.heading), s = Math.sin(pose.heading), normal = support.normal;
  pose.pitch = Math.atan2(normal.x * c + normal.y * s, normal.z);
  pose.roll = Math.atan2(normal.x * s - normal.y * c, normal.z);
  return pose;
}

function teleportTaxi(game: Game, point: WorldPoint, heading = game.heading, arrival = false): boolean {
  const candidate = { ...game, x: point.x, y: point.y, z: point.z ?? 0, heading, player: { kind: "driving" as const } };
  const pose = (arrival ? clearArrivalPose(game, point, heading) : null) ?? closestClearRecoveryRoad(candidate);
  if (!pose) return false;
  Object.assign(game, { x: pose.x, y: pose.y, z: pose.z, heading: pose.heading,
    vx: 0, vy: 0, speed: 0, steering: 0, brakeInputHeld: false, brakeDriftKick: 0, brakeDriftCooldown: 0,
    drifting: false, driftIntensity: 0, driftAngle: 0, driftBank: 0, driftScoreCarry: 0, boosting: false,
    objectiveDwell: 0, objectiveLockUntil: Math.max(game.objectiveLockUntil, game.elapsed + 1),
    collisionCooldown: Math.max(game.collisionCooldown, 1), interactionHeld: false });
  game.roadMotion = { ...makeVehicleRoadMotion(), roadId: pose.roadId, pitch: pose.pitch, roll: pose.roll };
  game.arcadeVehicle = makeArcadeVehicleState();
  game.simulationVehicle = makeSimulationVehicleState();
  game.player = { kind: "driving" };
  if (game.activeCourier?.stage === "dropoff") game.activeCourier.loadedInTaxi = true;
  game.particles = [];
  game.towRecovery = null;
  game.navigationRevision = (game.navigationRevision ?? 0) + 1;
  game.playtest = true;
  return true;
}

/** Explicit playtest commands; normal gameplay never calls this owner. */
export function performDevelopmentAction(game: Game, action: DevelopmentAction): DevelopmentActionResult {
  if (!game.development?.enabled) return { ok: false, message: "Enable Dev Mode first." };
  const done = (message: string) => ({ ok: true, message });
  const failed = (message: string) => ({ ok: false, message });
  if (action.kind === "refill-boost") {
    if (game.drivingModel !== "arcade") return failed("Boost is available in arcade handling.");
    game.boost = 100; game.playtest = true;
    return done("Boost refilled.");
  }
  if (action.kind === "clear-traffic") {
    game.traffic = []; game.playtest = true;
    return done("Active traffic cleared. Traffic can stream in as you travel.");
  }
  if (action.kind === "step" || action.kind === "restart") return failed("Use the paused runtime controls for this action.");
  if (action.kind === "reset-taxi" || action.kind === "teleport-pickup" || action.kind === "teleport-dropoff") {
    const job = activePassengerJob(game);
    const point = action.kind === "teleport-pickup" ? job.pickupApproach
      : action.kind === "teleport-dropoff" ? job.dropoffApproach : game;
    return teleportTaxi(game, point, game.heading, action.kind !== "reset-taxi") ? done("Taxi placed upright on the nearest clear road.") : failed("No clear road found here.");
  }
  if (!("placeId" in action)) return failed("Unknown playtest action.");
  const stop = landmarkDestinationStops(action.placeId, game.runSeed)[0];
  const cards = destinationCardsForPlace(action.placeId);
  const occasion = Number.isFinite(action.occasion) ? Math.trunc(action.occasion!) : 0;
  const card = cards[Math.max(0, Math.min(cards.length - 1, occasion))];
  if (!stop || !card) return failed("No validated arrival curb for this destination.");
  if (action.kind === "route-landmark") {
    return setCustomDestination(game, stop.approach) ? done(`GPS set to ${card.label}.`) : failed("No routeable road found.");
  }
  if (action.kind === "teleport-landmark") {
    return teleportTaxi(game, stop.approach, stop.approachHeading, true)
      ? done(`Arrived beside ${card.label}.`) : failed("No clear arrival road found.");
  }
  const index = game.jobIndex % game.fareJobs.length;
  game.fareJobs[index] = { ...activePassengerJob(game), dropoffStopId: stop.id, dropoff: stop.zone,
    dropoffApproach: stop.approach, destination: card.label, destinationArtCell: card.artCell,
    destinationCard: card, regionalTransfer: null };
  game.onboard = true;
  game.fareDispatchEnabled = true;
  game.jobStartedAt = game.elapsed;
  game.tripHadCollision = false;
  game.passengerReview = null;
  game.activeCourier = null;
  game.customDestination = null;
  game.objectiveDwell = 0;
  game.objectiveLockUntil = game.elapsed + 1;
  markFarePickedUp(game, index);
  game.navigationRevision = (game.navigationRevision ?? 0) + 1;
  game.playtest = true;
  return done(`Test passenger aboard: ${card.occasion} at ${card.label}.`);
}
