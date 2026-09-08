import {
  BLUE,
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
  MAT_WATER,
  MAT_WINDOW,
  ORANGE,
  PAPER,
  PINK,
  STEEL,
  WHITE,
} from "./config";
import { blockRandom } from "./random";
import type { Color, LotContext, LotKind, VenueKind } from "./model";
import { cypressReachAreaForBlock } from "./regions";

export const REACH_MUD: Color = [0.26, 0.31, 0.22, 1];
export const REACH_MOSS: Color = [0.16, 0.39, 0.24, 1];
export const REACH_CYPRESS: Color = [0.12, 0.25, 0.17, 1];
export const REACH_WATER: Color = [0.04, 0.34, 0.36, 1];
export const REACH_REED: Color = [0.42, 0.52, 0.25, 1];
export const REACH_TIMBER: Color = [0.38, 0.21, 0.12, 1];
export const REACH_CREAM: Color = [0.86, 0.81, 0.64, 1];
export const REACH_CORAL: Color = [0.94, 0.28, 0.22, 1];
export const REACH_LANTERN: Color = [1, 0.69, 0.08, 1];
export const REACH_MINT: Color = [0.17, 0.72, 0.64, 1];

type WetlandPortal = {
  tileX: number;
  tileY: number;
  suffix: string;
  kind: VenueKind;
  x: number;
  y: number;
  heading: number;
};

export type CypressReachAnchorDefinition = {
  id: string;
  label: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  lot: LotKind;
  portal: WetlandPortal;
};

