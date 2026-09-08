import type { Vec3 } from "../model";
import { terrainHeightAt } from "./surface";

let cached: ReturnType<typeof createTopography> | null = null;
function createTopography() {
  const bands = new Map<number, string>(), fills: { x: number; y: number; color: string }[] = [];
  const vertex = (x: number, y: number): Vec3 => ({ x, y, z: terrainHeightAt(x, y) });
  for (let x = -792; x < 792; x += 72) for (let y = -2376; y < -792; y += 72) {
    const a = vertex(x, y), b = vertex(x + 72, y), c = vertex(x + 72, y + 72), d = vertex(x, y + 72);
    const mean = (a.z + b.z + c.z + d.z) / 4;
    fills.push({ x, y, color: mean > 165 ? "#c1d4d1" : mean > 130 ? "#839c94" : mean > 85 ? "#587765" : mean > 40 ? "#365c48" : "#214537" });
    for (const triangle of [[a, b, c], [a, c, d]]) {
      for (let level = 24; level <= 360; level += 24) {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 3; i += 1) {
          const first = triangle[i], second = triangle[(i + 1) % 3];
          if ((first.z <= level && second.z > level) || (second.z <= level && first.z > level)) {
            const t = (level - first.z) / (second.z - first.z);
            points.push({ x: first.x + (second.x - first.x) * t, y: first.y + (second.y - first.y) * t });
          }
        }
        if (points.length === 2) bands.set(level, (bands.get(level) ?? "")
          + `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}L${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`);
      }
    }
  }
  return { fills, contours: [...bands].map(([height, path]) => ({ height, path })) };
}

export function northstarTopography() {
  cached ??= createTopography();
  return cached;
}
