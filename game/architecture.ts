import type { Color, MaterialId, MeshFace, Vec2, Vec3 } from "./model";
import { MAT_GENERIC, MAT_TIMBER, MAT_STONE, MAT_FOLIAGE } from "./config";

/** Renderer-neutral architectural faces. All builders use real, closed geometry. */
export function gabledRoof(x: number, y: number, z: number, width: number, depth: number,
  rise: number, color: Color, gable: Color): MeshFace[] {
  const nw = { x: x - width / 2, y: y - depth / 2, z };
  const ne = { x: x + width / 2, y: y - depth / 2, z };
  const se = { x: x + width / 2, y: y + depth / 2, z };
  const sw = { x: x - width / 2, y: y + depth / 2, z };
  const n = { x, y: y - depth / 2, z: z + rise }, s = { x, y: y + depth / 2, z: z + rise };
  return [
    { corners: [nw, n, s, sw], color, material: MAT_GENERIC, kind: "architecture" },
    { corners: [n, ne, se, s], color, material: MAT_GENERIC, kind: "architecture" },
    { corners: [ne, n, nw], color: gable, material: MAT_TIMBER, kind: "architecture" },
    { corners: [sw, s, se], color: gable, material: MAT_TIMBER, kind: "architecture" },
  ];
}

export function taperedSpire(center: Vec3, radius: number, height: number, color: Color,
  sides = 6, material: MaterialId = MAT_FOLIAGE, groundAnchor?: Vec2): MeshFace[] {
  const ring = Array.from({ length: sides }, (_, i) => ({ x: center.x + Math.cos(i * Math.PI * 2 / sides) * radius,
    y: center.y + Math.sin(i * Math.PI * 2 / sides) * radius, z: center.z }));
  return ring.map((a, i) => ({ corners: [a, ring[(i + 1) % sides], { ...center, z: center.z + height }],
    color, material, kind: "architecture", ...(groundAnchor ? { groundAnchor } : {}) }));
}

export function facetedBoulder(center: Vec3, sx: number, sy: number, height: number, color: Color): MeshFace[] {
  const lower = Array.from({ length: 5 }, (_, i) => ({ x: center.x + Math.cos(i * Math.PI * 0.4) * sx / 2,
    y: center.y + Math.sin(i * Math.PI * 0.4) * sy / 2, z: center.z }));
  const upper = lower.map((point, i) => ({ x: center.x + (point.x - center.x) * 0.63 + sx * 0.1,
    y: center.y + (point.y - center.y) * 0.68, z: center.z + height * (i % 2 ? 0.78 : 1) }));
  const faces: MeshFace[] = [];
  for (let i = 0; i < 5; i += 1) {
    const next = (i + 1) % 5;
    faces.push({ corners: [lower[i], lower[next], upper[next], upper[i]], color,
      material: MAT_STONE, kind: "architecture", groundAnchor: center });
    if (i > 0 && i < 4) faces.push({ corners: [upper[0], upper[i], upper[next]], color,
      material: MAT_STONE, kind: "architecture", groundAnchor: center });
  }
  return faces;
}

export function observatoryDome(center: Vec3, radius: number, color: Color): MeshFace[] {
  const faces: MeshFace[] = [];
  const sides = 12, rings = 4;
  const vertex = (ring: number, side: number): Vec3 => {
    const elevation = ring / rings * Math.PI / 2, angle = side / sides * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * Math.cos(elevation) * radius,
      y: center.y + Math.sin(angle) * Math.cos(elevation) * radius, z: center.z + Math.sin(elevation) * radius };
  };
  for (let ring = 0; ring < rings; ring += 1) for (let side = 0; side < sides; side += 1) {
    const a = vertex(ring, side), b = vertex(ring, side + 1), c = vertex(ring + 1, side + 1);
    faces.push({ corners: ring === rings - 1 ? [a, b, c] : [a, b, c, vertex(ring + 1, side)],
      color: side === 8 ? [0.06, 0.21, 0.26, 1] : color, material: MAT_GENERIC, kind: "architecture" });
  }
  return faces;
}
