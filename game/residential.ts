import { blockRandom } from "./random";
import type { LotKind, VenueKind } from "./model";

export type CedarNeighborhood =
  | "willow-gate"
  | "pine-ridge"
  | "maple-commons"
  | "brookside"
  | "garden-end";

export type ResidentialAnchor = {
  id: string;
  label: string;
  lot: LotKind;
  originX: number;
  originY: number;
  width: number;
  height: number;
  portalTileX: number;
  portalTileY: number;
  venueKind: VenueKind;
};

export const CEDAR_VALE_ANCHORS: readonly ResidentialAnchor[] = [
  { id: "gateway-station", label: "CEDAR VALE GATEWAY", lot: "vale-gateway-station", originX: 23, originY: -1, width: 1, height: 1, portalTileX: 0, portalTileY: 0, venueKind: "terminal" },
  { id: "maple-commons", label: "MAPLE COMMONS", lot: "vale-commons", originX: 39, originY: -1, width: 2, height: 2, portalTileX: 0, portalTileY: 0, venueKind: "civic" },
  { id: "bellwether-school", label: "BELLWETHER SCHOOL", lot: "vale-school", originX: 34, originY: -14, width: 3, height: 2, portalTileX: 1, portalTileY: 0, venueKind: "civic" },
  { id: "cedar-library", label: "CEDAR BRANCH LIBRARY", lot: "vale-library", originX: 44, originY: -4, width: 2, height: 1, portalTileX: 0, portalTileY: 0, venueKind: "civic" },
  { id: "brookside-rec", label: "BROOKSIDE REC CENTER", lot: "vale-pool", originX: 44, originY: 12, width: 2, height: 2, portalTileX: 0, portalTileY: 0, venueKind: "civic" },
  { id: "engine-house-9", label: "ENGINE HOUSE 9", lot: "vale-firehouse", originX: 29, originY: 10, width: 1, height: 1, portalTileX: 0, portalTileY: 0, venueKind: "civic" },
  { id: "garden-water-tower", label: "GARDEN END WATER TOWER", lot: "vale-water-tower", originX: 57, originY: -2, width: 1, height: 1, portalTileX: 0, portalTileY: 0, venueKind: "kiosk" },
  { id: "moonbeam-drive-in", label: "MOONBEAM DRIVE-IN", lot: "vale-drive-in", originX: 60, originY: 11, width: 3, height: 2, portalTileX: 0, portalTileY: 0, venueKind: "diner" },
] as const;

export function cedarNeighborhoodForBlock(blockX: number, blockY: number): CedarNeighborhood {
  if (blockX <= 31) return "willow-gate";
  if (blockY <= -8) return "pine-ridge";
  if (blockY >= 8) return "brookside";
  if (blockX >= 53) return "garden-end";
  return "maple-commons";
}

export function residentialAnchorForBlock(blockX: number, blockY: number) {
  for (const anchor of CEDAR_VALE_ANCHORS) {
    const tileX = blockX - anchor.originX;
    const tileY = blockY - anchor.originY;
    if (tileX >= 0 && tileX < anchor.width && tileY >= 0 && tileY < anchor.height) {
      return { anchor, tileX, tileY };
    }
  }
  return null;
}

const QUIET_DECK = [
  "vale-bungalow", "vale-bungalow", "vale-bungalow", "vale-ranch", "vale-ranch",
  "vale-duplex", "vale-cottages", "vale-cottages", "vale-pocket-park",
  "vale-community-garden", "vale-recreation",
] as const satisfies readonly LotKind[];

const WILLOW_DECK = [
  "vale-duplex", "vale-duplex", "vale-rowhomes", "vale-rowhomes",
  "vale-garden-apartments", "vale-garden-apartments", "vale-corner-flats",
  "vale-bungalow", "vale-pocket-park",
] as const satisfies readonly LotKind[];

const COMMONS_DECK = [
  "vale-rowhomes", "vale-garden-apartments", "vale-corner-flats",
  "vale-duplex", "vale-cottages", "vale-pocket-park", "vale-community-garden",
  "vale-recreation", "vale-bungalow",
] as const satisfies readonly LotKind[];

const BROOKSIDE_DECK = [
  "vale-cottages", "vale-cottages", "vale-duplex", "vale-bungalow",
  "vale-bungalow", "vale-ranch", "vale-pocket-park", "vale-recreation",
  "vale-community-garden",
] as const satisfies readonly LotKind[];

export function residentialLotForBlock(blockX: number, blockY: number): LotKind {
  const anchor = residentialAnchorForBlock(blockX, blockY);
  if (anchor) return anchor.anchor.lot;
  const neighborhood = cedarNeighborhoodForBlock(blockX, blockY);
  const localX = blockX - 22;
  const localY = blockY + 22;
  const macroTone = blockRandom(Math.floor(localX / 4), Math.floor(localY / 4), 0xce4a)();
  const roll = (blockRandom(localX, localY, 0xceda)() * 0.76 + macroTone * 0.24) % 1;
  const deck = neighborhood === "willow-gate"
    ? WILLOW_DECK
    : neighborhood === "maple-commons"
      ? COMMONS_DECK
      : neighborhood === "brookside"
        ? BROOKSIDE_DECK
        : QUIET_DECK;
  return deck[Math.min(deck.length - 1, Math.floor(roll * deck.length))];
}

export type ResidentialPortalSpec = {
  suffix: string;
  kind: VenueKind;
  label: string;
  x: number;
  y: number;
  heading?: number;
};

export function residentialPortalSpecs(
  lot: LotKind,
  centerX: number,
  centerY: number,
  blockX: number,
  blockY: number,
): ResidentialPortalSpec[] {
  const anchorTile = residentialAnchorForBlock(blockX, blockY);
  if (anchorTile) {
    const { anchor, tileX, tileY } = anchorTile;
    if (tileX !== anchor.portalTileX || tileY !== anchor.portalTileY) return [];
    return [{
      suffix: anchor.id,
      kind: anchor.venueKind,
      label: anchor.label,
      x: centerX,
      y: centerY - (anchor.id === "bellwether-school" ? 10.8 : 8.4),
    }];
  }
  // Roughly two thirds of homes expose an enterable residence. Visual doors
  // remain on every house while the interaction stream stays comfortably low.
  if (blockRandom(blockX, blockY, 0xd00f)() < 0.34) return [];
  if (["vale-pocket-park", "vale-community-garden", "vale-recreation"].includes(lot)) return [];
  if (lot === "vale-corner-flats") {
    return [{ suffix: "corner-shop", kind: "shop", label: "CEDAR CORNER", x: centerX - 2.8, y: centerY - 7.9 }];
  }
  if (lot === "vale-garden-apartments") {
    return [{ suffix: "garden-lobby", kind: "apartment", label: "VALE GARDENS", x: centerX, y: centerY - 7.9 }];
  }
  return [{ suffix: "front-porch", kind: "residence", label: "CEDAR VALE HOME", x: centerX - 4.2, y: centerY - 7.8 }];
}
