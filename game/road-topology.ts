import { northstarGridStreetEnabled } from "./terrain/northstar-forms";
import { copperGridStreetEnabled } from "./terrain/copper-forms";
import { coastGridStreetEnabled } from "./terrain/coast-forms";
import { cedarGridStreetEnabled } from "./residential";
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
  minX: -144,
  maxX: 180,
  minY: -1512,
  maxY: -1332,
} as const;

/** Copper Junction is the only dense South grid; the desert beyond is rural. */
export const COPPER_JUNCTION_GRID = {
  minX: -144,
  maxX: 144,
  minY: 1260,
  maxY: 1440,
} as const;

/** Lantern Bay is Cypress Reach's compact, walkable town center. */
export const LANTERN_BAY_GRID = {
  minX: ROAD_SPACING * 30,
  maxX: ROAD_SPACING * 48,
  minY: ROAD_SPACING * 30,
  maxY: ROAD_SPACING * 48,
} as const;

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

function insideLanternBay(point: Vec2) {
  return point.x >= LANTERN_BAY_GRID.minX - EPSILON
    && point.x <= LANTERN_BAY_GRID.maxX + EPSILON
    && point.y >= LANTERN_BAY_GRID.minY - EPSILON
    && point.y <= LANTERN_BAY_GRID.maxY + EPSILON;
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

export function regionUsesSparseRoadTopology(regionId: WorldRegionId | null | undefined) {
  return regionId === "northstar-range" || regionId === "copper-mesa" || regionId === "cypress-reach" || regionId === "solana-coast" || regionId === "cedar-vale";
}

/** One authority for pavement, physics, routing, traffic, fares, and GPS. */
export function gridStreetPointEnabled(point: Vec2, axis: GridStreetAxis) {
  if (!isPlayablePoint(point.x, point.y)) return false;
  if (campusBlocksGridStreetPoint(point, axis)) return false;
  const region = containingRegionForPosition(point.x, point.y);
  if (region?.id === "cedar-vale") return cedarGridStreetEnabled(point, axis);
  if (region?.id === "northstar-range") return northstarGridStreetEnabled(point, axis);
  if (region?.id === "copper-mesa") return copperGridStreetEnabled(point, axis);
  if (region?.id === "cypress-reach") return cypressReachGridStreetEnabled(point, axis);
  if (region?.id === "solana-coast") return coastGridStreetEnabled(point, axis);
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
    const axis: GridStreetAxis | null = Math.abs(dx) < 1e-8
      ? "vertical"
      : Math.abs(dy) < 1e-8
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
