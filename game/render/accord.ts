import { INK, MAT_VEHICLE, RED, STEEL, WHITE } from "../config";
import { localPoint } from "../math";
import type { Box, Color, Game } from "../model";

type PointPose = (game: Game, forward: number, right: number, z: number) => { x: number; y: number; z: number };

/** Pre-facelift ninth-gen coupe: two long doors, swept glass, short rear deck. */
export function addAccordBoxes(boxes: Box[], game: Game, rollingPose: PointPose) {
  const sim = game.drivingModel === "simulation";
  const glass: Color = [0.17, 0.28, 0.34, 1];
  const pearl: Color = [0.91, 0.92, 0.89, 1];
  const scuff: Color = [0.54, 0.57, 0.55, 1];
  const body = (f: number, r: number, z: number, sx: number, sy: number, sz: number, color: Color, extra: Partial<Box> = {}) => {
    const point = sim ? rollingPose(game, f, r, z) : { ...localPoint(game.x, game.y, game.heading, f, r), z };
    boxes.push({ ...point, sx, sy, sz, yaw: game.heading, color, material: MAT_VEHICLE, ...extra,
      pitch: (sim ? game.simulationVehicle.bodyRoll : 0) + (extra.pitch ?? 0),
      tilt: (sim ? game.simulationVehicle.bodyPitch : 0) + (extra.tilt ?? 0) });
  };
  body(0, 0, 0.66, 4.84, 1.96, 0.65, pearl);
  body(1.44, 0, 1.04, 1.74, 1.84, 0.18, WHITE, { tilt: -0.045 });
  body(-1.8, 0, 1.05, 1.1, 1.83, 0.2, pearl);
  body(-0.24, 0, 1.37, 2.4, 1.67, 0.56, glass);
  body(-0.28, 0, 1.74, 1.3, 1.58, 0.12, WHITE);
  body(0.7, 0, 1.42, 0.1, 1.62, 0.79, glass, { tilt: -0.64 });
  body(-1.13, 0, 1.41, 0.1, 1.62, 0.78, glass, { tilt: 0.73 });
  for (const side of [-1, 1]) {
    // Only one door handle per side; narrow B-pillar and a raked C-pillar.
    body(0.72, side * 0.83, 1.44, 0.09, 0.1, 0.8, WHITE, { tilt: -0.64 });
    body(-1.14, side * 0.84, 1.4, 0.13, 0.12, 0.82, pearl, { tilt: 0.73 });
    body(-0.47, side * 0.852, 1.43, 0.07, 0.04, 0.5, INK);
    body(-0.5, side * 0.987, 0.82, 0.025, 0.018, 0.48, scuff);
    body(-0.35, side * 0.995, 1.02, 0.21, 0.06, 0.055, STEEL);
    body(0.7, side * 1.02, 1.21, 0.23, 0.23, 0.13, pearl);
    body(-0.05, side * 0.87, 1.12, 2.12, 0.045, 0.04, STEEL);
    body(-0.1, side * 0.99, 0.43, 2.4, 0.06, 0.08, scuff);
    body(2.35, side * 0.64, 0.94, 0.15, 0.53, 0.16, WHITE, { yaw: game.heading + side * 0.16 });
    body(-2.39, side * 0.67, 1.0, 0.12, 0.48, 0.17, RED);
    body(-2.17, side * 0.946, 1.0, 0.36, 0.06, 0.17, RED);
    body(2.27, side * 0.74, 0.58, 0.15, 0.22, 0.12, INK);
    body(-2.32, side * 0.66, 0.35, 0.26, 0.18, 0.15, STEEL);
  }
  body(2.42, 0, 0.87, 0.08, 0.78, 0.18, INK);
  body(2.45, 0, 1.0, 0.07, 0.84, 0.04, STEEL);
  // Silver H emblem, paired exhaust, low lip and rear license plate.
  for (const side of [-0.047, 0.047]) body(2.467, side, 0.9, 0.015, 0.018, 0.1, STEEL);
  body(2.468, 0, 0.9, 0.016, 0.09, 0.018, STEEL);
  body(-2.44, 0, 0.75, 0.06, 0.48, 0.16, WHITE);
  body(2.25, 0, 0.4, 0.22, 1.85, 0.09, INK);
  for (const f of [-1.48, 1.4]) for (const side of [-1, 1]) {
    const yaw = game.heading + (f > 0 ? game.steering * 0.48 : 0);
    body(f, side * 0.98, 0.43, 0.76, 0.26, 0.77, INK, { yaw });
    body(f, side * 1.12, 0.43, 0.42, 0.035, 0.43, STEEL, { yaw });
    // Chunky winter tread shoulders distinguish this car's financed rubber.
    for (const offset of [-0.19, 0.19]) body(f + offset, side * 1.12, 0.43, 0.045, 0.05, 0.57, scuff, { yaw });
  }
  // Four small supplier plaques, each with its own color/monogram treatment.
  const badges: readonly Color[] = [[0.93, 0.35, 0.1, 1], RED, [0.67, 0.33, 0.73, 1], STEEL];
  badges.forEach((color, index) => {
    const f = -1.76 + (index % 2) * 0.32, z = 0.83 + Math.floor(index / 2) * 0.16;
    body(f, -0.996, z, 0.25, 0.025, 0.105, color);
    body(f, -1.012, z, 0.16, 0.014, 0.022, WHITE);
  });
  // A cared-for car: a few small chips, not a wreck.
  body(2.43, 0.32, 0.61, 0.016, 0.26, 0.024, scuff);
  body(-2.42, -0.78, 0.65, 0.018, 0.18, 0.032, scuff);
}