export const CYPRESS_REACH_ANCHORS = [
  { id: "twinwater-gate", label: "TWINWATER GATE", originX: 24, originY: 26, width: 1, height: 1, lot: "reach-twinwater-gate", portal: { tileX: 0, tileY: 0, suffix: "welcome-house", kind: "terminal", x: 6.5, y: 4, heading: -Math.PI / 2 } },
  { id: "lantern-bay-market", label: "LANTERN BAY MARKET", originX: 34, originY: 34, width: 3, height: 2, lot: "reach-lantern-market", portal: { tileX: 1, tileY: 1, suffix: "market-hall", kind: "market", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "bayou-belle", label: "BAYOU BELLE", originX: 40, originY: 39, width: 3, height: 2, lot: "reach-bayou-belle", portal: { tileX: 1, tileY: 1, suffix: "riverboat-lobby", kind: "hotel", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "stormwall-locks", label: "STORMWALL LOCKS", originX: 29, originY: 55, width: 4, height: 2, lot: "reach-stormwall-locks", portal: { tileX: 0, tileY: 1, suffix: "lock-control", kind: "civic", x: -5, y: 8, heading: Math.PI / 2 } },
  { id: "cypress-crown", label: "CYPRESS CROWN PRESERVE", originX: 52, originY: 34, width: 3, height: 2, lot: "reach-cypress-crown", portal: { tileX: 1, tileY: 1, suffix: "preserve-center", kind: "kiosk", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "gulfwatch-station", label: "GULFWATCH STATION", originX: 57, originY: 56, width: 2, height: 2, lot: "reach-gulfwatch-station", portal: { tileX: 0, tileY: 1, suffix: "operations", kind: "civic", x: -5, y: 10, heading: Math.PI / 2 } },
  { id: "moonwater-marina", label: "MOONWATER MARINA", originX: 45, originY: 50, width: 3, height: 2, lot: "reach-moonwater-marina", portal: { tileX: 1, tileY: 1, suffix: "marina-office", kind: "marina", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "sunkissed-motel", label: "SUNKISSED MOTOR LODGE", originX: 32, originY: 47, width: 2, height: 1, lot: "reach-sunkissed-motel", portal: { tileX: 0, tileY: 0, suffix: "motel-office", kind: "motel", x: -6, y: 9.5, heading: Math.PI / 2 } },
  { id: "blackwater-shipyard", label: "BLACKWATER SHIPYARD", originX: 59, originY: 45, width: 3, height: 2, lot: "reach-blackwater-shipyard", portal: { tileX: 0, tileY: 1, suffix: "shipyard-office", kind: "warehouse", x: -5, y: 8, heading: Math.PI / 2 } },
  { id: "saint-lumina", label: "SAINT LUMINA CHAPEL", originX: 49, originY: 58, width: 2, height: 2, lot: "reach-saint-lumina", portal: { tileX: 0, tileY: 1, suffix: "chapel-door", kind: "civic", x: -5, y: 8, heading: Math.PI / 2 } },
] as const satisfies readonly CypressReachAnchorDefinition[];

export type CypressReachAnchorTile = {
  definition: CypressReachAnchorDefinition;
  tileX: number;
  tileY: number;
};

export function wetlandAnchorForBlock(blockX: number, blockY: number): CypressReachAnchorTile | null {
  for (const definition of CYPRESS_REACH_ANCHORS) {
    const tileX = blockX - definition.originX;
    const tileY = blockY - definition.originY;
    if (tileX >= 0 && tileX < definition.width && tileY >= 0 && tileY < definition.height) {
      return { definition, tileX, tileY };
    }
  }
  return null;
}

const CROSSING_LOTS = [
  "reach-stilt-house", "reach-fisher-cottage", "reach-gas-stop", "reach-bait-shop",
  "reach-cypress-grove", "reach-reed-marsh", "reach-roadhouse", "reach-motel",
] as const satisfies readonly LotKind[];
const TOWN_LOTS = [
  "reach-main-street", "reach-main-street", "reach-seafood-market", "reach-roadhouse",
  "reach-shotgun-house", "reach-fisher-cottage", "reach-bait-shop", "reach-marina",
  "reach-motel", "reach-boardwalk-trail",
] as const satisfies readonly LotKind[];
const BASIN_LOTS = [
  "reach-cypress-grove", "reach-cypress-grove", "reach-reed-marsh", "reach-blackwater-pool",
  "reach-mudflat", "reach-boardwalk-trail", "reach-fishing-dock", "reach-stilt-house",
] as const satisfies readonly LotKind[];
const COAST_LOTS = [
  "reach-reed-marsh", "reach-mudflat", "reach-blackwater-pool", "reach-fishing-dock",
  "reach-houseboat-yard", "reach-boatyard", "reach-marina", "reach-gas-stop",
] as const satisfies readonly LotKind[];
const RURAL_LOTS = [
  "reach-stilt-house", "reach-shotgun-house", "reach-fisher-cottage", "reach-cypress-grove",
  "reach-reed-marsh", "reach-boardwalk-trail", "reach-fishing-dock", "reach-bait-shop",
] as const satisfies readonly LotKind[];

export function wetlandLotForBlock(blockX: number, blockY: number): LotKind {
  const anchor = wetlandAnchorForBlock(blockX, blockY);
  if (anchor) return anchor.definition.lot;
  const area = cypressReachAreaForBlock(blockX, blockY);
  const deck = area === "LANTERN BAY"
    ? TOWN_LOTS
    : area === "BLACKWATER BASIN"
      ? BASIN_LOTS
      : area === "STORMWALL COAST"
        ? COAST_LOTS
        : area === "TWINWATER CROSSING"
          ? CROSSING_LOTS
          : RURAL_LOTS;
  const random = blockRandom(blockX, blockY, 0x43595052);
  return deck[Math.floor(random() * deck.length) % deck.length];
}

export type WetlandPortalSpec = {
  suffix: string;
  kind: VenueKind;
  label: string;
  x: number;
  y: number;
  heading?: number;
};

export function wetlandPortalSpecs(
  lot: LotKind,
  centerX: number,
  centerY: number,
  blockX: number,
  blockY: number,
): WetlandPortalSpec[] {
  const anchor = wetlandAnchorForBlock(blockX, blockY);
  if (anchor) {
    const portal = anchor.definition.portal;
    if (portal.tileX !== anchor.tileX || portal.tileY !== anchor.tileY) return [];
    return [{ suffix: portal.suffix, kind: portal.kind, label: anchor.definition.label, x: centerX + portal.x, y: centerY + portal.y, heading: portal.heading }];
  }
  const signature = (Math.imul(blockX + 197, 73856093) ^ Math.imul(blockY - 113, 19349663)) >>> 0;
  if (["reach-stilt-house", "reach-shotgun-house", "reach-fisher-cottage"].includes(lot)) {
    return signature % 100 < 38 ? [{ suffix: "porch", kind: "residence", label: "CYPRESS REACH HOME", x: centerX, y: centerY - 2.4 }] : [];
  }
  if (lot === "reach-houseboat-yard") return [{ suffix: "dock-office", kind: "marina", label: "HOUSEBOAT LANDING", x: centerX + 5.4, y: centerY - 4.5 }];
  if (lot === "reach-main-street") return [{ suffix: "shop", kind: "shop", label: "LANTERN BAY", x: centerX, y: centerY - 2.4 }];
  if (lot === "reach-seafood-market") return [{ suffix: "market", kind: "market", label: "LOWTIDE SEAFOOD", x: centerX, y: centerY - 2.4 }];
  if (lot === "reach-gas-stop") return [{ suffix: "store", kind: "gas", label: "GATOR GAS", x: centerX + 5.8, y: centerY - 2.25 }];
  if (lot === "reach-bait-shop") return [{ suffix: "counter", kind: "shop", label: "HOOK & LINE", x: centerX, y: centerY - 2.4 }];
  if (lot === "reach-boatyard") return [{ suffix: "yard", kind: "garage", label: "BAYOU BOATWORKS", x: centerX + 5.2, y: centerY - 2.3 }];
  if (lot === "reach-motel") return [{ suffix: "office", kind: "motel", label: "CYPRESS MOTOR LODGE", x: centerX + 5.6, y: centerY - 2.3 }];
  if (lot === "reach-roadhouse") return [{ suffix: "diner", kind: "diner", label: "MOSS & MOON", x: centerX, y: centerY - 2.4 }];
  if (lot === "reach-marina") return [{ suffix: "office", kind: "marina", label: "LANTERN BAY MARINA", x: centerX + 5.4, y: centerY - 4.5 }];
  return [];
}

function addSolid(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number) {
  ctx.colliders.push({ id: `${id}:${ctx.blockX}:${ctx.blockY}`, x, y, halfX: sx / 2, halfY: sy / 2, height });
}

function addGround(ctx: LotContext, color: Color = REACH_MUD, size = 24) {
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.2, sx: size, sy: size, sz: 0.24, yaw: 0, color, material: MAT_GRASS });
}

function addWater(ctx: LotContext, suffix: string, x: number, y: number, sx: number, sy: number) {
  const id = `wetland-water-${suffix}:${ctx.blockX}:${ctx.blockY}`;
  ctx.boxes.push({ x, y, z: 0.34, sx, sy, sz: 0.18, yaw: 0, color: REACH_WATER, material: MAT_WATER });
  ctx.boxes.push({ x, y, z: 0.46, sx: sx * 0.72, sy: 0.13, sz: 0.04, yaw: 0, color: CYAN, material: MAT_WATER });
  ctx.surfaceRegions.push({ id, kind: "water", x, y, halfX: sx / 2, halfY: sy / 2, yaw: 0 });
  ctx.colliders.push({ id, x, y, halfX: sx / 2, halfY: sy / 2, height: 1.2 });
}

function addCypress(ctx: LotContext, x: number, y: number, scale = 1, solid = false) {
  ctx.boxes.push({ x, y, z: 2.8 * scale + 0.25, sx: 0.72 * scale, sy: 0.72 * scale, sz: 5.6 * scale, yaw: 0, color: REACH_TIMBER, material: MAT_FOLIAGE });
  for (let tier = 0; tier < 3; tier += 1) {
    ctx.boxes.push({ x: x + (tier - 1) * 0.18 * scale, y, z: (4.1 + tier * 1.2) * scale, sx: (4.8 - tier * 0.8) * scale, sy: (4.8 - tier * 0.8) * scale, sz: 1.7 * scale, yaw: tier * Math.PI / 4, color: tier === 1 ? REACH_MOSS : REACH_CYPRESS, material: MAT_FOLIAGE });
  }
  for (const side of [-1, 1]) ctx.boxes.push({ x: x + side * 1.55 * scale, y, z: 3.35 * scale, sx: 0.18 * scale, sy: 0.18 * scale, sz: 2.6 * scale, yaw: side * 0.16, color: REACH_REED, material: MAT_FOLIAGE });
  if (solid) addSolid(ctx, `cypress-${ctx.boxes.length}`, x, y, 0.9 * scale, 0.9 * scale, 7 * scale);
}

function addReeds(ctx: LotContext, x: number, y: number, count = 5) {
  for (let stalk = 0; stalk < count; stalk += 1) {
    const offsetX = ((stalk % 3) - 1) * 0.5;
    const offsetY = (Math.floor(stalk / 3) - 0.5) * 0.55;
    ctx.boxes.push({ x: x + offsetX, y: y + offsetY, z: 0.9 + (stalk % 2) * 0.18, sx: 0.15, sy: 0.15, sz: 1.7 + (stalk % 2) * 0.35, yaw: stalk * 0.09, color: REACH_REED, material: MAT_FOLIAGE });
  }
}

function addFireflies(ctx: LotContext, x: number, y: number) {
  for (let index = 0; index < 4; index += 1) {
    ctx.boxes.push({ x: x + (index - 1.5) * 1.35, y: y + ((index * 7) % 3 - 1) * 0.9, z: 1.5 + (index % 3) * 0.7, sx: 0.16, sy: 0.16, sz: 0.16, yaw: 0, color: REACH_LANTERN, material: MAT_LAMP });
  }
}

function addPerson(ctx: LotContext, x: number, y: number, color: Color) {
  ctx.boxes.push({ x, y, z: 1.05, sx: 0.52, sy: 0.38, sz: 1.25, yaw: 0, color, material: MAT_PERSON });
  ctx.boxes.push({ x, y, z: 1.82, sx: 0.48, sy: 0.48, sz: 0.48, yaw: 0, color: PAPER, material: MAT_PERSON });
}

function addBoardwalk(ctx: LotContext, x: number, y: number, sx: number, sy: number) {
  ctx.boxes.push({ x: x + 0.3, y: y + 0.3, z: 0.7, sx: sx + 0.5, sy: sy + 0.5, sz: 0.45, yaw: 0, color: INK, material: MAT_SIDEWALK });
  ctx.boxes.push({ x, y, z: 0.92, sx, sy, sz: 0.3, yaw: 0, color: REACH_TIMBER, material: MAT_SIDEWALK });
  for (let offset = -sx / 2 + 1; offset <= sx / 2 - 1; offset += 2) ctx.boxes.push({ x: x + offset, y, z: 1.1, sx: 0.11, sy: sy, sz: 0.05, yaw: 0, color: REACH_CREAM, material: MAT_SIDEWALK });
}

function addRaisedBuilding(ctx: LotContext, id: string, x: number, y: number, sx: number, sy: number, height: number, wall: Color = REACH_CREAM, accent: Color = REACH_CORAL) {
  for (const xOffset of [-sx / 2 + 1.2, sx / 2 - 1.2]) for (const yOffset of [-sy / 2 + 1.2, sy / 2 - 1.2]) {
    ctx.boxes.push({ x: x + xOffset, y: y + yOffset, z: 1.55, sx: 0.45, sy: 0.45, sz: 2.5, yaw: 0, color: REACH_TIMBER, material: MAT_BUILDING });
  }
  const base = 1.5;
  ctx.boxes.push({ x: x + 0.4, y: y + 0.4, z: base + height / 2 + 0.25, sx: sx + 0.7, sy: sy + 0.7, sz: height, yaw: 0, color: INK, material: MAT_BUILDING });
  ctx.boxes.push({ x, y, z: base + height / 2 + 0.3, sx, sy, sz: height, yaw: 0, color: wall, material: MAT_BUILDING });
  ctx.boxes.push({ x, y: y - sy / 2 - 0.06, z: base + height * 0.58, sx: sx * 0.62, sy: 0.16, sz: 1.05, yaw: 0, color: accent, material: MAT_WINDOW });
  ctx.boxes.push({ x, y, z: base + height + 0.7, sx: sx + 1.4, sy: sy + 1.4, sz: 0.55, yaw: 0, color: REACH_TIMBER, material: MAT_BUILDING });
  addSolid(ctx, id, x, y, sx, sy, base + height + 0.8);
}

function addBoat(ctx: LotContext, id: string, x: number, y: number, scale = 1, color: Color = REACH_CORAL) {
  ctx.boxes.push({ x, y, z: 0.95, sx: 5.4 * scale, sy: 2.1 * scale, sz: 0.75 * scale, yaw: Math.PI / 2, color, material: MAT_VEHICLE });
  ctx.boxes.push({ x, y, z: 1.45, sx: 2.4 * scale, sy: 1.6 * scale, sz: 0.55 * scale, yaw: Math.PI / 2, color: WHITE, material: MAT_VEHICLE });
  addSolid(ctx, id, x, y, 2.1 * scale, 5.4 * scale, 1.8 * scale);
}

function buildHomeLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "reach-houseboat-yard" ? REACH_MOSS : REACH_MUD);
  if (lot === "reach-houseboat-yard") {
    addWater(ctx, "houseboat", ctx.centerX, ctx.centerY + 4, 22, 12);
    addBoardwalk(ctx, ctx.centerX, ctx.centerY - 5.5, 21, 4.5);
    addRaisedBuilding(ctx, "houseboat-office", ctx.centerX + 5.4, ctx.centerY + 1, 8, 6, 3.6, REACH_CREAM, REACH_MINT);
    addBoat(ctx, "houseboat", ctx.centerX - 5.5, ctx.centerY + 3.8, 0.85, BLUE);
    return;
  }
  const wall = lot === "reach-shotgun-house" ? REACH_CORAL : lot === "reach-fisher-cottage" ? REACH_MINT : REACH_CREAM;
  addRaisedBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3.5, lot === "reach-shotgun-house" ? 8.5 : 12.5, 8.5, lot === "reach-stilt-house" ? 5.2 : 4.4, wall, REACH_LANTERN);
  addBoardwalk(ctx, ctx.centerX, ctx.centerY - 2.3, 11, 4.2);
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 4, z: 2.1, sx: 10.8, sy: 0.32, sz: 2.5, yaw: 0, color: REACH_TIMBER, material: MAT_BUILDING });
  addCypress(ctx, ctx.centerX - 8.5, ctx.centerY + 6.5, 0.72, true);
  addReeds(ctx, ctx.centerX + 8, ctx.centerY + 7);
  addFireflies(ctx, ctx.centerX + 7, ctx.centerY - 6);
}

function buildNatureLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "reach-mudflat" ? [0.31, 0.29, 0.21, 1] : REACH_MOSS);
  const watery = lot === "reach-reed-marsh" || lot === "reach-blackwater-pool" || lot === "reach-fishing-dock" || lot === "reach-boardwalk-trail";
  if (watery) addWater(ctx, lot, ctx.centerX, ctx.centerY + (lot === "reach-blackwater-pool" ? 0 : 4), lot === "reach-blackwater-pool" ? 20 : 22, lot === "reach-blackwater-pool" ? 18 : 12);
  if (lot === "reach-boardwalk-trail" || lot === "reach-fishing-dock") {
    addBoardwalk(ctx, ctx.centerX, ctx.centerY - 6, 22, 4.2);
    if (lot === "reach-fishing-dock") addBoat(ctx, "fishing-skiff", ctx.centerX + 6.5, ctx.centerY + 3.7, 0.62, ORANGE);
  }
  const placements = [[-8, -7], [7.5, -6], [-7, 6.5], [7.8, 7], [0, 2]] as const;
  for (let index = 0; index < placements.length; index += 1) {
    const [x, y] = placements[index];
    if (watery && y > 0) addReeds(ctx, ctx.centerX + x, ctx.centerY + y, 4);
    else if (lot === "reach-mudflat") addReeds(ctx, ctx.centerX + x, ctx.centerY + y, 3);
    else addCypress(ctx, ctx.centerX + x, ctx.centerY + y, 0.55 + ctx.random() * 0.25, index < 2);
  }
  addFireflies(ctx, ctx.centerX, ctx.centerY - 4);
}

