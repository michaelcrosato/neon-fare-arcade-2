import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT as UNIT } from "../../game/config";
import { accordCoupledRpm } from "../../game/manual-transmission";
import type { DrivingModel, Game, SimulationGear, TransmissionMode } from "../../game/model";
import { stepGame } from "../../game/simulation";
import { stepSimulationVehicle } from "../../game/simulation-vehicle";
import { makeGame } from "../../game/state";
import { groundAt } from "../../game/vehicle-road-contact";
import { makeTestWorld, TEST_IDLE_INPUT } from "./support/fixtures";

const WORLD = makeTestWorld();

function coupe(model: DrivingModel, mode: TransmissionMode, gear: SimulationGear, kmh: number) {
  const game = makeGame("street-ace", 91, "free-run", model, "accord-v6", mode);
  game.traffic = []; game.fareDispatchEnabled = false;
  game.heading = 0; game.vx = kmh / UNIT; game.vy = 0; game.speed = game.vx;
  game.transmission.gear = gear;
  game.simulationVehicle.engineRpm = accordCoupledRpm(kmh / 3.6, gear);
  game.simulationVehicle.throttle = 1;
  return game;
}

function tick(game: Game, boost = false, onRoad = true) {
  const input = { ...TEST_IDLE_INPUT, up: true, boost,
    clutch: game.transmission.stuck && !game.transmission.clutchHeld };
  if (game.drivingModel === "simulation") stepSimulationVehicle(game, input, FIXED_DT, onRoad);
  else {
    // Repeat one flat, paved chassis sample, without traffic or world boundaries.
    game.x = onRoad ? 0 : 18; game.y = onRoad ? 0 : 18;
    if (!onRoad) game.z = groundAt(game, 1).height;
    stepGame(game, input, FIXED_DT, WORLD, () => 1);
  }
}

function passingTime(game: Game, targetKmh: number) {
  let elapsed = 0;
  while (game.speed * UNIT < targetKmh && elapsed < 30) {
    tick(game);
    elapsed += FIXED_DT;
  }
  return elapsed;
}

test("Accord first through fourth retain their established acceleration in both shifting modes", () => {
  const baselines = {
    arcade: {
      automatic: [19.6349963981, 17.8330788889, 17.6191900000, 17.3747455556],
      manual: [3.7987881707, 3.7211208054, 3.1117298775, 1.9772143498],
    },
    simulation: {
      automatic: [4.0117590564, 3.9391501617, 3.1115094452, 1.9770350014],
      manual: [4.0117590564, 3.9391501617, 3.1115094452, 1.9770350014],
    },
  };
  for (const model of ["arcade", "simulation"] as const) for (const mode of ["automatic", "manual"] as const) {
    for (const [gear, kmh] of [[1, 40], [2, 75], [3, 110], [4, 150]] as const) {
      const game = coupe(model, mode, gear, kmh);
      tick(game);
      const acceleration = (game.speed * UNIT - kmh) / 3.6 / FIXED_DT;
      assert.ok(Math.abs(acceleration - baselines[model][mode][gear - 1]) < 1e-8, `${model}/${mode}/${gear}: ${acceleration}`);
    }
  }
});

test("held sixth matches the measured eight-second roll-ons; fifth has a stronger passing pull", () => {
  // C/D's same-powertrain 2016 V6 6MT test: sixth 30–50 mph 8.1 s, 50–70 mph 8.0 s.
  // Fifth's range is a gear-ratio-derived game target, not a published measurement.
  for (const model of ["arcade", "simulation"] as const) {
    for (const startMph of [30, 50]) {
      const game = coupe(model, "manual", 6, startMph * 1.609344);
      const elapsed = passingTime(game, (startMph + 20) * 1.609344);
      assert.equal(game.transmission.gear, 6, "passing measurement must not downshift");
      assert.ok(elapsed > 7.6 && elapsed < 8.7, `${model}/${startMph}–${startMph + 20}: ${elapsed} s`);
    }
    const fifth = passingTime(coupe(model, "manual", 5, 50 * 1.609344), 70 * 1.609344);
    assert.ok(fifth > 5 && fifth < 6.2, `${model}/fifth: ${fifth} s`);
  }
});

test("automatic and manual top gears share gradual acceleration beyond 200 km/h", () => {
  for (const model of ["arcade", "simulation"] as const) for (const gear of [5, 6] as const) {
    const times = ["automatic", "manual"].map(mode => {
      const game = coupe(model, mode as TransmissionMode, gear, 200);
      const elapsed = passingTime(game, 220);
      assert.equal(game.transmission.gear, gear);
      assert.ok(elapsed > 5 && elapsed < 15, `${model}/${mode}/${gear}: ${elapsed} s`);
      return elapsed;
    });
    assert.ok(Math.abs(times[0] - times[1]) < .1, `${model}/${gear}: same gearbox and engine`);
  }
});

test("all six Arcade gears keep their ratio ceilings even with boost", () => {
  for (const [index, ceiling] of [61.325, 97.332, 141.876, 192.951, 247.120, 312.827].entries()) {
    const game = coupe("arcade", "manual", (index + 1) as SimulationGear, ceiling - 1);
    game.boost = 100;
    for (let step = 0; step < 120; step++) tick(game, true);
    assert.ok(game.speed * UNIT > ceiling - 1 && game.speed * UNIT < ceiling + .01,
      `gear ${index + 1}: ${game.speed * UNIT} km/h`);
  }
});

test("automatic Accord reaches sixth above the old cap, with drag limiting its unboosted top speed", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = coupe(model, "automatic", 4, 150);
    const gears = new Set<number>();
    for (let step = 0; step < 120 / FIXED_DT; step++) {
      tick(game);
      gears.add(game.transmission.gear);
    }
    assert.deepEqual([...gears], [4, 5, 6]);
    assert.ok(game.speed * UNIT > 250 && game.speed * UNIT < 280, `${model}: ${game.speed * UNIT} km/h`);
    assert.equal(game.boosting, false);
  }
});

test("top-gear damage and shoulders still reduce attainable speed below the redline ceiling", () => {
  for (const model of ["arcade", "simulation"] as const) for (const gear of [5, 6] as const) {
    const roadSpeed = gear === 5 ? 244 : 268;
    const game = coupe(model, "manual", gear, roadSpeed);
    game.damage.lossKmh = 20;
    for (let step = 0; step < 60 / FIXED_DT; step++) tick(game);
    // Simulation tapers drive force across a speed band instead of snapping
    // velocity to the ceiling; the equilibrium varies with the selected ratio.
    assert.ok(game.speed * UNIT > roadSpeed - 22 && game.speed * UNIT < roadSpeed - 14,
      `${model}/${gear}: damage ceiling ${game.speed * UNIT}`);
    game.damage.lossKmh = 0;
    for (let step = 0; step < 60 / FIXED_DT; step++) tick(game, false, false);
    assert.equal(game.offroadSpeedPenaltyKmh, 30);
    assert.ok(game.speed * UNIT > roadSpeed - 32 && game.speed * UNIT < roadSpeed - 24,
      `${model}/${gear}: shoulder ceiling ${game.speed * UNIT}`);
  }
});
