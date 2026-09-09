import { blockRandom } from "./random";
import type { LotKind, VenueKind } from "./model";
import { CEDAR_ROADS, CEDAR_COURTS, cedarLocalStreetEnabled } from "./cedar-layout";
import { compileRoad, sampleRoad } from "./roads/geometry";
import { RoadSpatialIndex } from "./roads/spatial-index";

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
  if (blockX <= 30) return "willow-gate";
  if (blockX >= 52) return "garden-end";
  if (blockY <= -6) return "pine-ridge";
  if (blockY >= 8) return "brookside";
  return "maple-commons";
}

export function cedarGridStreetEnabled(input: { x: number; y: number }, axis: "vertical" | "horizontal") {
  // Topology is also queried from a traffic lane, not just its centerline.
  const point = axis === "vertical" ? { x: Math.round(input.x / 36) * 36, y: input.y }
    : { x: input.x, y: Math.round(input.y / 36) * 36 };
  for (const anchor of CEDAR_VALE_ANCHORS) {
    const left = anchor.originX * 36, right = left + anchor.width * 36;
    const top = anchor.originY * 36, bottom = top + anchor.height * 36;
    if (point.x > left + 0.02 && point.x < right - 0.02 && point.y > top + 0.02 && point.y < bottom - 0.02) return false;
    if (axis === "vertical" && (Math.abs(point.x - left) < 0.02 || Math.abs(point.x - right) < 0.02)
      && point.y >= top && point.y <= bottom) return true;
    if (axis === "horizontal" && (Math.abs(point.y - top) < 0.02 || Math.abs(point.y - bottom) < 0.02)
      && point.x >= left && point.x <= right) return true;
  }
  return cedarLocalStreetEnabled(point, axis);
}

export type CedarParcel = { x: number; y: number; heading: number; roadId: string; blockX: number; blockY: number };
let parcelCache: Map<string, CedarParcel> | null = null;
let streetIndex: RoadSpatialIndex | null = null;

/** Flat layout geometry is shared with road authoring without importing the world graph. */
export function cedarStreetIndex() {
  if (!streetIndex) {
    const roads = CEDAR_ROADS.map((road) => compileRoad(road.id, road.points, road.halfWidth, road.closed));
    for (let x = 792; x <= 2376; x += 36) for (let y = -792; y <= 792; y += 36) {
      if (y < 792 && cedarGridStreetEnabled({ x, y: y + 18 }, "vertical")) roads.push(compileRoad(`cedar-grid-v:${x}:${y}`, [{ x, y }, { x, y: y + 36 }], 6));
      if (x < 2376 && cedarGridStreetEnabled({ x: x + 18, y }, "horizontal")) roads.push(compileRoad(`cedar-grid-h:${x}:${y}`, [{ x, y }, { x: x + 36, y }], 6));
    }
    streetIndex = new RoadSpatialIndex(roads);
  }
  return streetIndex;
}

export function cedarParcels() {
  if (parcelCache) return parcelCache;
  const parcels = new Map<string, CedarParcel>();
  const index = cedarStreetIndex();
  const overlapsParcel = (a: CedarParcel, b: CedarParcel) => {
    const ac = cedarParcelPoint(a, 0, 1), bc = cedarParcelPoint(b, 0, 1);
    return [a.heading, a.heading + Math.PI / 2, b.heading, b.heading + Math.PI / 2].every((axis) => {
      const separation = Math.abs((ac.x - bc.x) * Math.cos(axis) + (ac.y - bc.y) * Math.sin(axis));
      const radius = (heading: number) => 14.2 * Math.abs(Math.cos(heading - axis)) + 14.7 * Math.abs(Math.sin(heading - axis));
      return separation < radius(a.heading) + radius(b.heading);
    });
  };
  const add = (x: number, y: number, heading: number, roadId: string) => {
    if (x < 810 || x > 2358 || y < -774 || y > 774) return;
    const blockX = Math.floor(x / 36), blockY = Math.floor(y / 36), key = `${blockX}:${blockY}`;
    if (parcels.has(key) || index.query({ x, y }, 12).length) return;
    if (CEDAR_VALE_ANCHORS.some((anchor) => x >= anchor.originX * 36 - 17 && x <= (anchor.originX + anchor.width) * 36 + 17
      && y >= anchor.originY * 36 - 17 && y <= (anchor.originY + anchor.height) * 36 + 17)) return;
    const candidate = { x, y, heading, roadId, blockX, blockY };
    // Fences at the back and sides must also clear crossing streets and bends.
    for (const dx of [-12.5, 12.5]) for (const dy of [-4.5, 3.5, 11.5]) {
      if (index.query(cedarParcelPoint(candidate, dx, dy), 0.75).length) return;
    }
    for (const parcel of parcels.values()) if (Math.hypot(parcel.x - x, parcel.y - y) < 42 && overlapsParcel(candidate, parcel)) return;
    parcels.set(key, candidate);
  };
  for (const court of CEDAR_COURTS) {
    const end = court.stem[court.stem.length - 1];
    const approach = Math.atan2(end[1] - court.center.y, end[0] - court.center.x);
    for (const turn of [0.5, 1, 1.5]) {
      const angle = approach + turn * Math.PI;
      add(court.center.x + Math.cos(angle) * 32, court.center.y + Math.sin(angle) * 32,
        angle - Math.PI / 2, `${court.id}-turnaround`);
    }
  }
  for (const road of CEDAR_ROADS) {
    const geometry = compileRoad(road.id, road.points, road.halfWidth, road.closed);
    const spacing = road.id === "garden-end-loop" || road.id === "moonbeam-road" ? 42 : 36;
    for (let distance = 18; distance < geometry.length - 12; distance += spacing) {
      const sample = sampleRoad(geometry, distance);
      for (const side of [-1, 1]) add(sample.center.x - Math.sin(sample.heading) * 23 * side,
        sample.center.y + Math.cos(sample.heading) * 23 * side, sample.heading + (side < 0 ? Math.PI : 0), road.id);
    }
  }
  for (let x = 792; x <= 2376; x += 36) for (let y = -792; y <= 792; y += 36) {
    if (y < 792 && cedarGridStreetEnabled({ x, y: y + 18 }, "vertical")) for (const side of [-1, 1]) add(x - side * 23, y + 18, Math.PI / 2 + (side < 0 ? Math.PI : 0), "cedar-local-street");
    if (x < 2376 && cedarGridStreetEnabled({ x: x + 18, y }, "horizontal")) for (const side of [-1, 1]) add(x + 18, y + side * 23, side < 0 ? Math.PI : 0, "cedar-local-street");
  }
  parcelCache = parcels;
  return parcels;
}

