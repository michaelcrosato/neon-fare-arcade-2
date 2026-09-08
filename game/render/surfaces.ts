import type { Box, Color, MaterialId, MeshFace, SurfaceQuad, Vec3 } from "../model";
import { MAT_GENERIC } from "../config";
import type { RoadSection } from "../roads/geometry";

// The road mesh replaces 36-vertex cuboids with six-vertex surface patches.
// Keep this budget independent of the unchanged building/actor instance budget.
export const MAX_CHUNK_SURFACE_QUADS = 2_048;
export const MAX_STREAM_SURFACE_QUADS = 65_536;
export const SURFACE_VERTEX_FLOATS = 12;
export const SURFACE_VERTEX_BYTES = SURFACE_VERTEX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const SURFACE_VERTICES_PER_QUAD = 6;

/** Full cuboid geometry for renderers that consume faces instead of instances. */
export function boxSurfaceFaces(box: Box): MeshFace[] {
  const cr = Math.cos(box.pitch ?? 0), sr = Math.sin(box.pitch ?? 0);
  const cp = Math.cos(box.tilt ?? 0), sp = Math.sin(box.tilt ?? 0);
  const cy = Math.cos(box.yaw), sy = Math.sin(box.yaw);
  const points = [-1, 1].flatMap((z) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
    const rx = x * box.sx / 2;
    const ry = cr * y * box.sy / 2 - sr * z * box.sz / 2;
    const rz = sr * y * box.sy / 2 + cr * z * box.sz / 2;
    const px = cp * rx + sp * rz, pz = -sp * rx + cp * rz;
    return { x: box.x + cy * px - sy * ry, y: box.y + sy * px + cy * ry, z: box.z + pz };
  }));
  return [[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    .map(([a, b, c, d]) => ({ corners: [points[a], points[b], points[c], points[d]],
      color: box.color, material: box.material ?? MAT_GENERIC, kind: "architecture" }));
}

export function roadStripQuad(
  a: RoadSection,
  b: RoadSection,
  left: number,
  right: number,
  height: number,
  color: Color,
  material: MaterialId,
  endLeft = left,
  endRight = right,
): SurfaceQuad {
  const point = (section: RoadSection, offset: number): Vec3 => ({
    x: section.center.x + section.lateral.x * offset,
    y: section.center.y + section.lateral.y * offset,
    z: section.center.z + section.lateral.z * offset + height,
  });
  return { corners: [point(a, left), point(b, endLeft), point(b, endRight), point(a, right)], color, material };
}

/** CPU/GPU vertex contract: xyz/material, normal xyz/face light, RGBA. */
export function packSurfaceQuads(quads: readonly MeshFace[]) {
  if (quads.length > MAX_STREAM_SURFACE_QUADS) throw new Error("Road surface vertex budget exceeded");
  const vertexCount = quads.reduce((sum, face) => sum + (face.corners.length === 3 ? 3 : 6), 0);
  const output = new Float32Array(vertexCount * SURFACE_VERTEX_FLOATS);
  let offset = 0;
  for (const quad of quads) {
    for (const triangle of quad.corners.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]]) {
      const [a, b, c] = triangle.map((index) => quad.corners[index]!);
      const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const normal = { x: ab.y * ac.z - ab.z * ac.y, y: ab.z * ac.x - ab.x * ac.z, z: ab.x * ac.y - ab.y * ac.x };
      const length = Math.hypot(normal.x, normal.y, normal.z);
      if (!Number.isFinite(length) || length < 1e-8) throw new Error("Degenerate road surface triangle");
      for (const index of triangle) {
        const point = quad.corners[index]!;
        output[offset++] = point.x;
        output[offset++] = point.y;
        output[offset++] = point.z;
        output[offset++] = quad.material;
        output[offset++] = normal.x / length;
        output[offset++] = normal.y / length;
        output[offset++] = normal.z / length;
        output[offset++] = 1;
        output[offset++] = quad.color[0];
        output[offset++] = quad.color[1];
        output[offset++] = quad.color[2];
        output[offset++] = quad.color[3];
      }
    }
  }
  return output;
}
