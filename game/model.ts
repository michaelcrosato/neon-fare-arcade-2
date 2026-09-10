import type { WorldRegionId } from "./region-types";

export type Mode = "menu" | "countdown" | "playing" | "paused" | "ended";
export type Modal = "traits" | "how" | "scores" | "map" | "home" | "courier" | "gas" | null;
export type CameraMode = "fixed" | "chase-high" | "chase-low" | "cab";
export type DrivingTraitId = "street-ace" | "drift-demon" | "redline-rush";
export type RunKind = "timed" | "free-run";
/** Arcade handling remains the default. Simulation is intentionally Free Run-only. */
export type DrivingModel = "arcade" | "simulation";
export type SimulationGear = -1 | 0 | 1 | 2 | 3 | 4;

/**
 * Fixed-step powertrain and chassis state for the simulation taxi. Speeds are
 * stored in SI units here; the shared world pose remains in world units.
 */
export type SimulationVehicleState = {
  gear: SimulationGear;
  engineRpm: number;
  longitudinalSpeed: number;
  lateralSpeed: number;
  /** Chassis-axis acceleration from external forces, in m/s². */
  longitudinalAcceleration: number;
  /** Chassis-axis acceleration from external forces, in m/s². */
  lateralAcceleration: number;
  yawRate: number;
  steeringAngle: number;
  throttle: number;
  brake: number;
  parkingBrake: number;
  reverseHold: number;
  shiftCooldown: number;
  frontSlipAngle: number;
  rearSlipAngle: number;
  bodyPitch: number;
  pitchRate: number;
  /** Total sprung-body and rollover angle around the longitudinal axis. */
  bodyRoll: number;
  rollRate: number;
  /** Signed 0..1 inside-wheel unloading in the current roll direction. */
  wheelLift: number;
  /** True after the body passes the recoverable two-wheel-lift range. */
  overturned: boolean;
  /** Previous fixed-step surface, used to resolve curb/shoulder trip impulses. */
  surfaceOnRoad: boolean;
  wheelRotation: number;
};
/** Data-defined passenger identity. Roster tests enforce runtime uniqueness. */
export type FareId = string;
export type CourierContractId = "paper-rush" | "turbo-parts" | "civic-seal" | "machine-core" | "lost-case" | "cold-crate";
export type CourierHandling = "standard" | "rush" | "fragile";
export type RunUpgradeId = "boost-cooler" | "boost-overdrive" | "rally-tires" | "impact-bars";
export type VenueKind =
  | "lobby"
  | "shop"
  | "diner"
  | "gas"
  | "market"
  | "arcade"
  | "home"
  | "office"
  | "apartment"
  | "residence"
  | "motel"
  | "hotel"
  | "civic"
  | "garage"
  | "warehouse"
  | "factory"
  | "marina"
  | "terminal"
  | "studio"
  | "kiosk";
export type VenueServiceId =
  | "retail-counter"
  | "food-counter"
  | "front-desk"
  | "resident-bell"
  | "civic-desk"
  | "service-desk"
  | "dispatch-desk"
  | "harbor-desk"
  | "arcade-counter"
  | "studio-desk"
  | "kiosk-counter"
  | "home-hub"
  | "courier-board"
  | "gas-counter";

export type Vec2 = { x: number; y: number };
/** A world/map point with an optional deck height; omitted height means ground. */
export type WorldPoint = Vec2 & { z?: number };
export type Vec3 = Vec2 & { z: number };
export type Color = readonly [number, number, number, number];

export type ActorPose = WorldPoint & {
  vx: number;
  vy: number;
  heading: number;
  speed: number;
};

export type OnFootAction = "idle" | "walk" | "run" | "crouch" | "jump" | "fall";

/**
 * Walking actors extend the shared horizontal pose with optional fixed-step
 * locomotion state. The fields stay optional so older run fixtures and saved
 * in-memory poses normalize safely the first time they are stepped or drawn.
 */
