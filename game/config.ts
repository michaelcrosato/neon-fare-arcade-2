import type { CameraMode, Color, DistrictKind, MaterialId } from "./model";

export const PAPER: Color = [0.96, 0.91, 0.8, 1];
export const BONE: Color = [0.83, 0.78, 0.66, 1];
export const INK: Color = [0.035, 0.035, 0.035, 1];
export const ROAD: Color = [0.075, 0.072, 0.068, 1];
export const YELLOW: Color = [1, 0.72, 0, 1];
export const RED: Color = [0.94, 0.12, 0.07, 1];
export const CYAN: Color = [0.05, 0.9, 0.95, 1];
export const WHITE: Color = [1, 0.98, 0.9, 1];
export const GRASS: Color = [0.18, 0.48, 0.22, 1];
export const LEAF: Color = [0.08, 0.31, 0.18, 1];
export const LIME: Color = [0.46, 0.68, 0.2, 1];
export const BRICK: Color = [0.55, 0.19, 0.13, 1];
export const STEEL: Color = [0.27, 0.38, 0.42, 1];
export const BLUE: Color = [0.08, 0.42, 0.64, 1];
export const ORANGE: Color = [0.94, 0.34, 0.08, 1];
export const PINK: Color = [0.92, 0.22, 0.46, 1];
export const MUTED_RED: Color = [0.54, 0.09, 0.06, 1];

export const CAMERA_STORAGE_KEY = "neon-fare-camera-v1";
export const CAMERA_DISTANCE_STORAGE_KEY = "neon-fare-camera-distance-v1";
export const DEFAULT_CAMERA_MODE: CameraMode = "chase-low";
export const DEFAULT_CAMERA_DISTANCE_SCALE: CameraDistanceScale = 4;
export const CAMERA_OPTIONS: readonly {
  id: CameraMode;
  label: string;
  shortLabel: string;
}[] = [
  { id: "fixed", label: "FIXED ISO", shortLabel: "FIXED" },
  { id: "chase-high", label: "CHASE HIGH", shortLabel: "HIGH" },
  { id: "chase-low", label: "CHASE LOW", shortLabel: "LOW" },
  { id: "cab", label: "CAB VIEW", shortLabel: "CAB" },
];

export const CAMERA_DISTANCE_SCALES = [1, 2, 4, 8] as const;
export type CameraDistanceScale = (typeof CAMERA_DISTANCE_SCALES)[number];

export function cameraDistanceScale(value?: number): CameraDistanceScale {
  return value === 1 || value === 2 || value === 8 ? value : 4;
}

export const CHASE_CAMERA = {
  "chase-high": { distance: 14, height: 11.5, lookAhead: 5, targetZ: 1, fov: 50 },
  "chase-low": { distance: 9.5, height: 4.4, lookAhead: 8, targetZ: 1.05, fov: 61 },
} as const;

/** Closer framing makes the smaller walking actor readable without changing a saved view. */
export const ON_FOOT_CHASE_CAMERA = {
  "chase-high": { distance: 10.5, height: 8.4, lookAhead: 3.6, targetZ: 1.18, fov: 52 },
  "chase-low": { distance: 6.6, height: 3.45, lookAhead: 5.4, targetZ: 1.22, fov: 62 },
} as const;

export function chaseCameraPreset(mode: "chase-high" | "chase-low", onFoot = false) {
  return onFoot ? ON_FOOT_CHASE_CAMERA[mode] : CHASE_CAMERA[mode];
}

/** Fixed-step on-foot tuning. Distances and speeds use world units/second. */
export const WALKING_TUNING = {
  radius: 0.44,
  collisionSubstep: 0.18,
  walkSpeed: 4.5,
  runSpeed: 8.2,
  crouchSpeed: 2.35,
  backwardMultiplier: 0.72,
  groundAcceleration: 17,
  runAcceleration: 12,
  groundDeceleration: 22,
  reversalResponse: 26,
  airControlResponse: 2.8,
  turnIdle: 3.55,
  turnWalk: 3.05,
  turnRun: 2.55,
  turnAir: 1.6,
  jumpImpulse: 6.7,
  riseGravity: 17.5,
  releaseGravity: 26,
  fallGravity: 21,
  jumpBufferSeconds: 0.12,
  coyoteSeconds: 0.1,
  crouchResponse: 14,
  landingRecovery: 5.5,
} as const;

