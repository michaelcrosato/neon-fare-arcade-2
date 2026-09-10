import assert from "node:assert/strict";
import test from "node:test";
import { steeringInput } from "../../game/input";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { FIXED_DT } from "../../game/config";
import { TEST_IDLE_INPUT, makeTestWorld } from "./support/fixtures";

test("digital keys override analog steering and malformed analog values are neutral", () => {
  assert.equal(steeringInput({ ...TEST_IDLE_INPUT, steer: .4 }), .4);
  assert.equal(steeringInput({ ...TEST_IDLE_INPUT, steer: 2 }), 1);
  assert.equal(steeringInput({ ...TEST_IDLE_INPUT, steer: -2 }), -1);
  for (const steer of [NaN, Infinity, undefined]) assert.equal(steeringInput({ ...TEST_IDLE_INPUT, steer }), 0);
  assert.equal(steeringInput({ ...TEST_IDLE_INPUT, left: true, steer: .4 }), -1);
  assert.equal(steeringInput({ ...TEST_IDLE_INPUT, left: true, right: true, steer: .4 }), 0);
});

for (const model of ["arcade", "simulation"] as const) test(`${model} responds proportionally without changing full digital steering`, () => {
  const world = makeTestWorld();
  const drive = (steer: number, digital = false) => {
    const game = makeGame("street-ace", 482, "free-run", model);
    game.traffic = [];
    for (let i = 0; i < 45; i++) stepGame(game, { ...TEST_IDLE_INPUT, up: true, right: digital, steer }, FIXED_DT, world, () => .5);
    return game;
  };
  const straight = drive(0), partial = drive(.35), full = drive(1), digital = drive(0, true);
  assert.ok(partial.heading > straight.heading);
  assert.ok(partial.heading < full.heading);
  assert.equal(full.heading, digital.heading);
  assert.equal(full.x, digital.x);
});
