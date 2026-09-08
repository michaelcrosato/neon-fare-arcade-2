import { SPEED_KMH_PER_WORLD_UNIT } from "./config";
import { clamp, normalizeAngle } from "./math";
import type {
  Game,
  InputState,
  SimulationGear,
  SimulationVehicleState,
} from "./model";

/**
 * Loaded 1990s full-size fleet taxi. SI values stay centralized here so the
 * fixed-step model can be tuned and characterized without display-unit math.
 */
export const CROWN_TAXI_SPECS = {
  massKg: 1_900,
  yawInertiaKgM2: 3_700,
  rollInertiaKgM2: 700,
  wheelbaseM: 2.913,
  cgToFrontAxleM: 1.31,
  cgToRearAxleM: 1.603,
  cgHeightM: 0.57,
  frontTrackM: 1.611,
  rearTrackM: 1.659,
  wheelRadiusM: 0.34,
  finalDriveRatio: 3.27,
  forwardGearRatios: [0, 2.84, 1.55, 1, 0.7] as const,
  reverseGearRatio: 2.32,
  drivelineEfficiency: 0.78,
  idleRpm: 650,
  redlineRpm: 5_250,
  governedTopSpeedMps: 53,
  governedReverseSpeedMps: 8.9,
  serviceBrakeForceN: 15_800,
  parkingBrakeForceN: 7_200,
  frontCorneringStiffnessNPerRad: 78_000,
  rearCorneringStiffnessNPerRad: 86_000,
  dragCoefficient: 0.39,
  frontalAreaM2: 2.35,
  rollingResistance: 0.015,
  roadFriction: 0.9,
  offroadFriction: 0.56,
  rallyOffroadFriction: 0.66,
} as const;

const GRAVITY = 9.81;
const AIR_DENSITY = 1.225;
const WORLD_SPEED_TO_MPS = SPEED_KMH_PER_WORLD_UNIT / 3.6;
const MPS_TO_WORLD_SPEED = 1 / WORLD_SPEED_TO_MPS;
const MAX_STEER_RADIANS = 0.56;
const PHYSICS_SUBSTEP = 1 / 120;
const AVERAGE_TRACK_M = (CROWN_TAXI_SPECS.frontTrackM + CROWN_TAXI_SPECS.rearTrackM) / 2;
const HALF_TRACK_M = AVERAGE_TRACK_M / 2;
const STATIC_STABILITY_FACTOR = AVERAGE_TRACK_M / (2 * CROWN_TAXI_SPECS.cgHeightM);
const PIVOT_ROLL_INERTIA_KG_M2 = CROWN_TAXI_SPECS.rollInertiaKgM2
  + CROWN_TAXI_SPECS.massKg * (
    CROWN_TAXI_SPECS.cgHeightM ** 2 + HALF_TRACK_M ** 2
  );
const SIDE_REST_ANGLE = Math.PI / 2;
const ROOF_REST_ANGLE = Math.PI;

export type SimulationVehicleStepResult = Readonly<{
  rolloverStarted: boolean;
}>;

export function makeSimulationVehicleState(): SimulationVehicleState {
  return {
    gear: 1,
    engineRpm: CROWN_TAXI_SPECS.idleRpm,
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
  };
}

export function simulationGearLabel(gear: SimulationGear) {
  if (gear === -1) return "R";
  if (gear === 0) return "N";
  return `D${gear}`;
}

export function isSimulationVehicleOverturned(game: Readonly<Game>) {
  return game.drivingModel === "simulation" && game.simulationVehicle.overturned;
}

export function canRightSimulationVehicle(game: Readonly<Game>) {
  return isSimulationVehicleOverturned(game)
    && game.speed < 1.2
    && Math.abs(game.simulationVehicle.rollRate) < 0.45;
}