export function isCameraMode(value: unknown): value is CameraMode {
  return CAMERA_OPTIONS.some((option) => option.id === value);
}

export function cameraLabel(mode: CameraMode) {
  return CAMERA_OPTIONS.find((option) => option.id === mode)?.label ?? "FIXED ISO";
}

export function defaultCameraBoom(mode: CameraMode, scale: CameraDistanceScale = DEFAULT_CAMERA_DISTANCE_SCALE) {
  if (mode === "chase-high") return CHASE_CAMERA["chase-high"].distance * scale;
  if (mode === "chase-low") return CHASE_CAMERA["chase-low"].distance * scale;
  return 0;
}

export const ROAD_SPACING = 36;
export const ROAD_HALF = 6;
export const TAXI_START = { x: 0, y: 2, heading: -Math.PI / 2 } as const;
export const TRAFFIC_LANE_OFFSET = 2.25;
export const BLOCKS_PER_CHUNK = 4;
export const CHUNK_SIZE = ROAD_SPACING * BLOCKS_PER_CHUNK;
/**
 * Five regions occupy 11 x 11 cells. Palm Reach extends the southeast cell
 * seven rows south into an 11 x 18 peninsula. The center, north, east, south,
 * and west regions retain their original bounds.
 */
export const REGION_CHUNK_SPAN = 11;
export const CENTER_REGION_CHUNK_MIN = -5;
export const CENTER_REGION_CHUNK_MAX = 5;
export const EAST_REGION_CHUNK_MIN_X = CENTER_REGION_CHUNK_MAX + 1;
export const EAST_REGION_CHUNK_MAX_X = EAST_REGION_CHUNK_MIN_X + REGION_CHUNK_SPAN - 1;
export const NORTH_REGION_CHUNK_MAX_Y = CENTER_REGION_CHUNK_MIN - 1;
export const NORTH_REGION_CHUNK_MIN_Y = NORTH_REGION_CHUNK_MAX_Y - REGION_CHUNK_SPAN + 1;
export const SOUTH_REGION_CHUNK_MIN_Y = CENTER_REGION_CHUNK_MAX + 1;
export const SOUTH_REGION_CHUNK_MAX_Y = SOUTH_REGION_CHUNK_MIN_Y + REGION_CHUNK_SPAN - 1;
export const SOUTHEAST_REGION_CHUNK_MIN_X = EAST_REGION_CHUNK_MIN_X;
export const SOUTHEAST_REGION_CHUNK_MAX_X = EAST_REGION_CHUNK_MAX_X;
export const SOUTHEAST_REGION_CHUNK_MIN_Y = SOUTH_REGION_CHUNK_MIN_Y;
export const SOUTHEAST_REGION_CHUNK_MAX_Y = SOUTH_REGION_CHUNK_MAX_Y + 7;
export const WEST_REGION_CHUNK_MAX_X = CENTER_REGION_CHUNK_MIN - 1;
export const WEST_REGION_CHUNK_MIN_X = WEST_REGION_CHUNK_MAX_X - REGION_CHUNK_SPAN + 1;
export const WORLD_CHUNK_MIN_X = WEST_REGION_CHUNK_MIN_X;
export const WORLD_CHUNK_MAX_X = EAST_REGION_CHUNK_MAX_X;
export const WORLD_CHUNK_MIN_Y = NORTH_REGION_CHUNK_MIN_Y;
export const WORLD_CHUNK_MAX_Y = SOUTHEAST_REGION_CHUNK_MAX_Y;

