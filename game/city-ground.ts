import type { Box, Collider, LotContext, MeshFace } from "./model";
import { MAT_BUILDING, MAT_SIDEWALK, MAT_STONE } from "./config";
import { CITY_STONE, cityTree } from "./city-assets";
import { cityGreenAt } from "./city-layout";
import { terrainHeightAt } from "./terrain/surface";
import { roadSurfaceIndex } from "./road-network";

/** Ground-following paving, emitted in world coordinates before lot lifting. */
export function addCityPaving(ctx: LotContext) {
  if (cityGreenAt(ctx.centerX, ctx.centerY)) return;
  const heights = Array.from({ length: 25 }, (_, i) => terrainHeightAt(ctx.centerX - 12 + Math.floor(i / 5) * 6, ctx.centerY - 12 + (i % 5) * 6));
  if (Math.max(...heights) - Math.min(...heights) < .001) {
    ctx.surfaces?.push({ corners: [[-12, -12], [12, -12], [12, 12], [-12, 12]].map(([dx, dy]) => ({
      x: ctx.centerX + dx, y: ctx.centerY + dy, z: heights[0] + .035 })) as unknown as MeshFace["corners"],
      color: CITY_STONE, material: MAT_SIDEWALK, kind: "architecture" });
    return;
  }
  for (let dx = -12; dx < 12; dx += 6) for (let dy = -12; dy < 12; dy += 6) {
    const x = ctx.centerX + dx, y = ctx.centerY + dy;
    const corners = [[x, y], [x + 6, y], [x + 6, y + 6], [x, y + 6]]
      .map(([px, py]) => ({ x: px, y: py, z: terrainHeightAt(px, py) + .035 }));
    ctx.surfaces?.push({ corners: corners as unknown as MeshFace["corners"],
      color: CITY_STONE, material: MAT_SIDEWALK, kind: "architecture" });
  }
}

/** Curved streets cut through continuous ground, with planting outside every lane. */
export function buildCityVerge(ctx: LotContext) {
  for (const [index, [dx, dy]] of [[-6, -6], [6, -6], [-6, 6], [6, 6]].entries()) {
    const x = ctx.centerX + dx, y = ctx.centerY + dy;
    if (!roadSurfaceIndex.query({ x, y }, 5).length) cityTree(ctx, `verge-${index}`, x, y, .75 + ctx.random() * .3);
  }
}

/** Extend ground-level walls below downhill terrain, keeping their tops fixed. */
export function groundCityFoundations(boxes: readonly Box[], colliders: readonly Collider[], floor: number) {
  const bottomAt = (x: number, y: number, halfX: number, halfY: number) => {
    let bottom = floor;
    // Include every terrain vertex enclosing the footprint. Its triangle
    // interpolation cannot dip below this conservative foundation level.
    for (let px = Math.floor((x - halfX) / 6) * 6; px <= Math.ceil((x + halfX) / 6) * 6; px += 6) {
      for (let py = Math.floor((y - halfY) / 6) * 6; py <= Math.ceil((y + halfY) / 6) * 6; py += 6) {
        bottom = Math.min(bottom, terrainHeightAt(px, py));
      }
    }
    return bottom;
  };
  for (const box of boxes) {
    if (box.groundAnchor || (box.material !== MAT_BUILDING && box.material !== MAT_STONE)
      || Math.abs(box.z - box.sz / 2 - floor) > 1e-8) continue;
    const halfX = (Math.abs(Math.cos(box.yaw)) * box.sx + Math.abs(Math.sin(box.yaw)) * box.sy) / 2;
    const halfY = (Math.abs(Math.sin(box.yaw)) * box.sx + Math.abs(Math.cos(box.yaw)) * box.sy) / 2;
    const extension = floor - bottomAt(box.x, box.y, halfX, halfY);
    box.z -= extension / 2;
    box.sz += extension;
  }
  for (const collider of colliders) {
    if (collider.groundAnchor || Math.abs((collider.baseZ ?? 0) - floor) > 1e-8) continue;
    const bottom = bottomAt(collider.x, collider.y, collider.halfX, collider.halfY);
    collider.height += floor - bottom;
    collider.baseZ = bottom;
  }
}
