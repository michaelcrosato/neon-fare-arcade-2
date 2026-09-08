import {
  BLUE,
  BONE,
  CYAN,
  INK,
  MAT_TIMBER,
  MAT_STONE,
  MAT_SNOW,
  MAT_GENERIC,
  MAT_FOLIAGE,
  MAT_GRASS,
  MAT_LAMP,
  MAT_PERSON,
  MAT_SIDEWALK,
  MAT_SIGN,
  MAT_VEHICLE,
  MAT_WATER,
  MAT_WINDOW,
  ORANGE,
  PAPER,
  RED,
  STEEL,
  WHITE,
  YELLOW,
} from "./config";
import { gabledRoof, taperedSpire, facetedBoulder, observatoryDome } from "./architecture";
import { northstarSettlementPlan } from "./terrain/settlement";
import { naturalTerrainHeight, northstarStationReserved, northstarSnowRun } from "./terrain/northstar-forms";
import { blockRandom } from "./random";
import type { Color, LotContext, LotKind, VenueKind } from "./model";
import { northstarRangeAreaForBlock } from "./regions";

export const RANGE_GROUND: Color = [0.16, 0.25, 0.2, 1];
export const RANGE_SPRUCE: Color = [0.045, 0.2, 0.14, 1];
export const RANGE_PINE: Color = [0.09, 0.31, 0.2, 1];
export const RANGE_MOSS: Color = [0.29, 0.43, 0.25, 1];
export const RANGE_GRANITE: Color = [0.34, 0.38, 0.39, 1];
export const RANGE_SLATE: Color = [0.18, 0.29, 0.33, 1];
export const RANGE_SNOW: Color = [0.9, 0.92, 0.86, 1];
export const RANGE_TIMBER: Color = [0.31, 0.16, 0.09, 1];
export const RANGE_BERRY: Color = [0.58, 0.08, 0.12, 1];
export const RANGE_AMBER: Color = [1, 0.55, 0.12, 1];

type MountainPortal = {
  tileX: number;
  tileY: number;
  suffix: string;
  kind: VenueKind;
  x: number;
  y: number;
  heading: number;
};

export type NorthstarAnchorDefinition = {
  id: string;
  label: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  lot: LotKind;
  portal: MountainPortal;
};

export const NORTHSTAR_RANGE_ANCHORS = [
  { id: "northstar-gate", label: "NORTHSTAR GATE", originX: -1, originY: -26, width: 1, height: 1, lot: "range-northstar-gate", portal: { tileX: 0, tileY: 0, suffix: "visitor-depot", kind: "terminal", x: 6.8, y: 3.2, heading: -Math.PI / 2 } },
  { id: "copper-pass-gas", label: "TIMBER PASS GAS & GENERAL", originX: 12, originY: -30, width: 1, height: 1, lot: "range-copper-gas", portal: { tileX: 0, tileY: 0, suffix: "store", kind: "gas", x: 6.6, y: -1.1, heading: -Math.PI / 2 } },
  { id: "northstar-village-square", label: "NORTHSTAR VILLAGE SQUARE", originX: -3, originY: -41, width: 3, height: 2, lot: "range-village-square", portal: { tileX: 1, tileY: 1, suffix: "town-hall", kind: "civic", x: 0, y: 6.8, heading: Math.PI / 2 } },
  { id: "timberline-lodge", label: "TIMBERLINE LODGE", originX: 4, originY: -43, width: 2, height: 2, lot: "range-timberline-lodge", portal: { tileX: 0, tileY: 1, suffix: "front-desk", kind: "hotel", x: 5.8, y: 7.2, heading: Math.PI / 2 } },
  { id: "pinewatch-ranger", label: "PINEWATCH RANGER STATION", originX: -16, originY: -43, width: 1, height: 1, lot: "range-ranger-station", portal: { tileX: 0, tileY: 0, suffix: "ranger-desk", kind: "civic", x: 0, y: -2.4, heading: -Math.PI / 2 } },
  { id: "old-spruce-mill", label: "OLD SPRUCE MILL", originX: -17, originY: -50, width: 2, height: 2, lot: "range-old-spruce-mill", portal: { tileX: 1, tileY: 1, suffix: "mill-office", kind: "factory", x: -7, y: 7, heading: Math.PI / 2 } },
  { id: "mirror-lake", label: "MIRROR LAKE", originX: 10, originY: -53, width: 6, height: 4, lot: "range-mirror-lake", portal: { tileX: 0, tileY: 2, suffix: "fishing-lodge", kind: "marina", x: -5.8, y: 6.8, heading: Math.PI / 2 } },
  { id: "silver-run-resort", label: "SILVER RUN RESORT", originX: -3, originY: -63, width: 5, height: 3, lot: "range-silver-run-resort", portal: { tileX: 2, tileY: 2, suffix: "resort-lobby", kind: "hotel", x: 0, y: 12.2, heading: Math.PI / 2 } },
  { id: "aurora-lookout", label: "AURORA LOOKOUT", originX: 10, originY: -63, width: 2, height: 2, lot: "range-aurora-lookout", portal: { tileX: 0, tileY: 1, suffix: "visitor-kiosk", kind: "kiosk", x: -5.5, y: 12.5, heading: Math.PI / 2 } },
] as const satisfies readonly NorthstarAnchorDefinition[];

