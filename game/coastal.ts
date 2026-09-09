import {
  INK, MAT_BUILDING, MAT_FOLIAGE, MAT_GENERIC,
  MAT_SIDEWALK, MAT_SIGN, MAT_WATER, MAT_WINDOW,
} from "./config";
import type { Box, Color, LotContext, LotKind, VenueKind } from "./model";
import { blockRandom } from "./random";
import { solanaCoastAreaForBlock } from "./regions";
import { COAST_LAND_MIN_BLOCK_X, COAST_PIER, coastCanalBlock, coastShoreXAt } from "./coastal-layout";
import { coastSettlementPlan } from "./terrain/settlement";
import { coastNaturalHeight } from "./terrain/coast-forms";
import { coastPalm, coastSage, coastCypress, coastMissionRoof, coastGlassHouse, coastArcade,
  coastGoogieRoof, coastDecoBody, coastBandShell, coastUmbrella, coastAquariumRoof } from "./coast-assets";
import { facetedBoulder } from "./architecture";

export const COAST_SAND: Color = [0.96, 0.8, 0.49, 1];
export const COAST_STUCCO: Color = [0.98, 0.94, 0.82, 1];
export const COAST_OCEAN: Color = [0.025, 0.37, 0.66, 1];
export const COAST_SURF: Color = [0.06, 0.73, 0.8, 1];
export const COAST_CORAL: Color = [1, 0.31, 0.24, 1];
export const COAST_MINT: Color = [0.2, 0.79, 0.69, 1];
export const COAST_BLUE: Color = [0.25, 0.67, 0.87, 1];
export const COAST_TILE: Color = [0.69, 0.2, 0.12, 1];
export const COAST_PALM: Color = [0.08, 0.4, 0.24, 1];
export const COAST_FLOWER: Color = [0.8, 0.12, 0.43, 1];
const TIMBER: Color = [0.62, 0.39, 0.21, 1];
const FOAM: Color = [0.9, 1, 0.94, 1];
const ACCENTS = [COAST_CORAL, COAST_MINT, COAST_BLUE, COAST_FLOWER] as const;

type CoastalPortal = { tileX: number; tileY: number; suffix: string; kind: VenueKind; x: number; y: number; heading: number };
export type CoastalAnchor = {
  id: string; label: string; originX: number; originY: number;
  width: number; height: number; lot: LotKind; portal: CoastalPortal;
};
const front = (kind: VenueKind, suffix: string, tileX = 0, tileY = 0): CoastalPortal => (
  { tileX, tileY, suffix, kind, x: 0, y: -9.5, heading: -Math.PI / 2 }
);

export const SOLANA_COAST_ANCHORS = [
  { id: "sunset-gate", label: "SUNSET GATE", originX: -25, originY: 2, width: 1, height: 1, lot: "coast-sunset-gate", portal: front("terminal", "welcome") },
  { id: "solana-pier", label: "SOLANA PIER", originX: -65, originY: -1, width: 8, height: 1, lot: "coast-solana-pier", portal: { tileX: 7, tileY: 0, suffix: "pier-house", kind: "kiosk", x: 0, y: 0, heading: 0 } },
  { id: "mission-plaza", label: "MISSION DEL SOL", originX: -46, originY: 2, width: 3, height: 2, lot: "coast-mission-plaza", portal: front("civic", "courtyard", 1, 0) },
  { id: "tidal-aquarium", label: "TIDAL AQUARIUM", originX: -54, originY: 6, width: 2, height: 2, lot: "coast-tidal-aquarium", portal: front("civic", "aquarium") },
  { id: "pacific-club", label: "PACIFIC PALMS CLUB", originX: -52, originY: -8, width: 2, height: 2, lot: "coast-pacific-club", portal: front("hotel", "club-lobby") },
  { id: "mariposa-studio", label: "MARIPOSA PICTURES", originX: -42, originY: 10, width: 3, height: 2, lot: "coast-mariposa-studio", portal: front("civic", "studio-gate", 1, 0) },
  { id: "citrus-house", label: "CITRUS HOUSE", originX: -37, originY: -18, width: 2, height: 2, lot: "coast-citrus-house", portal: front("residence", "terrace") },
  { id: "surf-pavilion", label: "BREAKWATER SURF PAVILION", originX: -55, originY: 12, width: 2, height: 1, lot: "coast-surf-pavilion", portal: front("shop", "surf-counter") },
  { id: "sunset-bowl", label: "SUNSET BOWL", originX: -48, originY: 10, width: 2, height: 2, lot: "coast-sunset-bowl", portal: front("civic", "music-gate") },
  { id: "coastwatch", label: "COASTWATCH RESCUE", originX: -55, originY: -17, width: 1, height: 1, lot: "coast-coastwatch", portal: front("civic", "rescue-station") },
] as const satisfies readonly CoastalAnchor[];