export function cedarParcelForBlock(blockX: number, blockY: number) {
  return cedarParcels().get(`${blockX}:${blockY}`) ?? null;
}

export function cedarParcelPoint(parcel: CedarParcel, x: number, y: number) {
  return { x: parcel.x + x * Math.cos(parcel.heading) - y * Math.sin(parcel.heading),
    y: parcel.y + x * Math.sin(parcel.heading) + y * Math.cos(parcel.heading) };
}

/** Residents walk the street frontage, following its curve and paved sidewalk. */
export function residentialPedestrianPoint(blockX: number, blockY: number, seconds: number, slot: number) {
  const parcel = cedarParcelForBlock(blockX, blockY);
  if (!parcel || slot < 0 || slot > 1 || blockRandom(blockX, blockY, 0xface)() > 0.7) return null;
  const along = Math.sin(seconds * 0.2 + blockX + blockY + slot * Math.PI) * 8;
  const localStreet = parcel.roadId === "cedar-local-street";
  const passingLane = slot ? 0.38 : -0.38;
  const probe = cedarParcelPoint(parcel, along, localStreet ? -14.5 + passingLane : -16.3);
  const index = cedarStreetIndex();
  if (localStreet) return index.query(probe, 0.6).length ? null : { ...probe, z: 0.12 };
  const road = index.query(probe, 2).find((item) => item.roadId === parcel.roadId);
  if (!road) return null;
  const lateral = Math.sign(road.lateralOffset) * (road.halfWidth - 1 + passingLane);
  const point = { x: road.center.x + road.right.x * lateral, y: road.center.y + road.right.y * lateral, z: 0.66 };
  if (index.query(point, 1).some((item) => item.roadId !== road.roadId)) return null;
  return point;
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
  const parcel = cedarParcelForBlock(blockX, blockY);
  if (!parcel) return blockRandom(blockX, blockY, 0x6a4d)() < 0.035
    ? "vale-community-garden" : "vale-pocket-park";
  if (parcel.roadId.endsWith("-turnaround")) return (["vale-ranch", "vale-cottages", "vale-bungalow"] as const)
    [Math.floor(blockRandom(blockX, blockY, 0xc017)() * 3)];
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
  const parcel = cedarParcelForBlock(blockX, blockY);
  if (!parcel) return [];
  if (lot === "vale-corner-flats") {
    return [{ suffix: "corner-shop", kind: "shop", label: "CEDAR CORNER", ...cedarParcelPoint(parcel, -2, -8.3), heading: parcel.heading - Math.PI / 2 }];
  }
  if (lot === "vale-garden-apartments") {
    return [{ suffix: "garden-lobby", kind: "apartment", label: "VALE GARDENS", ...cedarParcelPoint(parcel, -2, -8.3), heading: parcel.heading - Math.PI / 2 }];
  }
  return [{ suffix: "front-porch", kind: "residence", label: "CEDAR VALE HOME", ...cedarParcelPoint(parcel, -2, -8.3), heading: parcel.heading - Math.PI / 2 }];
}