export type NorthstarAnchorTile = {
  definition: NorthstarAnchorDefinition;
  tileX: number;
  tileY: number;
};

export function mountainAnchorForBlock(blockX: number, blockY: number): NorthstarAnchorTile | null {
  for (const definition of NORTHSTAR_RANGE_ANCHORS) {
    const tileX = blockX - definition.originX;
    const tileY = blockY - definition.originY;
    if (tileX >= 0 && tileX < definition.width && tileY >= 0 && tileY < definition.height) {
      return { definition, tileX, tileY };
    }
  }
  return null;
}

const PASS_LOTS = [
  "range-cabin", "range-farmstead", "range-forest-clearing", "range-meadow",
  "range-general-store", "range-roadside-motel", "range-gas-stop", "range-workshop",
] as const satisfies readonly LotKind[];
const VILLAGE_LOTS = [
  "range-main-street", "range-main-street", "range-general-store", "range-diner",
  "range-outfitter", "range-workshop", "range-roadside-motel", "range-chalet",
  "range-ski-rental", "range-meadow",
] as const satisfies readonly LotKind[];
const WOODS_LOTS = [
  "range-cabin", "range-a-frame", "range-farmstead", "range-forest-clearing",
  "range-forest-clearing", "range-rocky-grove", "range-campground", "range-trailhead",
  "range-workshop", "range-meadow",
] as const satisfies readonly LotKind[];
const LAKE_LOTS = [
  "range-lakeside-home", "range-lakeside-home", "range-cabin", "range-campground",
  "range-trailhead", "range-forest-clearing", "range-rocky-grove", "range-meadow",
] as const satisfies readonly LotKind[];
const SILVER_LOTS = [
  "range-chalet", "range-a-frame", "range-ski-rental", "range-snowfield",
  "range-snowfield", "range-lift-support", "range-rocky-grove", "range-trailhead",
  "range-forest-clearing", "range-cabin",
] as const satisfies readonly LotKind[];

export function mountainLotForBlock(blockX: number, blockY: number): LotKind {
  const anchor = mountainAnchorForBlock(blockX, blockY);
  if (anchor) return anchor.definition.lot;
  if (!northstarSettlementPlan(blockX, blockY)) {
    const height = naturalTerrainHeight(blockX * 36 + 18, blockY * 36 + 18);
    const wilderness = blockRandom(blockX, blockY, 0x4d544e)();
    return height > 154 ? "range-snowfield" : wilderness < 0.14 ? "range-rocky-grove"
      : wilderness < 0.28 ? "range-meadow" : "range-forest-clearing";
  }
  const area = northstarRangeAreaForBlock(blockX, blockY);
  const deck = area === "NORTHSTAR VILLAGE"
    ? VILLAGE_LOTS
    : area === "MIRROR LAKE"
      ? LAKE_LOTS
      : area === "SILVER RUN"
        ? SILVER_LOTS
        : area === "PINEHOOK WOODS"
          ? WOODS_LOTS
          : PASS_LOTS;
  const random = blockRandom(blockX, blockY, 0x4e535452);
  return deck[Math.floor(random() * deck.length) % deck.length];
}

export type MountainPortalSpec = {
  suffix: string;
  kind: VenueKind;
  label: string;
  x: number;
  y: number;
  heading?: number;
};

