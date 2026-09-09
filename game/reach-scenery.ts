import { MAT_GENERIC, MAT_LAMP, MAT_WATER, MAT_WINDOW } from "./config";
import type { Box, Color, MaterialId, Vec2 } from "./model";
import { REACH_CYAN, REACH_GLASS, REACH_IVORY, REACH_NEON, REACH_SHELL } from "./reach-assets";
import { reachShoreAt } from "./reach-layout";

/** A bounded, deterministic waterfront layer. Boats stay beyond the solid shore. */
export function reachAnimatedBoxes(seconds: number, focus: Vec2): Box[] {
  if (focus.x < 760 || focus.y < 760 || focus.x > 2410 || focus.y > 3420) return [];
  const boxes: Box[] = [];
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number,
    color: Color, yaw = 0, material: MaterialId = MAT_GENERIC) => boxes.push({ x, y, z, sx, sy, sz, color, yaw, material });
  // Narrow surf lines travel toward the Atlantic beach, following its real curve.
  const firstRow = Math.max(828, Math.floor((focus.y - 220) / 36) * 36);
  for (let y = firstRow; y < Math.min(3270, focus.y + 300); y += 36) {
    const shore = reachShoreAt(y), travel = (seconds * 2.4 + y * .13) % 24;
    const x = shore.east + 3 + travel;
    if (Math.abs(x - focus.x) > 350) continue;
    const yaw = -Math.atan2(reachShoreAt(y + 9).east - reachShoreAt(y - 9).east, 18);
    box(x, y, -.08, .3 + travel * .035, 29, .08, [.75, .94, .87, 1], yaw, MAT_WATER);
  }
  for (let boat = 0; boat < 5; boat++) {
    const y = 1530 + boat * 310 + Math.sin(seconds * .018 + boat) * 60;
    const x = reachShoreAt(y).west - 90 - boat % 2 * 55 + Math.sin(seconds * .015 + boat * 2) * 16;
    if (Math.hypot(focus.x - x, focus.y - y) > 650) continue;
    const yaw = Math.sin(seconds * .014 + boat) * .12, z = .35 + Math.sin(seconds * 1.4 + boat) * .1;
    box(x, y, z, 4.1, 12, .9, boat % 2 ? REACH_SHELL : REACH_IVORY, yaw);
    box(x, y + 5.6, z + .08, 2.7, 3.8, .65, REACH_IVORY, yaw + .24);
    box(x, y - 1.5, z + 1.2, 3.7, 5.3, 1.5, REACH_GLASS, yaw, MAT_WINDOW);
    box(x, y - 1.5, z + 2, 4, 5.8, .25, REACH_IVORY, yaw);
    box(x, y - 10, -.07, 5.6, 6.5, .08, [.6, .86, .8, 1], yaw, MAT_WATER);
  }
  // Seabirds circle the cape and marina, with opposing wing angles at each beat.
  for (let bird = 0; bird < 7; bird++) {
    const angle = seconds * (.07 + bird * .004) + bird * .9;
    const x = 1668 + Math.cos(angle) * (55 + bird * 12), y = 2880 + bird * 54 + Math.sin(angle) * 50;
    if (Math.hypot(focus.x - x, focus.y - y) > 360) continue;
    const z = 21 + bird * 2 + Math.sin(seconds * .7 + bird) * 2;
    for (const side of [-1, 1]) box(x + side * .8, y, z + Math.sin(seconds * 3 + bird) * .3,
      1.9, .32, .12, REACH_IVORY, angle + side * .32);
  }
  if (Math.hypot(focus.x - 1674, focus.y - 3150) < 650) {
    const angle = seconds * .24;
    for (let ray = 1; ray <= 7; ray++) box(1674 + Math.cos(angle) * ray * 5, 3150 + Math.sin(angle) * ray * 5,
      34, 5.1, .18 + ray * .12, .16, ray % 2 ? REACH_CYAN : REACH_IVORY, angle, MAT_LAMP);
  }
  // The radio mast's signal lamps pulse without changing its collision silhouette.
  if (Math.hypot(focus.x - 1710, focus.y - 1530) < 400) box(1710, 1532, 51.7,
    .7, .7, .7, Math.sin(seconds * 4) > 0 ? REACH_NEON : REACH_IVORY, 0, MAT_LAMP);
  return boxes;
}
