import type { Vec3 } from "../model";
import { terrainHeightAt } from "./surface";
import { copperCinderField, copperSaltFlat } from "./copper-forms";

let cached: ReturnType<typeof createTopography> | null = null;
let copperCached: ReturnType<typeof createTopography> | null = null;
function createTopography(copper = false) {
  const bands = new Map<number, string>(), fills: { x: number; y: number; color: string }[] = [];
  const vertex = (x: number, y: number): Vec3 => ({ x, y, z: terrainHeightAt(x, y) });
  for (let x = -792; x < 792; x += 72) for (let y = copper ? 792 : -2376; y < (copper ? 2376 : -792); y += 72) {
    const a = vertex(x, y), b = vertex(x + 72, y), c = vertex(x + 72, y + 72), d = vertex(x, y + 72);
    const mean = (a.z + b.z + c.z + d.z) / 4;
    const desertColor = copperCinderField(x + 36, y + 36) < 1.1 ? "#605451" : copperSaltFlat(x + 36, y + 36) < 0.9 ? "#d3c5a4"
      : mean > 130 ? "#dba374" : mean > 95 ? "#b47b68" : mean > 65 ? "#9b5e4a" : mean > 30 ? "#987446" : "#b79861";
    fills.push({ x, y, color: copper ? desertColor : mean > 165 ? "#c1d4d1" : mean > 130 ? "#839c94" : mean > 85 ? "#587765" : mean > 40 ? "#365c48" : "#214537" });
    for (const triangle of [[a, b, c], [a, c, d]]) {
      for (let level = copper ? 12 : 24; level <= (copper ? 216 : 360); level += copper ? 12 : 24) {
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

export function copperTopography() {
  copperCached ??= createTopography(true);
  return copperCached;
}
