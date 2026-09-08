import {
  NAVIGATION_ARRIVAL_RADIUS,
  NAVIGATION_REPLAN_COOLDOWN,
  NAV_VELOCITY_HEADING_ENTER_SPEED,
  NAV_VELOCITY_HEADING_EXIT_SPEED,
  ROAD_HALF,
  ROAD_SPACING,
  TURN_APPROACH_LIMIT,
  TURN_CUE_ENTER_DISTANCE,
  TURN_CUE_EXIT_DISTANCE,
  TURN_EXIT_ALIGNMENT_LIMIT,
  TURN_EXIT_PROGRESS,
  UTURN_ALIGNMENT_HOLD,
  UTURN_ENTER_ANGLE,
  UTURN_EXIT_ANGLE,
  UTURN_MIN_SAVINGS,
  UTURN_ROUTE_RATIO,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  WORLD_ROAD_MIN_X,
  WORLD_ROAD_MIN_Y,
} from "./config";
import {
  clamp,
  distance,
  nearestRoadX,
  nearestRoadY,
  nearestRoadDistance,
  normalizeAngle,
  segmentYaw,
} from "./math";
import type { Game, NavigationPlan, TurnCue, Vec2 } from "./model";
import {
  buildGpsRoute,
  compactRoute,
  routeLength,
  snapToRoad,
} from "./route-geometry";
import {
  isRoadJunctionPoint,
  nearestSpecialRoadProjection,
  roadHalfWidthAtPoint,
  routeCrossesRoundaboutIsland,
  routeRoadNetwork,
} from "./road-network";
import { getNavigationKey, getNavigationTarget } from "./state";
import { containingRegionForPosition } from "./regions";
import {
  gridStreetPointEnabled,
  regionUsesSparseRoadTopology,
  routeStaysOnEnabledRoads,
} from "./road-topology";

export { buildGpsRoute, compactRoute, routeLength, snapToRoad } from "./route-geometry";
export type { RoadSnap } from "./route-geometry";

export type RouteCandidate = {
  route: Vec2[];
  departureYaw: number;
  cost?: number;
  usesSpecialRoad?: boolean;
};

export function navigationRoadAxis(start: Vec2, heading: number): "vertical" | "horizontal" {
  const verticalDistance = nearestRoadDistance(start.x, "x");
  const horizontalDistance = nearestRoadDistance(start.y, "y");
  if (verticalDistance <= ROAD_HALF + 0.8 && horizontalDistance <= ROAD_HALF + 0.8) {
    return Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading)) ? "horizontal" : "vertical";
  }
  if (verticalDistance + 0.8 < horizontalDistance) return "vertical";
  if (horizontalDistance + 0.8 < verticalDistance) return "horizontal";
  return Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading)) ? "horizontal" : "vertical";
}

export function nextIntersection(value: number, direction: 1 | -1, axis: "x" | "y" = "x") {
  const next = direction > 0
    ? Math.floor(value / ROAD_SPACING + 1) * ROAD_SPACING
    : Math.ceil(value / ROAD_SPACING - 1) * ROAD_SPACING;
  const min = axis === "x" ? WORLD_ROAD_MIN_X : WORLD_ROAD_MIN_Y;
  const max = axis === "x" ? WORLD_ROAD_MAX_X : WORLD_ROAD_MAX_Y;
  return next >= min && next <= max ? next : null;
}

export function routeDepartureYaw(route: Vec2[], fallback: number) {
  for (let index = 1; index < route.length; index += 1) {
    const before = route[index - 1];
    const point = route[index];
    const length = distance(before, point);
    if (length > 3) return segmentYaw(before, point);
  }
  const next = route.find((point, index) => index > 0 && distance(route[0], point) > 3);
  return next ? segmentYaw(route[0], next) : fallback;
}

export function routeHasReverseTurn(route: Vec2[]) {
  let previousYaw: number | null = null;
  for (let index = 1; index < route.length; index += 1) {
    const before = route[index - 1];
    const point = route[index];
    if (distance(before, point) < 1) continue;
    const yaw = segmentYaw(before, point);
    if (previousYaw !== null && Math.abs(normalizeAngle(yaw - previousYaw)) > 2.55) return true;
    previousYaw = yaw;
  }
  return false;
}

