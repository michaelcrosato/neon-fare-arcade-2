import type { Box, Color, LotContext, MaterialId, MeshFace, Vec3 } from "./model";
import { MAT_GENERIC, MAT_LAMP, MAT_VEHICLE, MAT_WINDOW } from "./config";
import { reachNeonWord } from "./reach-assets";

export const WORKS = {
  concrete: [0.42, 0.44, 0.41, 1], steel: [0.36, 0.44, 0.46, 1], silver: [0.68, 0.73, 0.71, 1],
  dark: [0.075, 0.105, 0.12, 1], rust: [0.55, 0.19, 0.105, 1], brick: [0.42, 0.2, 0.15, 1],
  amber: [1, 0.64, 0.055, 1], orange: [1, 0.3, 0.065, 1], teal: [0.055, 0.45, 0.48, 1],
  glass: [0.22, 0.65, 0.69, 1], cream: [0.9, 0.86, 0.7, 1], water: [0.035, 0.28, 0.35, 1],
} as const satisfies Record<string, Color>;

export function worksBox(ctx: Pick<LotContext, "boxes">, x: number, y: number, z: number, sx: number, sy: number, sz: number,
  color: Color, material: MaterialId = MAT_GENERIC, yaw = 0, tilt = 0) {
  ctx.boxes.push({ x, y, z, sx, sy, sz, yaw, tilt, color, material });
}
export function worksSolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number, baseZ = 0) {
  ctx.colliders.push({ id: `works-${id}:${ctx.blockX}:${ctx.blockY}:${ctx.colliders.length}`, x, y, halfX: sx / 2, halfY: sy / 2, height, baseZ });
}
export function worksFace(ctx: Pick<LotContext, "surfaces">, corners: MeshFace["corners"], color: Color, material: MaterialId = MAT_GENERIC) {
  ctx.surfaces?.push({ corners, color, material, kind: "architecture" });
}
export function worksBeam(a: Vec3, b: Vec3, width: number, color: Color = WORKS.steel): Box {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
    sx: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), sy: width, sz: width,
    yaw: Math.atan2(b.y - a.y, b.x - a.x), tilt: -Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)), color, material: MAT_GENERIC };
}

/** Faceted cylinders and domed tanks are actual surfaces in both renderer paths. */
export function worksRound(ctx: LotContext, x: number, y: number, profile: readonly (readonly [number, number])[], color: Color,
  sides = 10, material: MaterialId = MAT_GENERIC) {
  const ring = (z: number, radius: number, i: number): Vec3 => ({ x: x + Math.cos(i * Math.PI * 2 / sides) * radius,
    y: y + Math.sin(i * Math.PI * 2 / sides) * radius, z });
  for (let tier = 1; tier < profile.length; tier++) {
    const [z0, r0] = profile[tier - 1], [z1, r1] = profile[tier];
    for (let i = 0; i < sides; i++) worksFace(ctx, [ring(z0, r0, i), ring(z0, r0, i + 1), ring(z1, r1, i + 1), ring(z1, r1, i)], color, material);
  }
  const [z, radius] = profile[profile.length - 1];
  for (let i = 0; i < sides; i++) worksFace(ctx, [{ x, y, z }, ring(z, radius, i), ring(z, radius, i + 1)], color, material);
}

export function worksTank(ctx: LotContext, x: number, y: number, radius = 9, height = 12, tone: Color = WORKS.silver) {
  worksRound(ctx, x, y, [[0.35, radius], [height, radius], [height + radius * .32, radius * .72], [height + radius * .48, .25]], tone, 12);
  worksRound(ctx, x, y, [[height * .55, radius + .06], [height * .55 + .55, radius + .06]], WORKS.teal, 12);
  worksSolid(ctx, "storage-tank", x, y, radius * 2, radius * 2, height + radius * .48);
  worksBox(ctx, x, y - radius - .24, height / 2, .55, .4, height, WORKS.dark);
  for (let rung = 2; rung < height; rung += 2.5) worksBox(ctx, x, y - radius - .48, rung, 1.6, .18, .16, WORKS.amber);
  worksBox(ctx, x + radius * .4, y, height + radius * .4, .6, .6, 2.2, WORKS.steel);
}

