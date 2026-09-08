import assert from "node:assert/strict";
import test from "node:test";

import {
  MAT_MARKER,
  MAT_GENERIC,
  MAT_PLAYER,
  MAT_TURN,
  chaseCameraPreset,
} from "../../game/config";
import type { Box, Camera, CameraMode, NavigationPlan } from "../../game/model";
import { localPoint } from "../../game/math";
import { cabViewMatrix } from "../../game/render/cab-camera";
import { renderTargetSize } from "../../game/render/resolution";
import { groundShadowOffset, litSurfaceColor } from "../../game/render/lighting";
import { makeWalkingActor } from "../../game/player";
import { makeGame } from "../../game/state";
import {
  GHOST_INSTANCE_CAPACITY,
  NAVIGATION_INSTANCE_CAPACITY,
  INSTANCE_FIELD_OFFSET_BYTES,
  INSTANCE_FLOATS,
  cubeVertices,
  packBoxes,
} from "../../game/render/packing";
import { navigationArrowBoxes } from "../../game/render/navigation-glyph";
import {
  effectiveCameraMode,
  lookAt,
  perspectiveSkyView,
  shouldRenderPlayerAvatar,
  shouldRenderTaxi,
} from "../../game/render/camera";
import {
  boostTrailBoxes,
  cabInteriorBoxes,
  crownVehiclePointPose,
  crownVehicleUpVector,
  particleBoxes,
  playerAvatarBoxes,
  taxiBoxes,
  taxiGroundShadow,
} from "../../game/render/scene";

