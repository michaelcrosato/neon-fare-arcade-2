import {
  ROAD_HALF,
  ROAD_SPACING,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  WORLD_ROAD_MIN_X,
  WORLD_ROAD_MIN_Y,
} from "./config";
import type { Vec2 } from "./model";
import { clamp, distance, normalizeAngle } from "./math";
import { isPlayablePoint } from "./regions";
import {
  gridStreetPointEnabled,
  gridStreetSegmentEnabled,
} from "./road-topology";
import {
  ROUNDABOUTS,
  SPECIAL_ROADS,
  type RoadKind,
  type RoadPathDefinition,
} from "./road-layout";

const EPSILON = 0.001;
const NODE_PRECISION = 1000;

type NetworkKind = "street" | RoadKind;

export type SpecialRoadSegment = {
  id: string;
  pathId: string;
  pathName: string;
  kind: RoadKind;
  halfWidth: number;
  lanes: number;
  travelWeight: number;
  index: number;
  a: Vec2;
  b: Vec2;
};

type NetworkSegment = {
  id: string;
  pathId: string;
  kind: NetworkKind;
  halfWidth: number;
  travelWeight: number;
  a: Vec2;
  b: Vec2;
  aId: string;
  bId: string;
  allowAB: boolean;
  allowBA: boolean;
};

type GraphEdge = {
  to: string;
  cost: number;
  segment: NetworkSegment;
};

type SegmentProjection = {
  segment: NetworkSegment;
  point: Vec2;
  t: number;
  centerDistance: number;
  tangentYaw: number;
};

export type RoadProjection = {
  roadId: string;
  kind: NetworkKind;
  point: Vec2;
  centerDistance: number;
  surfaceDistance: number;
  tangentYaw: number;
  halfWidth: number;
};

export type NetworkRouteCandidate = {
  route: Vec2[];
  departureYaw: number;
  cost: number;
  usesSpecialRoad: boolean;
};

export type RoadPathSample = {
  point: Vec2;
  heading: number;
  road: RoadPathDefinition;
};

function pointKey(point: Vec2) {
  return `${Math.round(point.x * NODE_PRECISION)},${Math.round(point.y * NODE_PRECISION)}`;
}

function samePoint(a: Vec2, b: Vec2, tolerance = 0.02) {
  return distance(a, b) <= tolerance;
}

function nearestGridRoadX(value: number) {
  return clamp(
    Math.round(value / ROAD_SPACING) * ROAD_SPACING,
    WORLD_ROAD_MIN_X,
    WORLD_ROAD_MAX_X,
  );
}

function nearestGridRoadY(value: number) {
  return clamp(
    Math.round(value / ROAD_SPACING) * ROAD_SPACING,
    WORLD_ROAD_MIN_Y,
    WORLD_ROAD_MAX_Y,
  );
}

function projectPointToSegment(point: Vec2, a: Vec2, b: Vec2) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= EPSILON
    ? 0
    : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  const projection = { x: a.x + dx * t, y: a.y + dy * t };
  return { point: projection, t, distance: distance(point, projection) };
}

function pathPairs(road: RoadPathDefinition) {
  const pairs: Array<[Vec2, Vec2]> = [];
  for (let index = 1; index < road.points.length; index += 1) {
    pairs.push([road.points[index - 1], road.points[index]]);
  }
  if (road.closed && road.points.length > 2) {
    pairs.push([road.points[road.points.length - 1], road.points[0]]);
  }
  return pairs;
}

export const SPECIAL_ROAD_SEGMENTS: readonly SpecialRoadSegment[] = SPECIAL_ROADS.flatMap((road) => (
  pathPairs(road).map(([a, b], index) => ({
    id: `${road.id}:${index}`,
    pathId: road.id,
    pathName: road.name,
    kind: road.kind,
    halfWidth: road.halfWidth,
    lanes: road.lanes,
    travelWeight: road.travelWeight,
    index,
    a,
    b,
  }))
));

function pointInRoundaboutIsland(point: Vec2, margin = 0) {
  return ROUNDABOUTS.some((roundabout) => (
    Math.abs(point.x - roundabout.center.x) <= roundabout.islandHalfSize + margin
    && Math.abs(point.y - roundabout.center.y) <= roundabout.islandHalfSize + margin
  ));
}

