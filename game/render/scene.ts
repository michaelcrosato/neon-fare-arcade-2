import { atTerrainElevation } from "../terrain/surface";
import { mountainAnimatedBoxes } from "../mountain-scenery";
import { copperAnimatedBoxes } from "../copper-scenery";
import { coastAnimatedBoxes } from "../coast-scenery";
import { reachAnimatedBoxes } from "../reach-scenery";
import { coastCanalBlock } from "../coastal-layout";
import { residentialPedestrianPoint } from "../residential";
import {
  AMBIENT_PEDESTRIANS_PER_BLOCK,
  BLUE,
  BONE,
  BRICK,
  CYAN,
  INK,
  MAT_MARKER,
  MAT_PERSON,
  MAT_PLAYER,
  MAT_ROUTE,
  MAT_VEHICLE,
  ORANGE,
  PAPER,
  PINK,
  RED,
  ROAD_SPACING,
  STEEL,
  WHITE,
  WALKING_TUNING,
  WORLD_BLOCK_MAX_X,
  WORLD_BLOCK_MAX_Y,
  WORLD_BLOCK_MIN_X,
  WORLD_BLOCK_MIN_Y,
  YELLOW,
} from "../config";
import { clamp, distance, localPoint } from "../math";
import type { Box, Color, Game, Job, Vec2, WorldPoint } from "../model";
import { buildGpsRoute, routeLength } from "../route-geometry";
import { waitingFares } from "../fare-selection";
import { landmarkTileForBlock } from "../landmarks";
import { campusTileForBlock } from "../campuses";
import { getNavigationTarget, getObjective } from "../state";
import { specialRoadIntersectsSquare } from "../road-network";
import { controlledPose, isDriving, isInterior, walkingMotion } from "../player";
import { northstarPedestrianCountForBlock } from "../mountain";
import { copperMesaPedestrianCountForBlock } from "../desert";
import { reachPedestrianPoint } from "../palm-reach";
import { coastalPedestrianCountForBlock } from "../coastal";
import { isActiveBlock, regionForBlock } from "../regions";
import type { WorldView } from "../model";
import { vehicleGroundShadow } from "./lighting";
import { placeBoxesOnRoad, type RoadPose } from "./road-pose";
import { groundAt } from "../vehicle-road-contact";

export function taxiRoadPose(game: Game): RoadPose {
  return { x: game.x, y: game.y, heading: game.heading, z: (game.z ?? 0) + (game.roadMotion?.heave ?? 0),
    pitch: (game.roadMotion?.pitch ?? 0) + (game.drivingModel === "arcade" ? game.arcadeVehicle?.bodyPitch ?? 0 : 0),
    roll: (game.roadMotion?.roll ?? 0) + (game.drivingModel === "arcade" ? game.arcadeVehicle?.bodyRoll ?? 0 : 0) };
}

export function addCarBoxes(
  boxes: Box[],
  x: number,
  y: number,
  heading: number,
  color: Color,
  taxi = false,
  includeGroundShadow = true,
  steering = 0,
) {
  const firstBox = boxes.length;
  if (includeGroundShadow) boxes.push(vehicleGroundShadow(x, y, heading, 5.2, 2.7));
  boxes.push({ x, y, z: 0.72, sx: taxi ? 4.8 : 4.2, sy: taxi ? 2.35 : 2.1, sz: 0.8, yaw: heading, color });
  const cabin = localPoint(x, y, heading, -0.2, 0);
  boxes.push({ x: cabin.x, y: cabin.y, z: 1.35, sx: 2.2, sy: 1.9, sz: 0.55, yaw: heading, color: taxi ? WHITE : BONE });
  const hood = localPoint(x, y, heading, 1.2, 0);
  boxes.push({ x: hood.x, y: hood.y, z: 1.05, sx: 0.7, sy: 1.75, sz: 0.09, yaw: heading, color: INK });
  for (const forward of [-1.35, 1.35]) {
    for (const right of [-1.12, 1.12]) {
      const wheel = localPoint(x, y, heading, forward, right);
      boxes.push({ x: wheel.x, y: wheel.y, z: 0.55, sx: 0.75, sy: 0.24, sz: 0.72, yaw: heading + (forward > 0 ? steering * 0.42 : 0), color: INK });
    }
  }
  if (taxi) {
    boxes.push({ x: cabin.x, y: cabin.y, z: 1.8, sx: 0.82, sy: 0.45, sz: 0.28, yaw: heading, color: YELLOW });
    for (const side of [-0.72, 0.72]) {
      for (const forward of [-0.95, -0.35, 0.25, 0.85]) {
        const check = localPoint(x, y, heading, forward, side);
        boxes.push({ x: check.x, y: check.y, z: 1.0, sx: 0.28, sy: 0.08, sz: 0.22, yaw: heading, color: (Math.round((forward + 1) * 3) + (side > 0 ? 1 : 0)) % 2 ? INK : WHITE });
      }
    }
  }
  for (let index = firstBox; index < boxes.length; index += 1) {
    boxes[index].material = MAT_VEHICLE;
  }
}

const CROWN_ROLL_PIVOT_Z = 1.05;
const CROWN_ROLL_HALF_WIDTH = 1.18;

/** A point fixed to the simulation taxi's rolling body, kept above ground. */
export function crownVehiclePointPose(game: Game, forward: number, right: number, z: number) {
  const roll = game.simulationVehicle.bodyRoll;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const relativeZ = z - CROWN_ROLL_PIVOT_Z;
  const rolledRight = cos * right - sin * relativeZ;
  const rolledZ = sin * right + cos * relativeZ;
  const centerZ = Math.abs(cos) * CROWN_ROLL_PIVOT_Z
    + Math.abs(sin) * CROWN_ROLL_HALF_WIDTH;
  const point = localPoint(game.x, game.y, game.heading, forward, rolledRight);
  return { x: point.x, y: point.y, z: centerZ + rolledZ };
}

