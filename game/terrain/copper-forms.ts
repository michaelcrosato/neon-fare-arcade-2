import type { Color, WorldPoint } from "../model";
import { triangularHeight } from "./northstar-forms";

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const near = (value: number, line: number) => Math.abs(value - line) < 0.02;
const within = (value: number, a: number, b: number) => value >= a - 0.02 && value <= b + 0.02;

export function inCopperTerrain(x: number, y: number) {
  return x >= -792 && x <= 792 && y > 792 && y <= 2376;
}

/** Small town blocks and destination access lanes, joined by the scenic network. */
export function copperGridStreetEnabled({ x, y }: WorldPoint, axis: "vertical" | "horizontal") {
  if (axis === "horizontal" && near(y, 792)) return true;
  if (within(x, -144, 144) && within(y, 1260, 1440)) return true;
  if (axis === "vertical") {
    return (near(x, 0) && within(y, 792, 972))
      || (near(x, 72) && within(y, 900, 936))
      || (near(x, 576) && within(y, 1080, 1188))
      || (near(x, -360) && within(y, 1368, 1440))
      || (near(x, 540) && within(y, 1296, 1368))
      || (near(x, -540) && within(y, 1656, 1728))
      || (near(x, 144) && within(y, 1656, 1728))
      || (near(x, 360) && within(y, 1764, 1800))
      || (near(x, -324) && within(y, 2052, 2088))
      || (near(x, -216) && within(y, 2196, 2232));
  }
  return ([900, 936].some((line) => near(y, line)) && within(x, 0, 72))
    || ([1116, 1152].some((line) => near(y, line)) && within(x, 504, 612))
    || ([1368, 1404].some(line => near(y, line)) && within(x, -504, -324))
    || (near(y, 1296) && within(x, 504, 612))
    || (near(y, 1368) && within(x, 468, 792))
    || (near(y, 1692) && within(x, -576, -396))
    || (near(y, 1656) && within(x, 108, 216))
    || (near(y, 1728) && within(x, 108, 180))
    || (near(y, 1764) && within(x, 324, 468))
    || (near(y, 1944) && within(x, 612, 792))
    || (near(y, 2052) && within(x, -396, -252))
    || (near(y, 2088) && within(x, -504, -324))
    || (near(y, 2196) && within(x, -252, -108));
}

export const COPPER_TERRACES = [
  { id: "gate", minX: -18, maxX: 90, minY: 864, maxY: 954, height: 5, feather: 75 },
  { id: "trading", minX: 486, maxX: 630, minY: 1080, maxY: 1188, height: 17, feather: 90 },
  { id: "town", minX: -162, maxX: 162, minY: 1242, maxY: 1458, height: 24, feather: 100 },
  { id: "motor-court", minX: -414, maxX: -306, minY: 1350, maxY: 1422, height: 27, feather: 85 },
  { id: "resort", minX: 486, maxX: 630, minY: 1206, maxY: 1314, height: 28, feather: 90 },
  { id: "airpark", minX: -558, maxX: -378, minY: 1602, maxY: 1710, height: 34, feather: 95 },
  { id: "arts", minX: 90, maxX: 198, minY: 1566, maxY: 1674, height: 40, feather: 90 },
  { id: "solar", minX: 306, maxX: 486, minY: 1638, maxY: 1782, height: 43, feather: 95 },
  { id: "rodeo", minX: -378, maxX: -234, minY: 1962, maxY: 2070, height: 53, feather: 85 },
  { id: "canyon-visitor", minX: -270, maxX: -90, minY: 2070, maxY: 2214, height: 74, feather: 70 },
] as const;

function terraceHeight(x: number, y: number, value: number) {
  let height = value, total = 1;
  for (const terrace of COPPER_TERRACES) {
    const distance = Math.hypot(Math.max(terrace.minX - x, 0, x - terrace.maxX), Math.max(terrace.minY - y, 0, y - terrace.maxY));
    if (distance === 0) return terrace.height;
    const influence = 1 - smooth(distance / terrace.feather);
    const weight = influence / Math.max(1e-10, 1 - influence);
    height += terrace.height * weight;
    total += weight;
  }
  return height / total;
}

const PROFILE = [[792, 0], [936, 6], [1152, 17], [1404, 27], [1656, 39], [1872, 55], [2088, 79], [2304, 94], [2376, 96]] as const;
function profile(y: number) {
  for (let i = 1; i < PROFILE.length; i += 1) {
    if (y > PROFILE[i][0]) continue;
    const [a, b] = [PROFILE[i - 1], PROFILE[i]];
    return a[1] + (b[1] - a[1]) * smooth((y - a[0]) / (b[0] - a[0]));
  }
  return 96;
}

function seamFade(x: number, y: number) {
  return smooth((y - 792) / 144) * smooth((792 - x) / 180);
}

