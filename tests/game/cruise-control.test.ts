import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { setCruiseControl, cruiseSpeedLimit } from "../../game/cruise-control";
import type { DrivingModel, Game, InputState } from "../../game/model";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { makeTestWorld, TEST_IDLE_INPUT } from "./support/fixtures";

const world = makeTestWorld();
function cab(model: DrivingModel = "arcade") {
  const game = makeGame("street-ace", 42, "free-run", model);
  game.traffic = [];
  game.fareDispatchEnabled = false;
  game.x = 0; game.y = 0; game.heading = 0;
  return game;
}
function drive(game: Game, seconds: number, input: InputState = TEST_IDLE_INPUT) {
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    // A continuous flat-road chassis fixture; real travel is covered in browser tests.
    game.x = 0; game.y = 0;
    stepGame(game, input, FIXED_DT, world, () => 1);
  }
  return game.speed * SPEED_KMH_PER_WORLD_UNIT;
}

for (const model of ["arcade", "simulation"] as const) {
  test(`${model} cruise reaches and maintains the selected speed using ordinary vehicle physics`, () => {
    for (const speed of [30, 70, 120]) {
      const game = cab(model);
      assert.equal(setCruiseControl(game, speed), true);
      drive(game, 30);
      for (let second = 0; second < 5; second++) {
        const actual = drive(game, 1);
        assert.ok(Math.abs(actual - speed) < 1, `${model}: requested ${speed}, got ${actual}`);
      }
    }
  });
  test(`${model} accelerator override returns to the retained cruise speed and brake cancels it`, () => {
    const game = cab(model);
    setCruiseControl(game, 50);
    drive(game, 20);
    assert.ok(drive(game, 3, { ...TEST_IDLE_INPUT, up: true }) > 55);
    assert.equal(Math.round(game.cruiseControl!.speed * SPEED_KMH_PER_WORLD_UNIT), 50);
    assert.ok(Math.abs(drive(game, 25) - 50) < 1);
    drive(game, 0.2, { ...TEST_IDLE_INPUT, down: true });
    assert.equal(game.cruiseControl, null);
    const released = game.speed;
    drive(game, 2);
    assert.ok(game.speed < released, "cruise must stay disengaged after releasing the brake");
  });
  test(`${model} even a low-speed wall contact cancels cruise without a damage event`, () => {
    const game = cab(model);
    const wall = makeTestWorld({ colliders: [{ id: "wall", x: 3, y: 0, halfX: 0.25, halfY: 20, height: 8 }] });
    game.vx = 3;
    setCruiseControl(game, 10);
    for (let i = 0; i < 60; i++) stepGame(game, TEST_IDLE_INPUT, FIXED_DT, wall, () => 1);
    assert.equal(game.cruiseControl, null);
    assert.equal(game.collisions, 0);
  });
  test(`${model} traffic contact cancels cruise even during collision cooldown`, () => {
    const game = cab(model);
    const traffic = makeGame("street-ace", 42).traffic[0];
    game.traffic = [{ ...traffic, x: 3, y: 0, z: 0, heading: 0, speed: 0, cooldown: 1, activeAt: 0,
      motion: { kind: "grid", axis: "x" } }];
    setCruiseControl(game, 30);
    stepGame(game, TEST_IDLE_INPUT, FIXED_DT, world, () => 1);
    assert.equal(game.cruiseControl, null);
  });
}

test("cruise eligibility, limits, exit and parking brake are authoritative", () => {
  const timed = makeGame("street-ace", 42);
  assert.equal(setCruiseControl(timed, 50), false);
  assert.equal(timed.cruiseControl, null);
  const game = cab();
  assert.equal(setCruiseControl(game, NaN), false);
  setCruiseControl(game, 999);
  assert.equal(Math.round(game.cruiseControl!.speed * SPEED_KMH_PER_WORLD_UNIT), cruiseSpeedLimit(game));
  stepGame(game, { ...TEST_IDLE_INPUT, interact: true }, FIXED_DT, world, () => 1);
  assert.equal(game.player.kind, "walking");
  assert.equal(game.cruiseControl, null);
  assert.equal(setCruiseControl(game, 50), false);
  const simulation = cab("simulation");
  setCruiseControl(simulation, 50);
  drive(simulation, 0.1, { ...TEST_IDLE_INPUT, boost: true });
  assert.equal(simulation.cruiseControl, null);
});

test("arcade boost overrides cruise without cancelling the set speed", () => {
  const game = cab();
  setCruiseControl(game, 60);
  drive(game, 10);
  assert.ok(drive(game, 0.7, { ...TEST_IDLE_INPUT, boost: true }) > 90);
  assert.equal(Math.round(game.cruiseControl!.speed * SPEED_KMH_PER_WORLD_UNIT), 60);
  assert.ok(Math.abs(drive(game, 20) - 60) < 1);
});