/** World-space up direction of the simulation taxi's rolling cabin. */
export function crownVehicleUpVector(game: Game): [number, number, number] {
  const roll = game.simulationVehicle.bodyRoll;
  const rightX = -Math.sin(game.heading);
  const rightY = Math.cos(game.heading);
  const lateral = -Math.sin(roll);
  return [rightX * lateral, rightY * lateral, Math.cos(roll)];
}

function addCrownTaxiBoxes(boxes: Box[], game: Game) {
  const { heading } = game;
  const chassis = game.simulationVehicle;
  const bodyBox = (
    forward: number,
    right: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Color,
    extra: Partial<Box> = {},
  ) => {
    const point = crownVehiclePointPose(game, forward, right, z);
    boxes.push({
      x: point.x,
      y: point.y,
      z: point.z,
      sx,
      sy,
      sz,
      yaw: heading,
      color,
      material: MAT_VEHICLE,
      ...extra,
      pitch: chassis.bodyRoll + (extra.pitch ?? 0),
      tilt: chassis.bodyPitch + (extra.tilt ?? 0),
    });
  };

  bodyBox(0, 0, 0.62, 5.38, 1.98, 0.72, YELLOW);
  bodyBox(1.55, 0, 1.02, 1.72, 1.88, 0.2, YELLOW);
  bodyBox(-1.78, 0, 1.04, 1.25, 1.9, 0.22, YELLOW);
  bodyBox(-0.15, 0, 1.43, 2.72, 1.78, 0.72, YELLOW);
  bodyBox(-0.28, 0, 1.84, 1.72, 1.67, 0.16, YELLOW);

  // Upright fleet-sedan glass and pillars make the Crown cab read differently
  // from the compact arcade taxi at every exterior camera distance.
  bodyBox(0.76, 0, 1.55, 0.11, 1.62, 0.58, STEEL, { tilt: -0.34 });
  bodyBox(-1.02, 0, 1.54, 0.11, 1.62, 0.58, STEEL, { tilt: 0.3 });
  for (const side of [-0.9, 0.9]) {
    bodyBox(0.2, side, 1.5, 1.62, 0.08, 0.5, BLUE);
    bodyBox(-0.33, side, 1.5, 0.1, 0.12, 0.68, INK);
    bodyBox(0.52, side, 0.97, 0.12, 0.09, 0.12, INK);
    bodyBox(-1.0, side, 0.97, 0.12, 0.09, 0.12, INK);
  }

  bodyBox(2.7, 0, 0.57, 0.16, 2.04, 0.18, STEEL);
  bodyBox(-2.7, 0, 0.58, 0.16, 2.04, 0.18, STEEL);
  bodyBox(2.71, 0, 0.82, 0.12, 0.74, 0.22, INK);
  for (const side of [-0.66, 0.66]) {
    bodyBox(2.72, side, 0.84, 0.14, 0.5, 0.24, WHITE);
    bodyBox(-2.72, side, 0.85, 0.14, 0.46, 0.25, RED);
  }

  for (const forward of [-1.63, 1.58]) {
    for (const right of [-1, 1]) {
      const frontWheel = forward > 0;
      const wheel = crownVehiclePointPose(game, forward, right * 0.98, 0.49);
      const wheelYaw = heading + (frontWheel ? chassis.steeringAngle : 0);
      boxes.push({
        x: wheel.x,
        y: wheel.y,
        z: wheel.z,
        sx: 0.8,
        sy: 0.24,
        sz: 0.76,
        yaw: wheelYaw,
        color: INK,
        material: MAT_VEHICLE,
        pitch: chassis.bodyRoll,
        tilt: chassis.bodyPitch,
      });
      boxes.push({
        x: wheel.x,
        y: wheel.y,
        z: wheel.z,
        sx: 0.43,
        sy: 0.27,
        sz: 0.43,
        yaw: wheelYaw,
        color: STEEL,
        material: MAT_VEHICLE,
        pitch: chassis.bodyRoll,
        tilt: chassis.bodyPitch,
      });
    }
  }

  bodyBox(-0.27, 0, 2.08, 0.92, 0.48, 0.27, YELLOW);
  bodyBox(-0.16, 0, 2.1, 0.52, 0.5, 0.09, WHITE);
  for (const side of [-0.91, 0.91]) {
    for (const forward of [-1.02, -0.62, -0.22, 0.18, 0.58]) {
      bodyBox(forward, side, 0.92, 0.21, 0.07, 0.18, Math.round((forward + 1.1) * 5) % 2 ? INK : WHITE);
    }
  }
}