function pointInsideRoundaboutApproachCut(point: Vec2) {
  return ROUNDABOUTS.some((roundabout) => (
    distance(point, roundabout.center) < roundabout.radius - 0.75
  ));
}

function splitAtGridCrossings(a: Vec2, b: Vec2) {
  const candidates: Array<{ t: number; point: Vec2; grid: boolean }> = [
    { t: 0, point: a, grid: false },
    { t: 1, point: b, grid: false },
  ];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > EPSILON) {
    for (let x = WORLD_ROAD_MIN_X; x <= WORLD_ROAD_MAX_X; x += ROAD_SPACING) {
      const t = (x - a.x) / dx;
      if (t > EPSILON && t < 1 - EPSILON) {
        candidates.push({ t, point: { x, y: a.y + dy * t }, grid: true });
      }
    }
  }
  if (Math.abs(dy) > EPSILON) {
    for (let y = WORLD_ROAD_MIN_Y; y <= WORLD_ROAD_MAX_Y; y += ROAD_SPACING) {
      const t = (y - a.y) / dy;
      if (t > EPSILON && t < 1 - EPSILON) {
        candidates.push({ t, point: { x: a.x + dx * t, y }, grid: true });
      }
    }
  }
  candidates.sort((left, right) => left.t - right.t);
  const output: typeof candidates = [];
  for (const candidate of candidates) {
    const previous = output[output.length - 1];
    if (previous && Math.abs(previous.t - candidate.t) < 0.0001) {
      previous.grid ||= candidate.grid;
    } else {
      output.push(candidate);
    }
  }
  return output;
}

function explicitJunction(road: RoadPathDefinition, candidate: Vec2) {
  return road.junctions.some((junction) => samePoint(junction, candidate));
}

const graphNodes = new Map<string, Vec2>();
const adjacency = new Map<string, GraphEdge[]>();
const physicalSegments: NetworkSegment[] = [];
const gridJunctions = new Map<string, Vec2>();
const undirectedNeighbors = new Map<string, Set<string>>();

function ensureNode(point: Vec2) {
  const id = pointKey(point);
  if (!graphNodes.has(id)) graphNodes.set(id, { ...point });
  if (!adjacency.has(id)) adjacency.set(id, []);
  if (!undirectedNeighbors.has(id)) undirectedNeighbors.set(id, new Set());
  return id;
}

function registerGridJunction(point: Vec2) {
  const id = ensureNode(point);
  gridJunctions.set(id, graphNodes.get(id)!);
}