/** @deprecated Center-region aliases retained for stable authored-city tests. */
export const CHUNK_MIN = -5;
/** @deprecated Center-region aliases retained for stable authored-city tests. */
export const CHUNK_MAX = 5;
export const CITY_BLOCK_MIN = CHUNK_MIN * BLOCKS_PER_CHUNK - BLOCKS_PER_CHUNK / 2;
export const CITY_BLOCK_MAX = CHUNK_MAX * BLOCKS_PER_CHUNK + BLOCKS_PER_CHUNK / 2 - 1;
export const WORLD_BLOCK_MIN_X = WORLD_CHUNK_MIN_X * BLOCKS_PER_CHUNK - BLOCKS_PER_CHUNK / 2;
export const WORLD_BLOCK_MAX_X = WORLD_CHUNK_MAX_X * BLOCKS_PER_CHUNK + BLOCKS_PER_CHUNK / 2 - 1;
export const WORLD_BLOCK_MIN_Y = WORLD_CHUNK_MIN_Y * BLOCKS_PER_CHUNK - BLOCKS_PER_CHUNK / 2;
export const WORLD_BLOCK_MAX_Y = WORLD_CHUNK_MAX_Y * BLOCKS_PER_CHUNK + BLOCKS_PER_CHUNK / 2 - 1;
export const COLLISION_STREAM_RADIUS = 1;
export const DISTANT_STREAM_RADIUS = 3;
export const CACHE_RADIUS = 3;
export const WORLD_ROAD_LIMIT = 792;
export const WORLD_LIMIT = WORLD_ROAD_LIMIT + ROAD_HALF;
export const WORLD_ROAD_MIN_X = WORLD_BLOCK_MIN_X * ROAD_SPACING;
export const WORLD_ROAD_MAX_X = (WORLD_BLOCK_MAX_X + 1) * ROAD_SPACING;
export const WORLD_ROAD_MIN_Y = WORLD_BLOCK_MIN_Y * ROAD_SPACING;
export const WORLD_ROAD_MAX_Y = (WORLD_BLOCK_MAX_Y + 1) * ROAD_SPACING;
export const WORLD_MIN_X = WORLD_ROAD_MIN_X - ROAD_HALF;
export const WORLD_MAX_X = WORLD_ROAD_MAX_X + ROAD_HALF;
export const WORLD_MIN_Y = WORLD_ROAD_MIN_Y - ROAD_HALF;
export const WORLD_MAX_Y = WORLD_ROAD_MAX_Y + ROAD_HALF;
export const WORLD_WIDTH = WORLD_MAX_X - WORLD_MIN_X;
export const WORLD_HEIGHT = WORLD_MAX_Y - WORLD_MIN_Y;
export const RUN_TIME = 75;
export const FIXED_DT = 1 / 60;
export const SPEED_KMH_PER_WORLD_UNIT = 3.1;
export const TAXI_TOP_SPEED_KMH = 180;
export const BOOST_OVERDRIVE_BONUS_KMH = 60;
export const BOOST_OVERDRIVE_TOP_SPEED_KMH = 235;
export const BOOST_OVERDRIVE_BONUS_WORLD_UNITS =
  BOOST_OVERDRIVE_BONUS_KMH / SPEED_KMH_PER_WORLD_UNIT;
export const BOOST_OVERDRIVE_TOP_SPEED_WORLD_UNITS =
  BOOST_OVERDRIVE_TOP_SPEED_KMH / SPEED_KMH_PER_WORLD_UNIT;
export const STANDARD_TAXI_FORWARD_SPEED_WORLD_UNITS =
  160 / SPEED_KMH_PER_WORLD_UNIT;
export const REDLINE_TAXI_FORWARD_SPEED_WORLD_UNITS =
  165 / SPEED_KMH_PER_WORLD_UNIT;
export const TAXI_BOOST_SPEED_WORLD_UNITS =
  170 / SPEED_KMH_PER_WORLD_UNIT;
export const TAXI_TOP_SPEED_WORLD_UNITS =
  TAXI_TOP_SPEED_KMH / SPEED_KMH_PER_WORLD_UNIT;
/** Normal lots pull their authored contents inward to leave a broad, readable
 * sidewalk ring between buildings and the curb. Landmark campuses retain their
 * bespoke footprints. */
export const GENERIC_LOT_CONTENT_SCALE = 0.88;
export const AMBIENT_PEDESTRIANS_PER_BLOCK = 6;
/** Street commerce is static world dressing, so its per-chunk ceiling protects
 * both the distant WebGPU stream and the Canvas fallback draw cost. */