/** Basic opaque 3D cockpit geometry, drawn only by the cab camera. */
export function cabInteriorBoxes(game: Game) {
  if (!isDriving(game)) return [];
  const boxes: Box[] = [];
  const { heading } = game;
  const driverRight = -0.46;
  const add = (
    forward: number,
    right: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Color,
    extra: Partial<Box> = {},
  ) => {
    const point = crownVehiclePointPose(game, forward, right, z);
    boxes.push({
      x: point.x,
      y: point.y,
      z: point.z,
      sx,
      sy,
      sz,
      yaw: heading,
      color,
      material: MAT_VEHICLE,
      ...extra,
      pitch: game.simulationVehicle.bodyRoll + (extra.pitch ?? 0),
      tilt: game.simulationVehicle.bodyPitch + (extra.tilt ?? 0),
    });
  };

  add(0.84, 0, 1.2, 0.72, 1.9, 0.32, INK, { tilt: -0.08 });
  add(1.35, 0, 1.01, 1.35, 1.94, 0.16, YELLOW, { tilt: -0.03 });
  add(0.45, -0.88, 1.69, 0.18, 0.16, 1.05, INK, { tilt: -0.16 });
  add(0.45, 0.88, 1.69, 0.18, 0.16, 1.05, INK, { tilt: 0.16 });
  add(0.39, 0, 2.09, 0.2, 1.92, 0.16, INK);
  add(0.48, 0, 1.11, 0.16, 1.88, 0.13, STEEL);
  add(0.58, driverRight, 1.38, 0.18, 0.66, 0.31, STEEL, { tilt: -0.08 });
  add(0.55, driverRight, 1.4, 0.1, 0.5, 0.2, INK, { tilt: -0.08 });
  add(0.58, 0.39, 1.35, 0.16, 0.45, 0.32, INK, { tilt: -0.08 });
  add(0.48, 0, 1.93, 0.12, 0.62, 0.25, INK);
  add(0.46, 0, 1.93, 0.08, 0.48, 0.15, STEEL);
  add(-0.04, -0.93, 1.1, 1.9, 0.15, 0.25, INK);
  add(-0.04, 0.93, 1.1, 1.9, 0.15, 0.25, INK);

  const wheelCenterForward = 0.47;
  const wheelCenterZ = 1.25;
  const wheelRadius = 0.25;
  const steeringRotation = game.drivingModel === "simulation"
    ? game.simulationVehicle.steeringAngle * 1.7 : game.steering * 0.85;
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2 + steeringRotation;
    add(
      wheelCenterForward,
      driverRight + Math.cos(angle) * wheelRadius,
      wheelCenterZ + Math.sin(angle) * wheelRadius,
      0.08,
      0.24,
      0.07,
      INK,
      { pitch: angle },
    );
  }
  add(wheelCenterForward, driverRight, wheelCenterZ, 0.1, 0.48, 0.07, INK, { pitch: steeringRotation });
  add(wheelCenterForward, driverRight, wheelCenterZ, 0.1, 0.08, 0.48, INK, { pitch: steeringRotation });
  placeBoxesOnRoad(boxes, 0, taxiRoadPose(game));
  return boxes;
}

export function routeBoxes(
  game: Game,
  route: readonly WorldPoint[] = buildGpsRoute(game, getNavigationTarget(game)),
) {
  if (!isDriving(game)) return [];
  const boxes: Box[] = [];
  const color = game.customDestination
    ? YELLOW
    : game.activeCourier
    ? game.activeCourier.stage === "pickup" ? ORANGE : PINK
    : game.onboard ? RED : CYAN;
  const dashSpacing = Math.max(11, routeLength(route) / 118);
  let nextDash = 6;
  let traversed = 0;
  for (let index = 1; index < route.length && boxes.length < 120; index += 1) {
    const a = route[index - 1];
    const b = route[index];
    const segment = distance(a, b);
    if (segment < 0.05) continue;
    const yaw = Math.atan2(b.y - a.y, b.x - a.x);
    while (nextDash <= traversed + segment && boxes.length < 120) {
      const t = (nextDash - traversed) / segment;
      boxes.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t + 0.75,
        screenLift: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t,
        sx: 2.8,
        sy: 0.48,
        sz: 0.1,
        yaw,
        color,
        material: MAT_ROUTE,
      });
      nextDash += dashSpacing;
    }
    traversed += segment;
  }
  return boxes;
}

export function taxiGroundShadow(game: Game) {
  if (isInterior(game)) return null;
  const shadow = vehicleGroundShadow(game.x, game.y, game.heading,
    game.drivingModel === "simulation" ? 5.75 : 5.2,
    game.drivingModel === "simulation" ? 2.35 : 2.7);
  const height = groundAt(game, 0.85).height;
  shadow.z += height;
  shadow.screenLift = height;
  return shadow;
}

export function taxiBoxes(game: Game, options: { includeGroundShadow?: boolean } = {}) {
  if (isInterior(game)) return [];
  const boxes: Box[] = [];
  if (options.includeGroundShadow !== false) boxes.push(taxiGroundShadow(game)!);
  const vehicleStart = boxes.length;
  if (game.drivingModel === "simulation") addCrownTaxiBoxes(boxes, game);
  else addCarBoxes(boxes, game.x, game.y, game.heading, YELLOW, true, false, game.steering);
  if (game.activeCourier?.stage === "dropoff" && game.activeCourier.loadedInTaxi) {
    const parcel = game.drivingModel === "simulation"
      ? crownVehiclePointPose(game, -0.25, 0, 2.17)
      : { ...localPoint(game.x, game.y, game.heading, -0.25, 0), z: 2.17 };
    const ribbon = game.drivingModel === "simulation"
      ? crownVehiclePointPose(game, -0.25, 0, 2.5)
      : { ...localPoint(game.x, game.y, game.heading, -0.25, 0), z: 2.5 };
    const bodyAttitude = game.drivingModel === "simulation"
      ? { pitch: game.simulationVehicle.bodyRoll, tilt: game.simulationVehicle.bodyPitch }
      : {};
    boxes.push({ ...parcel, sx: 0.9, sy: 0.72, sz: 0.55, yaw: game.heading + Math.PI / 4, color: ORANGE, material: MAT_MARKER, ...bodyAttitude });
    boxes.push({ ...ribbon, sx: 0.62, sy: 0.08, sz: 0.08, yaw: game.heading, color: PINK, material: MAT_MARKER, ...bodyAttitude });
  }
  placeBoxesOnRoad(boxes, vehicleStart, taxiRoadPose(game));
  return boxes;
}