export function routeEndpointIntersections(point: Vec2, axis: "vertical" | "horizontal") {
  const coordinate = axis === "vertical" ? point.y : point.x;
  const min = axis === "vertical" ? WORLD_ROAD_MIN_Y : WORLD_ROAD_MIN_X;
  const max = axis === "vertical" ? WORLD_ROAD_MAX_Y : WORLD_ROAD_MAX_X;
  const low = clamp(Math.floor(coordinate / ROAD_SPACING) * ROAD_SPACING, min, max);
  const high = clamp(Math.ceil(coordinate / ROAD_SPACING) * ROAD_SPACING, min, max);
  const values = low === high ? [low] : [low, high];
  return values.map((value) => axis === "vertical" ? { x: point.x, y: value } : { x: value, y: point.y });
}

export function gridPaths(from: Vec2, to: Vec2) {
  const candidates: Vec2[][] = [
    [from, { x: to.x, y: from.y }, to],
    [from, { x: from.x, y: to.y }, to],
  ];
  for (const offset of [-ROAD_SPACING, ROAD_SPACING]) {
    candidates.push([
      from,
      { x: from.x + offset, y: from.y },
      { x: from.x + offset, y: to.y },
      to,
    ]);
    candidates.push([
      from,
      { x: from.x, y: from.y + offset },
      { x: to.x, y: from.y + offset },
      to,
    ]);
  }
  return candidates;
}

export function routeCandidateForDirection(start: Vec2, target: Vec2, heading: number, direction: 1 | -1): RouteCandidate | null {
  const axis = navigationRoadAxis(start, heading);
  const from = axis === "vertical"
    ? { x: nearestRoadX(start.x), y: start.y }
    : { x: start.x, y: nearestRoadY(start.y) };
  const targetRoad = snapToRoad(target);
  const headingSign = axis === "vertical" ? Math.sign(Math.sin(heading)) : Math.sign(Math.cos(heading));
  const forwardSign = ((headingSign || 1) * direction) as 1 | -1;
  const departureYaw = axis === "vertical"
    ? forwardSign > 0 ? Math.PI / 2 : -Math.PI / 2
    : forwardSign > 0 ? 0 : Math.PI;

  const sameRoad = axis === targetRoad.axis && (
    axis === "vertical"
      ? Math.abs(from.x - targetRoad.point.x) < 0.8
      : Math.abs(from.y - targetRoad.point.y) < 0.8
  );
  const targetDelta = axis === "vertical" ? targetRoad.point.y - from.y : targetRoad.point.x - from.x;
  if (sameRoad && targetDelta * forwardSign > 1) {
    const route = compactRoute([start, from, targetRoad.point, target]);
    if (routeStaysOnEnabledRoads(route)) {
      return { route, departureYaw };
    }
  }

  const candidates: RouteCandidate[] = [];
  const collectCandidates = (prefix: Vec2[], gridStart: Vec2, initialYaw: number) => {
    for (const endpoint of routeEndpointIntersections(targetRoad.point, targetRoad.axis)) {
      for (const gridPath of gridPaths(gridStart, endpoint)) {
        const rawRoute = [...prefix, ...gridPath, targetRoad.point, target]
          .filter((point, index, points) => index === 0 || distance(point, points[index - 1]) > 0.1);
        const insideWorld = routeStaysOnEnabledRoads(rawRoute);
        if (
          insideWorld
          && !routeHasReverseTurn(rawRoute)
          && routeStaysOnEnabledRoads(rawRoute)
        ) {
          candidates.push({ route: compactRoute(rawRoute), departureYaw: initialYaw });
        }
      }
    }
  };

  const firstCoordinate = nextIntersection(
    axis === "vertical" ? from.y : from.x,
    forwardSign,
    axis === "vertical" ? "y" : "x",
  );
  if (firstCoordinate !== null) {
    const first = axis === "vertical" ? { x: from.x, y: firstCoordinate } : { x: firstCoordinate, y: from.y };
    collectCandidates([start, from], first, departureYaw);
  } else if (direction > 0) {
    // At the outer city edge, a legal 90-degree turn is a better first choice
    // than telling the player to reverse away from the boundary.
    const boundary = axis === "vertical"
      ? { x: from.x, y: nearestRoadY(from.y) }
      : { x: nearestRoadX(from.x), y: from.y };
    if (distance(from, boundary) <= ROAD_HALF + 0.5) {
      for (const side of [-1, 1]) {
        const lateral = axis === "vertical"
          ? { x: boundary.x + side * ROAD_SPACING, y: boundary.y }
          : { x: boundary.x, y: boundary.y + side * ROAD_SPACING };
        if (
          lateral.x >= WORLD_ROAD_MIN_X && lateral.x <= WORLD_ROAD_MAX_X
          && lateral.y >= WORLD_ROAD_MIN_Y && lateral.y <= WORLD_ROAD_MAX_Y
          && gridStreetPointEnabled(lateral, axis === "vertical" ? "horizontal" : "vertical")
        ) {
          collectCandidates([start, from, boundary], lateral, segmentYaw(boundary, lateral));
        }
      }
    }
  }
  candidates.sort((a, b) => routeLength(a.route) - routeLength(b.route));
  const candidate = candidates[0] || null;
  return candidate ? { ...candidate, cost: routeLength(candidate.route) } : null;
}