export function coastalAnchorForBlock(blockX: number, blockY: number) {
  for (const definition of SOLANA_COAST_ANCHORS) {
    const tileX = blockX - definition.originX;
    const tileY = blockY - definition.originY;
    if (tileX >= 0 && tileX < definition.width && tileY >= 0 && tileY < definition.height) return { definition, tileX, tileY };
  }
  return null;
}

const VILLAGE = ["coast-courtyard", "coast-deco-shops", "coast-surf-shop", "coast-motor-inn", "coast-skate-park", "coast-beach-bungalow"] as const;
const HEIGHTS = ["coast-midcentury", "coast-midcentury", "coast-courtyard", "coast-cliff-garden", "coast-palm-garden"] as const;
const ARTS = ["coast-deco-shops", "coast-courtyard", "coast-skate-park", "coast-beach-bungalow", "coast-surf-shop"] as const;
const GATE = ["coast-deco-shops", "coast-courtyard", "coast-gas-stop", "coast-motor-inn", "coast-midcentury"] as const;

export function coastalLotForBlock(blockX: number, blockY: number): LotKind {
  const anchor = coastalAnchorForBlock(blockX, blockY);
  if (anchor) return anchor.definition.lot;
  if (blockX < COAST_LAND_MIN_BLOCK_X) return "coast-ocean";
  if (blockX < -57) return "coast-beach";
  if (blockX === -57) return "coast-promenade";
  if (coastCanalBlock(blockX, blockY)) return "coast-beach-bungalow";
  if (!coastSettlementPlan(blockX, blockY)) return blockY < -5 ? "coast-cliff-garden" : "coast-palm-garden";
  const area = solanaCoastAreaForBlock(blockX, blockY);
  const deck = area === "CITRUS HEIGHTS" ? HEIGHTS : area === "MARIPOSA ARTS" ? ARTS : area === "SUNSET GATE" ? GATE : VILLAGE;
  return deck[Math.floor(blockRandom(blockX, blockY, 0x501aca57)() * deck.length)];
}

export function coastalPortalSpecs(lot: LotKind, centerX: number, centerY: number, blockX: number, blockY: number) {
  const anchor = coastalAnchorForBlock(blockX, blockY);
  if (anchor) {
    const p = anchor.definition.portal;
    return p.tileX === anchor.tileX && p.tileY === anchor.tileY
      ? [{ suffix: p.suffix, kind: p.kind, label: anchor.definition.label, x: centerX + p.x, y: centerY + p.y, heading: p.heading }] : [];
  }
  const doors: Partial<Record<LotKind, { kind: VenueKind; label: string }>> = {
    "coast-surf-shop": { kind: "shop", label: "SOLANA SURF WORKS" },
    "coast-deco-shops": { kind: "shop", label: "MARIPOSA RECORDS" },
    "coast-motor-inn": { kind: "motel", label: "CORAL KEY MOTOR INN" },
    "coast-gas-stop": { kind: "gas", label: "SUNSET FUEL" },
    "coast-courtyard": { kind: "residence", label: "CASA DEL SOL" },
    "coast-midcentury": { kind: "residence", label: "CITRUS GLASS HOUSE" },
    "coast-beach-bungalow": { kind: "residence", label: "PACIFIC BEACH HOUSE" },
  };
  const door = doors[lot];
  if (!door || (door.kind === "residence" && blockRandom(blockX, blockY, 0xc0a57)() < 0.65)) return [];
  return [{ suffix: "front-door", ...door, x: centerX, y: centerY - 9.5, heading: -Math.PI / 2 }];
}