function addPhysicalSegment(
  pathId: string,
  kind: NetworkKind,
  halfWidth: number,
  travelWeight: number,
  a: Vec2,
  b: Vec2,
  allowAB = true,
  allowBA = true,
) {
  if (distance(a, b) < 0.05) return;
  const samples = Math.max(1, Math.ceil(distance(a, b) / 12));
  for (let sample = 0; sample <= samples; sample += 1) {
    const t = sample / samples;
    if (!isPlayablePoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return;
  }
  const aId = ensureNode(a);
  const bId = ensureNode(b);
  const segment: NetworkSegment = {
    id: `${pathId}:${aId}:${bId}`,
    pathId,
    kind,
    halfWidth,
    travelWeight,
    a: graphNodes.get(aId)!,
    b: graphNodes.get(bId)!,
    aId,
    bId,
    allowAB,
    allowBA,
  };
  physicalSegments.push(segment);
  const cost = distance(segment.a, segment.b) * travelWeight;
  if (allowAB) adjacency.get(aId)!.push({ to: bId, cost, segment });
  if (allowBA) adjacency.get(bId)!.push({ to: aId, cost, segment });
  undirectedNeighbors.get(aId)!.add(bId);
  undirectedNeighbors.get(bId)!.add(aId);
}

for (const road of SPECIAL_ROADS) {
  for (const [a, b] of pathPairs(road)) {
    const split = road.connectGrid === "crossings"
      ? splitAtGridCrossings(a, b)
      : [{ t: 0, point: a, grid: explicitJunction(road, a) }, { t: 1, point: b, grid: explicitJunction(road, b) }];
    for (const item of split) {
      if (item.grid || explicitJunction(road, item.point)) registerGridJunction(item.point);
      else ensureNode(item.point);
    }
    for (let index = 1; index < split.length; index += 1) {
      addPhysicalSegment(
        road.id,
        road.kind,
        road.halfWidth,
        road.travelWeight,
        split[index - 1].point,
        split[index].point,
        true,
        !road.oneWay,
      );
    }
  }
}

const gridRoadXs = Array.from(
  { length: Math.round((WORLD_ROAD_MAX_X - WORLD_ROAD_MIN_X) / ROAD_SPACING) + 1 },
  (_, index) => WORLD_ROAD_MIN_X + index * ROAD_SPACING,
);
const gridRoadYs = Array.from(
  { length: Math.round((WORLD_ROAD_MAX_Y - WORLD_ROAD_MIN_Y) / ROAD_SPACING) + 1 },
  (_, index) => WORLD_ROAD_MIN_Y + index * ROAD_SPACING,
);

for (const x of gridRoadXs) {
  const points = [
    ...gridRoadYs.map((y) => ({ x, y })),
    ...[...gridJunctions.values()].filter((candidate) => Math.abs(candidate.x - x) < 0.02),
  ].sort((a, b) => a.y - b.y);
  const unique = points.filter((candidate, index) => index === 0 || !samePoint(candidate, points[index - 1]));
  for (const candidate of unique) registerGridJunction(candidate);
  for (let index = 1; index < unique.length; index += 1) {
    const a = unique[index - 1];
    const b = unique[index];
    const midpoint = { x, y: (a.y + b.y) / 2 };
    if (
      isPlayablePoint(midpoint.x, midpoint.y)
      && !pointInsideRoundaboutApproachCut(midpoint)
      && gridStreetSegmentEnabled(a, b)
    ) {
      addPhysicalSegment(`street-v-${x}`, "street", ROAD_HALF, 1, a, b);
    }
  }
}

for (const y of gridRoadYs) {
  const points = [
    ...gridRoadXs.map((x) => ({ x, y })),
    ...[...gridJunctions.values()].filter((candidate) => Math.abs(candidate.y - y) < 0.02),
  ].sort((a, b) => a.x - b.x);
  const unique = points.filter((candidate, index) => index === 0 || !samePoint(candidate, points[index - 1]));
  for (const candidate of unique) registerGridJunction(candidate);
  for (let index = 1; index < unique.length; index += 1) {
    const a = unique[index - 1];
    const b = unique[index];
    const midpoint = { x: (a.x + b.x) / 2, y };
    if (
      isPlayablePoint(midpoint.x, midpoint.y)
      && !pointInsideRoundaboutApproachCut(midpoint)
      && gridStreetSegmentEnabled(a, b)
    ) {
      addPhysicalSegment(`street-h-${y}`, "street", ROAD_HALF, 1, a, b);
    }
  }
}

function nearestNetworkSegment(point: Vec2, heading?: number): SegmentProjection {
  let best: SegmentProjection | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const segment of physicalSegments) {
    const projected = projectPointToSegment(point, segment.a, segment.b);
    const yaw = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
    const alignment = heading === undefined
      ? 0
      : Math.min(
          Math.abs(Math.sin(normalizeAngle(yaw - heading))),
          Math.abs(Math.sin(normalizeAngle(yaw + Math.PI - heading))),
        );
    const score = projected.distance + alignment * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = {
        segment,
        point: projected.point,
        t: projected.t,
        centerDistance: projected.distance,
        tangentYaw: yaw,
      };
    }
  }
  if (!best) throw new Error("Road network has no segments");
  return best;
}

export function nearestRoadProjection(point: Vec2, heading?: number): RoadProjection {
  const projection = nearestNetworkSegment(point, heading);
  return {
    roadId: projection.segment.pathId,
    kind: projection.segment.kind,
    point: projection.point,
    centerDistance: projection.centerDistance,
    surfaceDistance: projection.centerDistance - projection.segment.halfWidth,
    tangentYaw: projection.tangentYaw,
    halfWidth: projection.segment.halfWidth,
  };
}

export function nearestSpecialRoadProjection(point: Vec2) {
  let best: (RoadProjection & { segment: SpecialRoadSegment }) | null = null;
  for (const segment of SPECIAL_ROAD_SEGMENTS) {
    const projected = projectPointToSegment(point, segment.a, segment.b);
    if (!best || projected.distance < best.centerDistance) {
      best = {
        roadId: segment.pathId,
        kind: segment.kind,
        point: projected.point,
        centerDistance: projected.distance,
        surfaceDistance: projected.distance - segment.halfWidth,
        tangentYaw: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x),
        halfWidth: segment.halfWidth,
        segment,
      };
    }
  }
  return best;
}