export function mountainPortalSpecs(
  lot: LotKind,
  centerX: number,
  centerY: number,
  blockX: number,
  blockY: number,
): MountainPortalSpec[] {
  const anchor = mountainAnchorForBlock(blockX, blockY);
  if (anchor) {
    const portal = anchor.definition.portal;
    if (portal.tileX !== anchor.tileX || portal.tileY !== anchor.tileY) return [];
    return [{
      suffix: portal.suffix,
      kind: portal.kind,
      label: anchor.definition.label,
      x: centerX + portal.x,
      y: centerY + portal.y,
      heading: portal.heading,
    }];
  }
  const signature = (Math.imul(blockX + 101, 73856093) ^ Math.imul(blockY - 73, 19349663)) >>> 0;
  const residence = signature % 100 < 38;
  if (["range-cabin", "range-a-frame", "range-farmstead", "range-lakeside-home", "range-chalet"].includes(lot)) {
    return residence ? [{ suffix: "front", kind: "residence", label: "NORTHSTAR HOME", x: centerX, y: centerY - 2.5 }] : [];
  }
  if (lot === "range-main-street") return [{ suffix: "shop", kind: "shop", label: "NORTHSTAR MAIN STREET", x: centerX, y: centerY - 2.35 }];
  if (lot === "range-general-store") return [{ suffix: "store", kind: "shop", label: "RANGE GENERAL", x: centerX + 4.8, y: centerY - 2.35 }];
  if (lot === "range-diner") return [{ suffix: "counter", kind: "diner", label: "SWITCHBACK DINER", x: centerX, y: centerY - 2.35 }];
  if (lot === "range-outfitter") return [{ suffix: "gear", kind: "shop", label: "SUMMIT OUTFITTERS", x: centerX, y: centerY - 2.35 }];
  if (lot === "range-workshop") return [{ suffix: "garage", kind: "garage", label: "PINEHOOK MOTOR WORKS", x: centerX + 4.5, y: centerY - 2.35 }];
  if (lot === "range-roadside-motel") return [{ suffix: "office", kind: "motel", label: "TIMBER PASS MOTEL", x: centerX + 6.2, y: centerY - 2.2 }];
  if (lot === "range-gas-stop") return [{ suffix: "store", kind: "gas", label: "NORTHSTAR FUEL", x: centerX + 5.8, y: centerY - 2.2 }];
  if (lot === "range-ski-rental") return [{ suffix: "rental", kind: "shop", label: "SILVER RUN RENTALS", x: centerX, y: centerY - 2.35 }];
  return [];
}

function addSolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number) {
  ctx.colliders.push({ id: `${id}:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: sx / 2, halfY: sy / 2, height });
}

function addGround(ctx: LotContext, color: Color = RANGE_MOSS, size = 23.2) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.2, sx: size, sy: size, sz: 0.22, yaw: 0, color, material: MAT_GRASS });
}

function addPine(ctx: LotContext, x: number, y: number, scale = 1, solid = false, snowy = false) {
  const groundAnchor = { x, y };
  const height = (snowy ? 9 : 13) * scale;
  ctx.boxes.push({ x, y, z: height * 0.28, sx: 0.65 * scale, sy: 0.65 * scale, sz: height * 0.56,
    yaw: 0, color: RANGE_TIMBER, material: MAT_FOLIAGE, groundAnchor });
  for (let tier = 0; tier < 2; tier += 1) {
    ctx.surfaces?.push(...taperedSpire({ x, y, z: height * (0.19 + tier * 0.3) },
      (3.6 - tier) * scale, height * 0.55, tier ? RANGE_PINE : RANGE_SPRUCE, 4, MAT_FOLIAGE, groundAnchor));
  }
  if (snowy) ctx.surfaces?.push(...taperedSpire({ x, y, z: height * 0.81 }, 1.05 * scale, height * 0.23, RANGE_SNOW, 4, MAT_SNOW, groundAnchor));
  if (solid) ctx.colliders.push({ id: `pine:${ctx.blockX}:${ctx.blockY}:${ctx.boxes.length}`,
    x, y, halfX: 0.4 * scale, halfY: 0.4 * scale, height, groundAnchor });
}

function addBoulder(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  ctx.surfaces?.push(...facetedBoulder({ x, y, z: 0 }, 3.2 * scale, 2.5 * scale, 2.2 * scale, RANGE_GRANITE));
  if (solid) ctx.colliders.push({ id: `rock:${ctx.blockX}:${ctx.blockY}:${ctx.colliders.length}`,
    x, y, halfX: 1.45 * scale, halfY: 1.15 * scale, height: 2.2 * scale, groundAnchor: { x, y } });
}

function addRockShelf(ctx: LotContext, snowy = false) {
  const x = ctx.centerX + 2.4, y = ctx.centerY + 3.2;
  ctx.surfaces?.push(...facetedBoulder({ x, y, z: -1 }, 15, 10, 8, RANGE_GRANITE));
  if (snowy) ctx.surfaces?.push(...taperedSpire({ x: x + 1, y, z: 5.5 }, 4, 2.4, RANGE_SNOW, 5, MAT_SNOW, { x, y }));
  ctx.colliders.push({ id: `rock-shelf:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: 5.5, halfY: 3.5, height: 7, groundAnchor: { x, y } });
}

