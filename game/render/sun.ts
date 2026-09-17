import type { Camera, Game } from "../model";
import { mat4Multiply, lookAt, orthoZO } from "./camera";
import { viewProjection } from "./view-projection";

/**
 * One authoritative sun direction for every backend.
 *
 * WebGPU, WebGL, the software rasterizer and the Canvas lighting helpers all
 * previously hard-coded this vector separately; a change to one silently
 * desynchronized the others.
 */
const RAW_SUN = [0.64, 0.22, 0.74] as const;
const SUN_LENGTH = Math.hypot(RAW_SUN[0], RAW_SUN[1], RAW_SUN[2]);

/** Unit vector pointing from the world toward the sun. */
export const SUN_DIRECTION = [
  RAW_SUN[0] / SUN_LENGTH,
  RAW_SUN[1] / SUN_LENGTH,
  RAW_SUN[2] / SUN_LENGTH,
] as const;

/** Shadow cascade split distances, as fractions of the shadowed range. */
export type CascadeSplit = { near: number; far: number };

/**
 * Practical split scheme: blend the uniform and logarithmic distributions so
 * near cascades stay dense without starving the far one.
 */
export function cascadeSplits(count: number, near: number, far: number, lambda = 0.72): CascadeSplit[] {
  const splits: CascadeSplit[] = [];
  let previous = near;
  for (let index = 1; index <= count; index += 1) {
    const ratio = index / count;
    const uniform = near + (far - near) * ratio;
    const logarithmic = near * Math.pow(far / near, ratio);
    const distance = lambda * logarithmic + (1 - lambda) * uniform;
    splits.push({ near: previous, far: distance });
    // Overlap slightly so a receiver near a boundary samples valid depth in
    // whichever cascade the fragment shader selects.
    previous = previous + (distance - previous) * 0.96;
  }
  return splits;
}

function invert(matrix: Float32Array) {
  const m = matrix;
  const inv = new Float32Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15]
    + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15]
    - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15]
    + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14]
    - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15]
    - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15]
    + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15]
    - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14]
    + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15]
    + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15]
    - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15]
    + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14]
    - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11]
    - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11]
    + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11]
    - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10]
    + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  const determinant = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (!determinant) return null;
  const scale = 1 / determinant;
  for (let index = 0; index < 16; index += 1) inv[index] *= scale;
  return inv;
}

/** World-space corners of the clip cube, in the depth-zero-to-one convention. */
export function frustumCorners(inverseViewProjection: Float32Array) {
  const corners: Array<[number, number, number]> = [];
  for (const z of [0, 1]) {
    for (const y of [-1, 1]) {
      for (const x of [-1, 1]) {
        const w = inverseViewProjection[3] * x + inverseViewProjection[7] * y
          + inverseViewProjection[11] * z + inverseViewProjection[15];
        const inverseW = w === 0 ? 0 : 1 / w;
        corners.push([
          (inverseViewProjection[0] * x + inverseViewProjection[4] * y
            + inverseViewProjection[8] * z + inverseViewProjection[12]) * inverseW,
          (inverseViewProjection[1] * x + inverseViewProjection[5] * y
            + inverseViewProjection[9] * z + inverseViewProjection[13]) * inverseW,
          (inverseViewProjection[2] * x + inverseViewProjection[6] * y
            + inverseViewProjection[10] * z + inverseViewProjection[14]) * inverseW,
        ]);
      }
    }
  }
  return corners;
}

export type ShadowCascade = {
  /** World-to-light clip matrix for this slice. */
  matrix: Float32Array;
  /** View-space distance where this cascade stops being authoritative. */
  far: number;
  /** World units covered by one shadow texel; drives the receiver bias. */
  texelWorldSize: number;
};

/**
 * Build one stable orthographic light matrix per cascade.
 *
 * The slice is bounded by its own sphere rather than its corner box, so the
 * covered area cannot change as the player turns, and the light-space origin is
 * snapped to whole texels so a moving camera cannot make shadow edges crawl.
 */
export function shadowCascades(
  game: Game,
  camera: Camera,
  aspect: number,
  drawDistance: number,
  count: number,
  mapSize: number,
  shadowDistance = Math.min(drawDistance, 260),
): ShadowCascade[] {
  if (count < 1) return [];
  const near = camera.mode === "cab" ? 0.08 : 0.15;
  const splits = cascadeSplits(count, Math.max(near, shadowDistance / 60), shadowDistance);
  const cascades: ShadowCascade[] = [];
  for (const split of splits) {
    const sliceMatrix = viewProjection(game, camera, aspect, split.far, split.near);
    const inverse = invert(sliceMatrix);
    if (!inverse) continue;
    const corners = frustumCorners(inverse);
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    for (const [x, y, z] of corners) {
      centerX += x;
      centerY += y;
      centerZ += z;
    }
    centerX /= corners.length;
    centerY /= corners.length;
    centerZ /= corners.length;
    let radius = 0;
    for (const [x, y, z] of corners) {
      radius = Math.max(radius, Math.hypot(x - centerX, y - centerY, z - centerZ));
    }
    // Round the radius so floating point jitter in the frustum corners cannot
    // resize the projection every frame.
    radius = Math.ceil(radius * 16) / 16;
    const texelWorldSize = (radius * 2) / mapSize;
    // Enough headroom above the slice for City towers and Copper ridges to
    // still be inside the light frustum and cast into it.
    const headroom = radius + 200;
    const eye: [number, number, number] = [
      centerX + SUN_DIRECTION[0] * headroom,
      centerY + SUN_DIRECTION[1] * headroom,
      centerZ + SUN_DIRECTION[2] * headroom,
    ];
    const view = lookAt(eye, [centerX, centerY, centerZ], [0, 0, 1]);
    // Snap the light-space center to the shadow texel grid.
    const lightX = view[0] * centerX + view[4] * centerY + view[8] * centerZ + view[12];
    const lightY = view[1] * centerX + view[5] * centerY + view[9] * centerZ + view[13];
    const offsetX = Math.round(lightX / texelWorldSize) * texelWorldSize - lightX;
    const offsetY = Math.round(lightY / texelWorldSize) * texelWorldSize - lightY;
    const projection = orthoZO(
      -radius + offsetX,
      radius + offsetX,
      -radius + offsetY,
      radius + offsetY,
      0.1,
      radius * 2 + 400,
    );
    cascades.push({
      matrix: mat4Multiply(projection, view),
      far: split.far,
      texelWorldSize,
    });
  }
  return cascades;
}
