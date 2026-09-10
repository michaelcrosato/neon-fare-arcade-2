import type { Vec3 } from "../model";

export type ClipVertex = { x: number; y: number; z: number; w: number };

export function clipVertex(matrix: Float32Array, point: Vec3): ClipVertex {
  const { x, y, z } = point;
  return {
    x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    w: matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15],
  };
}

function planeDistance(v: ClipVertex, plane: number) {
  switch (plane) {
    case 0: return v.x + v.w;
    case 1: return v.w - v.x;
    case 2: return v.y + v.w;
    case 3: return v.w - v.y;
    case 4: return v.z;
    case 5: return v.w - v.z;
    default: return v.w - 1e-6;
  }
}

/** Clip before dividing by W: a road crossing the eye must not fill the screen. */
export function clipPolygon(vertices: ClipVertex[]): ClipVertex[] {
  let polygon = vertices;
  for (let plane = 0; plane < 7 && polygon.length; plane++) {
    const distances = polygon.map(vertex => planeDistance(vertex, plane));
    if (distances.every(distance => distance >= 0)) continue;
    if (distances.every(distance => distance < 0)) return [];
    const next: ClipVertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const da = distances[i], db = distances[(i + 1) % polygon.length];
      if (da >= 0) next.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        next.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t, w: a.w + (b.w - a.w) * t });
      }
    }
    polygon = next;
  }
  return polygon;
}

/** Conservative sphere/frustum culling before expanding a cuboid's six faces. */
export function sphereInView(matrix: Float32Array, x: number, y: number, z: number, radius: number) {
  for (let plane = 0; plane < 6; plane++) {
    const row = Math.floor(plane / 2);
    const sign = plane % 2 === 0 ? 1 : -1;
    const near = plane === 4;
    const a = (near ? 0 : matrix[3]) + matrix[row] * sign;
    const b = (near ? 0 : matrix[7]) + matrix[4 + row] * sign;
    const c = (near ? 0 : matrix[11]) + matrix[8 + row] * sign;
    const d = (near ? 0 : matrix[15]) + matrix[12 + row] * sign;
    if (a * x + b * y + c * z + d < -radius * Math.hypot(a, b, c)) return false;
  }
  return true;
}
