import { passengerComment, passengerRating, passengerRatingParSeconds, passengerTip, type PassengerStars } from "./passenger-rating";
import { beginAccordTrip, stepAccordEvents, type StoryCard } from "./accord-events";
import { findTaxiExitPose } from "./player";
import { steeringInput } from "./input";
import { cancelCruiseControl, stepCruiseControl } from "./cruise-control";
import {
  BONE,
  BOOST_OVERDRIVE_BONUS_WORLD_UNITS,
  BOOST_OVERDRIVE_TOP_SPEED_WORLD_UNITS,
  CHUNK_SIZE,
  CYAN,
  FARE_DROPOFF_RADIUS,
  FARE_HANDOFF_SECONDS,
  FARE_PICKUP_RADIUS,
  RED,
  ROAD_SPACING,
  TAXI_TOP_SPEED_WORLD_UNITS,
  WHITE,
  YELLOW,
} from "./config";
import { clearCustomDestination, customDestinationReached } from "./custom-destination";
import {
  depenetrateTaxi,
  obbOverlap,
  taxiBuildingContact,
  taxiHitsBuilding,
  taxiNearBuilding,
  type BuildingContact,
} from "./collision";
import {
  fareAtPickupRange,
  maintainFareStream,
  markFarePickedUp,
  refillFarePool,
  refreshFarePoolAfterRegionalArrival,
  syncNearestFareTarget,
} from "./fare-selection";
import { passengerDistanceQuote } from "./fare-market";
import { scheduleSixthFareTransfer } from "./regional-fares";
import { SPEED_KMH_PER_WORLD_UNIT } from "./config";
import { vehicleDefinition, VEHICLE_GOVERNED_SPEED_KMH } from "./vehicles";
import { accordCoupledRpm, accordGearSpeedLimitMps, clutchConnected, stepManualTransmission } from "./manual-transmission";
import { ACCORD_V6_SPECS, GTR_R35_SPECS, stepGtrAutomatic, accordManualAcceleration, accordUnboostedSpeedLimitMps } from "./simulation-vehicle";
import { stepOffroadSpeedLimit } from "./offroad-speed";
import { stepDrivingStunts } from "./driving-stunts";
import { damageSpeedLimit, recordVehicleContacts, stepRepairLot } from "./vehicle-damage";
import { hasFuel, makeFuel, stepFuel, updateFuelRoadLimit } from "./fuel";
import { drivingTraitPackage } from "./driving-traits";
import {
  clamp,
  distance,
  localPoint,
  nearestRoadX,
  nearestRoadY,
  normalizeAngle,
  rightHandTrafficLane,
} from "./math";
import type { DestinationCard, FareId, Game, InputState, RunKind, WorldView } from "./model";
import { isRoadSurface, nearestRoadProjection } from "./road-network";
import { activePassengerJob, getObjective } from "./state";
import { advancePathTraffic, alignGridTraffic } from "./traffic";
import { terrainBarrier } from "./terrain/surface";
import {
  BOOST_COOLER_DRAIN_MULTIPLIER,
  IMPACT_BAR_BOOST_LOSS_MULTIPLIER,
  hasRunUpgrade,
} from "./gas-station";
import { stepExploration, type ExplorationEvent } from "./exploration";
import { controlledPose, isDriving, shouldAdvanceRunClock } from "./player";
import { clampPointToActiveRegions } from "./regions";
import { nearestEnabledGridRoadLine } from "./road-topology";
import { creditRunTime, quickTimeBonus } from "./run-rules";
import { ensureVehicleRoadMotion, groundAt, stepVehicleRoadContact } from "./vehicle-road-contact";
import { arcadeHeadingDelta, makeArcadeVehicleState, stepArcadeChassis } from "./arcade-handling";
import {
  applySimulationGroundImpulse,
  reconcileSimulationHeading,
  stepSimulationVehicle,
} from "./simulation-vehicle";

export type RandomSource = () => number;

export type SimulationEvent = ExplorationEvent
  | { type: "story-card"; card: StoryCard }
  | { type: "fuel-warning"; level: "low" | "empty" }
  | { type: "vehicle-damaged"; line: string; lossKmh: number; totalLossKmh: number }
  | { type: "building-collision" }
  | { type: "traffic-collision" }
  | { type: "vehicle-overturned" }
  | { type: "brake-drift-kick"; strength: number }
  | { type: "custom-destination-arrived" }
  | { type: "fare-market-streamed" }
  | {
      type: "regional-fare-offered";
      originRegion: string;
      destinationRegion: string;
    }
  | {
      type: "pickup";
      fareId: FareId;
      fareNumber: number;
      artCell: number;
      rider: string;
      destination: string;
      destinationCard?: DestinationCard;
      bonusSeconds: number;
      runKind: RunKind;
    }
  | {
      type: "dropoff";
      fareId: FareId;
      fareNumber: number;
      artCell: number;
      rider: string;
      destination: string;
      destinationCard?: DestinationCard;
      fareAward: number;
      stars: PassengerStars;
      tip: number;
      comment: string;
      bonusSeconds: number;
      multiplier: number;
      runKind: RunKind;
    }
  | { type: "clock-warning"; secondsRemaining: number };

function collisionSafeSteeringPose(world: WorldView, x: number, y: number, heading: number, delta: number, z: number) {
  if (Math.abs(delta) < 1e-8) return { x, y, heading, contact: false, colliderId: null };
  const desired = heading + delta;
  const hit = taxiBuildingContact(world, x, y, desired, z);
  if (!hit) return { x, y, heading: desired, contact: false, colliderId: null };
  const colliderId = hit.collider.id;
  if (taxiHitsBuilding(world, x, y, heading, z)) return { x, y, heading, contact: true, colliderId };

  // A small outward correction lets the taxi pivot while scraping a facade or
  // squeezing between props. Large corrections are rejected so steering can
  // never become a disguised teleport through a building.
  const repairedTurn = depenetrateTaxi(world, x, y, desired, 6, z);
  if (repairedTurn.resolved && Math.hypot(repairedTurn.x - x, repairedTurn.y - y) <= 0.45) {
    return { x: repairedTurn.x, y: repairedTurn.y, heading: desired, contact: true, colliderId };
  }

  let safeFraction = 0;
  let blockedFraction = 1;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidateFraction = (safeFraction + blockedFraction) / 2;
    const candidateHeading = heading + delta * candidateFraction;
    if (taxiHitsBuilding(world, x, y, candidateHeading, z)) blockedFraction = candidateFraction;
    else safeFraction = candidateFraction;
  }
  return { x, y, heading: heading + delta * safeFraction, contact: true, colliderId };
}

