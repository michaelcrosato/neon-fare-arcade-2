import type { Color, LotContext, LotKind, VenueKind } from "./model";
import { MAT_GENERIC, MAT_LAMP, MAT_SIDEWALK, MAT_SIGN } from "./config";
import { blockRandom } from "./random";
import { reachAreaAt, reachBlockIsDry, reachGridStreetEnabled, reachIsLandAt, reachIsPromenadeAt, reachShoreAt } from "./reach-layout";
import { PALM_REACH_ANCHORS, type ReachAnchor } from "./reach-destinations";
import { buildReachAnchor, buildReachBuilding } from "./reach-buildings";
import { REACH_CYAN, REACH_IVORY, REACH_NEON, REACH_PALETTE, REACH_PEACH, REACH_SEAFOAM,
  reachBox, reachPalm, reachSolid, reachUmbrella } from "./reach-assets";

// Compatibility exports keep shared region, traffic, and destination identities stable.
export { PALM_REACH_ANCHORS as CYPRESS_REACH_ANCHORS } from "./reach-destinations";
export { REACH_SAND as REACH_MUD, REACH_PALM as REACH_MOSS, REACH_PALM as REACH_CYPRESS,
  REACH_BAY as REACH_WATER, REACH_SEAFOAM as REACH_REED, REACH_IVORY as REACH_TIMBER,
  REACH_IVORY as REACH_CREAM, REACH_SHELL as REACH_CORAL, REACH_NEON as REACH_LANTERN,
  REACH_SEAFOAM as REACH_MINT } from "./reach-assets";
export type CypressReachAnchorDefinition = ReachAnchor;
export type CypressReachAnchorTile = { definition: ReachAnchor; tileX: number; tileY: number };

export function wetlandAnchorForBlock(blockX: number, blockY: number): CypressReachAnchorTile | null {
  for (const definition of PALM_REACH_ANCHORS) {
    const tileX = blockX - definition.originX, tileY = blockY - definition.originY;
    if (tileX >= 0 && tileX < definition.width && tileY >= 0 && tileY < definition.height) return { definition, tileX, tileY };
  }
  return null;
}

function streetFrontage(blockX: number, blockY: number) {
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  const options = [
    { x, y: y - 18, axis: "horizontal" as const, orientation: 0 },
    { x: x + 18, y, axis: "vertical" as const, orientation: 1 },
    { x, y: y + 18, axis: "horizontal" as const, orientation: 2 },
    { x: x - 18, y, axis: "vertical" as const, orientation: 3 },
  ];
  return options.find(point => reachGridStreetEnabled(point, point.axis)) ?? null;
}

const CALLE_LOTS: readonly LotKind[] = ["reach-corner-cafe", "reach-courtyard", "reach-record-shop", "reach-courtyard", "reach-motel", "reach-deco-hotel", "reach-gas-stop"];
const BAY_LOTS: readonly LotKind[] = ["reach-condo", "reach-condo", "reach-corner-cafe", "reach-courtyard", "reach-pool-court", "reach-record-shop"];
const RIBBON_LOTS: readonly LotKind[] = ["reach-deco-hotel", "reach-deco-hotel", "reach-pool-court", "reach-corner-cafe", "reach-deco-hotel"];
const KEYS_LOTS: readonly LotKind[] = ["reach-courtyard", "reach-courtyard", "reach-pool-court", "reach-motel"];

export function wetlandLotForBlock(blockX: number, blockY: number): LotKind {
  const anchor = wetlandAnchorForBlock(blockX, blockY);
  if (anchor) return anchor.definition.lot;
  const x = blockX * 36 + 18, y = blockY * 36 + 18;
  if (!reachIsLandAt(x, y)) return "reach-ocean";
  if (!reachBlockIsDry(blockX, blockY)) return "reach-beach";
  const shore = reachShoreAt(y);
  if (shore.east - x < 48) return "reach-beach";
  if (shore.east - x < 88) return "reach-promenade";
  if (y >= 2940 || !streetFrontage(blockX, blockY)) return "reach-palm-hammock";
  const area = reachAreaAt(x, y);
  const deck = area === "CALLE LUNA" ? CALLE_LOTS : area === "OCEAN RIBBON" ? RIBBON_LOTS : area === "MOONWATER KEYS" ? KEYS_LOTS : BAY_LOTS;
  return deck[Math.floor(blockRandom(blockX, blockY, 0x1988ca57)() * deck.length)];
}

export function wetlandLotOrientation(blockX: number, blockY: number) {
  const lot = wetlandLotForBlock(blockX, blockY);
  return wetlandAnchorForBlock(blockX, blockY) || ["reach-ocean", "reach-beach", "reach-promenade", "reach-palm-hammock"].includes(lot)
    ? 0 : streetFrontage(blockX, blockY)?.orientation ?? 0;
}

export type WetlandPortalSpec = { id?: string; suffix: string; kind: VenueKind; label: string; x: number; y: number; heading?: number };

export function wetlandPortalSpecs(lot: LotKind, centerX: number, centerY: number, blockX: number, blockY: number): WetlandPortalSpec[] {
  const anchor = wetlandAnchorForBlock(blockX, blockY);
  if (anchor) {
    const { portal: p } = anchor.definition;
    return p.tileX === anchor.tileX && p.tileY === anchor.tileY
      ? [{ id: anchor.definition.venueId, suffix: p.suffix, kind: p.kind, label: anchor.definition.label,
        x: centerX + p.x, y: centerY + p.y, heading: p.heading }] : [];
  }
  const doors: Partial<Record<LotKind, { kind: VenueKind; label: string }>> = {
    "reach-deco-hotel": { kind: "hotel", label: "OCEAN RIBBON HOTEL" },
    "reach-corner-cafe": { kind: "diner", label: "CAFÉ LUNA" },
    "reach-condo": { kind: "residence", label: "MIRAGE BAY RESIDENCE" },
    "reach-courtyard": { kind: "residence", label: "PALM COURT" },
    "reach-record-shop": { kind: "shop", label: "AFTERGLOW RECORDS" },
    "reach-gas-stop": { kind: "gas", label: "PALM REACH FUEL" },
    "reach-motel": { kind: "motel", label: "NEON PALMS MOTOR INN" },
  };
  const door = doors[lot];
  if (!door || (door.kind === "residence" && blockRandom(blockX, blockY, 0xca5a)() > .4)) return [];
  return [{ suffix: "front-door", ...door, x: centerX, y: centerY - 10.6, heading: -Math.PI / 2 }];
}

