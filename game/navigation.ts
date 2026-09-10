import {
  DISPLAY_METERS_PER_WORLD_UNIT,
  NAVIGATION_ARRIVAL_RADIUS,
  NAVIGATION_REPLAN_COOLDOWN,
  NAV_VELOCITY_HEADING_ENTER_SPEED,
  NAV_VELOCITY_HEADING_EXIT_SPEED,
  ROAD_HALF,
  TURN_APPROACH_LIMIT,
  TURN_CUE_ENTER_DISTANCE,
  TURN_CUE_EXIT_DISTANCE,
  TURN_EXIT_ALIGNMENT_LIMIT,
  TURN_EXIT_PROGRESS,
  UTURN_ALIGNMENT_HOLD,
  UTURN_ENTER_ANGLE,
  UTURN_EXIT_ANGLE,
} from "./config";
import {
  clamp,
  normalizeAngle,
  segmentYaw,
} from "./math";
import type { Game, NavigationPlan, TurnCue, WorldPoint } from "./model";
import { roadDistance as distance } from "./roads/geometry";
import {
  buildGpsRoute,
  compactRoute,
  routeLength,
} from "./route-geometry";
import {
  isRoadJunctionPoint,
  roadHalfWidthAtPoint,
  routeRoadNetwork,
} from "./road-network";
import { getNavigationKey, getNavigationTarget } from "./state";
import { DEFAULT_NAVIGATION_SETTINGS, normalizeNavigationSettings, type NavigationSettings } from "./navigation-policy";

export { buildGpsRoute, compactRoute, routeLength, snapToRoad } from "./route-geometry";
export type { RoadSnap } from "./route-geometry";

export type RouteCandidate = {
  route: WorldPoint[];
  departureYaw: number;
  cost?: number;
  usesSpecialRoad?: boolean;
};

export function routeDepartureYaw(route: WorldPoint[], fallback: number) {
  for (let index = 1; index < route.length; index += 1) {
    const before = route[index - 1];
    const point = route[index];
    const length = distance(before, point);
    if (length > 3) return segmentYaw(before, point);
  }
  const next = route.find((point, index) => index > 0 && distance(route[0], point) > 3);
  return next ? segmentYaw(route[0], next) : fallback;
}

function graphRouteCandidateForDirection(start: WorldPoint, target: WorldPoint, heading: number, direction: 1 | -1) {
  const route = routeRoadNetwork(start, target, heading, direction);
  return route ? { ...route, route: compactRoute(route.route) } : null;
}

export function buildNavigationPlan(start: WorldPoint, target: WorldPoint, heading: number,
  settings: Readonly<NavigationSettings> = DEFAULT_NAVIGATION_SETTINGS): NavigationPlan {
  const directDistance = distance(start, target);
  if (directDistance <= NAVIGATION_ARRIVAL_RADIUS && Math.abs((start.z ?? 0) - (target.z ?? 0)) < 1.4) {
    return makeNavigationPlan({
      route: compactRoute([start, target]),
      departureYaw: directDistance > 0.1 ? segmentYaw(start, target) : heading,
      requiresUTurn: false,
      travelHeading: heading,
    });
  }
  const forward = graphRouteCandidateForDirection(start, target, heading, 1);
  const reverse = graphRouteCandidateForDirection(start, target, heading, -1);
  const forwardDistance = forward ? routeLength(forward.route) : Number.POSITIVE_INFINITY;
  const reverseDistance = reverse ? routeLength(reverse.route) : Number.POSITIVE_INFINITY;
  const reverseIsWorthIt = Boolean(reverse) && preferReverseRoute(forwardDistance, reverseDistance,
    normalizeNavigationSettings(settings).uTurnSavingsMeters / DISPLAY_METERS_PER_WORLD_UNIT);
  const chosen = reverseIsWorthIt ? reverse : forward || reverse;
  if (!chosen) {
    const networkFallback = routeRoadNetwork(start, target, heading, 1)
      ?? routeRoadNetwork(start, target, heading, -1);
    const route = networkFallback?.route ?? buildGpsRoute(start, target);
    const departureYaw = routeDepartureYaw(route, heading);
    return makeNavigationPlan({
      route,
      departureYaw,
      requiresUTurn: false,
      travelHeading: heading,
    });
  }
  return makeNavigationPlan({
    route: chosen.route,
    departureYaw: chosen.departureYaw,
    requiresUTurn: reverseIsWorthIt,
    travelHeading: heading,
  });
}

