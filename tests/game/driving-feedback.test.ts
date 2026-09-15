import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { drivingStuntsHud, stepDrivingStunts } from "../../game/driving-stunts";
import { makeHud } from "../../game/hud";
import { stepManualTransmission } from "../../game/manual-transmission";
import { stepOffroadSpeedLimit } from "../../game/offroad-speed";
import { recoverToRoad } from "../../game/recovery";
import { makeWalkingActor, taxiPose } from "../../game/player";
import { stepGame } from "../../game/simulation";
import { stepSimulationVehicle } from "../../game/simulation-vehicle";
import { makeGame } from "../../game/state";
import { groundAt } from "../../game/vehicle-road-contact";
import { makeTestWorld, TEST_IDLE_INPUT as IDLE } from "./support/fixtures";
import type { Game } from "../../game/model";

const world = makeTestWorld();
function travel(game: Game, dx: number, dy: number, grounded = true) {
  const previous = { x: game.x, y: game.y }, wasGrounded = game.roadMotion.grounded;
  game.x += dx; game.y += dy; game.roadMotion.grounded = grounded;
  game.elapsed += .1; game.speed = 60;
  stepDrivingStunts(game, previous, wasGrounded, .1);
}

test("drift distance follows the driven path, joins a brief countersteer and retains totals and bests", () => {
  const game = makeGame("street-ace", 12);
  game.drifting = true;
  for (let i = 0; i < 5; i++) travel(game, 3, 4);
  assert.equal(game.stunts.drift.meters, 25);
  game.drifting = false; travel(game, 5, 0);
  game.drifting = true; travel(game, -3, -4);
  assert.equal(game.stunts.drift.meters, 30, "straight travel is excluded; opposite slip stays one drift");
  game.drifting = false;
  for (let i = 0; i < 4; i++) travel(game, 0, 0);
  assert.equal(game.stunts.drift.count, 1);
  assert.equal(game.stunts.drift.lastMeters, 30);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed).drift.showResult, true);
  game.drifting = true; travel(game, 3, 4);
  game.drifting = false;
  for (let i = 0; i < 4; i++) travel(game, 0, 0);
  assert.equal(game.stunts.drift.totalMeters, 35);
  assert.equal(game.stunts.drift.bestMeters, 30);
  assert.equal(game.stunts.drift.lastMeters, 5);
  assert.equal(game.stunts.drift.count, 2);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed + 5).drift.showResult, false);
});

test("air distance includes takeoff and landing travel, excludes height and never counts as drift", () => {
  const game = makeGame("street-ace", 12);
  game.drifting = true;
  for (let i = 0; i < 4; i++) { game.z += 4; travel(game, 3, 4, false); }
  assert.equal(game.stunts.air.meters, 20);
  assert.equal(game.stunts.drift.totalMeters, 0);
  game.drifting = false; travel(game, 3, 4, true);
  assert.equal(game.stunts.air.lastMeters, 25);
  assert.equal(game.stunts.air.count, 1);
  assert.equal(makeHud(game).stunts.air.showResult, true);
  travel(game, 500, 0, false);
  assert.equal(game.stunts.air.totalMeters, 25, "teleport-sized jumps are not traveled distance");
});

test("drift feedback stays silent through ten meters, including short banked drifts", () => {
  const game = makeGame("street-ace", 12);
  game.drifting = true;
  travel(game, 5, 0); travel(game, 5, 0);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed).drift.showActive, false);
  game.drifting = false;
  for (let i = 0; i < 4; i++) travel(game, 0, 0);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed).drift.showResult, false);
  game.drifting = true;
  travel(game, 5, 0); travel(game, 5, 0); travel(game, .01, 0);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed).drift.showActive, true);
  game.drifting = false;
  for (let i = 0; i < 4; i++) travel(game, 0, 0);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed).drift.showResult, true);
});

test("drift points reward the current absolute angle and equal earned run score in both models", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const scoreAt = (degrees: number) => {
      const game = makeGame("street-ace", 12, "free-run", model);
      game.drifting = true; game.driftIntensity = .8; game.driftAngle = degrees * Math.PI / 180;
      for (let i = 0; i < 20; i++) travel(game, 3, 4);
      assert.equal(game.stunts.drift.score, game.score);
      assert.ok(game.score > 0);
      return game.score;
    };
    assert.ok(scoreAt(60) > scoreAt(30));
    assert.ok(scoreAt(30) > scoreAt(10));
    assert.equal(scoreAt(-30), scoreAt(30));
    assert.equal(scoreAt(120), scoreAt(90), "spinning past sideways cannot multiply the reward indefinitely");
  }
});