export type WalkingActor = ActorPose & Partial<{
  elevation: number;
  verticalSpeed: number;
  grounded: boolean;
  crouchAmount: number;
  jumpHeld: boolean;
  jumpBuffer: number;
  coyoteTime: number;
  gaitPhase: number;
  landingImpact: number;
  turnLean: number;
  action: OnFootAction;
}>;

export type VenueRef = {
  id: string;
  kind: VenueKind;
  label: string;
};

export type PlayerActivity =
  | { kind: "driving" }
  | {
      kind: "walking";
      actor: WalkingActor;
      location:
        | { kind: "city" }
        | {
            kind: "interior";
            venue: VenueRef;
            returnPose: WorldPoint & { heading: number };
          };
    };

type WorldInteractionBase = {
  id: string;
  label: string;
  x: number;
  y: number;
  z?: number;
  heading: number;
  radius: number;
};

/** Exhaustive semantic interaction contract. Each action carries its payload. */
export type WorldInteraction =
  | (WorldInteractionBase & { kind: "venue-entrance"; venue: VenueRef })
  | (WorldInteractionBase & { kind: "interior-exit"; venue: VenueRef })
  | (WorldInteractionBase & { kind: "service"; venue: VenueRef; serviceId: VenueServiceId })
  | (WorldInteractionBase & { kind: "courier-counter"; venue: VenueRef });

export type DistrictKind =
  | "downtown"
  | "commercial"
  | "townhomes"
  | "suburb"
  | "residential"
  | "mountain"
  | "desert"
  | "wetland"
  | "coastal"
  | "market"
  | "industrial"
  | "harbor";

export type LotKind =
  | "tower"
  | "office"
  | "apartment"
  | "shops"
  | "diner"
  | "townhouses"
  | "homes"
  | "park"
  | "playground"
  | "plaza"
  | "gas"
  | "carwash"
  | "warehouse"
  | "factory"
  | "motel"
  | "civic"
  | "market"
  | "construction"
  | "marina"
  | "boardwalk"
  | "landmark"
  | "vale-bungalow"
  | "vale-ranch"
  | "vale-duplex"
  | "vale-cottages"
  | "vale-rowhomes"
  | "vale-garden-apartments"
  | "vale-corner-flats"
  | "vale-pocket-park"
  | "vale-community-garden"
  | "vale-recreation"
  | "vale-pool"
  | "vale-commons"
  | "vale-school"
  | "vale-library"
  | "vale-firehouse"
  | "vale-water-tower"
  | "vale-drive-in"
  | "vale-gateway-station"
  | "range-cabin"
  | "range-a-frame"
  | "range-farmstead"
  | "range-lakeside-home"
  | "range-forest-clearing"
  | "range-meadow"
  | "range-rocky-grove"
  | "range-campground"
  | "range-trailhead"
  | "range-main-street"
  | "range-general-store"
  | "range-diner"
  | "range-outfitter"
  | "range-workshop"
  | "range-roadside-motel"
  | "range-gas-stop"
  | "range-chalet"
  | "range-ski-rental"
  | "range-snowfield"
  | "range-lift-support"
  | "range-northstar-gate"
  | "range-copper-gas"
  | "range-village-square"
  | "range-timberline-lodge"
  | "range-ranger-station"
  | "range-old-spruce-mill"
  | "range-mirror-lake"
  | "range-silver-run-resort"
  | "range-aurora-lookout"
  | "mesa-adobe-home"
  | "mesa-courtyard-home"
  | "mesa-casita"
  | "mesa-desert-ranch"
  | "mesa-trailer-court"
  | "mesa-saguaro-scrub"
  | "mesa-creosote-flat"
  | "mesa-dry-wash"
  | "mesa-rock-garden"
  | "mesa-redrock-shelf"
  | "mesa-trailhead"
  | "mesa-main-street"
  | "mesa-diner"
  | "mesa-gas-stop"
  | "mesa-convenience"
  | "mesa-auto-shop"
  | "mesa-motor-court"
  | "mesa-pottery-market"
  | "mesa-shade-plaza"
  | "mesa-sundown-gate"
  | "mesa-roadrunner-post"
  | "mesa-copper-junction"
  | "mesa-coyote-motor-court"
  | "mesa-desert-bloom-resort"
  | "mesa-dustwind-airpark"
  | "mesa-ocotillo-arts"
  | "mesa-sunstone-solar"
  | "mesa-saguaro-rodeo"
  | "mesa-painted-canyon"
  | "reach-stilt-house"
  | "reach-deco-hotel"
  | "reach-corner-cafe"
  | "reach-condo"
  | "reach-courtyard"
  | "reach-record-shop"
  | "reach-pool-court"
  | "reach-beach"
  | "reach-promenade"
  | "reach-palm-hammock"
  | "reach-ocean"
  | "reach-tennis"
  | "reach-shotgun-house"
  | "reach-fisher-cottage"
  | "reach-houseboat-yard"
  | "reach-cypress-grove"
  | "reach-reed-marsh"
  | "reach-blackwater-pool"
  | "reach-boardwalk-trail"
  | "reach-fishing-dock"
  | "reach-mudflat"
  | "reach-main-street"
  | "reach-seafood-market"
  | "reach-gas-stop"
  | "reach-bait-shop"
  | "reach-boatyard"
  | "reach-motel"
  | "reach-roadhouse"
  | "reach-marina"
  | "reach-twinwater-gate"
  | "reach-lantern-market"
  | "reach-bayou-belle"
  | "reach-stormwall-locks"
  | "reach-cypress-crown"
  | "reach-gulfwatch-station"
  | "reach-moonwater-marina"
  | "reach-sunkissed-motel"
  | "reach-blackwater-shipyard"
  | "reach-saint-lumina"
  | "coast-ocean"
  | "coast-beach"
  | "coast-promenade"
  | "coast-surf-shop"
  | "coast-courtyard"
  | "coast-midcentury"
  | "coast-beach-bungalow"
  | "coast-deco-shops"
  | "coast-motor-inn"
  | "coast-skate-park"
  | "coast-palm-garden"
  | "coast-cliff-garden"
  | "coast-gas-stop"
  | "coast-sunset-gate"
  | "coast-solana-pier"
  | "coast-mission-plaza"
  | "coast-tidal-aquarium"
  | "coast-pacific-club"
  | "coast-mariposa-studio"
  | "coast-citrus-house"
  | "coast-surf-pavilion"
  | "coast-sunset-bowl"
  | "coast-coastwatch";