/** Rights a stopped simulation cab without changing its location or heading. */
export function rightSimulationVehicle(game: Game) {
  if (!canRightSimulationVehicle(game)) return false;
  const state = game.simulationVehicle;
  game.vx = 0;
  game.vy = 0;
  game.speed = 0;
  game.steering = 0;
  game.drifting = false;
  game.driftIntensity = 0;
  game.driftAngle = 0;
  state.longitudinalSpeed = 0;
  state.lateralSpeed = 0;
  state.longitudinalAcceleration = 0;
  state.lateralAcceleration = 0;
  state.yawRate = 0;
  state.steeringAngle = 0;
  state.bodyPitch = 0;
  state.pitchRate = 0;
  state.bodyRoll = 0;
  state.rollRate = 0;
  state.wheelLift = 0;
  state.overturned = false;
  state.surfaceOnRoad = true;
  return true;
}

/**
 * Applies the rotational part of an external ground-level collision impulse.
 * Translation remains owned by the shared collision response in simulation.ts.
 */
export function applySimulationGroundImpulse(
  game: Game,
  deltaVelocityWorldX: number,
  deltaVelocityWorldY: number,
  leverage = 1,
) {
  if (game.drivingModel !== "simulation") return;
  const rightX = -Math.sin(game.heading);
  const rightY = Math.cos(game.heading);
  const lateralDeltaMps = (
    deltaVelocityWorldX * rightX + deltaVelocityWorldY * rightY
  ) * WORLD_SPEED_TO_MPS;
  if (Math.abs(lateralDeltaMps) < 0.05) return;
  game.simulationVehicle.rollRate += lateralDeltaMps
    * CROWN_TAXI_SPECS.massKg
    * CROWN_TAXI_SPECS.cgHeightM
    / PIVOT_ROLL_INERTIA_KG_M2
    * clamp(leverage, 0, 1.4);
  game.simulationVehicle.rollRate = clamp(game.simulationVehicle.rollRate, -7.5, 7.5);
}

function engineTorqueNm(rpm: number) {
  const points = [
    [650, 235],
    [1_400, 285],
    [2_250, 335],
    [3_000, 359],
    [4_250, 335],
    [5_250, 225],
  ] as const;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (rpm <= next[0]) {
      const mix = clamp((rpm - previous[0]) / (next[0] - previous[0]), 0, 1);
      return previous[1] + (next[1] - previous[1]) * mix;
    }
  }
  return points.at(-1)![1];
}

function automaticGear(state: SimulationVehicleState, speedMps: number) {
  if (state.gear < 1 || state.shiftCooldown > 0) return;
  const upshift = state.throttle > 0.72
    ? [0, 15.5, 27.5, 50]
    : [0, 12.5, 23, 36];
  const downshift = [0, 0, 8.5, 17.5, 29];
  let next = state.gear;
  if (state.gear < 4 && speedMps > upshift[state.gear]) next = (state.gear + 1) as SimulationGear;
  else if (state.gear > 1 && speedMps < downshift[state.gear]) next = (state.gear - 1) as SimulationGear;
  if (next !== state.gear) {
    state.gear = next;
    state.shiftCooldown = 0.24;
  }
}

function smooth(current: number, target: number, response: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-response * dt));
}

function moveToward(current: number, target: number, distance: number) {
  if (current < target) return Math.min(target, current + distance);
  if (current > target) return Math.max(target, current - distance);
  return current;
}

function signedClamp(value: number, magnitude: number) {
  return clamp(value, -magnitude, magnitude);
}

function tireFrictionCapacity(normalLoad: number, nominalLoad: number, friction: number) {
  if (normalLoad <= 0) return 0;
  const loadRatio = normalLoad / Math.max(1, nominalLoad);
  const loadSensitiveFriction = friction * clamp(1.08 - 0.1 * loadRatio, 0.76, 1.05);
  return normalLoad * loadSensitiveFriction;
}

