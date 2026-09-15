import { accordCoupledRpm, clutchConnected, stepManualTransmission } from "./manual-transmission";
import { stepOffroadSpeedLimit } from "./offroad-speed";
import { ACCORD_GEARS, ACCORD_FINAL_DRIVE, ACCORD_WHEEL_RADIUS_M, ACCORD_REDLINE_RPM, VEHICLE_GOVERNED_SPEED_KMH } from "./vehicles";
import { damageSpeedLimit } from "./vehicle-damage";
import { hasFuel } from "./fuel";
import { SPEED_KMH_PER_WORLD_UNIT } from "./config";
import { steeringInput } from "./input";
import { clamp, normalizeAngle } from "./math";
import type {
  CruisePedals,
  Game,
  InputState,
  SimulationGear,
  SimulationVehicleState,
  VehicleId,
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
  governedTopSpeedMps: VEHICLE_GOVERNED_SPEED_KMH["crown-cab"] / 3.6,
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
const GOVERNOR_TAPER_MPS = 3.2;
const WORLD_SPEED_TO_MPS = SPEED_KMH_PER_WORLD_UNIT / 3.6;
const MPS_TO_WORLD_SPEED = 1 / WORLD_SPEED_TO_MPS;
const MAX_STEER_RADIANS = 0.56;
const PHYSICS_SUBSTEP = 1 / 120;
type VehicleSpecs = { readonly [K in keyof typeof CROWN_TAXI_SPECS]:
  K extends "forwardGearRatios" ? readonly number[] : number };

/** Custom 300 hp coupe on winter rubber. Loaded mass includes its driver. */
export const ACCORD_V6_SPECS: VehicleSpecs = {
  ...CROWN_TAXI_SPECS,
  massKg: 1_640, yawInertiaKgM2: 2_650, rollInertiaKgM2: 540,
  wheelbaseM: 2.725, cgToFrontAxleM: 1.09, cgToRearAxleM: 1.635,
  cgHeightM: 0.51, frontTrackM: 1.585, rearTrackM: 1.59,
  wheelRadiusM: ACCORD_WHEEL_RADIUS_M, finalDriveRatio: ACCORD_FINAL_DRIVE,
  forwardGearRatios: ACCORD_GEARS, reverseGearRatio: 2.269,
  drivelineEfficiency: 0.89, idleRpm: 750, redlineRpm: ACCORD_REDLINE_RPM,
  governedTopSpeedMps: VEHICLE_GOVERNED_SPEED_KMH["accord-v6"] / 3.6, serviceBrakeForceN: 14_400, parkingBrakeForceN: 6_500,
  frontCorneringStiffnessNPerRad: 68_000, rearCorneringStiffnessNPerRad: 61_000,
  dragCoefficient: 0.31, frontalAreaM2: 2.16, rollingResistance: 0.018,
  roadFriction: 0.78, offroadFriction: 0.6, rallyOffroadFriction: 0.68,
};

function chassisSpecs(specs: VehicleSpecs) {
  const averageTrackM = (specs.frontTrackM + specs.rearTrackM) / 2;
  const halfTrackM = averageTrackM / 2;
  return { ...specs, averageTrackM, halfTrackM,
    staticStabilityFactor: averageTrackM / (2 * specs.cgHeightM),
    pivotRollInertia: specs.rollInertiaKgM2 + specs.massKg * (specs.cgHeightM ** 2 + halfTrackM ** 2) };
}
const CROWN_CHASSIS = chassisSpecs(CROWN_TAXI_SPECS);
const ACCORD_CHASSIS = chassisSpecs(ACCORD_V6_SPECS);
export function simulationVehicleSpecs(id: VehicleId) {
  return id === "accord-v6" ? ACCORD_CHASSIS : CROWN_CHASSIS;
}
const SIDE_REST_ANGLE = Math.PI / 2;
const ROOF_REST_ANGLE = Math.PI;

export type SimulationVehicleStepResult = Readonly<{
  rolloverStarted: boolean;
}>;

export function makeSimulationVehicleState(vehicleId: VehicleId = "crown-cab"): SimulationVehicleState {
  return {
    gear: 1,
    engineRpm: simulationVehicleSpecs(vehicleId).idleRpm,
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
  const specs = simulationVehicleSpecs(game.vehicleId);
  const rightX = -Math.sin(game.heading);
  const rightY = Math.cos(game.heading);
  const lateralDeltaMps = (
    deltaVelocityWorldX * rightX + deltaVelocityWorldY * rightY
  ) * WORLD_SPEED_TO_MPS;
  if (Math.abs(lateralDeltaMps) < 0.05) return;
  game.simulationVehicle.rollRate += lateralDeltaMps
    * specs.massKg
    * specs.cgHeightM
    / specs.pivotRollInertia
    * clamp(leverage, 0, 1.4);
  game.simulationVehicle.rollRate = clamp(game.simulationVehicle.rollRate, -7.5, 7.5);
}

function engineTorqueNm(rpm: number, accord: boolean, gear: SimulationGear) {
  // Fifth/sixth roll-on calibration: C/D's 2016 V6 6MT measured about 8 s
  // for both 30–50 and 50–70 mph in sixth (sources in docs/vehicles.md).
  // Preserve first–fourth's existing tune and the custom 300 hp power peak.
  const points = accord ? gear >= 5 ? [
    [750, 175], [1_000, 290], [1_500, 310], [3_000, 350], [4_900, 365], [6_200, 344.6], [6_800, 285],
  ] : [
    [750, 175], [1_500, 245], [3_000, 310], [4_900, 365], [6_200, 344.6], [6_800, 285],
  ] : [
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

/** SI force for the manual coupe and automatic fifth/sixth; steering stays arcade. */
export function accordManualAcceleration(speedMps: number, gear: SimulationGear, throttle: number, connected: boolean, onRoad: boolean) {
  const specs = ACCORD_V6_SPECS;
  const ratio = gear === -1 ? specs.reverseGearRatio : specs.forwardGearRatios[gear];
  const coupledRpm = accordCoupledRpm(speedMps, gear);
  const rpm = Math.max(specs.idleRpm, coupledRpm, Math.abs(speedMps) < 1.2 ? specs.idleRpm + throttle * 1_450 : 0);
  const limiter = clamp((specs.redlineRpm - coupledRpm) / 120, 0, 1);
  const drive = connected ? engineTorqueNm(rpm, true, gear) * ratio * specs.finalDriveRatio
    * specs.drivelineEfficiency / specs.wheelRadiusM * throttle * limiter : 0;
  const friction = onRoad ? specs.roadFriction : specs.offroadFriction;
  // Solve front-axle grip with longitudinal load transfer (FWD, winter tires).
  const traction = friction * specs.massKg * GRAVITY * specs.cgToRearAxleM
    / (specs.wheelbaseM + friction * specs.cgHeightM);
  const rolling = Math.abs(speedMps) > 0.08 ? specs.rollingResistance * specs.massKg * GRAVITY : 0;
  const aero = 0.5 * AIR_DENSITY * specs.dragCoefficient * specs.frontalAreaM2 * speedMps ** 2;
  const engineBrake = connected && throttle === 0 && Math.abs(speedMps) > 0.35 ? 180 * ratio : 0;
  return (Math.sign(gear) * Math.min(drive, traction) - Math.sign(speedMps) * (rolling + aero + engineBrake)) / specs.massKg;
}

// Solve once, without simulation state: penalties must lower attainable road
// speed, not a redline ceiling the unboosted car cannot reach against air drag.
const ACCORD_TOP_GEAR_ROAD_SPEEDS = ([5, 6] as const).map(gear => {
  let low = 0, high = ACCORD_V6_SPECS.governedTopSpeedMps;
  for (let step = 0; step < 40; step++) {
    const speed = (low + high) / 2;
    if (accordManualAcceleration(speed, gear, 1, true, true) > 0) low = speed;
    else high = speed;
  }
  return (low + high) / 2;
});

export function accordUnboostedSpeedLimitMps(gear: SimulationGear) {
  return gear >= 5 ? ACCORD_TOP_GEAR_ROAD_SPEEDS[gear - 5] : ACCORD_V6_SPECS.governedTopSpeedMps;
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
  specs: ReturnType<typeof simulationVehicleSpecs>,
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

  const demand = Math.abs(lateralAcceleration) / (GRAVITY * specs.staticStabilityFactor);
  const lateralUnload = clamp(demand, 0, 1);
  const tipAngle = Math.atan(specs.staticStabilityFactor);
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
    const centerSide = -specs.halfTrackM * Math.cos(angle)
      + specs.cgHeightM * Math.sin(angle);
    const centerHeight = specs.halfTrackM * Math.sin(angle)
      + specs.cgHeightM * Math.cos(angle);
    const alignedAcceleration = lateralAcceleration * direction;
    const pivotMoment = specs.massKg * (
      alignedAcceleration * Math.max(0.08, centerHeight)
      + GRAVITY * centerSide
    );
    rollAcceleration = direction * pivotMoment / specs.pivotRollInertia
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
  specs: ReturnType<typeof simulationVehicleSpecs>,
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
    force += lateralVelocityChange * specs.massKg / dt;
  }
  if (!onRoad && Math.abs(lateral) > 1.2) {
    const soilAcceleration = Math.min(22, 1.6 + Math.abs(lateral) * 0.72);
    force += -Math.sign(lateral) * soilAcceleration * specs.massKg;
  }
  state.surfaceOnRoad = onRoad;
  return force;
}

function stepSimulationSubstep(
  game: Game,
  input: Readonly<InputState>,
  dt: number,
  onRoad: boolean,
  cruise: CruisePedals | null,
) {
  const state = game.simulationVehicle;
  const specs = simulationVehicleSpecs(game.vehicleId);
  const accord = game.vehicleId === "accord-v6";
  if (accord) state.gear = game.transmission.gear;
  const connected = clutchConnected(game);
  const previousHeading = game.heading;
  const grounded = game.roadMotion?.grounded !== false;
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

  if (accord && !state.overturned) {
    if (game.transmissionMode === "manual") {
      throttleTarget = wantsForward ? 1 : cruise?.throttle ?? 0;
      brakeTarget = input.down ? 1 : cruise?.brake ?? 0;
    } else {
      const direction = state.gear === -1 ? -1 : 1;
      const wantsDrive = direction > 0 ? wantsForward : wantsReverse;
      throttleTarget = wantsDrive && longitudinal * direction >= -0.45 ? 1 : 0;
      brakeTarget = (wantsForward || wantsReverse) && throttleTarget === 0 ? 1 : 0;
      if (!wantsForward && !wantsReverse && cruise && state.gear > 0) {
        throttleTarget = cruise.throttle;
        brakeTarget = cruise.brake;
      }
    }
  } else if (!state.overturned && wantsForward) {
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
  } else if (!state.overturned && cruise) {
    state.reverseHold = 0;
    state.gear = state.gear < 1 ? 1 : state.gear;
    throttleTarget = longitudinal < -0.45 ? 0 : cruise.throttle;
    brakeTarget = longitudinal < -0.45 ? 1 : cruise.brake;
  } else {
    state.reverseHold = 0;
  }

  if (accord && !connected && input.down) {
    throttleTarget = 0;
    brakeTarget = 1;
  }
  state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);
  if (!hasFuel(game)) throttleTarget = 0;
  state.throttle = hasFuel(game) ? smooth(state.throttle, throttleTarget, throttleTarget > state.throttle ? 5.2 : 8.5, dt) : 0;
  state.brake = smooth(state.brake, brakeTarget, brakeTarget > state.brake ? 11 : 15, dt);
  state.parkingBrake = smooth(
    state.parkingBrake,
    !state.overturned && input.boost ? 1 : 0,
    input.boost ? 16 : 12,
    dt,
  );

  const steerInput = steeringInput(input);
  const steerTarget = steerInput * MAX_STEER_RADIANS;
  const steeringRate = steerInput === 0 ? 1.35 : 0.94;
  state.steeringAngle = moveToward(state.steeringAngle, steerTarget, steeringRate * dt);

  if (!accord && state.gear > 0 && !state.overturned) automaticGear(state, Math.max(0, longitudinal));
  const gearRatio = state.gear === -1
    ? specs.reverseGearRatio
    : specs.forwardGearRatios[state.gear];
  const wheelRpm = Math.abs(longitudinal) / specs.wheelRadiusM * 60 / (Math.PI * 2);
  const coupledRpm = wheelRpm * gearRatio * specs.finalDriveRatio;
  const launchRpm = specs.idleRpm + state.throttle * 1_450;
  const targetRpm = clamp(
    accord && !connected ? specs.idleRpm + state.throttle * (specs.redlineRpm - specs.idleRpm) : Math.max(specs.idleRpm, coupledRpm, Math.abs(longitudinal) < 1.2 ? launchRpm : 0),
    specs.idleRpm,
    specs.redlineRpm,
  );
  state.engineRpm = hasFuel(game) ? smooth(state.engineRpm, targetRpm, state.shiftCooldown > 0 ? 14 : 8, dt) : coupledRpm;

  const rallyTires = game.installedUpgrades.includes("rally-tires");
  const friction = !grounded ? 0 : onRoad
    ? specs.roadFriction
    : rallyTires ? specs.rallyOffroadFriction : specs.offroadFriction;
  const staticFrontLoad = specs.massKg * GRAVITY
    * specs.cgToRearAxleM / specs.wheelbaseM;
  const totalWeight = specs.massKg * GRAVITY;
  const staticRearLoad = totalWeight - staticFrontLoad;
  const longitudinalTransfer = specs.massKg
    * state.longitudinalAcceleration
    * specs.cgHeightM
    / specs.wheelbaseM;
  const frontLoad = clamp(staticFrontLoad - longitudinalTransfer, totalWeight * 0.12, totalWeight * 0.88);
  const rearLoad = totalWeight - frontLoad;
  const lateralTransfer = specs.massKg
    * state.lateralAcceleration
    * specs.cgHeightM
    / specs.averageTrackM;
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
  const penalizedTopGear = accord && state.gear >= 5
    && (game.damage.lossKmh > 0 || grounded && game.offroadSpeedPenaltyKmh > 0);
  // Keep the usual force-governor taper above the attainable speed reference.
  const forwardSpeedLimit = penalizedTopGear
    ? accordUnboostedSpeedLimitMps(state.gear) + GOVERNOR_TAPER_MPS : specs.governedTopSpeedMps;
  const speedLimit = state.gear === -1
    ? specs.governedReverseSpeedMps
    : forwardSpeedLimit - (grounded ? game.offroadSpeedPenaltyKmh / 3.6 : 0);
  const damagedSpeedLimit = damageSpeedLimit(game, speedLimit * 3.6) / 3.6;
  const governor = clamp((damagedSpeedLimit - speedInDriveDirection) / Math.min(GOVERNOR_TAPER_MPS, damagedSpeedLimit * .5), 0, 1);
  const converterMultiplication = !accord && state.gear === 1
    ? 1 + 0.62 * (1 - clamp(Math.abs(longitudinal) / 8.5, 0, 1))
    : 1;
  const driveDemand = state.overturned || !connected ? 0 : engineTorqueNm(state.engineRpm, accord, state.gear)
    * gearRatio
    * specs.finalDriveRatio
    * specs.drivelineEfficiency
    / specs.wheelRadiusM
    * state.throttle
    * driveDirection
    * governor
    * converterMultiplication
    * (accord ? game.transmissionMode === "manual"
      ? clamp((specs.redlineRpm - coupledRpm) / 120, 0, 1)
      : clamp((specs.redlineRpm + 100 - coupledRpm) / 250, 0, 1) : 1);
  const speedSign = Math.abs(longitudinal) > 0.08 ? Math.sign(longitudinal) : driveDirection;
  const serviceBrakeDemand = specs.serviceBrakeForceN * state.brake;
  const frontLongitudinalForce = state.overturned ? 0 : signedClamp(
    (accord ? driveDemand : 0) - speedSign * serviceBrakeDemand * 0.7,
    frontCapacity,
  );
  const rearLongitudinalForce = state.overturned ? 0 : signedClamp(
    (accord ? 0 : driveDemand)
      - speedSign * serviceBrakeDemand * 0.3
      - speedSign * specs.parkingBrakeForceN * state.parkingBrake,
    rearCapacity,
  );

  const aeroForce = -Math.sign(longitudinal)
    * 0.5
    * AIR_DENSITY
    * specs.dragCoefficient
    * specs.frontalAreaM2
    * longitudinal * longitudinal;
  const rollingCoefficient = specs.rollingResistance;
  const rollingForce = grounded && Math.abs(longitudinal) > 0.08
    ? -Math.sign(longitudinal) * rollingCoefficient * specs.massKg * GRAVITY
    : 0;
  const engineBrakingForce = grounded && connected && !state.overturned && state.throttle < 0.03 && Math.abs(longitudinal) > 0.35
    ? -Math.sign(longitudinal) * 1_050 * Math.max(0.7, gearRatio)
    : 0;

  const absLongitudinal = Math.abs(longitudinal);
  const slipDenominator = Math.max(1.25, absLongitudinal);
  const directionForSlip = longitudinal < -0.35 ? -1 : 1;
  const frontSlip = Math.atan2(
    lateral + specs.cgToFrontAxleM * state.yawRate,
    slipDenominator,
  ) - state.steeringAngle * directionForSlip;
  const rearSlip = Math.atan2(
    lateral - specs.cgToRearAxleM * state.yawRate,
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
    specs.frontCorneringStiffnessNPerRad,
    frontLateralCapacity,
  );
  const rearLateralForce = state.overturned ? 0 : lateralTireForce(
    rearSlip,
    specs.rearCorneringStiffnessNPerRad,
    rearLateralCapacity,
  );
  const tripForce = state.overturned || !grounded ? 0 : terrainTripForce(specs, state, longitudinal, lateral, onRoad, dt);

  let chassisLongitudinalForce = aeroForce + rollingForce + engineBrakingForce;
  let chassisLateralForce = tripForce;
  if (state.overturned && grounded) {
    chassisLongitudinalForce += -longitudinal * specs.massKg * 1.45;
    chassisLateralForce += -lateral * specs.massKg * 2.1;
  }
  const longitudinalForceAcceleration = (
    frontLongitudinalForce + rearLongitudinalForce + chassisLongitudinalForce
  ) / specs.massKg;
  const lateralForceAcceleration = (
    frontLateralForce + rearLateralForce + chassisLateralForce
  ) / specs.massKg;
  const longitudinalDerivative = longitudinalForceAcceleration + lateral * state.yawRate;
  const lateralDerivative = lateralForceAcceleration - longitudinal * state.yawRate;
  const yawAcceleration = state.overturned
    ? -state.yawRate * 3.2
    : (
      specs.cgToFrontAxleM * frontLateralForce
      - specs.cgToRearAxleM * rearLateralForce
    ) / specs.yawInertiaKgM2;

  const previousLongitudinal = longitudinal;
  longitudinal += longitudinalDerivative * dt;
  lateral += lateralDerivative * dt;
  state.yawRate += yawAcceleration * dt;

  // A fast broadside slide has little longitudinal speed, but is not a
  // parking maneuver. Keep its momentum under the tire-force model.
  const lowSpeedBlend = clamp((planarSpeed - 1.1) / 4.2, 0, 1);
  if (!state.overturned && grounded) {
    const kinematicYawRate = longitudinal / specs.wheelbaseM * Math.tan(state.steeringAngle);
    state.yawRate = kinematicYawRate * (1 - lowSpeedBlend) + state.yawRate * lowSpeedBlend;
    lateral *= Math.exp(-(1 - lowSpeedBlend) * 8 * dt);
  }

  if (grounded && (state.brake > 0.05 || state.parkingBrake > 0.05) && throttleTarget === 0 && Math.sign(previousLongitudinal) !== Math.sign(longitudinal)) {
    longitudinal = 0;
  }
  // The governor limits engine force, not collision or spin momentum.
  // In particular, sliding backward in Drive must not hit the reverse cap.
  const totalPlanarSpeed = Math.hypot(longitudinal, lateral);
  const safetySpeedMps = Math.max(65, specs.governedTopSpeedMps * 1.2);
  if (totalPlanarSpeed > safetySpeedMps) {
    const safetyScale = safetySpeedMps / totalPlanarSpeed;
    longitudinal *= safetyScale;
    lateral *= safetyScale;
  }
  state.yawRate = clamp(state.yawRate, -4, 4);

  state.longitudinalAcceleration = longitudinalForceAcceleration;
  state.lateralAcceleration = lateralForceAcceleration;
  stepBodyAttitude(
    specs,
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

  state.longitudinalSpeed = longitudinal;
  state.lateralSpeed = lateral;
  state.wheelRotation = normalizeAngle(
    state.wheelRotation + longitudinal / specs.wheelRadiusM * dt,
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
  cruise: CruisePedals | null = null,
): SimulationVehicleStepResult {
  stepManualTransmission(game, input, dt);
  const wasOverturned = game.simulationVehicle.overturned;
  let remaining = Math.max(0, dt);
  while (remaining > 1e-9) {
    const substep = Math.min(PHYSICS_SUBSTEP, remaining);
    stepOffroadSpeedLimit(game, onRoad, substep);
    stepSimulationSubstep(game, input, substep, onRoad, cruise);
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
