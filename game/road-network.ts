import { inCityTerrain, drapeCityRoad } from "./terrain/city-forms";
import {
  ROAD_HALF,
  ROAD_SPACING,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  WORLD_ROAD_MIN_X,
  WORLD_ROAD_MIN_Y,
} from "./config";
import type { WorldPoint } from "./model";
import { clamp, distance } from "./math";
import { compileRoad, sampleRoad, roadDistance, type RoadSample } from "./roads/geometry";
import { RoadGraph, roadNodeKey, type RoadGraphSegment } from "./roads/graph";
import { RoadSpatialIndex } from "./roads/spatial-index";
import { splitRoadIntersections } from "./roads/intersections";
import { isPlayablePoint } from "./regions";
import { atRoadElevation, inElevatedTerrain, roadDesignHeight } from "./terrain/region-forms";
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
  a: WorldPoint;
  b: WorldPoint;
};

type NetworkSegment = RoadGraphSegment & { kind: NetworkKind };

export type RoadProjection = {
  roadId: string;
  kind: NetworkKind;
  point: WorldPoint;
  centerDistance: number;
  surfaceDistance: number;
  tangentYaw: number;
  halfWidth: number;
};

export type NetworkRouteCandidate = {
  route: WorldPoint[];
  departureYaw: number;
  cost: number;
  usesSpecialRoad: boolean;
};

export type RoadPathSample = RoadSample & {
  road: RoadPathDefinition;
};

function pointKey(point: WorldPoint) {
  return roadNodeKey(point);
}