/** Conserves one axle's normal load while the inside tire unloads. */
export function simulationAxleLoads(axleLoad: number, transfer: number) {
  const boundedLoad = Math.max(0, axleLoad);
  const outside = clamp(boundedLoad / 2 + Math.abs(transfer), 0, boundedLoad);
  return { outside, inside: boundedLoad - outside } as const;
}

function axleCapacity(
  axleLoad: number,
  transfer: number,
  nominalTireLoad: number,
  friction: number,
) {
  // Weight transfer can unload an inside tire, but it cannot create normal
  // force. Once the inside reaches zero, the outside carries the axle's
  // complete load and any further trip acceleration acts on body roll.
  const loads = simulationAxleLoads(axleLoad, transfer);
  return tireFrictionCapacity(loads.outside, nominalTireLoad, friction)
    + tireFrictionCapacity(loads.inside, nominalTireLoad, friction);
}

function combinedLateralCapacity(totalCapacity: number, longitudinalForce: number) {
  return Math.sqrt(Math.max(0, totalCapacity ** 2 - Math.min(
    totalCapacity,
    Math.abs(longitudinalForce),
  ) ** 2));
}

/** Compact Magic-Formula-shaped curve with the configured linear stiffness. */
function lateralTireForce(slipAngle: number, stiffness: number, capacity: number) {
  if (capacity < 1) return 0;
  const shape = 1.28;
  const stiffnessFactor = stiffness / (capacity * shape);
  return -capacity * Math.sin(shape * Math.atan(stiffnessFactor * slipAngle));
}

