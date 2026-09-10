import { CITY_LIMIT, cityGreenAt } from "../city-layout";
import { CITY_LANDMARKS } from "../landmarks";
import type { Color } from "../model";
import type { RoadControlPoint } from "../roads/geometry";
import { triangularHeight } from "./northstar-forms";

export const CITY_TERRAIN_STEP = 6;
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const hill = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

export function inCityTerrain(x: number, y: number) {
  return Math.abs(x) <= CITY_LIMIT && Math.abs(y) <= CITY_LIMIT;
}

const landmarkHeights: Record<string, number> = {
  "marina-arcade": 0, "apex-hotel": 0, "south-terminal": 8, "rooftop-radio": 16,
  "ink-market": 12, "redline-pier": 4, "pulse-stadium": 10, "skyport-airport": 8,
  "nova-megamall": 6, "neon-titan": 14, "deep-blue-aquarium": 2, "neon-general": 4,
  "apex-university": 26, "volt-expo": 22, "starfall-observatory": 38, "lucky-88-casino": 4,
};

/** Level campuses include their perimeter pavement and entrance approaches. */
export const CITY_TERRACES = [
  { id: "starting-core", minX: -144, maxX: 180, minY: -144, maxY: 144, height: 0, feather: 90 },
  ...CITY_LANDMARKS.map(landmark => ({ id: landmark.id,
    minX: landmark.originX * 36 - 18, maxX: (landmark.originX + landmark.width) * 36 + 18,
    minY: landmark.originY * 36 - 18, maxY: (landmark.originY + landmark.height) * 36 + 18,
    height: landmarkHeights[landmark.id], feather: 72 })),
  { id: "apex-circle", minX: 180, maxX: 252, minY: -252, maxY: -180, height: 6, feather: 54 },
  { id: "market-circle", minX: -396, maxX: -324, minY: 252, maxY: 324, height: 12, feather: 54 },
];

function terracedHeight(x: number, y: number, initial: number) {
  let height = initial, total = 1;
  for (const terrace of CITY_TERRACES) {
    const distance = Math.hypot(Math.max(terrace.minX - x, 0, x - terrace.maxX),
      Math.max(terrace.minY - y, 0, y - terrace.maxY));
    if (distance === 0) return terrace.height;
    const influence = 1 - smooth(distance / terrace.feather);
    const weight = influence / Math.max(1e-10, 1 - influence);
    height += terrace.height * weight;
    total += weight;
  }
  return height / total;
}

const roadVertices = new Map<string, number>();
function roadVertex(x: number, y: number) {
  if (!inCityTerrain(x, y)) return 0;
  const key = `${x},${y}`;
  const cached = roadVertices.get(key);
  if (cached !== undefined) return cached;
  const base = 31 * hill(x, y, -150, -600, 380, 260)
    + 17 * hill(x, y, -540, -120, 245, 430)
    + 11 * hill(x, y, 500, -270, 245, 245)
    + 14 * hill(x, y, 0, 315, 185, 150);
  const rollers = (10 * hill(x, y, 432, -252, 47, 70) + 12 * hill(x, y, 612, -252, 47, 70));
  const seam = smooth((CITY_LIMIT - Math.max(Math.abs(x), Math.abs(y))) / 72);
  const height = terracedHeight(x, y, base + rollers) * seam;
  roadVertices.set(key, height);
  return height;
}

/** All grid and curved streets meet on the same piecewise-planar design field. */
export function cityRoadHeight(x: number, y: number) {
  return inCityTerrain(x, y) ? triangularHeight(x, y, 6, cityDesignVertex) : 0;
}

function cityDesignVertex(x: number, y: number) {
  // Level twelve-unit junction tables join the steep mid-block grades. Both
  // crossing ribbons therefore occupy the same plane throughout the junction.
  const gradeCoordinate = (value: number) => {
    const base = Math.floor(value / 36) * 36;
    return base + Math.max(0, Math.min(1, (value - base - 6) / 24)) * 36;
  };
  return triangularHeight(gradeCoordinate(x), gradeCoordinate(y), 36, roadVertex);
}

/** Exact design triangles, with redundant collinear cuts removed from the mesh. */
export function drapeCityRoad(points: readonly RoadControlPoint[], maxSegmentLength = 24): RoadControlPoint[] {
  const result: RoadControlPoint[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1], b = points[index], cuts = [0, 1];
    for (const [start, end] of [[a.x, b.x], [a.y, b.y], [a.x - a.y, b.x - b.y]]) {
      if (Math.abs(end - start) < 1e-8) continue;
      for (let line = Math.ceil(Math.min(start, end) / 6) * 6; line < Math.max(start, end); line += 6) {
        const t = (line - start) / (end - start);
        if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
      }
    }
    for (const t of cuts.sort((a, b) => a - b).filter((t, i, all) => i === 0 || t - all[i - 1] > 1e-6)) {
      if (index > 1 && t === 0) continue;
      const point: RoadControlPoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      point.z = cityRoadHeight(point.x, point.y);
      if (a.halfWidth !== undefined && b.halfWidth !== undefined) point.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
      if (a.bank !== undefined || b.bank !== undefined) point.bank = (a.bank ?? 0) + ((b.bank ?? 0) - (a.bank ?? 0)) * t;
      while (result.length >= 2) {
        const first = result[result.length - 2], middle = result[result.length - 1];
        const length = Math.hypot(point.x - first.x, point.y - first.y);
        if (length >= maxSegmentLength) break;
        const fraction = Math.hypot(middle.x - first.x, middle.y - first.y) / length;
        if (!Number.isFinite(fraction) || fraction > 1 || Math.hypot(
          middle.x - first.x - (point.x - first.x) * fraction,
          middle.y - first.y - (point.y - first.y) * fraction,
          (middle.z ?? 0) - (first.z ?? 0) - ((point.z ?? 0) - (first.z ?? 0)) * fraction) > 1e-7) break;
        if (["halfWidth", "bank"].some(key => {
          const field = key as "halfWidth" | "bank";
          const values = [first[field], middle[field], point[field]];
          if (values.every(value => value === undefined)) return false;
          return values.some(value => value === undefined)
            || Math.abs(middle[field]! - first[field]! - (point[field]! - first[field]!) * fraction) > 1e-7;
        })) break;
        result.pop();
      }
      result.push(point);
    }
  }
  return result;
}

export function cityNaturalHeight(x: number, y: number) {
  if (!inCityTerrain(x, y)) return 0;
  const green = cityGreenAt(x, y);
  const campus = CITY_TERRACES.some(terrace => terrace.id !== "starting-core" && x >= terrace.minX && x <= terrace.maxX && y >= terrace.minY && y <= terrace.maxY);
  const folds = green && !campus ? 3 * (1 + Math.sin(x / 55) * Math.cos(y / 73))
    * smooth(Math.min(x - green.minX, green.maxX - x, y - green.minY, green.maxY - y) / 36) : 0;
  return cityRoadHeight(x, y) + folds;
}

export function cityTerrainColor(x: number, y: number, z: number, slope: number): Color {
  if (slope > .45) return Math.floor(z / 4) % 2 ? [.39, .43, .4, 1] : [.58, .59, .48, 1];
  if (cityGreenAt(x, y)) return Math.sin(x / 31 + y / 43) > 0 ? [.29, .46, .29, 1] : [.39, .53, .32, 1];
  if (x > 288 && y > 324) return [.7, .72, .65, 1];
  return [.74, .73, .62, 1];
}
