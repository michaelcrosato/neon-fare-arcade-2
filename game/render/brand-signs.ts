import { BRANDS, type BrandId } from "../brands";
import { brandIcon, wordmarkRects } from "../brand-art";
import { MAT_SIGN } from "../config";
import type { LotContext, Vec3 } from "../model";

export function brandSign(ctx: Pick<LotContext, "boxes" | "surfaces">, id: BrandId,
  x: number, y: number, z: number, width: number, heading = -Math.PI / 2) {
  const brand = BRANDS[id], height = width / 4;
  // Both game projections reverse screen X to preserve the authored world axes.
  const normalX = Math.cos(heading), normalY = Math.sin(heading), rightX = normalY, rightY = -normalX;
  const point = (px: number, py: number): Vec3 => ({ x: x + rightX * (px / 384 - .5) * width + normalX * .12,
    y: y + rightY * (px / 384 - .5) * width + normalY * .12, z: z + (.5 - py / 96) * height });
  ctx.boxes.push({ x, y, z, sx: width, sy: .2, sz: height, yaw: heading + Math.PI / 2,
    color: brand.color, material: MAT_SIGN, groundAnchor: { x, y } });
  const face = (corners: readonly [Vec3, Vec3, Vec3] | readonly [Vec3, Vec3, Vec3, Vec3]) => ctx.surfaces?.push({
    corners, color: brand.accent, material: MAT_SIGN, kind: "architecture", groundAnchor: { x, y } });
  const rect = (left: number, top: number, w: number, h: number) => face([point(left, top), point(left + w, top), point(left + w, top + h), point(left, top + h)]);
  for (const r of wordmarkRects(brand.name)) rect(90 + r.x * 5, 25 + r.y * 5, r.width * 5, r.height * 5);
  rect(90, 70, 265, 4);
  for (const polygon of brandIcon(id)) for (let i = 1; i < polygon.length - 1; i++) face([point(...polygon[0]), point(...polygon[i]), point(...polygon[i + 1])]);
}