export function worksStack(ctx: LotContext, x: number, y: number, height: number, radius = 2.4, striped = true) {
  worksRound(ctx, x, y, [[.2, radius * 1.2], [height, radius * .68]], WORKS.brick, 8);
  if (striped) for (let z = height * .52; z < height - 1; z += 8) {
    const r = radius * (1.2 - .52 * z / height) + .07;
    worksRound(ctx, x, y, [[z, r], [z + 3, r - radius * .035]], WORKS.cream, 8);
  }
  worksRound(ctx, x, y, [[height - .5, radius * .79], [height + .2, radius * .79]], WORKS.dark, 8);
  worksSolid(ctx, "chimney", x, y, radius * 2.2, radius * 2.2, height + .3);
}

export function worksSign(ctx: LotContext, text: string, x: number, y: number, z: number, width = 22) {
  worksBox(ctx, x, y, z + 1.2, width, .6, 3.8, WORKS.dark);
  worksBox(ctx, x, y - .32, z - .5, width, .12, .2, WORKS.amber, MAT_LAMP);
  const start = ctx.surfaces?.length ?? 0;
  reachNeonWord(ctx, text, x, y - .34, z, Math.min(.5, width / (text.length * 4 + 1)), WORKS.cream);
  // The shared perspective matrix mirrors world X; north-facing text follows its screen-right basis.
  for (const face of ctx.surfaces?.slice(start) ?? []) face.corners = face.corners.map(p => ({ ...p, x: x * 2 - p.x })) as unknown as MeshFace["corners"];
}

export function worksHall(ctx: LotContext, x: number, y: number, sx: number, sy: number, height: number, tone: Color = WORKS.brick, hot = false) {
  worksBox(ctx, x, y, height / 2 + .3, sx, sy, height, tone);
  worksSolid(ctx, "factory-hall", x, y, sx, sy, height + 4);
  for (const side of [-1, 1]) {
    worksBox(ctx, x, y + side * (sy / 2 + .06), height * .57, sx * .9, .13, 2.3, hot ? WORKS.orange : WORKS.glass, hot ? MAT_LAMP : MAT_WINDOW);
    for (const dx of [-sx * .32, 0, sx * .32]) worksBox(ctx, x + dx, y + side * (sy / 2 + .14), height / 2, .35, .3, height, WORKS.steel);
  }
  for (let tooth = 0; tooth < 3; tooth++) {
    const top = y - sy / 2 + tooth * sy / 3, end = top + sy / 3;
    const a = { x: x - sx / 2, y: top, z: height + .32 }, b = { x: x + sx / 2, y: top, z: height + .32 };
    const c = { x: x + sx / 2, y: end, z: height + 3.5 }, d = { x: x - sx / 2, y: end, z: height + 3.5 };
    worksFace(ctx, [a, b, c, d], WORKS.steel);
    worksFace(ctx, [d, c, { ...c, z: height + .32 }, { ...d, z: height + .32 }], WORKS.glass, MAT_WINDOW);
    worksFace(ctx, [a, d, { ...d, z: height + .32 }], tone);
    worksFace(ctx, [b, { ...c, z: height + .32 }, c], tone);
  }
}

export function worksContainer(ctx: LotContext, x: number, y: number, z: number, tone: Color, long = 12, crosswise = false) {
  const sx = crosswise ? long : 5.5, sy = crosswise ? 5.5 : long;
  worksBox(ctx, x, y, z + 1.8, sx, sy, 3.6, tone);
  worksBox(ctx, x, y - sy / 2 - .04, z + 1.8, sx - .4, .14, 2.9, WORKS.steel);
  worksBox(ctx, x, y - sy / 2 - .13, z + 1.8, .14, .12, 3.1, WORKS.silver);
  for (let i = -2; i <= 2; i++) {
    const py = y + i * sy / 10;
    for (const side of [-1, 1]) worksFace(ctx, [{ x: x + side * (sx / 2 + .02), y: py, z: z + .12 },
      { x: x + side * (sx / 2 + .02), y: py + .12, z: z + .12 }, { x: x + side * (sx / 2 + .02), y: py + .12, z: z + 3.48 },
      { x: x + side * (sx / 2 + .02), y: py, z: z + 3.48 }], WORKS.dark);
  }
}

