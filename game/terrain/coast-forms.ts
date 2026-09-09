import type { Color, WorldPoint } from "../model";
import { triangularHeight } from "./northstar-forms";

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const near = (value: number, line: number) => Math.abs(value - line) < 0.02;
const within = (value: number, a: number, b: number) => value >= a - 0.02 && value <= b + 0.02;

export function inCoastTerrain(x: number, y: number) {
  return x >= -2376 && x < -792 && y >= -792 && y <= 792;
}

/** Small beach-town blocks and destination service lanes; hills have no lattice. */
export function coastGridStreetEnabled({ x, y }: WorldPoint, axis: "vertical" | "horizontal") {
  if (x < -2016 - 0.02) return false;
  if (axis === "vertical" && near(x, -792)) return true;
  if (within(x, -1908, -1548) && within(y, -144, 288)) return true;
  if (within(x, -936, -792) && within(y, -72, 144)) return true;
  if (axis === "vertical") {
    return (near(x, -1260) && within(y, -684, -612))
      || (near(x, -1764) && within(y, -336, -252))
      || (near(x, -1944) && within(y, 180, 324))
      || (near(x, -1908) && within(y, 324, 504))
      || (near(x, -1764) && within(y, 324, 504))
      || (near(x, -1548) && within(y, 360, 468))
      || (near(x, -1368) && within(y, 360, 468))
      || (near(x, -828) && within(y, 504, 648));
  }
  return (near(y, -612) && within(x, -2016, -1908))
    || (near(y, -648) && within(x, -1368, -1224))
    || (near(y, -288) && within(x, -1908, -1764))
    || (near(y, 180) && within(x, -2016, -1836))
    || (near(y, 216) && within(x, -1980, -1836))
    || (near(y, 360) && (within(x, -1908, -1620) || within(x, -1620, -1368)))
    || (near(y, 432) && within(x, -2016, -1368))
    || (near(y, 468) && within(x, -1548, -1368))
    || (near(y, 504) && within(x, -1908, -1764))
    || (near(y, 576) && within(x, -864, -792));
}

export const COAST_TERRACES = [
  { id: "pier", minX: -2340, maxX: -2052, minY: -36, maxY: 0, height: 0, feather: 24 },
  { id: "gate", minX: -936, maxX: -828, minY: 36, maxY: 144, height: 3, feather: 64 },
  { id: "mission", minX: -1674, maxX: -1530, minY: 54, maxY: 162, height: 14, feather: 90 },
  { id: "aquarium", minX: -1962, maxX: -1854, minY: 180, maxY: 306, height: 5, feather: 64 },
  { id: "club", minX: -1890, maxX: -1782, minY: -306, maxY: -198, height: 18, feather: 64 },
  { id: "studio", minX: -1530, maxX: -1386, minY: 342, maxY: 450, height: 12, feather: 80 },
  { id: "citrus", minX: -1350, maxX: -1242, minY: -666, maxY: -558, height: 72, feather: 130 },
  { id: "surf", minX: -1998, maxX: -1890, minY: 414, maxY: 486, height: 2, feather: 50 },
  { id: "bowl", minX: -1746, maxX: -1638, minY: 342, maxY: 450, height: 9, feather: 70 },
  { id: "rescue", minX: -1998, maxX: -1926, minY: -630, maxY: -558, height: 7, feather: 70 },
  { id: "town", minX: -1926, maxX: -1530, minY: -162, maxY: 198, height: 12, feather: 90 },
  { id: "canals", minX: -1926, maxX: -1764, minY: 306, maxY: 522, height: 4, feather: 36 },
] as const;

function terraceHeight(x: number, y: number, value: number) {
  let height = value, total = 1;
  for (const pad of COAST_TERRACES) {
    const distance = Math.hypot(Math.max(pad.minX - x, 0, x - pad.maxX), Math.max(pad.minY - y, 0, y - pad.maxY));
    if (distance === 0) return pad.height;
    const influence = 1 - smooth(distance / pad.feather);
    const weight = influence / Math.max(1e-10, 1 - influence);
    height += pad.height * weight;
    total += weight;
  }
  return height / total;
}

const hill = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
const seam = (x: number) => smooth((-792 - x) / 144);
const beach = (x: number) => smooth((x + 2052) / 72);

export function coastNaturalHeight(x: number, y: number) {
  return inCoastTerrain(x, y) ? coastBackdropHeight(x, y) : 0;
}

/** Ocean-side cliffs, dry rounded hills, and a real canyon around the climb. */
export function coastBackdropHeight(x: number, y: number) {
  const bluff = 22 * smooth((x + 1978 + 12 * Math.sin(y / 90)) / 64)
    * (1 - smooth((y + 160) / 200));
  const peaks = 86 * hill(x, y, -1380, -610, 270, 235)
    + 39 * hill(x, y, -1740, -510, 175, 205)
    + 44 * hill(x, y, -1116, -360, 140, 240)
    + 24 * hill(x, y, -1260, 550, 260, 220);
  const canyonX = -1140 - 90 * Math.sin((y + 120) / 150);
  const canyon = 23 * (1 - smooth(Math.abs(x - canyonX) / 74)) * hill(x, y, -1150, -230, 280, 245);
  const folds = (2.5 * Math.sin(x / 21 + y / 37) + 1.8 * Math.cos(y / 17)) * smooth((-y - 160) / 220);
  const value = (2 + bluff + peaks - canyon + folds) * beach(x);
  return Math.max(0, terraceHeight(x, y, value)) * seam(x);
}

const roadVertices = new Map<string, number>();
function roadVertex(x: number, y: number) {
  const key = `${x},${y}`;
  let height = roadVertices.get(key);
  if (height === undefined) {
    const value = (2 + 10 * smooth((x + 1998) / 240)
      + 60 * hill(x, y, -1350, -625, 325, 285)
      + 25 * hill(x, y, -1740, -500, 220, 235)
      + 13 * hill(x, y, -1180, 560, 290, 240)) * beach(x);
    height = inCoastTerrain(x, y) ? terraceHeight(x, y, value) * seam(x) : 0;
    roadVertices.set(key, height);
  }
  return height;
}

export function coastRoadHeight(x: number, y: number) {
  return inCoastTerrain(x, y) ? triangularHeight(x, y, 36, roadVertex) : 0;
}

export function coastTerrainColor(x: number, y: number, z: number, slope: number): Color {
  if (x < -2016) return [0.94, 0.82, 0.57, 1];
  if (slope > 0.4) return Math.floor(z / 7) % 2 ? [0.73, 0.61, 0.43, 1] : [0.87, 0.75, 0.55, 1];
  if (y < -180 && z > 20) return Math.sin(x / 43 + y / 31) > 0
    ? [0.62, 0.65, 0.4, 1] : [0.76, 0.71, 0.47, 1];
  return [0.79, 0.77, 0.56, 1];
}
