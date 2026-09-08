import { INK, MAT_VEHICLE } from "../config";
import type { Box, Color } from "../model";

// Same world-space light direction as the current WebGPU scene shader.
const SUN_LENGTH = Math.hypot(0.64, 0.22, 0.74);
const SUN = [0.64 / SUN_LENGTH, 0.22 / SUN_LENGTH, 0.74 / SUN_LENGTH] as const;

/** A short graphic shadow, clamped for the comic overhead view. */
export function groundShadowOffset(height: number, maxReach = 1.1) {
  const reach = Math.min(maxReach, Math.max(0, height) * Math.hypot(SUN[0], SUN[1]) / SUN[2]);
  const length = Math.hypot(SUN[0], SUN[1]);
  return { x: -SUN[0] / length * reach, y: -SUN[1] / length * reach };
}

/** Flat ground geometry: never inherit the taxi's body roll or pitch. */
export function vehicleGroundShadow(x: number, y: number, yaw: number, sx: number, sy: number): Box {
  const offset = groundShadowOffset(0.45, 0.45);
  return { x: x + offset.x, y: y + offset.y, z: 0.13, sx, sy, sz: 0.12, yaw, color: INK, material: MAT_VEHICLE };
}

/** Warm direct light and cool fill, without channel quantization or a black floor. */
export function litSurfaceColor(color: Color, nx: number, ny: number, nz: number): Color {
  const direct = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2]);
  const fill = 0.7 + Math.max(0, nz) * 0.12;
  const key = Math.round(direct * 4) / 4 * 0.25;
  return [
    Math.min(1, color[0] * (fill * 0.96 + key * 1.07)),
    Math.min(1, color[1] * (fill + key * 1.01)),
    Math.min(1, color[2] * (fill * 1.06 + key * 0.9)),
    color[3],
  ];
}

export function litBoxTopColor(box: Box) {
  const roll = box.pitch ?? 0;
  const pitch = box.tilt ?? 0;
  const nx = Math.sin(pitch) * Math.cos(roll);
  const ny = -Math.sin(roll);
  return litSurfaceColor(box.color,
    Math.cos(box.yaw) * nx - Math.sin(box.yaw) * ny,
    Math.sin(box.yaw) * nx + Math.cos(box.yaw) * ny,
    Math.cos(pitch) * Math.cos(roll));
}
