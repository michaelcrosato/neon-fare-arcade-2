import type { Color, MeshFace, Vec3, WorldPoint } from "../model";
import { MAT_STONE, MAT_SNOW, MAT_GRASS, MAT_SANDSTONE } from "../config";
import { cityGridRoadIds, roadSurfaceIndex } from "../road-network";
import { regionalSettlementPlan } from "./settlement";
import { copperTerrainColor, inCopperTerrain } from "./copper-forms";
import { coastTerrainColor, inCoastTerrain } from "./coast-forms";
import { coastCanalDistance, COAST_PIER, onCoastPier } from "../coastal-layout";
import { northstarSnowRun, NORTHSTAR_TERRAIN_STEP, triangularHeight } from "./northstar-forms";
import { inElevatedTerrain, naturalWorldHeight, roadDesignHeight } from "./region-forms";
import { watercourseAt } from "./watercourses";
import { CITY_TERRAIN_STEP, cityTerrainColor, inCityTerrain } from "./city-forms";
import { CITY_LIMIT } from "../city-layout";
import { inIronwake } from "../industrial-layout";
import { ironwakeTerrainColor } from "./industrial-forms";

const vertices = new Map<string, number>();
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** The road corridor carves the mountain; bridges retain the natural valley below. */
export function terrainVertexHeight(x: number, y: number) {
  if (!inElevatedTerrain(x, y)) return 0;
  const city = inCityTerrain(x, y);
  if (city && (Math.abs(x) === CITY_LIMIT || Math.abs(y) === CITY_LIMIT)) return 0;
  const key = `${x},${y}`;
  const cached = vertices.get(key);
  if (cached !== undefined) return cached;
  let height = naturalWorldHeight(x, y);
  const pad = regionalSettlementPlan(Math.floor(x / 36), Math.floor(y / 36));
  if (pad) {
    const edge = Math.max(Math.abs(x - pad.x), Math.abs(y - pad.y));
    height += (pad.floor - height) * (1 - smooth((edge - (city ? 6 : 12)) / 6));
  }
  const candidates = roadSurfaceIndex.query({ x, y, z: roadDesignHeight(x, y) }, 24)
    .filter(sample => city || !cityGridRoadIds.has(sample.roadId))
    .sort((a, b) => a.surfaceDistance - b.surfaceDistance);
  const road = candidates[0];
  if (road && road.surfaceDistance < 24) {
    const weight = city ? 1 - smooth(road.surfaceDistance / 9) : 1 - smooth((road.surfaceDistance - 9) / 15);
    // A conservative bed at bends prevents a coarse terrain triangle from
    // emerging through either lane of the more detailed swept pavement.
    const grade = Math.min(road.point.z, ...candidates.filter((sample) => sample.surfaceDistance < 10)
      .map((sample) => sample.point.z)) + (city ? 0 : 0.08);
    const bed = road.roadId.startsWith("street-") ? grade : Math.min(height, grade);
    height += (bed - height) * weight;
  }
  vertices.set(key, height);
  const water = watercourseAt(x, y);
  if (water && water.distance < 25) {
    const weight = 1 - smooth((water.distance - 9) / 16);
    height += (Math.min(height, water.height - 2.5) - height) * weight;
    vertices.set(key, height);
  }
  if (inCoastTerrain(x, y)) {
    const canal = coastCanalDistance(x, y);
    if (canal < 9) {
      height += (Math.min(height, -1.4) - height) * (1 - smooth((canal - 4.5) / 4.5));
      vertices.set(key, height);
    }
  }
  return height;
}

/** Tire, foot and mesh heights use exactly the same triangle interpolation. */
export function terrainHeightAt(x: number, y: number) {
  return inElevatedTerrain(x, y)
    ? triangularHeight(x, y, inCityTerrain(x, y) ? CITY_TERRAIN_STEP : NORTHSTAR_TERRAIN_STEP, terrainVertexHeight) : 0;
}

export function atTerrainElevation<T extends WorldPoint>(point: T): T {
  return inElevatedTerrain(point.x, point.y) ? { ...point, z: terrainHeightAt(point.x, point.y) } : point;
}

export function terrainSupport(point: WorldPoint) {
  // The timber deck supplies its own flat support above the seabed. Raising
  // terrain vertices here would create sand ramps outside the pier's edges.
  if (onCoastPier(point.x, point.y)) return { height: COAST_PIER.deckHeight, roadId: null, normal: { x: 0, y: 0, z: 1 } };
  const height = terrainHeightAt(point.x, point.y);
  if (!inElevatedTerrain(point.x, point.y)) return { height, roadId: null, normal: { x: 0, y: 0, z: 1 } };
  const d = 0.025;
  const dx = (terrainHeightAt(point.x + d, point.y) - terrainHeightAt(point.x - d, point.y)) / (2 * d);
  const dy = (terrainHeightAt(point.x, point.y + d) - terrainHeightAt(point.x, point.y - d)) / (2 * d);
  const length = Math.hypot(dx, dy, 1);
  return { height, roadId: null, normal: { x: -dx / length, y: -dy / length, z: 1 / length } };
}

