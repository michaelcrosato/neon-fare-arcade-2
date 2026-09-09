import type { Color, LotContext, MaterialId, MeshFace, Vec3 } from "./model";
import { MAT_BUILDING, MAT_FOLIAGE, MAT_GRASS, MAT_LAMP, MAT_SIDEWALK, MAT_SIGN, MAT_TIMBER, MAT_VEHICLE, MAT_WATER, MAT_WINDOW } from "./config";

export const REACH_IVORY: Color = [0.97, 0.92, 0.79, 1];
export const REACH_SHELL: Color = [0.94, 0.65, 0.7, 1];
export const REACH_PEACH: Color = [0.95, 0.73, 0.56, 1];
export const REACH_SEAFOAM: Color = [0.48, 0.81, 0.73, 1];
export const REACH_LILAC: Color = [0.67, 0.63, 0.83, 1];
export const REACH_NEON: Color = [1, 0.15, 0.53, 1];
export const REACH_CYAN: Color = [0.13, 0.92, 0.9, 1];
export const REACH_GLASS: Color = [0.12, 0.36, 0.43, 1];
export const REACH_PALM: Color = [0.18, 0.48, 0.35, 1];
export const REACH_LAWN: Color = [0.48, 0.65, 0.44, 1];
export const REACH_SAND: Color = [0.97, 0.9, 0.71, 1];
export const REACH_BAY: Color = [0.045, 0.39, 0.48, 1];
export const REACH_OCEAN: Color = [0.07, 0.65, 0.69, 1];
export const REACH_INK: Color = [0.09, 0.16, 0.23, 1];
export const REACH_PALETTE = [REACH_SHELL, REACH_SEAFOAM, REACH_PEACH, REACH_LILAC, REACH_IVORY] as const;

export function reachBox(ctx: LotContext, x: number, y: number, z: number, sx: number, sy: number, sz: number,
  color: Color, material: MaterialId = MAT_BUILDING, yaw = 0) {
  ctx.boxes.push({ x, y, z, sx, sy, sz, yaw, color, material });
}

export function reachSolid(ctx: LotContext, name: string, x: number, y: number, sx: number, sy: number, height: number, baseZ = 0) {
  ctx.colliders.push({ id: `palm-reach:${name}:${ctx.blockX}:${ctx.blockY}:${ctx.colliders.length}`, x, y,
    halfX: sx / 2, halfY: sy / 2, height, baseZ });
}

export function reachFace(ctx: LotContext, corners: MeshFace["corners"], color: Color, material: MaterialId = MAT_BUILDING) {
  ctx.surfaces?.push({ corners, color, material, kind: "architecture" });
}

export function reachRoundVolume(ctx: LotContext, x: number, y: number,
  profile: readonly { z: number; radius: number }[], color: Color, material: MaterialId = MAT_BUILDING, sides = 12) {
  const ring = (tier: number, side: number): Vec3 => ({ x: x + Math.cos(side * Math.PI * 2 / sides) * profile[tier].radius,
    y: y + Math.sin(side * Math.PI * 2 / sides) * profile[tier].radius, z: profile[tier].z });
  for (let tier = 1; tier < profile.length; tier += 1) for (let side = 0; side < sides; side += 1) {
    reachFace(ctx, [ring(tier - 1, side), ring(tier - 1, side + 1), ring(tier, side + 1), ring(tier, side)], color, material);
  }
  const last = profile.length - 1;
  for (let side = 0; side < sides; side += 1) reachFace(ctx,
    [{ x, y, z: profile[last].z }, ring(last, side), ring(last, side + 1)], color, material);
}

/** Tall smooth trunks and a bright crownshaft distinguish these royal palms. */
export function reachPalm(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  const height = 13.5 * scale, lean = Math.sin(x * .07 + y * .03) * .6;
  const trunk: Color = [0.61, 0.63, 0.53, 1];
  reachRoundVolume(ctx, x, y, [{ z: 0, radius: .38 * scale },
    { z: height - 1.7 * scale, radius: .26 * scale }], trunk, MAT_TIMBER, 5);
  reachBox(ctx, x, y, height - .85 * scale, .62 * scale, .62 * scale, 1.7 * scale, REACH_SEAFOAM, MAT_FOLIAGE);
  const crown = { x: x + lean, y, z: height };
  for (let leaf = 0; leaf < 7; leaf += 1) {
    const angle = leaf * Math.PI * 2 / 7 + x * .03;
    const dx = Math.cos(angle), dy = Math.sin(angle), span = (4.2 + leaf % 2) * scale;
    const mid = { x: crown.x + dx * span * .55, y: crown.y + dy * span * .55, z: height + .45 * scale };
    const tip = { x: crown.x + dx * span, y: crown.y + dy * span, z: height - (1.4 + leaf % 3 * .32) * scale };
    const a = { x: mid.x - dy * .62 * scale, y: mid.y + dx * .62 * scale, z: mid.z };
    const b = { x: mid.x + dy * .62 * scale, y: mid.y - dx * .62 * scale, z: mid.z };
    const tone = leaf % 2 ? REACH_PALM : [0.31, 0.61, 0.36, 1] as Color;
    reachFace(ctx, [crown, a, tip, b], tone, MAT_FOLIAGE);
    reachFace(ctx, [b, tip, a, crown], tone, MAT_FOLIAGE);
  }
  if (solid) reachSolid(ctx, "royal-palm", x, y, .7 * scale, .7 * scale, height);
}