function applyBuildingResponse(game: Game, contact: Pick<BuildingContact, "normalX" | "normalY">, dampTangent: boolean) {
  const inwardSpeed = game.vx * contact.normalX + game.vy * contact.normalY;
  if (inwardSpeed >= 0) return;
  const previousVx = game.vx;
  const previousVy = game.vy;
  const tangentX = game.vx - inwardSpeed * contact.normalX;
  const tangentY = game.vy - inwardSpeed * contact.normalY;
  const reboundSpeed = -inwardSpeed * 0.16;
  const tangentRetention = dampTangent ? 0.82 : 1;
  game.vx = tangentX * tangentRetention + contact.normalX * reboundSpeed;
  game.vy = tangentY * tangentRetention + contact.normalY * reboundSpeed;
  applySimulationGroundImpulse(
    game,
    game.vx - previousVx,
    game.vy - previousVy,
    0.5,
  );
}

function collisionSafeTrafficPush(game: Game, world: WorldView, pushX: number, pushY: number) {
  const candidates = [
    { x: game.x + pushX, y: game.y + pushY },
    ...(Math.abs(pushX) >= Math.abs(pushY)
      ? [{ x: game.x + pushX, y: game.y }, { x: game.x, y: game.y + pushY }]
      : [{ x: game.x, y: game.y + pushY }, { x: game.x + pushX, y: game.y }]),
  ];
  for (const candidate of candidates) {
    const { x, y } = clampPointToActiveRegions(candidate, 2.4);
    if (!taxiHitsBuilding(world, x, y, game.heading, game.z)) {
      game.x = x;
      game.y = y;
      return true;
    }
  }
  return false;
}

function nearestClearRoadPose(world: WorldView, x: number, y: number, heading: number, z: number) {
  const { x: safeX, y: safeY } = clampPointToActiveRegions({ x, y }, 2.4);
  const horizontalHeading = Math.cos(heading) >= 0 ? 0 : Math.PI;
  const verticalHeading = Math.sin(heading) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const nearbyRoads = (value: number, axis: "x" | "y") => [...new Set(
    [0, -1, 1, -2, 2].map((offset) => (
      axis === "x"
        ? nearestRoadX(value + offset * ROAD_SPACING)
        : nearestRoadY(value + offset * ROAD_SPACING)
    )),
  )];
  const projection = nearestRoadProjection({ x: safeX, y: safeY, z }, heading);
  const projectionYaw = projection.tangentYaw;
  const candidates = [
    { x: projection.point.x, y: projection.point.y, heading: projectionYaw },
    { x: projection.point.x, y: projection.point.y, heading: projectionYaw + Math.PI },
    ...nearbyRoads(x, "x").map((roadX) => ({ x: roadX, y: safeY, heading: verticalHeading })),
    ...nearbyRoads(y, "y").map((roadY) => ({ x: safeX, y: roadY, heading: horizontalHeading })),
  ].sort((a, b) => (
    (a.x - x) ** 2 + (a.y - y) ** 2
    - ((b.x - x) ** 2 + (b.y - y) ** 2)
  ));
  return candidates.find((candidate) => (
    isRoadSurface({ ...candidate, z })
    && !taxiHitsBuilding(world, candidate.x, candidate.y, candidate.heading, z)
  )) ?? null;
}