export function worksWreck(ctx: LotContext, x: number, y: number, z: number, tone: Color, yaw = 0) {
  worksBox(ctx, x, y, z + .7, 4.7, 2.25, 1.1, tone, MAT_VEHICLE, yaw, .05);
  worksBox(ctx, x - .3, y, z + 1.45, 2.1, 1.85, .75, WORKS.dark, MAT_WINDOW, yaw, -.08);
  worksBox(ctx, x - .25, y, z + 1.85, 2.25, 2.05, .16, tone, MAT_VEHICLE, yaw, -.08);
  const p = (dx: number, dy: number, dz: number) => ({ x: x + Math.cos(yaw) * dx - Math.sin(yaw) * dy,
    y: y + Math.sin(yaw) * dx + Math.cos(yaw) * dy, z: z + dz });
  for (const dx of [-1.5, 1.5]) for (const side of [-1, 1]) worksFace(ctx,
    [p(dx - .45, side * 1.22, .1), p(dx + .45, side * 1.22, .1), p(dx + .45, side * 1.22, .9), p(dx - .45, side * 1.22, .9)], WORKS.dark);
  worksFace(ctx, [p(.6, -1.14, .7), p(1.7, -1.14, .8), p(1.6, -1.14, 1.1), p(.7, -1.14, 1.05)], WORKS.rust);
}

export function worksPipeRack(ctx: LotContext, direction: "x" | "y", z = 7.5, length = 35.9) {
  const x = ctx.centerX, y = ctx.centerY;
  for (const side of [-1, 1]) {
    const px = x + (direction === "y" ? side * 5 : 0), py = y + (direction === "x" ? side * 5 : 0);
    worksBox(ctx, px, py, z / 2, .65, .65, z, WORKS.steel);
    worksSolid(ctx, "pipe-support", px, py, .65, .65, z);
  }
  worksBox(ctx, x, y, z, direction === "y" ? 12 : 1, direction === "x" ? 12 : 1, .6, WORKS.steel);
  for (let pipe = -1; pipe <= 1; pipe++) worksBox(ctx, x + (direction === "y" ? pipe * 2.2 : 0),
    y + (direction === "x" ? pipe * 2.2 : 0), z + .75, direction === "x" ? length : 1.3, direction === "y" ? length : 1.3, 1.3,
    pipe === 0 ? WORKS.amber : WORKS.silver);
  worksSolid(ctx, "overhead-pipes", x, y, direction === "x" ? length : 7, direction === "y" ? length : 7, 2, z - .3);
}

/** One tile of the massive dry-dock gantry; no distant tile owns its supports. */
export function worksGantryTile(ctx: LotContext, tileX: number, span = 5, height = 54) {
  const x = ctx.centerX, y = ctx.centerY;
  worksBox(ctx, x, y, height, 36, 4.5, 4, WORKS.orange);
  worksBox(ctx, x, y, height + 2.2, 36, 5.2, .45, WORKS.amber);
  worksSolid(ctx, "gantry-beam", x, y, 36, 5.2, 4.6, height - 2);
  for (const side of [-1, 1]) for (let bay = 0; bay < 3; bay++) ctx.boxes.push(worksBeam(
    { x: x - 18 + bay * 12, y: y + side * 2.35, z: height - 1.5 },
    { x: x - 6 + bay * 12, y: y + side * 2.35, z: height + 1.5 }, .28, WORKS.dark));
  if (tileX !== 0 && tileX !== span - 1) return;
  const px = x + (tileX === 0 ? 4 : -4);
  for (const side of [-1, 1]) {
    worksBox(ctx, px, y + side * 9, height / 2, 2.3, 2.3, height, WORKS.orange);
    worksSolid(ctx, "gantry-leg", px, y + side * 9, 2.3, 2.3, height);
    worksBox(ctx, px, y + side * 9, 1.4, 4.8, 8, 2, WORKS.dark);
    ctx.boxes.push(worksBeam({ x: px, y: y + side * 9, z: height - 3 }, { x: px, y, z: height }, 1.5, WORKS.orange));
  }
  worksBox(ctx, px, y, height - 6, 6, 8, 4, WORKS.amber);
  worksBox(ctx, px, y - 4.05, height - 5.6, 4.6, .15, 2.2, WORKS.glass, MAT_WINDOW);
}

