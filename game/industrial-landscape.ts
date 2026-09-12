import type { Box, CityChunk, Collider, Color, LotContext, MeshFace, SurfaceRegion } from "./model";
import { MAT_GENERIC, MAT_WATER } from "./config";
import { IRONWAKE_ANCHORS, IRONWAKE_BOUNDS, IRONWAKE_SHORE_STEP, ironwakeWaterIntervalsAt } from "./industrial-layout";
import { WORKS } from "./industrial-assets";
import { buildIndustrialLot } from "./industrial";
import { blockRandom } from "./random";
import { boxSurfaceFaces } from "./render/surfaces";
import { terrainHeightAt } from "./terrain/surface";
import { ironwakeTerrainColor } from "./terrain/industrial-forms";

function rectangle(left: number, top: number, right: number, bottom: number, color: Color, water = false): MeshFace {
  const vertex = (x: number, y: number) => ({ x, y, z: water ? .3 : terrainHeightAt(x, y) });
  return { corners: [vertex(left, top), vertex(right, top), vertex(right, bottom), vertex(left, bottom)],
    material: water ? MAT_WATER : MAT_GENERIC, color, kind: "terrain" };
}

/** The water footprint is shared by the map, streamed sea, walking and vehicle collisions. */
export function addIndustrialWater(surfaces: MeshFace[], colliders: Collider[], regions: SurfaceRegion[], left: number, top: number) {
  const strips: { left: number; right: number; top: number; bottom: number }[] = [];
  for (let y = top; y < top + 144; y += IRONWAKE_SHORE_STEP) {
    for (const interval of ironwakeWaterIntervalsAt(y + IRONWAKE_SHORE_STEP / 2)) {
      const a = Math.max(left, interval.min), b = Math.min(left + 144, interval.max);
      if (b <= a) continue;
      const last = strips.find(s => s.left === a && s.right === b && s.bottom === y);
      if (last) last.bottom += IRONWAKE_SHORE_STEP;
      else strips.push({ left: a, right: b, top: y, bottom: y + IRONWAKE_SHORE_STEP });
    }
  }
  for (const strip of strips) {
    const id = `ironwake-water:${left}:${top}:${regions.length}`, x = (strip.left + strip.right) / 2, y = (strip.top + strip.bottom) / 2;
    surfaces.push(rectangle(strip.left, strip.top, strip.right, strip.bottom, WORKS.water, true));
    regions.push({ id, kind: "water", x, y, halfX: (strip.right - strip.left) / 2, halfY: (strip.bottom - strip.top) / 2, yaw: 0 });
    colliders.push({ id, x, y, halfX: (strip.right - strip.left) / 2, halfY: (strip.bottom - strip.top) / 2, baseZ: -4, height: 5.3 });
    for (const edge of [strip.left, strip.right]) {
      if (edge <= left || edge >= left + 144) continue;
      surfaces.push({ corners: [{ x: edge, y: strip.top, z: -2 }, { x: edge, y: strip.bottom, z: -2 },
        { x: edge, y: strip.bottom, z: .48 }, { x: edge, y: strip.top, z: .48 }], color: WORKS.concrete, material: MAT_GENERIC, kind: "architecture" });
      surfaces.push({ corners: [{ x: edge - .3, y: strip.top, z: .5 }, { x: edge + .3, y: strip.top, z: .5 },
        { x: edge + .3, y: strip.bottom, z: .5 }, { x: edge - .3, y: strip.bottom, z: .5 }], color: WORKS.amber, material: MAT_GENERIC, kind: "architecture" });
    }
  }
}

const groundCache = new Map<string, MeshFace[]>();
let skyline: Map<string, MeshFace[]> | null = null;

function distantGround(cx: number, cy: number) {
  const key = `${cx},${cy}`, cached = groundCache.get(key);
  if (cached) return cached;
  const left = cx * 144 - 72, top = cy * 144 - 72, faces: MeshFace[] = [];
  for (let y = top; y < top + 144; y += IRONWAKE_SHORE_STEP) {
    let cursor = left;
    for (const interval of ironwakeWaterIntervalsAt(y + IRONWAKE_SHORE_STEP / 2)) {
      const a = Math.max(left, interval.min), b = Math.min(left + 144, interval.max);
      if (b <= a) continue;
      if (a > cursor) faces.push(rectangle(cursor, y, a, y + IRONWAKE_SHORE_STEP, ironwakeTerrainColor(cursor, y)));
      faces.push(rectangle(a, y, b, y + IRONWAKE_SHORE_STEP, WORKS.water, true));
      cursor = b;
    }
    if (cursor < left + 144) faces.push(rectangle(cursor, y, left + 144, y + IRONWAKE_SHORE_STEP, ironwakeTerrainColor(cursor, y)));
  }
  groundCache.set(key, faces);
  return faces;
}

/** Simplified real architecture stays on the horizon, then gives way to its owning chunk. */
export function industrialLandscape(chunks: readonly CityChunk[]) {
  if (!skyline) {
    skyline = new Map();
    for (const a of IRONWAKE_ANCHORS) for (let dx = 0; dx < a.width; dx++) for (let dy = 0; dy < a.height; dy++) {
      const bx = a.originX + dx, by = a.originY + dy, x = bx * 36 + 18, y = by * 36 + 18;
      const boxes: Box[] = [], surfaces: MeshFace[] = [];
      const ctx: LotContext = { boxes, surfaces, colliders: [], surfaceRegions: [], blockX: bx, blockY: by,
        centerX: x, centerY: y, random: blockRandom(bx, by, 0x1a90) };
      buildIndustrialLot(ctx, a.lot);
      const height = terrainHeightAt(x, y);
      const faces = boxes.filter(box => box.z + box.sz / 2 >= 16 && Math.min(box.sx, box.sy) >= .7)
        .flatMap(box => boxSurfaceFaces({ ...box, z: box.z + height }));
      faces.push(...surfaces.filter(face => face.corners.some(p => p.z >= 16)).map(face => ({ ...face,
        corners: face.corners.map(p => ({ ...p, z: p.z + height })) as unknown as MeshFace["corners"] })));
      const key = `${Math.floor((bx + 2) / 4)},${Math.floor((by + 2) / 4)}`;
      skyline.set(key, [...(skyline.get(key) ?? []), ...faces]);
    }
  }
  const loaded = new Set(chunks.map(chunk => `${chunk.cx},${chunk.cy}`)), faces: MeshFace[] = [];
  for (let cx = -16; cx <= -6; cx++) for (let cy = 6; cy <= 16; cy++) {
    const key = `${cx},${cy}`;
    if (loaded.has(key)) continue;
    faces.push(...distantGround(cx, cy), ...(skyline.get(key) ?? []));
  }
  faces.push(rectangle(-4392, IRONWAKE_BOUNDS.minY, IRONWAKE_BOUNDS.minX, 3960, WORKS.water, true));
  return faces;
}