export function isRoadSurface(point: Vec2, margin = 0) {
  if (!isPlayablePoint(point.x, point.y, -margin)) return false;
  const special = nearestSpecialRoadProjection(point);
  if (special && special.centerDistance <= special.halfWidth + margin) return true;
  if (pointInRoundaboutIsland(point, -0.4 + margin)) return false;
  const vertical = Math.abs(point.x - nearestGridRoadX(point.x)) <= ROAD_HALF + margin
    && point.y >= WORLD_ROAD_MIN_Y - ROAD_HALF - margin
    && point.y <= WORLD_ROAD_MAX_Y + ROAD_HALF + margin
    && gridStreetPointEnabled(point, "vertical");
  const horizontal = Math.abs(point.y - nearestGridRoadY(point.y)) <= ROAD_HALF + margin
    && point.x >= WORLD_ROAD_MIN_X - ROAD_HALF - margin
    && point.x <= WORLD_ROAD_MAX_X + ROAD_HALF + margin
    && gridStreetPointEnabled(point, "horizontal");
  return vertical || horizontal;
}

/** Four-lane authored corridors receive the highway top-speed bonus. */
export function isHighwaySpeedSurface(point: Vec2, margin = 0) {
  return SPECIAL_ROAD_SEGMENTS.some((segment) => {
    if (segment.lanes < 4) return false;
    return projectPointToSegment(point, segment.a, segment.b).distance
      <= segment.halfWidth + margin;
  });
}

export function roadHalfWidthAtPoint(point: Vec2) {
  const projection = nearestRoadProjection(point);
  return projection.centerDistance <= projection.halfWidth + 3 ? projection.halfWidth : ROAD_HALF;
}

export function isRoadJunctionPoint(point: Vec2) {
  const direct = undirectedNeighbors.get(pointKey(point));
  if (direct) return direct.size >= 3;
  for (const [id, candidate] of graphNodes) {
    if (distance(candidate, point) <= 1.2) return (undirectedNeighbors.get(id)?.size ?? 0) >= 3;
  }
  return false;
}

function segmentIntersectsExpandedSquare(a: Vec2, b: Vec2, center: Vec2, halfExtent: number) {
  const minX = center.x - halfExtent;
  const maxX = center.x + halfExtent;
  const minY = center.y - halfExtent;
  const maxY = center.y + halfExtent;
  if (
    (a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY)
    || (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY)
  ) return true;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const tests: Array<[number, "x" | "y"]> = [
    [minX, "x"], [maxX, "x"], [minY, "y"], [maxY, "y"],
  ];
  for (const [edge, axis] of tests) {
    const denominator = axis === "x" ? dx : dy;
    if (Math.abs(denominator) < EPSILON) continue;
    const t = (edge - (axis === "x" ? a.x : a.y)) / denominator;
    if (t < 0 || t > 1) continue;
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    if (x >= minX - EPSILON && x <= maxX + EPSILON && y >= minY - EPSILON && y <= maxY + EPSILON) return true;
  }
  return false;
}

export function specialRoadIntersectsSquare(center: Vec2, halfExtent: number, clearance = 0) {
  return SPECIAL_ROAD_SEGMENTS.some((segment) => (
    segmentIntersectsExpandedSquare(
      segment.a,
      segment.b,
      center,
      halfExtent + segment.halfWidth + clearance,
    )
  ));
}

export function routeCrossesRoundaboutIsland(route: readonly Vec2[]) {
  for (let index = 1; index < route.length; index += 1) {
    for (const roundabout of ROUNDABOUTS) {
      if (segmentIntersectsExpandedSquare(
        route[index - 1],
        route[index],
        roundabout.center,
        roundabout.islandHalfSize + 0.8,
      )) return true;
    }
  }
  return false;
}

type SearchResult = {
  points: Vec2[];
  cost: number;
  usesSpecialRoad: boolean;
};

type QueueItem = { id: string; distance: number; priority: number };

function queuePush(queue: QueueItem[], item: QueueItem) {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].priority <= item.priority) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = item;
}

