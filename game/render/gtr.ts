import { MAT_VEHICLE } from "../config";
import type { Color, MeshFace, Vec3 } from "../model";
import type { VehicleSurfaceModel } from "./accord";
import { boxSurfaceFaces } from "./surfaces";

const BLACK: Color = [.045, .052, .065, 1], EDGE: Color = [.13, .15, .18, 1];
const INK: Color = [.018, .022, .03, 1], GLASS: Color = [.085, .19, .23, 1];
const ALLOY: Color = [.39, .43, .48, 1], RED: Color = [.96, .045, .035, 1], WHITE: Color = [.92, .96, 1, 1];
const p = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const face = (corners: MeshFace["corners"], color: Color): MeshFace => ({ corners, color, material: MAT_VEHICLE, kind: "architecture" });
function box(out: MeshFace[], x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color) {
  out.push(...boxSurfaceFaces({ x, y, z, sx, sy, sz, color, yaw: 0, material: MAT_VEHICLE }));
}

/** R35 coupe: muscular rear quarters, long sloping bonnet, four circular lamps and stock wing. */
export function gtrModel(): VehicleSurfaceModel {
  const body: MeshFace[] = [], axles = [-1.56, 1.48];
  const sections = [-2.64, -2.43, -2.10, -1.88, -1.65, -1.42, -1.19, -.98, -.65, 0, .7, .94, 1.17, 1.40, 1.63, 1.86, 2.08, 2.42, 2.62];
  const width = (x: number) => Math.abs(x) > 2.4 ? 1.02 : 1.12;
  const top = (x: number) => x > 1.2 ? 1.16 - (x - 1.2) * .16 : x < -1.3 ? 1.2 : 1.18;
  const arch = (x: number) => Math.max(.30, ...axles.map(a => Math.abs(x - a) < .58 ? .46 + Math.sqrt(.58 ** 2 - (x - a) ** 2) : .30));
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i];
    for (const side of [-1, 1]) {
      body.push(face([p(a, side * width(a), arch(a)), p(b, side * width(b), arch(b)), p(b, side * width(b), top(b) - .13), p(a, side * width(a), top(a) - .13)], BLACK));
      body.push(face([p(a, side * width(a), top(a) - .13), p(b, side * width(b), top(b) - .13), p(b, side * width(b) * .91, top(b)), p(a, side * width(a) * .91, top(a))], EDGE));
    }
    body.push(face([p(a, -width(a) * .91, top(a)), p(b, -width(b) * .91, top(b)), p(b, width(b) * .91, top(b)), p(a, width(a) * .91, top(a))], BLACK));
  }
  box(body, 0, 0, .33, 5.05, 1.6, .18, INK);
  for (const side of [-1, 1]) {
    // One long door and small rear quarter window, no sedan rear door.
    const sidePoint = (x: number, z: number) => p(x, side * (1.015 - (z - 1.18) * .43), z);
    body.push(face([sidePoint(-1.62, 1.2), sidePoint(1.01, 1.18), sidePoint(.40, 1.81), sidePoint(-.94, 1.81)], GLASS));
    body.push(face([sidePoint(-1.62, 1.2), sidePoint(-1.34, 1.2), sidePoint(-.77, 1.81), sidePoint(-.94, 1.81)], BLACK));
    body.push(face([sidePoint(-.70, 1.2), sidePoint(-.62, 1.2), sidePoint(-.57, 1.81), sidePoint(-.65, 1.81)], INK));
    box(body, -.72, side * 1.127, .8, .016, .02, .56, EDGE);
    box(body, -.48, side * 1.14, 1.07, .18, .03, .04, ALLOY);
    box(body, .88, side * 1.17, 1.30, .27, .28, .13, BLACK);
    box(body, .81, side * 1.02, 1.25, .24, .16, .08, INK);
    box(body, -.08, side * 1.11, .31, 1.88, .12, .13, INK);
    box(body, .96, side * 1.135, 1.02, .24, .025, .14, INK);
    for (let line = 0; line < 3; line++) box(body, .89 + line * .065, side * 1.15, 1.02, .023, .014, .12, ALLOY);
    // Bonnet vents and swept white headlight clusters.
    body.push(face([p(1.29, side * .44, 1.151), p(1.71, side * .56, 1.086), p(1.71, side * .70, 1.086), p(1.27, side * .62, 1.154)], INK));
    body.push(face([p(2.59, side * .60, .94), p(2.59, side * .99, .93), p(2.15, side * 1.06, 1.02), p(2.31, side * .78, 1.07)], WHITE));
    box(body, 2.46, side * 1.035, .72, .15, .03, .08, [1, .48, .02, 1]);
    box(body, 2.64, side * .87, .46, .04, .25, .025, WHITE);
    // Wing mounts sit on the trunk, below a restrained factory-height spoiler.
    box(body, -2.22, side * .77, 1.35, .16, .09, .30, BLACK);
  }
  body.push(face([p(1.02, -1.015, 1.185), p(1.02, 1.015, 1.185), p(.40, .744, 1.81), p(.40, -.744, 1.81)], GLASS));
  body.push(face([p(-1.65, -1.015, 1.2), p(-1.65, 1.015, 1.2), p(-.94, .744, 1.81), p(-.94, -.744, 1.81)], GLASS));
  box(body, -.27, 0, 1.83, 1.38, 1.50, .065, BLACK);
  box(body, -2.23, 0, 1.51, .38, 2.04, .08, EDGE);
  box(body, 2.6, 0, .58, .12, 2.08, .51, BLACK);
  box(body, 2.675, 0, .67, .025, 1.32, .35, INK);
  box(body, 2.692, 0, .82, .02, .16, .07, ALLOY);
  box(body, 2.7, 0, .765, .015, .10, .055, RED);
  box(body, 2.66, 0, .31, .19, 2.18, .09, INK);
  box(body, -2.65, 0, .76, .12, 2.07, .67, BLACK);
  box(body, -2.72, 0, .43, .10, 1.48, .19, INK);
  box(body, -2.73, 0, .78, .025, .40, .15, WHITE);
  const disc = (x: number, y: number, z: number, radius: number, color: Color) => {
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
      body.push(face([p(x, y, z), p(x, y + Math.sin(a) * radius, z + Math.cos(a) * radius), p(x, y + Math.sin(b) * radius, z + Math.cos(b) * radius)], color));
    }
  };
  for (const y of [-.86, -.48, .48, .86]) {
    disc(-2.719, y, 1.025, .157, INK);
    disc(-2.725, y, 1.025, .127, RED);
    disc(-2.731, y, 1.025, .064, [.30, .015, .013, 1]);
    disc(-2.73, y, .35, .085, ALLOY);
    disc(-2.737, y, .35, .055, INK);
  }
  const wheel: MeshFace[] = [];
  const ring = (angle: number, y: number, radius: number) => p(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
    wheel.push(face([ring(a, -.18, .46), ring(b, -.18, .46), ring(b, .18, .46), ring(a, .18, .46)], INK));
    for (const side of [-1, 1]) {
      const y = side * .181;
      wheel.push(face([ring(a, y, .46), ring(b, y, .46), ring(b, y, .33), ring(a, y, .33)], BLACK));
      wheel.push(face([p(0, y, 0), ring(a, y, .33), ring(b, y, .33)], i % 2 ? INK : ALLOY));
    }
  }
  return { body, wheels: axles.flatMap(x => [-1, 1].map(side => ({ pivot: p(x, side * 1.03, .47), steers: x > 0, faces: wheel }))) };
}