/** Shared WebGPU/Canvas afterburner geometry. Presentation only: boost physics
 * remains deterministic and renderer-independent. */
export function boostTrailBoxes(game: Game, seconds: number) {
  if (!isDriving(game) || !game.boosting) return [];
  const boxes: Box[] = [];
  const pulse = 0.82 + Math.sin(seconds * 46) * 0.18;
  for (const side of [-1, 1]) {
    const core = localPoint(game.x, game.y, game.heading, -2.7, side * 0.68);
    boxes.push({
      x: core.x,
      y: core.y,
      z: 0.56,
      sx: 1.65 * pulse,
      sy: 0.28,
      sz: 0.28,
      yaw: game.heading,
      color: side > 0 ? WHITE : YELLOW,
      material: MAT_MARKER,
    });
    for (let segment = 0; segment < 4; segment += 1) {
      const point = localPoint(
        game.x,
        game.y,
        game.heading,
        -3.65 - segment * 1.05,
        side * (0.68 + segment * 0.08),
      );
      boxes.push({
        x: point.x,
        y: point.y,
        z: 0.45 - segment * 0.045,
        sx: (1.18 - segment * 0.13) * pulse,
        sy: 0.22 + segment * 0.035,
        sz: 0.2,
        yaw: game.heading,
        color: segment % 3 === 0 ? CYAN : segment % 3 === 1 ? YELLOW : RED,
        material: MAT_MARKER,
      });
    }
  }
  placeBoxesOnRoad(boxes, 0, taxiRoadPose(game));
  return boxes;
}

/** Renderer-neutral particle geometry shared by WebGPU and Canvas fallback. */
export function particleBoxes(game: Game, seconds: number) {
  return game.particles.map((particle) => ({
    x: particle.x,
    y: particle.y,
    z: (particle.z ?? 0) + 0.25,
    screenLift: particle.z ?? 0,
    sx: 0.28 + particle.life * 0.45,
    sy: 0.28 + particle.life * 0.45,
    sz: 0.12,
    yaw: seconds,
    color: particle.color,
  }));
}

export function playerAvatarBoxes(game: Game, seconds = 0) {
  if (game.player.kind !== "walking") return [];
  const { actor } = game.player;
  const motion = walkingMotion(actor);
  const boxes: Box[] = [];
  const animate = seconds !== 0;
  const grounded = motion.grounded;
  const crouch = motion.crouchAmount;
  const speedMix = clamp(actor.speed / WALKING_TUNING.runSpeed, 0, 1);
  const runMix = motion.action === "run" ? 1 : 0;
  const phase = animate ? motion.gaitPhase : 0;
  const strideAmplitude = grounded
    ? (0.18 + runMix * 0.18) * speedMix * (1 - crouch * 0.48)
    : 0;
  const stride = Math.sin(phase) * strideAmplitude;
  const tuck = grounded ? 0 : clamp(Math.abs(motion.verticalSpeed) / WALKING_TUNING.jumpImpulse, 0.18, 1);
  const landing = animate ? motion.landingImpact : 0;
  const bodyBob = grounded && animate
    ? Math.abs(Math.sin(phase)) * 0.045 * speedMix
    : 0;
  const runLean = animate ? runMix * 0.11 * speedMix : 0;
  const turnShift = (animate ? motion.turnLean : 0) * 0.06;
  const part = (forward: number, right: number) => localPoint(
    actor.x,
    actor.y,
    actor.heading,
    forward,
    right,
  );
  const body = (
    forward: number,
    right: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Color,
    options: Pick<Box, "pitch" | "tilt"> = {},
  ) => {
    const point = part(forward, right);
    boxes.push({
      x: point.x,
      y: point.y,
      z: motion.elevation + z,
      sx,
      sy,
      sz,
      yaw: actor.heading,
      pitch: options.pitch,
      tilt: options.tilt,
      screenLift: motion.elevation,
      color,
      material: MAT_PLAYER,
    });
  };

  for (const side of [-1, 1]) {
    const stepLift = grounded && animate
      ? Math.max(0, Math.cos(phase + (side > 0 ? Math.PI : 0))) * 0.1 * speedMix
      : 0;
    const footForward = stride * side + crouch * 0.1;
    body(footForward, side * 0.22, 0.11 + stepLift + tuck * 0.14, 0.48, 0.31, 0.2, INK);
    body(footForward * 0.62, side * 0.21, 0.4 + stepLift * 0.5 + tuck * 0.1 - crouch * 0.05, 0.29, 0.29, 0.48, BLUE, {
      tilt: -stride * side * 1.8 + crouch * 0.32,
    });
    body(footForward * 0.2, side * 0.2, 0.72 + bodyBob - crouch * 0.16, 0.34, 0.32, 0.5, BLUE, {
      tilt: stride * side * 1.15 - crouch * 0.42,
    });
  }

  body(runLean * 0.25, turnShift, 0.95 + bodyBob - crouch * 0.28 - landing * 0.07, 0.56, 0.55, 0.3, INK);
  body(runLean * 0.3, turnShift, 1.04 + bodyBob - crouch * 0.31 - landing * 0.08, 0.62, 0.59, 0.12, YELLOW);
  body(runLean, turnShift, 1.34 + bodyBob - crouch * 0.49 - landing * 0.11, 0.7, 0.72, 0.7, RED, {
    tilt: -runLean * 1.6,
  });
  body(0.37 + runLean, turnShift, 1.35 + bodyBob - crouch * 0.49 - landing * 0.11, 0.09, 0.58, 0.27, CYAN, {
    tilt: -runLean * 1.6,
  });
  body(runLean * 0.9, turnShift, 1.61 + bodyBob - crouch * 0.55 - landing * 0.11, 0.58, 0.91, 0.18, RED, {
    tilt: -runLean * 1.6,
  });

  for (const side of [-1, 1]) {
    const armSwing = -stride * side * (1.7 + runMix * 0.65);
    const airborneLift = grounded ? 0 : 0.22 + tuck * 0.16;
    body(armSwing * 0.14 + runLean, side * 0.52 + turnShift, 1.43 + bodyBob - crouch * 0.48 + airborneLift, 0.28, 0.31, 0.48, RED, {
      tilt: armSwing + (grounded ? 0 : -0.45),
    });
    body(armSwing * 0.28 + runLean, side * 0.53 + turnShift, 1.1 + bodyBob - crouch * 0.42 + airborneLift, 0.25, 0.28, 0.43, RED, {
      tilt: armSwing * 0.76 + (grounded ? 0 : -0.58),
    });
    body(armSwing * 0.37 + runLean, side * 0.53 + turnShift, 0.87 + bodyBob - crouch * 0.36 + airborneLift, 0.24, 0.25, 0.24, PAPER);
  }

  body(0.03 + runLean, turnShift, 1.73 + bodyBob - crouch * 0.6 - landing * 0.11, 0.24, 0.25, 0.18, PAPER);
  body(0.05 + runLean, turnShift, 1.98 + bodyBob - crouch * 0.69 - landing * 0.12, 0.51, 0.53, 0.5, PAPER, {
    tilt: -runLean * 1.2,
  });
  body(-0.02 + runLean, turnShift, 2.2 + bodyBob - crouch * 0.73 - landing * 0.12, 0.53, 0.55, 0.15, INK, {
    tilt: -runLean * 1.2,
  });
  body(0.01 + runLean, turnShift, 2.3 + bodyBob - crouch * 0.75 - landing * 0.12, 0.61, 0.6, 0.14, YELLOW, {
    tilt: -runLean,
  });
  body(0.34 + runLean, turnShift, 2.25 + bodyBob - crouch * 0.74 - landing * 0.12, 0.32, 0.62, 0.08, YELLOW, {
    tilt: -runLean,
  });
  body(0.31 + runLean, turnShift, 1.98 + bodyBob - crouch * 0.69 - landing * 0.12, 0.12, 0.15, 0.16, INK);

  if (game.activeCourier?.stage === "dropoff" && !game.activeCourier.loadedInTaxi) {
    const parcel = part(0.62, 0);
    const parcelZ = motion.elevation + 1.3 + bodyBob - crouch * 0.46;
    boxes.push({ x: parcel.x, y: parcel.y, z: parcelZ, sx: 0.78, sy: 0.72, sz: 0.68, yaw: actor.heading + Math.PI / 4, screenLift: motion.elevation, color: ORANGE, material: MAT_MARKER });
    boxes.push({ x: parcel.x, y: parcel.y, z: parcelZ + 0.37, sx: 0.55, sy: 0.08, sz: 0.08, yaw: actor.heading, screenLift: motion.elevation, color: PINK, material: MAT_MARKER });
  }
  return boxes;
}