export function stepGame(
  game: Game,
  input: Readonly<InputState>,
  dt: number,
  world: WorldView,
  random: RandomSource = Math.random,
): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  game.fuel ??= makeFuel(game.vehicleId);
  if (!hasFuel(game)) cancelCruiseControl(game);
  const development = game.development?.enabled ? game.development : undefined;
  const infiniteBoost = development?.infiniteBoost && game.drivingModel === "arcade";
  if (infiniteBoost) game.boost = 100;
  ensureVehicleRoadMotion(game);
  game.arcadeVehicle ??= makeArcadeVehicleState();
  const previousVx = game.vx, previousVy = game.vy;
  events.push(...stepExploration(game, input, dt, world));
  const driving = isDriving(game);
  const damageContacts = new Set<string>();
  const cruisePedals = stepCruiseControl(game, input, dt);
  const drivingTrait = drivingTraitPackage(game.drivingTraitId).modifiers;
  const controlInput: Readonly<InputState> = driving
    ? input
    : { up: false, down: false, left: false, right: false, boost: false, interact: input.interact };
  const repairedStart = depenetrateTaxi(world, game.x, game.y, game.heading, 8, game.z);
  if (repairedStart.resolved && repairedStart.moved) {
    cancelCruiseControl(game);
    game.x = repairedStart.x;
    game.y = repairedStart.y;
    game.vx *= 0.35;
    game.vy *= 0.35;
  } else if (!repairedStart.resolved) {
    cancelCruiseControl(game);
    const recoveryPose = nearestClearRoadPose(world, game.x, game.y, game.heading, game.z);
    if (recoveryPose) {
      game.x = recoveryPose.x;
      game.y = recoveryPose.y;
      game.heading = recoveryPose.heading;
      game.vx = 0;
      game.vy = 0;
    }
  }
  let lastSafePose = taxiHitsBuilding(world, game.x, game.y, game.heading, game.z)
    ? null
    : { x: game.x, y: game.y, heading: game.heading };
  const fuelStartX = game.x, fuelStartY = game.y;
  game.elapsed += dt;
  updateFuelRoadLimit(game);
  game.collisionCooldown = Math.max(0, game.collisionCooldown - dt);
  game.brakeDriftCooldown = Math.max(0, game.brakeDriftCooldown - dt);
  game.brakeDriftKick = Math.sign(game.brakeDriftKick)
    * Math.max(0, Math.abs(game.brakeDriftKick) - dt / 0.18);
  for (const traffic of game.traffic) traffic.cooldown = Math.max(0, traffic.cooldown - dt);

  if (game.drivingModel === "simulation") {
    const previousHeading = game.heading;
    const vehicleResult = stepSimulationVehicle(
      game,
      controlInput,
      dt,
      isRoadSurface(game),
      game.cruiseControl ? cruisePedals : null,
    );
    if (vehicleResult.rolloverStarted) {
      cancelCruiseControl(game);
      events.push({ type: "vehicle-overturned" });
    }
    const requestedDelta = normalizeAngle(game.heading - previousHeading);
    const steeringPose = collisionSafeSteeringPose(
      world,
      game.x,
      game.y,
      previousHeading,
      requestedDelta,
      game.z,
    );
    game.x = steeringPose.x;
    game.y = steeringPose.y;
    reconcileSimulationHeading(game, previousHeading, steeringPose.heading);
    if (steeringPose.contact) cancelCruiseControl(game);
    if (steeringPose.colliderId !== null) damageContacts.add(steeringPose.colliderId);
    if (!taxiHitsBuilding(world, game.x, game.y, game.heading, game.z)) {
      lastSafePose = { x: game.x, y: game.y, heading: game.heading };
    }
  } else {
  stepOffroadSpeedLimit(game, isRoadSurface(game), dt);
  stepManualTransmission(game, controlInput, dt);
  const vehicle = vehicleDefinition(game.vehicleId).arcade;
  const accord = game.vehicleId === "accord-v6";
  const manual = accord && game.transmissionMode === "manual";
  const connected = clutchConnected(game);
  const forwardX = Math.cos(game.heading);
  const forwardY = Math.sin(game.heading);
  const rightX = -forwardY;
  const rightY = forwardX;
  let forwardSpeed = game.vx * forwardX + game.vy * forwardY;
  let lateralSpeed = game.vx * rightX + game.vy * rightY;
  if (game.vehicleId === "gtr-r35") {
    const state = game.simulationVehicle;
    state.throttle = controlInput.up ? 1 : 0;
    state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);
    state.gear = forwardSpeed < -.1 ? -1 : state.gear < 1 ? 1 : state.gear;
    stepGtrAutomatic(state, Math.abs(forwardSpeed) * SPEED_KMH_PER_WORLD_UNIT / 3.6);
    state.engineRpm = Math.max(hasFuel(game) ? GTR_R35_SPECS.idleRpm : 0, Math.abs(forwardSpeed) * SPEED_KMH_PER_WORLD_UNIT / 3.6
      / GTR_R35_SPECS.wheelRadiusM * 60 / (2 * Math.PI) * GTR_R35_SPECS.finalDriveRatio
      * (state.gear < 0 ? GTR_R35_SPECS.reverseGearRatio : GTR_R35_SPECS.forwardGearRatios[state.gear]));
  }
  const throttle = hasFuel(game) ? controlInput.up ? 1 : game.cruiseControl ? cruisePedals?.throttle ?? 0 : 0 : 0;
  const brake = controlInput.down ? 1 : game.cruiseControl ? cruisePedals?.brake ?? 0 : 0;
  const brakePressed = controlInput.down && !game.brakeInputHeld;
  game.brakeInputHeld = controlInput.down;
  const steerInput = steeringInput(controlInput);
  const previousSteering = game.steering;
  const steeringResponse = steerInput === 0
    ? 20
    : Math.sign(steerInput) === Math.sign(game.steering) || game.steering === 0
      ? 14
      : 26;
  game.steering += (steerInput - game.steering)
    * (1 - Math.exp(-steeringResponse * dt));
  if (Math.abs(game.steering) < 0.001 && steerInput === 0) game.steering = 0;
  const steer = game.steering;

  const groundTraction = game.roadMotion.grounded ? 1 : 0.08;
  const launchAcceleration = 20 + 3.5 * (1 - clamp(Math.abs(forwardSpeed) / 24, 0, 1));
  const gear = game.transmission.gear;
  const physicalAcceleration = manual || accord && gear >= 5;
  const rpm = accordCoupledRpm(forwardSpeed * SPEED_KMH_PER_WORLD_UNIT / 3.6, gear);
  if (physicalAcceleration) forwardSpeed += accordManualAcceleration(forwardSpeed * SPEED_KMH_PER_WORLD_UNIT / 3.6,
    gear, throttle, connected, isRoadSurface(game)) * 3.6 / SPEED_KMH_PER_WORLD_UNIT * groundTraction * dt;
  else if (throttle && connected && !(accord && gear < 0)) forwardSpeed += launchAcceleration * drivingTrait.throttleMultiplier
    * vehicle.acceleration * groundTraction * throttle * dt;
  if (accord && !manual && gear < 0 && throttle) forwardSpeed = Math.min(0, forwardSpeed + 34 * groundTraction * throttle * dt);
  if (brake) {
    if (manual || (accord && !connected)) forwardSpeed -= Math.sign(forwardSpeed) * Math.min(Math.abs(forwardSpeed), 34 * drivingTrait.brakingMultiplier * groundTraction * brake * dt);
    // Finish a sideways stop before the Crown's held brake starts reversing.
    else if (!accord && forwardSpeed >= 0 && Math.abs(lateralSpeed) > 1) forwardSpeed = Math.max(0, forwardSpeed - 34 * drivingTrait.brakingMultiplier * groundTraction * brake * dt);
    else if (forwardSpeed > 1) forwardSpeed -= 34 * drivingTrait.brakingMultiplier * groundTraction * brake * dt;
    else if (accord && gear !== -1) forwardSpeed = Math.max(0, forwardSpeed - 34 * groundTraction * brake * dt);
    else if (connected && hasFuel(game)) forwardSpeed -= (game.collisionCooldown > 0 ? 16 : 9) * brake * dt;
    else forwardSpeed -= Math.sign(forwardSpeed) * Math.min(Math.abs(forwardSpeed), 34 * brake * dt);
  }

  game.boosting = hasFuel(game) && controlInput.boost && connected && (!manual || gear > 0) && game.boost > 0 && forwardSpeed > 3;
  if (game.boosting) {
    forwardSpeed += 24 * drivingTrait.boostAccelerationMultiplier * (accord ? clamp((ACCORD_V6_SPECS.redlineRpm - rpm) / 120, 0, 1) : 1) * (game.roadMotion.grounded ? 1 : 0.35) * dt;
    const coolerDrain = hasRunUpgrade(game, "boost-cooler") ? BOOST_COOLER_DRAIN_MULTIPLIER : 1;
    game.boost = Math.max(0, game.boost - 30 * drivingTrait.boostDrainMultiplier * coolerDrain * dt);
  }

  const speedRatio = clamp(
    Math.abs(forwardSpeed) / drivingTrait.steeringReferenceSpeed,
    0,
    1,
  );
  const driftSpeedFactor = clamp((Math.abs(forwardSpeed) - 8) / 30, 0, 1);
  const steeringCommitment = Math.abs(steer);
  const counterSteering = steeringCommitment > 0
    && Math.abs(lateralSpeed) > 0.2
    && Math.sign(steer) === Math.sign(lateralSpeed);
  const brakeKickCounterSteering = Math.abs(lateralSpeed) > 0.2
    && Math.sign(steerInput || steer) === Math.sign(lateralSpeed);
  // A deliberate brake + steer press can start a Crown slide on the same tick;
  // it must not depend on having already wound up the smoothed wheel angle.
  const brakeKickSteerFactor = clamp((Math.abs(accord ? previousSteering : steerInput) - 0.18) / 0.82, 0, 1);
  const canInitiateBrakeKick = game.drifting
    || (driftSpeedFactor > 0.25 && brakeKickSteerFactor > 0.55);
  let brakeKickTriggered = false;
  if (
    brakePressed
    && game.roadMotion.grounded
    && game.brakeDriftCooldown <= 0
    && forwardSpeed > 10
    && brakeKickSteerFactor > 0
    && canInitiateBrakeKick
    && !brakeKickCounterSteering
  ) {
    const brakeKickStrength = driftSpeedFactor
      * (0.45 + brakeKickSteerFactor * 0.55)
      * (0.85 + game.driftIntensity * 0.15);
    game.brakeDriftKick = Math.sign(accord ? steer : steerInput) * brakeKickStrength;
    game.brakeDriftCooldown = 0.35;
    forwardSpeed *= 1 - Math.abs(game.brakeDriftKick) * 0.015;
    brakeKickTriggered = true;
  }
  const brakingSlide = controlInput.down && brakeKickSteerFactor > 0.55
    && (Math.abs(game.brakeDriftKick) > 0 || game.drifting);
  const driftIntent = clamp(Math.max(
    throttle * vehicle.powerSlide + (1 - throttle) * vehicle.liftSlide * Math.max(game.driftIntensity, brake * 0.8),
    brakingSlide ? vehicle.brakeSlide : 0,
  )
    * steeringCommitment
    * driftSpeedFactor
    * (counterSteering ? 0.3 : 1), 0, 1);
  const steeringDriftIntensity = Math.max(game.driftIntensity, driftIntent);
  let steerStrength = clamp(Math.abs(forwardSpeed) / 4, 0, 1) * (1 - speedRatio * 0.42);
  const steeringDirection = steer * Math.sign(forwardSpeed || 1);
  const recoverySteerStrength = Math.max(steerStrength, 0.5);
  const traitSteering = drivingTrait.steeringMultiplier * vehicle.steering
    * (accord ? 1 - throttle * driftSpeedFactor * 0.16 : 1)
    * (1 + (drivingTrait.driftSteeringMultiplier - 1) * steeringDriftIntensity);
  const driftYawScale = 1
    + steeringDriftIntensity * (0.3 + driftSpeedFactor * 0.65);
  const highSpeedBrakeKickFactor = clamp((Math.abs(forwardSpeed) - 38) / 14, 0, 1);
  const brakeKickYawRate = game.brakeDriftKick
    * (1.45 + highSpeedBrakeKickFactor * 0.4);
  const recoveryHeadingDelta = steeringDirection
    * 2.28
    * recoverySteerStrength
    * traitSteering
    * driftYawScale
    * dt
    + brakeKickYawRate * traitSteering * dt;
  const blockedSteering = Math.abs(recoveryHeadingDelta) > 1e-8
    && Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading + recoveryHeadingDelta, game.z));
  const recoverySteering = Math.abs(steer) > 0
    && (throttle > 0 || brake > 0)
    && (blockedSteering || taxiNearBuilding(world, game.x, game.y, game.heading, 0.65, game.z));
  if (recoverySteering) steerStrength = recoverySteerStrength;
  const requestedHeadingDelta = steeringDirection
    * 2.28
    * steerStrength
    * traitSteering
    * driftYawScale
    * dt
    + brakeKickYawRate * traitSteering * dt;
  const catchAssist = steerInput === 0 && game.roadMotion.grounded
    ? game.driftAngle * game.driftIntensity * 3.8 * vehicle.yawRecovery * dt : 0;
  const headingDelta = arcadeHeadingDelta(game, requestedHeadingDelta + catchAssist, dt, counterSteering);
  const previousHeading = game.heading;
  const steeringPose = collisionSafeSteeringPose(world, game.x, game.y, game.heading, headingDelta, game.z);
  if (steeringPose.contact) cancelCruiseControl(game);
  if (steeringPose.colliderId !== null) damageContacts.add(steeringPose.colliderId);
  game.x = steeringPose.x;
  game.y = steeringPose.y;
  game.heading = steeringPose.heading;
  if (!taxiHitsBuilding(world, game.x, game.y, game.heading, game.z)) {
    lastSafePose = { x: game.x, y: game.y, heading: game.heading };
  }
  // Preserve part of the taxi's world-space momentum while the body rotates.
  // This is what creates a real slip angle instead of merely turning the car
  // faster while its velocity stays glued to the nose.
  const appliedHeadingDelta = game.heading - previousHeading;
  if (Math.abs(appliedHeadingDelta - headingDelta) > 1e-6) game.arcadeVehicle.yawRate = appliedHeadingDelta / dt;
  const appliedTurnFactor = clamp(
    Math.abs(appliedHeadingDelta) / Math.max(1e-6, Math.abs(headingDelta)),
    0,
    1,
  );
  const effectiveBrakeKick = Math.abs(game.brakeDriftKick) * appliedTurnFactor;
  if (Math.abs(game.brakeDriftKick) > 0) {
    game.brakeDriftKick = Math.sign(game.brakeDriftKick) * effectiveBrakeKick;
  }
  const effectiveDriftIntent = driftIntent * appliedTurnFactor;
  const inertialForwardSpeed = forwardSpeed * Math.cos(appliedHeadingDelta)
    + lateralSpeed * Math.sin(appliedHeadingDelta);
  const inertialLateralSpeed = -forwardSpeed * Math.sin(appliedHeadingDelta)
    + lateralSpeed * Math.cos(appliedHeadingDelta);
  const inertiaBlend = clamp(
    steeringDriftIntensity
      * (0.42 + driftSpeedFactor * 0.6)
      * (counterSteering ? 0.65 : 1),
    0,
    0.92,
  ) + effectiveBrakeKick * 0.2;
  const cappedInertiaBlend = clamp(
    game.roadMotion.grounded ? inertiaBlend : 1,
    0,
    game.roadMotion.grounded ? 0.94 : 1,
  );
  forwardSpeed += (inertialForwardSpeed - forwardSpeed) * cappedInertiaBlend;
  lateralSpeed += (inertialLateralSpeed - lateralSpeed) * cappedInertiaBlend;

  const rawDriftAngle = Math.atan2(
    lateralSpeed,
    Math.max(1, Math.abs(forwardSpeed)),
  );
  const driftAngleFactor = clamp(Math.abs(rawDriftAngle) / (Math.PI / 5), 0, 1);
  let targetDriftIntensity = Math.max(
    effectiveDriftIntent * 0.86,
    effectiveBrakeKick * (0.55 + driftSpeedFactor * 0.45),
    driftSpeedFactor * driftAngleFactor * (steeringCommitment > 0 ? 1 : 0.45),
  );
  if (counterSteering) targetDriftIntensity *= 0.45;
  const driftResponse = targetDriftIntensity > game.driftIntensity
    ? 7.5
    : counterSteering
      ? 12
      : steeringCommitment > 0
        ? 4.5
        : 2.5;
  game.driftIntensity += (targetDriftIntensity - game.driftIntensity)
    * (1 - Math.exp(-driftResponse * dt));
  game.driftIntensity = clamp(game.driftIntensity, 0, 1);
  game.drifting = game.roadMotion.grounded && Math.abs(forwardSpeed) > 10
    && game.driftIntensity > 0.1
    && (effectiveDriftIntent > 0.12 || effectiveBrakeKick > 0.08 || driftAngleFactor > 0.08);

  const roadGrip = 7.2 * drivingTrait.roadGripMultiplier;
  const slideGrip = 1.25 * drivingTrait.driftGripMultiplier * vehicle.slideGrip;
  let gripMix = clamp(
    game.driftIntensity * (0.58 + driftAngleFactor * 0.55)
      + effectiveDriftIntent * 0.15
      + effectiveBrakeKick * 0.26,
    0,
    1,
  );
  if (counterSteering) gripMix *= 0.58;
  if (steeringCommitment === 0) gripMix *= 0.92;
  const grip = (roadGrip + (slideGrip - roadGrip) * gripMix) * groundTraction;
  lateralSpeed *= Math.exp(-grip * dt);
  game.driftAngle = Math.atan2(
    lateralSpeed,
    Math.max(1, Math.abs(forwardSpeed)),
  );
  const drag = (physicalAcceleration ? 0 : 1.55 + Math.abs(forwardSpeed) * 0.022) + Math.abs(game.brakeDriftKick) * 3.5;
  forwardSpeed -= Math.sign(forwardSpeed) * Math.min(Math.abs(forwardSpeed), drag * dt);
  const overdriveActive = game.boosting && hasRunUpgrade(game, "boost-overdrive");
  const requestedMaxSpeed = overdriveActive
    ? drivingTrait.maxBoostSpeed + BOOST_OVERDRIVE_BONUS_WORLD_UNITS
    : (game.boosting ? drivingTrait.maxBoostSpeed : drivingTrait.maxForwardSpeed);
  const penalizedTopGear = accord && gear >= 5 && !game.boosting
    && (game.damage.lossKmh > 0 || game.roadMotion.grounded && game.offroadSpeedPenaltyKmh > 0);
  const accordSpeedLimit = penalizedTopGear ? accordUnboostedSpeedLimitMps(gear) : ACCORD_V6_SPECS.governedTopSpeedMps;
  const vehicleSpeedLimit = (accord ? accordSpeedLimit * 3.6 / SPEED_KMH_PER_WORLD_UNIT : game.vehicleId === "gtr-r35"
    ? (game.boosting ? VEHICLE_GOVERNED_SPEED_KMH["gtr-r35"] : 285) / SPEED_KMH_PER_WORLD_UNIT : Math.min(
    overdriveActive ? BOOST_OVERDRIVE_TOP_SPEED_WORLD_UNITS : TAXI_TOP_SPEED_WORLD_UNITS,
    requestedMaxSpeed,
  )) - (game.roadMotion.grounded ? game.offroadSpeedPenaltyKmh / SPEED_KMH_PER_WORLD_UNIT : 0);
  const damagedLimit = damageSpeedLimit(game, vehicleSpeedLimit * SPEED_KMH_PER_WORLD_UNIT) / SPEED_KMH_PER_WORLD_UNIT;
  const maxSpeed = accord && connected && gear > 0
    ? Math.min(damagedLimit, accordGearSpeedLimitMps(gear) * 3.6 / SPEED_KMH_PER_WORLD_UNIT)
    : damagedLimit;
  forwardSpeed = clamp(forwardSpeed, -damageSpeedLimit(game, 7 * SPEED_KMH_PER_WORLD_UNIT) / SPEED_KMH_PER_WORLD_UNIT, maxSpeed);
  game.vx = Math.cos(game.heading) * forwardSpeed - Math.sin(game.heading) * lateralSpeed;
  game.vy = Math.sin(game.heading) * forwardSpeed + Math.cos(game.heading) * lateralSpeed;
  game.speed = Math.hypot(game.vx, game.vy);
  if (forwardSpeed >= 0 && game.speed > maxSpeed) {
    const velocityScale = maxSpeed / game.speed;
    game.vx *= velocityScale;
    game.vy *= velocityScale;
    game.speed = maxSpeed;
  }

  if (brakeKickTriggered && effectiveBrakeKick > 0.05) {
    events.push({ type: "brake-drift-kick", strength: effectiveBrakeKick });
    for (const side of [-1, 1]) {
      const tire = localPoint(game.x, game.y, game.heading, -1.85, side * 0.72);
      game.particles.push({
        x: tire.x,
        y: tire.y,
        vx: -game.vx * 0.14 + Math.cos(game.heading + Math.PI / 2) * side,
        vy: -game.vy * 0.14 + Math.sin(game.heading + Math.PI / 2) * side,
        life: 0.68 + effectiveBrakeKick * 0.18,
        maxLife: 0.86,
        color: WHITE,
      });
    }
  }

  if (game.drifting) {
    const angleReward = clamp(Math.abs(game.driftAngle) / (Math.PI / 7), 0, 1);
    const driftReward = game.driftIntensity
      * (0.35 + angleReward * 0.65)
      * (0.55 + driftSpeedFactor * 0.45);
    game.driftBank = Math.min(
      18,
      game.driftBank + 11 * drivingTrait.driftBoostGainMultiplier * driftReward * dt,
    );
    game.boost = Math.min(
      100,
      game.boost + 8 * drivingTrait.driftBoostGainMultiplier * driftReward * dt,
    );
    if (random() < 0.14 + game.driftIntensity * 0.58) {
      for (const side of [-1, 1]) {
        const tire = localPoint(game.x, game.y, game.heading, -1.85, side * 0.72);
        game.particles.push({
          x: tire.x,
          y: tire.y,
          vx: -game.vx * 0.12 + Math.cos(game.heading + Math.PI / 2) * side * 0.8,
          vy: -game.vy * 0.12 + Math.sin(game.heading + Math.PI / 2) * side * 0.8,
          life: 0.5 + game.driftIntensity * 0.4,
          maxLife: 0.9,
          color: WHITE,
        });
      }
    }
  } else {
    game.driftBank = 0;
  }
  }

  const impact = game.speed;
  const previousPosition = { x: game.x, y: game.y, z: game.z };
  const wasGrounded = game.roadMotion.grounded;
  if (game.roadMotion.grounded && driving) {
    const support = groundAt(game, 0.85, game.roadMotion.roadId);
    const gravityAlongRoad = game.drivingModel === "simulation" ? 10 : 5;
    game.vx += support.normal.x * support.normal.z * gravityAlongRoad * dt;
    game.vy += support.normal.y * support.normal.z * gravityAlongRoad * dt;
  }
  const travel = Math.hypot(game.vx * dt, game.vy * dt);
  const movementSteps = Math.min(8, Math.max(1, Math.ceil(travel / 0.24)));
  const movementDt = dt / movementSteps;
  let hitBuilding = false;
  let impactFrictionAvailable = impact > 7 && game.collisionCooldown <= 0;
  for (let step = 0; step < movementSteps; step += 1) {
    const moveX = game.vx * movementDt;
    const moveY = game.vy * movementDt;
    const unclampedX = game.x + moveX;
    const unclampedY = game.y + moveY;
    const { x: nextX, y: nextY } = clampPointToActiveRegions(
      { x: unclampedX, y: unclampedY },
      2.4,
    );
    if (nextX !== unclampedX) {
      if (Math.abs(game.vx) > .1) damageContacts.add("world-edge:x");
      game.vx *= -0.16;
      hitBuilding = true;
    }
    if (nextY !== unclampedY) {
      if (Math.abs(game.vy) > .1) damageContacts.add("world-edge:y");
      game.vy *= -0.16;
      hitBuilding = true;
    }

    const candidateHeight = game.roadMotion.grounded
      ? groundAt({ x: nextX, y: nextY, z: game.z }, 0.85, game.roadMotion.roadId).height
      : game.z;
    const candidateZ = Math.abs(candidateHeight - game.z) <= 0.85 ? candidateHeight : game.z;
    const barrierContact = terrainBarrier(game, { x: nextX, y: nextY });
    const buildingContact = barrierContact ? null : taxiBuildingContact(world, nextX, nextY, game.heading, candidateZ);
    const candidateContact = barrierContact ?? buildingContact;
    if (!candidateContact) {
      game.x = nextX;
      game.y = nextY;
      lastSafePose = { x: game.x, y: game.y, heading: game.heading };
      continue;
    }

    hitBuilding = true;
    const moveLength = Math.hypot(moveX, moveY);
    // A support-height correction or resting slope jitter is not an impact.
    if (moveLength > movementDt * .1) damageContacts.add(buildingContact?.collider.id ?? "terrain-barrier");
    const candidateApproach = moveX * candidateContact.normalX + moveY * candidateContact.normalY;
    // Overlapping lot colliders can make the deepest candidate manifold point
    // away from the surface that this substep actually crossed. Falling back
    // to the opposite travel direction guarantees a separating response.
    const contact = candidateApproach < -1e-8 || moveLength < 1e-8
      ? candidateContact
      : {
          ...candidateContact,
          normalX: -moveX / moveLength,
          normalY: -moveY / moveLength,
        };
    const intoSurface = moveX * contact.normalX + moveY * contact.normalY;
    const slideX = moveX - Math.min(0, intoSurface) * contact.normalX;
    const slideY = moveY - Math.min(0, intoSurface) * contact.normalY;
    const { x: slideCandidateX, y: slideCandidateY } = clampPointToActiveRegions(
      { x: game.x + slideX, y: game.y + slideY },
      2.4,
    );
    if (!terrainBarrier(game, { x: slideCandidateX, y: slideCandidateY })
      && !taxiHitsBuilding(world, slideCandidateX, slideCandidateY, game.heading, game.z)) {
      game.x = slideCandidateX;
      game.y = slideCandidateY;
      lastSafePose = { x: game.x, y: game.y, heading: game.heading };
    }
    applyBuildingResponse(game, contact, impactFrictionAvailable);
    impactFrictionAvailable = false;
  }

  if (hitBuilding) cancelCruiseControl(game);
  if (hitBuilding && impact > 7 && game.collisionCooldown <= 0) {
    game.collisionCooldown = 0.7;
    game.collisions += 1;
    game.combo = 1;
    game.tripHadCollision = true;
    if (game.activeCourier) game.activeCourier.hadCollision = true;
    const impactLoss = hasRunUpgrade(game, "impact-bars") ? IMPACT_BAR_BOOST_LOSS_MULTIPLIER : 1;
    game.boost = Math.max(0, game.boost - 10 * impactLoss);
    game.score = Math.max(0, game.score - 60);
    game.message = "KRAK! COMBO BROKEN";
    game.messageUntil = game.elapsed + 1.2;
    for (let spark = 0; spark < 12; spark += 1) {
      game.particles.push({ x: game.x, y: game.y, vx: (random() - 0.5) * 9, vy: (random() - 0.5) * 9, life: 0.7, maxLife: 0.7, color: spark % 2 ? YELLOW : RED });
    }
    events.push({ type: "building-collision" });
  }

  stepVehicleRoadContact(game, dt, previousPosition, world);
  stepDrivingStunts(game, previousPosition, wasGrounded, dt);
  if (game.roadMotion.grounded && !isRoadSurface(game)) {
    if (game.speed > 7 && random() < 0.18) {
      game.particles.push({ x: game.x, y: game.y, vx: -game.vx * 0.08, vy: -game.vy * 0.08, life: 0.48, maxLife: 0.48, color: BONE });
    }
  }

  const difficulty = game.elapsed < 25 ? 0.75 : game.elapsed < 50 ? 0.95 : 1.12;
  const trafficSpan = CHUNK_SIZE * 1.28;
  const trafficFocus = game.player.kind === "walking" && game.player.location.kind === "city"
    ? controlledPose(game)
    : { x: game.x, y: game.y };
  for (const [trafficIndex, traffic] of game.traffic.entries()) {
    if (game.elapsed < traffic.activeAt) continue;
    if (traffic.motion.kind === "path") {
      advancePathTraffic(traffic, traffic.speed * difficulty * dt);
    } else if (traffic.motion.axis === "x") {
      const previousX = traffic.x;
      traffic.x += traffic.dir * traffic.speed * difficulty * dt;
      if (traffic.x > trafficFocus.x + trafficSpan) traffic.x -= trafficSpan * 2;
      if (traffic.x < trafficFocus.x - trafficSpan) traffic.x += trafficSpan * 2;
      if (Math.abs(traffic.y - trafficFocus.y) > trafficSpan) {
        const candidateY = trafficFocus.y + ((trafficIndex % 9) - 4) * ROAD_SPACING;
        const road = nearestEnabledGridRoadLine(
          { x: trafficFocus.x, y: candidateY },
          "horizontal",
        ) ?? nearestRoadY(candidateY);
        traffic.y = rightHandTrafficLane("x", road, traffic.dir);
      }
      if (!isRoadSurface({ x: traffic.x, y: traffic.y }, -0.3)) {
        const turnDir = traffic.dir;
        const preferredRoadX = nearestRoadX(previousX);
        const preferred = {
          x: rightHandTrafficLane("y", preferredRoadX, turnDir),
          y: traffic.y,
        };
        const projection = isRoadSurface(preferred, -0.3)
          ? { point: { x: preferredRoadX, y: preferred.y }, tangentYaw: Math.PI / 2 }
          : nearestRoadProjection({ x: previousX, y: traffic.y }, traffic.heading + Math.PI / 2);
        const axis = Math.abs(Math.cos(projection.tangentYaw)) >= Math.abs(Math.sin(projection.tangentYaw))
          ? "x"
          : "y";
        traffic.motion = { kind: "grid", axis };
        if (axis === "x") {
          traffic.dir = (Math.cos(projection.tangentYaw) >= 0 ? 1 : -1) as 1 | -1;
          traffic.x = projection.point.x;
          traffic.y = rightHandTrafficLane("x", projection.point.y, traffic.dir);
          traffic.heading = traffic.dir > 0 ? 0 : Math.PI;
        } else {
          traffic.dir = turnDir;
          traffic.x = rightHandTrafficLane("y", projection.point.x, traffic.dir);
          traffic.y = projection.point.y;
          traffic.heading = traffic.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    } else {
      const previousY = traffic.y;
      traffic.y += traffic.dir * traffic.speed * difficulty * dt;
      if (traffic.y > trafficFocus.y + trafficSpan) traffic.y -= trafficSpan * 2;
      if (traffic.y < trafficFocus.y - trafficSpan) traffic.y += trafficSpan * 2;
      if (Math.abs(traffic.x - trafficFocus.x) > trafficSpan) {
        const candidateX = trafficFocus.x + ((trafficIndex % 9) - 4) * ROAD_SPACING;
        const road = nearestEnabledGridRoadLine(
          { x: candidateX, y: trafficFocus.y },
          "vertical",
        ) ?? nearestRoadX(candidateX);
        traffic.x = rightHandTrafficLane("y", road, traffic.dir);
      }
      if (!isRoadSurface({ x: traffic.x, y: traffic.y }, -0.3)) {
        const turnDir = (traffic.dir > 0 ? -1 : 1) as 1 | -1;
        const preferredRoadY = nearestRoadY(previousY);
        const preferred = {
          x: traffic.x,
          y: rightHandTrafficLane("x", preferredRoadY, turnDir),
        };
        const projection = isRoadSurface(preferred, -0.3)
          ? { point: { x: preferred.x, y: preferredRoadY }, tangentYaw: 0 }
          : nearestRoadProjection({ x: traffic.x, y: previousY }, 0);
        const axis = Math.abs(Math.cos(projection.tangentYaw)) >= Math.abs(Math.sin(projection.tangentYaw))
          ? "x"
          : "y";
        traffic.motion = { kind: "grid", axis };
        if (axis === "x") {
          traffic.dir = turnDir;
          traffic.x = projection.point.x;
          traffic.y = rightHandTrafficLane("x", projection.point.y, traffic.dir);
          traffic.heading = traffic.dir > 0 ? 0 : Math.PI;
        } else {
          traffic.dir = (Math.sin(projection.tangentYaw) >= 0 ? 1 : -1) as 1 | -1;
          traffic.x = rightHandTrafficLane("y", projection.point.x, traffic.dir);
          traffic.y = projection.point.y;
          traffic.heading = traffic.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
    }
    const boundedTraffic = clampPointToActiveRegions(traffic, 3);
    traffic.x = boundedTraffic.x;
    traffic.y = boundedTraffic.y;
    alignGridTraffic(traffic);
    const hitDistance = Math.hypot(game.x - traffic.x, game.y - traffic.y);
    const trafficHeading = traffic.heading;
    const trafficHit = Math.abs(game.z - (traffic.z ?? 0)) < 1.8 && hitDistance < 5 && obbOverlap(
      { x: game.x, y: game.y, heading: game.heading, halfLength: 2.25, halfWidth: 1.03 },
      { x: traffic.x, y: traffic.y, heading: trafficHeading, halfLength: 2.05, halfWidth: 0.98 },
    );
    if (driving && trafficHit) cancelCruiseControl(game);
    if (driving && trafficHit) damageContacts.add(`traffic:${trafficIndex}`);
    if (driving && trafficHit && traffic.cooldown <= 0) {
      traffic.cooldown = 0.75;
      const impact = game.speed;
      const nx = (game.x - traffic.x) / Math.max(0.1, hitDistance);
      const ny = (game.y - traffic.y) / Math.max(0.1, hitDistance);
      collisionSafeTrafficPush(game, world, nx * 1.4, ny * 1.4);
      const previousVx = game.vx;
      const previousVy = game.vy;
      game.vx = game.vx * 0.64 + nx * 3;
      game.vy = game.vy * 0.64 + ny * 3;
      applySimulationGroundImpulse(
        game,
        game.vx - previousVx,
        game.vy - previousVy,
        0.32,
      );
      if (impact > 5 && game.collisionCooldown <= 0) {
        game.collisionCooldown = 0.65;
        game.collisions += 1;
        game.combo = 1;
        game.tripHadCollision = true;
        if (game.activeCourier) game.activeCourier.hadCollision = true;
        const impactLoss = hasRunUpgrade(game, "impact-bars") ? IMPACT_BAR_BOOST_LOSS_MULTIPLIER : 1;
        game.boost = Math.max(0, game.boost - 14 * impactLoss);
        game.score = Math.max(0, game.score - 75);
        game.message = "WHAM! -75";
        game.messageUntil = game.elapsed + 1.1;
        events.push({ type: "traffic-collision" });
      }
    }
  }

  const finalRepair = depenetrateTaxi(world, game.x, game.y, game.heading, 8, game.z);
  if (finalRepair.resolved && finalRepair.moved) {
    cancelCruiseControl(game);
    game.x = finalRepair.x;
    game.y = finalRepair.y;
    game.vx *= 0.35;
    game.vy *= 0.35;
  } else if (!finalRepair.resolved && lastSafePose) {
    cancelCruiseControl(game);
    game.x = lastSafePose.x;
    game.y = lastSafePose.y;
    game.heading = lastSafePose.heading;
    game.vx = 0;
    game.vy = 0;
  } else if (!finalRepair.resolved) {
    cancelCruiseControl(game);
    const recoveryPose = nearestClearRoadPose(world, game.x, game.y, game.heading, game.z);
    if (recoveryPose) {
      game.x = recoveryPose.x;
      game.y = recoveryPose.y;
      game.heading = recoveryPose.heading;
      game.vx = 0;
      game.vy = 0;
    }
  }

  for (const hit of recordVehicleContacts(game, driving ? [...damageContacts] : [])) events.push({ type: "vehicle-damaged", ...hit });
  stepRepairLot(game, world, dt);
  const fuelWarning = stepFuel(game, dt, Math.hypot(game.x - fuelStartX, game.y - fuelStartY));
  if (fuelWarning) events.push({ type: "fuel-warning", level: fuelWarning });
  if (game.drivingModel === "arcade") stepArcadeChassis(game, previousVx, previousVy, dt);
  for (const particle of game.particles) {
    particle.z ??= game.z;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0).slice(-90);

  if (driving && customDestinationReached(game)) {
    clearCustomDestination(game);
    game.message = game.fareDispatchEnabled
      ? "WAYPOINT REACHED · JOB ROUTE RESTORED!"
      : "WAYPOINT REACHED";
    game.messageUntil = game.elapsed + 1.8;
    events.push({ type: "custom-destination-arrived" });
  }

  if (!driving) {
    game.objectiveDwell = 0;
  } else if (game.activeCourier) {
    // Courier phases complete at semantic interior counters, never by idling
    // the taxi at a facade. Navigation still targets the exterior entrance.
    game.objectiveDwell = 0;
  } else if (game.drivingModel === "simulation" && game.simulationVehicle.overturned) {
    // A cab resting on its side or roof is not a valid passenger handoff pose.
    game.objectiveDwell = 0;
  } else if (!game.fareDispatchEnabled && !game.onboard) {
    // Off Duty is authoritative: hidden pickup markers cannot still collect a
    // passenger through the fixed-step dwell logic.
    game.objectiveDwell = 0;
  } else {
    if (!game.onboard) {
      const nearbyFare = fareAtPickupRange(game);
      if (nearbyFare !== null) game.jobIndex = nearbyFare;
      else {
        const streamed = maintainFareStream(game);
        if (streamed) events.push({ type: "fare-market-streamed" });
        syncNearestFareTarget(game, streamed);
      }
    }

    const objective = getObjective(game);
    const objectiveDistance = distance({ x: game.x, y: game.y }, objective);
    const speedLimit = game.onboard ? 9 : 11;
    if (game.elapsed < game.objectiveLockUntil) {
      game.objectiveDwell = 0;
    } else if (
      objectiveDistance < (game.onboard ? FARE_DROPOFF_RADIUS : FARE_PICKUP_RADIUS)
      && Math.abs(game.z - (objective.z ?? 0)) < 1.5 && game.roadMotion.grounded
      && game.speed < speedLimit
    ) {
    game.objectiveDwell += dt;
    if (game.objectiveDwell >= 0.18) {
      const job = activePassengerJob(game);
      const quote = passengerDistanceQuote(job);
      if (!game.onboard) {
        const pickupBonus = creditRunTime(game, quote.pickupSeconds);
        game.onboard = true;
        markFarePickedUp(game, game.jobIndex);
        game.jobStartedAt = game.elapsed;
        beginAccordTrip(game, job);
        game.tripHadCollision = false;
        game.passengerReview = null;
        game.score += 50;
        if (game.drivingModel === "arcade") game.boost = Math.min(100, game.boost + 8);
        game.message = "";
        game.messageUntil = game.elapsed;
        for (let spark = 0; spark < 14; spark += 1) {
          const angle = (spark / 14) * Math.PI * 2;
          game.particles.push({
            x: game.x + Math.cos(angle) * 1.2,
            y: game.y + Math.sin(angle) * 1.2,
            vx: Math.cos(angle) * (4.5 + spark % 3),
            vy: Math.sin(angle) * (4.5 + spark % 3),
            life: 0.62,
            maxLife: 0.62,
            color: spark % 2 ? CYAN : WHITE,
          });
        }
        events.push({
          type: "pickup",
          fareId: job.id,
          fareNumber: job.passengerArtCell + 1,
          artCell: job.passengerArtCell,
          rider: job.rider,
          destination: job.destination,
          ...(job.destinationCard ? { destinationCard: job.destinationCard } : {}),
          bonusSeconds: pickupBonus,
          runKind: game.runKind,
        });
      } else {
        const legTime = Math.max(1, game.elapsed - game.jobStartedAt);
        const quick = quickTimeBonus(
          game,
          Math.round(Math.max(0, quote.parSeconds - legTime) * 35),
        );
        const clean = game.tripHadCollision ? 0 : 150;
        if (!game.tripHadCollision) game.combo = Math.min(3, game.combo + 0.5);
        else game.combo = 1;
        game.bestMultiplier = Math.max(game.bestMultiplier, game.combo);
        const earned = Math.round((quote.baseScore + quick + clean) * game.combo);
        const baseFare = Math.max(12, Math.round(earned / 45));
        const stars = passengerRating(legTime, passengerRatingParSeconds(quote.routeDistance), game.tripHadCollision);
        const tip = passengerTip(baseFare, stars);
        const fareAward = baseFare + tip;
        const comment = passengerComment(job, stars);
        const exitPose = findTaxiExitPose(game, world);
        const point = exitPose ? { x: exitPose.x, y: exitPose.y, z: exitPose.z ?? game.z } : job.dropoff;
        game.passengerReview = { job, point, stars, tip, comment, until: game.elapsed + 8 };
        const timeBonus = creditRunTime(game, quote.dropoffSeconds);
        game.score += earned;
        game.fare += fareAward;
        game.deliveries += 1;
        if (game.drivingModel === "arcade") game.boost = Math.min(100, game.boost + 28);
        game.message = "";
        game.messageUntil = game.elapsed;
        for (let spark = 0; spark < 24; spark += 1) {
          const angle = (spark / 24) * Math.PI * 2 + (spark % 2) * 0.12;
          const force = 5.5 + spark % 5;
          game.particles.push({
            x: game.x + Math.cos(angle) * 1.4,
            y: game.y + Math.sin(angle) * 1.4,
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force,
            life: 0.82,
            maxLife: 0.82,
            color: spark % 3 ? YELLOW : RED,
          });
        }
        events.push({
          type: "dropoff",
          fareId: job.id,
          fareNumber: job.passengerArtCell + 1,
          artCell: job.destinationArtCell,
          rider: job.rider,
          destination: job.destination,
          ...(job.destinationCard ? { destinationCard: job.destinationCard } : {}),
          fareAward,
          stars,
          tip,
          comment,
          bonusSeconds: timeBonus,
          multiplier: game.combo,
          runKind: game.runKind,
        });
        game.onboard = false;
        markFarePickedUp(game, game.jobIndex);
        const refreshedAfterArrival = refreshFarePoolAfterRegionalArrival(game, job);
        const regionalOffer = refreshedAfterArrival
          ? null
          : scheduleSixthFareTransfer(game, job);
        if (!refreshedAfterArrival && !regionalOffer) refillFarePool(game);
        if (regionalOffer) {
          events.push({
            type: "regional-fare-offered",
            originRegion: regionalOffer.originRegionName,
            destinationRegion: regionalOffer.destinationRegionName,
          });
        }
        syncNearestFareTarget(game, true);
        game.objectiveLockUntil = game.elapsed + FARE_HANDOFF_SECONDS;
      }
      game.objectiveDwell = 0;
    }
    } else {
      game.objectiveDwell = 0;
    }
  }

  // Walking is active exploration, not a lifecycle pause. Free exploration
  // freezes the visible meter; an onboard passenger keeps the fare clock live.
  if (shouldAdvanceRunClock(game) && !development?.freezeClock) {
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    const whole = Math.ceil(game.timeLeft);
    if (whole <= 10 && whole > 0 && whole !== game.lastBeep) {
      game.lastBeep = whole;
      events.push({ type: "clock-warning", secondsRemaining: whole });
    }
  }
  if (infiniteBoost) game.boost = 100;
  const storyCard = stepAccordEvents(game);
  if (storyCard) events.push({ type: "story-card", card: storyCard });
  return events;
}