export function preferReverseRoute(forwardDistance: number, reverseDistance: number,
  minimumSavings = DEFAULT_NAVIGATION_SETTINGS.uTurnSavingsMeters / DISPLAY_METERS_PER_WORLD_UNIT) {
  return Number.isFinite(forwardDistance) && Number.isFinite(reverseDistance)
    && forwardDistance - reverseDistance >= minimumSavings - 1e-9;
}

function makeNavigationPlan(plan: Omit<NavigationPlan, "turnCue">): NavigationPlan {
  const rawCue = plan.requiresUTurn ? null : nextTurnCue(plan.route, plan.departureYaw);
  const turnCue = rawCue
    && rawCue.distance <= TURN_CUE_ENTER_DISTANCE
    && Math.abs(normalizeAngle(rawCue.incomingYaw - plan.travelHeading)) <= TURN_APPROACH_LIMIT
    ? rawCue
    : null;
  return { ...plan, turnCue };
}

export function gameTravelHeading(game: Game, useVelocity = Math.hypot(game.vx, game.vy) > 3) {
  const velocity = Math.hypot(game.vx, game.vy);
  return useVelocity && velocity > 0.01 ? Math.atan2(game.vy, game.vx) : game.heading;
}

export function pointToSegmentDistance(point: WorldPoint, start: WorldPoint, end: WorldPoint) {
  return routePointDistance(point, projectOntoSegment(point, start, end).point);
}

function routePointDistance(a: WorldPoint, b: WorldPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function projectOntoSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = (end.z ?? 0) - (start.z ?? 0);
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const t = lengthSquared < 1e-8 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy
    + ((point.z ?? 0) - (start.z ?? 0)) * dz) / lengthSquared, 0, 1);
  return { point: { x: start.x + dx * t, y: start.y + dy * t, z: (start.z ?? 0) + dz * t },
    progress: Math.sqrt(lengthSquared) * t };
}

/** All remaining legs participate, including curved roads and later rejoin points. */
export function closestPointOnRoute(point: WorldPoint, route: readonly WorldPoint[]) {
  if (!route.length) return null;
  let closest = { point: route[0], segment: 0, progress: 0, distance: routePointDistance(point, route[0]) };
  for (let index = 1; index < route.length; index += 1) {
    const projection = projectOntoSegment(point, route[index - 1], route[index]);
    const separation = routePointDistance(point, projection.point);
    if (separation < closest.distance - 1e-8) closest = { ...projection, segment: index - 1, distance: separation };
  }
  return closest;
}

export class NavigationController {
  private objectiveKey = "";
  private targetKey = "";
  private waypoints: WorldPoint[] = [];
  private activeStart: WorldPoint = { x: 0, y: 0 };
  private activeYaw = 0;
  private wrongWay = false;
  private alignedFor = 0;
  private lastElapsed = -1;
  private lastReplanAt = Number.NEGATIVE_INFINITY;
  private turnCueKey = "";
  private turnCueVisible = false;
  private usingVelocityHeading = false;
  private recoveryAt: number | undefined;
  private revision = 0;
  private reason: NonNullable<NavigationPlan["diagnostics"]>["reason"] = "start";
  private lastDirectionCheckAt = Number.NEGATIVE_INFINITY;
  private policyKey = "";
  private developmentRevision = 0;

  private adoptPlan(plan: NavigationPlan, player: WorldPoint, elapsed: number,
    reason: NonNullable<NavigationPlan["diagnostics"]>["reason"], target: WorldPoint) {
    this.waypoints = plan.route.slice(1);
    // Compaction merges an arrival's coincident points. Retain the destination
    // as a waypoint so nearby movement keeps the same endpoint and plan.
    if (!this.waypoints.length && distance(player, target) <= NAVIGATION_ARRIVAL_RADIUS) this.waypoints = [{ ...target }];
    this.activeStart = player;
    this.activeYaw = plan.departureYaw;
    this.wrongWay = plan.requiresUTurn;
    this.alignedFor = 0;
    this.lastReplanAt = elapsed;
    this.lastDirectionCheckAt = elapsed;
    this.revision += 1;
    this.reason = reason;
  }