function box(ctx: LotContext, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color, material: Box["material"] = MAT_BUILDING, yaw = 0, pitch = 0, tilt = 0) {
  ctx.boxes.push({ x, y, z, sx, sy, sz, yaw, pitch, tilt, color, material });
}
function solid(ctx: LotContext, name: string, x: number, y: number, sx: number, sy: number, height: number) {
  ctx.colliders.push({ id: `coast-${name}:${ctx.blockX}:${ctx.blockY}:${ctx.colliders.length}`, x, y, halfX: sx / 2, halfY: sy / 2, height });
}
function water(ctx: LotContext, x: number, y: number, sx: number, sy: number, tone = COAST_OCEAN) {
  const id = `coastal-water:${ctx.blockX}:${ctx.blockY}:${ctx.surfaceRegions.length}`;
  box(ctx, x, y, 0.12, sx, sy, 0.16, tone, MAT_WATER);
  ctx.surfaceRegions.push({ id, kind: "water", x, y, halfX: sx / 2, halfY: sy / 2, yaw: 0 });
  ctx.colliders.push({ id, x, y, halfX: sx / 2, halfY: sy / 2, height: 1.2 });
}

export function addCoastalPalm(ctx: LotContext, x: number, y: number, scale = 1, collision = false) {
  coastPalm(ctx, x, y, scale, collision);
}

function building(ctx: LotContext, x: number, y: number, sx: number, sy: number, h: number, color: Color, accent: Color) {
  box(ctx, x, y, h / 2 + 0.4, sx, sy, h, color);
  box(ctx, x, y - sy / 2 - 0.05, h * 0.52, sx * 0.76, 0.15, h * 0.3, COAST_BLUE, MAT_WINDOW);
  box(ctx, x, y, h + 0.55, sx + 0.7, sy + 0.7, 0.38, accent);
  solid(ctx, "building", x, y, sx, sy, h + 0.8);
}

function stripedAwning(ctx: LotContext, x: number, y: number, sx: number, color: Color) {
  box(ctx, x, y, 3.4, sx, 3.1, 0.25, color, MAT_SIGN);
  for (let stripe = 0; stripe < 3; stripe += 1) box(ctx, x + (stripe - 1) * sx / 3, y, 3.56, sx / 6, 3.1, 0.05, COAST_STUCCO, MAT_GENERIC);
}

function surfBoards(ctx: LotContext, x: number, y: number) {
  for (let i = 0; i < 3; i += 1) {
    box(ctx, x + i * 0.85, y, 1.7, 0.56, 0.18, 2.8, ACCENTS[i], MAT_SIGN, 0, -0.15);
    box(ctx, x + i * 0.85, y - 0.12, 1.8, 0.1, 0.07, 2.1, FOAM, MAT_GENERIC);
  }
}

function rescueTower(ctx: LotContext, x: number, y: number, color = COAST_CORAL) {
  for (const dx of [-1.5, 1.5]) for (const dy of [-1.1, 1.1]) box(ctx, x + dx, y + dy, 1.8, 0.27, 0.27, 3.1, COAST_STUCCO);
  box(ctx, x, y, 3.4, 3.9, 3.1, 2.3, color);
  box(ctx, x, y - 1.58, 3.8, 2.7, 0.12, 0.8, COAST_BLUE, MAT_WINDOW);
  box(ctx, x, y, 4.8, 4.8, 4.1, 0.34, COAST_STUCCO);
  box(ctx, x + 1.9, y, 6, 0.12, 0.12, 2.8, INK, MAT_GENERIC);
  box(ctx, x + 2.65, y, 6.9, 1.5, 0.1, 0.8, COAST_CORAL, MAT_SIGN);
  solid(ctx, "rescue-tower", x, y, 4, 3.3, 5);
}