function queuePop(queue: QueueItem[]) {
  if (!queue.length) return null;
  const first = queue[0];
  const last = queue.pop()!;
  if (queue.length) {
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= queue.length) break;
      const child = right < queue.length && queue[right].priority < queue[left].priority ? right : left;
      if (queue[child].priority >= last.priority) break;
      queue[index] = queue[child];
      index = child;
    }
    queue[index] = last;
  }
  return first;
}

function shortestPath(startId: string, targetId: string): SearchResult | null {
  if (startId === targetId) {
    return { points: [graphNodes.get(startId)!], cost: 0, usesSpecialRoad: false };
  }
  const distances = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, { node: string; edge: GraphEdge }>();
  const targetPoint = graphNodes.get(targetId)!;
  const heuristic = (id: string) => distance(graphNodes.get(id)!, targetPoint) * 0.68;
  const queue: QueueItem[] = [{ id: startId, distance: 0, priority: heuristic(startId) }];
  while (queue.length) {
    const current = queuePop(queue)!;
    if (current.distance !== distances.get(current.id)) continue;
    if (current.id === targetId) break;
    for (const edge of adjacency.get(current.id) ?? []) {
      const nextCost = current.distance + edge.cost;
      if (nextCost + 0.0001 < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, nextCost);
        previous.set(edge.to, { node: current.id, edge });
        queuePush(queue, {
          id: edge.to,
          distance: nextCost,
          priority: nextCost + heuristic(edge.to),
        });
      }
    }
  }
  const finalCost = distances.get(targetId);
  if (finalCost === undefined) return null;
  const ids = [targetId];
  let cursor = targetId;
  let usesSpecialRoad = false;
  while (cursor !== startId) {
    const step = previous.get(cursor);
    if (!step) return null;
    usesSpecialRoad ||= step.edge.segment.kind !== "street";
    cursor = step.node;
    ids.push(cursor);
  }
  ids.reverse();
  return {
    points: ids.map((id) => graphNodes.get(id)!),
    cost: finalCost,
    usesSpecialRoad,
  };
}

function uniqueRoute(points: Vec2[]) {
  return points.filter((candidate, index) => index === 0 || !samePoint(candidate, points[index - 1], 0.05));
}

export function routeRoadNetwork(
  start: Vec2,
  target: Vec2,
  heading: number,
  direction: 1 | -1,
): NetworkRouteCandidate | null {
  const from = nearestNetworkSegment(start, heading);
  const to = nearestNetworkSegment(target);
  const fromYaw = from.tangentYaw;
  const startOptions = [
    {
      nodeId: from.segment.aId,
      endpoint: from.segment.a,
      allowed: from.segment.allowBA,
      yaw: fromYaw + Math.PI,
      length: distance(from.point, from.segment.a),
    },
    {
      nodeId: from.segment.bId,
      endpoint: from.segment.b,
      allowed: from.segment.allowAB,
      yaw: fromYaw,
      length: distance(from.point, from.segment.b),
    },
  ].filter((option) => {
    if (!option.allowed) return false;
    const forwardDot = Math.cos(normalizeAngle(option.yaw - heading));
    return direction > 0 ? forwardDot >= -0.02 : forwardDot <= 0.02;
  });
  const targetOptions = [
    {
      nodeId: to.segment.aId,
      endpoint: to.segment.a,
      allowed: to.segment.allowAB,
      length: distance(to.segment.a, to.point),
    },
    {
      nodeId: to.segment.bId,
      endpoint: to.segment.b,
      allowed: to.segment.allowBA,
      length: distance(to.segment.b, to.point),
    },
  ].filter((option) => option.allowed);

  let best: NetworkRouteCandidate | null = null;
  for (const startOption of startOptions) {
    for (const targetOption of targetOptions) {
      const graph = shortestPath(startOption.nodeId, targetOption.nodeId);
      if (!graph) continue;
      const route = uniqueRoute([
        start,
        from.point,
        startOption.endpoint,
        ...graph.points,
        targetOption.endpoint,
        to.point,
        target,
      ]);
      const cost = (
        distance(start, from.point)
        + startOption.length * from.segment.travelWeight
        + graph.cost
        + targetOption.length * to.segment.travelWeight
        + distance(to.point, target)
      );
      const candidate: NetworkRouteCandidate = {
        route,
        departureYaw: startOption.yaw,
        cost,
        usesSpecialRoad: from.segment.kind !== "street"
          || to.segment.kind !== "street"
          || graph.usesSpecialRoad,
      };
      if (!best || candidate.cost < best.cost) best = candidate;
    }
  }
  return best;
}