export function buildReachVerge(ctx: LotContext, canPlant: (x: number, y: number) => boolean) {
  // Corridor ownership stays in world.ts; the plants use world coordinates.
  for (const [dx, dy] of [[-12.5, -12.5], [12.5, 12.5]]) {
    const x = ctx.centerX + dx, y = ctx.centerY + dy;
    if (reachIsLandAt(x, y, 2.5) && !reachIsPromenadeAt(x, y, 2) && canPlant(x, y)) reachPalm(ctx, x, y, .75 + ctx.random() * .18, true);
  }
}

export function buildWetlandLot(ctx: LotContext, lot: LotKind) {
  const anchor = wetlandAnchorForBlock(ctx.blockX, ctx.blockY);
  if (anchor) { buildReachAnchor(ctx, anchor.definition, anchor.tileX, anchor.tileY); return; }
  if (lot === "reach-ocean") return;
  const { centerX: x, centerY: y } = ctx;
  const variant = Math.floor(blockRandom(ctx.blockX, ctx.blockY, 0xa47dec0)() * 30);
  if (lot === "reach-beach" || lot === "reach-promenade") {
    if (!reachIsLandAt(x, y, 5)) return;
    if (lot === "reach-promenade") {
      if (Math.floor((reachShoreAt(y).east - 62) / 36) !== ctx.blockX) return;
      reachPalm(ctx, reachShoreAt(y - 9).east - 73, y - 9, 1.08, true);
      reachBox(ctx, reachShoreAt(y + 7).east - 54, y + 7, .8, 5.5, 1.2, .45, REACH_SEAFOAM, MAT_GENERIC);
    } else {
      reachUmbrella(ctx, x, y, REACH_PALETTE[variant % REACH_PALETTE.length]);
      for (const side of [-1, 1]) reachBox(ctx, x + side * 2.7, y + 1, .4, 1.3, 3.5, .28, side < 0 ? REACH_IVORY : REACH_PEACH, MAT_SIDEWALK);
      if (variant % 9 === 0) {
        reachBox(ctx, x, y - 8, 3.3, 4.6, 4, 2.8, REACH_SEAFOAM);
        reachBox(ctx, x, y - 8, 5, 6, 5.6, .45, REACH_NEON, MAT_SIGN);
        for (const side of [-1, 1]) reachBox(ctx, x + side * 1.5, y - 8, 1, .35, .35, 2, REACH_IVORY);
        reachSolid(ctx, "beach-rescue", x, y - 8, 4.6, 4, 5);
      }
    }
    return;
  }
  if (lot === "reach-palm-hammock") {
    if (variant % 4 !== 0 && reachIsLandAt(x - 6, y + 5, 6)) reachPalm(ctx, x - 6, y + 5, .85 + variant % 3 * .12, true);
    if (variant % 3 === 0 && reachIsLandAt(x + 9, y - 7, 6)) reachPalm(ctx, x + 9, y - 7, .7, true);
    return;
  }
  buildReachBuilding(ctx, lot, variant);
  if (!["reach-pool-court", "reach-tennis", "reach-courtyard"].includes(lot)) reachPalm(ctx, x + 11.3, y - 10.8, .83);
}

export function wetlandPedestrianCountForBlock(blockX: number, blockY: number) {
  const lot = wetlandLotForBlock(blockX, blockY);
  if (lot === "reach-ocean" || lot === "reach-palm-hammock") return 0;
  if (lot === "reach-beach") return 1;
  if (lot === "reach-promenade") return 3;
  return 4;
}

/** Walk along the occupied frontage or shore, never around an unpaved block. */
export function reachPedestrianPoint(blockX: number, blockY: number, seconds: number, index: number) {
  const lot = wetlandLotForBlock(blockX, blockY), count = wetlandPedestrianCountForBlock(blockX, blockY);
  if (index < 0 || index >= count || wetlandAnchorForBlock(blockX, blockY)) return null;
  const cx = blockX * 36 + 18, cy = blockY * 36 + 18;
  const progress = Math.sin(seconds * .12 + index * 1.9 + blockX * .73 + blockY * .21);
  let x: number, y: number;
  if (lot === "reach-promenade") {
    y = cy + progress * 12;
    x = reachShoreAt(y).east - 62 + (index % 2 ? 1 : -1);
  } else if (lot === "reach-beach") {
    x = cx + progress * 9;
    y = cy + 6;
  } else {
    const frontage = streetFrontage(blockX, blockY);
    if (!frontage) return null;
    const angle = frontage.orientation * Math.PI / 2, along = progress * 10;
    x = cx + along * Math.cos(angle) + 11.5 * Math.sin(angle);
    y = cy + along * Math.sin(angle) - 11.5 * Math.cos(angle);
  }
  return reachIsLandAt(x, y, .6) ? { x, y, z: .12 } : null;
}

export const REACH_STREET_LIGHT: Color = REACH_CYAN;
export const REACH_STREET_LIGHT_MATERIAL = MAT_LAMP;
