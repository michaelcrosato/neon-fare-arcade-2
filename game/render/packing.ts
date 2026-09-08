import { MAT_GENERIC } from "../config";
import type { Box } from "../model";

export const INSTANCE_FLOATS = 16;
export const INSTANCE_BYTES = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const INSTANCE_FIELD_OFFSET_BYTES = {
  world: 0,
  scale: 4 * Float32Array.BYTES_PER_ELEMENT,
  tint: 8 * Float32Array.BYTES_PER_ELEMENT,
  orientation: 12 * Float32Array.BYTES_PER_ELEMENT,
} as const;
export const CAMERA_UNIFORM_FLOATS = 24;
export const CAMERA_UNIFORM_BYTES =
  CAMERA_UNIFORM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const ACTOR_INSTANCE_CAPACITY = 2048;
export const NAVIGATION_INSTANCE_CAPACITY = 32;
export const GHOST_INSTANCE_CAPACITY = 96;

export function cubeVertices() {
  const output: number[] = [];
  const face = (shade: number, points: number[][]) => {
    for (const index of [0, 1, 2, 0, 2, 3]) {
      output.push(points[index][0], points[index][1], points[index][2], shade);
    }
  };
  face(1, [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]);
  face(0.5, [[-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5]]);
  face(0.8, [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]]);
  face(0.62, [[-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5]]);
  face(0.72, [[0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5]]);
  face(0.58, [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]]);
  return new Float32Array(output);
}

export function packBoxes(boxes: Box[]) {
  const packed = new Float32Array(boxes.length * INSTANCE_FLOATS);
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    const offset = index * INSTANCE_FLOATS;
    // Write directly: one temporary JS array per rendered box is avoidable.
    packed[offset] = box.x;
    packed[offset + 1] = box.y;
    packed[offset + 2] = box.z;
    packed[offset + 3] = box.material ?? MAT_GENERIC;
    packed[offset + 4] = box.sx;
    packed[offset + 5] = box.sy;
    packed[offset + 6] = box.sz;
    packed[offset + 7] = box.yaw;
    packed[offset + 8] = box.color[0];
    packed[offset + 9] = box.color[1];
    packed[offset + 10] = box.color[2];
    packed[offset + 11] = box.color[3];
    packed[offset + 12] = box.pitch ?? 0;
    packed[offset + 13] = box.tilt ?? 0;
    // Reserved fields 14 and 15 are zero in the new Float32Array.
  }
  return packed;
}
