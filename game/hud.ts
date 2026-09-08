import {
  DISPLAY_METERS_PER_WORLD_UNIT,
  RUN_TIME,
  SPEED_KMH_PER_WORLD_UNIT,
  TAXI_START,
} from "./config";
import {
  COURIER_HANDOFF_TAXI_RADIUS,
  COURIER_PICKUP_TAXI_RADIUS,
  activeCourierContract,
  availableCourierContracts,
  courierMapMarkers,
} from "./courier";
import { farePickupMarkers } from "./fare-selection";
import { isTaxiNearGasStation } from "./gas-station";
import { interactionPrompt } from "./interactions";
import { distance } from "./math";
import type { Game, Hud, NavigationPlan, WorldView } from "./model";
import {
  buildNavigationPlan,
  gpsInstruction,
  nextTurnCue,
  routeLength,
} from "./navigation";
import {
  controlledPose,
  isDriving,
  isInterior,
  shouldAdvanceRunClock,
  walkingMotion,
} from "./player";
import { specialRoadNamesNear } from "./road-network";
import {
  getNavigationLabel,
  getNavigationTarget,
  getNavigationType,
  getObjective,
  getObjectiveLabel,
  getObjectiveType,
} from "./state";
import { districtName } from "./world";

export const EMPTY_HUD: Hud = {
  time: RUN_TIME,
  fare: 0,
  score: 0,
  speed: 0,
  drivingTraitId: "street-ace",
  drivingModel: "arcade",
  simulationVehicle: {
    gear: 1,
    engineRpm: 650,
    longitudinalSpeed: 0,
    lateralSpeed: 0,
    longitudinalAcceleration: 0,
    lateralAcceleration: 0,
    yawRate: 0,
    steeringAngle: 0,
    throttle: 0,
    brake: 0,
    parkingBrake: 0,
    reverseHold: 0,
    shiftCooldown: 0,
    frontSlipAngle: 0,
    rearSlipAngle: 0,
    bodyPitch: 0,
    pitchRate: 0,
    bodyRoll: 0,
    rollRate: 0,
    wheelLift: 0,
    overturned: false,
    surfaceOnRoad: true,
    wheelRotation: 0,
  },
  runKind: "timed",
  boost: 45,
  combo: 1,
  deliveries: 0,
  courierDeliveries: 0,
  collisions: 0,
  bestMultiplier: 1,
  fareDispatchEnabled: true,
  objective: "FIND A FARE",
  missionObjective: "FIND A FARE",
  distance: 0,
  message: "",
  countdown: 3,
  drifting: false,
  driftIntensity: 0,
  driftAngle: 0,
  brakeDriftKick: 0,
  boosting: false,
  objectiveType: "pickup",
  objectiveAngle: 0,
  player: { x: TAXI_START.x, y: TAXI_START.y },
  walker: null,
  target: { x: TAXI_START.x, y: TAXI_START.y },
  missionType: "pickup",
  navigationTarget: { x: TAXI_START.x, y: TAXI_START.y },
  customDestination: null,
  availablePickups: [],
  fareDestinations: [],
  courierMarkers: [],
  heading: TAXI_START.heading,
  route: [],
  routeDistance: 0,
  gpsInstruction: "ROUTE ACQUIRED",
  gpsTurnDistance: 0,
  turnCue: null,
  routeTurnCue: null,
  needsUTurn: false,
  district: "CENTRAL INK",
  playerMode: "driving",
  onFootAction: "idle",
  onFootGrounded: true,
  onFootCrouched: false,
  placeName: "CENTRAL INK",
  interactionPrompt: "",
  interactionDetail: "",
  clockPaused: false,
  homeRechargeUsed: false,
  gasTimePurchases: 0,
  gasTaxiNearby: false,
  courierActive: false,
  courierContractId: null,
  courierAvailable: [],
  courierStage: null,
  courierCargo: "",
  courierPlace: "",
  courierNearEntrance: false,
  courierTaxiAtTarget: false,
  courierAtTargetVenue: false,
  courierLoadedInTaxi: false,
  passengerOnboard: false,
};