function stepBodyAttitude(
  state: SimulationVehicleState,
  longitudinalAcceleration: number,
  lateralAcceleration: number,
  dt: number,
) {
  const pitchTarget = state.overturned
    ? 0
    : clamp(-longitudinalAcceleration / GRAVITY * 0.105, -0.13, 0.13);
  const pitchFrequency = 2 * Math.PI * 1.55;
  const pitchAcceleration = (pitchTarget - state.bodyPitch) * pitchFrequency ** 2
    - state.pitchRate * 2 * 0.55 * pitchFrequency;
  state.pitchRate += pitchAcceleration * dt;
  state.bodyPitch = clamp(state.bodyPitch + state.pitchRate * dt, -0.16, 0.16);

  const demand = Math.abs(lateralAcceleration) / (GRAVITY * STATIC_STABILITY_FACTOR);
  const lateralUnload = clamp(demand, 0, 1);
  const tipAngle = Math.atan(STATIC_STABILITY_FACTOR);
  const rollUnload = clamp(
    (Math.abs(state.bodyRoll) - 0.15) / Math.max(0.1, tipAngle - 0.15),
    0,
    1,
  );
  const unloadDirection = Math.sign(
    rollUnload > lateralUnload
      ? state.bodyRoll
      : lateralAcceleration,
  );
  const wheelLiftTarget = unloadDirection * Math.max(lateralUnload, rollUnload);
  state.wheelLift = smooth(state.wheelLift, wheelLiftTarget, 16, dt);

  const previousRoll = state.bodyRoll;
  const rollMagnitude = Math.abs(previousRoll);
  const suspensionMode = !state.overturned
    && rollMagnitude < 0.32
    && Math.abs(state.rollRate) < 0.48
    && demand < 0.92;
  let rollAcceleration: number;

  if (suspensionMode) {
    const rollTarget = clamp(lateralAcceleration / GRAVITY * 0.115, -0.15, 0.15);
    const rollFrequency = 2 * Math.PI * 1.35;
    rollAcceleration = (rollTarget - previousRoll) * rollFrequency ** 2
      - state.rollRate * 2 * 0.43 * rollFrequency;
  } else if (!state.overturned) {
    const direction = Math.sign(previousRoll || state.rollRate || lateralAcceleration || 1);
    const angle = Math.min(Math.abs(previousRoll), SIDE_REST_ANGLE - 0.02);
    const centerSide = -HALF_TRACK_M * Math.cos(angle)
      + CROWN_TAXI_SPECS.cgHeightM * Math.sin(angle);
    const centerHeight = HALF_TRACK_M * Math.sin(angle)
      + CROWN_TAXI_SPECS.cgHeightM * Math.cos(angle);
    const alignedAcceleration = lateralAcceleration * direction;
    const pivotMoment = CROWN_TAXI_SPECS.massKg * (
      alignedAcceleration * Math.max(0.08, centerHeight)
      + GRAVITY * centerSide
    );
    rollAcceleration = direction * pivotMoment / PIVOT_ROLL_INERTIA_KG_M2
      - state.rollRate * 0.42;
  } else {
    const direction = Math.sign(previousRoll || state.rollRate || 1);
    const magnitude = Math.abs(previousRoll);
    const movingTowardRoof = magnitude > SIDE_REST_ANGLE
      && Math.sign(state.rollRate) === direction
      && Math.abs(state.rollRate) > 0.75;
    if (magnitude < 2.05 && !movingTowardRoof) {
      rollAcceleration = (direction * SIDE_REST_ANGLE - previousRoll) * 24
        - state.rollRate * 7.5;
    } else {
      rollAcceleration = (direction * ROOF_REST_ANGLE - previousRoll) * 18
        - state.rollRate * 5.5;
    }
  }

  state.rollRate = clamp(state.rollRate + rollAcceleration * dt, -8, 8);
  let nextRoll = previousRoll + state.rollRate * dt;
  const crossedSide = Math.abs(previousRoll) < SIDE_REST_ANGLE
    && Math.abs(nextRoll) >= SIDE_REST_ANGLE;
  if (crossedSide) {
    state.overturned = true;
    if (Math.abs(state.rollRate) < 2.15) {
      nextRoll = Math.sign(nextRoll) * SIDE_REST_ANGLE;
      state.rollRate *= -0.08;
    } else {
      state.rollRate *= 0.52;
    }
  }
  if (Math.abs(nextRoll) >= ROOF_REST_ANGLE) {
    nextRoll = Math.sign(nextRoll) * ROOF_REST_ANGLE;
    state.rollRate *= -0.06;
    state.overturned = true;
  }
  state.bodyRoll = nextRoll;

  if (state.overturned && Math.abs(state.bodyRoll) < 0.28 && Math.abs(state.rollRate) < 0.2) {
    state.overturned = false;
  }
  if (state.overturned) {
    state.wheelLift = Math.sign(state.bodyRoll || 1);
  }
}

function terrainTripForce(
  state: SimulationVehicleState,
  longitudinal: number,
  lateral: number,
  onRoad: boolean,
  dt: number,
) {
  let force = 0;
  const crossingSurface = state.surfaceOnRoad !== onRoad;
  if (crossingSurface && Math.abs(lateral) > 3.2 && Math.abs(longitudinal) > 6) {
    const tripLimit = onRoad ? 6.5 : 5.5;
    const tripFraction = onRoad ? 0.42 : 0.34;
    const lateralVelocityChange = -Math.sign(lateral) * Math.min(
      tripLimit,
      Math.max(0, Math.abs(lateral) - 2.4) * tripFraction,
    );
    force += lateralVelocityChange * CROWN_TAXI_SPECS.massKg / dt;
  }
  if (!onRoad && Math.abs(lateral) > 1.2) {
    const soilAcceleration = Math.min(22, 1.6 + Math.abs(lateral) * 0.72);
    force += -Math.sign(lateral) * soilAcceleration * CROWN_TAXI_SPECS.massKg;
  }
  state.surfaceOnRoad = onRoad;
  return force;
}

