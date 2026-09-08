import {
  BLOCKS_PER_CHUNK,
  CENTER_REGION_CHUNK_MAX,
  CENTER_REGION_CHUNK_MIN,
  CHUNK_SIZE,
  EAST_REGION_CHUNK_MAX_X,
  EAST_REGION_CHUNK_MIN_X,
  WEST_REGION_CHUNK_MIN_X,
  WEST_REGION_CHUNK_MAX_X,
  NORTH_REGION_CHUNK_MAX_Y,
  NORTH_REGION_CHUNK_MIN_Y,
  SOUTH_REGION_CHUNK_MAX_Y,
  SOUTH_REGION_CHUNK_MIN_Y,
  SOUTHEAST_REGION_CHUNK_MAX_X,
  SOUTHEAST_REGION_CHUNK_MAX_Y,
  SOUTHEAST_REGION_CHUNK_MIN_X,
  SOUTHEAST_REGION_CHUNK_MIN_Y,
  ROAD_HALF,
  ROAD_SPACING,
} from "./config";
import type { RegionDirection, WorldRegionId, WorldTheme } from "./region-types";

export type { RegionDirection, WorldRegionId, WorldTheme } from "./region-types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type WorldRegion = {
  id: WorldRegionId;
  direction: RegionDirection;
  name: string;
  shortName: string;
  theme: WorldTheme;
  chunkMinX: number;
  chunkMaxX: number;
  chunkMinY: number;
  chunkMaxY: number;
  mapColor: string;
};

/**
 * The registry is the expansion seam for the eventual 3 x 3 world. Runtime
 * systems iterate these active cells instead of assuming one symmetric map.
 */
export const ACTIVE_WORLD_REGIONS = [
  {
    id: "city-center",
    direction: "C",
    name: "NEON CITY",
    shortName: "CITY",
    theme: "city",
    chunkMinX: CENTER_REGION_CHUNK_MIN,
    chunkMaxX: CENTER_REGION_CHUNK_MAX,
    chunkMinY: CENTER_REGION_CHUNK_MIN,
    chunkMaxY: CENTER_REGION_CHUNK_MAX,
    mapColor: "rgba(255, 65, 40, 0.08)",
  },
  {
    id: "cedar-vale",
    direction: "E",
    name: "CEDAR VALE",
    shortName: "VALE",
    theme: "residential",
    chunkMinX: EAST_REGION_CHUNK_MIN_X,
    chunkMaxX: EAST_REGION_CHUNK_MAX_X,
    chunkMinY: CENTER_REGION_CHUNK_MIN,
    chunkMaxY: CENTER_REGION_CHUNK_MAX,
    mapColor: "rgba(119, 172, 86, 0.13)",
  },
  {
    id: "northstar-range",
    direction: "N",
    name: "NORTHSTAR RANGE",
    shortName: "RANGE",
    theme: "mountain",
    chunkMinX: CENTER_REGION_CHUNK_MIN,
    chunkMaxX: CENTER_REGION_CHUNK_MAX,
    chunkMinY: NORTH_REGION_CHUNK_MIN_Y,
    chunkMaxY: NORTH_REGION_CHUNK_MAX_Y,
    mapColor: "rgba(80, 132, 129, 0.17)",
  },
  {
    id: "copper-mesa",
    direction: "S",
    name: "COPPER MESA",
    shortName: "MESA",
    theme: "desert",
    chunkMinX: CENTER_REGION_CHUNK_MIN,
    chunkMaxX: CENTER_REGION_CHUNK_MAX,
    chunkMinY: SOUTH_REGION_CHUNK_MIN_Y,
    chunkMaxY: SOUTH_REGION_CHUNK_MAX_Y,
    mapColor: "rgba(218, 112, 47, 0.16)",
  },
  {
    id: "cypress-reach",
    direction: "SE",
    name: "CYPRESS REACH",
    shortName: "REACH",
    theme: "wetland",
    chunkMinX: SOUTHEAST_REGION_CHUNK_MIN_X,
    chunkMaxX: SOUTHEAST_REGION_CHUNK_MAX_X,
    chunkMinY: SOUTHEAST_REGION_CHUNK_MIN_Y,
    chunkMaxY: SOUTHEAST_REGION_CHUNK_MAX_Y,
    mapColor: "rgba(31, 143, 132, 0.18)",
  },
  {
    id: "solana-coast",
    direction: "W",
    name: "SOLANA COAST",
    shortName: "COAST",
    theme: "coastal",
    chunkMinX: WEST_REGION_CHUNK_MIN_X,
    chunkMaxX: WEST_REGION_CHUNK_MAX_X,
    chunkMinY: CENTER_REGION_CHUNK_MIN,
    chunkMaxY: CENTER_REGION_CHUNK_MAX,
    mapColor: "rgba(22, 167, 196, 0.19)",
  },
] as const satisfies readonly WorldRegion[];

/** Empty cells deliberately remain unnamed until their themes are designed. */
type WorldRegionSlot = {
  direction: RegionDirection;
  gridX: -1 | 0 | 1;
  gridY: -1 | 0 | 1;
  activeRegionId: WorldRegionId | null;
};