export type TurnCue = {
  point: WorldPoint;
  incomingYaw: number;
  yaw: number;
  kind: "left" | "right";
  distance: number;
};

export type NavigationPlan = {
  route: WorldPoint[];
  requiresUTurn: boolean;
  departureYaw: number;
  travelHeading: number;
  /** The controller-stabilized turn cue shared by every presentation layer. */
  turnCue: TurnCue | null;
};

export type FareImpact = {
  id: number;
  kind: "pickup" | "dropoff";
  fareId: FareId;
  /** Stable 1-based rider card number, independent from destination art. */
  fareNumber: number;
  artCell: number;
  durationMs: number;
  rider: string;
  destination: string;
  eyebrow: string;
  headline: string;
  detail: string;
};

export type MaterialId =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21;

export type Box = {
  groundAnchor?: Vec2;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  /** Rotation around the box's local X axis. Used by pitched navigation glyphs. */
  pitch?: number;
  /** Rotation around the box's local Y axis. Used for articulated limbs. */
  tilt?: number;
  /** Canvas-only vertical lift paired with the real WebGPU z translation. */
  screenLift?: number;
  color: Color;
  material?: MaterialId;
};

/** Shared swept-road surface. Corners wind along left edge, then back on right. */
export type SurfaceQuad = {
  corners: readonly [Vec3, Vec3, Vec3, Vec3];
  color: Color;
  material: MaterialId;
};

/** Static terrain/architecture shares the road vertex protocol, including triangles. */
export type MeshFace = {
  groundAnchor?: Vec2;
  corners: readonly [Vec3, Vec3, Vec3] | readonly [Vec3, Vec3, Vec3, Vec3];
  color: Color;
  material: MaterialId;
  kind?: "terrain" | "architecture";
};

export type SurfaceRegion = {
  id: string;
  kind: "water";
  x: number;
  y: number;
  halfX: number;
  halfY: number;
  yaw: number;
};

