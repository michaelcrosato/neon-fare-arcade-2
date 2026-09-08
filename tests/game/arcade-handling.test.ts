import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { FIXED_DT } from "../../game/config";
import { makeTestWorld } from "./support/fixtures";
import type { InputState } from "../../game/model";

const world = makeTestWorld();
const idle: InputState = { up: false, down: false, left: false, right: false, boost: false };
function cab() {
  const game = makeGame("street-ace", 23);
  Object.assign(game, { x: -40, y: 0, heading: 0, traffic: [] });
  return game;
}
function ticks(game: ReturnType<typeof cab>, input: InputState, count: number) {
  for (let tick = 0; tick < count; tick += 1) stepGame(game, input, FIXED_DT, world, () => 1);
}

test("arcade yaw builds continuously and countersteer reverses it promptly", () => {
  const game = cab();
  game.vx = 20;
  ticks(game, { ...idle, right: true }, 1);
  const initialRate = game.arcadeVehicle.yawRate;
  assert.ok(initialRate > 0 && initialRate < 0.2);
  ticks(game, { ...idle, right: true }, 11);
  assert.ok(game.arcadeVehicle.yawRate > initialRate * 5);
  ticks(game, { ...idle, left: true }, 10);
  assert.ok(game.arcadeVehicle.yawRate < -0.5);
});

test("arcade chassis loads under acceleration and braking then settles", () => {
  const game = cab();
  ticks(game, { ...idle, up: true }, 24);
  assert.ok(game.arcadeVehicle.bodyPitch < -0.03);
  ticks(game, { ...idle, down: true }, 12);
  assert.ok(game.arcadeVehicle.bodyPitch > 0.02);
  game.vx = 0; game.vy = 0;
  ticks(game, idle, 90);
  assert.ok(Math.abs(game.arcadeVehicle.bodyPitch) < 0.002);
  assert.ok(Math.abs(game.arcadeVehicle.pitchRate) < 0.002);
});

test("airborne steering preserves travel momentum and landing compresses suspension without air drift rewards", () => {
  const game = cab();
  game.z = 10; game.vx = 20; game.roadMotion.grounded = false;
  const startBoost = game.boost;
  ticks(game, { ...idle, right: true, up: true }, 20);
  assert.equal(game.roadMotion.grounded, false);
  assert.equal(game.drifting, false);
  assert.equal(game.boost, startBoost);
  assert.equal(game.driftBank, 0);
  assert.ok(game.vx > 19 && Math.abs(game.vy) < 0.3);
  let compressed = false;
  for (let tick = 0; tick < 160; tick += 1) {
    ticks(game, idle, 1);
    compressed ||= game.roadMotion.heave < -0.02;
  }
  assert.equal(compressed, true);
  assert.equal(game.roadMotion.grounded, true);
  assert.ok(game.z <= 0.64);
  assert.ok(Math.abs(game.roadMotion.heave) < 0.002);
});