/** Successive 36-unit hull slices form one continuous ship across chunk boundaries. */
export function worksShipSlice(ctx: LotContext, index: number, count: number, axis: "x" | "y", unfinished = false) {
  const x = ctx.centerX, y = ctx.centerY, h = unfinished ? 15 : 11;
  const widthAt = (t: number) => t < .12 ? 9 + t / .12 * 6 : t > .84 ? Math.max(.4, 15 * (1 - t) / .16) : 15;
  const a = widthAt(index / count), b = widthAt((index + 1) / count);
  const p = (side: number, end: number, z: number): Vec3 => axis === "y"
    ? { x: x + side, y: y + end, z } : { x: x + end, y: y + side, z };
  for (const sign of [-1, 1]) {
    worksFace(ctx, [p(sign * a * .62, -18, -.2), p(sign * b * .62, 18, -.2), p(sign * b, 18, 5), p(sign * a, -18, 5)], WORKS.rust);
    worksFace(ctx, [p(sign * a, -18, 5), p(sign * b, 18, 5), p(sign * b, 18, h), p(sign * a, -18, h)], unfinished ? WORKS.steel : WORKS.teal);
    worksFace(ctx, [p(sign * a, -18, h), p(sign * b, 18, h), p(sign * b, 18, h + .65), p(sign * a, -18, h + .65)], WORKS.cream);
  }
  worksFace(ctx, [p(-a, -18, h), p(a, -18, h), p(b, 18, h), p(-b, 18, h)], unfinished ? WORKS.rust : WORKS.concrete);
  if (index === 0 || index === count - 1) {
    const w = index === 0 ? a : b, end = index === 0 ? -18 : 18;
    worksFace(ctx, [p(-w, end, 0), p(w, end, 0), p(w, end, h), p(-w, end, h)], WORKS.rust);
  }
  if (index === 0) {
    worksBox(ctx, x, y, h + 6, axis === "x" ? 19 : 24, axis === "x" ? 24 : 19, 12, WORKS.cream);
    worksBox(ctx, x, y, h + 13.5, 27, 22, 3, WORKS.dark);
    worksBox(ctx, x, y, h + 15.4, 28, 23, .8, WORKS.cream);
    worksBox(ctx, x, y, h + 22, .8, .8, 13, WORKS.steel);
    worksBox(ctx, x, y, h + 27, 12, .45, .45, WORKS.amber);
  } else if (index < count - 1 && !unfinished) {
    for (const dx of [-7, 0, 7]) for (let tier = 0; tier < 2; tier++) worksContainer(ctx, x + (axis === "y" ? dx : 0), y + (axis === "x" ? dx : 0), h + .5 + tier * 3.6,
      [WORKS.orange, WORKS.amber, WORKS.rust][(index + tier) % 3], 23, axis === "x");
  } else if (unfinished) {
    for (const offset of [-12, 0, 12]) {
      const pa = p(-10, offset, h + 1), pb = p(10, offset, h + 1);
      ctx.boxes.push(worksBeam(pa, pb, .65, WORKS.silver));
      worksBox(ctx, pa.x, pa.y, h + 2.5, .45, .45, 4, WORKS.amber);
      worksBox(ctx, pb.x, pb.y, h + 2.5, .45, .45, 4, WORKS.amber);
    }
  }
}