function addMountainBuilding(
  ctx: LotContext,
  id: string,
  x: number,
  y: number,
  sx: number,
  sy: number,
  height: number,
  wall: Color = RANGE_TIMBER,
  roof: Color = RANGE_SLATE,
) {
  ctx.boxes.push({ x, y, z: height / 2 + 0.5, sx, sy, sz: height, yaw: 0, color: wall, material: MAT_TIMBER });
  ctx.boxes.push({ x, y: y - sy / 2 - 0.06, z: height * 0.57, sx: sx * 0.7, sy: 0.16, sz: 1.05, yaw: 0, color: RANGE_AMBER, material: MAT_LAMP });
  const roofRise = id.includes("a-frame") ? sx * 0.62 : Math.min(7, sx * 0.3);
  ctx.surfaces?.push(...gabledRoof(x, y, height + 0.5, sx + 2.2, sy + 2.4, roofRise, roof, wall));
  ctx.boxes.push({ x, y, z: 0.55, sx: sx + 0.5, sy: sy + 0.5, sz: 1.05, yaw: 0, color: RANGE_GRANITE, material: MAT_STONE });
  for (const side of [-1, 1]) {
    ctx.boxes.push({ x: x + side * sx * 0.43, y: y - sy / 2 - 0.12, z: height / 2 + 0.5,
      sx: 0.28, sy: 0.24, sz: height, yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
    ctx.boxes.push({ x: x + side * sx * 0.27, y: y - sy / 2 - 0.15, z: height * 0.63,
      sx: sx * 0.2, sy: 0.2, sz: Math.min(1.65, height * 0.3), yaw: 0, color: RANGE_AMBER, material: MAT_LAMP });
  }
  ctx.boxes.push({ x, y: y - sy / 2 - 0.25, z: height + 0.35, sx: sx + 1.1, sy: 0.28, sz: 0.4,
    yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
  ctx.boxes.push({ x: x + sx * 0.28, y: y + sy * 0.1, z: height + roofRise + 0.5, sx: 1, sy: 1, sz: 2.2, yaw: 0, color: RANGE_GRANITE, material: MAT_STONE });
  addSolid(ctx, id, x, y, sx, sy, height + roofRise + 0.5);
}

function addPerson(ctx: LotContext, x: number, y: number, color: Color) {
  ctx.boxes.push({ x, y, z: 1.05, sx: 0.52, sy: 0.38, sz: 1.25, yaw: 0, color, material: MAT_PERSON });
  ctx.boxes.push({ x, y, z: 1.82, sx: 0.48, sy: 0.48, sz: 0.48, yaw: 0, color: PAPER, material: MAT_PERSON });
}

function addPickup(ctx: LotContext, id: string, x: number, y: number, color: Color = RANGE_BERRY) {
  ctx.boxes.push({ x, y, z: 0.72, sx: 4.1, sy: 2, sz: 0.72, yaw: Math.PI / 2, color, material: MAT_VEHICLE });
  ctx.boxes.push({ x, y: y - 0.15, z: 1.25, sx: 1.8, sy: 1.55, sz: 0.55, yaw: Math.PI / 2, color: CYAN, material: MAT_VEHICLE });
  addSolid(ctx, id, x, y, 2, 4.1, 1.6);
}

function addForest(ctx: LotContext, count = 7, snowy = false) {
  const positions = [
    [-8.5, -8], [-2.8, -7.5], [7.4, -8.2], [-8.2, 1.5], [8.4, 1.2], [-6.7, 8], [2.5, 7.8], [8.2, 7.2],
  ] as const;
  for (let index = 0; index < Math.min(count, positions.length); index += 1) {
    const [x, y] = positions[(index + Math.abs(ctx.blockX + ctx.blockY)) % positions.length];
    addPine(ctx, ctx.centerX + x + (ctx.random() - 0.5) * 3, ctx.centerY + y + (ctx.random() - 0.5) * 3,
      0.65 + ctx.random() * 0.6, index < 2, snowy);
  }
}

function buildHomeLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "range-lakeside-home" ? [0.21, 0.38, 0.31, 1] : RANGE_MOSS);
  const wall = lot === "range-a-frame" ? RANGE_BERRY : lot === "range-chalet" ? BONE : RANGE_TIMBER;
  addMountainBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3, lot === "range-farmstead" ? 13 : 10.5, 8.5, lot === "range-chalet" ? 6.5 : 4.5, wall, lot === "range-chalet" ? RANGE_BERRY : RANGE_SLATE);
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1.55, z: 0.68, sx: 8.5, sy: 2.4, sz: 0.25, yaw: 0, color: RANGE_TIMBER, material: MAT_SIDEWALK });
  if (lot === "range-farmstead") {
    addMountainBuilding(ctx, "range-barn", ctx.centerX - 7, ctx.centerY - 4.5, 6, 6, 4, RANGE_BERRY, RANGE_SLATE);
    addPickup(ctx, "range-farm-truck", ctx.centerX + 7.5, ctx.centerY - 6.5, RANGE_MOSS);
  } else {
    addPine(ctx, ctx.centerX - 8, ctx.centerY + 7, 0.8, true, lot === "range-chalet");
    addPine(ctx, ctx.centerX + 8, ctx.centerY + 7.5, 0.75, false, lot === "range-chalet");
  }
}