function coastalGround(ctx: LotContext, open = false) {
  const curb = open && ctx.blockX === -57;
  box(ctx, ctx.centerX - (curb ? 3 : 0), ctx.centerY, 0.18, open ? curb ? 30 : 36.02 : 24, open ? 36.02 : 24, 0.24, COAST_SAND, MAT_GENERIC);
}

function buildShore(ctx: LotContext, lot: LotKind) {
  const { centerX: x, centerY: y } = ctx;
  for (let row = 0; row < 6; row += 1) {
    const py = y - 15 + row * 6, shore = coastShoreXAt(py);
    const left = x - 18, right = Math.min(x + 18, shore);
    if (right > left) water(ctx, (left + right) / 2, py, right - left + 0.02, 6.02,
      right > shore - 36 ? COAST_SURF : COAST_OCEAN);
    if (shore >= left && shore < x + 18) box(ctx, shore - 0.5, py, 0.3, 1.1, 6.04, 0.06, FOAM, MAT_GENERIC);
  }
  if (lot === "coast-ocean") return;
  if (lot === "coast-promenade") {
    // End at the curb. No visual road is added to the pedestrian promenade.
    box(ctx, x, y, 0.08, 12, 36.02, 0.12, COAST_STUCCO, MAT_SIDEWALK);
    box(ctx, x - 6.5, y, 0.42, 0.45, 36.02, 0.12, COAST_CORAL, MAT_GENERIC);
    addCoastalPalm(ctx, x - 10, y - 9, 0.9, true);
    addCoastalPalm(ctx, x - 10, y + 9, 0.9, true);
    if (ctx.blockY % 3 === 0) surfBoards(ctx, x + 6, y + 5);
    return;
  }
  if (ctx.blockX === -58 && ctx.blockY % 4 === 0) rescueTower(ctx, x, y, COAST_BLUE);
  else if (ctx.blockX === -59 && ctx.blockY % 3 === 0) {
    for (const dx of [-6, 6]) {
      coastUmbrella(ctx, x + dx, y, dx < 0 ? COAST_CORAL : COAST_MINT);
      box(ctx, x + dx, y + 3, 0.4, 1.5, 3, 0.14, COAST_STUCCO, MAT_GENERIC);
    }
  } else if (ctx.blockX === -58 && ctx.blockY % 4 === 2) {
    // Beach volleyball court, with a clear sand floor.
    for (const dy of [-7, 7]) box(ctx, x, y + dy, 0.36, 10, 0.15, 0.05, FOAM, MAT_GENERIC);
    for (const dx of [-5, 5]) box(ctx, x + dx, y, 0.36, 0.15, 14, 0.05, FOAM, MAT_GENERIC);
    box(ctx, x, y, 1.5, 10, 0.12, 1.1, COAST_STUCCO, MAT_GENERIC);
  }
}

function buildCourtyard(ctx: LotContext, accent: Color) {
  const { centerX: x, centerY: y } = ctx;
  building(ctx, x, y + 5, 18, 6, 5, COAST_STUCCO, COAST_TILE);
  coastMissionRoof(ctx, x, y + 5, 5.55, 19.5, 7.5);
  for (const side of [-1, 1]) building(ctx, x + side * 7.8, y - 0.5, 3.5, 9, 4.8, COAST_STUCCO, COAST_TILE);
  box(ctx, x, y - 1, 0.48, 10, 9, 0.14, accent, MAT_SIDEWALK);
  coastArcade(ctx, x, y - 5.2, 13.2);
  box(ctx, x + 9.5, y + 6, 4.6, 2, 4, 1, COAST_FLOWER, MAT_FOLIAGE);
  for (const dx of [-9, 9]) box(ctx, x + dx, y + 6, 5.4, 2.5, 1.5, 0.8, COAST_FLOWER, MAT_FOLIAGE, dx);
}