export type Collider = {
  groundAnchor?: Vec2;
  id: string;
  x: number;
  y: number;
  halfX: number;
  halfY: number;
  height: number;
  /** Bottom of the solid interval. Older ground props default to zero. */
  baseZ?: number;
  yaw?: number;
  /** Sloped deck top, used to test clearance below ramps without blocking their tires. */
  roadDeck?: { a: Vec3; b: Vec3; thickness: number };
};

export type CityChunk = {
  key: string;
  cx: number;
  cy: number;
  boxes: Box[];
  surfaces?: MeshFace[];
  colliders: Collider[];
  surfaceRegions: SurfaceRegion[];
  interactions: WorldInteraction[];
};

export type LotContext = {
  boxes: Box[];
  surfaces?: MeshFace[];
  colliders: Collider[];
  surfaceRegions: SurfaceRegion[];
  centerX: number;
  centerY: number;
  blockX: number;
  blockY: number;
  random: () => number;
};

export type WorldView = {
  key: string;
  boxes: Box[];
  surfaces?: MeshFace[];
  landscapeSurfaces?: MeshFace[];
  colliders: Collider[];
  chunks: CityChunk[];
  interactions: WorldInteraction[];
};

export type TrafficMotion =
  | { kind: "grid"; axis: "x" | "y" }
  | { kind: "path"; roadId: string; progress: number };

export type TrafficCar = WorldPoint & {
  x: number;
  y: number;
  heading: number;
  pitch?: number;
  roll?: number;
  motion: TrafficMotion;
  dir: 1 | -1;
  speed: number;
  color: Color;
  activeAt: number;
  cooldown: number;
};

export type Particle = {
  x: number;
  y: number;
  z?: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: Color;
};

export type Job = {
  id: FareId;
  rider: string;
  passengerArtCell: number;
  destinationArtCell: number;
  pickupStopId: string;
  /** Off-road fare-zone center used by world markers and dwell checks. */
  pickup: WorldPoint;
  /** Collision-checked road pose used by routing and distance economy. */
  pickupApproach: WorldPoint;
  dropoffStopId: string;
  /** Off-road fare-zone center used by world markers and dwell checks. */
  dropoff: WorldPoint;
  /** Collision-checked road pose used by routing and distance economy. */
  dropoffApproach: WorldPoint;
  destination: string;
  /** Present when dispatch deliberately sends this fare into another region. */
  regionalTransfer: {
    originRegionId: WorldRegionId;
    originRegionName: string;
    destinationRegionId: WorldRegionId;
    destinationRegionName: string;
  } | null;
};

export type ActiveCourier = {
  contractId: CourierContractId;
  stage: "pickup" | "dropoff";
  acceptedAt: number;
  pickedUpAt: number;
  /** Route distance from the parked taxi at acceptance to the source. */
  approachDistance: number;
  /** Immutable source-to-destination route distance for reward settlement. */
  deliveryDistance: number;
  hadCollision: boolean;
  /** Cargo has been transferred from the walking courier into the taxi. */
  loadedInTaxi: boolean;
};

export type VehicleRoadMotion = {
  verticalSpeed: number;
  grounded: boolean;
  roadId: string | null;
  pitch: number;
  roll: number;
  heave: number;
  heaveSpeed: number;
  landingImpact: number;
};

export type ArcadeVehicleState = {
  yawRate: number;
  bodyPitch: number;
  pitchRate: number;
  bodyRoll: number;
  rollRate: number;
};