function buildNatureLot(ctx: LotContext, lot: LotKind) {

  if (lot === "range-meadow") {
    for (const [x, y, color] of [[-6, -4, YELLOW], [4, -6, WHITE], [-2, 5, RED], [7, 4, CYAN]] as const) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY + y, z: 0.58, sx: 0.38, sy: 0.38, sz: 0.7, yaw: 0, color, material: MAT_FOLIAGE });
    }
    addPine(ctx, ctx.centerX + 8, ctx.centerY + 7, 0.78, true);
    return;
  }
  const altitude = naturalTerrainHeight(ctx.centerX, ctx.centerY);
  addForest(ctx, lot === "range-forest-clearing" ? 5 : altitude > 185 ? 0 : lot === "range-snowfield" ? 1 : 3, lot === "range-snowfield");
  if (lot === "range-rocky-grove" || lot === "range-snowfield") {
    addRockShelf(ctx, lot === "range-snowfield");
    addBoulder(ctx, ctx.centerX + 7.2, ctx.centerY - 5.4, 1.05, true);
  }
  if (lot === "range-campground") {
    for (const side of [-1, 1]) {
      ctx.boxes.push({ x: ctx.centerX + side * 4.5, y: ctx.centerY + 1, z: 1.15, sx: 4.4, sy: 3.2, sz: 2, yaw: side * 0.15, color: side > 0 ? ORANGE : BLUE, material: MAT_SIGN });
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 5, z: 0.72, sx: 1.8, sy: 1.8, sz: 0.35, yaw: Math.PI / 4, color: RANGE_GRANITE, material: MAT_STONE });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 5, z: 1.35, sx: 0.6, sy: 0.6, sz: 1.2, yaw: Math.PI / 4, color: ORANGE, material: MAT_LAMP });
  }
  if (lot === "range-trailhead") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 2, z: 0.58, sx: 10, sy: 6, sz: 0.18, yaw: 0, color: BONE, material: MAT_SIDEWALK });
    ctx.boxes.push({ x: ctx.centerX - 2.8, y: ctx.centerY - 1, z: 2.35, sx: 4.8, sy: 0.35, sz: 3.2, yaw: 0, color: RANGE_TIMBER, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + 5.5, y: ctx.centerY - 1, z: 2.5, sx: 0.35, sy: 0.35, sz: 4.2, yaw: 0, color: RANGE_BERRY, material: MAT_SIGN });
    addPerson(ctx, ctx.centerX + 1, ctx.centerY - 2, ORANGE);
  }
  if (lot === "range-lift-support") {
    for (const x of [-3.2, 3.2]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY, z: 5, sx: 0.55, sy: 0.55, sz: 9.2, yaw: 0, color: STEEL, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 9.2, sx: 9, sy: 0.5, sz: 0.55, yaw: 0, color: INK, material: MAT_TIMBER });
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 2.5, z: 8.8, sx: 3.2, sy: 1.5, sz: 1, yaw: 0, color: RED, material: MAT_VEHICLE });
    addSolid(ctx, "range-lift", ctx.centerX, ctx.centerY, 7.2, 1.2, 9.8);
  }
}

function buildBusinessLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "range-main-street" ? BONE : RANGE_MOSS);
  const labels: Partial<Record<LotKind, Color>> = {
    "range-main-street": RANGE_BERRY,
    "range-general-store": RANGE_AMBER,
    "range-diner": RED,
    "range-outfitter": CYAN,
    "range-workshop": ORANGE,
    "range-roadside-motel": BLUE,
    "range-gas-stop": YELLOW,
    "range-ski-rental": RANGE_BERRY,
  };
  const face = labels[lot] ?? RANGE_AMBER;
  if (lot === "range-gas-stop") {
    addMountainBuilding(ctx, lot, ctx.centerX + 5.8, ctx.centerY + 3, 9, 7, 4, BONE, RANGE_BERRY);
    ctx.boxes.push({ x: ctx.centerX - 4.5, y: ctx.centerY - 1.5, z: 3.6, sx: 10, sy: 6.5, sz: 0.55, yaw: 0, color: RANGE_BERRY, material: MAT_SIGN });
    for (const x of [-7, -2]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 1.2, sx: 1, sy: 1.2, sz: 1.8, yaw: 0, color: YELLOW, material: MAT_TIMBER });
  } else if (lot === "range-roadside-motel") {
    addMountainBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3.5, 18, 7.5, 4.2, BONE, RANGE_BERRY);
    addPickup(ctx, "motel-pickup", ctx.centerX - 7, ctx.centerY - 6.5, BLUE);
  } else {
    addMountainBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3, lot === "range-main-street" ? 18 : 13, 8.4, lot === "range-main-street" ? 6 : 4.8, lot === "range-outfitter" ? RANGE_GRANITE : BONE, RANGE_SLATE);
  }
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1.35, z: 3.1, sx: lot === "range-main-street" ? 15 : 9, sy: 0.3, sz: 1.05, yaw: 0, color: face, material: MAT_SIGN });
  if (lot === "range-workshop") addPickup(ctx, "range-service-truck", ctx.centerX - 7, ctx.centerY - 6.2, RANGE_MOSS);
  addPine(ctx, ctx.centerX - 9.2, ctx.centerY + 7, 0.72, true);
  addPerson(ctx, ctx.centerX + 5.5, ctx.centerY - 6.8, face);
}