function samePoint(a: WorldPoint, b: WorldPoint, tolerance = 0.02) {
  return roadDistance(a, b) <= tolerance;
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

function projectPointToSegment(point: WorldPoint, a: WorldPoint, b: WorldPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= EPSILON
    ? 0
    : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  const projection: WorldPoint = { x: a.x + dx * t, y: a.y + dy * t };
  if (a.z !== undefined || b.z !== undefined) projection.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
  return { point: projection, t, distance: distance(point, projection) };
}

function pathPairs(road: RoadPathDefinition) {
  const pairs: Array<[WorldPoint, WorldPoint]> = [];
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

function pointInRoundaboutIsland(point: WorldPoint, margin = 0) {
  return ROUNDABOUTS.some((roundabout) => (
    Math.abs(point.x - roundabout.center.x) <= roundabout.islandHalfSize + margin
    && Math.abs(point.y - roundabout.center.y) <= roundabout.islandHalfSize + margin
  ));
}

function pointInsideRoundaboutApproachCut(point: WorldPoint) {
  return ROUNDABOUTS.some((roundabout) => (
    distance(point, roundabout.center) < roundabout.radius - 0.75
  ));
}

function splitAtGridCrossings(a: WorldPoint, b: WorldPoint) {
  const candidates: Array<{ t: number; point: WorldPoint; grid: boolean }> = [
    { t: 0, point: a, grid: false },
    { t: 1, point: b, grid: false },
  ];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > EPSILON) {
    for (let x = WORLD_ROAD_MIN_X; x <= WORLD_ROAD_MAX_X; x += ROAD_SPACING) {
      const t = (x - a.x) / dx;
      if (t > EPSILON && t < 1 - EPSILON) {
        const point: WorldPoint = { x, y: a.y + dy * t };
        if (a.z !== undefined || b.z !== undefined) point.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
        candidates.push({ t, point, grid: true });
      }
    }
  }
  if (Math.abs(dy) > EPSILON) {
    for (let y = WORLD_ROAD_MIN_Y; y <= WORLD_ROAD_MAX_Y; y += ROAD_SPACING) {
      const t = (y - a.y) / dy;
      if (t > EPSILON && t < 1 - EPSILON) {
        const point: WorldPoint = { x: a.x + dx * t, y };
        if (a.z !== undefined || b.z !== undefined) point.z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t;
        candidates.push({ t, point, grid: true });
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

function explicitJunction(road: RoadPathDefinition, candidate: WorldPoint) {
  return road.junctions.some((junction) => samePoint(junction, candidate));
}

const physicalSegments: NetworkSegment[] = [];
const gridJunctions = new Map<string, WorldPoint>();

function registerGridJunction(point: WorldPoint) {
  // Local streets follow the engineered terrain; bridges keep their own deck.
  if (Math.abs((point.z ?? 0) - roadDesignHeight(point.x, point.y)) > 0.001) return;
  gridJunctions.set(pointKey(point), { ...point });
}

function addPhysicalSegment(
  pathId: string,
  kind: NetworkKind,
  halfWidth: number,
  travelWeight: number,
  a: WorldPoint,
  b: WorldPoint,
  allowAB = true,
  allowBA = true,
) {
  // A terrain-cell cut can leave a very short span. Dropping distinct nodes
  // disconnects an otherwise continuous road (and strands GPS and fare routes).
  if (pointKey(a) === pointKey(b)) return;
  const samples = Math.max(1, Math.ceil(distance(a, b) / 12));
  for (let sample = 0; sample <= samples; sample += 1) {
    const t = sample / samples;
    if (!isPlayablePoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return;
  }
  const points = kind === "street" && inCityTerrain((a.x + b.x) / 2, (a.y + b.y) / 2) ? drapeCityRoad([a, b], Infinity) : [a, b];
  for (let index = 1; index < points.length; index += 1) {
    const first = points[index - 1], second = points[index];
    physicalSegments.push({ id: `${pathId}:${pointKey(first)}:${pointKey(second)}`,
      pathId, kind, halfWidth, travelWeight, a: first, b: second, allowAB, allowBA });
  }
}

for (const road of SPECIAL_ROADS) {
  for (const [a, b] of pathPairs(road)) {
    const split = road.connectGrid === "crossings"
      ? splitAtGridCrossings(a, b)
      : [{ t: 0, point: a, grid: explicitJunction(road, a) }, { t: 1, point: b, grid: explicitJunction(road, b) }];
    for (const item of split) {
      if (item.grid || explicitJunction(road, item.point)) registerGridJunction(item.point);
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
    ...gridRoadYs.map((y) => atRoadElevation({ x, y })),
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
    ...gridRoadXs.map((x) => atRoadElevation({ x, y })),
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

const roadGraph = new RoadGraph(splitRoadIntersections(physicalSegments));

export function nearestRoadProjection(point: WorldPoint, heading?: number): RoadProjection {
  const projection = roadGraph.nearest(point.z === undefined ? atRoadElevation(point) : point, heading);
  return {
    roadId: projection.segment.pathId,
    kind: projection.segment.kind as NetworkKind,
    point: projection.point,
    centerDistance: projection.centerDistance,
    surfaceDistance: projection.centerDistance - projection.segment.halfWidth,
    tangentYaw: projection.tangentYaw,
    halfWidth: projection.segment.halfWidth,
  };
}

/** On-demand rescue search across real roads, without the normal same-deck routing bias. */
export function recoveryRoadProjections(point: WorldPoint): Array<RoadProjection & { allowAB: boolean; allowBA: boolean }> {
  return physicalSegments.map(segment => {
    const projected = projectPointToSegment(point, segment.a, segment.b);
    return { roadId: segment.pathId, kind: segment.kind, point: projected.point,
      centerDistance: projected.distance, surfaceDistance: projected.distance - segment.halfWidth,
      tangentYaw: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x), halfWidth: segment.halfWidth,
      allowAB: segment.allowAB, allowBA: segment.allowBA };
  }).sort((a, b) => roadDistance(point, a.point) - roadDistance(point, b.point));
}

export function nearestSpecialRoadProjection(point: WorldPoint) {
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

export function isRoadSurface(point: WorldPoint, margin = 0) {
  if (!isPlayablePoint(point.x, point.y, -margin)) return false;
  const elevated = point.z === undefined ? atRoadElevation(point) : point;
  if (roadSurfaceIndex.query(elevated, Math.max(0.05, margin)).some((sample) => (
    Math.abs((elevated.z ?? 0) - sample.point.z) < 1.25
    && sample.surfaceDistance <= Math.max(0.025, margin)
    && Math.abs(sample.lateralOffset) <= sample.halfWidth + margin
  ))) return true;
  if (inElevatedTerrain(point.x, point.y) || Math.abs(point.z ?? 0) > 1.25) return false;
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
export function isHighwaySpeedSurface(point: WorldPoint, margin = 0) {
  return specialRoadSurfaceIndex.query(point, Math.max(0.05, margin)).some((sample) => (
    (pathMetrics.get(sample.roadId)?.road.lanes ?? 0) >= 4
    && Math.abs((point.z ?? 0) - sample.point.z) < 1.25
    && sample.surfaceDistance <= Math.max(0.025, margin)
    && Math.abs(sample.lateralOffset) <= sample.halfWidth + margin
  ));
}

export function roadHalfWidthAtPoint(point: WorldPoint) {
  const projection = nearestRoadProjection(point);
  return projection.centerDistance <= projection.halfWidth + 3 ? projection.halfWidth : ROAD_HALF;
}

export function isRoadJunctionPoint(point: WorldPoint) {
  return roadGraph.isJunction(point);
}

function segmentIntersectsExpandedSquare(a: WorldPoint, b: WorldPoint, center: WorldPoint, halfExtent: number) {
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

export function specialRoadIntersectsSquare(center: WorldPoint, halfExtent: number, clearance = 0) {
  return SPECIAL_ROAD_SEGMENTS.some((segment) => (
    segmentIntersectsExpandedSquare(
      segment.a,
      segment.b,
      center,
      halfExtent + segment.halfWidth + clearance,
    )
  ));
}

export function routeCrossesRoundaboutIsland(route: readonly WorldPoint[]) {
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

export function routeRoadNetwork(start: WorldPoint, target: WorldPoint, heading: number, direction: 1 | -1): NetworkRouteCandidate | null {
  return roadGraph.route(start.z === undefined ? atRoadElevation(start) : start,
    target.z === undefined ? atRoadElevation(target) : target, heading, direction, 4);
}

/** Heading-neutral physical route for fare economy and route planning. */
export function routeRoadNetworkShortest(start: WorldPoint, target: WorldPoint): NetworkRouteCandidate | null {
  return roadGraph.route(start.z === undefined ? atRoadElevation(start) : start,
    target.z === undefined ? atRoadElevation(target) : target, undefined, 1, 4);
}

const pathMetrics = new Map(SPECIAL_ROADS.map((road) => {
  const geometry = compileRoad(road.id, road.points, road.halfWidth, road.closed,
    road.points.some((point) => inElevatedTerrain(point.x, point.y)) ? 4 : 0);
  return [road.id, { road, geometry, length: geometry.length }] as const;
}));

export const specialRoadSurfaceIndex = new RoadSpatialIndex([...pathMetrics.values()].map(({ geometry }) => geometry));

export const elevatedGridRoads = physicalSegments.filter((segment) => segment.kind === "street"
  && inElevatedTerrain((segment.a.x + segment.b.x) / 2, (segment.a.y + segment.b.y) / 2))
  .map((segment) => compileRoad(segment.id, [segment.a, segment.b], ROAD_HALF));
/** City excavation stops at its boundary; neighboring landforms retain their own road beds. */
export const cityGridRoadIds = new Set(elevatedGridRoads.filter(road => road.sections.every(section =>
  inCityTerrain(section.center.x, section.center.y))).map(road => road.id));
export const roadSurfaceIndex = new RoadSpatialIndex([
  ...[...pathMetrics.values()].map(({ geometry }) => geometry), ...elevatedGridRoads,
]);

export function compiledSpecialRoad(roadId: string) {
  return pathMetrics.get(roadId)?.geometry ?? null;
}

export function sampleSpecialRoad(roadId: string, distanceAlong: number, laneOffset = 0): RoadPathSample | null {
  const metrics = pathMetrics.get(roadId);
  if (!metrics || metrics.length <= 0) return null;
  return {
    road: metrics.road,
    ...sampleRoad(metrics.geometry, distanceAlong, laneOffset),
  };
}

export function specialRoadLength(roadId: string) {
  return pathMetrics.get(roadId)?.length ?? 0;
}

export function specialRoadNamesNear(point: WorldPoint, maxDistance = 22) {
  const names = new Set<string>();
  for (const segment of SPECIAL_ROAD_SEGMENTS) {
    const projected = projectPointToSegment(point, segment.a, segment.b);
    if (projected.distance <= segment.halfWidth + maxDistance) names.add(segment.pathName);
  }
  return [...names];
}