export function reachUmbrella(ctx: LotContext, x: number, y: number, tone: Color, scale = 1) {
  reachBox(ctx, x, y, 1.45 * scale, .12, .12, 2.9 * scale, REACH_IVORY, MAT_TIMBER);
  for (let side = 0; side < 8; side += 1) {
    const a = side * Math.PI / 4, b = (side + 1) * Math.PI / 4;
    const corners = [{ x, y, z: 3.15 * scale }, { x: x + Math.cos(a) * 2.2 * scale, y: y + Math.sin(a) * 2.2 * scale, z: 2.5 * scale },
      { x: x + Math.cos(b) * 2.2 * scale, y: y + Math.sin(b) * 2.2 * scale, z: 2.5 * scale }] as const;
    reachFace(ctx, [...corners], side % 2 ? tone : REACH_IVORY, MAT_SIGN);
    reachFace(ctx, [corners[2], corners[1], corners[0]], side % 2 ? tone : REACH_IVORY, MAT_SIGN);
  }
}

export function reachPool(ctx: LotContext, x: number, y: number, width: number, depth: number) {
  reachBox(ctx, x, y, .13, width + 2, depth + 2, .22, REACH_IVORY, MAT_SIDEWALK);
  reachBox(ctx, x, y, .28, width, depth, .1, REACH_CYAN, MAT_WATER);
  const id = `wetland-water-pool:${ctx.blockX}:${ctx.blockY}:${ctx.surfaceRegions.length}`;
  ctx.surfaceRegions.push({ id, kind: "water", x, y, halfX: width / 2, halfY: depth / 2, yaw: 0 });
  ctx.colliders.push({ id, x, y, halfX: width / 2, halfY: depth / 2, height: 1.2 });
}

/** Faceted bow, long low hull, wraparound screen, and a raised sun deck. */
export function reachYacht(ctx: LotContext, x: number, y: number, scale = 1, yaw = 0, tone = REACH_IVORY) {
  const point = (dx: number, dy: number, z: number): Vec3 => ({ x: x + (dx * Math.cos(yaw) - dy * Math.sin(yaw)) * scale,
    y: y + (dx * Math.sin(yaw) + dy * Math.cos(yaw)) * scale, z: z * scale });
  const outline = [[-2, -4], [2, -4], [2.1, 2], [0, 6], [-2.1, 2]];
  for (let side = 0; side < outline.length; side += 1) {
    const [ax, ay] = outline[side], [bx, by] = outline[(side + 1) % outline.length];
    reachFace(ctx, [point(ax, ay, .8), point(bx, by, .8), point(bx * .7, by * .88, -.35), point(ax * .7, ay * .88, -.35)], tone, MAT_VEHICLE);
    reachFace(ctx, [point(0, 0, .8), point(ax, ay, .8), point(bx, by, .8)], REACH_IVORY, MAT_VEHICLE);
  }
  const cabin = point(0, -1, 1.3);
  reachBox(ctx, cabin.x, cabin.y, cabin.z, 3.4 * scale, 4.8 * scale, 1.2 * scale, REACH_GLASS, MAT_WINDOW, yaw);
  reachBox(ctx, cabin.x, cabin.y, 2.05 * scale, 3.8 * scale, 5.1 * scale, .25 * scale, tone, MAT_VEHICLE, yaw);
}

const NEON_GLYPHS: Record<string, readonly string[]> = {
  A: ["010","101","111","101","101"], C: ["111","100","100","100","111"], E: ["111","100","110","100","111"],
  F: ["111","100","110","100","100"], G: ["111","100","101","101","111"], I: ["111","010","010","010","111"],
  H: ["101","101","111","101","101"],
  K: ["101","110","100","110","101"], L: ["100","100","100","100","111"], M: ["101","111","111","101","101"],
  N: ["101","111","111","111","101"], O: ["111","101","101","101","111"], P: ["110","101","110","100","100"],
  R: ["110","101","110","101","101"], S: ["111","100","111","001","111"], T: ["111","010","010","010","010"],
  U: ["101","101","101","101","111"], V: ["101","101","101","101","010"], Y: ["101","101","010","010","010"],
  "8": ["111","101","111","101","111"], "6": ["111","100","111","101","111"], " ": ["000","000","000","000","000"],
};

/** Thin emissive face lettering spends surface capacity instead of actor instances. */
export function reachNeonWord(ctx: LotContext, text: string, x: number, y: number, z: number, pixel = .32, tone = REACH_NEON) {
  const left = x - (text.length * 4 - 1) * pixel / 2;
  for (let letter = 0; letter < text.length; letter += 1) for (const [row, line] of (NEON_GLYPHS[text[letter]] ?? NEON_GLYPHS[" "]).entries()) {
    for (let column = 0; column < 3; column += 1) if (line[column] === "1") {
      const start = column;
      while (column < 2 && line[column + 1] === "1") column++;
      const px = left + (letter * 4 + start) * pixel, pz = z + (4 - row) * pixel, width = (column - start + .83) * pixel;
      const corners = [{ x: px, y, z: pz }, { x: px + width, y, z: pz },
        { x: px + width, y, z: pz + pixel * .83 }, { x: px, y, z: pz + pixel * .83 }] as const;
      reachFace(ctx, [...corners], tone, MAT_LAMP);
      reachFace(ctx, [corners[3], corners[2], corners[1], corners[0]], tone, MAT_LAMP);
    }
  }
}

export function reachLawn(ctx: LotContext, x: number, y: number, width: number, depth: number) {
  reachBox(ctx, x, y, .06, width, depth, .08, REACH_LAWN, MAT_GRASS);
}