export function interactionMarkerBoxes(game: Game, world: WorldView, seconds: number) {
  if (game.player.kind !== "walking") return [];
  const pose = controlledPose(game);
  const interactions = world.interactions
    .filter((interaction) => distance(pose, interaction) < 48)
    .sort((a, b) => distance(pose, a) - distance(pose, b))
    .slice(0, 6);
  const boxes: Box[] = [];
  for (const interaction of interactions) {
    const active = distance(pose, interaction) <= interaction.radius;
    const homeEntrance = interaction.kind === "venue-entrance" && interaction.venue.kind === "home";
    const gasMarker = (interaction.kind === "service" && interaction.serviceId === "gas-counter")
      || (interaction.kind === "venue-entrance" && interaction.venue.kind === "gas");
    const color = interaction.kind === "courier-counter" || gasMarker
      ? ORANGE
      : interaction.kind === "service" ? PINK : homeEntrance || active ? YELLOW : CYAN;
    const pulse = 1 + Math.sin(seconds * 6 + interaction.x * 0.1) * 0.12;
    boxes.push({ x: interaction.x, y: interaction.y, z: (interaction.z ?? 0) + 1.5, screenLift: interaction.z ?? 0, sx: 0.25, sy: 0.25, sz: 2.1, yaw: 0, color, material: MAT_MARKER });
    boxes.push({ x: interaction.x, y: interaction.y, z: (interaction.z ?? 0) + 2.85, screenLift: interaction.z ?? 0, sx: 1.5 * pulse, sy: 1.5 * pulse, sz: 0.22, yaw: seconds, color: INK, material: MAT_MARKER });
    boxes.push({ x: interaction.x, y: interaction.y, z: (interaction.z ?? 0) + 3.02, screenLift: interaction.z ?? 0, sx: 1.2 * pulse, sy: 1.2 * pulse, sz: 0.18, yaw: seconds, color, material: MAT_MARKER });
  }
  return boxes;
}

const PEDESTRIAN_LOOP_EDGE = 11.1;
const PEDESTRIAN_LANE_OFFSET = 0.2;
const pedestrianBlockWalkability = new Map<string, boolean>();

/**
 * Ambient walkers use the perimeter of a normal city lot. Special-road
 * corridor blocks replace that lot and sidewalk with a highway, ramp,
 * boulevard, parkway, or roundabout verge. Landmark campuses and regional
 * macro-campuses publish their own people and obstacles. Neither can host the
 * generic loop.
 */
