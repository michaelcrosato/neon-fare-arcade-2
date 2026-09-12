import { ROAD_SPACING } from "./config";
import { CITY_LANDMARKS } from "./landmarks";
import type { DestinationCard, DestinationCategory, Vec2 } from "./model";
import { REGIONAL_CONTENT } from "./regional-content";
import type { WorldRegionId } from "./region-types";

type ArtSubject = readonly [subject: string, category: DestinationCategory, requiresWater?: boolean];

/** Visually audited, row-major subjects. An image is never chosen from a regional hash range. */
const ART_SUBJECTS = [
  ["Marina arcade with moored boats", "waterfront", true],
  ["Apex urban hotel", "hospitality"],
  ["Container freight terminal", "industry"],
  ["Rooftop broadcast studio", "culture"],
  ["Covered street market", "retail"],
  ["Cargo quay and cranes", "waterfront", true],
  ["Outdoor produce market", "retail"],
  ["Covered transit platform", "transport"],
  ["Waterside entertainment pier", "waterfront", true],
  ["Tall hotel and lobby", "hospitality"],
  ["Industrial workshop", "industry"],
  ["Urban rooftop garden", "civic"],
  ["Metro station entrance", "transport"],
  ["Neighborhood diner", "retail"],
  ["Theater and marquee", "culture"],
  ["Civic cultural building", "civic"],
  ["Residential row houses", "residential"],
  ["Glazed shopping arcade", "retail"],
  ["Truss bridge over water", "waterfront", true],
  ["Courtyard motel", "hospitality"],
  ["Faceted event hall", "culture"],
  ["Tall office entrance", "civic"],
  ["Ferry landing", "waterfront", true],
  ["Observatory dome", "culture"],
  ["Coastal beach and lifeguard tower", "waterfront", true],
  ["Solana amusement pier", "waterfront", true],
  ["Mission courtyard", "civic"],
  ["Coastal modern house", "residential"],
  ["Film studio gates", "culture"],
  ["Surf shops and beach boardwalk", "waterfront", true],
  ["Palm cafe and record-shop market", "retail"],
  ["Palm Art Deco hotel", "hospitality"],
  ["Waterfront causeway", "waterfront", true],
  ["Yacht club and marina", "waterfront", true],
  ["Coastal lighthouse", "waterfront", true],
  ["Waterfront rink and grandstand", "waterfront", true],
  ["Pulse Stadium", "culture"],
  ["Skyport airport terminal", "transport"],
  ["Nova Megamall", "retail"],
  ["Neon Titan robot plaza", "civic"],
  ["Deep Blue Aquarium", "culture"],
  ["Neon General Hospital", "civic"],
  ["Apex University campus", "civic"],
  ["Volt Expo exhibition halls", "culture"],
  ["Starfall twin observatory domes", "culture"],
  ["Lucky 88 Casino", "hospitality"],
  ["Cedar Vale gateway station", "transport"],
  ["Maple Commons gazebo and park", "park"],
  ["Bellwether School", "civic"],
  ["Cedar Branch Library", "civic"],
  ["Brookside recreation center and pool", "civic"],
  ["Engine House 9 fire station", "civic"],
  ["Garden End Water Tower", "civic"],
  ["Moonbeam Drive-In cinema", "culture"],
  ["Northstar gateway depot", "transport"],
  ["Timber Pass gas and general store", "retail"],
  ["Northstar village square", "civic"],
  ["Timberline mountain lodge", "hospitality"],
  ["Pinewatch Ranger Station", "civic"],
  ["Old Spruce timber mill", "industry"],
  ["Mirror Lake fishing lodge and dock", "waterfront", true],
  ["Silver Run ski resort", "hospitality"],
  ["Aurora Lookout observatory", "culture"],
  ["Sundown gateway depot", "transport"],
  ["Roadrunner trading post", "retail"],
  ["Copper Junction town plaza", "civic"],
  ["Coyote desert motor court", "hospitality"],
  ["Desert Bloom resort", "hospitality"],
  ["Dustwind Airpark hangars", "transport"],
  ["Ocotillo arts gallery", "culture"],
  ["Sunstone Solar Field", "industry"],
  ["Saguaro Rodeo Grounds", "culture"],
  ["Painted Canyon visitor center", "scenic"],
  ["Solana Sunset Gate", "transport"],
  ["Tidal coastal aquarium", "culture"],
  ["Pacific Palms club", "hospitality"],
  ["Sunset Bowl outdoor amphitheater", "culture"],
  ["Woodland trailhead and overlook", "scenic"],
  ["Palm Reach gateway", "transport"],
  ["Flamingo Park tennis and roller rink", "park"],
  ["Sun Kiss Art Deco motor inn", "hospitality"],
  ["Channel 86 television studios", "culture"],
  ["Saint Lumina church", "civic"],
  ["Tropical public beach", "waterfront", true],
  ["Inland city arcade and covered market", "culture"],
  ["City bus terminal and covered platforms", "transport"],
  ["Leafy suburban bungalow street", "residential"],
  ["Mountain cabin and A-frame lane", "residential"],
  ["Desert adobe courtyard home", "residential"],
  ["Palm Art Deco residential condos", "residential"],
  ["Coastwatch roadside rescue station", "civic"],
  ["City working marina with boats and slips", "waterfront", true],
  ["City apartment building", "residential"],
  ["Solana Spanish Revival courtyard homes", "residential"],
  ["Northstar roadside mountain motel", "hospitality"],
  ["Copper Mesa adobe main street shops", "retail"],
  ["Vulcan sawtooth steelworks and blast furnaces", "industry"],
  ["Blackline oil refinery and tank farms", "industry"],
  ["Ironwake cargo ship and container gantry cranes", "waterfront", true],
  ["Leviathan ship under construction in a flooded dry dock", "waterfront", true],
  ["Magnet King salvage yard and car crusher", "industry"],
  ["Shift Change chrome workers diner", "retail"],
] as const satisfies readonly ArtSubject[];

