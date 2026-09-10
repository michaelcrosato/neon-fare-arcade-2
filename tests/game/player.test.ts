import assert from "node:assert/strict";
import test from "node:test";

import { circleHitsBuilding } from "../../game/collision";
import { WALKING_TUNING } from "../../game/config";
import type { InputState, WalkingActor, WorldView } from "../../game/model";
import {
  makeWalkingActor,
  stepWalkingActor,
  walkingCameraHeightOffset,
  walkingMotion,
} from "../../game/player";

const IDLE: InputState = { up: false, down: false, left: false, right: false, boost: false };
const EMPTY_WORLD: WorldView = { key: "empty", boxes: [], colliders: [], chunks: [], interactions: [] };

function actor(x = 0, y = 0): WalkingActor {
  return makeWalkingActor({ x, y, vx: 0, vy: 0, heading: 0, speed: 0 });
}

function replay(input: InputState, ticks = 120, world = EMPTY_WORLD) {
  const value = actor();
  for (let tick = 0; tick < ticks; tick += 1) {
    stepWalkingActor(value, input, 1 / 60, world);
  }
  return value;
}

test("walk, run, crouch, and reverse have deterministic ordered speed caps", () => {
  const walkA = replay({ ...IDLE, up: true });
  const walkB = replay({ ...IDLE, up: true });
  const run = replay({ ...IDLE, up: true, sprint: true });
  const crouch = replay({ ...IDLE, up: true, crouch: true });
  const reverse = replay({ ...IDLE, down: true });

  assert.deepEqual(walkA, walkB);
  assert.ok(Math.abs(walkA.speed - WALKING_TUNING.walkSpeed) < 0.001);
  assert.ok(Math.abs(run.speed - WALKING_TUNING.runSpeed) < 0.001);
  assert.ok(Math.abs(crouch.speed - WALKING_TUNING.crouchSpeed) < 0.001);
  assert.ok(Math.abs(reverse.speed - WALKING_TUNING.walkSpeed * WALKING_TUNING.backwardMultiplier) < 0.001);
  assert.ok(run.x > walkA.x && walkA.x > crouch.x);
  assert.ok(reverse.x < 0);
  assert.equal(walkingMotion(run).action, "run");
  assert.equal(walkingMotion(crouch).action, "crouch");
});

test("ground acceleration, braking, reversal, and turning remain responsive", () => {
  const value = actor();
  for (let tick = 0; tick < 12; tick += 1) {
    stepWalkingActor(value, { ...IDLE, up: true, sprint: true }, 1 / 60, EMPTY_WORLD);
  }
  assert.ok(value.speed > 6 && value.speed < WALKING_TUNING.runSpeed);
  for (let tick = 0; tick < 12; tick += 1) stepWalkingActor(value, IDLE, 1 / 60, EMPTY_WORLD);
  assert.ok(value.speed < 0.12);
  for (let tick = 0; tick < 12; tick += 1) stepWalkingActor(value, { ...IDLE, down: true }, 1 / 60, EMPTY_WORLD);
  assert.ok(value.vx < -2.8);

  const left = replay({ ...IDLE, up: true, left: true }, 30);
  const right = replay({ ...IDLE, up: true, right: true }, 30);
  assert.ok(Math.abs(left.heading + right.heading) < 1e-9);
  assert.ok(Math.abs(left.x - right.x) < 1e-9);
  assert.ok(Math.abs(left.y + right.y) < 1e-9);
});

function jumpArc(holdTicks: number) {
  const value = actor(18, 18);
  let maximum = 0;
  let jumps = 0;
  let landings = 0;
  for (let tick = 0; tick < 150; tick += 1) {
    const result = stepWalkingActor(
      value,
      { ...IDLE, jump: tick < holdTicks },
      1 / 60,
      EMPTY_WORLD,
    );
    maximum = Math.max(maximum, walkingMotion(value).elevation);
    if (result.jumped) jumps += 1;
    if (result.landed) landings += 1;
  }
  return { value, maximum, jumps, landings };
}

test("jumping has a variable arc, exact landing, and no held-key bunny hop", () => {
  const tap = jumpArc(2);
  const hold = jumpArc(22);
  assert.ok(tap.maximum > 0.7 && tap.maximum < 1);
  assert.ok(hold.maximum > 1.15 && hold.maximum < 1.35);
  assert.ok(hold.maximum > tap.maximum + 0.3);
  assert.equal(hold.jumps, 1);
  assert.equal(hold.landings, 1);
  assert.equal(walkingMotion(hold.value).elevation, 0);
  assert.equal(walkingMotion(hold.value).verticalSpeed, 0);
  assert.equal(walkingMotion(hold.value).grounded, true);
});

test("a late jump press is buffered through landing but still requires a new edge", () => {
  const value = actor();
  let jumps = 0;
  let landings = 0;
  for (let tick = 0; tick < 100; tick += 1) {
    // Tick 29 is still airborne; the buffered edge survives the tick-32 landing.
    const jump = tick < 2 || tick === 29;
    const result = stepWalkingActor(value, { ...IDLE, jump }, 1 / 60, EMPTY_WORLD);
    if (result.jumped) jumps += 1;
    if (result.landed) landings += 1;
  }
  assert.equal(jumps, 2);
  assert.equal(landings, 2);
});

test("running and jumping cannot tunnel through a thin wall", () => {
  const world: WorldView = {
    ...EMPTY_WORLD,
    colliders: [{ id: "thin-wall", x: 3, y: 0, halfX: 0.1, halfY: 5, height: 4 }],
  };
  const value = actor();
  for (let tick = 0; tick < 180; tick += 1) {
    stepWalkingActor(value, {
      ...IDLE,
      up: true,
      sprint: true,
      jump: tick < 20,
    }, 1 / 60, world);
  }
  assert.equal(Boolean(circleHitsBuilding(world, value.x, value.y, WALKING_TUNING.radius)), false);
  assert.ok(value.x <= 2.46);
});

test("camera lift follows first-person stance and jump while reduced motion removes bob", () => {
  const value = actor(18, 18);
  value.gaitPhase = Math.PI / 2;
  value.speed = WALKING_TUNING.runSpeed;
  value.action = "run";
  const animated = walkingCameraHeightOffset(value, "cab", false);
  const reduced = walkingCameraHeightOffset(value, "cab", true);
  assert.ok(animated > reduced);

  value.crouchAmount = 1;
  const crouched = walkingCameraHeightOffset(value, "cab", true);
  assert.ok(crouched < -0.6);
  value.crouchAmount = 0;
  value.elevation = 1.2;
  value.grounded = false;
  assert.ok(walkingCameraHeightOffset(value, "cab", true) > 1.19);
  assert.ok(walkingCameraHeightOffset(value, "chase-low", true) > 0.3);
  assert.equal(walkingCameraHeightOffset(value, "fixed", false), 0);
});
