import type { Color, LotContext, MaterialId, Vec3 } from "./model";
import { MAT_BUILDING, MAT_FOLIAGE, MAT_LAMP, MAT_ROAD, MAT_SIGN, MAT_STONE, MAT_TIMBER, MAT_VEHICLE, MAT_WINDOW } from "./config";
import { gabledRoof } from "./architecture";

export const CITY_STONE: Color = [.82, .78, .65, 1];
export const CITY_CREAM: Color = [.96, .9, .72, 1];
export const CITY_BRICK: Color = [.63, .31, .23, 1];
export const CITY_INK: Color = [.12, .19, .2, 1];
export const CITY_GLASS: Color = [.17, .48, .53, 1];
export const CITY_TEAL: Color = [.21, .63, .63, 1];
export const CITY_GOLD: Color = [1, .73, .15, 1];
export const CITY_CORAL: Color = [.9, .35, .24, 1];

export function cityBox(ctx: LotContext, x: number, y: number, z: number, sx: number, sy: number, sz: number,
  color: Color, material: MaterialId = MAT_BUILDING, yaw = 0) {
  ctx.boxes.push({ x, y, z, sx, sy, sz, yaw, color, material });
}

export function citySolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number, baseZ = 0) {
  ctx.colliders.push({ id: `city:${ctx.blockX}:${ctx.blockY}:${id}`, x, y, halfX: sx / 2, halfY: sy / 2, height, baseZ });
}

export function cityFace(ctx: LotContext, corners: readonly [Vec3, Vec3, Vec3] | readonly [Vec3, Vec3, Vec3, Vec3], color: Color, material: MaterialId = MAT_BUILDING) {
  ctx.surfaces?.push({ corners, color, material, kind: "architecture" });
}

export function cityShell(ctx: LotContext, id: string, x: number, y: number, width: number, depth: number, height: number, color = CITY_STONE) {
  cityBox(ctx, x, y, height / 2, width, depth, height, color);
  cityBox(ctx, x, y, .24, width + .35, depth + .35, .48, CITY_INK, MAT_STONE);
  cityBox(ctx, x, y, height - .15, width + .5, depth + .5, .45, CITY_CREAM, MAT_STONE);
  citySolid(ctx, id, x, y, width, depth, height);
}

export function cityWindows(ctx: LotContext, x: number, y: number, width: number, depth: number, bottom: number, top: number) {
  const height = top - bottom, z = (top + bottom) / 2;
  for (const side of [-1, 1]) {
    cityBox(ctx, x, y + side * (depth / 2 + .045), z, width * .76, .08, height, CITY_GLASS, MAT_WINDOW);
    cityBox(ctx, x + side * (width / 2 + .045), y, z, .08, depth * .72, height, CITY_GLASS, MAT_WINDOW);
  }
}

export function cityHipRoof(ctx: LotContext, x: number, y: number, z: number, width: number, depth: number, rise: number, color = CITY_INK) {
  const ring = [{ x: x - width / 2, y: y - depth / 2, z }, { x: x + width / 2, y: y - depth / 2, z },
    { x: x + width / 2, y: y + depth / 2, z }, { x: x - width / 2, y: y + depth / 2, z }];
  for (let i = 0; i < 4; i += 1) cityFace(ctx, [ring[i], ring[(i + 1) % 4], { x, y, z: z + rise }], color, MAT_STONE);
}

export function cityGable(ctx: LotContext, x: number, y: number, z: number, width: number, depth: number, rise: number, color = CITY_BRICK) {
  ctx.surfaces?.push(...gabledRoof(x, y, z, width, depth, rise, color, CITY_CREAM));
}

export function citySawtoothRoof(ctx: LotContext, x: number, y: number, z: number, width: number, depth: number, rise = 2.2, bays = 3) {
  const bay = width / bays;
  for (let i = 0; i < bays; i += 1) {
    const left = x - width / 2 + i * bay, right = left + bay;
    const a = { x: left, y: y - depth / 2, z }, b = { x: right, y: y - depth / 2, z: z + rise };
    const c = { x: right, y: y + depth / 2, z: z + rise }, d = { x: left, y: y + depth / 2, z };
    cityFace(ctx, [a, b, c, d], CITY_STONE, MAT_STONE);
    cityFace(ctx, [b, { ...b, z }, { ...c, z }, c], CITY_GLASS, MAT_WINDOW);
    cityFace(ctx, [a, { ...b, z }, b], CITY_CREAM);
    cityFace(ctx, [d, c, { ...c, z }], CITY_CREAM);
  }
}