function buildMidcentury(ctx: LotContext) {
  const { centerX: x, centerY: y } = ctx;
  coastGlassHouse(ctx, x - 1, y + 1);
  coastCypress(ctx, x + 10.5, y + 7, 0.85);
  coastSage(ctx, x - 9.5, y - 6.5, 0.75, true);
}

function buildLocal(ctx: LotContext, lot: LotKind) {
  const { centerX: x, centerY: y } = ctx;
  const accent = ACCENTS[Math.floor(ctx.random() * ACCENTS.length)];
  if (coastCanalBlock(ctx.blockX, ctx.blockY)) {
    // Slim courts leave a real bank walk on both sides of the canal lots.
    box(ctx, x, y, 0.1, 15, 24, 0.18, COAST_SAND, MAT_SIDEWALK);
    building(ctx, x, y + 3, 13, 10, 4.1, accent, COAST_STUCCO);
    coastMissionRoof(ctx, x, y + 3, 4.8, 14.5, 11.5);
    box(ctx, x, y - 4.5, 0.3, 13, 4, 0.24, TIMBER, MAT_SIDEWALK);
    coastSage(ctx, x - 5, y - 7, 0.55, true);
    coastPalm(ctx, x + 4, y + 10, 0.65, true);
    return;
  }
  if (lot !== "coast-palm-garden" && lot !== "coast-cliff-garden") coastalGround(ctx);
  if (lot === "coast-courtyard") { buildCourtyard(ctx, accent); return; }
  if (lot === "coast-midcentury") { buildMidcentury(ctx); return; }
  if (lot === "coast-palm-garden" || lot === "coast-cliff-garden") {
    buildCoastalVerge(ctx, () => true);
    return;
  }
  if (lot === "coast-skate-park") {
    box(ctx, x, y, 0.38, 22, 22, 0.22, COAST_MINT, MAT_SIDEWALK);
    for (const side of [-1, 1]) {
      box(ctx, x + side * 7, y, 1.2, 4, 13, 1.7, COAST_CORAL);
      box(ctx, x + side * 4.9, y, 1, 0.4, 13, 0.5, FOAM, MAT_GENERIC);
      solid(ctx, "skate-ramp", x + side * 7, y, 4, 13, 2);
    }
    box(ctx, x, y + 4, 0.95, 0.18, 8, 0.22, INK, MAT_GENERIC);
    addCoastalPalm(ctx, x + 9, y + 9, 0.7);
    return;
  }
  if (lot === "coast-beach-bungalow") {
    building(ctx, x, y + 2.5, 13, 9, 4.1, accent, COAST_STUCCO);
    box(ctx, x, y - 4, 0.52, 15, 4, 0.28, TIMBER, MAT_SIDEWALK);
    stripedAwning(ctx, x, y - 4, 11, COAST_STUCCO);
    coastMissionRoof(ctx, x, y + 2.5, 4.8, 14.5, 10.5);
    surfBoards(ctx, x + 7.5, y - 1);
    return;
  }
  const h = lot === "coast-deco-shops" ? 7.2 : 4.6;
  coastDecoBody(ctx, x, y + 2.5, 18, 9, h, lot === "coast-surf-shop" ? COAST_BLUE : COAST_STUCCO, accent);
  stripedAwning(ctx, x, y - 3.3, 16, accent);
  if (lot === "coast-surf-shop") surfBoards(ctx, x + 6, y - 6);
  if (lot === "coast-deco-shops") {
    for (let step = 0; step < 3; step += 1) box(ctx, x, y + 1, h + 1 + step * 0.7, 9 - step * 2, 5 - step, 0.75, accent);
    box(ctx, x - 7, y - 2.2, 5, 0.8, 0.5, 6.7, COAST_CORAL, MAT_SIGN);
  }
  if (lot === "coast-motor-inn") {
    coastGoogieRoof(ctx, x, y + 1, h + 0.5, 22, 12);
    box(ctx, x + 9.5, y - 6, 6, 0.32, 0.32, 11, TIMBER);
    box(ctx, x + 9.5, y - 6, 10, 5.8, 0.5, 2, accent, MAT_SIGN, -0.2);
    box(ctx, x + 9.5, y - 6, 11.7, 3, 0.5, 1, COAST_STUCCO, MAT_SIGN);
  }
  if (lot === "coast-gas-stop") {
    coastGoogieRoof(ctx, x, y - 3, 5, 22, 12);
    for (const dx of [-6, 6]) {
      box(ctx, x + dx, y - 6.5, 1.1, 1, 1, 1.6, COAST_CORAL);
      solid(ctx, "fuel-pump", x + dx, y - 6.5, 1, 1, 1.9);
    }
  }
}