  private resolveTurnCue(player: WorldPoint, travelHeading: number): TurnCue | null {
    if (this.wrongWay || this.waypoints.length < 2) {
      this.turnCueKey = "";
      this.turnCueVisible = false;
      return null;
    }

    // Use the stable route origin and planned departure direction for cue
    // geometry. Deriving the first segment from the moving taxi makes a normal
    // 2.25-unit lane offset look diagonal and causes the cue to blink.
    const plannedRoute = compactRoute([this.activeStart, ...this.waypoints]);
    const candidate = nextTurnCue(plannedRoute, this.activeYaw);
    if (!candidate) {
      this.turnCueKey = "";
      this.turnCueVisible = false;
      return null;
    }

    // Keep the corner in the measurement path even when the player, corner,
    // and outgoing waypoint become collinear. Route compaction would remove
    // that corner and create a brief Infinity-distance visibility gap.
    const liveRoute = [player, ...this.waypoints];
    const liveDistance = routeDistanceToPoint(liveRoute, candidate.point);
    const cue = { ...candidate, distance: liveDistance };
    const key = `${candidate.point.x}:${candidate.point.y}:${candidate.kind}:${candidate.yaw.toFixed(3)}`;
    const approachError = Math.abs(normalizeAngle(candidate.incomingYaw - travelHeading));

    if (key !== this.turnCueKey) {
      this.turnCueKey = key;
      this.turnCueVisible = liveDistance <= TURN_CUE_ENTER_DISTANCE && approachError <= TURN_APPROACH_LIMIT;
    } else if (this.turnCueVisible) {
      // Once admitted, route lifecycle owns retirement. Steering, drifting, or
      // a collision must not erase a still-valid instruction for a few frames.
      this.turnCueVisible = liveDistance <= TURN_CUE_EXIT_DISTANCE;
    } else if (liveDistance <= TURN_CUE_ENTER_DISTANCE && approachError <= TURN_APPROACH_LIMIT) {
      this.turnCueVisible = true;
    }

    return this.turnCueVisible ? cue : null;
  }