/** Pure projection from deterministic game state to renderer-neutral HUD state. */
export function makeHud(game: Game, navigation?: NavigationPlan, world?: WorldView): Hud {
  const driving = isDriving(game);
  const target = getObjective(game);
  const navigationTarget = getNavigationTarget(game);
  const player = { x: game.x, y: game.y };
  const plan = navigation ?? buildNavigationPlan(player, navigationTarget, game.heading);
  const navigationSuppressed = !game.fareDispatchEnabled
    && !game.onboard
    && !game.activeCourier
    && !game.customDestination;
  const route = navigationSuppressed ? [] : plan.route;
  const turnCue = navigationSuppressed ? null : plan.turnCue;
  const routeTurnCue = plan.requiresUTurn ? null : nextTurnCue(route, plan.departureYaw);
  const guidance = navigationSuppressed
    ? { text: "ROAM FREELY", distance: 0 }
    : gpsInstruction(route, plan.travelHeading, turnCue, plan.requiresUTurn);
  const nextPoint = route.find((point, index) => index > 0 && distance(player, point) > 4) || navigationTarget;
  const controlled = controlledPose(game);
  const onFootMotion = game.player.kind === "walking"
    ? walkingMotion(game.player.actor)
    : null;
  const prompt = interactionPrompt(game, world);
  const interior = isInterior(game);
  const courier = activeCourierContract(game);
  const placeName = interior && game.player.kind === "walking" && game.player.location.kind === "interior"
    ? game.player.location.venue.label
    : specialRoadNamesNear(controlled, 1)[0] ?? districtName(controlled.x, controlled.y);
  return {
    time: Math.max(0, game.timeLeft),
    fare: game.fare,
    score: game.score,
    speed: Math.round(
      (game.player.kind === "walking" ? game.player.actor.speed : game.speed)
      * SPEED_KMH_PER_WORLD_UNIT,
    ),
    drivingTraitId: game.drivingTraitId,
    drivingModel: game.drivingModel,
    simulationVehicle: { ...game.simulationVehicle },
    runKind: game.runKind,
    boost: game.boost,
    combo: game.combo,
    deliveries: game.deliveries,
    courierDeliveries: game.courierDeliveries,
    collisions: game.collisions,
    bestMultiplier: game.bestMultiplier,
    fareDispatchEnabled: game.fareDispatchEnabled,
    objective: getNavigationLabel(game),
    missionObjective: getObjectiveLabel(game),
    distance: Math.round(routeLength(route) * DISPLAY_METERS_PER_WORLD_UNIT),
    message: game.elapsed < game.messageUntil ? game.message : "",
    countdown: game.countdown,
    drifting: game.drifting,
    driftIntensity: game.driftIntensity,
    driftAngle: Math.round(Math.abs(game.driftAngle) * 180 / Math.PI),
    brakeDriftKick: Math.abs(game.brakeDriftKick),
    boosting: game.boosting,
    objectiveType: getNavigationType(game),
    objectiveAngle: navigationSuppressed
      ? 0
      : Math.atan2(nextPoint.y - game.y, nextPoint.x - game.x) - game.heading + Math.PI / 2,
    player,
    walker: !driving && !interior ? { x: controlled.x, y: controlled.y } : null,
    target,
    missionType: getObjectiveType(game),
    navigationTarget,
    customDestination: game.customDestination,
    availablePickups: farePickupMarkers(game),
    fareDestinations: game.fareDispatchEnabled || game.onboard
      ? game.fareJobs.map((job) => ({
        id: job.id,
        rider: job.rider,
        label: job.destination,
        point: job.dropoff,
      }))
      : [],
    courierMarkers: courierMapMarkers(game),
    heading: plan.travelHeading,
    route,
    routeDistance: routeLength(route),
    gpsInstruction: guidance.text,
    gpsTurnDistance: guidance.distance,
    turnCue,
    routeTurnCue,
    needsUTurn: driving && !navigationSuppressed && plan.requiresUTurn,
    district: specialRoadNamesNear(player, 1)[0] ?? districtName(game.x, game.y),
    playerMode: interior ? "interior" : isDriving(game) ? "driving" : "walking",
    onFootAction: onFootMotion?.action ?? "idle",
    onFootGrounded: onFootMotion?.grounded ?? true,
    onFootCrouched: (onFootMotion?.crouchAmount ?? 0) > 0.55,
    placeName,
    interactionPrompt: prompt.label,
    interactionDetail: prompt.detail,
    clockPaused: game.runKind === "timed" && !shouldAdvanceRunClock(game),
    homeRechargeUsed: game.homeRechargeUsed,
    gasTimePurchases: game.gasTimePurchases,
    gasTaxiNearby: isTaxiNearGasStation(game),
    courierActive: Boolean(courier),
    courierContractId: game.activeCourier?.contractId ?? null,
    courierAvailable: availableCourierContracts(game).map((contract) => contract.id),
    courierStage: game.activeCourier?.stage ?? null,
    courierCargo: courier?.cargo ?? "",
    courierPlace: courier && game.activeCourier
      ? (game.activeCourier.stage === "pickup" ? courier.origin.venue.label : courier.destination.venue.label)
      : "",
    courierNearEntrance: Boolean(courier && !interior && distance(controlled, target) <= 16),
    courierTaxiAtTarget: Boolean(
      courier
      && game.activeCourier
      && distance(player, target) <= (game.activeCourier.stage === "pickup"
        ? COURIER_PICKUP_TAXI_RADIUS
        : COURIER_HANDOFF_TAXI_RADIUS)
    ),
    courierAtTargetVenue: Boolean(
      courier
      && game.activeCourier
      && interior
      && game.player.kind === "walking"
      && game.player.location.kind === "interior"
      && game.player.location.venue.id === (game.activeCourier.stage === "pickup" ? courier.origin.venue.id : courier.destination.venue.id)
    ),
    courierLoadedInTaxi: Boolean(game.activeCourier?.loadedInTaxi),
    passengerOnboard: game.onboard,
  };
}