function buildPier(ctx: LotContext, tileX: number) {
  const { centerX: x, centerY: y } = ctx;
  for (const side of [-1, 1]) {
    const py = y + side * 13.5, left = x - 18, right = Math.min(x + 18, coastShoreXAt(py));
    if (right > left) water(ctx, (left + right) / 2, py, right - left + 0.02, 9.02, COAST_SURF);
  }
  box(ctx, x, y, COAST_PIER.deckHeight - 0.16, 36.02, 18, 0.32, TIMBER, MAT_SIDEWALK);
  for (let plank = -16; plank <= 16; plank += 3.2) box(ctx, x + plank, y, 0.65, 0.12, 18, 0.03, COAST_STUCCO, MAT_GENERIC);
  for (const side of [-1, 1]) {
    box(ctx, x, y + side * 8.4, 1.55, 36, 0.22, 0.25, COAST_STUCCO);
    solid(ctx, "pier-rail", x, y + side * 8.4, 36.02, 0.3, 1.8);
    for (const dx of [-12, 12]) {
      box(ctx, x + dx, y + side * 7.2, -1.9, 0.65, 0.65, 5.1, TIMBER, MAT_GENERIC);
      ctx.colliders.push({ id: `coast-pier-piling:${ctx.blockX}:${side}:${dx}`, x: x + dx, y: y + side * 7.2,
        halfX: 0.325, halfY: 0.325, baseZ: -4.45, height: 5.1 });
      box(ctx, x + dx, y + side * 8.4, 1.1, 0.25, 0.25, 1.3, COAST_STUCCO);
    }
  }
  if (tileX === 3 || tileX === 5) {
    for (const side of [-1, 1]) {
      box(ctx, x, y + side * 6.2, 2.2, 11, 2.6, 3.1, tileX === 3 ? COAST_CORAL : COAST_BLUE);
      coastGoogieRoof(ctx, x, y + side * 6.2, 4, 12, 3.5);
      solid(ctx, "pier-kiosk", x, y + side * 6.2, 11, 2.6, 4.5);
    }
  }
  if (tileX === 7) {
    for (const side of [-1, 1]) {
      box(ctx, x, y + side * 4.5, 4, 0.6, 0.6, 7, COAST_CORAL);
      solid(ctx, "pier-gate", x, y + side * 4.5, 0.6, 0.6, 7.5);
    }
    box(ctx, x, y, 7.2, 1, 10, 1.1, COAST_MINT, MAT_SIGN);
    ctx.colliders.push({ id: "coast-pier-gate-crown", x, y, halfX: 0.5, halfY: 5, baseZ: 6.65, height: 1.1 });
  }
}