function approximate(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} was not within ${epsilon} of ${expected}`);
}

test("render targets keep their pixel and device limits even below native resolution", () => {
  for (const budget of [1800000, 2500000]) {
    for (const [width, height, dpr] of [[1920, 1080, 1], [3840, 2160, 2], [7680, 4320, 2], [390, 844, 3], [1, 1, 1]]) {
      const target = renderTargetSize(width, height, dpr, budget);
      assert.ok(target.width * target.height <= budget);
      assert.ok(target.width >= 1 && target.height >= 1);
      assert.ok(target.scale <= 2 && target.scale <= dpr);
      assert.ok(Math.abs(target.width / target.height - width / height) < 0.01);
    }
  }
  assert.ok(renderTargetSize(3840, 2160, 1, 2500000).scale < 1);
  const wide = renderTargetSize(10000, 100, 2, 2500000, 4096);
  assert.equal(wide.width, 4096);
  assert.ok(wide.height <= 4096);
  assert.deepEqual(renderTargetSize(800, 600, 1, 2500000), { width: 800, height: 600, scale: 1 });
});

test("taxi ground shadow stays flat and is excluded from body-only silhouettes", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 410, "free-run", model);
    const reference = taxiGroundShadow(game)!;
    for (const roll of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      game.simulationVehicle.bodyRoll = roll;
      game.simulationVehicle.bodyPitch = 0.25;
      assert.deepEqual(taxiGroundShadow(game), reference);
      const full = taxiBoxes(game);
      const body = taxiBoxes(game, { includeGroundShadow: false });
      assert.deepEqual(full, [reference, ...body]);
      assert.ok(full.length <= GHOST_INSTANCE_CAPACITY);
      assert.equal(reference.pitch ?? 0, 0);
      assert.equal(reference.tilt ?? 0, 0);
    }
    game.player = { kind: "walking", actor: makeWalkingActor({ x: game.x, y: game.y, heading: 0, vx: 0, vy: 0, speed: 0 }), location: { kind: "city" } };
    assert.deepEqual(taxiGroundShadow(game), reference, "parked shadow survives exit");
  }
});

test("graphic light preserves dark color detail and fixes shadows in world space", () => {
  const dark = litSurfaceColor([0.035, 0.035, 0.035, 1], 0, 0, 1);
  assert.ok(dark.slice(0, 3).every((channel) => channel > 0 && channel < 0.06));
  const lit = litSurfaceColor([0.6, 0.6, 0.6, 1], 1, 0, 0);
  const shaded = litSurfaceColor([0.6, 0.6, 0.6, 1], -1, 0, 0);
  assert.ok(lit[0] > shaded[0]);
  assert.ok(shaded[2] > shaded[0], "cool ambient fill");
  const shadow = groundShadowOffset(100);
  assert.ok(shadow.x < 0 && shadow.y < 0);
  approximate(Math.hypot(shadow.x, shadow.y), 1.1);
  approximate(shadow.x / shadow.y, 0.64 / 0.22);
});

test("GPU instance packing has one explicit, stable layout", () => {
  const packed = packBoxes([{
    x: 1,
    y: 2,
    z: 3,
    sx: 4,
    sy: 5,
    sz: 6,
    yaw: 7,
    pitch: 0.5,
    tilt: -0.25,
    material: MAT_TURN,
    color: [0.1, 0.2, 0.3, 0.4],
  }]);
  assert.equal(INSTANCE_FLOATS, 16);
  assert.deepEqual(INSTANCE_FIELD_OFFSET_BYTES, {
    world: 0,
    scale: 16,
    tint: 32,
    orientation: 48,
  });
  assert.deepEqual(Array.from(packed), [
    1, 2, 3, 9,
    4, 5, 6, 7,
    Math.fround(0.1), Math.fround(0.2), Math.fround(0.3), Math.fround(0.4),
    Math.fround(0.5), Math.fround(-0.25), 0, 0,
  ]);
  assert.equal(cubeVertices().length, 144);
});

test("multi-box packing is byte-identical to the original protocol, including defaults", () => {
  const boxes: Box[] = [
    { x: -5, y: 0, z: 3, sx: 1, sy: 2, sz: 3, yaw: -0.3, color: [1, 0.5, 0.2, 1] },
    { x: 1, y: 2, z: -3, sx: 4, sy: 5, sz: 6, yaw: 0.8, pitch: 0.3, tilt: -1.2,
      material: MAT_TURN, color: [0.1, 0.2, 0.3, 0.4] },
    { x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, yaw: 0, material: 0, color: [0, 0, 0, 0] },
  ];
  const original = new Float32Array(boxes.flatMap((box) => [
    box.x, box.y, box.z, box.material ?? MAT_GENERIC,
    box.sx, box.sy, box.sz, box.yaw, ...box.color,
    box.pitch ?? 0, box.tilt ?? 0, 0, 0,
  ]));
  assert.deepEqual(new Uint8Array(packBoxes(boxes).buffer), new Uint8Array(original.buffer));
  assert.equal(packBoxes([]).length, 0);
});

test("Cab View follows the walker after leaving a rolled simulation taxi", () => {
  const game = makeGame("street-ace", 303, "free-run", "simulation");
  game.x = 100;
  game.y = 200;
  game.simulationVehicle.bodyRoll = Math.PI / 2;
  const camera: Camera = {
    x: 5, y: 7, heading: 0.4, mode: "cab", zoom: 1, boom: 0, heightOffset: -0.2,
  };
  const eye = crownVehiclePointPose(game, 0.02, -0.46, 1.52 + camera.heightOffset);
  const target = crownVehiclePointPose(game, 26, -0.32, 1.15 + camera.heightOffset);
  assert.deepEqual(cabViewMatrix(game, camera), lookAt(
    [eye.x, eye.y, eye.z], [target.x, target.y, target.z], crownVehicleUpVector(game),
  ));

  game.player = {
    kind: "walking",
    actor: makeWalkingActor({ x: camera.x, y: camera.y, heading: camera.heading, vx: 0, vy: 0, speed: 0 }),
    location: { kind: "city" },
  };
  const walkingEye = localPoint(camera.x, camera.y, camera.heading, 0.02, -0.46);
  const walkingTarget = localPoint(camera.x, camera.y, camera.heading, 26, -0.32);
  const expected = lookAt(
    [walkingEye.x, walkingEye.y, 1.52 + camera.heightOffset],
    [walkingTarget.x, walkingTarget.y, 1.15 + camera.heightOffset],
  );
  assert.deepEqual(cabViewMatrix(game, camera), expected);
  game.x += 50;
  game.simulationVehicle.bodyRoll = Math.PI;
  assert.deepEqual(cabViewMatrix(game, camera), expected, "parked taxi must not move the walking camera");
  game.drivingModel = "arcade";
  game.player = { kind: "driving" };
  assert.deepEqual(cabViewMatrix(game, camera), expected, "arcade cabin matrix stays unchanged");
});

test("one navigation glyph model fits every camera and budget", () => {
  const game = makeGame();
  const turnPlan: NavigationPlan = {
    route: [
      { x: 0, y: 2 },
      { x: 0, y: 36 },
      { x: -36, y: 36 },
    ],
    requiresUTurn: false,
    departureYaw: Math.PI / 2,
    travelHeading: Math.PI / 2,
    turnCue: {
      point: { x: 0, y: 36 },
      incomingYaw: Math.PI / 2,
      yaw: Math.PI,
      kind: "right",
      distance: 34,
    },
  };
  const uTurnPlan: NavigationPlan = { ...turnPlan, requiresUTurn: true, turnCue: null };
  const expectedPitch: Record<CameraMode, number> = {
    fixed: 0,
    "chase-high": 1.05,
    "chase-low": 1.38,
    cab: 1.5,
  };

  for (const mode of Object.keys(expectedPitch) as CameraMode[]) {
    const turn = navigationArrowBoxes(game, 0, turnPlan, mode);
    const uTurn = navigationArrowBoxes(game, 0, uTurnPlan, mode);
    assert.equal(turn.length, 16);
    assert.equal(uTurn.length, 30);
    assert.ok(turn.length <= NAVIGATION_INSTANCE_CAPACITY);
    assert.ok(uTurn.length <= NAVIGATION_INSTANCE_CAPACITY);
    assert.ok(turn.every((box) => box.material === MAT_TURN));
    assert.ok(uTurn.every((box) => box.material === MAT_TURN));
    assert.ok(turn.filter((box) => box.pitch !== undefined).every((box) => Math.abs(box.pitch ?? 0) === expectedPitch[mode]));
    assert.ok(uTurn.filter((box) => box.pitch !== undefined).every((box) => box.pitch === expectedPitch[mode]));
  }
});

test("boost widens perspective FOV without changing the fixed camera", () => {
  const camera = (mode: CameraMode, zoom: number): Camera => ({
    x: 0,
    y: 0,
    heading: 0,
    mode,
    boom: mode === "chase-low" ? 9.5 : mode === "chase-high" ? 14 : 0,
    zoom,
    heightOffset: 0,
  });
  approximate(perspectiveSkyView(camera("chase-low", 1))?.fovY ?? 0, 61 * Math.PI / 180);
  approximate(perspectiveSkyView(camera("chase-low", 0.88))?.fovY ?? 0, 70 * Math.PI / 180);
  approximate(perspectiveSkyView(camera("cab", 0.88))?.fovY ?? 0, 81 * Math.PI / 180);
  assert.equal(perspectiveSkyView(camera("fixed", 0.84)), null);
});

test("the articulated on-foot avatar stays readable, grounded, and inside the ghost budget", () => {
  const game = makeGame();
  const actor = makeWalkingActor({
    x: game.x,
    y: game.y,
    vx: 6,
    vy: 0,
    heading: 0,
    speed: 6,
  });
  actor.action = "run";
  actor.gaitPhase = Math.PI / 2;
  actor.turnLean = 0.5;
  game.player = { kind: "walking", actor, location: { kind: "city" } };

  const animated = playerAvatarBoxes(game, 1);
  const reducedMotion = playerAvatarBoxes(game, 0);
  assert.ok(animated.length >= 20);
  assert.ok(animated.every((box) => box.material === MAT_PLAYER));
  assert.ok(animated.every((box) => (
    [box.x, box.y, box.z, box.sx, box.sy, box.sz, box.yaw, box.tilt ?? 0].every(Number.isFinite)
  )));
  assert.ok(animated.some((box) => Math.abs(box.tilt ?? 0) > 0.2));
  assert.ok(reducedMotion.every((box) => Math.abs(box.tilt ?? 0) < 1e-9));
  assert.ok(taxiBoxes(game).length + animated.length <= GHOST_INSTANCE_CAPACITY);

  const standingTop = Math.max(...animated.map((box) => box.z + box.sz / 2));
  actor.crouchAmount = 1;
  actor.action = "crouch";
  actor.speed = 0;
  const crouched = playerAvatarBoxes(game, 0);
  const crouchedTop = Math.max(...crouched.map((box) => box.z + box.sz / 2));
  assert.ok(standingTop > 2.25);
  assert.ok(crouchedTop < standingTop - 0.55);

  actor.crouchAmount = 0;
  actor.elevation = 1.1;
  actor.grounded = false;
  actor.action = "jump";
  const airborne = playerAvatarBoxes(game, 0);
  assert.ok(Math.min(...airborne.map((box) => box.z)) > 1.1);
});

test("walking chase presets bring the camera closer without altering taxi framing", () => {
  for (const mode of ["chase-high", "chase-low"] as const) {
    const taxi = chaseCameraPreset(mode, false);
    const walker = chaseCameraPreset(mode, true);
    assert.ok(walker.distance < taxi.distance);
    assert.ok(walker.lookAhead < taxi.lookAhead);
  }
});

test("exiting the taxi preserves every exterior camera perspective", () => {
  const modes: CameraMode[] = ["fixed", "chase-high", "chase-low", "cab"];
  for (const mode of modes) {
    assert.equal(effectiveCameraMode("driving", mode), mode);
    assert.equal(effectiveCameraMode("walking", mode), mode);
    assert.equal(effectiveCameraMode("interior", mode), "fixed");
    assert.equal(shouldRenderTaxi("walking", mode), true);
    assert.equal(shouldRenderPlayerAvatar("walking", mode), mode !== "cab");
  }
  assert.equal(shouldRenderTaxi("driving", "cab"), false);
  assert.equal(shouldRenderTaxi("interior", "fixed"), false);
});

test("boost trail is a finite renderer-neutral effect behind the taxi", () => {
  const game = makeGame();
  assert.deepEqual(boostTrailBoxes(game, 0), []);
  game.boosting = true;
  const trail = boostTrailBoxes(game, 0.125);
  assert.equal(trail.length, 10);
  assert.ok(trail.every((box) => box.material === MAT_MARKER));
  assert.ok(trail.every((box) => [box.x, box.y, box.z, box.sx, box.sy, box.sz, box.yaw].every(Number.isFinite)));
  assert.ok(trail.every((box) => (
    (box.x - game.x) * Math.cos(game.heading) + (box.y - game.y) * Math.sin(game.heading)
  ) < 0));

  game.player = {
    kind: "walking",
    actor: { x: game.x, y: game.y, vx: 0, vy: 0, heading: game.heading, speed: 0 },
    location: { kind: "city" },
  };
  assert.deepEqual(boostTrailBoxes(game, 0.125), []);
});

test("drift smoke particles produce finite renderer-neutral geometry", () => {
  const game = makeGame();
  game.particles = [{
    x: 4,
    y: -7,
    vx: 1,
    vy: -2,
    life: 0.6,
    maxLife: 0.8,
    color: [1, 0.98, 0.9, 1],
  }];
  const boxes = particleBoxes(game, 0.25);
  assert.equal(boxes.length, 1);
  assert.ok(boxes.every((box) => (
    [box.x, box.y, box.z, box.sx, box.sy, box.sz, box.yaw].every(Number.isFinite)
  )));
});

test("simulation taxi and 3D cab interior have distinct finite geometry within budget", () => {
  const arcade = makeGame("street-ace", 0xaced, "free-run", "arcade");
  const simulation = makeGame("street-ace", 0xcab, "free-run", "simulation");
  simulation.simulationVehicle.steeringAngle = 0.22;
  simulation.simulationVehicle.bodyPitch = 0.04;
  simulation.simulationVehicle.bodyRoll = -0.06;

  const arcadeTaxi = taxiBoxes(arcade);
  const crownTaxi = taxiBoxes(simulation);
  const cockpit = cabInteriorBoxes(simulation);
  assert.ok(crownTaxi.length > arcadeTaxi.length + 20);
  assert.ok(crownTaxi.length < GHOST_INSTANCE_CAPACITY);
  assert.ok(crownTaxi.every((box) => (
    [box.x, box.y, box.z, box.sx, box.sy, box.sz, box.yaw, box.pitch ?? 0, box.tilt ?? 0].every(Number.isFinite)
  )));
  assert.ok(crownTaxi.some((box) => Math.abs(box.yaw - simulation.heading) > 0.1));
  assert.ok(crownTaxi.some((box) => box.pitch === simulation.simulationVehicle.bodyRoll));
  assert.ok(crownTaxi.some((box) => box.tilt === simulation.simulationVehicle.bodyPitch));

  assert.ok(cockpit.length >= 20);
  assert.ok(cockpit.every((box) => box.material !== undefined));
  assert.ok(cockpit.some((box) => Math.abs(box.pitch ?? 0) > 0.5));
  assert.ok(cockpit.every((box) => (
    (box.x - simulation.x) ** 2 + (box.y - simulation.y) ** 2 < 8
  )));

  const actor = makeWalkingActor({
    x: simulation.x,
    y: simulation.y,
    vx: 0,
    vy: 0,
    heading: simulation.heading,
    speed: 0,
  });
  simulation.player = { kind: "walking", actor, location: { kind: "city" } };
  assert.ok(taxiBoxes(simulation).length + playerAvatarBoxes(simulation, 0).length <= GHOST_INSTANCE_CAPACITY);
});

test("the Crown cab and cockpit rotate as one grounded body through side and roof rollover poses", () => {
  const simulation = makeGame("street-ace", 0xface, "free-run", "simulation");
  for (const roll of [Math.PI / 2, Math.PI]) {
    simulation.simulationVehicle.bodyRoll = roll;
    simulation.simulationVehicle.overturned = true;
    const exterior = taxiBoxes(simulation);
    const cockpit = cabInteriorBoxes(simulation);
    for (const box of [...exterior, ...cockpit]) {
      assert.ok([
        box.x,
        box.y,
        box.z,
        box.yaw,
        box.pitch ?? 0,
        box.tilt ?? 0,
      ].every(Number.isFinite));
      assert.ok(box.z >= -0.02);
    }
    assert.ok(exterior.some((box) => Math.abs((box.pitch ?? 0) - roll) < 1e-9));
    assert.ok(cockpit.some((box) => Math.abs((box.pitch ?? 0) - roll) < 1e-9));

    const eye = crownVehiclePointPose(simulation, 0.02, -0.46, 1.52);
    const target = crownVehiclePointPose(simulation, 26, -0.32, 1.15);
    const up = crownVehicleUpVector(simulation);
    const cabView = lookAt(
      [eye.x, eye.y, eye.z],
      [target.x, target.y, target.z],
      up,
    );
    assert.ok([...cabView, ...up].every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...up) - 1) < 1e-9);
  }

  simulation.activeCourier = {
    contractId: "paper-rush",
    stage: "dropoff",
    acceptedAt: 0,
    pickedUpAt: 0,
    approachDistance: 10,
    deliveryDistance: 20,
    hadCollision: false,
    loadedInTaxi: true,
  };
  simulation.player = {
    kind: "walking",
    actor: makeWalkingActor({
      x: simulation.x,
      y: simulation.y,
      vx: 0,
      vy: 0,
      heading: simulation.heading,
      speed: 0,
    }),
    location: { kind: "city" },
  };
  const parcel = taxiBoxes(simulation).filter((box) => box.material === MAT_MARKER);
  assert.equal(parcel.length, 2);
  assert.ok(parcel.every((box) => box.pitch === simulation.simulationVehicle.bodyRoll));
});