/** Rock faces block uphill travel; downhill edges remain real falls. */
export function terrainBarrier(from: WorldPoint, to: WorldPoint, maxSlope = 0.65) {
  if (!inElevatedTerrain(to.x, to.y)) return null;
  const support = terrainSupport(to);
  const feet = from.z ?? terrainHeightAt(from.x, from.y);
  const rise = support.height - terrainHeightAt(from.x, from.y);
  const slope = Math.hypot(support.normal.x, support.normal.y) / support.normal.z;
  if (support.height <= feet + 0.85
    && (support.height < feet - 0.2 || slope <= maxSlope || rise <= 0.0001)) return null;
  const length = Math.hypot(support.normal.x, support.normal.y);
  const move = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { normalX: length > 0.001 ? support.normal.x / length : (from.x - to.x) / move,
    normalY: length > 0.001 ? support.normal.y / length : (from.y - to.y) / move };
}

function terrainColor(x: number, y: number, z: number, slope: number): Color {
  if (inIronwake(x, y)) return ironwakeTerrainColor(x, y);
  if (inCityTerrain(x, y)) return cityTerrainColor(x, y, z, slope);
  if (inCoastTerrain(x, y)) return coastTerrainColor(x, y, z, slope);
  if (inCopperTerrain(x, y)) return copperTerrainColor(x, y, z, slope);
  const band = Math.sin(x * 0.023 + y * 0.017) > 0 ? 1 : 0;
  const snowline = 155 + 12 * Math.sin(x * 0.009);
  if ((z > snowline && slope < 0.9) || northstarSnowRun(x, y)) return band ? [0.91, 0.94, 0.91, 1] : [0.79, 0.86, 0.88, 1];
  if (slope > 0.5 || z > 142) return band ? [0.31, 0.36, 0.4, 1] : [0.43, 0.46, 0.45, 1];
  if (z > 92) return band ? [0.32, 0.43, 0.28, 1] : [0.39, 0.48, 0.3, 1];
  return band ? [0.13, 0.3, 0.22, 1] : [0.2, 0.36, 0.23, 1];
}

export function northstarTerrainMesh(originX: number, originY: number, size: number): MeshFace[] {
  const faces: MeshFace[] = [];
  const city = inCityTerrain(originX + size / 2, originY + size / 2);
  const step = city ? CITY_TERRAIN_STEP : NORTHSTAR_TERRAIN_STEP;
  const vertex = (x: number, y: number): Vec3 => ({ x, y, z: terrainVertexHeight(x, y) });
  const mergedCityCells = new Set<string>();
  // Coalesce only exactly coplanar patches. Junction tables and building pads
  // retain their physical shape while avoiding dozens of redundant faces.
  if (city) for (const span of [36, 12]) {
    for (let x = originX; x < originX + size; x += span) for (let y = originY; y < originY + size; y += span) {
      if (mergedCityCells.has(`${x},${y}`)) continue;
      const start = terrainVertexHeight(x, y);
      const dx = (terrainVertexHeight(x + span, y) - start) / span;
      const dy = (terrainVertexHeight(x, y + span) - start) / span;
      let planar = true;
      for (let px = 0; px <= span && planar; px += step) for (let py = 0; py <= span; py += step) {
        if (Math.abs(terrainVertexHeight(x + px, y + py) - start - dx * px - dy * py) > 1e-8) { planar = false; break; }
      }
      if (!planar) continue;
      for (let px = 0; px < span; px += step) for (let py = 0; py < span; py += step) mergedCityCells.add(`${x + px},${y + py}`);
      const slope = Math.hypot(dx, dy), height = start + (dx + dy) * span / 2;
      faces.push({ corners: [vertex(x, y), vertex(x + span, y), vertex(x + span, y + span), vertex(x, y + span)],
        color: cityTerrainColor(x + span / 2, y + span / 2, height, slope), material: slope > .4 ? MAT_STONE : MAT_GRASS, kind: "terrain" });
    }
  }
  for (let x = originX; x < originX + size; x += step) {
    for (let y = originY; y < originY + size; y += step) {
      if (mergedCityCells.has(`${x},${y}`)) continue;
      const corners = [vertex(x, y), vertex(x + step, y), vertex(x + step, y + step), vertex(x, y + step)] as const;
      const average = corners.reduce((sum, point) => sum + point.z, 0) / 4;
      const slope = (Math.max(...corners.map((point) => point.z)) - Math.min(...corners.map((point) => point.z))) / step;
      const copper = inCopperTerrain(x + step / 2, y + step / 2);
      const coast = inCoastTerrain(x + step / 2, y + step / 2);
      faces.push({ corners, color: copper ? copperTerrainColor(x, y, average, slope) : terrainColor(x, y, average, slope),
        material: copper ? MAT_SANDSTONE : coast || city ? slope > 0.4 ? MAT_STONE : MAT_GRASS : average > 168 && slope < 0.9 ? MAT_SNOW : slope > 0.5 || average > 142 ? MAT_STONE : MAT_GRASS, kind: "terrain" });
    }
  }
  return faces;
}

export const regionalTerrainMesh = northstarTerrainMesh;