function buildAnchor(ctx: LotContext, anchor: NonNullable<ReturnType<typeof coastalAnchorForBlock>>) {
  const { definition: d, tileX, tileY } = anchor;
  const { centerX: x, centerY: y } = ctx;
  if (d.id === "solana-pier") { buildPier(ctx, tileX); return; }
  // Fill internal campus seams; all roads there are closed by the shared registry.
  const west = tileX ? 18 : 12, east = tileX < d.width - 1 ? 18 : 12;
  const north = tileY ? 18 : 12, south = tileY < d.height - 1 ? 18 : 12;
  box(ctx, x + (east - west) / 2, y + (south - north) / 2, 0.18, west + east, north + south, 0.24, COAST_SAND, MAT_GENERIC);
  if (d.id === "mission-plaza") {
    buildCourtyard(ctx, COAST_CORAL);
    if (tileX === 1 && tileY === 1) {
      box(ctx, x, y + 3, 11, 4.5, 4.5, 17, COAST_STUCCO);
      box(ctx, x, y + 3, 20, 6, 6, 1.2, COAST_TILE);
      coastMissionRoof(ctx, x, y + 3, 20.7, 6.4, 6.4);
      for (const dx of [-1, 1]) box(ctx, x + dx, y + 0.7, 17.2, 0.7, 0.12, 2.4, INK, MAT_GENERIC);
      solid(ctx, "bell-tower", x, y + 3, 4.5, 4.5, 21);
    }
  } else if (d.id === "citrus-house") buildMidcentury(ctx);
  else if (d.id === "tidal-aquarium") {
    coastDecoBody(ctx, x, y + 3, 21, 12, 7.3, COAST_STUCCO, COAST_SURF);
    coastAquariumRoof(ctx, x, y + 3, 7.35);
    for (let fin = -1; fin <= 1; fin += 1) box(ctx, x + fin * 6, y - 3.2, 5.4, 0.8, 1, 5.8, COAST_SURF);
  } else if (d.id === "mariposa-studio") {
    coastDecoBody(ctx, x, y + 3, 23, 13, tileY ? 11 : 6, COAST_STUCCO, COAST_CORAL);
    for (let step = 0; step < 3; step += 1) box(ctx, x, y - 3, 7 + step, 17 - step * 4, 2, 1, tileX % 2 ? COAST_BLUE : COAST_CORAL);
    box(ctx, x, y - 4.2, 4, 13, 0.18, 1.8, INK, MAT_SIGN);
    for (let frame = -2; frame <= 2; frame += 1) {
      box(ctx, x + frame * 2.3, y - 4.35, 4.35, 0.8, 0.1, 0.24, COAST_STUCCO, MAT_SIGN);
      box(ctx, x + frame * 2.3, y - 4.35, 3.65, 0.8, 0.1, 0.24, COAST_STUCCO, MAT_SIGN);
    }
  } else if (d.id === "pacific-club") {
    buildCourtyard(ctx, COAST_BLUE);
    addCoastalPalm(ctx, x - 10, y + 9, 1, true);
    addCoastalPalm(ctx, x + 10, y + 9, 1, true);
    box(ctx, x, y - 0.5, 0.7, 5.5, 3.5, 0.18, COAST_SURF, MAT_WATER);
    solid(ctx, "club-pool", x, y - 0.5, 5.5, 3.5, 0.85);
  } else if (d.id === "surf-pavilion") {
    building(ctx, x, y + 3, 21, 9, 4.8, COAST_BLUE, COAST_STUCCO);
    stripedAwning(ctx, x, y - 3, 20, COAST_CORAL);
    coastGoogieRoof(ctx, x, y + 3, 5.3, 23, 11);
    surfBoards(ctx, x - 7, y - 6);
    surfBoards(ctx, x + 5, y - 6);
  } else if (d.id === "sunset-bowl") {
    box(ctx, x, y, 0.4, 26, 23, 0.25, COAST_CORAL, MAT_SIDEWALK);
    for (let tier = 0; tier < 4; tier += 1) box(ctx, x, y + tier * 3 - 1, 0.8 + tier * 0.4, 24 - tier, 1.5, 0.6, COAST_STUCCO);
    if (tileX === 0 && tileY === 1) {
      box(ctx, x + 18, y + 3, 0.8, 49, 10, 0.6, TIMBER, MAT_SIDEWALK);
      coastBandShell(ctx, x + 18, y + 3, 24);
    }
  } else if (d.id === "coastwatch") {
    building(ctx, x, y + 4, 18, 8, 4.5, COAST_STUCCO, COAST_CORAL);
    coastMissionRoof(ctx, x, y + 4, 5.05, 19.5, 9.5);
    rescueTower(ctx, x + 7, y + 5);
  } else {
    building(ctx, x, y + 5, 14, 7, 4, COAST_STUCCO, COAST_CORAL);
    for (const dx of [-7, 7]) {
      box(ctx, x + dx, y - 3, 5.5, 1.2, 1.2, 10, COAST_MINT);
      solid(ctx, "gateway", x + dx, y - 3, 1.2, 1.2, 11);
    }
    box(ctx, x, y - 3, 10.5, 15.2, 1.2, 1.7, COAST_CORAL, MAT_SIGN);
    box(ctx, x, y - 3, 12, 8, 0.6, 1.2, COAST_STUCCO, MAT_SIGN);
    coastGoogieRoof(ctx, x, y + 4, 5, 17, 9);
  }
}