export const DESTINATION_ART = ART_SUBJECTS.map((entry: ArtSubject, artCell) => ({
  artCell, subject: entry[0], category: entry[1], requiresWater: entry[2] ?? false,
}));

type PlaceDetails = readonly [artCell: number, occasions: readonly [string, string, string]];
const PLACE_DETAILS: Readonly<Record<string, PlaceDetails>> = {
  "ironwake-gate": [7, ["SHIFT CHANGE", "PORT ARRIVAL", "CREW TRANSFER"]],
  "vulcan-foundry": [96, ["STEELWORKER SHIFT", "FOUNDRY TOUR", "MILL CREW CHANGE"]],
  "blackline-refinery": [97, ["REFINERY SHIFT", "PROCESS INSPECTION", "ENGINEERING CALL"]],
  "ironwake-container-port": [98, ["CARGO DISPATCH", "DOCK CREW CHANGE", "FREIGHT ARRIVAL"]],
  "leviathan-drydock": [99, ["SHIPYARD SHIFT", "VESSEL INSPECTION", "WELDING CREW CALL"]],
  "magnet-salvage": [100, ["SALVAGE AUCTION", "PARTS COLLECTION", "CRUSHER CREW CHANGE"]],
  "freight-exchange": [2, ["FREIGHT DISPATCH", "RAIL CREW CHANGE", "WAREHOUSE SHIFT"]],
  "shift-change-diner": [101, ["COFFEE BREAK", "AFTER-SHIFT SUPPER", "EARLY BIRD BREAKFAST"]],
  "ironwake-truck-stop": [26, ["FUEL STOP", "TRUCKER BREAK", "SERVICE CALL"]],
  "breakwater-watch": [34, ["HARBOR WATCH", "SHIP-SPOTTING WALK", "BREAKWATER SUNSET"]],
  "marina-arcade": [84, ["HIGH-SCORE NIGHT", "PINBALL TOURNAMENT", "ARCADE MEETUP"]],
  "apex-hotel": [1, ["HOTEL CHECK-IN", "ROOFTOP RECEPTION", "BREAKFAST MEETING"]],
  "south-terminal": [85, ["INTERCITY DEPARTURE", "LAST BUS HOME", "ARRIVALS MEETUP"]],
  "rooftop-radio": [3, ["LIVE RADIO SESSION", "RECORDING APPOINTMENT", "STUDIO TOUR"]],
  "ink-market": [4, ["MARKET DAY", "STREET-FOOD EVENING", "MAKERS FAIR"]],
  "redline-pier": [5, ["HARBOR SHIFT", "DOCKSIDE MEETUP", "CARGO COLLECTION"]],
  "pulse-stadium": [36, ["CHAMPIONSHIP GAME", "STADIUM CONCERT", "TEAM OPEN PRACTICE"]],
  "skyport-airport": [37, ["FLIGHT DEPARTURE", "ARRIVALS REUNION", "AIRPORT SHIFT"]],
  "nova-megamall": [38, ["SHOPPING DAY", "FOOD-COURT MEETUP", "MIDNIGHT LAUNCH"]],
  "neon-titan": [39, ["TITAN LIGHT SHOW", "PLAZA FESTIVAL", "SCULPTURE TOUR"]],
  "deep-blue-aquarium": [40, ["OCEAN HALL VISIT", "AQUARIUM AFTER DARK", "MARINE SCIENCE TALK"]],
  "neon-general": [41, ["VISITING HOURS", "CLINIC APPOINTMENT", "HOSPITAL SHIFT"]],
  "apex-university": [42, ["CAMPUS OPEN DAY", "GRADUATION CEREMONY", "GUEST LECTURE"]],
  "volt-expo": [43, ["GAMES EXPO", "DESIGN CONVENTION", "TRADE SHOW"]],
  "starfall-observatory": [44, ["METEOR-WATCH NIGHT", "PLANETARIUM SHOW", "TELESCOPE OPEN HOUSE"]],
  "lucky-88-casino": [45, ["LOUNGE SHOW", "CASINO NIGHT", "HOTEL RECEPTION"]],
  "gateway-station": [46, ["COMMUTER CONNECTION", "VISITOR ARRIVAL", "STATION MEETUP"]],
  "maple-commons": [47, ["COMMONS PICNIC", "GAZEBO CONCERT", "COMMUNITY FAIR"]],
  "bellwether-school": [48, ["SCHOOL OPEN HOUSE", "SCHOOL PLAY", "SPORTS DAY"]],
  "cedar-library": [49, ["BOOK-CLUB MEETING", "AUTHOR READING", "STUDY SESSION"]],
  "brookside-rec": [50, ["SWIM SESSION", "BASKETBALL NIGHT", "COMMUNITY CLASS"]],
  "engine-house-9": [51, ["FIREHOUSE OPEN DAY", "CREW SHIFT", "NEIGHBORHOOD FUNDRAISER"]],
  "garden-water-tower": [52, ["WATER-TOWER TOUR", "GARDEN WALK", "HERITAGE PHOTO WALK"]],
  "moonbeam-drive-in": [53, ["DOUBLE FEATURE", "CLASSIC MOVIE NIGHT", "DRIVE-IN PREMIERE"]],
  "northstar-gate": [54, ["VISITOR INFORMATION", "TRAIL-SHUTTLE MEETUP", "MOUNTAIN ARRIVAL"]],
  "copper-pass-gas": [55, ["TRAVEL SUPPLIES", "GENERAL-STORE ERRAND", "ROADSIDE MEETUP"]],
  "northstar-village-square": [56, ["VILLAGE MARKET", "TOWN FESTIVAL", "SQUARE MEETUP"]],
  "timberline-lodge": [57, ["LODGE CHECK-IN", "FIRESIDE DINNER", "MOUNTAIN WEDDING"]],
  "pinewatch-ranger": [58, ["RANGER-LED WALK", "TRAIL INFORMATION", "CONSERVATION TALK"]],
  "old-spruce-mill": [59, ["MILL SHIFT", "TIMBER COLLECTION", "WORKSHOP VISIT"]],
  "mirror-lake": [60, ["FISHING-LODGE VISIT", "LAKESIDE LUNCH", "DOCKSIDE MEETUP"]],
  "silver-run-resort": [61, ["SKI DAY", "RESORT CHECK-IN", "GONDOLA MEETUP"]],
  "aurora-lookout": [62, ["OBSERVATORY VISIT", "STAR-WATCH EVENING", "SUMMIT PHOTO WALK"]],
  "sundown-gate": [63, ["DESERT ARRIVAL", "VISITOR INFORMATION", "TOUR CONNECTION"]],
  "roadrunner-trading-post": [64, ["ROAD-TRIP SUPPLIES", "TRADING-POST VISIT", "GENERAL-STORE ERRAND"]],
  "copper-junction": [65, ["PLAZA FESTIVAL", "TOWN-HALL VISIT", "MARKET MEETUP"]],
  "coyote-motor-court": [66, ["MOTEL CHECK-IN", "ROADSIDE REUNION", "COURTYARD MEETUP"]],
  "desert-bloom-resort": [67, ["RESORT CHECK-IN", "POOL AFTERNOON", "GARDEN RECEPTION"]],
  "dustwind-airpark": [68, ["SCENIC FLIGHT", "FLYING LESSON", "AIRPARK OPEN DAY"]],
  "ocotillo-arts": [69, ["GALLERY OPENING", "POTTERY WORKSHOP", "ARTISTS TALK"]],
  "sunstone-solar": [70, ["SOLAR-FIELD TOUR", "OPERATIONS SHIFT", "ENERGY OPEN DAY"]],
  "saguaro-rodeo": [71, ["RODEO NIGHT", "COUNTRY MUSIC SHOW", "GROUNDS FAIR"]],
  "painted-canyon": [72, ["VISITOR-CENTER TOUR", "CANYON PHOTO WALK", "SUNSET VIEWING"]],
  "sunset-gate": [73, ["COASTAL ARRIVAL", "VISITOR INFORMATION", "TOUR CONNECTION"]],
  "solana-pier": [25, ["PIER FUN FAIR", "SUNSET WHEEL RIDE", "BOARDWALK EVENING"]],
  "mission-plaza": [26, ["MISSION COURTYARD TOUR", "PLAZA MARKET", "COMMUNITY RECEPTION"]],
  "tidal-aquarium": [74, ["AQUARIUM VISIT", "OCEAN DISCOVERY DAY", "EVENING EXHIBITION"]],
  "pacific-club": [75, ["CLUB LUNCH", "POOL AFTERNOON", "PALMS RECEPTION"]],
  "mariposa-studio": [28, ["STUDIO TOUR", "FILM PREMIERE", "RECORDING SESSION"]],
  "citrus-house": [27, ["ARCHITECTURE TOUR", "HOUSE RECEPTION", "HILLSIDE VISIT"]],
  "surf-pavilion": [29, ["SURF LESSON", "BOARDWALK MARKET", "BEACH CLUB MEETUP"]],
  "sunset-bowl": [76, ["OPEN-AIR CONCERT", "JAZZ AT SUNSET", "SHELL-STAGE FESTIVAL"]],
  "coastwatch": [90, ["BEACH SAFETY DAY", "COASTWATCH VISIT", "LIFEGUARD SHIFT"]],
  "twinwater-gate": [78, ["PALM REACH ARRIVAL", "VISITOR INFORMATION", "COASTAL TOUR MEETUP"]],
  "lantern-bay-market": [30, ["CALLE LUNA MARKET DAY", "RECORD-SHOP VISIT", "CAFE MEETUP"]],
  "bayou-belle": [31, ["MIRAGE CHECK-IN", "HOTEL LOUNGE NIGHT", "POOL-DECK RECEPTION"]],
  "stormwall-locks": [35, ["MARINE STADIUM SHOW", "WATERFRONT CONCERT", "ROLLER NIGHT"]],
  "cypress-crown": [79, ["TENNIS MATCH", "ROLLER-RINK MEETUP", "PARK PICNIC"]],
  "gulfwatch-station": [34, ["LIGHTHOUSE TOUR", "CAPE SUNSET", "COASTAL PHOTO WALK"]],
  "moonwater-marina": [33, ["YACHT CLUB LUNCH", "SAILING MEETUP", "MARINA RECEPTION"]],
  "sunkissed-motel": [80, ["MOTOR-INN CHECK-IN", "SUN KISS REUNION", "COURTYARD MEETUP"]],
  "blackwater-shipyard": [81, ["TV STUDIO TOUR", "LIVE SHOW TAPING", "CHANNEL 86 SHIFT"]],
  "saint-lumina": [82, ["CHAPEL WEDDING", "CHOIR CONCERT", "COMMUNITY GATHERING"]],
};