export function isPedestrianBlockWalkable(blockX: number, blockY: number) {
  const key = `${blockX},${blockY}`;
  const cached = pedestrianBlockWalkability.get(key);
  if (cached !== undefined) return cached;
  const center = {
    x: blockX * ROAD_SPACING + ROAD_SPACING / 2,
    y: blockY * ROAD_SPACING + ROAD_SPACING / 2,
  };
  const walkable = isActiveBlock(blockX, blockY)
    && !landmarkTileForBlock(blockX, blockY)
    && !campusTileForBlock(blockX, blockY)
    && !specialRoadIntersectsSquare(center, 12, 1.5);
  pedestrianBlockWalkability.set(key, walkable);
  return walkable;
}

export function ambientPedestrianPointForBlock(
  blockX: number,
  blockY: number,
  seconds: number,
  pedestrianIndex = 0,
) {
  const signature = (Math.imul(blockX + 79, 73856093) ^ Math.imul(blockY - 43, 19349663)) >>> 0;
  const regionId = regionForBlock(blockX, blockY)?.id;
  if (regionId === "cedar-vale") return residentialPedestrianPoint(blockX, blockY, seconds, pedestrianIndex);
  if (regionId === "cypress-reach") return isPedestrianBlockWalkable(blockX, blockY)
    ? reachPedestrianPoint(blockX, blockY, seconds, pedestrianIndex) : null;
  const northstar = regionId === "northstar-range";
  const copperMesa = regionId === "copper-mesa";
  const localCount = northstar
    ? northstarPedestrianCountForBlock(blockX, blockY)
    : copperMesa
      ? copperMesaPedestrianCountForBlock(blockX, blockY)
      : regionId === "solana-coast"
          ? coastalPedestrianCountForBlock(blockX, blockY)
          : AMBIENT_PEDESTRIANS_PER_BLOCK;
  const populatedChance = northstar
    ? localCount >= 6 ? 88 : localCount >= 5 ? 68 : localCount >= 3 ? 50 : 28
    : copperMesa
      ? localCount >= 6 ? 84 : localCount >= 4 ? 58 : localCount >= 3 ? 42 : 24
      : 74;
  if (signature % 100 >= populatedChance || !isPedestrianBlockWalkable(blockX, blockY)) return null;
  const centerX = blockX * ROAD_SPACING + ROAD_SPACING / 2;
  const centerY = blockY * ROAD_SPACING + ROAD_SPACING / 2;
  const pedestrianSlot = ((Math.trunc(pedestrianIndex) % AMBIENT_PEDESTRIANS_PER_BLOCK)
    + AMBIENT_PEDESTRIANS_PER_BLOCK) % AMBIENT_PEDESTRIANS_PER_BLOCK;
  if (pedestrianSlot >= localCount) return null;
  if (regionId === "solana-coast" && coastCanalBlock(blockX, blockY)) {
    return atTerrainElevation({ x: centerX + (pedestrianSlot % 2 ? 8.2 : -8.2),
      y: centerY + Math.sin(seconds * 0.2 + pedestrianSlot * 2 + signature % 17) * 8, z: 0 });
  }
  const loopEdge = PEDESTRIAN_LOOP_EDGE
    + (pedestrianSlot % 2 === 0 ? -PEDESTRIAN_LANE_OFFSET : PEDESTRIAN_LANE_OFFSET);
  const spacing = (pedestrianSlot * 4) / localCount;
  const loop = (seconds * (0.22 + (signature % 5) * 0.025) + (signature % 997) / 249.25 + spacing) % 4;
  const progress = loop % 1;
  let x = centerX;
  let y = centerY;
  if (loop < 1) {
    x += -loopEdge + loopEdge * 2 * progress;
    y -= loopEdge;
  } else if (loop < 2) {
    x += loopEdge;
    y += -loopEdge + loopEdge * 2 * progress;
  } else if (loop < 3) {
    x += loopEdge - loopEdge * 2 * progress;
    y += loopEdge;
  } else {
    x -= loopEdge;
    y += loopEdge - loopEdge * 2 * progress;
  }
  return atTerrainElevation({ x, y, z: 0 });
}

export function ambientPeopleBoxes(game: Game, seconds: number, focus: Vec2 = game) {
  const boxes: Box[] = [];
  const colors = [RED, ORANGE, PINK, BLUE, WHITE, BRICK] as const;
  const centerBlockX = Math.floor(focus.x / ROAD_SPACING);
  const centerBlockY = Math.floor(focus.y / ROAD_SPACING);
  const activeBlocks = new Set<string>();
  let personIndex = 0;
  for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      const blockX = clamp(centerBlockX + offsetX, WORLD_BLOCK_MIN_X, WORLD_BLOCK_MAX_X);
      const blockY = clamp(centerBlockY + offsetY, WORLD_BLOCK_MIN_Y, WORLD_BLOCK_MAX_Y);
      const key = `${blockX},${blockY}`;
      if (activeBlocks.has(key)) continue;
      activeBlocks.add(key);
      for (let pedestrianIndex = 0; pedestrianIndex < AMBIENT_PEDESTRIANS_PER_BLOCK; pedestrianIndex += 1) {
        const point = ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrianIndex);
        if (!point) continue;
        const { x, y, z } = point;
        boxes.push({ x, y, z: z + 1.05, screenLift: z, sx: 0.52, sy: 0.38, sz: 1.25, yaw: 0, color: colors[personIndex % colors.length], material: MAT_PERSON });
        boxes.push({ x, y, z: z + 1.82, screenLift: z, sx: 0.48, sy: 0.48, sz: 0.48, yaw: 0, color: PAPER, material: MAT_PERSON });
        personIndex += 1;
      }
    }
  }
  return boxes;
}

