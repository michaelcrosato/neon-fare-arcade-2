import type { LotKind, VenueKind } from "./model";

export type ReachAnchor = {
  id: string; label: string; originX: number; originY: number; width: number; height: number; lot: LotKind;
  venueId: string;
  portal: { tileX: number; tileY: number; suffix: string; kind: VenueKind; x: number; y: number; heading: number };
};

/** Destination/service identity survives relocation onto the new peninsula. */
export const PALM_REACH_ANCHORS = [
  { id: "twinwater-gate", label: "PALM REACH GATEWAY", originX: 24, originY: 26, width: 1, height: 1, lot: "reach-twinwater-gate",
    venueId: "venue:24:26:welcome-house", portal: { tileX: 0, tileY: 0, suffix: "welcome-house", kind: "terminal", x: 6.5, y: 4, heading: -Math.PI / 2 } },
  { id: "lantern-bay-market", label: "CALLE LUNA MARKET", originX: 34, originY: 30, width: 3, height: 2, lot: "reach-lantern-market",
    venueId: "venue:35:35:market-hall", portal: { tileX: 1, tileY: 1, suffix: "market-hall", kind: "market", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "bayou-belle", label: "THE MIRAGE HOTEL", originX: 56, originY: 48, width: 3, height: 2, lot: "reach-bayou-belle",
    venueId: "venue:41:40:riverboat-lobby", portal: { tileX: 1, tileY: 1, suffix: "riverboat-lobby", kind: "hotel", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "stormwall-locks", label: "MIRAGE MARINE STADIUM", originX: 42, originY: 52, width: 4, height: 2, lot: "reach-stormwall-locks",
    venueId: "venue:29:56:lock-control", portal: { tileX: 3, tileY: 1, suffix: "lock-control", kind: "civic", x: 8, y: 0, heading: 0 } },
  { id: "cypress-crown", label: "FLAMINGO PARK", originX: 54, originY: 34, width: 3, height: 2, lot: "reach-cypress-crown",
    venueId: "venue:53:35:preserve-center", portal: { tileX: 1, tileY: 1, suffix: "preserve-center", kind: "kiosk", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "gulfwatch-station", label: "SUNDIAL LIGHTHOUSE", originX: 45, originY: 87, width: 2, height: 2, lot: "reach-gulfwatch-station",
    venueId: "venue:57:57:operations", portal: { tileX: 0, tileY: 1, suffix: "operations", kind: "civic", x: -5, y: 10, heading: Math.PI / 2 } },
  { id: "moonwater-marina", label: "MOONWATER YACHT CLUB", originX: 43, originY: 75, width: 3, height: 2, lot: "reach-moonwater-marina",
    venueId: "venue:46:51:marina-office", portal: { tileX: 1, tileY: 1, suffix: "marina-office", kind: "marina", x: 0, y: 8, heading: Math.PI / 2 } },
  { id: "sunkissed-motel", label: "SUN KISS MOTOR INN", originX: 52, originY: 61, width: 2, height: 1, lot: "reach-sunkissed-motel",
    venueId: "venue:32:47:motel-office", portal: { tileX: 0, tileY: 0, suffix: "motel-office", kind: "motel", x: -6, y: 9.5, heading: Math.PI / 2 } },
  { id: "blackwater-shipyard", label: "CHANNEL 86 STUDIOS", originX: 46, originY: 42, width: 3, height: 2, lot: "reach-blackwater-shipyard",
    venueId: "venue:59:46:shipyard-office", portal: { tileX: 0, tileY: 1, suffix: "shipyard-office", kind: "warehouse", x: -5, y: 8, heading: Math.PI / 2 } },
  { id: "saint-lumina", label: "SAINT LUMINA", originX: 40, originY: 27, width: 2, height: 2, lot: "reach-saint-lumina",
    venueId: "venue:49:59:chapel-door", portal: { tileX: 0, tileY: 1, suffix: "chapel-door", kind: "civic", x: -5, y: 8, heading: Math.PI / 2 } },
] as const satisfies readonly ReachAnchor[];