export const WORLD_REGION_SLOTS = [
  { direction: "NW", gridX: -1, gridY: -1, activeRegionId: null },
  { direction: "N", gridX: 0, gridY: -1, activeRegionId: "northstar-range" },
  { direction: "NE", gridX: 1, gridY: -1, activeRegionId: null },
  { direction: "W", gridX: -1, gridY: 0, activeRegionId: "solana-coast" },
  { direction: "C", gridX: 0, gridY: 0, activeRegionId: "city-center" },
  { direction: "E", gridX: 1, gridY: 0, activeRegionId: "cedar-vale" },
  { direction: "SW", gridX: -1, gridY: 1, activeRegionId: null },
  { direction: "S", gridX: 0, gridY: 1, activeRegionId: "copper-mesa" },
  { direction: "SE", gridX: 1, gridY: 1, activeRegionId: "cypress-reach" },
] as const satisfies readonly WorldRegionSlot[];

/** Regional dispatches cross one shared seam and never route through an inactive cell. */
export function activeCardinalNeighborRegions(regionId: WorldRegionId) {
  const origin = WORLD_REGION_SLOTS.find((slot) => slot.activeRegionId === regionId);
  if (!origin) return [];
  const regionsById = new Map(ACTIVE_WORLD_REGIONS.map((region) => [region.id, region]));
  return WORLD_REGION_SLOTS.flatMap((slot) => {
    if (!slot.activeRegionId) return [];
    const cardinalDistance = Math.abs(slot.gridX - origin.gridX) + Math.abs(slot.gridY - origin.gridY);
    const region = regionsById.get(slot.activeRegionId);
    return cardinalDistance === 1 && region ? [region] : [];
  });
}

export function chunkCoordinateForPosition(value: number) {
  return Math.floor((value + CHUNK_SIZE / 2) / CHUNK_SIZE);
}

export function chunkCoordinateForBlock(block: number) {
  return Math.floor((block + BLOCKS_PER_CHUNK / 2) / BLOCKS_PER_CHUNK);
}

export function regionForChunk(cx: number, cy: number) {
  return ACTIVE_WORLD_REGIONS.find((region) => (
    cx >= region.chunkMinX
    && cx <= region.chunkMaxX
    && cy >= region.chunkMinY
    && cy <= region.chunkMaxY
  )) ?? null;
}

export function isActiveChunk(cx: number, cy: number) {
  return regionForChunk(cx, cy) !== null;
}

export function regionForBlock(blockX: number, blockY: number) {
  return regionForChunk(chunkCoordinateForBlock(blockX), chunkCoordinateForBlock(blockY));
}

export function isActiveBlock(blockX: number, blockY: number) {
  return regionForBlock(blockX, blockY) !== null;
}

export function nearestActiveChunk(cx: number, cy: number) {
  let best = { cx: 0, cy: 0, distance: Number.POSITIVE_INFINITY };
  for (const region of ACTIVE_WORLD_REGIONS) {
    const candidateX = clamp(cx, region.chunkMinX, region.chunkMaxX);
    const candidateY = clamp(cy, region.chunkMinY, region.chunkMaxY);
    const candidateDistance = (candidateX - cx) ** 2 + (candidateY - cy) ** 2;
    if (candidateDistance < best.distance) {
      best = { cx: candidateX, cy: candidateY, distance: candidateDistance };
    }
  }
  return { cx: best.cx, cy: best.cy };
}

export function regionForPosition(x: number, y: number) {
  const nearest = nearestActiveChunk(
    chunkCoordinateForPosition(x),
    chunkCoordinateForPosition(y),
  );
  return regionForChunk(nearest.cx, nearest.cy)!;
}

export function regionPlayableBounds(region: WorldRegion, margin = 0) {
  const roads = regionRoadBounds(region);
  return {
    minX: roads.minX - ROAD_HALF + margin,
    maxX: roads.maxX + ROAD_HALF - margin,
    minY: roads.minY - ROAD_HALF + margin,
    maxY: roads.maxY + ROAD_HALF - margin,
  };
}

/** Exact containment for physics and generation; unlike regionForPosition it never snaps. */
export function containingRegionForPosition(x: number, y: number, margin = 0) {
  const owningRegion = regionForChunk(
    chunkCoordinateForPosition(x),
    chunkCoordinateForPosition(y),
  );
  if (owningRegion) {
    const bounds = regionPlayableBounds(owningRegion, margin);
    if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
      return owningRegion;
    }
  }
  return ACTIVE_WORLD_REGIONS.find((region) => {
    const bounds = regionPlayableBounds(region, margin);
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  }) ?? null;
}

export function isPlayablePoint(x: number, y: number, margin = 0) {
  return containingRegionForPosition(x, y, margin) !== null;
}

/**
 * Projects into the nearest active region rectangle. This remains correct for
 * future L-shaped activation patterns where one global bounding box would
 * accidentally make an inactive compass cell traversable.
 */