const FARE_COLORS: readonly Color[] = [RED, PINK, BLUE, ORANGE, CYAN, BRICK, YELLOW, WHITE];
const FARE_ACCENTS: readonly Color[] = [YELLOW, CYAN, PINK, WHITE, ORANGE, RED, BLUE, PAPER];
const FARE_SKIN_TONES: readonly Color[] = [
  [0.98, 0.78, 0.61, 1],
  [0.89, 0.64, 0.46, 1],
  [0.75, 0.47, 0.31, 1],
  [0.58, 0.34, 0.22, 1],
  [0.4, 0.22, 0.15, 1],
  [0.27, 0.14, 0.1, 1],
];
const FARE_HAIR_COLORS: readonly Color[] = [
  INK,
  BRICK,
  [0.22, 0.12, 0.07, 1],
  [0.53, 0.32, 0.12, 1],
  [0.74, 0.69, 0.61, 1],
  WHITE,
];
const FARE_TROUSER_COLORS: readonly Color[] = [INK, BLUE, BRICK, [0.2, 0.28, 0.32, 1]];

export type FarePassengerAppearance = {
  outfit: Color;
  accent: Color;
  skin: Color;
  hair: Color;
  trousers: Color;
  bagSide: -1 | 1;
};

const FARE_APPEARANCE_CACHE = new Map<number, FarePassengerAppearance>();

/** Stable low-poly colors and accessories keyed to the portrait identity. */
export function farePassengerAppearance(artCell: number): FarePassengerAppearance {
  const identity = Math.max(0, Math.floor(artCell));
  const cached = FARE_APPEARANCE_CACHE.get(identity);
  if (cached) return cached;
  const appearance = Object.freeze({
    outfit: FARE_COLORS[identity % FARE_COLORS.length],
    accent: FARE_ACCENTS[(identity * 5 + Math.floor(identity / 8) + 1) % FARE_ACCENTS.length],
    skin: FARE_SKIN_TONES[(identity * 5 + Math.floor(identity / 6)) % FARE_SKIN_TONES.length],
    hair: FARE_HAIR_COLORS[(identity * 7 + Math.floor(identity / 4)) % FARE_HAIR_COLORS.length],
    trousers: FARE_TROUSER_COLORS[(identity * 3 + Math.floor(identity / 8)) % FARE_TROUSER_COLORS.length],
    bagSide: (identity % 2 === 0 ? -1 : 1) as -1 | 1,
  });
  FARE_APPEARANCE_CACHE.set(identity, appearance);
  return appearance;
}

function farePassengerPose(job: Job) {
  return {
    x: job.pickup.x,
    y: job.pickup.y,
    z: job.pickup.z ?? 0,
    yaw: Math.atan2(
      job.pickupApproach.y - job.pickup.y,
      job.pickupApproach.x - job.pickup.x,
    ),
  };
}

export function farePassengerPoint(job: Job) {
  return { ...job.pickup };
}

export function farePassengerPalette(index: number) {
  const appearance = farePassengerAppearance(index);
  return {
    outfit: appearance.outfit,
    accent: appearance.accent,
  };
}

/** A readable, fare-specific person rather than the old two-cube pedestrian. */
export function farePassengerBoxes(job: Job, index: number, seconds: number) {
  const boxes: Box[] = [];
  const point = farePassengerPose(job);
  const yaw = point.yaw;
  const appearance = farePassengerAppearance(job.passengerArtCell);
  const { outfit, accent, skin, hair, trousers, bagSide } = appearance;
  const wave = Math.sin(seconds * 4.2 + job.passengerArtCell * 1.7) * 0.1;
  const bodyPart = (forward: number, right: number) => localPoint(point.x, point.y, yaw, forward, right);

  for (const right of [-0.3, 0.3]) {
    const shoe = bodyPart(0.04, right);
    boxes.push({ x: shoe.x, y: shoe.y, z: 0.16, sx: 0.55, sy: 0.32, sz: 0.26, yaw, color: INK, material: MAT_PERSON });
    const leg = bodyPart(0, right);
    boxes.push({ x: leg.x, y: leg.y, z: 0.68, sx: 0.38, sy: 0.38, sz: 0.9, yaw, color: trousers, material: MAT_PERSON });
  }
  boxes.push({ x: point.x, y: point.y, z: 1.35, sx: 0.9, sy: 0.62, sz: 0.82, yaw, color: outfit, material: MAT_PERSON });
  boxes.push({ x: point.x, y: point.y, z: 1.38, sx: 0.96, sy: 0.68, sz: 0.16, yaw, color: accent, material: MAT_PERSON });
  const leftArm = bodyPart(0, -0.66);
  boxes.push({ x: leftArm.x, y: leftArm.y, z: 1.42, sx: 0.3, sy: 0.3, sz: 0.9, yaw, color: outfit, material: MAT_PERSON });
  const wavingArm = bodyPart(wave, 0.67);
  boxes.push({ x: wavingArm.x, y: wavingArm.y, z: 1.72 + wave, sx: 0.3, sy: 0.3, sz: 1.05, yaw, pitch: 0.42, color: outfit, material: MAT_PERSON });
  boxes.push({ x: point.x, y: point.y, z: 2.08, sx: 0.62, sy: 0.58, sz: 0.62, yaw, color: skin, material: MAT_PERSON });
  boxes.push({ x: point.x, y: point.y, z: 2.39, sx: 0.69, sy: 0.64, sz: 0.18, yaw, color: hair, material: MAT_PERSON });
  const bag = bodyPart(-0.08, bagSide * 0.82);
  boxes.push({ x: bag.x, y: bag.y, z: 0.72, sx: 0.48, sy: 0.28, sz: 0.72, yaw, color: accent, material: MAT_PERSON });
  for (const box of boxes) { box.z += point.z; box.screenLift = point.z; }
  return boxes;
}