function hybridRouteCandidateForDirection(
  start: Vec2,
  target: Vec2,
  heading: number,
  direction: 1 | -1,
) {
  const legacy = routeCandidateForDirection(start, target, heading, direction);
  const network = routeRoadNetwork(start, target, heading, direction);
  if (!network) return legacy;
  const startRegion = containingRegionForPosition(start.x, start.y);
  const targetRegion = containingRegionForPosition(target.x, target.y);
  const regionalGraphRequired = regionUsesSparseRoadTopology(startRegion?.id)
    || regionUsesSparseRoadTopology(targetRegion?.id);
  const specialStart = nearestSpecialRoadProjection(start);
  const startsOnSpecial = Boolean(
    specialStart && specialStart.centerDistance <= specialStart.halfWidth + 1.2,
  );
  const legacyCost = legacy?.cost ?? (legacy ? routeLength(legacy.route) : Number.POSITIVE_INFINITY);
  const legacyCrossesIsland = Boolean(legacy && routeCrossesRoundaboutIsland(legacy.route));
  if (
    regionalGraphRequired
    || (startsOnSpecial && network.usesSpecialRoad)
    || !legacy
    || legacyCrossesIsland
    || (network.usesSpecialRoad && network.cost < legacyCost * 0.96)
  ) {
    return {
      route: compactRoute(network.route),
      departureYaw: network.departureYaw,
      cost: network.cost,
      usesSpecialRoad: network.usesSpecialRoad,
    } satisfies RouteCandidate;
  }
  return legacy;
}