export type DestinationPlace = {
  id: string;
  label: string;
  regionId: WorldRegionId;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Public arrival curbs may be across the street; the long pier is reached from the coast road. */
  arrivalRadius: number;
  major: boolean;
  artCell: number;
  occasions: readonly [string, string, string];
};

export const DESTINATION_PLACES: readonly DestinationPlace[] = [
  ...CITY_LANDMARKS.map(place => ({ ...place, regionId: "city-center" as const, major: place.featured })),
  ...REGIONAL_CONTENT.flatMap(region => region.anchors.map(place => ({
    ...place, regionId: region.id, major: place.width > 1 || place.height > 1,
  }))),
].map(place => {
  const details = PLACE_DETAILS[place.id];
  if (!details) throw new Error(`Missing destination cards for ${place.id}`);
  return {
    id: place.id, label: place.label, regionId: place.regionId, major: place.major,
    bounds: { minX: place.originX * ROAD_SPACING, minY: place.originY * ROAD_SPACING,
      maxX: (place.originX + place.width) * ROAD_SPACING, maxY: (place.originY + place.height) * ROAD_SPACING },
    arrivalRadius: place.id === "solana-pier" ? ROAD_SPACING * 3 : ROAD_SPACING / 2,
    artCell: details[0], occasions: details[1],
  };
});

const PLACE_BY_ID = new Map(DESTINATION_PLACES.map(place => [place.id, place]));

export function destinationCardsForPlace(placeId: string): DestinationCard[] {
  const place = PLACE_BY_ID.get(placeId);
  if (!place) return [];
  const art = DESTINATION_ART[place.artCell];
  return place.occasions.map((occasion, index) => ({
    id: `${place.id}:occasion:${index + 1}`, placeId, label: place.label, occasion,
    artCell: place.artCell, category: art.category, kind: "landmark", requiresWater: art.requiresWater,
  }));
}

export function distanceToDestinationPlace(point: Vec2, place: DestinationPlace) {
  return Math.hypot(Math.max(place.bounds.minX - point.x, 0, point.x - place.bounds.maxX),
    Math.max(place.bounds.minY - point.y, 0, point.y - place.bounds.maxY));
}

export function destinationPlaceAt(point: Vec2) {
  return DESTINATION_PLACES.find(place => distanceToDestinationPlace(point, place) <= 2) ?? null;
}