export type Game = {
  /** Last roadside rescue. Its bounded departure path and receipt expire visually, not from history. */
  towRecovery?: { startedAt: number; cost: number; path: Array<WorldPoint & { heading: number }> } | null;
  /** The taxi pose. Never repurpose these fields for the walking avatar. */
  x: number;
  y: number;
  /** Height of the tire contact plane, shared by driving, collision and rendering. */
  z: number;
  roadMotion: VehicleRoadMotion;
  arcadeVehicle: ArcadeVehicleState;
  vx: number;
  vy: number;
  heading: number;
  speed: number;
  /** Smoothed normalized front-wheel steering angle in the -1..1 range. */
  steering: number;
  /** Rising-edge latch so holding brake cannot repeatedly trigger rotation. */
  brakeInputHeld: boolean;
  /** Signed, short-lived trail-brake rotation pulse in the -1..1 range. */
  brakeDriftKick: number;
  /** Seconds before a released brake can trigger another rotation pulse. */
  brakeDriftCooldown: number;
  /** The run-scoped driving package selected before the countdown. */
  drivingTraitId: DrivingTraitId;
  /** Selects the isolated vehicle dynamics implementation for this run. */
  drivingModel: DrivingModel;
  /** Always initialized so deterministic diagnostics can switch models safely. */
  simulationVehicle: SimulationVehicleState;
  /** Timed score attack or an untimed, player-ended city session. */
  runKind: RunKind;
  timeLeft: number;
  score: number;
  fare: number;
  boost: number;
  combo: number;
  deliveries: number;
  courierDeliveries: number;
  collisions: number;
  bestMultiplier: number;
  /** Browser-generated seed for this run's passenger and courier markets. */
  runSeed: number;
  /** Six stable fare slots; only unseen, off-range local stops may stream forward. */
  fareJobs: Job[];
  fareCycle: number;
  /** Passenger dispatch is paused while false; exploration and custom GPS remain active. */
  fareDispatchEnabled: boolean;
  /** Taxi position at the last bounded rolling-market audit. */
  fareStreamAnchor: Vec2;
  /** Deterministic seed revision incremented only when waiting stops relocate. */
  fareStreamRevision: number;
  /** Simulation time of the next permitted rolling-market audit. */
  fareStreamCheckAt: number;
  /** Region that owns ordinary fare markets until a transfer arrives elsewhere. */
  fareServiceRegionId: WorldRegionId;
  /** Per-service-region rider cooldown windows for the 50% no-repeat rule. */
  usedFareRiderIdsByRegion: Partial<Record<WorldRegionId, FareId[]>>;
  jobIndex: number;
  /** Bitset of fares still waiting during the current six-fare cycle. */
  availableFareMask: number;
  onboard: boolean;
  jobStartedAt: number;
  tripHadCollision: boolean;
  passengerReview: {
    job: Job;
    point: WorldPoint;
    stars: import("./passenger-rating").PassengerStars;
    tip: number;
    comment: string;
    until: number;
  } | null;
  /** Optional courier assignment. Passenger and courier state never alias. */
  activeCourier: ActiveCourier | null;
  /** Player-authored GPS waypoint. It overrides guidance without cancelling jobs. */
  customDestination: WorldPoint | null;
  /** Bitset of courier offers remaining in the current contract cycle. */
  availableCourierMask: number;
  /** Seeded board ordering makes each contract cycle read differently. */
  courierOfferOrder: CourierContractId[];
  courierCycle: number;
  elapsed: number;
  countdown: number;
  collisionCooldown: number;
  objectiveDwell: number;
  objectiveLockUntil: number;
  message: string;
  messageUntil: number;
  drifting: boolean;
  /** Progressive 0..1 slide strength derived from speed, steering, and slip. */
  driftIntensity: number;
  /** Signed angle in radians between the taxi heading and its travel direction. */
  driftAngle: number;
  boosting: boolean;
  driftBank: number;
  /** Fractional intensity-scaled drift score carried between simulation ticks. */
  driftScoreCarry: number;
  lastBeep: number;
  traffic: TrafficCar[];
  particles: Particle[];
  player: PlayerActivity;
  interactionHeld: boolean;
  /** The home garage can refill boost once per run. */
  homeRechargeUsed: boolean;
  /** Repeatable GO-GO GAS time fills bought during this run. */
  gasTimePurchases: number;
  /** Persistent station upgrades snapshotted into the active run. */
  installedUpgrades: RunUpgradeId[];
};

export type FarePickupMarker = {
  id: FareId;
  rider: string;
  point: Vec2;
  selected: boolean;
};

export type FareDestinationMarker = {
  id: FareId;
  rider: string;
  label: string;
  point: Vec2;
};