function addAnchorGround(ctx: LotContext, anchor: NorthstarAnchorTile, color: Color, water = false) {
  const west = anchor.tileX > 0 ? 18 : 12;
  const east = anchor.tileX < anchor.definition.width - 1 ? 18 : 12;
  const north = anchor.tileY > 0 ? 18 : 12;
  const south = anchor.tileY < anchor.definition.height - 1 ? 18 : 12;
  const x = ctx.centerX + (east - west) / 2;
  const y = ctx.centerY + (south - north) / 2;
  ctx.boxes.push({ x, y, z: 0.2, sx: west + east, sy: north + south, sz: 0.24, yaw: 0, color, material: water ? MAT_WATER : MAT_GRASS });
  if (water) {
    ctx.surfaceRegions.push({ id: `mirror-water:${ctx.blockX}:${ctx.blockY}`, kind: "water", x, y, halfX: (west + east) / 2, halfY: (north + south) / 2, yaw: 0 });
    addSolid(ctx, "mirror-water", x, y, west + east, north + south, 0.5);
  }
}

function buildAnchorLot(ctx: LotContext, anchor: NorthstarAnchorTile) {
  const { definition, tileX, tileY } = anchor;
  if (definition.lot === "range-northstar-gate") {
    addGround(ctx, RANGE_MOSS);
    for (const x of [-5.5, 5.5]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 5.2, sx: 1.5, sy: 1.5, sz: 9.5, yaw: 0, color: RANGE_GRANITE, material: MAT_STONE });
      addSolid(ctx, `northstar-gate-${x}`, ctx.centerX + x, ctx.centerY - 1, 1.5, 1.5, 10);
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 9.1, sx: 13, sy: 1.7, sz: 1.7, yaw: 0, color: RANGE_TIMBER, material: MAT_SIGN });
    addMountainBuilding(ctx, "northstar-depot", ctx.centerX + 6.8, ctx.centerY + 7.2, 7, 5.5, 3.7, BONE, RANGE_BERRY);
    addPine(ctx, ctx.centerX - 9, ctx.centerY + 7.5, 0.85, true);
    return;
  }
  if (definition.lot === "range-copper-gas") {
    buildBusinessLot(ctx, "range-gas-stop");
    ctx.boxes.push({ x: ctx.centerX - 8.8, y: ctx.centerY - 7.5, z: 5.4, sx: 0.5, sy: 0.5, sz: 9.5, yaw: 0, color: INK, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX - 8.8, y: ctx.centerY - 7.5, z: 9.5, sx: 4, sy: 0.7, sz: 2.2, yaw: 0, color: RANGE_AMBER, material: MAT_SIGN });
    return;
  }
  if (definition.lot === "range-village-square") {
    addAnchorGround(ctx, anchor, tileX === 1 && tileY === 0 ? BONE : RANGE_MOSS);
    if (tileY === 0) addMountainBuilding(ctx, `village-shop-${tileX}`, ctx.centerX, ctx.centerY + 4, 20, 8.5, 6 + (tileX === 1 ? 2 : 0), tileX === 1 ? RANGE_BERRY : BONE, RANGE_SLATE);
    if (tileX === 1 && tileY === 1) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 6.5, sx: 3.2, sy: 3.2, sz: 11.8, yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 13.2, sx: 5.2, sy: 5.2, sz: 1.8, yaw: Math.PI / 4, color: RANGE_BERRY, material: MAT_TIMBER });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 2.7, z: 9, sx: 2.2, sy: 0.18, sz: 2.2, yaw: 0, color: WHITE, material: MAT_SIGN });
      addSolid(ctx, "northstar-clock", ctx.centerX, ctx.centerY - 1, 3.2, 3.2, 14);
    }
    for (const x of [-7, 7]) addPerson(ctx, ctx.centerX + x, ctx.centerY + (tileY ? 2 : -5), x > 0 ? CYAN : ORANGE);
    return;
  }
  if (definition.lot === "range-timberline-lodge") {
    addAnchorGround(ctx, anchor, RANGE_MOSS);
    const x = ctx.centerX + (tileX === 0 ? 7 : -7);
    const y = ctx.centerY + (tileY === 0 ? 7 : -7);
    addMountainBuilding(ctx, `timberline-${tileX}-${tileY}`, x, y, 22, 20, 9 + (tileY === 0 ? 2 : 0), BONE, RANGE_BERRY);
    if (tileX === 0 && tileY === 1) {
      ctx.boxes.push({ x: ctx.centerX + 5.8, y: ctx.centerY + 8.2, z: 2.3, sx: 7, sy: 3.5, sz: 3.6, yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
      addPerson(ctx, ctx.centerX + 1.5, ctx.centerY + 7, RED);
    }
    return;
  }
  if (definition.lot === "range-ranger-station") {
    addGround(ctx, RANGE_MOSS);
    addMountainBuilding(ctx, "pinewatch-station", ctx.centerX, ctx.centerY + 3, 14, 9, 5, RANGE_TIMBER, RANGE_BERRY);
    addPickup(ctx, "ranger-truck", ctx.centerX - 7.8, ctx.centerY - 6.3, RANGE_MOSS);
    ctx.boxes.push({ x: ctx.centerX + 8, y: ctx.centerY + 6, z: 8, sx: 0.55, sy: 0.55, sz: 14, yaw: 0, color: STEEL, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + 8, y: ctx.centerY + 6, z: 15, sx: 3.2, sy: 3.2, sz: 1, yaw: 0, color: RANGE_BERRY, material: MAT_SIGN });
    addSolid(ctx, "pinewatch-tower", ctx.centerX + 8, ctx.centerY + 6, 0.8, 0.8, 15.5);
    return;
  }
  if (definition.lot === "range-old-spruce-mill") {
    addAnchorGround(ctx, anchor, RANGE_GRANITE);
    if (tileY === 0) addMountainBuilding(ctx, `spruce-mill-${tileX}`, ctx.centerX, ctx.centerY + 2, 21, 13, 7, RANGE_TIMBER, RANGE_SLATE);
    for (const y of [-7, -2, 3, 8]) ctx.boxes.push({ x: ctx.centerX + (tileX ? -2 : 2), y: ctx.centerY + y, z: 1.1, sx: 16, sy: 1.4, sz: 1.5, yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
    if (tileX === 1 && tileY === 1) addPickup(ctx, "mill-truck", ctx.centerX + 5, ctx.centerY + 4, ORANGE);
    return;
  }
  if (definition.lot === "range-mirror-lake") {
    const lodgeShore = tileX === 0 && tileY === 2;
    addAnchorGround(ctx, anchor, lodgeShore ? RANGE_MOSS : BLUE, !lodgeShore);
    if (lodgeShore) {
      ctx.boxes.push({ x: ctx.centerX - 7, y: ctx.centerY + 7, z: 0.8, sx: 9, sy: 4, sz: 0.45, yaw: 0, color: RANGE_TIMBER, material: MAT_SIDEWALK });
      addMountainBuilding(ctx, "mirror-fishing-lodge", ctx.centerX - 7, ctx.centerY + 3, 9, 6, 4, RANGE_TIMBER, RANGE_BERRY);
    }
    if ((tileX + tileY) % 3 === 0) {
      ctx.boxes.push({ x: ctx.centerX + 2, y: ctx.centerY, z: 0.65, sx: 5, sy: 1.8, sz: 0.55, yaw: 0.3, color: tileX % 2 ? RED : WHITE, material: MAT_VEHICLE });
    }
    return;
  }
  if (definition.lot === "range-silver-run-resort") {
    addAnchorGround(ctx, anchor, RANGE_SNOW);
    if (tileY === 2 && tileX >= 1 && tileX <= 3) {
      const x = ctx.centerX + (tileX === 1 ? 7 : tileX === 3 ? -7 : 0);
      addMountainBuilding(ctx, `silver-lodge-${tileX}`, x, ctx.centerY + 4, tileX === 2 ? 28 : 21, 14, tileX === 2 ? 13 : 9, BONE, RANGE_BERRY);
    } else if (tileY <= 1) {
      for (const offset of [-7, 0, 7]) ctx.boxes.push({ x: ctx.centerX + offset, y: ctx.centerY, z: 0.52, sx: 1.2, sy: 22, sz: 0.16, yaw: 0.18 * (tileX - 2), color: tileX % 2 ? CYAN : RED, material: MAT_SIGN });
      if (tileY === 0 && (tileX === 0 || tileX === 2 || tileX === 4)) {
        ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 8, sx: 0.6, sy: 0.6, sz: 14, yaw: 0, color: STEEL, material: MAT_GENERIC });
        ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 15, sx: 10, sy: 0.5, sz: 0.5, yaw: 0, color: INK, material: MAT_TIMBER });
        ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 3, z: 13.5, sx: 3.5, sy: 1.5, sz: 1.1, yaw: 0, color: RANGE_BERRY, material: MAT_VEHICLE });
        addSolid(ctx, `silver-lift-${tileX}`, ctx.centerX, ctx.centerY, 0.8, 0.8, 15.5);
      }
    } else {
      addForest(ctx, 4, true);
    }
    if (tileX === 2 && tileY === 2) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 8, z: 2.8, sx: 12, sy: 2.6, sz: 4.2, yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
      addPerson(ctx, ctx.centerX - 4, ctx.centerY + 7, RED);
      addPerson(ctx, ctx.centerX + 4, ctx.centerY + 7, CYAN);
    }
    return;
  }
  addAnchorGround(ctx, anchor, RANGE_GRANITE);
  // Aurora Observatory occupies the existing lookout campus and public entrance.
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.28, sx: 31, sy: 31, sz: 0.55,
    yaw: 0, color: BONE, material: MAT_STONE });
  if (tileX === 1 && tileY === 0) {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 3.4, sx: 18, sy: 18, sz: 6.2,
      yaw: 0, color: BONE, material: MAT_STONE });
    ctx.surfaces?.push(...observatoryDome({ x: ctx.centerX, y: ctx.centerY, z: 6.5 }, 10.2, RANGE_SNOW));
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 9.1, z: 3.9, sx: 12, sy: 0.22, sz: 1.2,
      yaw: 0, color: CYAN, material: MAT_WINDOW });
    addSolid(ctx, "aurora-observatory", ctx.centerX, ctx.centerY, 18, 18, 16.7);
  }
  if (tileX === 0 && tileY === 1) {
    addMountainBuilding(ctx, "aurora-visitor-center", ctx.centerX - 5.5, ctx.centerY + 8, 10, 6, 5, BONE, RANGE_BERRY);
    ctx.boxes.push({ x: ctx.centerX - 5.5, y: ctx.centerY + 11.1, z: 1.8, sx: 2, sy: 0.22, sz: 2.8,
      yaw: 0, color: RANGE_AMBER, material: MAT_LAMP });
    ctx.boxes.push({ x: ctx.centerX + 7, y: ctx.centerY - 7, z: 2, sx: 0.65, sy: 0.65, sz: 3.5,
      yaw: 0, color: INK, material: MAT_GENERIC });
    ctx.boxes.push({ x: ctx.centerX + 7, y: ctx.centerY - 7, z: 3.4, sx: 3.2, sy: 0.85, sz: 0.8,
      yaw: -0.5, tilt: -0.3, color: RANGE_AMBER, material: MAT_GENERIC });
    addPerson(ctx, ctx.centerX + 5, ctx.centerY - 6, RANGE_BERRY);
  }
  if (tileY === 0) {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 15, z: 1.05, sx: 31, sy: 0.25, sz: 1.7,
      yaw: 0, color: RANGE_TIMBER, material: MAT_TIMBER });
    addSolid(ctx, "aurora-north-balustrade", ctx.centerX, ctx.centerY - 15, 31, 0.25, 1.9);
  }
}

