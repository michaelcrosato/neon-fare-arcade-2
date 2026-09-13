import type { WorldPoint } from "../model";
import type { WorldRegionId, WorldTheme } from "../region-types";
import { ACTIVE_WORLD_REGIONS, containingRegionForPosition, regionForPosition, regionRoadBounds } from "../regions";

export type HorizonSetting = WorldTheme | "alpine" | "headlands" | "foothills" | "countryside" | "ocean" | "badlands";
export type HorizonTarget = { regionId: WorldRegionId | null; setting: HorizonSetting; distance: number };
type RGB = readonly [number, number, number];
export type HorizonColumn = { far: number; foreground: number; near: number; farColor: RGB; nearColor: RGB; target: HorizonTarget; ridge: HorizonTarget; distantCity: HorizonTarget | null };
export const HORIZON_COLUMNS = 720;
export const HORIZON_WIDTH = 2048;
export const HORIZON_HEIGHT = 1024;

const regions = ACTIVE_WORLD_REGIONS.map(region => ({ region, bounds: regionRoadBounds(region) }));
const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Slab intersection uses the registered rectangles, including the longer peninsula.
 * A corner touch is not a view into a region. Nothing here expands playable space. */
function rayRange(point: WorldPoint, dx: number, dy: number, bounds: ReturnType<typeof regionRoadBounds>) {
  let enter = -Infinity, exit = Infinity;
  for (const [value, direction, min, max] of [[point.x, dx, bounds.minX, bounds.maxX], [point.y, dy, bounds.minY, bounds.maxY]]) {
    if (Math.abs(direction) < 1e-8) {
      if (value <= min || value >= max) return null;
    } else {
      const a = (min - value) / direction, b = (max - value) / direction;
      enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    }
  }
  return exit > Math.max(0, enter) + 1 ? { enter: Math.max(0, enter), exit } : null;
}

/** Look beyond the current region along the actual world bearing, not a global
 * north/east/south/west picture. Nearer regions occlude more distant neighbors. */
export function horizonSightline(point: WorldPoint, bearing: number): HorizonTarget[] {
  const origin = containingRegionForPosition(point.x, point.y) ?? regionForPosition(point.x, point.y);
  const dx = Math.cos(bearing), dy = Math.sin(bearing);
  const hits: HorizonTarget[] = [];
  for (const { region, bounds } of regions) {
    if (region.id === origin.id) continue;
    const hit = rayRange(point, dx, dy, bounds);
    if (hit) hits.push({ regionId: region.id, setting: region.theme, distance: hit.enter });
  }
  if (hits.length) return hits.sort((a, b) => a.distance - b.distance);
  const edge = rayRange(point, dx, dy, regionRoadBounds(origin))?.exit ?? 0;
  const x = point.x + dx * (edge + 400), y = point.y + dy * (edge + 400);
  let setting: HorizonSetting;
  if (y < -2376) setting = "alpine";
  else if (y < -792) setting = x < -792 ? "headlands" : "foothills";
  else if (x < -2376 || (x > 792 && y > 792)) setting = "ocean";
  else if (x > 2376) setting = "countryside";
  else if (y > 2376) setting = "badlands";
  else setting = origin.theme === "industrial" ? "badlands" : "countryside";
  return [{ regionId: null, setting, distance: edge }];
}

export function horizonTarget(point: WorldPoint, bearing: number): HorizonTarget {
  return horizonSightline(point, bearing)[0];
}

type Palette = { far: RGB; near: RGB; height: number; base: number; seed: number };
const palettes: Record<HorizonSetting, Palette> = {
  city: { far: [137, 163, 172], near: [91, 136, 147], height: .034, base: .012, seed: 3 },
  residential: { far: [145, 171, 150], near: [109, 150, 126], height: .04, base: .023, seed: 5 },
  mountain: { far: [145, 167, 184], near: [95, 143, 147], height: .24, base: .06, seed: 7 },
  desert: { far: [198, 155, 137], near: [178, 129, 107], height: .12, base: .025, seed: 11 },
  wetland: { far: [166, 179, 178], near: [121, 163, 155], height: .016, base: .006, seed: 13 },
  coastal: { far: [176, 180, 160], near: [136, 161, 146], height: .053, base: .012, seed: 17 },
  industrial: { far: [162, 167, 171], near: [120, 143, 150], height: .025, base: .008, seed: 19 },
  alpine: { far: [158, 177, 193], near: [113, 153, 167], height: .22, base: .07, seed: 23 },
  headlands: { far: [154, 176, 179], near: [115, 156, 151], height: .14, base: .03, seed: 29 },
  foothills: { far: [156, 178, 161], near: [117, 155, 136], height: .095, base: .035, seed: 31 },
  countryside: { far: [165, 182, 156], near: [134, 166, 135], height: .045, base: .022, seed: 37 },
  ocean: { far: [166, 198, 204], near: [129, 178, 192], height: 0, base: 0, seed: 41 },
  badlands: { far: [197, 162, 145], near: [175, 140, 117], height: .11, base: .023, seed: 43 },
};

