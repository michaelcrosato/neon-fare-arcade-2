import {
  BLUE,
  BONE,
  CYAN,
  INK,
  MAT_BUILDING,
  MAT_FOLIAGE,
  MAT_GRASS,
  MAT_LAMP,
  MAT_PERSON,
  MAT_ROAD,
  MAT_SIDEWALK,
  MAT_SIGN,
  MAT_VEHICLE,
  MAT_WINDOW,
  ORANGE,
  PAPER,
  RED,
  STEEL,
  WHITE,
} from "./config";
import { blockRandom } from "./random";
import type { Color, LotContext, LotKind, VenueKind } from "./model";
import { copperMesaAreaForBlock } from "./regions";

export const MESA_SAND: Color = [0.72, 0.49, 0.27, 1];
export const MESA_CREAM: Color = [0.86, 0.68, 0.45, 1];
export const MESA_TERRA: Color = [0.68, 0.25, 0.13, 1];
export const MESA_REDROCK: Color = [0.44, 0.12, 0.09, 1];
export const MESA_SAGUARO: Color = [0.12, 0.38, 0.22, 1];
export const MESA_TURQUOISE: Color = [0.03, 0.58, 0.59, 1];
export const MESA_MAGENTA: Color = [0.78, 0.14, 0.32, 1];
export const MESA_GOLD: Color = [1, 0.59, 0.08, 1];

type DesertPortal = {
  tileX: number;
  tileY: number;
  suffix: string;
  kind: VenueKind;
  x: number;
  y: number;
  heading: number;
};

export type CopperMesaAnchorDefinition = {
  id: string;
  label: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  lot: LotKind;
  portal: DesertPortal;
};