  update(game: Game, settings: Readonly<NavigationSettings> = DEFAULT_NAVIGATION_SETTINGS): NavigationPlan {
    const policy = normalizeNavigationSettings(settings);
    const policyKey = `${policy.rerouteDistanceMeters}:${policy.uTurnSavingsMeters}`;
    if (this.policyKey && policyKey !== this.policyKey) {
      this.wrongWay = false;
      this.alignedFor = 0;
      this.lastDirectionCheckAt = Number.NEGATIVE_INFINITY;
    }
    this.policyKey = policyKey;
    const player = { x: game.x, y: game.y, z: game.z ?? 0 };
    const target = getNavigationTarget(game);
    const objectiveKey = getNavigationKey(game);
    const targetKey = `${target.x}:${target.y}:${target.z ?? 0}`;
    // Waiting fares can stream to a new curb while retaining their rider ID.
    // Roaming's target is the taxi itself and must not count as a new objective.
    const targetChanged = objectiveKey !== "off-duty" && targetKey !== this.targetKey;
    this.targetKey = targetKey;
    const isNewRun = game.elapsed + 0.1 < this.lastElapsed;
    const developmentChanged = (game.navigationRevision ?? 0) !== this.developmentRevision;
    this.developmentRevision = game.navigationRevision ?? 0;
    if (isNewRun) this.recoveryAt = undefined;
    const recovered = game.towRecovery != null && game.towRecovery.startedAt !== this.recoveryAt;
    if (recovered) this.recoveryAt = game.towRecovery!.startedAt;
    if (isNewRun) this.usingVelocityHeading = false;
    const velocity = Math.hypot(game.vx, game.vy);
    if (this.usingVelocityHeading) {
      if (velocity < NAV_VELOCITY_HEADING_EXIT_SPEED) this.usingVelocityHeading = false;
    } else if (velocity > NAV_VELOCITY_HEADING_ENTER_SPEED) {
      this.usingVelocityHeading = true;
    }
    const travelHeading = gameTravelHeading(game, this.usingVelocityHeading);
    if (objectiveKey !== this.objectiveKey || targetChanged || isNewRun || recovered || developmentChanged || this.revision === 0) {
      if (objectiveKey !== this.objectiveKey || targetChanged || isNewRun || recovered || developmentChanged) {
        this.turnCueKey = "";
        this.turnCueVisible = false;
      }
      const reason = isNewRun ? "new-run" : recovered ? "recovery" : developmentChanged ? "development" : this.revision === 0 ? "start" : "destination";
      this.objectiveKey = objectiveKey;
      this.adoptPlan(buildNavigationPlan(player, target, travelHeading, policy), player, game.elapsed, reason, target);
    }

    const canReplan = game.elapsed - this.lastReplanAt >= NAVIGATION_REPLAN_COOLDOWN;
    const plannedRoute = [this.activeStart, ...this.waypoints];
    const nearest = closestPointOnRoute(player, plannedRoute);
    const deviationMeters = (nearest?.distance ?? 0) * DISPLAY_METERS_PER_WORLD_UNIT;
    if (canReplan && deviationMeters > policy.rerouteDistanceMeters + 1e-7) {
      this.adoptPlan(buildNavigationPlan(player, target, travelHeading, policy), player, game.elapsed, "deviation", target);
    }
    while (this.waypoints.length > 1) {
      const waypoint = this.waypoints[0];
      const next = this.waypoints[1];
      if (Math.abs((player.z ?? 0) - (waypoint.z ?? 0)) > 1.5) break;
      const waypointDistance = distance(player, waypoint);
      const atIntersection = isRoadJunctionPoint(waypoint);
      if (!atIntersection && waypointDistance < ROAD_HALF + 1 && Math.abs((player.z ?? 0) - (waypoint.z ?? 0)) < 1.4) {
        this.activeStart = waypoint;
        this.activeYaw = segmentYaw(waypoint, next);
        this.waypoints.shift();
        continue;
      }

      const outgoingYaw = segmentYaw(waypoint, next);
      const turnDelta = Math.abs(normalizeAngle(outgoingYaw - this.activeYaw));
      const passedDistance = (player.x - waypoint.x) * Math.cos(this.activeYaw) + (player.y - waypoint.y) * Math.sin(this.activeYaw);
      const outgoingProgress = (player.x - waypoint.x) * Math.cos(outgoingYaw) + (player.y - waypoint.y) * Math.sin(outgoingYaw);
      const alignedWithExit = Math.abs(normalizeAngle(outgoingYaw - travelHeading)) < TURN_EXIT_ALIGNMENT_LIMIT;
      if (turnDelta > 0.55) {
        const insideOutgoingRoad = Math.abs(passedDistance) <= ROAD_HALF + 1;
        const committedToExit = outgoingProgress >= TURN_EXIT_PROGRESS && insideOutgoingRoad;
        if (alignedWithExit && committedToExit) {
          this.activeStart = waypoint;
          this.activeYaw = outgoingYaw;
          this.waypoints.shift();
          continue;
        }
      } else if (waypointDistance < 2 || passedDistance > 1.5) {
        this.activeStart = waypoint;
        this.activeYaw = outgoingYaw;
        this.waypoints.shift();
        continue;
      }
      break;
    }

    // Rejoining a later leg consumes the existing prefix; it does not ask the
    // road graph for another route. Require actual road/deck and exit alignment.
    const remaining = [this.activeStart, ...this.waypoints];
    const rejoin = closestPointOnRoute(player, remaining);
    if (rejoin && rejoin.segment > 0 && (rejoin.segment > 1 || rejoin.progress >= TURN_EXIT_PROGRESS)
      && rejoin.distance <= roadHalfWidthAtPoint(player) + 1
      && Math.abs((player.z ?? 0) - (rejoin.point.z ?? 0)) < 1.5) {
      const yaw = segmentYaw(remaining[rejoin.segment], remaining[rejoin.segment + 1]);
      if (Math.abs(normalizeAngle(yaw - travelHeading)) < TURN_EXIT_ALIGNMENT_LIMIT) {
        this.activeStart = remaining[rejoin.segment];
        this.activeYaw = yaw;
        this.waypoints = this.waypoints.slice(rejoin.segment);
      }
    }

    const route = compactRoute([player, ...this.waypoints]);
    const departureYaw = this.activeYaw;
    const nearDestination = routeLength(route) <= NAVIGATION_ARRIVAL_RADIUS + 0.2;
    const elapsedDelta = clamp(game.elapsed - this.lastElapsed, 0, 0.1);
    const headingError = Math.abs(normalizeAngle(departureYaw - travelHeading));
    if (this.wrongWay) {
      this.alignedFor = headingError < UTURN_EXIT_ANGLE ? this.alignedFor + elapsedDelta : 0;
      if (this.alignedFor >= UTURN_ALIGNMENT_HOLD) {
        this.wrongWay = false;
        this.alignedFor = 0;
      }
    } else if (!nearDestination && headingError > UTURN_ENTER_ANGLE
      && game.elapsed - this.lastDirectionCheckAt >= NAVIGATION_REPLAN_COOLDOWN) {
      this.lastDirectionCheckAt = game.elapsed;
      const forward = graphRouteCandidateForDirection(player, target, travelHeading, 1);
      const reverse = graphRouteCandidateForDirection(player, target, travelHeading, -1);
      this.wrongWay = Boolean(forward && reverse) && preferReverseRoute(
        routeLength(forward!.route), routeLength(reverse!.route), policy.uTurnSavingsMeters / DISPLAY_METERS_PER_WORLD_UNIT);
    }
    this.lastElapsed = game.elapsed;
    const turnCue = this.resolveTurnCue(player, travelHeading);
    return { route, departureYaw, requiresUTurn: this.wrongWay, travelHeading, turnCue,
      diagnostics: { revision: this.revision, deviationMeters, reason: this.reason, ...policy } };
  }
}