function buildBusinessLot(ctx: LotContext, lot: LotKind) {
  addGround(ctx, lot === "reach-marina" ? REACH_MOSS : REACH_MUD);
  const accent = lot === "reach-seafood-market" ? CYAN : lot === "reach-gas-stop" ? REACH_LANTERN : lot === "reach-roadhouse" ? REACH_CORAL : REACH_MINT;
  if (lot === "reach-marina") {
    addWater(ctx, "marina", ctx.centerX, ctx.centerY + 4, 22, 12);
    addBoardwalk(ctx, ctx.centerX, ctx.centerY - 5.5, 22, 4.5);
    addRaisedBuilding(ctx, lot, ctx.centerX + 5.4, ctx.centerY + 0.5, 8, 6, 3.6, REACH_CREAM, accent);
    addBoat(ctx, "marina-skiff", ctx.centerX - 5, ctx.centerY + 3.8, 0.7, PINK);
  } else if (lot === "reach-gas-stop") {
    addRaisedBuilding(ctx, lot, ctx.centerX + 5.8, ctx.centerY + 3, 8.5, 7, 3.7, REACH_CREAM, accent);
    ctx.boxes.push({ x: ctx.centerX - 4.5, y: ctx.centerY - 1.5, z: 4.3, sx: 10, sy: 6.5, sz: 0.55, yaw: 0, color: REACH_CORAL, material: MAT_SIGN });
    for (const x of [-7, -2]) ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 1.2, sx: 1, sy: 1.2, sz: 1.8, yaw: 0, color: REACH_LANTERN, material: MAT_BUILDING });
  } else if (lot === "reach-boatyard") {
    addRaisedBuilding(ctx, lot, ctx.centerX + 5, ctx.centerY + 3, 10, 8, 4.6, STEEL, ORANGE);
    ctx.boxes.push({ x: ctx.centerX - 6, y: ctx.centerY + 3, z: 1.2, sx: 8, sy: 3, sz: 1.4, yaw: 0, color: BLUE, material: MAT_VEHICLE });
    addSolid(ctx, "boatyard-hull", ctx.centerX - 6, ctx.centerY + 3, 8, 3, 1.8);
  } else {
    addRaisedBuilding(ctx, lot, ctx.centerX, ctx.centerY + 3.5, lot === "reach-main-street" ? 18 : lot === "reach-motel" ? 17 : 13, 8.5, lot === "reach-main-street" ? 6.2 : 4.6, lot === "reach-roadhouse" ? REACH_TIMBER : REACH_CREAM, accent);
  }
  ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1.5, z: 4, sx: lot === "reach-main-street" ? 15 : 9, sy: 0.3, sz: 1, yaw: 0, color: accent, material: MAT_SIGN });
  addPerson(ctx, ctx.centerX + 6, ctx.centerY - 6.8, accent);
  addFireflies(ctx, ctx.centerX - 7, ctx.centerY + 6);
}