function addObjectiveRing(
  boxes: Box[],
  point: WorldPoint,
  seconds: number,
  color: Color,
  direction: number,
  segments = 14,
) {
  const pulse = 1 + Math.sin(seconds * 6) * 0.12;
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2 + seconds * direction;
    boxes.push({
      x: point.x + Math.cos(angle) * 4.1 * pulse,
      y: point.y + Math.sin(angle) * 4.1 * pulse,
      z: (point.z ?? 0) + 0.38,
      screenLift: point.z ?? 0,
      sx: 1.3,
      sy: 0.42,
      sz: 0.32,
      yaw: angle + Math.PI / 2,
      color,
      material: MAT_MARKER,
    });
  }
}

export function farePresentationBoxes(game: Game, seconds: number) {
  const boxes: Box[] = [];
  if (game.passengerReview && game.elapsed < game.passengerReview.until) {
    const job = game.passengerReview.job;
    boxes.push(...farePassengerBoxes({ ...job, pickup: game.passengerReview.point, pickupApproach: job.dropoffApproach }, 0, seconds));
  }
  for (const { index, job } of waitingFares(game)) {
    addObjectiveRing(boxes, job.pickup, seconds, CYAN, 1.05, 12);
    boxes.push(...farePassengerBoxes(job, index, seconds));
    if (!game.onboard && index === game.jobIndex) {
      boxes.push({ x: job.pickup.x, y: job.pickup.y, z: (job.pickup.z ?? 0) + 3.15, screenLift: job.pickup.z ?? 0, sx: 0.42, sy: 0.42, sz: 5.8, yaw: 0, color: CYAN, material: MAT_MARKER });
      boxes.push({ x: job.pickup.x, y: job.pickup.y, z: (job.pickup.z ?? 0) + 6.25, screenLift: job.pickup.z ?? 0, sx: 2.6, sy: 2.6, sz: 0.35, yaw: seconds, color: WHITE, material: MAT_MARKER });
    }
  }
  if (game.onboard) {
    const target = getObjective(game);
    addObjectiveRing(boxes, target, seconds, RED, -1.2);
    boxes.push({ x: target.x, y: target.y, z: (target.z ?? 0) + 3.15, screenLift: target.z ?? 0, sx: 0.42, sy: 0.42, sz: 5.8, yaw: 0, color: RED, material: MAT_MARKER });
    boxes.push({ x: target.x, y: target.y, z: (target.z ?? 0) + 6.25, screenLift: target.z ?? 0, sx: 2.6, sy: 2.6, sz: 0.35, yaw: seconds, color: YELLOW, material: MAT_MARKER });
  }
  return boxes;
}

export function courierPresentationBoxes(game: Game, seconds: number) {
  if (!game.activeCourier || isInterior(game)) return [];
  const target = getObjective(game);
  const color = game.activeCourier.stage === "pickup" ? ORANGE : PINK;
  const boxes: Box[] = [];
  addObjectiveRing(boxes, target, seconds, color, game.activeCourier.stage === "pickup" ? 1.15 : -1.25, 16);
  boxes.push({ x: target.x, y: target.y, z: (target.z ?? 0) + 3.45, screenLift: target.z ?? 0, sx: 0.48, sy: 0.48, sz: 6.4, yaw: 0, color, material: MAT_MARKER });
  boxes.push({ x: target.x, y: target.y, z: (target.z ?? 0) + 6.8, screenLift: target.z ?? 0, sx: 2.8, sy: 2.8, sz: 0.4, yaw: seconds, color: INK, material: MAT_MARKER });
  boxes.push({ x: target.x, y: target.y, z: (target.z ?? 0) + 7.08, screenLift: target.z ?? 0, sx: 2.15, sy: 2.15, sz: 0.34, yaw: seconds, color, material: MAT_MARKER });
  return boxes;
}

export function dynamicBoxes(
  game: Game,
  seconds: number,
  route: readonly WorldPoint[] = buildGpsRoute(game, getNavigationTarget(game)),
  world?: WorldView,
  options: { showPlayerAvatar?: boolean } = {},
) {
  const showPlayerAvatar = options.showPlayerAvatar !== false;
  const boxes: Box[] = routeBoxes(game, route);
  if (isInterior(game)) {
    if (showPlayerAvatar) boxes.push(...playerAvatarBoxes(game, seconds));
    if (world) boxes.push(...interactionMarkerBoxes(game, world, seconds));
    return boxes;
  }
  for (const car of game.traffic) {
    if (game.elapsed >= car.activeAt) {
      const start = boxes.length;
      addCarBoxes(
        boxes,
        car.x,
        car.y,
        car.heading,
        car.color,
      );
      placeBoxesOnRoad(boxes, start, { x: car.x, y: car.y, heading: car.heading,
        z: car.z ?? 0, pitch: car.pitch ?? 0, roll: car.roll ?? 0 });
    }
  }

  boxes.push(...boostTrailBoxes(game, seconds));
  boxes.push(...mountainAnimatedBoxes(seconds, controlledPose(game)));
  boxes.push(...copperAnimatedBoxes(seconds, controlledPose(game)));
  boxes.push(...coastAnimatedBoxes(seconds, controlledPose(game)));
  boxes.push(...reachAnimatedBoxes(seconds, controlledPose(game)));

  boxes.push(...ambientPeopleBoxes(game, seconds, controlledPose(game)));

  boxes.push(...particleBoxes(game, seconds));

  boxes.push(...farePresentationBoxes(game, seconds));
  boxes.push(...courierPresentationBoxes(game, seconds));
  if (showPlayerAvatar) boxes.push(...playerAvatarBoxes(game, seconds));
  if (world) boxes.push(...interactionMarkerBoxes(game, world, seconds));

  return boxes;
}
