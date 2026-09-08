import type { Vec3 } from "../model";
import { copperCanyonWaterHeight, copperCanyonY } from "./copper-forms";

export const COPPER_RIVER: readonly Vec3[] = Array.from({ length: 79 }, (_, i) => {
  const x = -792 + i * 18;
  return { x, y: copperCanyonY(x), z: copperCanyonWaterHeight(x) };
});

/** Mirror Lake drains through a cascade into Spruce Gorge. Heights are authored water levels. */
export const MIRROR_SPILLWAY: readonly Vec3[] = [
  { x: 432, y: -1908, z: 82.32 }, { x: 324, y: -1908, z: 82.32 },
  { x: 288, y: -1910, z: 82.32 }, { x: 266, y: -1914, z: 61 },
  { x: 234, y: -1912, z: 52 }, { x: 210, y: -1890, z: 45 },
  { x: 152, y: -1836, z: 38 }, { x: 72, y: -1818, z: 23 },
  { x: -72, y: -1818, z: 12 }, { x: -180, y: -1782, z: 0.45 },
  { x: -222, y: -1728, z: 0.45 },
];

export function watercourseAt(x: number, y: number) {
  const copper = x >= -792 && x <= 612 && Math.abs(y - copperCanyonY(x)) < 40;
  if (!copper && (x < -250 || x > 450 || y < -1944 || y > -1700)) return null;
  const points = copper ? COPPER_RIVER : MIRROR_SPILLWAY;
  let nearest: { distance: number; height: number } | null = null;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    const distance = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (!nearest || distance < nearest.distance) nearest = { distance, height: a.z + (b.z - a.z) * t };
  }
  return nearest;
}