test("drift points survive countersteer, bank with the distance, and exclude stationary, air, walking and teleport travel", () => {
  const game = makeGame("street-ace", 12);
  game.drifting = true; game.driftIntensity = .8; game.driftAngle = .6;
  for (let i = 0; i < 4; i++) travel(game, 3, 4);
  const first = game.stunts.drift.score;
  travel(game, 0, 0); travel(game, 500, 0);
  game.drifting = false; travel(game, 5, 0);
  assert.equal(game.stunts.drift.score, first);
  game.drifting = true; travel(game, 3, 4);
  assert.ok(game.stunts.drift.score > first);
  travel(game, 3, 4, false);
  assert.equal(game.stunts.drift.lastScore, game.score);
  const banked = game.score;
  travel(game, 3, 4, false);
  game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor(taxiPose(game)) };
  travel(game, 3, 4);
  assert.equal(game.score, banked);
  assert.equal(drivingStuntsHud(game.stunts, game.elapsed).drift.lastScore, banked);
});

test("changing angle changes this drift's point rate and the next drift starts a fresh score", () => {
  const game = makeGame("street-ace", 12);
  game.drifting = true; game.driftIntensity = .8; game.driftAngle = .2;
  for (let i = 0; i < 10; i++) travel(game, 3, 4);
  const shallow = game.stunts.drift.score;
  game.driftAngle = .9;
  for (let i = 0; i < 10; i++) travel(game, 3, 4);
  assert.ok(game.stunts.drift.score - shallow > shallow);
  const completed = game.stunts.drift.score;
  game.drifting = false;
  for (let i = 0; i < 4; i++) travel(game, 0, 0);
  game.drifting = true; travel(game, 3, 4);
  assert.ok(game.stunts.drift.score > 0 && game.stunts.drift.score < shallow);
  assert.equal(game.stunts.drift.lastScore, completed);
  assert.equal(game.score, completed + game.stunts.drift.score);
});

test("actual fixed-step crest flight measures distance and lands in both driving models", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 12, "free-run", model);
    game.traffic = []; game.x = 0; game.y = 0; game.heading = 0;
    game.z = groundAt(game, 1).height; game.vx = 40; game.speed = 40;
    game.roadMotion.verticalSpeed = 8;
    stepGame(game, IDLE, FIXED_DT, world, () => 1);
    assert.equal(game.roadMotion.grounded, false);
    assert.equal(makeHud(game).stunts.air.active, true);
    for (let i = 0; i < 180 && !game.roadMotion.grounded; i++) stepGame(game, IDLE, FIXED_DT, world, () => 1);
    assert.equal(game.roadMotion.grounded, true);
    assert.equal(game.stunts.air.active, false);
    assert.ok(game.stunts.air.lastMeters > 5);
    assert.equal(game.stunts.air.count, 1);
  }
});

test("walking and tow recovery cannot add distance or erase banked stunts", () => {
  const game = makeGame("street-ace", 12, "free-run");
  game.drifting = true; travel(game, 3, 4);
  game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor(taxiPose(game)) };
  travel(game, 3, 4);
  assert.equal(game.stunts.drift.totalMeters, 5);
  assert.equal(game.stunts.drift.active, false);
  assert.equal(game.stunts.air.totalMeters, 0);
  game.player = { kind: "driving" };
  travel(game, 3, 4, false);
  const before = game.stunts.air.totalMeters;
  assert.ok(recoverToRoad(game, () => world));
  stepGame(game, IDLE, FIXED_DT, world, () => 1);
  assert.equal(game.stunts.air.totalMeters, before);
  assert.equal(game.stunts.air.active, false);
  assert.equal(game.stunts.drift.totalMeters, 5);
});

