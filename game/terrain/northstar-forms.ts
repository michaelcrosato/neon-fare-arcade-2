import type { WorldPoint } from "../model";
import type { RoadControlPoint } from "../roads/geometry";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t); };
export const NORTHSTAR_TERRAIN_STEP = 9;
export const NORTHSTAR_DESIGN_STEP = 36;

export function inNorthstarTerrain(x: number, y: number) {
  return x >= -792 && x <= 792 && y < -792 && y >= -2376;
}

/** A walkable village and short service lanes; scenic roads connect the valleys. */
export function northstarGridStreetEnabled(point: WorldPoint, axis: "vertical" | "horizontal") {
  const { x, y } = point;
  if (x >= -144.02 && x <= 180.02 && y >= -1512.02 && y <= -1331.98) return true;
  const near = (value: number, line: number) => Math.abs(value - line) < 0.02;
  const within = (value: number, a: number, b: number) => value >= a - 0.02 && value <= b + 0.02;
  if (axis === "vertical") {
    return (near(x, 0) && within(y, -972, -792))
      || ([432, 468].some((line) => near(x, line)) && within(y, -1116, -1044))
      || (near(x, 216) && within(y, -1584, -1440))
      || (near(x, -576) && within(y, -1584, -1512))
      || (near(x, -612) && within(y, -1836, -1692))
      || (near(x, 360) && (within(y, -1944, -1728) || within(y, -2268, -2160)));
  }
  return ([-936, -900].some((line) => near(y, line)) && within(x, -36, 36))
    || ([-1116, -1080, -1044].some((line) => near(y, line)) && within(x, 396, 504))
    || ([-1548, -1476].some((line) => near(y, line)) && within(x, 144, 252))
    || ([-1548, -1512].some((line) => near(y, line)) && within(x, -612, -468))
    || ([-1800, -1728].some((line) => near(y, line)) && within(x, -648, -504))
    || ([-1944, -1728].some((line) => near(y, line)) && within(x, 288, 612))
    || (near(y, -2160) && within(x, -180, 180))
    || (near(y, -2196) && within(x, 288, 468));
}

/** Flat occupied benches sit within the mountain; feathered edges form the cuts. */
export const NORTHSTAR_TERRACES = [
  { id: "gateway", minX: -54, maxX: 36, minY: -972, maxY: -864, height: 8, feather: 70 },
  { id: "gas", minX: 420, maxX: 492, minY: -1116, maxY: -1026, height: 21, feather: 90 },
  { id: "village", minX: -144, maxX: 180, minY: -1512, maxY: -1332, height: 44, feather: 90 },
  { id: "lodge", minX: 126, maxX: 252, minY: -1584, maxY: -1476, height: 49, feather: 70 },
  { id: "ranger", minX: -612, maxX: -522, minY: -1584, maxY: -1476, height: 55, feather: 70 },
  { id: "mill", minX: -648, maxX: -504, minY: -1836, maxY: -1692, height: 68, feather: 80 },
  { id: "lake", minX: 324, maxX: 612, minY: -1944, maxY: -1728, height: 82, feather: 100 },
  { id: "lake-junction", minX: 324, maxX: 414, minY: -2034, maxY: -1980, height: 100, feather: 60 },
  { id: "resort", minX: -144, maxX: 108, minY: -2304, maxY: -2124, height: 128, feather: 85 },
  { id: "lookout", minX: 324, maxX: 468, minY: -2304, maxY: -2160, height: 157, feather: 100 },
  { id: "summit-station", minX: -432, maxX: -360, minY: -2232, maxY: -2160, height: 221, feather: 50 },
] as const;

export function northstarSnowRun(x: number, y: number) {
  const t = Math.max(0, Math.min(1, (x + 396) / 378));
  return x > -432 && x < 0 && Math.abs(y - (-2196 - 36 * t)) < 13 + 12 * t;
}

export function northstarStationReserved(x: number, y: number) {
  return Math.abs(x + 396) < 24 && Math.abs(y + 2196) < 24;
}

const PROFILE = [[0, 0], [144, 8], [360, 26], [612, 46], [864, 65], [1116, 91], [1368, 126], [1584, 146]] as const;
function profile(y: number) {
  const north = Math.max(0, -792 - y);
  for (let i = 1; i < PROFILE.length; i += 1) {
    if (north > PROFILE[i][0]) continue;
    const [a, b] = [PROFILE[i - 1], PROFILE[i]];
    return a[1] + (b[1] - a[1]) * smooth((north - a[0]) / (b[0] - a[0]));
  }
  return PROFILE[PROFILE.length - 1][1];
}

