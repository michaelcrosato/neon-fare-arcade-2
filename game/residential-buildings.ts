import type { Color, LotContext, LotKind, MeshFace } from "./model";
import { MAT_FOLIAGE, MAT_GENERIC, MAT_GRASS, MAT_ROAD, MAT_SIDEWALK, MAT_SIGN, MAT_TIMBER, MAT_WATER, MAT_WINDOW } from "./config";
import { cedarNeighborhoodForBlock, cedarParcelForBlock, cedarParcelPoint, cedarStreetIndex, residentialAnchorForBlock } from "./residential";
import { cedarBeam, cedarBox, cedarCar, cedarMailbox, cedarPorchLight, cedarRoof, cedarRoundVolume, cedarSolid, cedarTree, cedarWindow,
  CEDAR_AMBER, CEDAR_BLUE, CEDAR_BRICK, CEDAR_CREAM, CEDAR_GLASS, CEDAR_GROUND, CEDAR_ROOF, CEDAR_SAGE, CEDAR_TIMBER, CEDAR_WHITE } from "./cedar-assets";

function hall(ctx: LotContext, id: string, x: number, y: number, width: number, depth: number, height: number, color = CEDAR_CREAM, roof = CEDAR_ROOF) {
  cedarBox(ctx, x, y, 0.12, width + 0.3, depth + 0.3, 0.24, CEDAR_BRICK);
  cedarBox(ctx, x, y, height / 2 + 0.2, width, depth, height, color);
  cedarSolid(ctx, id, x, y, width, depth, height + 0.3);
  cedarRoof(ctx, x, y, height + 0.22, width + 0.8, depth + 0.8, Math.min(3, width * 0.22), roof, color);
  for (let dx = -width / 2 + 2; dx < width / 2 - 1; dx += 3.3) {
    if (Math.abs(dx) > 1.6) cedarWindow(ctx, x + dx, y - depth / 2 - 0.04, 2.1);
    if (height > 5.4) cedarWindow(ctx, x + dx, y - depth / 2 - 0.04, 5.1, 1.4, 1.5);
  }
  for (const dy of [-2, 2.2]) cedarWindow(ctx, x + width / 2 + 0.04, y + dy, 2.1, 1.6, 1.7, true);
  cedarBox(ctx, x, y - depth / 2 - 0.11, 1.35, 1.4, 0.15, 2.3, CEDAR_BLUE);
}

function frontPorch(ctx: LotContext, x = -2, y = -6.3) {
  cedarBox(ctx, x, y, 0.09, 5.8, 2.5, 0.18, CEDAR_CREAM, MAT_SIDEWALK);
  cedarRoof(ctx, x, y, 2.95, 6.1, 2.9, 0.75, CEDAR_ROOF, CEDAR_WHITE);
  for (const dx of [-2.6, 2.6]) {
    cedarBox(ctx, x + dx, y - 0.9, 1.55, 0.22, 0.22, 3, CEDAR_WHITE, MAT_TIMBER);
    cedarSolid(ctx, `porch:${dx}`, x + dx, y - 0.9, 0.24, 0.24, 3);
  }
  cedarBox(ctx, x + 1.4, y - 0.35, 0.5, 1.25, 0.65, 0.7, CEDAR_TIMBER, MAT_TIMBER);
}

function garden(ctx: LotContext, x: number, y: number, small = false) {
  for (let row = 0; row < (small ? 2 : 3); row += 1) {
    cedarBox(ctx, x + row * 2.4, y, 0.18, 1.7, small ? 4 : 7, 0.36, CEDAR_TIMBER, MAT_TIMBER);
    for (let plant = 0; plant < (small ? 2 : 4); plant += 1) cedarBox(ctx, x + row * 2.4, y - (small ? 1 : 2.5) + plant * 1.5, 0.65,
      1, 1, 0.7, plant % 2 ? CEDAR_SAGE : [0.42, 0.57, 0.19, 1], MAT_FOLIAGE);
  }
}

