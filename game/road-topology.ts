import { ROAD_SPACING } from "./config";
import {
  campusBlocksGridStreetPoint,
  campusBlocksGridStreetSegment,
} from "./campuses";
import type { Vec2 } from "./model";
import type { WorldRegionId } from "./region-types";
import {
  containingRegionForPosition,
  isPlayablePoint,
} from "./regions";

export type GridStreetAxis = "vertical" | "horizontal";

const EPSILON = 0.02;

/** Northstar keeps only a compact village lattice and a sparse rural skeleton. */
export const NORTHSTAR_VILLAGE_GRID = {
  minX: -ROAD_SPACING * 8,
  maxX: ROAD_SPACING * 8,
  minY: -ROAD_SPACING * 44,
  maxY: -ROAD_SPACING * 33,
} as const;

/** Copper Junction is the only dense South grid; the desert beyond is rural. */
export const COPPER_JUNCTION_GRID = {
  minX: -ROAD_SPACING * 8,
  maxX: ROAD_SPACING * 8,
  minY: ROAD_SPACING * 33,
  maxY: ROAD_SPACING * 45,
} as const;

/** Lantern Bay is Cypress Reach's compact, walkable town center. */
export const LANTERN_BAY_GRID = {
  minX: ROAD_SPACING * 30,
  maxX: ROAD_SPACING * 48,
  minY: ROAD_SPACING * 30,
  maxY: ROAD_SPACING * 48,
} as const;

const NORTHSTAR_VERTICAL_SPINES = new Set([
  -ROAD_SPACING * 16,
  0,
  ROAD_SPACING * 16,
]);

const NORTHSTAR_HORIZONTAL_LINKS = new Set([
  -ROAD_SPACING * 66,
  -ROAD_SPACING * 60,
  -ROAD_SPACING * 54,
  -ROAD_SPACING * 48,
  -ROAD_SPACING * 42,
  -ROAD_SPACING * 36,
  -ROAD_SPACING * 30,
  -ROAD_SPACING * 24,
]);

const COPPER_MESA_VERTICAL_SPINES = new Set([
  -ROAD_SPACING * 16,
  0,
  ROAD_SPACING * 16,
]);

const COPPER_MESA_HORIZONTAL_LINKS = new Set([
  ROAD_SPACING * 22,
  ROAD_SPACING * 30,
  ROAD_SPACING * 36,
  ROAD_SPACING * 42,
  ROAD_SPACING * 48,
  ROAD_SPACING * 54,
  ROAD_SPACING * 60,
  ROAD_SPACING * 66,
]);

const CYPRESS_REACH_VERTICAL_SPINES = new Set([
  ROAD_SPACING * 22,
  ROAD_SPACING * 30,
  ROAD_SPACING * 38,
  ROAD_SPACING * 46,
  ROAD_SPACING * 54,
  ROAD_SPACING * 62,
  ROAD_SPACING * 66,
]);

const CYPRESS_REACH_HORIZONTAL_LINKS = new Set([
  ROAD_SPACING * 22,
  ROAD_SPACING * 30,
  ROAD_SPACING * 38,
  ROAD_SPACING * 46,
  ROAD_SPACING * 54,
  ROAD_SPACING * 62,
  ROAD_SPACING * 66,
]);

function nearestGridLine(value: number) {
  return Math.round(value / ROAD_SPACING) * ROAD_SPACING;
}

function insideVillage(point: Vec2) {
  return point.x >= NORTHSTAR_VILLAGE_GRID.minX - EPSILON
    && point.x <= NORTHSTAR_VILLAGE_GRID.maxX + EPSILON
    && point.y >= NORTHSTAR_VILLAGE_GRID.minY - EPSILON
    && point.y <= NORTHSTAR_VILLAGE_GRID.maxY + EPSILON;
}

function insideCopperJunction(point: Vec2) {
  return point.x >= COPPER_JUNCTION_GRID.minX - EPSILON
    && point.x <= COPPER_JUNCTION_GRID.maxX + EPSILON
    && point.y >= COPPER_JUNCTION_GRID.minY - EPSILON
    && point.y <= COPPER_JUNCTION_GRID.maxY + EPSILON;
}

function insideLanternBay(point: Vec2) {
  return point.x >= LANTERN_BAY_GRID.minX - EPSILON
    && point.x <= LANTERN_BAY_GRID.maxX + EPSILON
    && point.y >= LANTERN_BAY_GRID.minY - EPSILON
    && point.y <= LANTERN_BAY_GRID.maxY + EPSILON;
}

function northstarGridStreetEnabled(point: Vec2, axis: GridStreetAxis) {
  if (insideVillage(point)) return true;
  if (axis === "vertical") {
    const roadX = nearestGridLine(point.x);
    if (NORTHSTAR_VERTICAL_SPINES.has(roadX)) return true;
    // Short rural feeders serve the mill/woods and lake country without
    // rebuilding the full city lattice between them.
    if (roadX === -ROAD_SPACING * 10) {
      return point.y >= -ROAD_SPACING * 60 && point.y <= -ROAD_SPACING * 40;
    }
    if (roadX === ROAD_SPACING * 10) {
      // Lake/lookout access: one long rural lane links the village grid to
      // Mirror Lake and Aurora Lookout without restoring the full lattice.
      return point.y >= -ROAD_SPACING * 66 && point.y <= -ROAD_SPACING * 36;
    }
    return false;
  }
  return NORTHSTAR_HORIZONTAL_LINKS.has(nearestGridLine(point.y));
}

