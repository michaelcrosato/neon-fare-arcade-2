import type { Vec3 } from "../model";

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
  if (x < -250 || x > 450 || y < -1944 || y > -1700) return null;
  let nearest: { distance: number; height: number } | null = null;
  for (let i = 1; i < MIRROR_SPILLWAY.length; i += 1) {
    const a = MIRROR_SPILLWAY[i - 1], b = MIRROR_SPILLWAY[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    const distance = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (!nearest || distance < nearest.distance) nearest = { distance, height: a.z + (b.z - a.z) * t };
  }
  return nearest;
}