export function routeDistanceToPoint(route: WorldPoint[], target: WorldPoint) {
  if (route.length && distance(route[0], target) < 0.1) return 0;
  let routeDistance = 0;
  for (let index = 1; index < route.length; index += 1) {
    routeDistance += distance(route[index - 1], route[index]);
    if (distance(route[index], target) < 0.1) return routeDistance;
  }
  return Number.POSITIVE_INFINITY;
}

export function nextTurnCue(route: WorldPoint[], firstIncomingYaw?: number): TurnCue | null {
  let routeDistance = 0;
  for (let index = 1; index < route.length - 1; index += 1) {
    const before = route[index - 1];
    const point = route[index];
    const after = route[index + 1];
    const incomingLength = distance(before, point);
    const outgoingLength = distance(point, after);
    routeDistance += incomingLength;
    // Keep the imminent corner active right up to the intersection. A larger
    // cutoff makes the cue jump ahead one turn while the taxi is still arriving.
    if (incomingLength < 0.75 || outgoingLength < 4) continue;
    const usesPlannedIncoming = index === 1 && firstIncomingYaw !== undefined;
    if (!isRoadJunctionPoint(point)) continue;
    const incomingYaw = usesPlannedIncoming ? firstIncomingYaw : Math.atan2(point.y - before.y, point.x - before.x);
    const outgoingYaw = Math.atan2(after.y - point.y, after.x - point.x);
    const delta = normalizeAngle(outgoingYaw - incomingYaw);
    if (Math.abs(delta) < 0.55 || Math.abs(delta) > 2.55) continue;
    return {
      point,
      incomingYaw,
      yaw: outgoingYaw,
      kind: delta > 0 ? "right" : "left",
      distance: routeDistance,
    };
  }
  return null;
}

export function gpsInstruction(route: WorldPoint[], heading: number, turnCue?: TurnCue | null, requiresUTurn = false) {
  const cueIsControllerResolved = turnCue !== undefined;
  const resolvedTurnCue = turnCue === undefined ? nextTurnCue(route) : turnCue;
  let nextIndex = 1;
  while (nextIndex < route.length - 1 && distance(route[0], route[nextIndex]) < 5) nextIndex += 1;
  const next = route[nextIndex] || route[route.length - 1] || route[0];
  const remaining = distance(route[0], next);
  if (requiresUTurn) return { text: "U-TURN WHEN SAFE", distance: remaining };
  if (route.length <= 2 || routeLength(route) < 10) return { text: "DESTINATION AHEAD", distance: routeLength(route) };
  const angle = normalizeAngle(Math.atan2(next.y - route[0].y, next.x - route[0].x) - heading);
  if (cueIsControllerResolved && resolvedTurnCue) {
    return { text: resolvedTurnCue.kind === "right" ? "TURN RIGHT" : "TURN LEFT", distance: resolvedTurnCue.distance };
  }
  if (Math.abs(angle) > TURN_APPROACH_LIMIT) {
    return { text: angle > 0 ? "BEAR RIGHT TO ROUTE" : "BEAR LEFT TO ROUTE", distance: remaining };
  }
  if (resolvedTurnCue) {
    const approachError = Math.abs(normalizeAngle(resolvedTurnCue.incomingYaw - heading));
    if (!cueIsControllerResolved && approachError > TURN_APPROACH_LIMIT) {
      return { text: angle > 0 ? "BEAR RIGHT TO ROUTE" : "BEAR LEFT TO ROUTE", distance: remaining };
    }
    return { text: resolvedTurnCue.kind === "right" ? "TURN RIGHT" : "TURN LEFT", distance: resolvedTurnCue.distance };
  }
  if (Math.abs(angle) > 0.65) return { text: angle > 0 ? "BEAR RIGHT" : "BEAR LEFT", distance: remaining };
  return { text: "KEEP STRAIGHT", distance: remaining };
}