export function cityCanopy(ctx: LotContext, id: string, x: number, y: number, width: number, depth: number, height: number, color = CITY_GOLD) {
  const left = x - width / 2, right = x + width / 2, front = y - depth / 2, back = y + depth / 2;
  const a = { x: left, y: front, z: height }, b = { x: right, y: front, z: height + .65 };
  const c = { x: right, y: back, z: height + .65 }, d = { x: left, y: back, z: height };
  cityFace(ctx, [a, b, c, d], color);
  cityFace(ctx, [{ ...d, z: height - .12 }, { ...c, z: height - .12 }, { ...b, z: height - .12 }, { ...a, z: height - .12 }], CITY_CREAM);
  citySolid(ctx, id, x, y, width, depth, .77, height - .12);
}

export function cityTree(ctx: LotContext, id: string, x: number, y: number, scale = 1) {
  const boxStart = ctx.boxes.length, faceStart = ctx.surfaces?.length ?? 0;
  cityBox(ctx, x, y, 1.8 * scale, .42 * scale, .42 * scale, 3.6 * scale, CITY_BRICK, MAT_TIMBER);
  const lower = { x, y, z: 2.5 * scale }, upper = { x: x + .35 * scale, y, z: 7.4 * scale };
  const ring = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos(i * Math.PI / 3) * 2.7 * scale,
    y: y + Math.sin(i * Math.PI / 3) * 2.7 * scale, z: 4.9 * scale }));
  for (let i = 0; i < 6; i += 1) {
    const color: Color = i % 2 ? [.32, .52, .29, 1] : [.49, .64, .31, 1];
    cityFace(ctx, [ring[i], ring[(i + 1) % 6], upper], color, MAT_FOLIAGE);
    cityFace(ctx, [ring[(i + 1) % 6], ring[i], lower], color, MAT_FOLIAGE);
  }
  for (let i = boxStart; i < ctx.boxes.length; i += 1) ctx.boxes[i].groundAnchor = { x, y };
  for (let i = faceStart; i < (ctx.surfaces?.length ?? 0); i += 1) ctx.surfaces![i].groundAnchor = { x, y };
  citySolid(ctx, id, x, y, .48 * scale, .48 * scale, 3.5 * scale);
  ctx.colliders.at(-1)!.groundAnchor = { x, y };
}

export function cityBench(ctx: LotContext, x: number, y: number) {
  const first = ctx.boxes.length;
  cityBox(ctx, x, y, .7, 2.5, .7, .2, CITY_STONE, MAT_TIMBER);
  cityBox(ctx, x, y + .28, 1.15, 2.5, .14, .75, CITY_STONE, MAT_TIMBER);
  for (const side of [-1, 1]) cityBox(ctx, x + side * .9, y, .35, .2, .5, .7, CITY_INK);
  for (let i = first; i < ctx.boxes.length; i += 1) ctx.boxes[i].groundAnchor = { x, y };
}

export function cityLight(ctx: LotContext, x: number, y: number, height = 4.8) {
  const first = ctx.boxes.length;
  cityBox(ctx, x, y, height / 2, .16, .16, height, CITY_INK);
  cityBox(ctx, x + .48, y, height, 1.1, .18, .18, CITY_INK);
  cityBox(ctx, x + .85, y, height - .15, .7, .45, .15, CITY_GOLD, MAT_LAMP);
  for (let i = first; i < ctx.boxes.length; i += 1) ctx.boxes[i].groundAnchor = { x, y };
}

export function cityParkedCar(ctx: LotContext, id: string, x: number, y: number, color = CITY_TEAL) {
  const first = ctx.boxes.length;
  cityBox(ctx, x, y, .65, 1.8, 3.8, .9, color, MAT_VEHICLE);
  cityBox(ctx, x, y, 1.24, 1.55, 2.1, .6, CITY_GLASS, MAT_WINDOW);
  cityBox(ctx, x, y, 1.58, 1.65, 2.3, .15, color, MAT_VEHICLE);
  for (const side of [-1, 1]) for (const end of [-1, 1]) cityBox(ctx, x + side * .85, y + end * 1.15, .35, .3, .6, .65, CITY_INK, MAT_ROAD);
  citySolid(ctx, id, x, y, 1.9, 3.8, 1.7);
  for (let i = first; i < ctx.boxes.length; i += 1) ctx.boxes[i].groundAnchor = { x, y };
  ctx.colliders.at(-1)!.groundAnchor = { x, y };
}

export function citySign(ctx: LotContext, x: number, y: number, color = CITY_GOLD, height = 5) {
  const first = ctx.boxes.length;
  cityBox(ctx, x, y, height / 2, .22, .22, height, CITY_INK);
  cityBox(ctx, x, y, height - .9, 1.6, .35, 2.7, color, MAT_SIGN);
  cityBox(ctx, x, y - .2, height - .9, .6, .08, 1.6, CITY_CREAM, MAT_LAMP);
  for (let i = first; i < ctx.boxes.length; i += 1) ctx.boxes[i].groundAnchor = { x, y };
}