export function buildCoastalLot(ctx: LotContext, lot: LotKind) {
  const anchor = coastalAnchorForBlock(ctx.blockX, ctx.blockY);
  if (anchor) buildAnchor(ctx, anchor);
  else if (lot === "coast-ocean" || lot === "coast-beach" || lot === "coast-promenade") buildShore(ctx, lot);
  else buildLocal(ctx, lot);
}

export function coastalPedestrianCountForBlock(blockX: number, blockY: number) {
  if (blockX <= -57) return 0; // No generic curb walkers in the sea or sand.
  if (coastCanalBlock(blockX, blockY)) return 4;
  const lot = coastalLotForBlock(blockX, blockY);
  if (lot === "coast-cliff-garden" || lot === "coast-palm-garden") return 0;
  return solanaCoastAreaForBlock(blockX, blockY) === "CITRUS HEIGHTS" ? 2 : 6;
}

export function buildCoastalVerge(ctx: LotContext, clear: (x: number, y: number) => boolean) {
  const { centerX: x, centerY: y } = ctx;
  for (let index = 0; index < 3; index += 1) {
    const px = x + (ctx.random() - 0.5) * 26, py = y + (ctx.random() - 0.5) * 26;
    if (!clear(px, py)) continue;
    const height = coastNaturalHeight(px, py);
    const steep = Math.abs(coastNaturalHeight(px + 2, py) - height) + Math.abs(coastNaturalHeight(px, py + 2) - height) > 2.5;
    if (steep) { coastSage(ctx, px, py, 0.7); continue; }
    if (index === 0 && ctx.random() < (y < -200 ? 0.2 : 0.7)) addCoastalPalm(ctx, px, py, 0.8 + ctx.random() * 0.45, true);
    else if (index === 1 && y < -180 && ctx.random() < 0.35) {
      ctx.surfaces?.push(...facetedBoulder({ x: px, y: py, z: 0 }, 3.5, 2.8, 2.6, [0.73, 0.66, 0.48, 1]));
      ctx.colliders.push({ id: `coast-boulder:${ctx.blockX}:${ctx.blockY}`, x: px, y: py, halfX: 1.3, halfY: 1.1, height: 2.6, groundAnchor: { x: px, y: py } });
    } else coastSage(ctx, px, py, 0.8 + ctx.random() * 0.6, index % 2 === 0);
  }
}