export function copperCanyonY(x: number) { return 2256 + 68 * Math.sin((x + 120) / 235); }
export function copperCanyonWaterHeight(x: number) { return 22 + 5 * smooth((x + 600) / 1200); }
export function copperCinderField(x: number, y: number) { return Math.hypot((x + 540) / 190, (y - 1080) / 180); }
export function copperSaltFlat(x: number, y: number) { return Math.hypot((x - 620) / 120, (y - 1860) / 125); }

/** Flat caprock with eroded, scalloped sides; mesas are terrain, not stacked boxes. */
function mesa(x: number, y: number, cx: number, cy: number, rx: number, ry: number, height: number) {
  const angle = Math.atan2((y - cy) / ry, (x - cx) / rx);
  const r = Math.hypot((x - cx) / rx, (y - cy) / ry);
  const scallop = 0.05 * Math.sin(angle * 7) + 0.035 * Math.cos(angle * 11);
  return height * (1 - smooth((r + scallop - 0.62) / 0.48));
}

export function copperNaturalHeight(x: number, y: number) {
  if (!inCopperTerrain(x, y)) return 0;
  return copperBackdropHeight(x, y);
}

/** Scenic land beyond the playable west/south boundary carries the horizon. */
export function copperBackdropHeight(x: number, y: number) {
  const redrock = Math.max(
    mesa(x, y, -282, 1092, 98, 116, 62),
    mesa(x, y, -690, 1845, 170, 240, 97),
    mesa(x, y, -174, 1752, 130, 150, 103),
    mesa(x, y, 144, 1908, 160, 138, 74),
    mesa(x, y, 486, 2080, 128, 125, 88),
    mesa(x, y, -486, 2340, 168, 150, 76),
  );
  const cinder = copperCinderField(x, y);
  const volcano = Math.max(0, 1 - cinder) * 88 - 25 * (1 - smooth(cinder / 0.26));
  const washY = 1530 + 65 * Math.sin((x + 100) / 190);
  const wash = 9 * (1 - smooth(Math.abs(y - washY) / 34));
  const canyon = 76 * (1 - smooth((Math.abs(y - copperCanyonY(x)) - 14) / 92));
  const folds = (2.5 * Math.sin(x * 0.042 + Math.sin(y * 0.02)) + 1.5 * Math.sin(y * 0.065 + x * 0.018))
    * smooth((y - 936) / 180);
  let height = profile(y) + Math.max(redrock, volcano) + folds - wash - canyon;
  const salt = 1 - smooth((copperSaltFlat(x, y) - 0.6) / 0.4);
  height += (36 - height) * salt;
  height = terraceHeight(x, y, height);
  return Math.max(0, height) * seamFade(x, y);
}

const roadVertices = new Map<string, number>();
function roadVertex(x: number, y: number) {
  const key = `${x},${y}`;
  let height = roadVertices.get(key);
  if (height === undefined) {
    // Broad engineered climbs crest the mesa while the gorge stays below the bridge.
    const rise = 35 * Math.exp(-(((x - 180) / 210) ** 2 + ((y - 1970) / 200) ** 2));
    height = inCopperTerrain(x, y) ? terraceHeight(x, y, profile(y) + rise) * seamFade(x, y) : 0;
    const junction = Math.hypot(Math.max(324 - x, 0, x - 396), Math.max(1908 - y, 0, y - 1980));
    if (inCopperTerrain(x, y)) height += (84 - height) * (1 - smooth(junction / 72));
    const solarJunction = Math.hypot(Math.max(324 - x, 0, x - 504), Math.max(1764 - y, 0, y - 1836));
    if (inCopperTerrain(x, y)) height += (43 - height) * (1 - smooth(solarJunction / 72));
    roadVertices.set(key, height);
  }
  return height;
}

export function copperRoadHeight(x: number, y: number) {
  return inCopperTerrain(x, y) ? triangularHeight(x, y, 36, roadVertex) : 0;
}

export function copperTerrainColor(x: number, y: number, z: number, slope: number): Color {
  if (copperCinderField(x, y) < 1.12) return Math.sin(x * 0.08 + y * 0.05) > 0 ? [0.25, 0.22, 0.24, 1] : [0.34, 0.27, 0.27, 1];
  if (copperSaltFlat(x, y) < 0.9 && slope < 0.25) return [0.86, 0.81, 0.68, 1];
  const layer = Math.floor((z + 2 * Math.sin(x * 0.008)) / 9) % 6;
  const strata: readonly Color[] = [[0.69, 0.31, 0.22, 1], [0.83, 0.46, 0.3, 1], [0.91, 0.65, 0.43, 1], [0.73, 0.47, 0.43, 1], [0.61, 0.39, 0.4, 1], [0.87, 0.66, 0.5, 1]];
  if ((slope > 0.42 && z > 32) || z > 100) return strata[Math.max(0, layer)];
  const greener = y < 1680 && Math.sin(x * 0.013 + y * 0.008) > 0.45;
  return greener ? [0.72, 0.64, 0.4, 1] : y > 1840 ? [0.79, 0.54, 0.35, 1] : [0.8, 0.65, 0.41, 1];
}
