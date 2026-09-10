import { circleHitsBuilding, ceilingHeightAt } from "./collision";
import { SPEED_KMH_PER_WORLD_UNIT, WALKING_TUNING } from "./config";
import { clamp, distance, localPoint, normalizeAngle } from "./math";
import type {
  ActorPose,
  CameraMode,
  Game,
  InputState,
  OnFootAction,
  Vec2,
  WorldPoint,
  WalkingActor,
  WorldView,
} from "./model";
import { clampPointToActiveRegions } from "./regions";
import { groundAt } from "./vehicle-road-contact";
import { terrainBarrier } from "./terrain/surface";

export const WALKER_RADIUS = WALKING_TUNING.radius;
/** Exclusive exit threshold, expressed in simulation world units per second. */
export const TAXI_EXIT_SPEED = 10 / SPEED_KMH_PER_WORLD_UNIT;
export const TAXI_ENTER_RADIUS = 3.7;

export type WalkingMotion = {
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
};

export type WalkingStepResult = {
  jumped: boolean;
  landed: boolean;
  landingSpeed: number;
};

const DEFAULT_WALKING_MOTION: WalkingMotion = {
  elevation: 0,
  verticalSpeed: 0,
  grounded: true,
  crouchAmount: 0,
  jumpHeld: false,
  jumpBuffer: 0,
  coyoteTime: WALKING_TUNING.coyoteSeconds,
  gaitPhase: 0,
  landingImpact: 0,
  turnLean: 0,
  action: "idle",
};

function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? value as number : fallback;
}

/** Read a complete, finite motion snapshot from old or current walking poses. */
export function walkingMotion(actor: WalkingActor): WalkingMotion {
  const elevation = Math.max(0, finite(actor.elevation, DEFAULT_WALKING_MOTION.elevation));
  const verticalSpeed = finite(actor.verticalSpeed, DEFAULT_WALKING_MOTION.verticalSpeed);
  return {
    elevation,
    verticalSpeed,
    grounded: actor.grounded ?? (elevation <= 0 && verticalSpeed <= 0),
    crouchAmount: clamp(finite(actor.crouchAmount, 0), 0, 1),
    jumpHeld: actor.jumpHeld ?? false,
    jumpBuffer: Math.max(0, finite(actor.jumpBuffer, 0)),
    coyoteTime: Math.max(0, finite(actor.coyoteTime, WALKING_TUNING.coyoteSeconds)),
    gaitPhase: finite(actor.gaitPhase, 0),
    landingImpact: clamp(finite(actor.landingImpact, 0), 0, 1),
    turnLean: clamp(finite(actor.turnLean, 0), -1, 1),
    action: actor.action ?? "idle",
  };
}

function writeWalkingMotion(actor: WalkingActor, motion: WalkingMotion) {
  actor.elevation = motion.elevation;
  actor.verticalSpeed = motion.verticalSpeed;
  actor.grounded = motion.grounded;
  actor.crouchAmount = motion.crouchAmount;
  actor.jumpHeld = motion.jumpHeld;
  actor.jumpBuffer = motion.jumpBuffer;
  actor.coyoteTime = motion.coyoteTime;
  actor.gaitPhase = motion.gaitPhase;
  actor.landingImpact = motion.landingImpact;
  actor.turnLean = motion.turnLean;
  actor.action = motion.action;
}

/** Create a grounded, standing actor for taxi/interior transitions. */
export function makeWalkingActor(pose: ActorPose): WalkingActor {
  return { ...pose, ...DEFAULT_WALKING_MOTION, elevation: pose.z ?? 0 };
}

export function taxiPose(game: Game): ActorPose {
  return {
    x: game.x,
    y: game.y,
    z: game.z ?? 0,
    vx: game.vx,
    vy: game.vy,
    heading: game.heading,
    speed: game.speed,
  };
}

