import { makeArcadeVehicleState } from "./arcade-handling";
import { TOW_COST, TOW_SECONDS } from "./config";
import { taxiNearBuilding } from "./collision";
import { localPoint } from "./math";
import type { Game, WorldPoint, WorldView } from "./model";
import { controlledPose } from "./player";
import { isPlayablePoint } from "./regions";
import { roadLanePose, type RoadLanePose } from "./road-lanes";
import { isRoadSurface, nearestRoadProjection, recoveryRoadProjections, routeRoadNetwork } from "./road-network";
import { roadDistance } from "./roads/geometry";
import { makeSimulationVehicleState } from "./simulation-vehicle";
import { groundAt, makeVehicleRoadMotion } from "./vehicle-road-contact";
import { CityStream } from "./world";

export function recoveryCost(game: Pick<Game, "fare">) { return game.fare >= TOW_COST ? TOW_COST : 0; }

function recoveryOrigin(game: Game) {
  return game.player.kind === "walking" && game.player.location.kind === "interior"
    ? game.player.location.returnPose : controlledPose(game);
}

export function closestClearRecoveryRoad(game: Game, worldAt?: (point: WorldPoint) => WorldView): RoadLanePose | null {
  const origin = recoveryOrigin(game);
  if (![origin.x, origin.y, origin.z ?? 0, origin.heading].every(Number.isFinite)) return null;
  const stream = worldAt ? null : new CityStream();
  const getWorld = worldAt ?? ((point: WorldPoint) => stream!.update(point.x, point.y, 1));
  let best: RoadLanePose | null = null, bestDistance = Infinity;
  const seen = new Set<string>();
  for (const projection of recoveryRoadProjections(origin)) {
    if (roadDistance(origin, projection.point) > bestDistance + 15) break;
    const headings = [projection.allowAB ? projection.tangentYaw : null, projection.allowBA ? projection.tangentYaw + Math.PI : null]
      .filter((heading): heading is number => heading !== null)
      .sort((a, b) => Math.cos(b - origin.heading) - Math.cos(a - origin.heading));
    for (const heading of headings) for (const advance of [0, -6, 6, -12, 12]) {
      const center = localPoint(projection.point.x, projection.point.y, heading, advance, 0);
      const pose = roadLanePose({ ...center, z: projection.point.z ?? 0 }, heading);
      const key = `${pose.x.toFixed(2)}:${pose.y.toFixed(2)}:${pose.z.toFixed(2)}:${pose.heading.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const distance = roadDistance(origin, pose);
      if (distance >= bestDistance || !isPlayablePoint(pose.x, pose.y, 2.6) || !isRoadSurface(pose)) continue;
      const support = groundAt(pose, .1, pose.roadId, pose.heading);
      if (Math.abs(support.height - pose.z) > .05 || support.normal.z < .75) continue;
      if (game.traffic.some(car => game.elapsed >= car.activeAt && Math.abs((car.z ?? 0) - pose.z) < 2
        && Math.hypot(car.x - pose.x, car.y - pose.y) < 8)) continue;
      const world = getWorld(pose);
      if (taxiNearBuilding(world, pose.x, pose.y, pose.heading, .45, pose.z)) continue;
      best = pose; bestDistance = distance;
    }
  }
  return best;
}

/** A short road-following path for the truck; never invent pavement across a ravine. */
function towDeparturePath(pose: RoadLanePose) {
  const ahead = localPoint(pose.x, pose.y, pose.heading, 90, 0);
  const target = nearestRoadProjection(ahead).point;
  const route = routeRoadNetwork(pose, target, pose.heading, 1)?.route ?? [pose];
  const path: Array<WorldPoint & { heading: number }> = [];
  let distance = 0, next = 0;
  for (let index = 1; index < route.length && next <= 60; index++) {
    const a = route[index - 1], b = route[index], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < .01) continue;
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    while (next <= distance + length && next <= 60) {
      const t = (next - distance) / length;
      const lane = roadLanePose({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
        z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t }, heading);
      path.push({ x: lane.x, y: lane.y, z: lane.z, heading: lane.heading });
      next += 3;
    }
    distance += length;
  }
  return path.length ? path : [{ x: pose.x, y: pose.y, z: pose.z, heading: pose.heading }];
}

/** Explicit pause-menu rescue: preserve the run and jobs, reset only the stranded actors. */
export function recoverToRoad(game: Game, worldAt?: (point: WorldPoint) => WorldView) {
  if (game.towRecovery && game.elapsed - game.towRecovery.startedAt < TOW_SECONDS) return null;
  const pose = closestClearRecoveryRoad(game, worldAt);
  if (!pose) return null;
  const cost = recoveryCost(game);
  const path = towDeparturePath(pose);
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
  game.fare -= cost;
  game.towRecovery = { startedAt: game.elapsed, cost, path };
  game.message = "BACK ON THE ROAD!";
  game.messageUntil = game.elapsed + 1.2;
  return game.towRecovery;
}