function yard(ctx: LotContext, lot: LotKind) {
  cedarBox(ctx, 0, 1, 0.015, 28, 29, 0.03, CEDAR_GROUND, MAT_GRASS);
  cedarBox(ctx, -2, -11.4, 0.055, 1.5, 7.9, 0.11, CEDAR_CREAM, MAT_SIDEWALK);
  cedarBox(ctx, 6.6, -8.8, 0.045, 4.6, 15.2, 0.09, [0.68, 0.68, 0.6, 1], MAT_SIDEWALK);
  cedarMailbox(ctx, -7.5, -14.3);
  cedarPorchLight(ctx, -4, -10.5);
  if (lot !== "vale-garden-apartments" && lot !== "vale-corner-flats") {
    for (const side of [-1, 1]) {
      cedarBox(ctx, side * 12.5, 3.5, 0.7, 0.2, 16, 1.4, CEDAR_TIMBER, MAT_TIMBER);
      cedarSolid(ctx, `side-fence:${side}`, side * 12.5, 3.5, 0.2, 16, 1.4);
    }
    cedarBox(ctx, 0, 11.5, 0.7, 25, 0.2, 1.4, CEDAR_TIMBER, MAT_TIMBER);
    cedarSolid(ctx, "back-fence", 0, 11.5, 25, 0.2, 1.4);
  }
  cedarTree(ctx, "front-maple", -10.5, -2.6, 0.86 + ctx.random() * 0.1, ctx.random() > 0.65);
  if (lot === "vale-ranch" || lot === "vale-bungalow") {
    cedarBox(ctx, -2, 8.2, 0.055, 7, 4, 0.11, CEDAR_CREAM, MAT_SIDEWALK);
    cedarBox(ctx, -2, 8.2, 0.7, 2.1, 1.1, 0.12, CEDAR_TIMBER, MAT_TIMBER);
  }
}

function home(ctx: LotContext, lot: LotKind) {
  yard(ctx, lot);
  const color = [CEDAR_CREAM, CEDAR_BLUE, CEDAR_SAGE, CEDAR_WHITE, CEDAR_BRICK][Math.floor(ctx.random() * 5)];
  const roof: Color = ctx.random() > 0.6 ? [0.43, 0.31, 0.24, 1] : CEDAR_ROOF;
  const height = lot === "vale-ranch" ? 3.5 : lot === "vale-bungalow" || lot === "vale-cottages" ? 4.1
    : lot === "vale-garden-apartments" ? 8.2 : 6.4;
  const attachedGarage = lot === "vale-ranch" || lot === "vale-bungalow" || lot === "vale-cottages";
  hall(ctx, "home", -2, 0, attachedGarage ? 10.8 : 15.8, 10.4, height, color, roof);
  frontPorch(ctx);
  if (attachedGarage) {
    hall(ctx, "garage", 6.6, 2.5, 6, 6.5, 3, color, roof);
    cedarBox(ctx, 6.6, -0.84, 1.4, 5.1, 0.18, 2.5, CEDAR_WHITE);
    for (const z of [0.6, 1.15, 1.7, 2.25]) cedarBox(ctx, 6.6, -0.96, z, 4.9, 0.06, 0.045, CEDAR_ROOF, MAT_SIGN);
    if (ctx.random() > 0.26) cedarCar(ctx, "family-car", 6.6, -8.7, ctx.random() > 0.5 ? CEDAR_BRICK : CEDAR_BLUE);
  } else if (lot === "vale-corner-flats") {
    cedarBox(ctx, -2, -5.48, 1.65, 10.7, 0.2, 2.2, CEDAR_GLASS, MAT_WINDOW);
    cedarBox(ctx, -2, -6.1, 3.05, 13.5, 1.8, 0.2, CEDAR_BLUE, MAT_SIGN);
    cedarBox(ctx, -2, -5.6, 3.9, 8, 0.2, 0.6, CEDAR_CREAM, MAT_SIGN);
  } else if (lot === "vale-rowhomes" || lot === "vale-duplex") {
    for (const dx of [-7.2, 3.2]) cedarBox(ctx, dx, -5.32, 1.3, 1.2, 0.18, 2.2, CEDAR_BRICK);
  }
  cedarBox(ctx, -5, 2.7, height + 1.5, 0.9, 1.2, 2.5, CEDAR_BRICK);
}

function bench(ctx: LotContext, x: number, y: number) {
  cedarBox(ctx, x, y, 0.65, 2.7, 0.65, 0.18, CEDAR_TIMBER, MAT_TIMBER);
  cedarBox(ctx, x, y + 0.3, 1.12, 2.7, 0.15, 0.75, CEDAR_TIMBER, MAT_TIMBER);
}