export function controlledPose(game: Game): ActorPose {
  return game.player.kind === "walking"
    ? { ...game.player.actor, z: game.player.actor.elevation ?? 0 }
    : taxiPose(game);
}

export function isDriving(game: Game) {
  return game.player.kind === "driving";
}

/**
 * The timed Arcade Shift meter pauses during empty-taxi exploration, but a
 * passenger keeps it live when the driver steps out. Free Run has no clock.
 */
export function shouldAdvanceRunClock(game: Game) {
  return game.runKind === "timed" && (isDriving(game) || game.onboard);
}

export function isInterior(game: Game) {
  return game.player.kind === "walking" && game.player.location.kind === "interior";
}

/** Camera lift shared by WebGPU and Canvas without changing horizontal focus. */
export function walkingCameraHeightOffset(
  actor: WalkingActor,
  mode: CameraMode,
  reducedMotion = false,
) {
  const motion = walkingMotion(actor);
  const groundHeight = groundAt({ x: actor.x, y: actor.y, z: motion.elevation }).height;
  if (mode === "fixed") return groundHeight;
  const speedMix = clamp(actor.speed / WALKING_TUNING.runSpeed, 0, 1);
  const bob = reducedMotion || !motion.grounded
    ? 0
    : Math.abs(Math.sin(motion.gaitPhase)) * 0.075 * speedMix;
  const landing = reducedMotion ? 0 : motion.landingImpact * 0.1;
  if (mode === "cab") {
    return motion.elevation - motion.crouchAmount * 0.62 + bob - landing;
  }
  return groundHeight + (motion.elevation - groundHeight) * 0.28 - motion.crouchAmount * 0.18 + bob * 0.45 - landing * 0.4;
}

function exitPoseIsClear(game: Game, world: WorldView, point: Vec2) {
  const support = groundAt({ ...point, z: game.z }, 0.85);
  if (Math.abs(support.height - game.z) > 0.85) return false;
  if (circleHitsBuilding(world, point.x, point.y, WALKER_RADIUS, support.height)) return false;
  return !game.traffic.some((car) => game.elapsed >= car.activeAt
    && Math.abs((car.z ?? 0) - support.height) < 2 && distance(point, car) < 2.15);
}

/** Driver side first, then passenger side, rear, and front. */
export function findTaxiExitPose(game: Game, world: WorldView): WalkingActor | null {
  if (game.roadMotion && !game.roadMotion.grounded) return null;
  const candidates = [
    localPoint(game.x, game.y, game.heading, -0.35, -2.05),
    localPoint(game.x, game.y, game.heading, -0.35, 2.05),
    localPoint(game.x, game.y, game.heading, -3.05, 0),
    localPoint(game.x, game.y, game.heading, 3.05, 0),
  ];
  const point = candidates.find((candidate) => exitPoseIsClear(game, world, candidate));
  return point
    ? makeWalkingActor({ ...point, z: groundAt({ ...point, z: game.z }, 0.85).height, vx: 0, vy: 0, heading: game.heading, speed: 0 })
    : null;
}

export function canEnterTaxi(game: Game, point: WorldPoint) {
  return Math.abs((point.z ?? 0) - (game.z ?? 0)) < 1
    && distance(point, game) <= TAXI_ENTER_RADIUS;
}

