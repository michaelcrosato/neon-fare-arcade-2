import { ROAD_SPACING } from "./config";
import { FEATURED_CITY_LANDMARKS, landmarkInterruptsGrid } from "./landmarks";
import type { Vec2 } from "./model";
import { REGIONAL_CONTENT } from "./regional-content";
import type { WorldTheme } from "./region-types";

export type CampusDefinition = {
  id: string;
  label: string;
  source: WorldTheme;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/**
 * Large destinations replace the ordinary internal street grid with one
 * continuous public campus. Perimeter streets remain untouched.
 */
export const WORLD_CAMPUSES: readonly CampusDefinition[] = [
  ...FEATURED_CITY_LANDMARKS
    .filter(landmarkInterruptsGrid)
    .map((landmark) => ({
      id: landmark.id,
      label: landmark.label,
      source: "city" as const,
      originX: landmark.originX,
      originY: landmark.originY,
      width: landmark.width,
      height: landmark.height,
    })),
  ...REGIONAL_CONTENT.flatMap((entry) => entry.anchors
    .filter((anchor) => entry.campusPolicy === "bellwether-only"
      ? anchor.id === "bellwether-school"
      : anchor.width > 1 || anchor.height > 1)
    .map((anchor) => ({
      id: anchor.id,
      label: anchor.label,
      source: entry.theme,
      originX: anchor.originX,
      originY: anchor.originY,
      width: anchor.width,
      height: anchor.height,
    }))),
] as const;

export type CampusTile = {
  campus: CampusDefinition;
  tileX: number;
  tileY: number;
};

export function campusTileForBlock(blockX: number, blockY: number): CampusTile | null {
  for (const campus of WORLD_CAMPUSES) {
    const tileX = blockX - campus.originX;
    const tileY = blockY - campus.originY;
    if (tileX >= 0 && tileX < campus.width && tileY >= 0 && tileY < campus.height) {
      return { campus, tileX, tileY };
    }
  }
  return null;
}

function sharedCampus(
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
) {
  const first = campusTileForBlock(firstX, firstY);
  const second = campusTileForBlock(secondX, secondY);
  return first && second && first.campus.id === second.campus.id ? first.campus : null;
}

export function campusInternalEdgesForBlock(blockX: number, blockY: number) {
  const tile = campusTileForBlock(blockX, blockY);
  if (!tile) return { west: false, east: false, north: false, south: false } as const;
  return {
    west: tile.tileX > 0,
    east: tile.tileX < tile.campus.width - 1,
    north: tile.tileY > 0,
    south: tile.tileY < tile.campus.height - 1,
  };
}

/**
 * Converts one tile's local coordinates into a single campus coordinate
 * system whose origin is the center of the whole footprint.
 */
export function campusLocalPoint(
  tileX: number,
  tileY: number,
  width: number,
  height: number,
  localX = 0,
  localY = 0,
) {
  return {
    x: (tileX - (width - 1) / 2) * ROAD_SPACING + localX,
    y: (tileY - (height - 1) / 2) * ROAD_SPACING + localY,
  };
}

export function campusForVerticalStreet(gridX: number, blockY: number) {
  const rightBlockX = Math.round(gridX / ROAD_SPACING);
  return sharedCampus(rightBlockX - 1, blockY, rightBlockX, blockY);
}

export function campusForHorizontalStreet(blockX: number, gridY: number) {
  const southBlockY = Math.round(gridY / ROAD_SPACING);
  return sharedCampus(blockX, southBlockY - 1, blockX, southBlockY);
}

export function campusBlocksGridStreetSegment(a: Vec2, b: Vec2) {
  const vertical = Math.abs(a.x - b.x) < 0.02;
  const horizontal = Math.abs(a.y - b.y) < 0.02;
  if (!vertical && !horizontal) return false;
  if (vertical) {
    const blockY = Math.floor(((a.y + b.y) / 2 + 0.0001) / ROAD_SPACING);
    return Boolean(campusForVerticalStreet(a.x, blockY));
  }
  const blockX = Math.floor(((a.x + b.x) / 2 + 0.0001) / ROAD_SPACING);
  return Boolean(campusForHorizontalStreet(blockX, a.y));
}

export function campusBlocksGridStreetPoint(point: Vec2, axis: "vertical" | "horizontal") {
  if (axis === "vertical") {
    const gridX = Math.round(point.x / ROAD_SPACING) * ROAD_SPACING;
    const blockY = Math.floor((point.y + 0.0001) / ROAD_SPACING);
    return Boolean(campusForVerticalStreet(gridX, blockY));
  }
  const blockX = Math.floor((point.x + 0.0001) / ROAD_SPACING);
  const gridY = Math.round(point.y / ROAD_SPACING) * ROAD_SPACING;
  return Boolean(campusForHorizontalStreet(blockX, gridY));
}

/** True when an axis-aligned guidance segment tries to use a removed street. */
export function routeUsesCampusStreetClosure(route: readonly Vec2[]) {
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1];
    const b = route[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const axis = Math.abs(dx) < 0.02
      ? "vertical"
      : Math.abs(dy) < 0.02
        ? "horizontal"
        : null;
    if (!axis) continue;
    const length = Math.hypot(dx, dy);
    const samples = Math.max(1, Math.ceil(length / 3));
    for (let sample = 0; sample <= samples; sample += 1) {
      if (sample === 0 || sample === samples) continue;
      const t = sample / samples;
      if (campusBlocksGridStreetPoint({ x: a.x + dx * t, y: a.y + dy * t }, axis)) return true;
    }
  }
  return false;
}