function park(ctx: LotContext, lot: LotKind) {
  const neighborhood = cedarNeighborhoodForBlock(ctx.blockX, ctx.blockY);
  const index = cedarStreetIndex();
  const safe = (x: number, y: number) => !index.query({ x, y }, 5).length
    && !Array.from({ length: 9 }, (_, i) => cedarParcelForBlock(Math.floor(x / 36) + i % 3 - 1, Math.floor(y / 36) + Math.floor(i / 3) - 1))
      .some((parcel) => parcel && Math.hypot(parcel.x - x, parcel.y - y) < 16);
  const placements = neighborhood === "pine-ridge" || neighborhood === "garden-end" ? [[-9, -8], [8, 9], [7, -7]] : [[-8, 7], [9, -8]];
  for (const [i, [dx, dy]] of placements.entries()) {
    const x = ctx.centerX + dx, y = ctx.centerY + dy;
    if (safe(x, y)) cedarTree(ctx, `green:${i}`, x, y, 0.8 + ctx.random() * 0.25, neighborhood === "maple-commons");
  }
  if (lot === "vale-community-garden" && safe(ctx.centerX, ctx.centerY)) {
    cedarBox(ctx, ctx.centerX, ctx.centerY, 0.025, 12, 13, 0.05, CEDAR_CREAM, MAT_SIDEWALK);
    garden(ctx, ctx.centerX - 3, ctx.centerY);
    bench(ctx, ctx.centerX, ctx.centerY + 6);
  }
}