export function clampPointToActiveRegions(point: { x: number; y: number }, margin = 0) {
  let best = { x: point.x, y: point.y, distance: Number.POSITIVE_INFINITY };
  for (const region of ACTIVE_WORLD_REGIONS) {
    const bounds = regionPlayableBounds(region, margin);
    const x = clamp(point.x, bounds.minX, bounds.maxX);
    const y = clamp(point.y, bounds.minY, bounds.maxY);
    const candidateDistance = (x - point.x) ** 2 + (y - point.y) ** 2;
    if (candidateDistance < best.distance) best = { x, y, distance: candidateDistance };
  }
  return { x: best.x, y: best.y };
}

export function activeChunkCoordinates() {
  const output: Array<[number, number]> = [];
  for (const region of ACTIVE_WORLD_REGIONS) {
    for (let cx = region.chunkMinX; cx <= region.chunkMaxX; cx += 1) {
      for (let cy = region.chunkMinY; cy <= region.chunkMaxY; cy += 1) {
        output.push([cx, cy]);
      }
    }
  }
  return output;
}

export function regionRoadBounds(region: WorldRegion) {
  return {
    minX: region.chunkMinX * CHUNK_SIZE - CHUNK_SIZE / 2,
    maxX: (region.chunkMaxX + 1) * CHUNK_SIZE - CHUNK_SIZE / 2,
    minY: region.chunkMinY * CHUNK_SIZE - CHUNK_SIZE / 2,
    maxY: (region.chunkMaxY + 1) * CHUNK_SIZE - CHUNK_SIZE / 2,
  };
}

/** Small local names make the residential region feel lived-in on the HUD. */
export function cedarValeNeighborhoodForBlock(blockX: number, blockY: number) {
  if (blockX <= 31) return "WILLOW GATE";
  if (blockY <= -8) return "PINE RIDGE";
  if (blockY >= 8) return "BROOKSIDE";
  if (blockX >= 53) return "GARDEN END";
  return "MAPLE COMMONS";
}

export function northstarRangeAreaForBlock(blockX: number, blockY: number) {
  if (blockY >= -33) return "TIMBER PASS";
  if (blockX >= -7 && blockX <= 7 && blockY >= -44) return "NORTHSTAR VILLAGE";
  if (blockY <= -54) return "SILVER RUN";
  if (blockX >= 6) return "MIRROR LAKE";
  return "PINEHOOK WOODS";
}

/** Copper Mesa moves from a settled gateway into town, ranch country, and badlands. */
export function copperMesaAreaForBlock(blockX: number, blockY: number) {
  if (blockY <= 31) return "REDROCK GATE";
  if (blockY >= 54) return "PAINTED CANYON";
  if (blockX >= -7 && blockX <= 7 && blockY <= 45) return "COPPER JUNCTION";
  if (blockX >= 7) return "ARROYO VISTA";
  return "SAGUARO FLATS";
}

/** Cypress Reach transitions from two regional seams into bayou town and coast. */
export function cypressReachAreaForBlock(blockX: number, blockY: number) {
  if (blockX <= 30 || blockY <= 30) return "TWINWATER CROSSING";
  if (blockX >= 32 && blockX <= 46 && blockY >= 32 && blockY <= 46) return "LANTERN BAY";
  if (blockX >= 52 && blockY <= 50) return "BLACKWATER BASIN";
  if (blockY >= 54) return "STORMWALL COAST";
  return "CYPRESS REACH";
}

export function regionalPlaceName(x: number, y: number) {
  const region = regionForPosition(x, y);
  if (region.id === "solana-coast") {
    return solanaCoastAreaForBlock(Math.floor(x / ROAD_SPACING), Math.floor(y / ROAD_SPACING));
  }
  if (region.id === "cedar-vale") {
    return cedarValeNeighborhoodForBlock(
      Math.floor(x / ROAD_SPACING),
      Math.floor(y / ROAD_SPACING),
    );
  }
  if (region.id === "northstar-range") {
    return northstarRangeAreaForBlock(
      Math.floor(x / ROAD_SPACING),
      Math.floor(y / ROAD_SPACING),
    );
  }
  if (region.id === "copper-mesa") {
    return copperMesaAreaForBlock(
      Math.floor(x / ROAD_SPACING),
      Math.floor(y / ROAD_SPACING),
    );
  }
  if (region.id === "cypress-reach") {
    return cypressReachAreaForBlock(
      Math.floor(x / ROAD_SPACING),
      Math.floor(y / ROAD_SPACING),
    );
  }
  return null;
}

export function solanaCoastAreaForBlock(blockX: number, blockY: number) {
  if (blockX < -60) return "PACIFIC OCEAN";
  if (blockX <= -56) return "PACIFIC STRAND";
  if (blockX >= -33) return "SUNSET GATE";
  if (blockY <= -10) return "CITRUS HEIGHTS";
  if (blockY >= 10) return "MARIPOSA ARTS";
  return "SOLANA VILLAGE";
}