function copperMesaGridStreetEnabled(point: Vec2, axis: GridStreetAxis) {
  if (insideCopperJunction(point)) return true;
  if (axis === "vertical") {
    const roadX = nearestGridLine(point.x);
    if (COPPER_MESA_VERTICAL_SPINES.has(roadX)) return true;
    if (roadX === -ROAD_SPACING * 10) {
      return point.y >= ROAD_SPACING * 38 && point.y <= ROAD_SPACING * 58;
    }
    if (roadX === ROAD_SPACING * 10) {
      return point.y >= ROAD_SPACING * 36 && point.y <= ROAD_SPACING * 60;
    }
    return false;
  }
  return COPPER_MESA_HORIZONTAL_LINKS.has(nearestGridLine(point.y));
}

function cypressReachGridStreetEnabled(point: Vec2, axis: GridStreetAxis) {
  if (insideLanternBay(point)) return true;
  if (axis === "vertical") {
    const roadX = nearestGridLine(point.x);
    if (CYPRESS_REACH_VERTICAL_SPINES.has(roadX)) return true;
    // Short access roads end at isolated docks, homes, and preserve gates.
    if (roadX === ROAD_SPACING * 34) {
      return point.y >= ROAD_SPACING * 46 && point.y <= ROAD_SPACING * 62;
    }
    if (roadX === ROAD_SPACING * 58) {
      return point.y >= ROAD_SPACING * 30 && point.y <= ROAD_SPACING * 58;
    }
    return false;
  }
  return CYPRESS_REACH_HORIZONTAL_LINKS.has(nearestGridLine(point.y));
}

function solanaCoastGridStreetEnabled(point: Vec2, axis: GridStreetAxis) {
  // The entire ocean, beach and promenade have no street lattice.
  if (point.x < -56 * ROAD_SPACING - EPSILON) return false;
  const town = point.x <= -34 * ROAD_SPACING && point.y >= -9 * ROAD_SPACING && point.y <= 9 * ROAD_SPACING;
  const gateway = point.x >= -33 * ROAD_SPACING;
  if (town || gateway) return true;
  if (axis === "vertical") return [-56, -48, -40, -34].some((line) => nearestGridLine(point.x) === line * ROAD_SPACING);
  return [-22, -18, -10, 10, 16, 22].some((line) => nearestGridLine(point.y) === line * ROAD_SPACING);
}

export function regionUsesSparseRoadTopology(regionId: WorldRegionId | null | undefined) {
  return regionId === "northstar-range" || regionId === "copper-mesa" || regionId === "cypress-reach" || regionId === "solana-coast";
}

/** One authority for pavement, physics, routing, traffic, fares, and GPS. */
export function gridStreetPointEnabled(point: Vec2, axis: GridStreetAxis) {
  if (!isPlayablePoint(point.x, point.y)) return false;
  if (campusBlocksGridStreetPoint(point, axis)) return false;
  const region = containingRegionForPosition(point.x, point.y);
  if (region?.id === "northstar-range") return northstarGridStreetEnabled(point, axis);
  if (region?.id === "copper-mesa") return copperMesaGridStreetEnabled(point, axis);
  if (region?.id === "cypress-reach") return cypressReachGridStreetEnabled(point, axis);
  if (region?.id === "solana-coast") return solanaCoastGridStreetEnabled(point, axis);
  return true;
}

export function gridStreetSegmentEnabled(a: Vec2, b: Vec2) {
  const vertical = Math.abs(a.x - b.x) < EPSILON;
  const horizontal = Math.abs(a.y - b.y) < EPSILON;
  if (!vertical && !horizontal) return false;
  if (campusBlocksGridStreetSegment(a, b)) return false;
  if (!isPlayablePoint(a.x, a.y) || !isPlayablePoint(b.x, b.y)) return false;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = Math.max(1, Math.ceil(length / (ROAD_SPACING / 2)));
  const axis: GridStreetAxis = vertical ? "vertical" : "horizontal";
  for (let sample = 0; sample < samples; sample += 1) {
    const t = (sample + 0.5) / samples;
    if (!gridStreetPointEnabled({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    }, axis)) return false;
  }
  return true;
}

/** Nearest live grid line for traffic recycling inside sparse regional cells. */
export function nearestEnabledGridRoadLine(point: Vec2, axis: GridStreetAxis) {
  const coordinate = axis === "vertical" ? point.x : point.y;
  const base = nearestGridLine(coordinate);
  for (let radius = 0; radius <= 24; radius += 1) {
    const offsets = radius === 0 ? [0] : [-radius, radius];
    for (const offset of offsets) {
      const line = base + offset * ROAD_SPACING;
      const candidate = axis === "vertical"
        ? { x: line, y: point.y }
        : { x: point.x, y: line };
      if (gridStreetPointEnabled(candidate, axis)) return line;
    }
  }
  return null;
}

/** Validates legacy axis routes against the active-region union and every closed street. */
export function routeStaysOnEnabledRoads(route: readonly Vec2[]) {
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1];
    const b = route[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const axis: GridStreetAxis | null = Math.abs(dx) < EPSILON
      ? "vertical"
      : Math.abs(dy) < EPSILON
        ? "horizontal"
        : null;
    const length = Math.hypot(dx, dy);
    const samples = Math.max(1, Math.ceil(length / 3));
    for (let sample = 0; sample <= samples; sample += 1) {
      const t = sample / samples;
      const point = { x: a.x + dx * t, y: a.y + dy * t };
      if (!isPlayablePoint(point.x, point.y)) return false;
      if (axis && sample > 0 && sample < samples && !gridStreetPointEnabled(point, axis)) return false;
    }
  }
  return true;
}
