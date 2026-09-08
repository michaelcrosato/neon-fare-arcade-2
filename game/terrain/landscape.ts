import type { CityChunk, MeshFace, Vec3 } from "../model";
import { MAT_GRASS, MAT_SNOW, MAT_STONE, MAT_ROAD, ROAD } from "../config";
import { SPECIAL_ROAD_SEGMENTS, compiledSpecialRoad } from "../road-network";
import { terrainHeightAt } from "./surface";
import { roadStripQuad } from "../render/surfaces";

const cache = new Map<string, MeshFace[]>();

/** Distant terrain shares fine boundary vertices with streamed play geometry. */
function distantChunk(cx: number, cy: number) {
  const key = `${cx},${cy}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const faces: MeshFace[] = [];
  const vertex = (x: number, y: number): Vec3 => ({ x, y, z: terrainHeightAt(x, y) });
  const left = cx * 144 - 72, top = cy * 144 - 72;
  for (let ix = 0; ix < 4; ix += 1) for (let iy = 0; iy < 4; iy += 1) {
    const x = left + ix * 36, y = top + iy * 36;
    const corners = [vertex(x, y), vertex(x + 36, y), vertex(x + 36, y + 36), vertex(x, y + 36)];
    const center = vertex(x + 18, y + 18), ring: Vec3[] = [];
    for (let side = 0; side < 4; side += 1) {
      const a = corners[side], b = corners[(side + 1) % 4];
      const divisions = (side === 0 && iy === 0) || (side === 1 && ix === 3) || (side === 2 && iy === 3) || (side === 3 && ix === 0) ? 4 : 1;
      for (let i = 0; i < divisions; i += 1) ring.push(vertex(a.x + (b.x - a.x) * i / divisions, a.y + (b.y - a.y) * i / divisions));
    }
    const slope = (Math.max(...corners.map((p) => p.z)) - Math.min(...corners.map((p) => p.z))) / 36;
    const snow = center.z > 165 && slope < 0.9, rock = slope > 0.5 || center.z > 145;
    for (let i = 0; i < ring.length; i += 1) faces.push({ corners: [center, ring[i], ring[(i + 1) % ring.length]],
      color: snow ? [0.87, 0.92, 0.94, 1] : rock ? [0.39, 0.43, 0.43, 1] : [0.2, 0.34, 0.24, 1],
      material: snow ? MAT_SNOW : rock ? MAT_STONE : MAT_GRASS, kind: "terrain" });
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
  for (let cx = -5; cx <= 5; cx += 1) for (let cy = -16; cy <= -6; cy += 1) {
    if (!loaded.has(`${cx},${cy}`)) faces.push(...distantChunk(cx, cy));
  }
  return faces;
}