function campus(ctx: LotContext, lot: LotKind) {
  const { anchor, tileX, tileY } = residentialAnchorForBlock(ctx.blockX, ctx.blockY)!;
  const left = tileX ? 18 : 11.5, right = tileX < anchor.width - 1 ? 18 : 11.5;
  const top = tileY ? 18 : 11.5, bottom = tileY < anchor.height - 1 ? 18 : 11.5;
  cedarBox(ctx, ctx.centerX + (right - left) / 2, ctx.centerY + (bottom - top) / 2, 0.02,
    left + right, top + bottom, 0.04, lot === "vale-drive-in" ? [0.34, 0.36, 0.33, 1] : CEDAR_GROUND, lot === "vale-drive-in" ? MAT_ROAD : MAT_GENERIC);
  cedarBox(ctx, ctx.centerX, ctx.centerY - 7.5, 0.07, 2, 9, 0.14, CEDAR_CREAM, MAT_SIDEWALK);
  const x = ctx.centerX, y = ctx.centerY;
  if (lot === "vale-school") {
    if (tileY === 0) {
      const wingLeft = tileX === 0 ? 8 : 17.6, wingRight = tileX === 2 ? 8 : 17.6;
      hall(ctx, `school-wing:${tileX}`, x + (wingRight - wingLeft) / 2, y + 3, wingLeft + wingRight, 18, tileX === 1 ? 6.3 : 5.3, CEDAR_BRICK);
      cedarBox(ctx, x, y - 6.3, 4.2, 15, 0.3, 0.75, CEDAR_CREAM, MAT_SIGN);
      if (tileX === 1) {
        cedarRoof(ctx, x, y - 7.5, 3.3, 9, 4, 1.1);
        cedarRoundVolume(ctx, x, y + 3, [{ z: 8.8, radius: 1.9 }, { z: 11, radius: 1.9 }, { z: 12.3, radius: 0.1 }], CEDAR_CREAM, MAT_GENERIC, 8);
      }
    } else if (tileX === 0) {
      hall(ctx, "school-gym", x - 3, y + 2, 21, 17, 5.6, CEDAR_CREAM);
      cedarCar(ctx, "school-bus", x + 11.5, y, CEDAR_AMBER, true);
    } else {
      cedarBox(ctx, x, y, 0.04, 36, 24, 0.08, [0.39, 0.59, 0.32, 1], MAT_GENERIC);
      for (const dy of [-10, 10]) cedarBox(ctx, x, y + dy, 0.1, 36, 0.15, 0.03, CEDAR_WHITE, MAT_SIDEWALK);
      if (tileX === 1) cedarBox(ctx, x + 17.8, y, 0.1, 0.15, 20, 0.03, CEDAR_WHITE, MAT_SIDEWALK);
      const goalX = x + (tileX === 1 ? -13 : 13);
      for (const dy of [-3, 3]) cedarBox(ctx, goalX, y + dy, 1.3, 0.18, 0.18, 2.6, CEDAR_WHITE);
      cedarBox(ctx, goalX, y, 2.6, 0.18, 6.2, 0.18, CEDAR_WHITE);
    }
  } else if (lot === "vale-commons") {
    cedarBox(ctx, x, y + (bottom - top) / 2, 0.065, 2.6, top + bottom, 0.13, CEDAR_CREAM, MAT_SIDEWALK);
    cedarBox(ctx, x + (right - left) / 2, y, 0.065, left + right, 2.6, 0.13, CEDAR_CREAM, MAT_SIDEWALK);
    if (tileX === 0 && tileY === 0) {
      cedarBox(ctx, x, y + 1, 0.12, 9, 8, 0.24, CEDAR_CREAM, MAT_SIDEWALK);
      cedarRoof(ctx, x, y + 1, 3.7, 10, 9, 2.4, CEDAR_BLUE);
      for (const dx of [-3.8, 3.8]) for (const dy of [-2.3, 4.3]) {
        cedarBox(ctx, x + dx, y + dy, 1.9, 0.3, 0.3, 3.8, CEDAR_WHITE);
        cedarSolid(ctx, `pavilion:${dx}:${dy}`, x + dx, y + dy, 0.35, 0.35, 3.8);
      }
      cedarSolid(ctx, "pavilion-roof", x, y + 1, 10, 9, 2.4, 3.7);
    } else {
      cedarTree(ctx, "common-oak", x - 5, y + 4, 1.12, true);
      bench(ctx, x + 6, y - 3); bench(ctx, x + 6, y + 4);
    }
  } else if (lot === "vale-pool") {
    if (tileX === 0 && tileY === 0) {
      cedarBox(ctx, x, y + 2, 0.08, 22, 20, 0.16, CEDAR_CREAM, MAT_SIDEWALK);
      cedarBox(ctx, x, y + 2, 0.18, 16, 12, 0.12, CEDAR_BLUE, MAT_WATER);
      const id = `brookside-pool:${ctx.blockX}:${ctx.blockY}`;
      ctx.colliders.push({ id, x, y: y + 2, halfX: 8, halfY: 6, height: 0.45 });
      ctx.surfaceRegions.push({ id, kind: "water", x, y: y + 2, halfX: 8, halfY: 6, yaw: 0 });
      for (const dx of [-9.5, 9.5]) for (const dy of [-4, 2, 8]) cedarBox(ctx, x + dx, y + dy, 0.5, 1.2, 2.5, 0.25, CEDAR_WHITE);
    } else if (tileX === 1 && tileY === 0) hall(ctx, "recreation-club", x, y + 2, 21, 15, 5, CEDAR_CREAM, CEDAR_BLUE);
    else {
      cedarBox(ctx, x, y, 0.045, 23, 27, 0.09, CEDAR_BLUE, MAT_GENERIC);
      cedarBox(ctx, x, y, 0.11, 21, 0.15, 0.03, CEDAR_WHITE, MAT_SIDEWALK);
      for (const dy of [-11, 11]) { cedarBox(ctx, x, y + dy, 1.8, 0.2, 0.2, 3.6, CEDAR_ROOF); cedarBox(ctx, x, y + dy, 3.4, 2.2, 0.2, 1.3, CEDAR_WHITE); }
    }
  } else if (lot === "vale-library") {
    const wingLeft = tileX === 0 ? 8 : 17.6, wingRight = tileX === 1 ? 8 : 17.6;
    hall(ctx, `library:${tileX}`, x + (wingRight - wingLeft) / 2, y + 2, wingLeft + wingRight, 15, 5.2, CEDAR_CREAM);
    cedarBox(ctx, x, y - 5.7, 2.5, 21, 0.18, 2.6, CEDAR_GLASS, MAT_WINDOW);
    cedarBox(ctx, x, y - 5.9, 4.35, 15, 0.2, 0.7, CEDAR_BLUE, MAT_SIGN);
    bench(ctx, x - 9, y - 8);
  } else if (lot === "vale-firehouse") {
    hall(ctx, "engine-house", x, y + 2, 20, 13, 5.3, CEDAR_BRICK);
    for (const dx of [-5, 5]) cedarBox(ctx, x + dx, y - 4.6, 1.8, 6.6, 0.2, 3.2, CEDAR_WHITE);
    cedarBox(ctx, x, y - 4.8, 4, 13, 0.2, 0.7, CEDAR_AMBER, MAT_SIGN);
  } else if (lot === "vale-water-tower") {
    const center = { x, y: y + 2 };
    cedarRoundVolume(ctx, center.x, center.y, [{ z: 12.5, radius: 3.4 }, { z: 14, radius: 4.8 }, { z: 19, radius: 4.8 }, { z: 21.3, radius: 0.1 }], CEDAR_BLUE, MAT_GENERIC, 12);
    cedarSolid(ctx, "water-tank", center.x, center.y, 9.6, 9.6, 8.8, 12.5);
    for (const dx of [-3.3, 3.3]) for (const dy of [-3.3, 3.3]) {
      cedarBox(ctx, x + dx, center.y + dy, 6.5, 0.38, 0.38, 13, CEDAR_WHITE);
      cedarSolid(ctx, `tower-leg:${dx}:${dy}`, x + dx, center.y + dy, 0.45, 0.45, 13);
      cedarBeam(ctx, { x: x + dx, y: center.y + dy, z: 3.5 }, { x: x - dx, y: center.y + dy, z: 10 }, 0.18);
    }
  } else if (lot === "vale-drive-in") {
    if (tileX === 2) {
      const screenTop = tileY === 0 ? 8 : 18, screenBottom = tileY === 1 ? 8 : 18;
      const screenY = y + (screenBottom - screenTop) / 2, length = screenTop + screenBottom;
      cedarBox(ctx, x + 7, screenY, 8, 0.8, length, 15, CEDAR_ROOF);
      cedarBox(ctx, x + 6.52, screenY, 8.5, 0.12, length, 12.5, CEDAR_CREAM, MAT_SIGN);
      cedarSolid(ctx, "moonbeam-screen", x + 7, screenY, 0.9, length, 15.5);
    } else if (tileX === 0 && tileY === 0) hall(ctx, "moonbeam-ticket-office", x, y - 1, 11, 10, 3.7, CEDAR_CREAM, CEDAR_BLUE);
    else for (const dx of [-8, 0, 8]) for (const dy of [-7, 5]) {
      cedarCar(ctx, `movie-car:${dx}:${dy}`, x + dx, y + dy, (dx + dy) % 3 ? CEDAR_BLUE : CEDAR_BRICK, false, Math.PI / 2);
      for (const side of [-1, 1]) ctx.surfaces?.push({ corners: [
        { x: x + dx - 3, y: y + dy + side * 2 - 0.05, z: 0.1 }, { x: x + dx + 3, y: y + dy + side * 2 - 0.05, z: 0.1 },
        { x: x + dx + 3, y: y + dy + side * 2 + 0.05, z: 0.1 }, { x: x + dx - 3, y: y + dy + side * 2 + 0.05, z: 0.1 },
      ], color: CEDAR_CREAM, material: MAT_SIDEWALK, kind: "architecture" });
      cedarBox(ctx, x + dx + 1.5, y + dy - 2.4, 0.8, 0.12, 0.12, 1.6, CEDAR_ROOF);
      cedarBox(ctx, x + dx + 1.5, y + dy - 2.4, 1.55, 0.42, 0.25, 0.45, CEDAR_CREAM);
    }
  } else {
    hall(ctx, "gateway-station", x + 1, y + 2, 18, 12, 4.4, CEDAR_CREAM);
    cedarRoof(ctx, x, y - 5.7, 3.1, 19, 4, 0.9, CEDAR_BLUE);
    bench(ctx, x - 5, y - 6.5);
  }
  if (anchor.width === 1 && lot !== "vale-water-tower") cedarMailbox(ctx, x - 9, y - 9);
}

export function buildResidentialLot(ctx: LotContext, lot: LotKind) {
  if (residentialAnchorForBlock(ctx.blockX, ctx.blockY)) { campus(ctx, lot); return; }
  const parcel = cedarParcelForBlock(ctx.blockX, ctx.blockY);
  if (!parcel || lot === "vale-pocket-park" || lot === "vale-community-garden" || lot === "vale-recreation") { park(ctx, lot); return; }
  const local: LotContext = { ...ctx, centerX: 0, centerY: 0, boxes: [], surfaces: [], colliders: [], surfaceRegions: [] };
  home(local, lot);
  for (const box of local.boxes) ctx.boxes.push({ ...box, ...cedarParcelPoint(parcel, box.x, box.y), yaw: box.yaw + parcel.heading });
  for (const collider of local.colliders) ctx.colliders.push({ ...collider, ...cedarParcelPoint(parcel, collider.x, collider.y), yaw: (collider.yaw ?? 0) + parcel.heading });
  for (const face of local.surfaces ?? []) ctx.surfaces?.push({ ...face,
    corners: face.corners.map((point) => ({ ...cedarParcelPoint(parcel, point.x, point.y), z: point.z })) as unknown as MeshFace["corners"] });
}