function stepSimulationSubstep(
  game: Game,
  input: Readonly<InputState>,
  dt: number,
  onRoad: boolean,
) {
  const state = game.simulationVehicle;
  const previousHeading = game.heading;
  const forwardX = Math.cos(previousHeading);
  const forwardY = Math.sin(previousHeading);
  const rightX = -forwardY;
  const rightY = forwardX;
  let longitudinal = (game.vx * forwardX + game.vy * forwardY) * WORLD_SPEED_TO_MPS;
  let lateral = (game.vx * rightX + game.vy * rightY) * WORLD_SPEED_TO_MPS;
  const planarSpeed = Math.hypot(longitudinal, lateral);

  const wantsForward = input.up && !input.down;
  const wantsReverse = input.down && !input.up;
  let throttleTarget = 0;
  let brakeTarget = 0;

  if (!state.overturned && wantsForward) {
    state.reverseHold = 0;
    if (longitudinal < -0.45) {
      brakeTarget = 1;
    } else {
      state.gear = state.gear < 1 ? 1 : state.gear;
      throttleTarget = 1;
    }
  } else if (!state.overturned && wantsReverse) {
    if (longitudinal > 0.45) {
      state.reverseHold = 0;
      brakeTarget = 1;
    } else {
      state.reverseHold += dt;
      if (state.reverseHold >= 0.28) {
        state.gear = -1;
        throttleTarget = 1;
      } else {
        brakeTarget = 1;
      }
    }
  } else {
    state.reverseHold = 0;
  }

  state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);
  state.throttle = smooth(state.throttle, throttleTarget, throttleTarget > state.throttle ? 5.2 : 8.5, dt);
  state.brake = smooth(state.brake, brakeTarget, brakeTarget > state.brake ? 11 : 15, dt);
  state.parkingBrake = smooth(
    state.parkingBrake,
    !state.overturned && input.boost ? 1 : 0,
    input.boost ? 16 : 12,
    dt,
  );

  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const steerTarget = steerInput * MAX_STEER_RADIANS;
  const steeringRate = steerInput === 0 ? 1.35 : 0.94;
  state.steeringAngle = moveToward(state.steeringAngle, steerTarget, steeringRate * dt);

  if (state.gear > 0 && !state.overturned) automaticGear(state, Math.max(0, longitudinal));
  const gearRatio = state.gear === -1
    ? CROWN_TAXI_SPECS.reverseGearRatio
    : CROWN_TAXI_SPECS.forwardGearRatios[Math.max(1, state.gear)];
  const wheelRpm = Math.abs(longitudinal) / CROWN_TAXI_SPECS.wheelRadiusM * 60 / (Math.PI * 2);
  const coupledRpm = wheelRpm * gearRatio * CROWN_TAXI_SPECS.finalDriveRatio;
  const launchRpm = CROWN_TAXI_SPECS.idleRpm + state.throttle * 1_450;
  const targetRpm = clamp(
    Math.max(CROWN_TAXI_SPECS.idleRpm, coupledRpm, Math.abs(longitudinal) < 1.2 ? launchRpm : 0),
    CROWN_TAXI_SPECS.idleRpm,
    CROWN_TAXI_SPECS.redlineRpm,
  );
  state.engineRpm = smooth(state.engineRpm, targetRpm, state.shiftCooldown > 0 ? 14 : 8, dt);

  const rallyTires = game.installedUpgrades.includes("rally-tires");
  const friction = onRoad
    ? CROWN_TAXI_SPECS.roadFriction
    : rallyTires ? CROWN_TAXI_SPECS.rallyOffroadFriction : CROWN_TAXI_SPECS.offroadFriction;
  const staticFrontLoad = CROWN_TAXI_SPECS.massKg * GRAVITY
    * CROWN_TAXI_SPECS.cgToRearAxleM / CROWN_TAXI_SPECS.wheelbaseM;
  const totalWeight = CROWN_TAXI_SPECS.massKg * GRAVITY;
  const staticRearLoad = totalWeight - staticFrontLoad;
  const longitudinalTransfer = CROWN_TAXI_SPECS.massKg
    * state.longitudinalAcceleration
    * CROWN_TAXI_SPECS.cgHeightM
    / CROWN_TAXI_SPECS.wheelbaseM;
  const frontLoad = clamp(staticFrontLoad - longitudinalTransfer, totalWeight * 0.12, totalWeight * 0.88);
  const rearLoad = totalWeight - frontLoad;
  const lateralTransfer = CROWN_TAXI_SPECS.massKg
    * state.lateralAcceleration
    * CROWN_TAXI_SPECS.cgHeightM
    / AVERAGE_TRACK_M;
  const attitudeTransferFront = Math.abs(state.wheelLift) * frontLoad / 2;
  const attitudeTransferRear = Math.abs(state.wheelLift) * rearLoad / 2;
  const frontCapacity = axleCapacity(
    frontLoad,
    Math.max(Math.abs(lateralTransfer * 0.56), attitudeTransferFront),
    staticFrontLoad / 2,
    friction,
  );
  const rearCapacity = axleCapacity(
    rearLoad,
    Math.max(Math.abs(lateralTransfer * 0.44), attitudeTransferRear),
    staticRearLoad / 2,
    friction,
  );

  const driveDirection = state.gear === -1 ? -1 : 1;
  const speedInDriveDirection = longitudinal * driveDirection;
  const speedLimit = state.gear === -1
    ? CROWN_TAXI_SPECS.governedReverseSpeedMps
    : CROWN_TAXI_SPECS.governedTopSpeedMps;
  const governor = clamp((speedLimit - speedInDriveDirection) / 3.2, 0, 1);
  const converterMultiplication = state.gear === 1
    ? 1 + 0.62 * (1 - clamp(Math.abs(longitudinal) / 8.5, 0, 1))
    : 1;
  const driveDemand = state.overturned ? 0 : engineTorqueNm(state.engineRpm)
    * gearRatio
    * CROWN_TAXI_SPECS.finalDriveRatio
    * CROWN_TAXI_SPECS.drivelineEfficiency
    / CROWN_TAXI_SPECS.wheelRadiusM
    * state.throttle
    * driveDirection
    * governor
    * converterMultiplication;
  const speedSign = Math.abs(longitudinal) > 0.08 ? Math.sign(longitudinal) : driveDirection;
  const serviceBrakeDemand = CROWN_TAXI_SPECS.serviceBrakeForceN * state.brake;
  const frontLongitudinalForce = state.overturned ? 0 : signedClamp(
    -speedSign * serviceBrakeDemand * 0.7,
    frontCapacity,
  );
  const rearLongitudinalForce = state.overturned ? 0 : signedClamp(
    driveDemand
      - speedSign * serviceBrakeDemand * 0.3
      - speedSign * CROWN_TAXI_SPECS.parkingBrakeForceN * state.parkingBrake,
    rearCapacity,
  );

  const aeroForce = -Math.sign(longitudinal)
    * 0.5
    * AIR_DENSITY
    * CROWN_TAXI_SPECS.dragCoefficient
    * CROWN_TAXI_SPECS.frontalAreaM2
    * longitudinal * longitudinal;
  const rollingCoefficient = onRoad
    ? CROWN_TAXI_SPECS.rollingResistance
    : rallyTires ? 0.029 : 0.038;
  const rollingForce = Math.abs(longitudinal) > 0.08
    ? -Math.sign(longitudinal) * rollingCoefficient * CROWN_TAXI_SPECS.massKg * GRAVITY
    : 0;
  const engineBrakingForce = !state.overturned && state.throttle < 0.03 && Math.abs(longitudinal) > 0.35
    ? -Math.sign(longitudinal) * 1_050 * Math.max(0.7, gearRatio)
    : 0;

  const absLongitudinal = Math.abs(longitudinal);
  const slipDenominator = Math.max(1.25, absLongitudinal);
  const directionForSlip = longitudinal < -0.35 ? -1 : 1;
  const frontSlip = Math.atan2(
    lateral + CROWN_TAXI_SPECS.cgToFrontAxleM * state.yawRate,
    slipDenominator,
  ) - state.steeringAngle * directionForSlip;
  const rearSlip = Math.atan2(
    lateral - CROWN_TAXI_SPECS.cgToRearAxleM * state.yawRate,
    slipDenominator,
  );
  state.frontSlipAngle = frontSlip;
  state.rearSlipAngle = rearSlip;

  const frontLateralCapacity = combinedLateralCapacity(frontCapacity, frontLongitudinalForce);
  const rearParkingRelease = 1 - state.parkingBrake * 0.83;
  const rearLateralCapacity = combinedLateralCapacity(rearCapacity, rearLongitudinalForce)
    * rearParkingRelease;
  const frontLateralForce = state.overturned ? 0 : lateralTireForce(
    frontSlip,
    CROWN_TAXI_SPECS.frontCorneringStiffnessNPerRad,
    frontLateralCapacity,
  );
  const rearLateralForce = state.overturned ? 0 : lateralTireForce(
    rearSlip,
    CROWN_TAXI_SPECS.rearCorneringStiffnessNPerRad,
    rearLateralCapacity,
  );
  const tripForce = state.overturned ? 0 : terrainTripForce(state, longitudinal, lateral, onRoad, dt);

  let chassisLongitudinalForce = aeroForce + rollingForce + engineBrakingForce;
  let chassisLateralForce = tripForce;
  if (state.overturned) {
    chassisLongitudinalForce += -longitudinal * CROWN_TAXI_SPECS.massKg * 1.45;
    chassisLateralForce += -lateral * CROWN_TAXI_SPECS.massKg * 2.1;
  }
  const longitudinalForceAcceleration = (
    frontLongitudinalForce + rearLongitudinalForce + chassisLongitudinalForce
  ) / CROWN_TAXI_SPECS.massKg;
  const lateralForceAcceleration = (
    frontLateralForce + rearLateralForce + chassisLateralForce
  ) / CROWN_TAXI_SPECS.massKg;
  const longitudinalDerivative = longitudinalForceAcceleration + lateral * state.yawRate;
  const lateralDerivative = lateralForceAcceleration - longitudinal * state.yawRate;
  const yawAcceleration = state.overturned
    ? -state.yawRate * 3.2
    : (
      CROWN_TAXI_SPECS.cgToFrontAxleM * frontLateralForce
      - CROWN_TAXI_SPECS.cgToRearAxleM * rearLateralForce
    ) / CROWN_TAXI_SPECS.yawInertiaKgM2;

  const previousLongitudinal = longitudinal;
  longitudinal += longitudinalDerivative * dt;
  lateral += lateralDerivative * dt;
  state.yawRate += yawAcceleration * dt;

  // A fast broadside slide has little longitudinal speed, but is not a
  // parking maneuver. Keep its momentum under the tire-force model.
  const lowSpeedBlend = clamp((planarSpeed - 1.1) / 4.2, 0, 1);
  if (!state.overturned) {
    const kinematicYawRate = longitudinal / CROWN_TAXI_SPECS.wheelbaseM * Math.tan(state.steeringAngle);
    state.yawRate = kinematicYawRate * (1 - lowSpeedBlend) + state.yawRate * lowSpeedBlend;
    lateral *= Math.exp(-(1 - lowSpeedBlend) * 8 * dt);
  }

  if (state.brake > 0.05 && throttleTarget === 0 && Math.sign(previousLongitudinal) !== Math.sign(longitudinal)) {
    longitudinal = 0;
  }
  // The governor limits engine force, not collision or spin momentum.
  // In particular, sliding backward in Drive must not hit the reverse cap.
  const totalPlanarSpeed = Math.hypot(longitudinal, lateral);
  if (totalPlanarSpeed > 65) {
    const safetyScale = 65 / totalPlanarSpeed;
    longitudinal *= safetyScale;
    lateral *= safetyScale;
  }
  state.yawRate = clamp(state.yawRate, -4, 4);

  state.longitudinalAcceleration = longitudinalForceAcceleration;
  state.lateralAcceleration = lateralForceAcceleration;
  stepBodyAttitude(
    state,
    longitudinalForceAcceleration,
    lateralForceAcceleration,
    dt,
  );

  game.heading = normalizeAngle(previousHeading + state.yawRate * dt);
  const nextForwardX = Math.cos(game.heading);
  const nextForwardY = Math.sin(game.heading);
  const nextRightX = -nextForwardY;
  const nextRightY = nextForwardX;
  game.vx = (nextForwardX * longitudinal + nextRightX * lateral) * MPS_TO_WORLD_SPEED;
  game.vy = (nextForwardY * longitudinal + nextRightY * lateral) * MPS_TO_WORLD_SPEED;
  game.speed = Math.hypot(game.vx, game.vy);
  game.steering = clamp(state.steeringAngle / MAX_STEER_RADIANS, -1, 1);
  game.brakeInputHeld = wantsReverse;
  game.brakeDriftKick = 0;
  game.brakeDriftCooldown = 0;
  game.boosting = false;
  game.boost = 0;

  const bodySlip = Math.atan2(lateral, Math.max(0.7, Math.abs(longitudinal)));
  game.driftAngle = bodySlip;
  game.driftIntensity = clamp((Math.abs(bodySlip) - 0.045) / 0.52, 0, 1);
  game.drifting = !state.overturned && Math.abs(longitudinal) > 4.5 && game.driftIntensity > 0.12;
  game.driftBank = 0;
  game.driftScoreCarry = 0;

  state.longitudinalSpeed = longitudinal;
  state.lateralSpeed = lateral;
  state.wheelRotation = normalizeAngle(
    state.wheelRotation + longitudinal / CROWN_TAXI_SPECS.wheelRadiusM * dt,
  );
}