export function buildNavigationPlan(start: Vec2, target: Vec2, heading: number): NavigationPlan {
  const directDistance = distance(start, target);
  if (directDistance <= NAVIGATION_ARRIVAL_RADIUS) {
    return makeNavigationPlan({
      route: compactRoute([start, target]),
      departureYaw: directDistance > 0.1 ? segmentYaw(start, target) : heading,
      requiresUTurn: false,
      travelHeading: heading,
    });
  }
  const forward = hybridRouteCandidateForDirection(start, target, heading, 1);
  const reverse = hybridRouteCandidateForDirection(start, target, heading, -1);
  const forwardCost = forward?.cost ?? (forward ? routeLength(forward.route) : Number.POSITIVE_INFINITY);
  const reverseCost = reverse?.cost ?? (reverse ? routeLength(reverse.route) : Number.POSITIVE_INFINITY);
  const reverseSavings = forwardCost - reverseCost;
  const reverseIsWorthIt = Boolean(reverse) && (
    !forward || (reverseSavings >= UTURN_MIN_SAVINGS && forwardCost >= reverseCost * UTURN_ROUTE_RATIO)
  );
  const chosen = reverseIsWorthIt ? reverse : forward || reverse;
  if (!chosen) {
    const networkFallback = routeRoadNetwork(start, target, heading, 1)
      ?? routeRoadNetwork(start, target, heading, -1);
    const route = networkFallback?.route ?? buildGpsRoute(start, target);
    const departureYaw = routeDepartureYaw(route, heading);
    return makeNavigationPlan({
      route,
      departureYaw,
      requiresUTurn: Math.abs(normalizeAngle(departureYaw - heading)) >= UTURN_ENTER_ANGLE,
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

export function pointToSegmentDistance(point: Vec2, start: Vec2, end: Vec2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.01) return distance(point, end);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

export class NavigationController {
  private objectiveKey = "";
  private waypoints: Vec2[] = [];
  private activeStart: Vec2 = { x: 0, y: 0 };
  private activeYaw = 0;
  private wrongWay = false;
  private alignedFor = 0;
  private lastElapsed = -1;
  private lastReplanAt = Number.NEGATIVE_INFINITY;
  private turnCueKey = "";
  private turnCueVisible = false;
  private usingVelocityHeading = false;

  private adoptPlan(plan: NavigationPlan, player: Vec2, elapsed: number) {
    this.waypoints = plan.route.slice(1);
    this.activeStart = player;
    this.activeYaw = plan.departureYaw;
    this.wrongWay = plan.requiresUTurn;
    this.alignedFor = 0;
    this.lastReplanAt = elapsed;
  }

  private resolveTurnCue(player: Vec2, travelHeading: number): TurnCue | null {
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

  update(game: Game): NavigationPlan {
    const player = { x: game.x, y: game.y };
    const target = getNavigationTarget(game);
    const objectiveKey = getNavigationKey(game);
    const isNewRun = game.elapsed + 0.1 < this.lastElapsed;
    if (isNewRun) this.usingVelocityHeading = false;
    const velocity = Math.hypot(game.vx, game.vy);
    if (this.usingVelocityHeading) {
      if (velocity < NAV_VELOCITY_HEADING_EXIT_SPEED) this.usingVelocityHeading = false;
    } else if (velocity > NAV_VELOCITY_HEADING_ENTER_SPEED) {
      this.usingVelocityHeading = true;
    }
    const travelHeading = gameTravelHeading(game, this.usingVelocityHeading);
    if (objectiveKey !== this.objectiveKey || isNewRun || this.waypoints.length === 0) {
      if (objectiveKey !== this.objectiveKey || isNewRun) {
        this.turnCueKey = "";
        this.turnCueVisible = false;
      }
      this.objectiveKey = objectiveKey;
      this.adoptPlan(buildNavigationPlan(player, target, travelHeading), player, game.elapsed);
    }

    const canReplan = game.elapsed - this.lastReplanAt >= NAVIGATION_REPLAN_COOLDOWN;
    let replanned = false;
    while (this.waypoints.length > 1) {
      const waypoint = this.waypoints[0];
      const next = this.waypoints[1];
      const waypointDistance = distance(player, waypoint);
      const atIntersection = isRoadJunctionPoint(waypoint);
      if (!atIntersection && waypointDistance < ROAD_HALF + 1) {
        this.activeStart = waypoint;
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
        if (passedDistance > 1.5 && canReplan) {
          this.adoptPlan(buildNavigationPlan(player, target, travelHeading), player, game.elapsed);
          replanned = true;
        }
      } else if (waypointDistance < 2 || passedDistance > 1.5) {
        this.activeStart = waypoint;
        this.activeYaw = outgoingYaw;
        this.waypoints.shift();
        continue;
      }
      break;
    }

    if (!replanned && canReplan && this.waypoints.length) {
      const waypoint = this.waypoints[0];
      const crossTrack = pointToSegmentDistance(player, this.activeStart, waypoint);
      if (crossTrack > roadHalfWidthAtPoint(player) + 3 && distance(player, waypoint) > 12) {
        this.adoptPlan(buildNavigationPlan(player, target, travelHeading), player, game.elapsed);
        replanned = true;
      }
    }

    let route = compactRoute([player, ...this.waypoints]);
    let departureYaw = this.activeYaw;
    const nearDestination = routeLength(route) <= NAVIGATION_ARRIVAL_RADIUS + 0.2;
    const elapsedDelta = clamp(game.elapsed - this.lastElapsed, 0, 0.1);
    let headingError = Math.abs(normalizeAngle(departureYaw - travelHeading));
    if (this.wrongWay) {
      this.alignedFor = headingError < UTURN_EXIT_ANGLE ? this.alignedFor + elapsedDelta : 0;
      if (this.alignedFor >= UTURN_ALIGNMENT_HOLD) {
        this.wrongWay = false;
        this.alignedFor = 0;
      }
    } else if (!nearDestination && headingError > UTURN_ENTER_ANGLE && canReplan) {
      this.adoptPlan(buildNavigationPlan(player, target, travelHeading), player, game.elapsed);
      route = compactRoute([player, ...this.waypoints]);
      departureYaw = this.activeYaw;
      headingError = Math.abs(normalizeAngle(departureYaw - travelHeading));
      this.wrongWay = this.wrongWay || headingError > UTURN_ENTER_ANGLE;
    }
    this.lastElapsed = game.elapsed;
    const turnCue = this.resolveTurnCue(player, travelHeading);
    return { route, departureYaw, requiresUTurn: this.wrongWay, travelHeading, turnCue };
  }
}

export function routeDistanceToPoint(route: Vec2[], target: Vec2) {
  if (route.length && distance(route[0], target) < 0.1) return 0;
  let routeDistance = 0;
  for (let index = 1; index < route.length; index += 1) {
    routeDistance += distance(route[index - 1], route[index]);
    if (distance(route[index], target) < 0.1) return routeDistance;
  }
  return Number.POSITIVE_INFINITY;
}

export function nextTurnCue(route: Vec2[], firstIncomingYaw?: number): TurnCue | null {
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

export function gpsInstruction(route: Vec2[], heading: number, turnCue?: TurnCue | null, requiresUTurn = false) {
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
