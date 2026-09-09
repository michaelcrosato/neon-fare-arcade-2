import type { CityChunk, Collider, Color, MeshFace, SurfaceRegion } from "./model";
import { CHUNK_SIZE, MAT_GRASS, MAT_SIDEWALK, MAT_WATER } from "./config";
import { REACH_BOUNDS, REACH_SHORE_STEP, REACH_WATER_Z, reachLandIntervalsAt, reachShoreAt } from "./reach-layout";
import { REACH_BAY, REACH_IVORY, REACH_LAWN, REACH_OCEAN, REACH_SAND } from "./reach-assets";
import { reachDistantBuildings } from "./reach-distant";

function quad(left: number, top: number, right: number, bottom: number, z: number, color: Color, water = false): MeshFace {
  return { corners: [{ x: left, y: top, z }, { x: right, y: top, z }, { x: right, y: bottom, z }, { x: left, y: bottom, z }],
    color, material: water ? MAT_WATER : MAT_GRASS, kind: "terrain" };
}

export function addReachGround(surfaces: MeshFace[], colliders: Collider[], surfaceRegions: SurfaceRegion[], originX: number, originY: number) {
  const right = originX + CHUNK_SIZE, bottom = originY + CHUNK_SIZE;
  const water = (left: number, top: number, end: number, base: number, tone: Color) => {
    if (end - left < .01 || base - top < .01) return;
    const id = `wetland-water-shore:${originX}:${originY}:${surfaceRegions.length}`;
    surfaces.push(quad(left, top, end, base, REACH_WATER_Z, tone, true));
    surfaceRegions.push({ id, kind: "water", x: (left + end) / 2, y: (top + base) / 2,
      halfX: (end - left) / 2, halfY: (base - top) / 2, yaw: 0 });
    colliders.push({ id, x: (left + end) / 2, y: (top + base) / 2, halfX: (end - left) / 2,
      halfY: (base - top) / 2, baseZ: -4, height: 5.2 });
  };
  const hasLand = Array.from({ length: CHUNK_SIZE / REACH_SHORE_STEP }, (_, row) => originY + row * REACH_SHORE_STEP)
    .some(y => reachLandIntervalsAt(y).some(interval => interval.max > originX && interval.min < right));
  if (!hasLand) {
    water(originX, originY, right, bottom, right <= reachShoreAt(originY + 72).west ? REACH_BAY : REACH_OCEAN);
    return;
  }
  for (let top = originY; top < bottom; top += REACH_SHORE_STEP) {
    const endY = top + REACH_SHORE_STEP;
    const shore = reachShoreAt(top + REACH_SHORE_STEP / 2);
    let cursor = originX;
    const intervals = reachLandIntervalsAt(top).map(interval => ({ min: Math.max(originX, interval.min), max: Math.min(right, interval.max) }))
      .filter(interval => interval.max > interval.min);
    for (const interval of intervals) {
      water(cursor, top, interval.min, endY, REACH_BAY);
      surfaces.push(quad(interval.min, top, interval.max, endY, 0, REACH_SAND));
      const lawnLeft = Math.max(interval.min, shore.west + 15), lawnRight = Math.min(interval.max, shore.east - 62);
      if (lawnRight > lawnLeft) surfaces.push(quad(lawnLeft, top, lawnRight, endY, .025, REACH_LAWN));
      const walkLeft = Math.max(interval.min, shore.east - 66), walkRight = Math.min(interval.max, shore.east - 59);
      if (walkRight > walkLeft) surfaces.push({ ...quad(walkLeft, top, walkRight, endY, .08, REACH_IVORY), material: MAT_SIDEWALK });
      cursor = interval.max;
    }
    water(cursor, top, right, endY, cursor >= shore.east ? REACH_OCEAN : REACH_BAY);
  }
}

const distantCache = new Map<string, MeshFace[]>();
function distantPatch(cx: number, cy: number) {
  const key = `${cx},${cy}`;
  const cached = distantCache.get(key);
  if (cached) return cached;
  const faces: MeshFace[] = [], left = cx * 144 - 72, top = cy * 144 - 72;
  for (let row = top; row < top + 144; row += 18) {
    const shore = reachShoreAt(row + 9);
    const intervals = reachLandIntervalsAt(row + 9).map(interval => ({ min: Math.max(left, interval.min), max: Math.min(left + 144, interval.max) }))
      .filter(interval => interval.max > interval.min);
    let cursor = left;
    for (const interval of intervals) {
      if (interval.min > cursor) faces.push(quad(cursor, row, interval.min, row + 18, REACH_WATER_Z, REACH_BAY, true));
      faces.push(quad(interval.min, row, interval.max, row + 18, 0, REACH_LAWN));
      const beach = Math.max(interval.min, shore.east - 60);
      if (interval.max > beach) faces.push(quad(beach, row, interval.max, row + 18, .025, REACH_SAND));
      cursor = interval.max;
    }
    if (cursor < left + 144) faces.push(quad(cursor, row, left + 144, row + 18, REACH_WATER_Z,
      cursor >= shore.east ? REACH_OCEAN : REACH_BAY, true));
  }
  distantCache.set(key, faces);
  return faces;
}

let horizon: MeshFace[] | null = null;
export function reachLandscape(chunks: readonly CityChunk[]) {
  const loaded = new Set(chunks.map(chunk => `${chunk.cx},${chunk.cy}`));
  const faces: MeshFace[] = [];
  for (let cx = 6; cx <= 16; cx += 1) for (let cy = 6; cy <= 23; cy += 1) {
    if (!loaded.has(`${cx},${cy}`)) faces.push(...distantPatch(cx, cy));
  }
  horizon ??= [
    quad(REACH_BOUNDS.maxX, 792, 4104, 4392, REACH_WATER_Z, REACH_OCEAN, true),
    quad(792, REACH_BOUNDS.maxY, REACH_BOUNDS.maxX, 4392, REACH_WATER_Z, REACH_OCEAN, true),
    quad(-216, 2376, 792, 4392, REACH_WATER_Z, REACH_BAY, true),
  ];
  return faces.concat(horizon, reachDistantBuildings(loaded));
}