export function horizonNoise(bearing: number, cells: number, seed: number) {
  const position = ((bearing / TAU % 1 + 1) % 1) * cells;
  const i = Math.floor(position), t = position - i;
  const hash = (cell: number) => {
    const value = Math.sin((cell % cells + seed * 97) * 127.1) * 43758.5453;
    return value - Math.floor(value);
  };
  return hash(i) * (1 - t) + hash(i + 1) * t;
}

function ridgeHeight(target: HorizonTarget, bearing: number) {
  const palette = palettes[target.setting];
  let ridge = horizonNoise(bearing, 26, palette.seed);
  if (target.setting === "mountain" || target.setting === "alpine") ridge = .35 * ridge + .65 * horizonNoise(bearing, 57, palette.seed + 3);
  if (target.setting === "desert" || target.setting === "badlands") ridge = clamp((ridge - .2) * 2.2, 0, 1);
  return (palette.base + palette.height * ridge) * clamp(1800 / (target.distance + 1200), .25, 1.2);
}

/** Filled silhouettes cover every azimuth. Neighbor boundaries blend over a few
 * degrees, and the duplicated endpoint closes the west-facing texture seam. */
export function makeHorizonProfile(point: WorldPoint) {
  const region = containingRegionForPosition(point.x, point.y) ?? regionForPosition(point.x, point.y);
  const columns: HorizonColumn[] = [];
  for (let i = 0; i < HORIZON_COLUMNS; i++) {
    const bearing = -Math.PI + i / HORIZON_COLUMNS * TAU;
    let far = 0, foreground = 0, near = 0;
    const farColor: [number, number, number] = [0, 0, 0], nearColor: [number, number, number] = [0, 0, 0];
    for (const [offset, weight] of [[-.08, .12], [-.04, .22], [0, .32], [.04, .22], [.08, .12]]) {
      const sightline = horizonSightline(point, bearing + offset), target = sightline[0], palette = palettes[target.setting];
      const tallest = sightline.reduce((best, candidate) => ridgeHeight(candidate, bearing) > ridgeHeight(best, bearing) ? candidate : best);
      const farPalette = palettes[tallest.setting];
      const depth = clamp(1800 / (target.distance + 1200), .25, 1.2);
      far += ridgeHeight(tallest, bearing) * weight;
      foreground += ridgeHeight(target, bearing) * weight;
      near += (palette.base * .45 + palette.height * .23 * horizonNoise(bearing, 43, palette.seed + 1)) * depth * weight;
      for (let c = 0; c < 3; c++) {
        farColor[c] += farPalette.far[c] * weight;
        nearColor[c] += palette.near[c] * weight;
      }
    }
    const sightline = horizonSightline(point, bearing);
    const ridge = sightline.reduce((best, candidate) => ridgeHeight(candidate, bearing) > ridgeHeight(best, bearing) ? candidate : best);
    columns.push({ far, foreground, near, farColor, nearColor, target: sightline[0], ridge,
      distantCity: sightline.slice(1).find(target => target.setting === "city") ?? null });
  }
  // Smooth the color joins, not the mountain peaks. The periodic filter prevents
  // discrete neighbor samples becoming vertical bands on the painted ground.
  const colorColumns = columns.map(column => ({ far: column.farColor, near: column.nearColor }));
  for (let i = 0; i < HORIZON_COLUMNS; i++) {
    const far: [number, number, number] = [0, 0, 0], near: [number, number, number] = [0, 0, 0];
    for (let offset = -10; offset <= 10; offset++) {
      const sample = colorColumns[(i + offset + HORIZON_COLUMNS) % HORIZON_COLUMNS];
      const weight = (11 - Math.abs(offset)) / 121;
      for (let c = 0; c < 3; c++) { far[c] += sample.far[c] * weight; near[c] += sample.near[c] * weight; }
    }
    columns[i].farColor = far; columns[i].nearColor = near;
  }
  columns.push(columns[0]);
  return { regionId: region.id, columns };
}

/** Bound artwork rebuilds during travel without tying it to heading or zoom. */
export function horizonVantage(point: WorldPoint) {
  const region = containingRegionForPosition(point.x, point.y) ?? regionForPosition(point.x, point.y);
  const bounds = regionRoadBounds(region);
  const x = clamp(Math.round(point.x / 64) * 64, bounds.minX + 1, bounds.maxX - 1);
  const y = clamp(Math.round(point.y / 64) * 64, bounds.minY + 1, bounds.maxY - 1);
  return { x, y, regionId: region.id, key: `${region.id}:${x}:${y}` };
}
