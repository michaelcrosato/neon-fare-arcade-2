import type { Color, LotContext, MaterialId, Vec3 } from "./model";
import { MAT_BUILDING, MAT_FOLIAGE, MAT_GENERIC, MAT_LAMP, MAT_ROAD, MAT_SIGN, MAT_TIMBER, MAT_WINDOW } from "./config";
import { gabledRoof } from "./architecture";

export const CEDAR_CREAM: Color = [0.93, 0.88, 0.74, 1];
export const CEDAR_WHITE: Color = [0.98, 0.96, 0.86, 1];
export const CEDAR_AMBER: Color = [1, 0.72, 0.28, 1];
export const CEDAR_GROUND: Color = [0.47, 0.63, 0.35, 1];
export const CEDAR_SAGE: Color = [0.6, 0.7, 0.55, 1];
export const CEDAR_BLUE: Color = [0.49, 0.65, 0.7, 1];
export const CEDAR_BRICK: Color = [0.61, 0.34, 0.25, 1];
export const CEDAR_ROOF: Color = [0.27, 0.3, 0.3, 1];
export const CEDAR_GLASS: Color = [0.2, 0.39, 0.43, 1];
export const CEDAR_TIMBER: Color = [0.45, 0.32, 0.21, 1];

export function cedarBox(ctx: LotContext, x: number, y: number, z: number, sx: number, sy: number, sz: number,
  color: Color, material: MaterialId = MAT_BUILDING, yaw = 0) {
  ctx.boxes.push({ x, y, z, sx, sy, sz, yaw, color, material });
}

export function cedarSolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number, baseZ = 0) {
  ctx.colliders.push({ id: `cedar:${ctx.blockX}:${ctx.blockY}:${id}`, x, y, halfX: sx / 2, halfY: sy / 2, height, baseZ });
}

export function cedarRoof(ctx: LotContext, x: number, y: number, z: number, width: number, depth: number, rise: number, color = CEDAR_ROOF, gable = CEDAR_CREAM) {
  ctx.surfaces?.push(...gabledRoof(x, y, z, width, depth, rise, color, gable));
  for (const side of [-1, 1]) cedarBox(ctx, x + side * width / 2, y, z, 0.17, depth, 0.25, CEDAR_WHITE, MAT_TIMBER);
}

export function cedarRoundVolume(ctx: LotContext, x: number, y: number, profile: readonly { z: number; radius: number }[], color: Color, material: MaterialId, sides = 8) {
  const rings = profile.map(({ z, radius }) => Array.from({ length: sides }, (_, i) => ({ x: x + Math.cos(i * Math.PI * 2 / sides) * radius,
    y: y + Math.sin(i * Math.PI * 2 / sides) * radius, z })));
  for (let ring = 0; ring < rings.length - 1; ring += 1) for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    ctx.surfaces?.push({ corners: [rings[ring][side], rings[ring][next], rings[ring + 1][next], rings[ring + 1][side]], color, material, kind: "architecture" });
  }
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    ctx.surfaces?.push({ corners: [{ x, y, z: profile[0].z }, rings[0][next], rings[0][side]], color, material, kind: "architecture" },
      { corners: [{ x, y, z: profile[profile.length - 1].z }, rings[rings.length - 1][side], rings[rings.length - 1][next]], color, material, kind: "architecture" });
  }
}

export function cedarTree(ctx: LotContext, id: string, x: number, y: number, scale = 1, autumn = false) {
  cedarBox(ctx, x, y, 2.5 * scale, 0.48 * scale, 0.48 * scale, 5 * scale, CEDAR_TIMBER, MAT_TIMBER);
  const color: Color = autumn ? [0.66, 0.64, 0.24, 1] : [0.29, 0.48, 0.24, 1];
  cedarRoundVolume(ctx, x, y, [{ z: 4.2 * scale, radius: 1.4 * scale }, { z: 7 * scale, radius: 4.1 * scale }, { z: 10 * scale, radius: 1.1 * scale }], color, MAT_FOLIAGE, 6);
  cedarSolid(ctx, `tree:${id}`, x, y, 0.55 * scale, 0.55 * scale, 4.4 * scale);
}

export function cedarWindow(ctx: LotContext, x: number, y: number, z: number, width = 1.5, height = 1.7, side = false) {
  cedarBox(ctx, x, y, z, side ? 0.17 : width + 0.22, side ? width + 0.22 : 0.17, height + 0.22, CEDAR_WHITE, MAT_TIMBER);
  cedarBox(ctx, x + (side ? 0.1 : 0), y - (side ? 0 : 0.1), z, side ? 0.08 : width, side ? width : 0.08, height, CEDAR_GLASS, MAT_WINDOW);
  cedarBox(ctx, x + (side ? 0.15 : 0), y - (side ? 0 : 0.15), z, side ? 0.08 : 0.07, side ? 0.07 : 0.08, height, CEDAR_WHITE, MAT_TIMBER);
}

export function cedarCar(ctx: LotContext, id: string, x: number, y: number, color: Color, bus = false, yaw = 0) {
  const boxStart = ctx.boxes.length, colliderStart = ctx.colliders.length;
  const length = bus ? 8.4 : 4.1, width = bus ? 2.6 : 1.9;
  cedarBox(ctx, x, y, bus ? 1.4 : 0.75, width, length, bus ? 2.3 : 1.1, color);
  cedarBox(ctx, x, y, bus ? 2.55 : 1.45, width * 0.84, length * 0.65, bus ? 0.5 : 0.65, CEDAR_GLASS, MAT_WINDOW);
  cedarBox(ctx, x, y, bus ? 2.88 : 1.8, width * 0.85, length * 0.67, 0.15, color);
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) cedarBox(ctx, x + dx * width * 0.45, y + dy * length * 0.3,
    0.42, 0.28, 0.8, 0.8, CEDAR_ROOF, MAT_ROAD);
  cedarSolid(ctx, id, x, y, width, length, bus ? 2.9 : 1.9);
  if (yaw) {
    for (const box of ctx.boxes.slice(boxStart)) {
      const dx = box.x - x, dy = box.y - y;
      box.x = x + dx * Math.cos(yaw) - dy * Math.sin(yaw);
      box.y = y + dx * Math.sin(yaw) + dy * Math.cos(yaw);
      box.yaw += yaw;
    }
    ctx.colliders[colliderStart].yaw = yaw;
  }
}

export function cedarBeam(ctx: LotContext, a: Vec3, b: Vec3, width: number, color = CEDAR_WHITE) {
  ctx.boxes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2,
    sx: Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), sy: width, sz: width,
    yaw: Math.atan2(b.y - a.y, b.x - a.x), tilt: -Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y)), color, material: MAT_TIMBER });
}

export function cedarPorchLight(ctx: LotContext, x: number, y: number) {
  cedarBox(ctx, x, y, 1.2, 0.13, 0.13, 2.4, CEDAR_ROOF, MAT_GENERIC);
  cedarBox(ctx, x, y, 2.5, 0.42, 0.42, 0.5, CEDAR_AMBER, MAT_LAMP);
}

export function cedarMailbox(ctx: LotContext, x: number, y: number) {
  cedarBox(ctx, x, y, 0.6, 0.16, 0.16, 1.2, CEDAR_TIMBER, MAT_TIMBER);
  cedarBox(ctx, x, y, 1.35, 0.55, 0.75, 0.42, CEDAR_BLUE, MAT_SIGN);
  cedarBox(ctx, x + 0.34, y, 1.5, 0.08, 0.32, 0.35, CEDAR_BRICK, MAT_SIGN);
}