function moveCircle(actor: WalkingActor, moveX: number, moveY: number, world: WorldView) {
  const height = 2.4 - (actor.crouchAmount ?? 0) * 0.7;
  const blockedTerrain = (x: number, y: number) => !world.key.startsWith("interior:")
    && terrainBarrier({ ...actor, z: actor.elevation ?? 0 }, { x, y }, 0.9);
  const steps = Math.max(1, Math.ceil(Math.hypot(moveX, moveY) / WALKING_TUNING.collisionSubstep));
  const stepX = moveX / steps;
  const stepY = moveY / steps;
  for (let step = 0; step < steps; step += 1) {
    const nextX = clampPointToActiveRegions(
      { x: actor.x + stepX, y: actor.y },
      WALKER_RADIUS,
    ).x;
    if (!blockedTerrain(nextX, actor.y) && !circleHitsBuilding(world, nextX, actor.y, WALKER_RADIUS, actor.elevation ?? 0, height)) actor.x = nextX;
    else actor.vx = 0;
    const nextY = clampPointToActiveRegions(
      { x: actor.x, y: actor.y + stepY },
      WALKER_RADIUS,
    ).y;
    if (!blockedTerrain(actor.x, nextY) && !circleHitsBuilding(world, actor.x, nextY, WALKER_RADIUS, actor.elevation ?? 0, height)) actor.y = nextY;
    else actor.vy = 0;
  }
}

/**
 * Deterministic fixed-step on-foot controller. W/S move, A/D turn, Shift
 * runs, Space jumps, and C/Ctrl crouches. Air control deliberately retains
 * more momentum than ground movement while the 2D collision body stays solid.
 */