export const COPPER_MESA_ANCHORS = [
  { id: "sundown-gate", label: "SUNDOWN GATE", originX: 1, originY: 25, width: 1, height: 1, lot: "mesa-sundown-gate", portal: { tileX: 0, tileY: 0, suffix: "visitor-depot", kind: "terminal", x: 6.8, y: 4, heading: -Math.PI / 2 } },
  { id: "roadrunner-trading-post", label: "ROADRUNNER TRADING POST", originX: 15, originY: 31, width: 1, height: 1, lot: "mesa-roadrunner-post", portal: { tileX: 0, tileY: 0, suffix: "trading-post", kind: "shop", x: 5.8, y: -1.4, heading: -Math.PI / 2 } },
  { id: "copper-junction", label: "COPPER JUNCTION", originX: -3, originY: 36, width: 3, height: 2, lot: "mesa-copper-junction", portal: { tileX: 1, tileY: 1, suffix: "town-hall", kind: "civic", x: 0, y: 7.4, heading: Math.PI / 2 } },
  { id: "coyote-motor-court", label: "COYOTE MOTOR COURT", originX: -11, originY: 38, width: 2, height: 1, lot: "mesa-coyote-motor-court", portal: { tileX: 0, tileY: 0, suffix: "motel-office", kind: "motel", x: -6, y: 6.5, heading: Math.PI / 2 } },
  { id: "desert-bloom-resort", label: "DESERT BLOOM RESORT", originX: 14, originY: 34, width: 3, height: 2, lot: "mesa-desert-bloom-resort", portal: { tileX: 1, tileY: 1, suffix: "resort-lobby", kind: "hotel", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "dustwind-airpark", label: "DUSTWIND AIRPARK", originX: -15, originY: 45, width: 4, height: 2, lot: "mesa-dustwind-airpark", portal: { tileX: 0, tileY: 1, suffix: "airpark-terminal", kind: "terminal", x: -5.8, y: 12.2, heading: Math.PI / 2 } },
  { id: "ocotillo-arts", label: "OCOTILLO ARTS CENTER", originX: 3, originY: 44, width: 2, height: 2, lot: "mesa-ocotillo-arts", portal: { tileX: 0, tileY: 1, suffix: "gallery", kind: "studio", x: -5.5, y: 7, heading: Math.PI / 2 } },
  { id: "sunstone-solar", label: "SUNSTONE SOLAR FIELD", originX: 9, originY: 46, width: 4, height: 3, lot: "mesa-sunstone-solar", portal: { tileX: 0, tileY: 2, suffix: "operations", kind: "factory", x: -6, y: 12.2, heading: Math.PI / 2 } },
  { id: "saguaro-rodeo", label: "SAGUARO RODEO GROUNDS", originX: -10, originY: 55, width: 3, height: 2, lot: "mesa-saguaro-rodeo", portal: { tileX: 1, tileY: 1, suffix: "rodeo-gate", kind: "civic", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "painted-canyon", label: "PAINTED CANYON", originX: -7, originY: 58, width: 4, height: 3, lot: "mesa-painted-canyon", portal: { tileX: 1, tileY: 2, suffix: "visitor-center", kind: "kiosk", x: -4.5, y: 8, heading: Math.PI / 2 } },
] as const satisfies readonly CopperMesaAnchorDefinition[];

export type CopperMesaAnchorTile = {
  definition: CopperMesaAnchorDefinition;
  tileX: number;
  tileY: number;
};

export function desertAnchorForBlock(blockX: number, blockY: number): CopperMesaAnchorTile | null {
  for (const definition of COPPER_MESA_ANCHORS) {
    const tileX = blockX - definition.originX;
    const tileY = blockY - definition.originY;
    if (tileX >= 0 && tileX < definition.width && tileY >= 0 && tileY < definition.height) {
      return { definition, tileX, tileY };
    }
  }
  return null;
}

const GATE_LOTS = [
  "mesa-adobe-home", "mesa-desert-ranch", "mesa-saguaro-scrub", "mesa-creosote-flat",
  "mesa-gas-stop", "mesa-convenience", "mesa-auto-shop", "mesa-motor-court",
] as const satisfies readonly LotKind[];
const TOWN_LOTS = [
  "mesa-main-street", "mesa-main-street", "mesa-diner", "mesa-pottery-market",
  "mesa-shade-plaza", "mesa-courtyard-home", "mesa-casita", "mesa-motor-court",
  "mesa-convenience", "mesa-auto-shop",
] as const satisfies readonly LotKind[];
const FLATS_LOTS = [
  "mesa-desert-ranch", "mesa-trailer-court", "mesa-adobe-home", "mesa-saguaro-scrub",
  "mesa-saguaro-scrub", "mesa-creosote-flat", "mesa-dry-wash", "mesa-rock-garden",
  "mesa-trailhead", "mesa-gas-stop",
] as const satisfies readonly LotKind[];
const VISTA_LOTS = [
  "mesa-courtyard-home", "mesa-casita", "mesa-adobe-home", "mesa-pottery-market",
  "mesa-shade-plaza", "mesa-rock-garden", "mesa-saguaro-scrub", "mesa-creosote-flat",
  "mesa-motor-court", "mesa-trailhead",
] as const satisfies readonly LotKind[];
const CANYON_LOTS = [
  "mesa-redrock-shelf", "mesa-redrock-shelf", "mesa-dry-wash", "mesa-saguaro-scrub",
  "mesa-creosote-flat", "mesa-rock-garden", "mesa-trailhead", "mesa-desert-ranch",
] as const satisfies readonly LotKind[];

export function desertLotForBlock(blockX: number, blockY: number): LotKind {
  const anchor = desertAnchorForBlock(blockX, blockY);
  if (anchor) return anchor.definition.lot;
  const area = copperMesaAreaForBlock(blockX, blockY);
  const deck = area === "COPPER JUNCTION"
    ? TOWN_LOTS
    : area === "ARROYO VISTA"
      ? VISTA_LOTS
      : area === "PAINTED CANYON"
        ? CANYON_LOTS
        : area === "SAGUARO FLATS"
          ? FLATS_LOTS
          : GATE_LOTS;
  const random = blockRandom(blockX, blockY, 0x4d455341);
  return deck[Math.floor(random() * deck.length) % deck.length];
}

export type DesertPortalSpec = {
  suffix: string;
  kind: VenueKind;
  label: string;
  x: number;
  y: number;
  heading?: number;
};

export function desertPortalSpecs(
  lot: LotKind,
  centerX: number,
  centerY: number,
  blockX: number,
  blockY: number,
): DesertPortalSpec[] {
  const anchor = desertAnchorForBlock(blockX, blockY);
  if (anchor) {
    const portal = anchor.definition.portal;
    if (portal.tileX !== anchor.tileX || portal.tileY !== anchor.tileY) return [];
    return [{ suffix: portal.suffix, kind: portal.kind, label: anchor.definition.label, x: centerX + portal.x, y: centerY + portal.y, heading: portal.heading }];
  }
  const signature = (Math.imul(blockX + 149, 73856093) ^ Math.imul(blockY - 89, 19349663)) >>> 0;
  if (lot === "mesa-trailer-court") {
    return signature % 100 < 36 ? [{ suffix: "front", kind: "residence", label: "COPPER MESA HOME", x: centerX, y: centerY - 9.5 }] : [];
  }
  if (["mesa-adobe-home", "mesa-courtyard-home", "mesa-casita", "mesa-desert-ranch"].includes(lot)) {
    return signature % 100 < 36 ? [{ suffix: "front", kind: "residence", label: "COPPER MESA HOME", x: centerX, y: centerY - 2.45 }] : [];
  }
  if (lot === "mesa-main-street") return [{ suffix: "shop", kind: "shop", label: "COPPER JUNCTION", x: centerX, y: centerY - 2.35 }];
  if (lot === "mesa-diner") return [{ suffix: "counter", kind: "diner", label: "SUNSET DINER", x: centerX, y: centerY - 2.35 }];
  if (lot === "mesa-gas-stop") return [{ suffix: "store", kind: "gas", label: "SUNLINE FUEL", x: centerX + 5.8, y: centerY - 2.2 }];
  if (lot === "mesa-convenience") return [{ suffix: "store", kind: "shop", label: "MESA QUICK STOP", x: centerX + 4.5, y: centerY - 2.3 }];
  if (lot === "mesa-auto-shop") return [{ suffix: "garage", kind: "garage", label: "ROADRUNNER AUTO", x: centerX + 4.5, y: centerY - 2.3 }];
  if (lot === "mesa-motor-court") return [{ suffix: "office", kind: "motel", label: "CACTUS MOTOR COURT", x: centerX + 5.8, y: centerY - 2.2 }];
  if (lot === "mesa-pottery-market") return [{ suffix: "market", kind: "market", label: "OCOTILLO MARKET", x: centerX, y: centerY - 2.35 }];
  if (lot === "mesa-shade-plaza") return [{ suffix: "kiosk", kind: "kiosk", label: "JUNCTION PLAZA", x: centerX + 5.5, y: centerY - 2.4 }];
  return [];
}

function addSolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number) {
  ctx.colliders.push({ id: `${id}:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: sx / 2, halfY: sy / 2, height });
}

function addGround(ctx: LotContext, color: Color = MESA_SAND, size = 24) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.19, sx: size, sy: size, sz: 0.22, yaw: 0, color, material: MAT_GRASS });
}

function addSaguaro(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  ctx.boxes.push({ x, y, z: 2.9 * scale + 0.25, sx: 0.72 * scale, sy: 0.72 * scale, sz: 5.8 * scale, yaw: 0, color: MESA_SAGUARO, material: MAT_FOLIAGE });
  for (const side of [-1, 1]) {
    const armX = x + side * 0.72 * scale;
    const armZ = (2.3 + (side > 0 ? 0.6 : 0)) * scale + 0.25;
    ctx.boxes.push({ x: armX, y, z: armZ, sx: 1.35 * scale, sy: 0.54 * scale, sz: 0.54 * scale, yaw: 0, color: MESA_SAGUARO, material: MAT_FOLIAGE });
    ctx.boxes.push({ x: x + side * 1.28 * scale, y, z: armZ + 0.7 * scale, sx: 0.54 * scale, sy: 0.54 * scale, sz: 1.7 * scale, yaw: 0, color: MESA_SAGUARO, material: MAT_FOLIAGE });
  }
  if (solid) addSolid(ctx, `saguaro-${ctx.boxes.length}`, x, y, 0.8 * scale, 0.8 * scale, 6 * scale);
}

function addAgave(ctx: LotContext, x: number, y: number, color: Color = MESA_TURQUOISE) {
  for (let leaf = 0; leaf < 5; leaf += 1) {
    const yaw = leaf * Math.PI / 2.5;
    ctx.boxes.push({ x: x + Math.cos(yaw) * 0.45, y: y + Math.sin(yaw) * 0.45, z: 0.55, sx: 1.4, sy: 0.28, sz: 0.32, yaw, color, material: MAT_FOLIAGE });
  }
}

function addCreosote(ctx: LotContext, x: number, y: number, scale = 1) {
  const green: Color = [0.24, 0.34, 0.16, 1];
  ctx.boxes.push({ x, y, z: 0.8 * scale, sx: 0.32 * scale, sy: 0.32 * scale, sz: 1.4 * scale, yaw: 0, color: MESA_TERRA, material: MAT_FOLIAGE });
  for (let branch = 0; branch < 5; branch += 1) {
    const yaw = branch * 1.27;
    ctx.boxes.push({
      x: x + Math.cos(yaw) * 0.8 * scale,
      y: y + Math.sin(yaw) * 0.8 * scale,
      z: (1.1 + (branch % 2) * 0.18) * scale,
      sx: 1.45 * scale,
      sy: 0.65 * scale,
      sz: 0.65 * scale,
      yaw,
      color: green,
      material: MAT_FOLIAGE,
    });
  }
}

function addOcotillo(ctx: LotContext, x: number, y: number, scale = 1) {
  for (let stalk = 0; stalk < 6; stalk += 1) {
    const offset = (stalk - 2.5) * 0.38 * scale;
    const lean = (stalk - 2.5) * 0.045;
    ctx.boxes.push({ x: x + offset, y, z: 2.1 * scale, sx: 0.18 * scale, sy: 0.18 * scale, sz: 4.1 * scale, yaw: lean, color: MESA_SAGUARO, material: MAT_FOLIAGE });
    ctx.boxes.push({ x: x + offset + lean * 3, y, z: 4.2 * scale, sx: 0.32 * scale, sy: 0.32 * scale, sz: 0.42 * scale, yaw: 0, color: MESA_MAGENTA, material: MAT_FOLIAGE });
  }
}

function addPricklyPear(ctx: LotContext, x: number, y: number, scale = 1) {
  for (const [offsetX, offsetY, height] of [[-0.65, 0, 1.1], [0, 0.2, 1.55], [0.7, -0.1, 1.25]] as const) {
    ctx.boxes.push({ x: x + offsetX * scale, y: y + offsetY * scale, z: height * 0.55 * scale, sx: 0.75 * scale, sy: 0.28 * scale, sz: height * scale, yaw: offsetX * 0.15, color: MESA_SAGUARO, material: MAT_FOLIAGE });
    ctx.boxes.push({ x: x + offsetX * scale, y: y + offsetY * scale, z: height * scale + 0.22, sx: 0.26, sy: 0.26, sz: 0.3, yaw: 0, color: MESA_MAGENTA, material: MAT_FOLIAGE });
  }
}

function addMesaShelf(ctx: LotContext, x = ctx.centerX, y = ctx.centerY + 2, scale = 1) {
  const tiers = [[18, 14, 3.2], [14.5, 11, 3.1], [10.5, 8, 2.7]] as const;
  let base = 0.28;
  for (let tier = 0; tier < tiers.length; tier += 1) {
    const [sx, sy, sz] = tiers[tier];
    ctx.boxes.push({ x: x + tier * 0.5, y: y + tier * 0.35, z: base + sz * scale / 2, sx: sx * scale, sy: sy * scale, sz: sz * scale, yaw: tier % 2 ? -0.06 : 0.08, color: tier === 1 ? MESA_TERRA : MESA_REDROCK, material: MAT_BUILDING });
    base += sz * scale * 0.78;
  }
  ctx.boxes.push({ x: x + 1.2 * scale, y: y + 0.7 * scale, z: base + 0.28, sx: 10.2 * scale, sy: 7.4 * scale, sz: 0.5, yaw: -0.06, color: MESA_SAND, material: MAT_GRASS });
  addSolid(ctx, `mesa-shelf-${ctx.boxes.length}`, x, y, 18 * scale, 14 * scale, base + 1);
}

function addCanyonCampusShelf(ctx: LotContext, tileX: number, tileY: number) {
  const visitorTile = tileX === 1 && tileY === 2;
  const centerY = ctx.centerY + (visitorTile ? -6 : 0);
  const footprintY = visitorTile ? 24 : 38;
  const tiers = [
    { inset: 0, height: 3.8, color: MESA_REDROCK },
    { inset: 5.5, height: 3.5, color: MESA_TERRA },
    { inset: 10, height: 3.1, color: MESA_REDROCK },
  ] as const;
  let base = 0.3;
  for (let tier = 0; tier < tiers.length; tier += 1) {
    const layer = tiers[tier];
    ctx.boxes.push({
      x: ctx.centerX + (tileX < 2 ? 1.6 : -1.6) * tier,
      y: centerY + (tileY < 1 ? 1.2 : -1.2) * tier,
      z: base + layer.height / 2,
      sx: Math.max(13, 38 - layer.inset * 2),
      sy: Math.max(10, footprintY - layer.inset * 2),
      sz: layer.height,
      yaw: tier % 2 ? -0.025 : 0.02,
      color: layer.color,
      material: MAT_BUILDING,
    });
    base += layer.height * 0.78;
  }
  ctx.boxes.push({ x: ctx.centerX, y: centerY, z: base + 0.3, sx: 18, sy: Math.min(16, footprintY - 6), sz: 0.48, yaw: 0, color: MESA_SAND, material: MAT_GRASS });
  addSolid(ctx, `painted-canyon-shelf-${tileX}-${tileY}`, ctx.centerX, centerY, 38, footprintY, base + 0.8);
}

function addAdobeBuilding(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number, wall: Color = MESA_CREAM, accent: Color = MESA_TURQUOISE) {
  ctx.boxes.push({ x: x + 0.35, y: y + 0.35, z: height / 2 + 0.35, sx: sx + 0.6, sy: sy + 0.6, sz: height, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: height / 2 + 0.4, sx, sy, sz: height, yaw: 0, color: wall, material: MAT_BUILDING });
  ctx.boxes.push({ x, y: y - sy / 2 - 0.06, z: height * 0.58, sx: sx * 0.62, sy: 0.16, sz: 1, yaw: 0, color: accent, material: MAT_WINDOW });
  ctx.boxes.push({ x, y, z: height + 0.52, sx: sx + 0.7, sy: sy + 0.7, sz: 0.48, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
  for (const side of [-1, 1]) ctx.boxes.push({ x: x + side * (sx / 2 - 0.6), y, z: height + 1.05, sx: 0.3, sy: 0.3, sz: 1.6, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
  addSolid(ctx, id, x, y, sx, sy, height + 0.7);
}

function addPerson(ctx: LotContext, x: number, y: number, color: Color) {
  ctx.boxes.push({ x, y, z: 1.05, sx: 0.52, sy: 0.38, sz: 1.25, yaw: 0, color, material: MAT_PERSON });
  ctx.boxes.push({ x, y, z: 1.82, sx: 0.48, sy: 0.48, sz: 0.48, yaw: 0, color: PAPER, material: MAT_PERSON });
}

function addPickup(ctx: LotContext, id: string, x: number, y: number, color: Color = MESA_TERRA) {
  ctx.boxes.push({ x, y, z: 0.72, sx: 4.2, sy: 2.05, sz: 0.72, yaw: Math.PI / 2, color, material: MAT_VEHICLE });
  ctx.boxes.push({ x, y: y - 0.15, z: 1.25, sx: 1.85, sy: 1.55, sz: 0.55, yaw: Math.PI / 2, color: MESA_TURQUOISE, material: MAT_VEHICLE });
  addSolid(ctx, id, x, y, 2.05, 4.2, 1.6);
}

function buildHomeLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx);
  if (lot === "mesa-trailer-court") {
    for (const side of [-1, 1]) {
      const y = ctx.centerY + side * 5;
      ctx.boxes.push({ x: ctx.centerX + side * 2, y, z: 1.9, sx: 12, sy: 4.4, sz: 3.3, yaw: side * 0.03, color: side > 0 ? BONE : MESA_CREAM, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX - 3, y: y - 2.25, z: 1.9, sx: 3.4, sy: 0.15, sz: 1.1, yaw: 0, color: MESA_TURQUOISE, material: MAT_WINDOW });
      addSolid(ctx, `mesa-trailer-${side}`, ctx.centerX + side * 2, y, 12, 4.4, 3.6);
    }
    addSaguaro(ctx, ctx.centerX + 8, ctx.centerY, 0.72, true);
    return;
  }
  const wall = lot === "mesa-casita" ? MESA_TERRA : lot === "mesa-courtyard-home" ? MESA_CREAM : BONE;
  addAdobeBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3, lot === "mesa-desert-ranch" ? 15 : 11.5, 9, lot === "mesa-courtyard-home" ? 6.2 : 4.7, wall, lot === "mesa-casita" ? MESA_GOLD : MESA_TURQUOISE);
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 2, z: 1.15, sx: 10, sy: 4, sz: 0.32, yaw: 0, color: MESA_CREAM, material: MAT_SIDEWALK });
  for (const x of [-4.5, 4.5]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 2, z: 2.4, sx: 0.32, sy: 0.32, sz: 4.3, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 2, z: 4.45, sx: 10.3, sy: 4.3, sz: 0.38, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
  addSaguaro(ctx, ctx.centerX - 8.5, ctx.centerY + 7, 0.8, true);
  addAgave(ctx, ctx.centerX + 8, ctx.centerY + 6);
  if (lot === "mesa-desert-ranch") addPickup(ctx, "mesa-ranch-truck", ctx.centerX + 7.5, ctx.centerY - 6.2, MESA_REDROCK);
}

function buildNatureLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "mesa-dry-wash" ? [0.63, 0.4, 0.23, 1] : lot === "mesa-redrock-shelf" ? MESA_TERRA : MESA_SAND, 24);
  if (lot === "mesa-redrock-shelf") {
    addMesaShelf(ctx);
    addSaguaro(ctx, ctx.centerX - 9, ctx.centerY - 7, 0.7, true);
    return;
  }
  const placements = [[-8, -7], [7.5, -6], [-7, 5.5], [7.8, 7], [0, 2]] as const;
  for (let index = 0; index < placements.length; index += 1) {
    const [x, y] = placements[index];
    const worldX = ctx.centerX + x;
    const worldY = ctx.centerY + y;
    if (lot === "mesa-creosote-flat") addCreosote(ctx, worldX, worldY, 0.7 + ctx.random() * 0.45);
    else if (index % 4 === 0) addOcotillo(ctx, worldX, worldY, 0.65 + ctx.random() * 0.28);
    else if (index % 3 === 0) addPricklyPear(ctx, worldX, worldY, 0.7 + ctx.random() * 0.3);
    else if ((index + ctx.blockX + ctx.blockY) % 2 === 0) addSaguaro(ctx, worldX, worldY, 0.58 + ctx.random() * 0.3, index < 1);
    else addAgave(ctx, worldX, worldY, index % 3 ? MESA_SAGUARO : MESA_TURQUOISE);
  }
  if (lot === "mesa-dry-wash") {
    for (const offset of [-7, -2, 3, 8]) ctx.boxes.push({ x: ctx.centerX + offset, y: ctx.centerY + Math.sin(offset) * 2, z: 0.42, sx: 5, sy: 2.2, sz: 0.25, yaw: 0.28, color: MESA_CREAM, material: MAT_ROAD });
  }
  if (lot === "mesa-rock-garden") {
    for (const [x, y, scale] of [[-5, 1, 1], [1, 4, 1.25], [6, -2, 0.8]] as const) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 0.8 * scale, sx: 3 * scale, sy: 2.4 * scale, sz: 1.5 * scale, yaw: 0.3, color: MESA_REDROCK, material: MAT_BUILDING });
    addSolid(ctx, "mesa-rock-cluster", ctx.centerX + 1, ctx.centerY + 2, 14, 9, 2.5);
  }
  if (lot === "mesa-trailhead") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 2, z: 0.55, sx: 12, sy: 7, sz: 0.2, yaw: 0, color: MESA_CREAM, material: MAT_SIDEWALK });
    ctx.boxes.push({ x: ctx.centerX - 2.5, y: ctx.centerY - 1, z: 2.5, sx: 5.5, sy: 0.35, sz: 3.5, yaw: 0, color: MESA_TERRA, material: MAT_SIGN });
    addPerson(ctx, ctx.centerX + 2.5, ctx.centerY - 2, ORANGE);
  }
}

function buildBusinessLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "mesa-main-street" || lot === "mesa-shade-plaza" ? MESA_CREAM : MESA_SAND);
  const face = lot === "mesa-diner" ? RED : lot === "mesa-pottery-market" ? MESA_TURQUOISE : lot === "mesa-auto-shop" ? ORANGE : MESA_GOLD;
  if (lot === "mesa-gas-stop") {
    addAdobeBuilding(ctx, lot, ctx.centerX + 5.8, ctx.centerY + 3, 9, 7, 4, MESA_CREAM, MESA_TURQUOISE);
    ctx.boxes.push({ x: ctx.centerX - 4.5, y: ctx.centerY - 1.5, z: 3.6, sx: 10, sy: 6.5, sz: 0.55, yaw: 0, color: MESA_TERRA, material: MAT_SIGN });
    for (const x of [-7, -2]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 1.2, sx: 1, sy: 1.2, sz: 1.8, yaw: 0, color: MESA_GOLD, material: MAT_BUILDING });
  } else if (lot === "mesa-motor-court") {
    addAdobeBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3.5, 18, 7.5, 4.2, MESA_CREAM, MESA_MAGENTA);
    addPickup(ctx, "mesa-motel-pickup", ctx.centerX - 7, ctx.centerY - 6.5, BLUE);
  } else if (lot === "mesa-shade-plaza") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.48, sx: 19, sy: 17, sz: 0.18, yaw: 0, color: MESA_CREAM, material: MAT_SIDEWALK });
    for (const x of [-6, 0, 6]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY, z: 2.7, sx: 0.34, sy: 0.34, sz: 4.7, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY, z: 5, sx: 5.2, sy: 6.5, sz: 0.32, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
    }
  } else {
    addAdobeBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3, lot === "mesa-main-street" ? 18 : 13, 8.4, lot === "mesa-main-street" ? 6 : 4.8, lot === "mesa-pottery-market" ? MESA_TERRA : MESA_CREAM, face);
  }
  if (lot !== "mesa-shade-plaza") ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1.35, z: 3.2, sx: lot === "mesa-main-street" ? 15 : 9, sy: 0.3, sz: 1.05, yaw: 0, color: face, material: MAT_SIGN });
  if (lot === "mesa-auto-shop") addPickup(ctx, "mesa-service-truck", ctx.centerX - 7, ctx.centerY - 6.2, MESA_TERRA);
  addSaguaro(ctx, ctx.centerX - 9.2, ctx.centerY + 7, 0.72, true);
  addPerson(ctx, ctx.centerX + 5.5, ctx.centerY - 6.8, face);
}

function addAnchorGround(ctx: LotContext, anchor: CopperMesaAnchorTile, color: Color = MESA_SAND) {
  const west = anchor.tileX > 0 ? 18 : 12;
  const east = anchor.tileX < anchor.definition.width - 1 ? 18 : 12;
  const north = anchor.tileY > 0 ? 18 : 12;
  const south = anchor.tileY < anchor.definition.height - 1 ? 18 : 12;
  ctx.boxes.push({ x: ctx.centerX + (east - west) / 2, y: ctx.centerY + (south - north) / 2, z: 0.2, sx: west + east, sy: north + south, sz: 0.24, yaw: 0, color, material: MAT_GRASS });
}

function buildAnchorLot(ctx: LotContext, anchor: CopperMesaAnchorTile) {
  const { definition, tileX, tileY } = anchor;
  addAnchorGround(ctx, anchor, definition.lot === "mesa-painted-canyon" ? MESA_TERRA : MESA_SAND);
  if (definition.lot === "mesa-sundown-gate") {
    for (const x of [-5.5, 5.5]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 5.2, sx: 2, sy: 2, sz: 9.5, yaw: 0, color: MESA_REDROCK, material: MAT_BUILDING });
      addSolid(ctx, `sundown-gate-${x}`, ctx.centerX + x, ctx.centerY - 1, 2, 2, 10);
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 9.4, sx: 13.5, sy: 1.5, sz: 1.6, yaw: 0, color: MESA_TURQUOISE, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 11, sx: 3.6, sy: 1.2, sz: 3.6, yaw: Math.PI / 4, color: MESA_GOLD, material: MAT_LAMP });
    addAdobeBuilding(ctx, "sundown-depot", ctx.centerX + 6.8, ctx.centerY + 7.5, 7, 5.5, 3.7);
    return;
  }
  if (definition.lot === "mesa-roadrunner-post") {
    buildBusinessLot(ctx, "mesa-gas-stop");
    ctx.boxes.push({ x: ctx.centerX - 8, y: ctx.centerY - 6, z: 7, sx: 0.65, sy: 0.65, sz: 12, yaw: 0, color: INK, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX - 8, y: ctx.centerY - 6, z: 12, sx: 5.5, sy: 0.8, sz: 3.2, yaw: 0, color: MESA_MAGENTA, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX - 6.5, y: ctx.centerY - 6.1, z: 12.4, sx: 2.2, sy: 0.9, sz: 0.55, yaw: 0, color: MESA_GOLD, material: MAT_SIGN });
    return;
  }
  if (definition.lot === "mesa-copper-junction") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + (tileY ? -5 : 9), z: 0.48, sx: 38, sy: tileY ? 16 : 8, sz: 0.22, yaw: 0, color: MESA_CREAM, material: MAT_SIDEWALK });
    for (const x of [-14, -7, 0, 7, 14]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + (tileY ? -5 : 9), z: 3.2, sx: 0.3, sy: 0.3, sz: 5.4, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX + x + 3.5, y: ctx.centerY + (tileY ? -5 : 9), z: 5.8, sx: 6.9, sy: 0.3, sz: 0.3, yaw: 0, color: tileX % 2 ? MESA_TURQUOISE : MESA_MAGENTA, material: MAT_LAMP });
    }
    if (tileY === 0) addAdobeBuilding(ctx, `junction-${tileX}`, ctx.centerX, ctx.centerY + 4, 22, 9, 6 + (tileX === 1 ? 2 : 0), tileX === 1 ? MESA_TERRA : MESA_CREAM, MESA_TURQUOISE);
    if (tileX === 1 && tileY === 1) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 7, sx: 4.2, sy: 4.2, sz: 12.5, yaw: 0, color: MESA_CREAM, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 14, sx: 5.5, sy: 5.5, sz: 1.4, yaw: Math.PI / 4, color: MESA_TERRA, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 3.2, z: 9.5, sx: 2.5, sy: 0.2, sz: 2.5, yaw: 0, color: MESA_GOLD, material: MAT_SIGN });
      addSolid(ctx, "junction-bell-tower", ctx.centerX, ctx.centerY - 1, 4.2, 4.2, 15);
    }
    for (const x of [-7, 7]) addPerson(ctx, ctx.centerX + x, ctx.centerY + (tileY ? 2 : -5), x > 0 ? MESA_TURQUOISE : MESA_MAGENTA);
    return;
  }
  if (definition.lot === "mesa-coyote-motor-court") {
    const wingX = ctx.centerX + (tileX === 0 ? 7 : -7);
    addAdobeBuilding(ctx, `coyote-wing-${tileX}`, wingX, ctx.centerY + 4, 22, 8, 4.8, MESA_CREAM, MESA_MAGENTA);
    if (tileX === 0) {
      ctx.boxes.push({ x: ctx.centerX + 10, y: ctx.centerY - 6, z: 5.5, sx: 0.5, sy: 0.5, sz: 9.5, yaw: 0, color: INK, material: MAT_SIGN });
      ctx.boxes.push({ x: ctx.centerX + 10, y: ctx.centerY - 6, z: 9.2, sx: 5, sy: 0.7, sz: 2.1, yaw: 0, color: MESA_MAGENTA, material: MAT_SIGN });
    } else ctx.boxes.push({ x: ctx.centerX - 5, y: ctx.centerY - 3, z: 0.7, sx: 10, sy: 7, sz: 0.5, yaw: 0, color: BLUE, material: MAT_SIDEWALK });
    return;
  }
  if (definition.lot === "mesa-desert-bloom-resort") {
    const x = ctx.centerX + (tileX - 1) * -6;
    const y = ctx.centerY + (tileY === 0 ? 6 : -5);
    if (!(tileX === 1 && tileY === 0)) addAdobeBuilding(ctx, `bloom-${tileX}-${tileY}`, x, y, 21, 15, tileX === 1 ? 8 : 6, MESA_CREAM, MESA_TURQUOISE);
    else ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.75, sx: 18, sy: 13, sz: 0.55, yaw: 0, color: BLUE, material: MAT_SIDEWALK });
    if (tileX === 1 && tileY === 1) for (const xOff of [-7, 7]) {
      ctx.boxes.push({ x: ctx.centerX + xOff, y: ctx.centerY + 6, z: 3.1, sx: 0.55, sy: 0.55, sz: 5.5, yaw: 0, color: MESA_TERRA, material: MAT_FOLIAGE });
      ctx.boxes.push({ x: ctx.centerX + xOff, y: ctx.centerY + 6, z: 6.1, sx: 4.3, sy: 4.3, sz: 1.2, yaw: 0, color: MESA_SAGUARO, material: MAT_FOLIAGE });
    }
    return;
  }
  if (definition.lot === "mesa-dustwind-airpark") {
    if (tileY === 0) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.42, sx: 38, sy: 19, sz: 0.18, yaw: 0, color: STEEL, material: MAT_ROAD });
      for (const x of [-9, 0, 9]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY, z: 0.55, sx: 5, sy: 0.28, sz: 0.08, yaw: 0, color: WHITE, material: MAT_SIGN });
      if (tileX === 1 || tileX === 2) {
        ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1.5, sx: 8, sy: 1.2, sz: 0.45, yaw: 0, color: MESA_TURQUOISE, material: MAT_VEHICLE });
        ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1.4, sx: 1.2, sy: 6.5, sz: 0.6, yaw: 0, color: MESA_CREAM, material: MAT_VEHICLE });
      }
    } else addAdobeBuilding(ctx, `airpark-hangar-${tileX}`, ctx.centerX, ctx.centerY + 3, 24, 15, 7, MESA_CREAM, ORANGE);
    return;
  }
  if (definition.lot === "mesa-ocotillo-arts") {
    addAdobeBuilding(ctx, `arts-${tileX}-${tileY}`, ctx.centerX + (tileX ? -5 : 5), ctx.centerY + (tileY ? -3 : 5), 20, 16, 6, tileX === tileY ? MESA_TERRA : MESA_CREAM, tileX ? MESA_MAGENTA : MESA_TURQUOISE);
    if (tileX === 1 && tileY === 1) for (let tier = 0; tier < 4; tier += 1) ctx.boxes.push({ x: ctx.centerX + tier * 1.2 - 2, y: ctx.centerY - 8 + tier * 1.8, z: 0.6 + tier * 0.35, sx: 14 - tier * 2, sy: 1.5, sz: 0.45, yaw: 0, color: MESA_GOLD, material: MAT_SIDEWALK });
    return;
  }
  if (definition.lot === "mesa-sunstone-solar") {
    if (tileX === 0 && tileY === 2) addAdobeBuilding(ctx, "solar-ops", ctx.centerX - 5, ctx.centerY + 5, 11, 8, 4.5, MESA_CREAM, MESA_TURQUOISE);
    else for (const y of [-7, 0, 7]) for (const x of [-7, 0, 7]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 1.4, sx: 5.2, sy: 3.3, sz: 0.35, yaw: -0.18, pitch: -0.35, color: BLUE, material: MAT_SIGN });
    if (tileX === 2 && tileY === 1) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 11, sx: 1, sy: 1, sz: 20, yaw: 0, color: STEEL, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 21, sx: 4.5, sy: 4.5, sz: 1.1, yaw: Math.PI / 4, color: MESA_GOLD, material: MAT_LAMP });
      addSolid(ctx, "solar-tower", ctx.centerX, ctx.centerY, 1.2, 1.2, 22);
    }
    return;
  }
  if (definition.lot === "mesa-saguaro-rodeo") {
    if (tileX === 1) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.5, sx: 30, sy: 38, sz: 0.25, yaw: 0, color: MESA_CREAM, material: MAT_ROAD });
      for (const side of [-1, 1]) ctx.boxes.push({ x: ctx.centerX + side * 13, y: ctx.centerY, z: 3, sx: 3, sy: 38, sz: 4.8, yaw: 0, color: MESA_TERRA, material: MAT_BUILDING });
    } else addAdobeBuilding(ctx, `rodeo-${tileX}-${tileY}`, ctx.centerX, ctx.centerY + (tileY ? 4 : 0), 19, 14, 6, MESA_TERRA, MESA_GOLD);
    if (tileX === 1 && tileY === 1) for (const x of [-5, 0, 5]) addPerson(ctx, ctx.centerX + x, ctx.centerY + 8, x ? CYAN : RED);
    return;
  }
  // Painted Canyon is one continuous apparent-elevation campus. It remains
  // physically flat at the perimeter road and visitor portal.
  addCanyonCampusShelf(ctx, tileX, tileY);
  if (tileX === 1 && tileY === 2) {
    ctx.boxes.push({ x: ctx.centerX - 4.5, y: ctx.centerY + 8, z: 0.85, sx: 13, sy: 6, sz: 0.55, yaw: 0, color: MESA_CREAM, material: MAT_SIDEWALK });
    addAdobeBuilding(ctx, "painted-visitor", ctx.centerX - 4.5, ctx.centerY + 3, 12, 7, 4, MESA_CREAM, MESA_TURQUOISE);
  }
}

export function buildDesertLot(ctx: LotContext, lot: LotKind) {
  const anchor = desertAnchorForBlock(ctx.blockX, ctx.blockY);
  if (anchor) {
    buildAnchorLot(ctx, anchor);
    return;
  }
  if (["mesa-adobe-home", "mesa-courtyard-home", "mesa-casita", "mesa-desert-ranch", "mesa-trailer-court"].includes(lot)) buildHomeLot(ctx, lot);
  else if (["mesa-saguaro-scrub", "mesa-creosote-flat", "mesa-dry-wash", "mesa-rock-garden", "mesa-redrock-shelf", "mesa-trailhead"].includes(lot)) buildNatureLot(ctx, lot);
  else buildBusinessLot(ctx, lot);
}

export function copperMesaPedestrianCountForBlock(blockX: number, blockY: number) {
  const area = copperMesaAreaForBlock(blockX, blockY);
  if (area === "COPPER JUNCTION") return 6;
  if (area === "ARROYO VISTA") return 4;
  if (area === "REDROCK GATE") return 3;
  if (area === "PAINTED CANYON") return 2;
  return 2;
}