export const STREET_COMMERCE_MAX_SCENES_PER_CHUNK = 2;
export const STREET_COMMERCE_MAX_BOXES_PER_SCENE = 10;
export const TURN_APPROACH_LIMIT = 1.4;
export const TURN_CUE_ENTER_DISTANCE = 110;
export const TURN_CUE_EXIT_DISTANCE = 122;
export const TURN_EXIT_ALIGNMENT_LIMIT = 0.7;
export const TURN_EXIT_PROGRESS = 5;
export const NAV_VELOCITY_HEADING_ENTER_SPEED = 4;
export const NAV_VELOCITY_HEADING_EXIT_SPEED = 2;
export const UTURN_ENTER_ANGLE = Math.PI * 0.75;
export const UTURN_EXIT_ANGLE = Math.PI * 0.19;
export const UTURN_MIN_SAVINGS_METERS = 1000;
export const NAVIGATION_REROUTE_DISTANCE_METERS = 1000;
export const UTURN_ALIGNMENT_HOLD = 0.22;
export const NAVIGATION_ARRIVAL_RADIUS = 6;
export const NAVIGATION_REPLAN_COOLDOWN = 0.35;
export const FARE_HANDOFF_SECONDS = 1;
export const MAX_CHUNK_BOXES = 760;
export const MAX_CHUNK_COLLIDERS = 256;
export const MAX_CHUNK_INTERACTIONS = 32;
export const MAX_STREAM_BOXES =
  MAX_CHUNK_BOXES * (DISTANT_STREAM_RADIUS * 2 + 1) ** 2;
export const MAX_STREAM_COLLIDERS = 1_536;
export const MAX_STREAM_INTERACTIONS = 720;
export const PERSPECTIVE_DRAW_DISTANCE = 400;

export const MATERIAL = {
  GENERIC: 0,
  ROAD: 1,
  SIDEWALK: 2,
  BUILDING: 3,
  WINDOW: 4,
  VEHICLE: 5,
  MARKER: 6,
  ROUTE: 7,
  LAMP: 8,
  TURN: 9,
  GRASS: 10,
  FOLIAGE: 11,
  SIGN: 12,
  WATER: 13,
  PERSON: 14,
  PLAYER: 15,
  TIMBER: 16,
  STONE: 17,
  SNOW: 18,
  ADOBE: 19,
  CACTUS: 20,
  SANDSTONE: 21,
} as const satisfies Record<string, MaterialId>;

// Compatibility aliases keep the existing rendering code readable while the
// material protocol is migrated to the typed registry above.
export const MAT_GENERIC = MATERIAL.GENERIC;
export const MAT_ROAD = MATERIAL.ROAD;
export const MAT_SIDEWALK = MATERIAL.SIDEWALK;
export const MAT_BUILDING = MATERIAL.BUILDING;
export const MAT_WINDOW = MATERIAL.WINDOW;
export const MAT_VEHICLE = MATERIAL.VEHICLE;
export const MAT_MARKER = MATERIAL.MARKER;
export const MAT_ROUTE = MATERIAL.ROUTE;
export const MAT_LAMP = MATERIAL.LAMP;
export const MAT_TURN = MATERIAL.TURN;
export const MAT_GRASS = MATERIAL.GRASS;
export const MAT_FOLIAGE = MATERIAL.FOLIAGE;
export const MAT_SIGN = MATERIAL.SIGN;
export const MAT_WATER = MATERIAL.WATER;
export const MAT_PERSON = MATERIAL.PERSON;
export const MAT_PLAYER = MATERIAL.PLAYER;
export const MAT_TIMBER = MATERIAL.TIMBER;
export const MAT_STONE = MATERIAL.STONE;
export const MAT_SNOW = MATERIAL.SNOW;
export const MAT_ADOBE = MATERIAL.ADOBE;
export const MAT_CACTUS = MATERIAL.CACTUS;
export const MAT_SANDSTONE = MATERIAL.SANDSTONE;

/** Passenger and destination atlases scale independently. */
export const PASSENGER_ART_CELL_COUNT = 168;
export const DESTINATION_ART_CELL_COUNT = 96;