test("automatic gas recovery needs three new complete taps; Manual still requires the clutch", () => {
  for (const model of ["arcade", "simulation"] as const) for (const mode of ["automatic", "manual"] as const) {
    const game = makeGame("street-ace", 12, "free-run", model, "accord-v6", mode);
    const step = (up: boolean, clutch = false) => stepManualTransmission(game, { ...IDLE, up, clutch }, FIXED_DT);
    step(true, true); step(true, false);
    assert.equal(game.transmission.stuck, true);
    step(false);
    assert.equal(game.transmission.pumpsRemaining, 3, "gas held before failure does not count as a fresh tap");
    for (let left = 2; left >= 0; left--) {
      for (let i = 0; i < 12; i++) step(true);
      assert.equal(game.transmission.pumpsRemaining, mode === "manual" ? 3 : left + 1);
      step(false);
      assert.equal(game.transmission.pumpsRemaining, mode === "manual" ? 3 : left);
    }
    assert.equal(game.transmission.stuck, mode === "manual");
    if (mode === "manual") for (let i = 0; i < 3; i++) { step(false, true); step(false); }
    assert.equal(game.transmission.stuck, false);
    assert.equal(game.transmission.engagements, 1, "recovery never rerolls a healthy clutch");
  }
});

test("off-road ceiling loses 30 km/h over three seconds and recovers smoothly on pavement", () => {
  const game = makeGame("street-ace", 12);
  stepOffroadSpeedLimit(game, false, .1);
  assert.equal(game.offroadSpeedPenaltyKmh, 1);
  for (let i = 0; i < 29; i++) stepOffroadSpeedLimit(game, false, .1);
  assert.equal(game.offroadSpeedPenaltyKmh, 30);
  game.roadMotion.grounded = false;
  stepOffroadSpeedLimit(game, true, 1);
  assert.equal(game.offroadSpeedPenaltyKmh, 30);
  game.roadMotion.grounded = true;
  stepOffroadSpeedLimit(game, true, .1);
  assert.equal(game.offroadSpeedPenaltyKmh, 28.5);
  stepOffroadSpeedLimit(game, true, 2);
  assert.equal(game.offroadSpeedPenaltyKmh, 0);
  game.installedUpgrades = ["rally-tires"];
  stepOffroadSpeedLimit(game, false, 5);
  assert.equal(game.offroadSpeedPenaltyKmh, 22.2);
});

test("arcade shoulders preserve low-speed driving and reduce ordinary and boosted top speed by only 30 km/h", () => {
  for (const boosting of [false, true]) {
    const game = makeGame("street-ace", 12, "free-run");
    game.traffic = []; game.heading = 0; game.vx = 120; game.speed = 120;
    const step = (offroad: boolean) => {
      game.x = offroad ? 18 : 0; game.y = offroad ? 18 : 0;
      game.z = groundAt(game, 1).height; game.boost = 100;
      stepGame(game, { ...IDLE, up: true, boost: boosting }, FIXED_DT, world, () => 1);
    };
    step(false);
    const roadSpeed = game.speed * SPEED_KMH_PER_WORLD_UNIT;
    for (let i = 0; i < 6; i++) step(true);
    assert.ok(roadSpeed - game.speed * SPEED_KMH_PER_WORLD_UNIT < 1.1, "no abrupt braking on entry");
    for (let i = 0; i < 240; i++) step(true);
    assert.ok(Math.abs(roadSpeed - game.speed * SPEED_KMH_PER_WORLD_UNIT - 30) < .15);
    game.vx = 10; game.vy = 0; game.speed = 10;
    for (let i = 0; i < 60; i++) step(true);
    assert.ok(game.speed * SPEED_KMH_PER_WORLD_UNIT > 60, "ordinary acceleration still works off road");
  }
});

test("simulation uses the same gradual shoulder ceiling for both cars", () => {
  for (const id of ["crown-cab", "accord-v6"] as const) {
    const game = makeGame("street-ace", 91, "free-run", "simulation", id);
    const drive = (onRoad: boolean) => {
      // The coupe's taller sixth needs a longer pull to reach aero equilibrium.
      const seconds = id === "accord-v6" ? 240 : 60;
      for (let i = 0; i < seconds / FIXED_DT; i++) stepSimulationVehicle(game,
        { ...IDLE, up: true, clutch: game.transmission.stuck && i % 2 === 0 }, FIXED_DT, onRoad);
    };
    drive(true);
    const roadSpeed = game.speed * SPEED_KMH_PER_WORLD_UNIT;
    drive(false);
    const loss = roadSpeed - game.speed * SPEED_KMH_PER_WORLD_UNIT;
    assert.equal(game.offroadSpeedPenaltyKmh, 30);
    // The governor reduces drive force, preserving momentum. Aero equilibrium
    // sits below its ceiling, so the measured speed loss can be slightly smaller.
    assert.ok(loss > 26 && loss <= 30.5, `${id}: ${loss} km/h loss`);
  }
});