export type CourierMapMarker = {
  id: CourierContractId;
  label: string;
  point: Vec2;
  active: boolean;
  phase: "pickup" | "dropoff";
};

export type Hud = {
  towCost: number;
  towReceipt: { cost: number; age: number } | null;
  time: number;
  fare: number;
  score: number;
  speed: number;
  drivingTraitId: DrivingTraitId;
  drivingModel: DrivingModel;
  simulationVehicle: SimulationVehicleState;
  runKind: RunKind;
  boost: number;
  combo: number;
  deliveries: number;
  courierDeliveries: number;
  collisions: number;
  bestMultiplier: number;
  fareDispatchEnabled: boolean;
  objective: string;
  /** Passenger/courier objective remains visible while a custom route is active. */
  missionObjective: string;
  distance: number;
  message: string;
  countdown: number;
  drifting: boolean;
  driftIntensity: number;
  /** Absolute visible slip angle in degrees. */
  driftAngle: number;
  /** Absolute visible strength of the active trail-brake rotation pulse. */
  brakeDriftKick: number;
  boosting: boolean;
  objectiveType: "pickup" | "drop" | "courier-pickup" | "courier-drop" | "waypoint" | "roam";
  objectiveAngle: number;
  player: WorldPoint;
  walker: Vec2 | null;
  target: Vec2;
  missionType: "pickup" | "drop" | "courier-pickup" | "courier-drop" | "roam";
  /** The actual route endpoint, which may be a player-authored waypoint. */
  navigationTarget: WorldPoint;
  customDestination: WorldPoint | null;
  availablePickups: FarePickupMarker[];
  fareDestinations: FareDestinationMarker[];
  courierMarkers: CourierMapMarker[];
  heading: number;
  route: WorldPoint[];
  routeDistance: number;
  gpsInstruction: string;
  gpsTurnDistance: number;
  turnCue: TurnCue | null;
  /** Raw next route turn for the paused full-city planning map. */
  routeTurnCue: TurnCue | null;
  needsUTurn: boolean;
  district: string;
  playerMode: "driving" | "walking" | "interior";
  onFootAction: OnFootAction;
  onFootGrounded: boolean;
  onFootCrouched: boolean;
  placeName: string;
  interactionPrompt: string;
  interactionDetail: string;
  clockPaused: boolean;
  homeRechargeUsed: boolean;
  gasTimePurchases: number;
  gasTaxiNearby: boolean;
  courierActive: boolean;
  courierContractId: CourierContractId | null;
  courierAvailable: CourierContractId[];
  courierStage: "pickup" | "dropoff" | null;
  courierCargo: string;
  courierPlace: string;
  courierNearEntrance: boolean;
  courierTaxiAtTarget: boolean;
  courierAtTargetVenue: boolean;
  courierLoadedInTaxi: boolean;
  passengerOnboard: boolean;
};

export type Camera = {
  x: number;
  y: number;
  zoom: number;
  heading: number;
  mode: CameraMode;
  boom: number;
  /** Smoothed eye/target lift for first-person jumps, crouches, and gait. */
  heightOffset: number;
  /** Uses the closer pedestrian chase framing while preserving the selected mode. */
  onFoot?: boolean;
};

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  /** Optional proportional taxi steering, normalized from -1 (left) to 1 (right). */
  steer?: number;
  /** Dedicated walking sprint input. Boost remains taxi-only. */
  sprint?: boolean;
  /** Walking jump input; edge-triggered by the walking actor's latch. */
  jump?: boolean;
  /** Held walking stance input. */
  crouch?: boolean;
  /** Context action. Edge-triggered by Game.interactionHeld in the simulation. */
  interact?: boolean;
};

export type RunRecord = {
  score: number;
  fare: number;
  deliveries: number;
  rank: string;
  date: string;
};

export type Renderer = {
  kind: "WebGPU" | "Canvas 2D";
  resize: () => void;
  render: (
    game: Game,
    camera: Camera,
    seconds: number,
    world: WorldView,
    navigation: NavigationPlan,
  ) => void;
  destroy: () => void;
};
