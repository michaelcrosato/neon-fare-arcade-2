import { CYAN, INK, MAT_VEHICLE, ORANGE, RED, STEEL, TOW_SECONDS, WHITE } from "../config";
import { clamp, localPoint } from "../math";
import type { Box, Color, Game } from "../model";
import { roadLanePose } from "../road-lanes";
import { placeBoxesOnRoad } from "./road-pose";

/** A short, non-colliding roadside-service departure shared by every renderer. */
export function towTruckBoxes(game: Game, seconds = 0): Box[] {
  const tow = game.towRecovery;
  if (!tow || game.elapsed - tow.startedAt >= TOW_SECONDS || tow.path.length < 2) return [];
  const age = Math.max(0, game.elapsed - tow.startedAt);
  let remaining = 9 + age * 9 + age * age * 2;
  let index = 1;
  for (; index < tow.path.length - 1; index++) {
    const a = tow.path[index - 1], b = tow.path[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= length) break;
    remaining -= length;
  }
  const a = tow.path[index - 1], b = tow.path[index];
  const t = clamp(remaining / Math.max(.01, Math.hypot(b.x - a.x, b.y - a.y)), 0, 1);
  const pose = roadLanePose({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t }, Math.atan2(b.y - a.y, b.x - a.x));
  const alpha = clamp((TOW_SECONDS - age) / .5, 0, 1);
  const boxes: Box[] = [];
  const add = (forward: number, right: number, z: number, sx: number, sy: number, sz: number, color: Color, tilt = 0) => {
    const point = localPoint(pose.x, pose.y, pose.heading, forward, right);
    boxes.push({ ...point, z, sx, sy, sz, yaw: pose.heading, tilt, color: [color[0], color[1], color[2], color[3] * alpha], material: MAT_VEHICLE });
  };
  add(0, 0, .07, 6.8, 2.9, .06, [0, 0, 0, .3]);
  add(0, 0, .64, 6.1, 2.6, .55, INK);
  add(-1.1, 0, 1.02, 3.7, 2.5, .48, RED);
  add(1.45, 0, 1.5, 2.3, 2.5, 1.25, RED);
  add(2.75, 0, 1.04, .55, 2.4, .48, RED);
  add(2.61, 0, 1.8, .07, 2.05, .59, CYAN);
  add(1.45, 0, 2.16, 2.45, 2.58, .15, RED);
  add(-1.2, 0, 1.3, 3.5, 1.85, .12, STEEL);
  for (const side of [-1, 1]) {
    add(1.42, side * 1.26, 1.8, 1.6, .06, .58, CYAN);
    add(.9, side * 1.3, 1.14, .7, .06, .32, WHITE);
    add(-1.35, side * 1.28, 1.07, 2.9, .08, .14, WHITE);
    for (const axle of [-2.2, -.95, 1.9]) add(axle, side * 1.3, .54, .9, .3, .92, INK);
    add(2.98, side * .86, 1.05, .07, .48, .28, WHITE);
  }
  add(-.45, 0, 1.9, .35, .75, 1.35, STEEL);
  add(-1.18, 0, 2.38, 2.65, .28, .3, STEEL, .44);
  add(-2.48, 0, 2.1, .12, .14, .98, INK);
  add(-2.3, 0, 1.65, .48, .2, .17, STEEL);
  add(1.3, 0, 2.34, 1.0, 1.65, .19, INK);
  add(1.3, 0, 2.53, .65, 1.32, .22, Math.sin(seconds * 10) > 0 ? WHITE : ORANGE);
  placeBoxesOnRoad(boxes, 0, pose);
  return boxes;
}