function terracedHeight(x: number, y: number, initial: number) {
  let height = initial;
  for (const terrace of NORTHSTAR_TERRACES) {
    const distance = Math.hypot(Math.max(terrace.minX - x, 0, x - terrace.maxX),
      Math.max(terrace.minY - y, 0, y - terrace.maxY));
    const weight = 1 - smooth(distance / terrace.feather);
    height += (terrace.height - height) * weight;
  }
  return height;
}

/** Continuous piecewise-planar sampling, using the same NW–SE diagonal as meshes. */
export function triangularHeight(x: number, y: number, step: number, vertex: (x: number, y: number) => number) {
  const left = Math.floor(x / step) * step, top = Math.floor(y / step) * step;
  const u = (x - left) / step, v = (y - top) / step;
  const a = vertex(left, top), c = vertex(left + step, top + step);
  return u >= v
    ? a + (vertex(left + step, top) - a) * u + (c - vertex(left + step, top)) * v
    : a + (c - vertex(left, top + step)) * u + (vertex(left, top + step) - a) * v;
}

const roadVertices = new Map<string, number>();
function roadVertex(x: number, y: number) {
  const key = `${x},${y}`;
  let height = roadVertices.get(key);
  if (height === undefined) {
    const fade = smooth((-y - 792) / 120);
    height = inNorthstarTerrain(x, y) ? terracedHeight(x, y, profile(y)) * fade : 0;
    // A level bridge junction joins the gorge viaduct and highway while the
    // natural valley remains far below both decks.
    const junctionDistance = Math.hypot(Math.max(-108 - x, 0, x + 36), Math.max(-1800 - y, 0, y + 1728));
    if (inNorthstarTerrain(x, y)) height += (76 - height) * (1 - smooth(junctionDistance / 60));
    roadVertices.set(key, height);
  }
  return height;
}

/** The engineered road grade is independent of the surrounding natural relief. */
export function northstarRoadHeight(x: number, y: number) {
  return inNorthstarTerrain(x, y) ? triangularHeight(x, y, NORTHSTAR_DESIGN_STEP, roadVertex) : 0;
}

const peak = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, height: number) =>
  height * Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

export function naturalTerrainHeight(x: number, y: number) {
  if (!inNorthstarTerrain(x, y)) return 0;
  const fade = smooth((-y - 792) / 180);
  const mountains = Math.max(
    peak(x, y, -410, -1140, 190, 240, 115),
    peak(x, y, 650, -1430, 190, 220, 155),
    peak(x, y, -480, -2030, 250, 330, 200),
    peak(x, y, 650, -2220, 200, 245, 170),
    peak(x, y, -75, -2380, 230, 145, 215),
  );
  const gorge = peak(x, y, -215, -1770, 95, 230, 90);
  const folds = 5 * Math.sin(x * 0.022 + Math.sin(y * 0.007) * 2)
    + 3 * Math.sin(y * 0.041 + x * 0.013);
  return Math.max(0, terracedHeight(x, y, profile(y) + mountains - gorge + folds)) * fade;
}

/** Split at all design-cell boundaries so crossing roads share exact grades. */
export function drapeNorthstarRoad(points: readonly RoadControlPoint[]): RoadControlPoint[] {
  const output: RoadControlPoint[] = [];
  const step = NORTHSTAR_DESIGN_STEP;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1], b = points[index];
    const cuts = [0, 1];
    for (const [start, end] of [[a.x, b.x], [a.y, b.y], [a.x - a.y, b.x - b.y]]) {
      if (Math.abs(end - start) < 1e-8) continue;
      for (let line = Math.ceil(Math.min(start, end) / step) * step; line < Math.max(start, end); line += step) {
        const t = (line - start) / (end - start);
        if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
      }
    }
    for (const t of cuts.sort((a, b) => a - b).filter((value, i, all) => i === 0 || value - all[i - 1] > 1e-6)) {
      if (index > 1 && t === 0) continue;
      const point: RoadControlPoint = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      point.z = northstarRoadHeight(point.x, point.y);
      if (a.halfWidth !== undefined && b.halfWidth !== undefined) point.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
      if (a.bank !== undefined || b.bank !== undefined) point.bank = (a.bank ?? 0) + ((b.bank ?? 0) - (a.bank ?? 0)) * t;
      output.push(point);
    }
  }
  return output;
}

export function atRoadElevation<T extends WorldPoint>(point: T): T {
  return inNorthstarTerrain(point.x, point.y) ? { ...point, z: northstarRoadHeight(point.x, point.y) } : point;
}