function addAnchorGround(ctx: LotContext, anchor: CypressReachAnchorTile, color: Color = REACH_MUD) {
  const west = anchor.tileX > 0 ? 18 : 12;
  const east = anchor.tileX < anchor.definition.width - 1 ? 18 : 12;
  const north = anchor.tileY > 0 ? 18 : 12;
  const south = anchor.tileY < anchor.definition.height - 1 ? 18 : 12;
  ctx.boxes.push({ x: ctx.centerX + (east - west) / 2, y: ctx.centerY + (south - north) / 2, z: 0.2, sx: west + east, sy: north + south, sz: 0.24, yaw: 0, color, material: MAT_GRASS });
}

function buildAnchorLot(ctx: LotContext, anchor: CypressReachAnchorTile) {
  const { definition, tileX, tileY } = anchor;
  addAnchorGround(ctx, anchor, definition.lot === "reach-stormwall-locks" ? STEEL : REACH_MUD);
  if (definition.lot === "reach-twinwater-gate") {
    for (const x of [-6, 6]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 5.8, sx: 2.2, sy: 2.2, sz: 10.8, yaw: 0, color: REACH_TIMBER, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 1, z: 11.5, sx: 3.6, sy: 3.6, sz: 1.2, yaw: Math.PI / 4, color: REACH_MINT, material: MAT_LAMP });
      addSolid(ctx, `twinwater-pylon-${x}`, ctx.centerX + x, ctx.centerY - 1, 2.2, 2.2, 12);
    }
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 1, z: 10.2, sx: 14, sy: 1.2, sz: 1.4, yaw: 0, color: REACH_CORAL, material: MAT_SIGN });
    addRaisedBuilding(ctx, "twinwater-welcome", ctx.centerX + 6.5, ctx.centerY + 7.5, 7, 5.5, 3.5, REACH_CREAM, REACH_LANTERN);
    return;
  }
  if (definition.lot === "reach-lantern-market") {
    ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + (tileY ? -5 : 8), z: 0.58, sx: 38, sy: tileY ? 17 : 10, sz: 0.28, yaw: 0, color: REACH_CREAM, material: MAT_SIDEWALK });
    if (tileY === 0) addRaisedBuilding(ctx, `lantern-market-${tileX}`, ctx.centerX, ctx.centerY + 4, 22, 10, 6 + (tileX === 1 ? 2 : 0), tileX === 1 ? REACH_CORAL : REACH_CREAM, REACH_MINT);
    for (const x of [-10, 0, 10]) {
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 5, z: 3.1, sx: 0.35, sy: 0.35, sz: 5.3, yaw: 0, color: REACH_TIMBER, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX + x, y: ctx.centerY - 5, z: 5.8, sx: 7.5, sy: 4.8, sz: 0.34, yaw: 0, color: tileX % 2 ? REACH_MINT : REACH_CORAL, material: MAT_SIGN });
    }
    addPerson(ctx, ctx.centerX - 5, ctx.centerY + (tileY ? 4 : -5), REACH_LANTERN);
    return;
  }
  if (definition.lot === "reach-bayou-belle") {
    if (tileY === 0) addWater(ctx, `belle-${tileX}`, ctx.centerX + (tileX === 2 ? -3 : 0), ctx.centerY, tileX === 2 ? 32 : 38, 38);
    else addBoardwalk(ctx, ctx.centerX, ctx.centerY, 38, 24);
    const hullY = ctx.centerY + (tileY === 0 ? 5 : -8);
    ctx.boxes.push({ x: ctx.centerX, y: hullY, z: 2.2, sx: 34, sy: 15, sz: 3.3, yaw: 0, color: WHITE, material: MAT_BUILDING });
    ctx.boxes.push({ x: ctx.centerX, y: hullY, z: 4.7, sx: 31, sy: 12, sz: 1.6, yaw: 0, color: REACH_CORAL, material: MAT_BUILDING });
    for (const x of [-12, -6, 0, 6, 12]) ctx.boxes.push({ x: ctx.centerX + x, y: hullY - 6.2, z: 5.2, sx: 3.6, sy: 0.22, sz: 1.1, yaw: 0, color: REACH_MINT, material: MAT_WINDOW });
    if (tileX === 1 && tileY === 0) {
      ctx.boxes.push({ x: ctx.centerX, y: hullY, z: 13, sx: 4, sy: 4, sz: 15, yaw: 0, color: REACH_TIMBER, material: MAT_BUILDING });
      for (let paddle = 0; paddle < 8; paddle += 1) {
        const angle = paddle * Math.PI / 4;
        ctx.boxes.push({ x: ctx.centerX + Math.cos(angle) * 7, y: hullY + Math.sin(angle) * 7, z: 5, sx: 7.5, sy: 0.45, sz: 0.5, yaw: angle, color: REACH_LANTERN, material: MAT_SIGN });
      }
    }
    addSolid(ctx, `bayou-belle-${tileX}-${tileY}`, ctx.centerX, hullY, 34, 15, 6);
    return;
  }
  if (definition.lot === "reach-stormwall-locks") {
    addWater(ctx, `locks-${tileX}-${tileY}`, ctx.centerX, ctx.centerY + (tileY ? -5 : 4), 38, tileY ? 18 : 34);
    for (const side of [-1, 1]) {
      const x = ctx.centerX + side * 15;
      ctx.boxes.push({ x, y: ctx.centerY, z: 3.1, sx: 4.2, sy: 38, sz: 5.4, yaw: 0, color: STEEL, material: MAT_BUILDING });
      addSolid(ctx, `stormwall-${tileX}-${tileY}-${side}`, x, ctx.centerY, 4.2, 38, 5.8);
    }
    if (tileX === 0 && tileY === 1) addRaisedBuilding(ctx, "lock-control", ctx.centerX - 5, ctx.centerY + 3, 11, 8, 5.2, REACH_CREAM, REACH_CORAL);
    if (tileX === 3 && tileY === 0) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 13, sx: 2, sy: 2, sz: 24, yaw: 0, color: REACH_CORAL, material: MAT_SIGN });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 25, sx: 7, sy: 7, sz: 1.2, yaw: Math.PI / 4, color: REACH_LANTERN, material: MAT_LAMP });
    }
    return;
  }
  if (definition.lot === "reach-cypress-crown") {
    addWater(ctx, `crown-${tileX}-${tileY}`, ctx.centerX, ctx.centerY + (tileY ? -4 : 3), 32, tileY ? 18 : 32);
    addBoardwalk(ctx, ctx.centerX, ctx.centerY + (tileY ? 7 : -8), 36, 4.2);
    for (const x of [-10, 0, 10]) addCypress(ctx, ctx.centerX + x, ctx.centerY + (tileY ? -5 : 4), 0.85 + ((tileX + x) % 3) * 0.08, true);
    addFireflies(ctx, ctx.centerX, ctx.centerY);
    if (tileX === 1 && tileY === 1) addRaisedBuilding(ctx, "crown-center", ctx.centerX, ctx.centerY + 3, 12, 8, 4.5, REACH_CREAM, REACH_MINT);
    return;
  }
  if (definition.lot === "reach-gulfwatch-station") {
    if (tileX === 0 && tileY === 1) addRaisedBuilding(ctx, "gulfwatch-ops", ctx.centerX - 5, ctx.centerY + 3, 15, 10, 6.5, WHITE, REACH_CORAL);
    else {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.58, sx: 27, sy: 27, sz: 0.3, yaw: 0, color: STEEL, material: MAT_ROAD });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 0.83, sx: 18, sy: 18, sz: 0.1, yaw: Math.PI / 4, color: WHITE, material: MAT_SIGN });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 1.02, sx: 11, sy: 1.1, sz: 0.15, yaw: 0, color: REACH_CORAL, material: MAT_SIGN });
    }
    if (tileX === 1 && tileY === 0) {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 13, sx: 2, sy: 2, sz: 24, yaw: 0, color: WHITE, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY, z: 25, sx: 7, sy: 7, sz: 1.2, yaw: Math.PI / 4, color: REACH_LANTERN, material: MAT_LAMP });
      addSolid(ctx, "gulfwatch-tower", ctx.centerX, ctx.centerY, 2, 2, 26);
    }
    return;
  }
  if (definition.lot === "reach-moonwater-marina") {
    addWater(ctx, `moonwater-${tileX}-${tileY}`, ctx.centerX, ctx.centerY + (tileY ? -4 : 3), 36, tileY ? 18 : 32);
    addBoardwalk(ctx, ctx.centerX, ctx.centerY + (tileY ? 7 : -8), 38, 4.5);
    for (const x of [-10, 0, 10]) addBoat(ctx, `moonwater-boat-${x}`, ctx.centerX + x, ctx.centerY + (tileY ? -4 : 3), 0.55, x ? REACH_CORAL : BLUE);
    if (tileX === 1 && tileY === 1) addRaisedBuilding(ctx, "moonwater-office", ctx.centerX, ctx.centerY + 3, 12, 8, 4.4, REACH_CREAM, REACH_MINT);
    return;
  }
  if (definition.lot === "reach-sunkissed-motel") {
    addRaisedBuilding(ctx, `sunkissed-wing-${tileX}`, ctx.centerX + (tileX ? -5 : 5), ctx.centerY + 3.5, 25, 9, 5, REACH_CREAM, tileX ? REACH_MINT : REACH_CORAL);
    ctx.boxes.push({ x: ctx.centerX + (tileX ? -9 : 9), y: ctx.centerY - 6, z: 6.5, sx: 0.55, sy: 0.55, sz: 11, yaw: 0, color: INK, material: MAT_SIGN });
    ctx.boxes.push({ x: ctx.centerX + (tileX ? -9 : 9), y: ctx.centerY - 6, z: 11, sx: 6, sy: 0.8, sz: 2.4, yaw: 0, color: PINK, material: MAT_LAMP });
    return;
  }
  if (definition.lot === "reach-blackwater-shipyard") {
    addWater(ctx, `shipyard-${tileX}-${tileY}`, ctx.centerX, ctx.centerY + (tileY ? -5 : 4), 36, tileY ? 18 : 32);
    if (tileX === 0 && tileY === 1) addRaisedBuilding(ctx, "shipyard-office", ctx.centerX - 5, ctx.centerY + 3, 12, 8, 5, STEEL, ORANGE);
    else {
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY + 1, z: 2, sx: 23, sy: 7, sz: 2.2, yaw: 0, color: BLUE, material: MAT_VEHICLE });
      ctx.boxes.push({ x: ctx.centerX - 8, y: ctx.centerY - 5, z: 8, sx: 1, sy: 1, sz: 15, yaw: 0, color: ORANGE, material: MAT_BUILDING });
      ctx.boxes.push({ x: ctx.centerX, y: ctx.centerY - 5, z: 15, sx: 17, sy: 1, sz: 1, yaw: 0, color: ORANGE, material: MAT_BUILDING });
      addSolid(ctx, `shipyard-hull-${tileX}-${tileY}`, ctx.centerX, ctx.centerY + 1, 23, 7, 3.2);
    }
    return;
  }
  // Saint Lumina rises above a reflective marsh court and reads from the coast road.
  if (tileY === 0) addWater(ctx, `lumina-${tileX}`, ctx.centerX, ctx.centerY + 2, 34, 30);
  else addBoardwalk(ctx, ctx.centerX, ctx.centerY, 36, 24);
  const chapelX = ctx.centerX + (tileX === 0 ? 8 : -8);
  const chapelY = ctx.centerY + (tileY === 0 ? 8 : -8);
  ctx.boxes.push({ x: chapelX, y: chapelY, z: 6, sx: 24, sy: 16, sz: 10, yaw: 0, color: REACH_CREAM, material: MAT_BUILDING });
  ctx.boxes.push({ x: chapelX, y: chapelY, z: 12, sx: 26, sy: 18, sz: 2.8, yaw: Math.PI / 4, color: REACH_CORAL, material: MAT_BUILDING });
  if (tileX === 0 && tileY === 0) {
    ctx.boxes.push({ x: chapelX, y: chapelY, z: 18, sx: 5, sy: 5, sz: 22, yaw: 0, color: WHITE, material: MAT_BUILDING });
    ctx.boxes.push({ x: chapelX, y: chapelY, z: 30, sx: 7, sy: 7, sz: 3, yaw: Math.PI / 4, color: REACH_LANTERN, material: MAT_LAMP });
  }
  addSolid(ctx, `lumina-chapel-${tileX}-${tileY}`, chapelX, chapelY, 24, 16, 14);
}

