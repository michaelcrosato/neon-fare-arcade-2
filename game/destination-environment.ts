import { DESTINATION_ART } from "./destination-cards";
import type { DestinationCard, LotKind } from "./model";

/** Only actual built lot families are admitted. Parks, empty rural lots and water are absent. */
const NEIGHBORHOOD_ART: Partial<Record<LotKind, readonly [number, string]>> = {
  tower: [21, "OFFICE ARRIVAL"], office: [21, "OFFICE VISIT"], apartment: [92, "HOME VISIT"],
  shops: [17, "SHOPPING TRIP"], diner: [13, "DINER MEETUP"], townhouses: [16, "HOME VISIT"],
  homes: [86, "NEIGHBORHOOD VISIT"], carwash: [10, "SERVICE APPOINTMENT"],
  warehouse: [10, "WORKSHOP VISIT"], factory: [10, "WORK SHIFT"], motel: [19, "MOTEL CHECK-IN"],
  civic: [15, "CIVIC VISIT"], market: [6, "MARKET DAY"],
  marina: [91, "MARINA MEETUP"], boardwalk: [8, "BOARDWALK VISIT"],
  "vale-bungalow": [86, "HOME VISIT"], "vale-ranch": [86, "HOME VISIT"],
  "vale-duplex": [86, "HOME VISIT"], "vale-cottages": [86, "HOME VISIT"],
  "vale-rowhomes": [16, "HOME VISIT"], "vale-garden-apartments": [86, "NEIGHBORHOOD VISIT"],
  "vale-corner-flats": [86, "NEIGHBORHOOD VISIT"],
  "range-cabin": [87, "CABIN VISIT"], "range-a-frame": [87, "CABIN VISIT"],
  "range-farmstead": [87, "FARMSTEAD VISIT"], "range-lakeside-home": [87, "CABIN VISIT"],
  "range-chalet": [87, "CHALET VISIT"], "range-gas-stop": [55, "TRAVEL SUPPLIES"],
  "range-main-street": [56, "VILLAGE MEETUP"],
  "range-roadside-motel": [94, "MOTEL CHECK-IN"],
  "mesa-adobe-home": [88, "HOME VISIT"], "mesa-courtyard-home": [88, "HOME VISIT"],
  "mesa-casita": [88, "CASITA VISIT"], "mesa-desert-ranch": [88, "RANCH VISIT"],
  "mesa-motor-court": [66, "MOTEL CHECK-IN"], "mesa-gas-stop": [64, "TRAVEL SUPPLIES"],
  "mesa-main-street": [95, "TOWN MEETUP"],
  "reach-condo": [89, "HOME VISIT"], "reach-courtyard": [89, "NEIGHBORHOOD VISIT"],
  "reach-deco-hotel": [31, "HOTEL CHECK-IN"], "reach-corner-cafe": [30, "CAFE MEETUP"],
  "reach-record-shop": [30, "RECORD-SHOP VISIT"], "reach-main-street": [30, "SHOPPING TRIP"],
  "reach-motel": [80, "MOTEL CHECK-IN"], "reach-marina": [33, "MARINA MEETUP"],
  "coast-midcentury": [27, "HOUSE VISIT"], "coast-deco-shops": [30, "SHOPPING TRIP"],
  "coast-courtyard": [93, "HOME VISIT"],
  "coast-surf-shop": [29, "SURF-SHOP VISIT"], "coast-motor-inn": [19, "MOTEL CHECK-IN"],
};

export function neighborhoodDestinationCard(lot: LotKind, placeId: string, label: string): DestinationCard | null {
  const match = NEIGHBORHOOD_ART[lot];
  if (!match) return null;
  const art = DESTINATION_ART[match[0]];
  return { id: `${placeId}:visit`, placeId, label, occasion: match[1], artCell: art.artCell,
    category: art.category, requiresWater: art.requiresWater, kind: "neighborhood" };
}

// Authored fictional outing purposes match the existing costume/prop art:
// Beckett's binoculars, Eira's map/compass, Forrest's pack, Imani's camera;
// Anouk/Frankie's guide gear, Sienna's surfboard and Leila's tide-pool kit.
const OUTDOOR_TRIPS: Readonly<Record<string, { setting: "trail" | "beach"; purpose: string }>> = {
  beckett: { setting: "trail", purpose: "WILDLIFE WALK" },
  eira: { setting: "trail", purpose: "TRAIL WALK" },
  forrest: { setting: "trail", purpose: "DAY HIKE" },
  imani: { setting: "trail", purpose: "LANDSCAPE PHOTOGRAPHY" },
  anouk: { setting: "beach", purpose: "SHOREBIRD WALK" },
  frankie: { setting: "beach", purpose: "BEACH WALK" },
  sienna: { setting: "beach", purpose: "SURF SESSION" },
  leila: { setting: "beach", purpose: "TIDE-POOL VISIT" },
};

export function riderHasScenicTrip(riderId: string) { return Object.hasOwn(OUTDOOR_TRIPS, riderId); }

export function scenicDestinationCard(lot: LotKind, riderId: string, placeId: string, label: string): DestinationCard | null {
  const trip = OUTDOOR_TRIPS[riderId];
  if (!trip) return null;
  const trail = lot === "range-trailhead" && trip.setting === "trail";
  const beach = (lot === "coast-beach" || lot === "coast-promenade" || lot === "reach-beach" || lot === "reach-promenade")
    && trip.setting === "beach";
  if (!trail && !beach) return null;
  const art = DESTINATION_ART[trail ? 77 : lot.startsWith("reach-") ? 83 : 24];
  return { id: `${placeId}:${riderId}:outing`, placeId,
    label: `${label} · ${trail ? "TRAILHEAD" : "BEACH ACCESS"}`, occasion: trip.purpose,
    artCell: art.artCell, category: art.category, requiresWater: art.requiresWater, kind: "scenic" };
}