/** Heading-neutral graph route for fare economy and rectangular-route fallback. */
export function routeRoadNetworkShortest(start: Vec2, target: Vec2): NetworkRouteCandidate | null {
  const from = nearestNetworkSegment(start);
  const to = nearestNetworkSegment(target);
  const fromYaw = from.tangentYaw;
  const startOptions = [
    {
      nodeId: from.segment.aId,
      endpoint: from.segment.a,
      allowed: from.segment.allowBA,
      yaw: fromYaw + Math.PI,
      length: distance(from.point, from.segment.a),
    },
    {
      nodeId: from.segment.bId,
      endpoint: from.segment.b,
      allowed: from.segment.allowAB,
      yaw: fromYaw,
      length: distance(from.point, from.segment.b),
    },
  ].filter((option) => option.allowed);
  const targetOptions = [
    {
      nodeId: to.segment.aId,
      endpoint: to.segment.a,
      allowed: to.segment.allowAB,
      length: distance(to.segment.a, to.point),
    },
    {
      nodeId: to.segment.bId,
      endpoint: to.segment.b,
      allowed: to.segment.allowBA,
      length: distance(to.segment.b, to.point),
    },
  ].filter((option) => option.allowed);
  let best: NetworkRouteCandidate | null = null;
  for (const startOption of startOptions) {
    for (const targetOption of targetOptions) {
      const graph = shortestPath(startOption.nodeId, targetOption.nodeId);
      if (!graph) continue;
      const route = uniqueRoute([
        start,
        from.point,
        startOption.endpoint,
        ...graph.points,
        targetOption.endpoint,
        to.point,
        target,
      ]);
      const cost = distance(start, from.point)
        + startOption.length * from.segment.travelWeight
        + graph.cost
        + targetOption.length * to.segment.travelWeight
        + distance(to.point, target);
      const candidate: NetworkRouteCandidate = {
        route,
        departureYaw: startOption.yaw,
        cost,
        usesSpecialRoad: from.segment.kind !== "street"
          || to.segment.kind !== "street"
          || graph.usesSpecialRoad,
      };
      if (!best || candidate.cost < best.cost) best = candidate;
    }
  }
  return best;
}

const pathMetrics = new Map(SPECIAL_ROADS.map((road) => {
  const pairs = pathPairs(road);
  const cumulative = [0];
  for (const [a, b] of pairs) cumulative.push(cumulative[cumulative.length - 1] + distance(a, b));
  return [road.id, { road, pairs, cumulative, length: cumulative[cumulative.length - 1] }] as const;
}));

export function sampleSpecialRoad(roadId: string, distanceAlong: number, laneOffset = 0): RoadPathSample | null {
  const metrics = pathMetrics.get(roadId);
  if (!metrics || metrics.length <= 0) return null;
  const wrapped = metrics.road.closed
    ? ((distanceAlong % metrics.length) + metrics.length) % metrics.length
    : clamp(distanceAlong, 0, metrics.length);
  let index = metrics.cumulative.findIndex((value, candidate) => (
    candidate > 0 && value >= wrapped
  )) - 1;
  if (index < 0) index = metrics.pairs.length - 1;
  const [a, b] = metrics.pairs[index];
  const segmentStart = metrics.cumulative[index];
  const segmentLength = Math.max(EPSILON, distance(a, b));
  const t = clamp((wrapped - segmentStart) / segmentLength, 0, 1);
  const heading = Math.atan2(b.y - a.y, b.x - a.x);
  return {
    road: metrics.road,
    heading,
    point: {
      x: a.x + (b.x - a.x) * t - Math.sin(heading) * laneOffset,
      y: a.y + (b.y - a.y) * t + Math.cos(heading) * laneOffset,
    },
  };
}

export function specialRoadLength(roadId: string) {
  return pathMetrics.get(roadId)?.length ?? 0;
}

export function specialRoadNamesNear(point: Vec2, maxDistance = 22) {
  const names = new Set<string>();
  for (const segment of SPECIAL_ROAD_SEGMENTS) {
    const projected = projectPointToSegment(point, segment.a, segment.b);
    if (projected.distance <= segment.halfWidth + maxDistance) names.add(segment.pathName);
  }
  return [...names];
}
