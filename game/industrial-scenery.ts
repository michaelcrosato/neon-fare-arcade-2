import type { Box, Color, WorldPoint } from "./model";
import { MAT_GENERIC, MAT_LAMP, MAT_VEHICLE, MAT_WINDOW } from "./config";
import { WORKS, worksBeam } from "./industrial-assets";

/** Small deterministic loops bring the working port to life without moving collision geometry. */
export function industrialAnimatedBoxes(seconds: number, eye: WorldPoint) {
  const boxes: Box[] = [];
  const near = (x: number, y: number) => Math.hypot(x - eye.x, y - eye.y) < 560;
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color,
    material: Box["material"] = MAT_GENERIC, yaw = 0) => boxes.push({ x, y, z, sx, sy, sz, yaw, color, material });
  for (const stack of [{ x: -1342, y: 1106, z: 68 }, { x: -1306, y: 1106, z: 68 }]) {
    if (!near(stack.x, stack.y)) continue;
    for (let i = 0; i < 6; i++) {
      const age = ((seconds * .11 + i / 6) % 1), size = 3 + age * 7;
      box(stack.x + age * 24, stack.y + age * 7, stack.z + 2 + age * 30, size, size * .8, size * .7,
        [.53, .55, .52, .55 * (1 - age)], MAT_GENERIC, i * .7 + age);
    }
  }
  for (const x of [-1278, -1206]) {
    const y = 1638;
    if (!near(x, y)) continue;
    const pulse = Math.sin(seconds * 11 + x) * .5 + .5;
    box(x, y, 68 + pulse, 2.1 + pulse, 2.1, 4 + pulse * 2, WORKS.orange, MAT_LAMP, seconds * .3);
    box(x + .4, y, 69 + pulse * 2, .9, 1, 3.5, WORKS.amber, MAT_LAMP, -.2);
    box(x + .8, y, 71.5 + pulse, .5, .65, 1.8, WORKS.cream, MAT_LAMP, .4);
  }
  for (const x of [-2178, -2034]) {
    const y = 1334 + Math.sin(seconds * .09 + x) * 11;
    if (!near(x, y)) continue;
    const z = 24 + Math.sin(seconds * .18 + x) * 6;
    for (const side of [-1, 1]) box(x + side * 2, y, (40 + z) / 2, .12, .12, 40 - z, WORKS.dark);
    box(x, y, z - 1.6, 5.5, 12, 3.6, WORKS.orange);
    box(x, y, z + .35, 6, 12.5, .4, WORKS.amber);
  }
  const magnet = { x: -1208, y: 2060 };
  if (near(magnet.x, magnet.y)) {
    const z = 14 + Math.sin(seconds * .3) * 4;
    boxes.push(worksBeam({ ...magnet, z: 28 }, { ...magnet, z }, .16, WORKS.dark));
    box(magnet.x, magnet.y, z, 4.4, 4.4, 1, WORKS.dark, MAT_GENERIC, seconds * .1);
    box(magnet.x, magnet.y, z - 1.1, 4.8, 2.4, 1.1, WORKS.rust, MAT_VEHICLE, seconds * .1);
  }
  const tugX = -2298 + Math.sin(seconds * .023) * 20, tugY = 1770 + Math.sin(seconds * .014) * 155;
  if (near(tugX, tugY)) {
    const bob = Math.sin(seconds * 1.4) * .12;
    box(tugX, tugY, 1.1 + bob, 9, 19, 2.4, WORKS.rust, MAT_VEHICLE);
    box(tugX, tugY - 3, 3.8 + bob, 7, 7, 3.5, WORKS.cream);
    box(tugX, tugY - 3, 5.3 + bob, 7.2, 7.2, 1.2, WORKS.glass, MAT_WINDOW);
    box(tugX, tugY - 3, 6.1 + bob, 8, 8, .5, WORKS.cream);
    box(tugX + 2, tugY + 3, 4.4 + bob, 1.5, 1.5, 4, WORKS.dark);
    for (const side of [-1, 1]) for (const dy of [-6, 1, 7]) box(tugX + side * 4.5, tugY + dy, 1.3, .8, 1.8, 1.8, WORKS.dark);
  }
  return boxes;
}