export function buildMountainLot(ctx: LotContext, lot: LotKind) {
  if (northstarStationReserved(ctx.centerX, ctx.centerY) || northstarSnowRun(ctx.centerX, ctx.centerY)) return;
  const anchor = mountainAnchorForBlock(ctx.blockX, ctx.blockY);
  if (anchor) {
    buildAnchorLot(ctx, anchor);
    return;
  }
  if (["range-cabin", "range-a-frame", "range-farmstead", "range-lakeside-home", "range-chalet"].includes(lot)) {
    buildHomeLot(ctx, lot);
  } else if (["range-forest-clearing", "range-meadow", "range-rocky-grove", "range-campground", "range-trailhead", "range-snowfield", "range-lift-support"].includes(lot)) {
    buildNatureLot(ctx, lot);
  } else {
    buildBusinessLot(ctx, lot);
  }
}

export function northstarPedestrianCountForBlock(blockX: number, blockY: number) {
  if (!northstarSettlementPlan(blockX, blockY)) return 0;
  const area = northstarRangeAreaForBlock(blockX, blockY);
  if (area === "NORTHSTAR VILLAGE") return 6;
  if (area === "SILVER RUN") return 5;
  if (area === "TIMBER PASS") return 3;
  return 2;
}

/** Road cuts stay open; scattered trees replace the old floating verge squares. */
export function buildMountainVerge(ctx: LotContext, isClear: (x: number, y: number) => boolean) {
  const snowy = naturalTerrainHeight(ctx.centerX, ctx.centerY) > 148;
  for (const [dx, dy] of [[-12, -11], [12, -9], [-11, 12], [11, 13]]) {
    const x = ctx.centerX + dx, y = ctx.centerY + dy;
    if (isClear(x, y)) addPine(ctx, x, y, 0.8 + ctx.random() * 0.4, true, snowy);
  }
}