export function stepWalkingActor(
  actor: WalkingActor,
  input: Readonly<InputState>,
  dt: number,
  world: WorldView,
): WalkingStepResult {
  const motion = walkingMotion(actor);
  const result: WalkingStepResult = { jumped: false, landed: false, landingSpeed: 0 };
  const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const move = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const crouchRequested = Boolean(input.crouch) && motion.grounded;
  const runRequested = Boolean(input.sprint || input.boost) && !crouchRequested;
  const jumpDown = Boolean(input.jump);
  const jumpPressed = jumpDown && !motion.jumpHeld;
  motion.jumpHeld = jumpDown;
  if (jumpPressed) motion.jumpBuffer = WALKING_TUNING.jumpBufferSeconds;
  else motion.jumpBuffer = Math.max(0, motion.jumpBuffer - dt);

  if (motion.grounded) motion.coyoteTime = WALKING_TUNING.coyoteSeconds;
  else motion.coyoteTime = Math.max(0, motion.coyoteTime - dt);

  const clearance = ceilingHeightAt(world, actor.x, actor.y, motion.elevation, WALKER_RADIUS) - motion.elevation;
  const forcedCrouch = clamp((2.4 - clearance) / 0.7, 0, 1);
  const crouchTarget = Math.max(crouchRequested && !jumpPressed ? 1 : 0, forcedCrouch);
  motion.crouchAmount += (crouchTarget - motion.crouchAmount)
    * (1 - Math.exp(-WALKING_TUNING.crouchResponse * dt));
  if (Math.abs(motion.crouchAmount - crouchTarget) < 0.001) motion.crouchAmount = crouchTarget;

  if (motion.jumpBuffer > 0 && motion.coyoteTime > 0 && motion.crouchAmount < 0.72) {
    motion.verticalSpeed = WALKING_TUNING.jumpImpulse;
    motion.elevation = Math.max(0.01, motion.elevation);
    motion.grounded = false;
    motion.jumpBuffer = 0;
    motion.coyoteTime = 0;
    result.jumped = true;
  }

  const turnRate = !motion.grounded
    ? WALKING_TUNING.turnAir
    : runRequested && Math.abs(move) > 0
      ? WALKING_TUNING.turnRun
      : Math.abs(move) > 0
        ? WALKING_TUNING.turnWalk
        : WALKING_TUNING.turnIdle;
  actor.heading = normalizeAngle(actor.heading + turn * turnRate * dt);

  const forwardX = Math.cos(actor.heading);
  const forwardY = Math.sin(actor.heading);
  const directionMultiplier = move < 0 ? WALKING_TUNING.backwardMultiplier : 1;
  const stanceSpeed = crouchRequested
    ? WALKING_TUNING.crouchSpeed
    : runRequested
      ? WALKING_TUNING.runSpeed
      : WALKING_TUNING.walkSpeed;
  const targetSpeed = move * stanceSpeed * directionMultiplier;
  const currentForward = actor.vx * forwardX + actor.vy * forwardY;
  const reversing = move !== 0 && currentForward !== 0 && Math.sign(currentForward) !== Math.sign(move);
  const responseRate = !motion.grounded
    ? WALKING_TUNING.airControlResponse
    : move === 0
      ? WALKING_TUNING.groundDeceleration
      : reversing
        ? WALKING_TUNING.reversalResponse
        : runRequested
          ? WALKING_TUNING.runAcceleration
          : WALKING_TUNING.groundAcceleration;
  const response = 1 - Math.exp(-responseRate * dt);
  const targetVx = forwardX * targetSpeed;
  const targetVy = forwardY * targetSpeed;
  actor.vx += (targetVx - actor.vx) * response;
  actor.vy += (targetVy - actor.vy) * response;
  if (move === 0 && Math.hypot(actor.vx, actor.vy) < 0.012) {
    actor.vx = 0;
    actor.vy = 0;
  }

  const startX = actor.x;
  const startY = actor.y;
  moveCircle(actor, actor.vx * dt, actor.vy * dt, world);
  const traveled = Math.hypot(actor.x - startX, actor.y - startY);
  actor.speed = Math.hypot(actor.vx, actor.vy);

  const support = world.key.startsWith("interior:")
    ? { height: 0 }
    : groundAt({ x: actor.x, y: actor.y, z: motion.elevation }, motion.grounded ? 0.85 : 0);
  if (motion.grounded && Math.abs(support.height - motion.elevation) > 0.85) motion.grounded = false;
  if (!motion.grounded) {
    const gravity = motion.verticalSpeed > 0
      ? jumpDown ? WALKING_TUNING.riseGravity : WALKING_TUNING.releaseGravity
      : WALKING_TUNING.fallGravity;
    motion.verticalSpeed -= gravity * dt;
    const previousElevation = motion.elevation;
    motion.elevation += motion.verticalSpeed * dt;
    const actorHeight = 2.4 - motion.crouchAmount * 0.7;
    const ceiling = ceilingHeightAt(world, actor.x, actor.y, previousElevation, WALKER_RADIUS);
    if (motion.verticalSpeed > 0 && motion.elevation + actorHeight > ceiling) {
      motion.elevation = Math.max(support.height, ceiling - actorHeight);
      motion.verticalSpeed = 0;
    }
    if (motion.elevation <= support.height) {
      result.landed = true;
      result.landingSpeed = Math.max(0, -motion.verticalSpeed);
      motion.elevation = support.height;
      motion.verticalSpeed = 0;
      motion.grounded = true;
      motion.coyoteTime = WALKING_TUNING.coyoteSeconds;
      motion.landingImpact = clamp(result.landingSpeed / 8, 0, 1);
    }
  } else {
    motion.elevation = support.height;
    motion.verticalSpeed = 0;
  }

  motion.landingImpact = Math.max(0, motion.landingImpact - WALKING_TUNING.landingRecovery * dt);
  const moving = actor.speed > 0.08;
  if (motion.grounded && traveled > 0.0001) {
    const cadence = runRequested ? 2.9 : crouchRequested ? 1.9 : 2.45;
    motion.gaitPhase = normalizeAngle(motion.gaitPhase + traveled * cadence);
  }
  const leanTarget = turn * clamp(actor.speed / WALKING_TUNING.runSpeed, 0, 1);
  motion.turnLean += (leanTarget - motion.turnLean) * (1 - Math.exp(-9 * dt));
  if (!motion.grounded) motion.action = motion.verticalSpeed >= 0 ? "jump" : "fall";
  else if (motion.crouchAmount > 0.55) motion.action = "crouch";
  else if (!moving) motion.action = "idle";
  else motion.action = runRequested ? "run" : "walk";

  writeWalkingMotion(actor, motion);
  return result;
}