/**
 * Advances the simulation taxi using two bounded 120 Hz chassis substeps. One
 * vehicle makes this materially more stable during spins and trips at trivial
 * cost compared with world streaming and rendering.
 */
export function stepSimulationVehicle(
  game: Game,
  input: Readonly<InputState>,
  dt: number,
  onRoad: boolean,
): SimulationVehicleStepResult {
  const wasOverturned = game.simulationVehicle.overturned;
  let remaining = Math.max(0, dt);
  while (remaining > 1e-9) {
    const substep = Math.min(PHYSICS_SUBSTEP, remaining);
    stepSimulationSubstep(game, input, substep, onRoad);
    remaining -= substep;
  }
  if (game.simulationVehicle.overturned) {
    game.message = "CAB OVERTURNED · EXIT AND RIGHT IT";
    game.messageUntil = game.elapsed + 1.2;
  }
  return {
    rolloverStarted: !wasOverturned && game.simulationVehicle.overturned,
  };
}

/** Keeps local chassis velocity aligned when building collision limits yaw. */
export function reconcileSimulationHeading(
  game: Game,
  previousHeading: number,
  allowedHeading: number,
) {
  const requestedDelta = normalizeAngle(game.heading - previousHeading);
  const allowedDelta = normalizeAngle(allowedHeading - previousHeading);
  const correction = normalizeAngle(allowedHeading - game.heading);
  const cos = Math.cos(correction);
  const sin = Math.sin(correction);
  const vx = game.vx * cos - game.vy * sin;
  const vy = game.vx * sin + game.vy * cos;
  game.vx = vx;
  game.vy = vy;
  game.heading = allowedHeading;
  if (Math.abs(requestedDelta) > 1e-8) {
    const applied = clamp(Math.abs(allowedDelta / requestedDelta), 0, 1);
    game.simulationVehicle.yawRate *= applied;
  }
}