export function buildWetlandLot(ctx: LotContext, lot: LotKind) {
  const anchor = wetlandAnchorForBlock(ctx.blockX, ctx.blockY);
  if (anchor) {
    buildAnchorLot(ctx, anchor);
    return;
  }
  if (["reach-stilt-house", "reach-shotgun-house", "reach-fisher-cottage", "reach-houseboat-yard"].includes(lot)) buildHomeLot(ctx, lot);
  else if (["reach-cypress-grove", "reach-reed-marsh", "reach-blackwater-pool", "reach-boardwalk-trail", "reach-fishing-dock", "reach-mudflat"].includes(lot)) buildNatureLot(ctx, lot);
  else buildBusinessLot(ctx, lot);
}

export function wetlandPedestrianCountForBlock(blockX: number, blockY: number) {
  const lot = wetlandLotForBlock(blockX, blockY);
  if (["reach-reed-marsh", "reach-blackwater-pool", "reach-mudflat", "reach-cypress-grove"].includes(lot)) return 0;
  const area = cypressReachAreaForBlock(blockX, blockY);
  if (area === "LANTERN BAY") return 6;
  if (area === "TWINWATER CROSSING") return 4;
  if (area === "STORMWALL COAST") return 2;
  if (area === "BLACKWATER BASIN") return 1;
  return 2;
}
