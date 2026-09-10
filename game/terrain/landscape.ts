import { cityTerrainColor, inCityTerrain } from "./city-forms";
import type { CityChunk, MeshFace, Vec3 } from "../model";
import { MAT_BUILDING, MAT_GRASS, MAT_SNOW, MAT_STONE, MAT_ROAD, MAT_SANDSTONE, MAT_WATER, ROAD } from "../config";
import { SPECIAL_ROAD_SEGMENTS, compiledSpecialRoad } from "../road-network";
import { terrainHeightAt } from "./surface";
import { roadStripQuad } from "../render/surfaces";
import { copperBackdropHeight, copperTerrainColor, inCopperTerrain } from "./copper-forms";
import { coastBackdropHeight, coastTerrainColor, inCoastTerrain } from "./coast-forms";
import { coastShoreXAt } from "../coastal-layout";

const cache = new Map<string, MeshFace[]>();

/** Distant terrain shares fine boundary vertices with streamed play geometry. */
function distantChunk(cx: number, cy: number, fineEdges = 15) {
  const key = `${cx},${cy}:${fineEdges}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const faces: MeshFace[] = [];
  const city = inCityTerrain(cx * 144, cy * 144);
  const vertex = (x: number, y: number): Vec3 => ({ x, y, z: terrainHeightAt(x, y) });
  const left = cx * 144 - 72, top = cy * 144 - 72;
  for (let ix = 0; ix < 4; ix += 1) for (let iy = 0; iy < 4; iy += 1) {
    const x = left + ix * 36, y = top + iy * 36;
    const corners = [vertex(x, y), vertex(x + 36, y), vertex(x + 36, y + 36), vertex(x, y + 36)];
    const center = vertex(x + 18, y + 18), ring: Vec3[] = [];
    for (let side = 0; side < 4; side += 1) {
      const a = corners[side], b = corners[(side + 1) % 4];
      const boundary = (side === 0 && iy === 0) || (side === 1 && ix === 3) || (side === 2 && iy === 3) || (side === 3 && ix === 0);
      const divisions = boundary && (fineEdges & (1 << side)) ? (city ? 6 : 4) : 1;
      for (let i = 0; i < divisions; i += 1) ring.push(vertex(a.x + (b.x - a.x) * i / divisions, a.y + (b.y - a.y) * i / divisions));
    }
    const slope = (Math.max(...corners.map((p) => p.z)) - Math.min(...corners.map((p) => p.z))) / 36;
    const snow = center.z > 165 && slope < 0.9, rock = slope > 0.5 || center.z > 145;
    const copper = inCopperTerrain(center.x, center.y);
    const coast = inCoastTerrain(center.x, center.y);
    const patches: MeshFace["corners"][] = city && ring.length === 4
      ? [corners as unknown as MeshFace["corners"]]
      : ring.map((point, i) => [center, point, ring[(i + 1) % ring.length]]);
    for (const patch of patches) faces.push({ corners: patch,
      color: city ? cityTerrainColor(center.x, center.y, center.z, slope) : coast ? coastTerrainColor(center.x, center.y, center.z, slope) : copper ? copperTerrainColor(center.x, center.y, center.z, slope) : snow ? [0.87, 0.92, 0.94, 1] : rock ? [0.39, 0.43, 0.43, 1] : [0.2, 0.34, 0.24, 1],
      material: copper ? MAT_SANDSTONE : snow ? MAT_SNOW : rock ? MAT_STONE : MAT_GRASS, kind: "terrain" });
  }
  if (inCoastTerrain(left + 72, top + 72)) {
    for (let y = top; y < top + 144; y += 9) {
      const right = Math.min(left + 144, coastShoreXAt(y + 4.5));
      if (right > left) faces.push({ corners: [{ x: left, y, z: 0.22 }, { x: right, y, z: 0.22 },
        { x: right, y: y + 9, z: 0.22 }, { x: left, y: y + 9, z: 0.22 }], color: [0.035, 0.45, 0.66, 1], material: MAT_WATER, kind: "terrain" });
    }
  }
  for (const segment of SPECIAL_ROAD_SEGMENTS) {
    const x = (segment.a.x + segment.b.x) / 2, y = (segment.a.y + segment.b.y) / 2;
    if (Math.floor((x + 72) / 144) !== cx || Math.floor((y + 72) / 144) !== cy) continue;
    const road = compiledSpecialRoad(segment.pathId)!;
    faces.push(roadStripQuad(road.sections[segment.index], road.sections[segment.index + 1],
      -segment.halfWidth, segment.halfWidth, 0.64, ROAD, MAT_ROAD));
  }
  cache.set(key, faces);
  return faces;
}

export function northstarLandscape(chunks: readonly CityChunk[]): MeshFace[] {
  const loaded = new Set(chunks.map((chunk) => chunk.key)), faces: MeshFace[] = [];
  const cityBoundary = chunks.some(chunk => inCityTerrain(chunk.cx * 144, chunk.cy * 144));
  for (let cx = -5; cx <= 5; cx += 1) for (let cy = -16; cy <= -6; cy += 1) {
    if (!loaded.has(`${cx},${cy}`)) faces.push(...distantChunk(cx, cy, cityBoundary ? loadedEdgeMask(loaded, cx, cy) : 15));
  }
  return faces;
}

export function copperLandscape(chunks: readonly CityChunk[]): MeshFace[] {
  const loaded = new Set(chunks.map((chunk) => chunk.key)), faces: MeshFace[] = [];
  const cityBoundary = chunks.some(chunk => inCityTerrain(chunk.cx * 144, chunk.cy * 144));
  for (let cx = -5; cx <= 5; cx += 1) for (let cy = 6; cy <= 16; cy += 1) {
    if (!loaded.has(`${cx},${cy}`)) faces.push(...distantChunk(cx, cy, cityBoundary ? loadedEdgeMask(loaded, cx, cy) : 15));
  }
  return faces.concat(copperHorizon());
}

export function coastLandscape(chunks: readonly CityChunk[]): MeshFace[] {
  const loaded = new Set(chunks.map((chunk) => chunk.key)), faces: MeshFace[] = [];
  const cityBoundary = chunks.some(chunk => inCityTerrain(chunk.cx * 144, chunk.cy * 144));
  for (let cx = -16; cx <= -6; cx += 1) for (let cy = -5; cy <= 5; cy += 1) {
    if (!loaded.has(`${cx},${cy}`)) faces.push(...distantChunk(cx, cy, cityBoundary ? loadedEdgeMask(loaded, cx, cy) : 15));
  }
  return faces.concat(coastHorizon());
}

let coastHorizonCache: MeshFace[] | null = null;
function coastHorizon(): MeshFace[] {
  if (coastHorizonCache) return coastHorizonCache;
  const faces: MeshFace[] = [];
  // The ocean extends beyond the active cell; it adds no roads or playable land.
  faces.push({ corners: [{ x: -5200, y: -2600, z: 0.2 }, { x: -2376, y: -2600, z: 0.2 },
    { x: -2376, y: 2600, z: 0.2 }, { x: -5200, y: 2600, z: 0.2 }],
    color: [0.035, 0.41, 0.61, 1], material: MAT_WATER, kind: "terrain" });
  for (const side of [-1, 1]) for (let layer = 0; layer < 3; layer += 1) {
    for (let x = -2376; x < -792; x += 9) {
      const y = side < 0 ? -792 - (layer + 1) * 144 : 792 + layer * 144;
      const vertex = (px: number, py: number): Vec3 => ({ x: px, y: py, z: Math.abs(py) <= 792
        ? terrainHeightAt(px, py) : coastBackdropHeight(px, py) });
      const corners = [vertex(x, y), vertex(x + 9, y), vertex(x + 9, y + 144), vertex(x, y + 144)] as const;
      faces.push({ corners, color: coastTerrainColor(x, y, corners[0].z, 0), material: MAT_GRASS, kind: "terrain" });
      const right = Math.min(x + 9, coastShoreXAt(y));
      if (right > x) faces.push({ corners: [{ x, y, z: 0.22 }, { x: right, y, z: 0.22 },
        { x: right, y: y + 144, z: 0.22 }, { x, y: y + 144, z: 0.22 }], color: [0.035, 0.45, 0.66, 1], material: MAT_WATER, kind: "terrain" });
    }
  }
  coastHorizonCache = faces;
  return faces;
}

let copperHorizonCache: MeshFace[] | null = null;
function copperHorizon(): MeshFace[] {
  if (copperHorizonCache) return copperHorizonCache;
  const faces: MeshFace[] = [];
  const vertex = (x: number, y: number): Vec3 => ({ x, y,
    z: x >= -792 && x <= 792 && y <= 2376 ? terrainHeightAt(x, y) : copperBackdropHeight(x, y) });
  const patch = (left: number, top: number, width: number, depth: number) => {
    const corners = [vertex(left, top), vertex(left + width, top), vertex(left + width, top + depth), vertex(left, top + depth)] as const;
    const z = corners.reduce((total, p) => total + p.z, 0) / 4;
    faces.push({ corners, color: copperTerrainColor(left + width / 2, top + depth / 2, z, 0), material: MAT_SANDSTONE, kind: "terrain" });
  };
  // Fine shared boundary vertices avoid cracks without loading unplayable chunks.
  for (let layer = 0; layer < 4; layer += 1) {
    for (let y = 792; y < 2376; y += 9) patch(-792 - (layer + 1) * 144, y, 144, 9);
    for (let x = -792; x < 792; x += 9) patch(x, 2376 + layer * 144, 9, 144);
    for (let row = 0; row < 4; row += 1) patch(-792 - (layer + 1) * 144, 2376 + row * 144, 144, 144);
  }
  copperHorizonCache = faces;
  return faces;
}

const citySkylineCache = new Map<string, MeshFace[]>();
function loadedEdgeMask(loaded: ReadonlySet<string>, cx: number, cy: number) {
  return (loaded.has(`${cx},${cy - 1}`) ? 1 : 0) | (loaded.has(`${cx + 1},${cy}`) ? 2 : 0)
    | (loaded.has(`${cx},${cy + 1}`) ? 4 : 0) | (loaded.has(`${cx - 1},${cy}`) ? 8 : 0);
}
export function cityLandscape(chunks: readonly CityChunk[], generate: (cx: number, cy: number) => CityChunk): MeshFace[] {
  const loaded = new Set(chunks.map(chunk => chunk.key)), faces: MeshFace[] = [];
  for (let cx = -5; cx <= 5; cx += 1) for (let cy = -5; cy <= 5; cy += 1) {
    const key = `${cx},${cy}`;
    if (loaded.has(key)) continue;
    const fineEdges = loadedEdgeMask(loaded, cx, cy);
    faces.push(...distantChunk(cx, cy, fineEdges));
    let skyline = citySkylineCache.get(key);
    if (!skyline) {
      skyline = [];
      // Simplify the actual tallest structures, preserving their position, shape and altitude.
      const source = generate(cx, cy);
      const buildings = source.boxes.filter(box => box.material === MAT_BUILDING && box.sx >= 7 && box.sy >= 7 && box.sz >= 7)
        .sort((a, b) => b.z + b.sz / 2 - a.z - a.sz / 2).slice(0, 4);
      for (const box of buildings) {
        const vertex = (dx: number, dy: number, dz: number): Vec3 => ({
          x: box.x + dx * box.sx / 2 * Math.cos(box.yaw) - dy * box.sy / 2 * Math.sin(box.yaw),
          y: box.y + dx * box.sx / 2 * Math.sin(box.yaw) + dy * box.sy / 2 * Math.cos(box.yaw), z: box.z + dz * box.sz / 2 });
        const lower = [vertex(-1, -1, -1), vertex(1, -1, -1), vertex(1, 1, -1), vertex(-1, 1, -1)];
        const upper = [vertex(-1, -1, 1), vertex(1, -1, 1), vertex(1, 1, 1), vertex(-1, 1, 1)];
        skyline.push({ corners: upper as unknown as MeshFace["corners"], color: box.color, material: MAT_BUILDING, kind: "architecture" });
        for (let i = 0; i < 4; i += 1) skyline.push({ corners: [lower[i], lower[(i + 1) % 4], upper[(i + 1) % 4], upper[i]],
          color: box.color, material: MAT_BUILDING, kind: "architecture" });
      }
      const crowns = (source.surfaces ?? []).filter(face => face.kind === "architecture" && !face.groundAnchor
        && face.corners.every(point => point.z > terrainHeightAt(point.x, point.y) + 5));
      skyline.push(...crowns.slice(0, 20));
      citySkylineCache.set(key, skyline);
    }
    faces.push(...skyline);
  }
  return faces;
}