/** A challenger must save half a block before the live GPS changes fares. */
export const FARE_TARGET_SWITCH_MARGIN = ROAD_SPACING / 2;
/** Canonical conversion used by fare quotes and every GPS distance readout (1 world unit = 1 meter). */
export const DISPLAY_METERS_PER_WORLD_UNIT = 1;
/** Within this distance (in meters) of a pickup or dropoff ring, the vehicle directional arrow activates pointing to the ring center. */
export const OBJECTIVE_ARRIVAL_PROMPT_DISTANCE_METERS = 100;
/** Scale factor used by navigation settings (U-turn savings and reroute thresholds). */
export const NAVIGATION_METERS_PER_WORLD_UNIT = 18;
/** A stale passenger target may never hold GPS beyond five displayed kilometres. */
export const FARE_GPS_RETARGET_DISTANCE = 5000 / NAVIGATION_METERS_PER_WORLD_UNIT;
/** Rolling fare maintenance is intentionally much slower than the simulation tick. */
export const FARE_STREAM_CHECK_INTERVAL = 0.5;
export const FARE_STREAM_MIN_TRAVEL = ROAD_SPACING;
/** Keep several actionable passengers around the taxi as it crosses the world. */
export const FARE_STREAM_NEARBY_TARGET = 3;
/** No pickup may sit directly on top of any fare's drop-off. */
export const MIN_FARE_HANDOFF_DISTANCE = ROAD_SPACING * 2;
export const MAX_FARE_TRIP_DISTANCE = ROAD_SPACING * 42;
/** Regional fares may cross a full 11-chunk cell before reaching a neighbor. */
export const MAX_FLAT_REGIONAL_FARE_TRIP_DISTANCE = ROAD_SPACING * 60;
// Scenic terrain and peninsula transfers follow longer winding approaches.
export const MAX_REGIONAL_FARE_TRIP_DISTANCE = ROAD_SPACING * 110;
export const MIN_REGIONAL_FARE_TRIP_DISTANCE = ROAD_SPACING * 10;
/** Long-haul dropoffs land well inside the new region, not just over its seam. */
export const REGIONAL_FARE_DESTINATION_DEPTH = ROAD_SPACING * 8;
export const FARES_PER_CYCLE = 6;
export const ALL_FARES_MASK = (1 << FARES_PER_CYCLE) - 1;
export const FARE_PICKUP_RADIUS = 4;
export const FARE_DROPOFF_RADIUS = 4.6;

/**
 * Procedural curb-zone contract. Coverage limits use a small buffer below the
 * player-facing 50% ceiling because placement is measured with deterministic
 * disk samples rather than analytic shape intersections.
 */
export const FARE_STOP_RULES = {
  maxRoadOverlap: 0.47,
  maxColliderOverlap: 0.47,
  maxWaterOverlap: 0.47,
  maxBlockedOverlap: 0.47,
  minRoadOverlap: 0.12,
  minOpenGround: 0.25,
  sampleGrid: 13,
  alongLimit: 5,
  taxiRoadInset: 0.8,
  taxiClearance: 0.35,
  passengerClearance: 0.9,
  junctionClearance: ROAD_HALF + FARE_DROPOFF_RADIUS + 1.5,
  openingSearchRadius: ROAD_SPACING,
  openingForwardMin: 14,
  openingForwardMax: 22,
  openingRightMin: -8,
  openingRightMax: -6,
  openingRouteMax: ROAD_SPACING,
  nearbyPickupRadius: ROAD_SPACING * 5,
  serviceRadius: ROAD_SPACING * 10,
  destinationRadius: ROAD_SPACING * 12,
  previousStopClearance: ROAD_SPACING / 2,
} as const;

export const DISTRICT_LABELS: Record<DistrictKind, string> = {
  downtown: "CENTRAL INK",
  commercial: "NEON MILE",
  townhomes: "BRICK ROW",
  suburb: "SUNSET HEIGHTS",
  residential: "CEDAR VALE",
  mountain: "NORTHSTAR RANGE",
  desert: "COPPER MESA",
  wetland: "PALM REACH",
  coastal: "SOLANA COAST",
  market: "INK MARKET",
  industrial: "SOUTH TERMINAL",
  harbor: "REDLINE HARBOR",
};
export const TOW_COST = 100;
export const TOW_SECONDS = 3.6;
