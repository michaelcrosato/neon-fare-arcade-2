import assert from "node:assert/strict";
import test from "node:test";

import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { normalizeAngle } from "../../game/math";
import type { Game, InputState } from "../../game/model";
import {
  applySimulationGroundImpulse,
  CROWN_TAXI_SPECS,
  simulationAxleLoads,
  stepSimulationVehicle,
} from "../../game/simulation-vehicle";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";
import { makeTestWorld } from "./support/fixtures";

const IDLE: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

function stepFor(game: Game, seconds: number, input: Partial<InputState>, onRoad = true) {
  const ticks = Math.round(seconds / FIXED_DT);
  for (let tick = 0; tick < ticks; tick += 1) {
    stepSimulationVehicle(game, { ...IDLE, ...input }, FIXED_DT, onRoad);
  }
}

function displayedKmh(game: Game) {
  return game.speed * SPEED_KMH_PER_WORLD_UNIT;
}

function assertFiniteVehicleState(game: Game) {
  for (const [field, value] of Object.entries(game.simulationVehicle)) {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `${field} must remain finite`);
    }
  }
  for (const [field, value] of Object.entries({
    x: game.x,
    y: game.y,
    vx: game.vx,
    vy: game.vy,
    heading: game.heading,
    speed: game.speed,
    steering: game.steering,
    driftAngle: game.driftAngle,
    driftIntensity: game.driftIntensity,
  })) {
    assert.ok(Number.isFinite(value), `${field} must remain finite`);
  }
}

test("simulation handling is an explicit Free Run-only vehicle model", () => {
  const simulation = makeGame("street-ace", 91, "free-run", "simulation");
  assert.equal(simulation.runKind, "free-run");
  assert.equal(simulation.drivingModel, "simulation");
  assert.equal(simulation.simulationVehicle.gear, 1);
  assert.equal(simulation.simulationVehicle.engineRpm, CROWN_TAXI_SPECS.idleRpm);
  assert.equal(simulation.boost, 0);

  const protectedTimedRun = makeGame("street-ace", 92, "timed", "simulation");
  assert.equal(protectedTimedRun.drivingModel, "arcade");
  assert.ok(protectedTimedRun.boost > 0);
});

test("lateral transfer unloads an inside tire without creating axle weight", () => {
  assert.deepEqual(simulationAxleLoads(10_000, 0), { outside: 5_000, inside: 5_000 });
  assert.deepEqual(simulationAxleLoads(10_000, 2_000), { outside: 7_000, inside: 3_000 });
  assert.deepEqual(simulationAxleLoads(10_000, 20_000), { outside: 10_000, inside: 0 });
  const tripped = simulationAxleLoads(10_000, Number.MAX_SAFE_INTEGER);
  assert.equal(tripped.outside + tripped.inside, 10_000);
});

test("the Crown cab reaches 60 mph on a period-appropriate acceleration curve", () => {
  const game = makeGame("street-ace", 93, "free-run", "simulation");
  let elapsed = 0;
  while (displayedKmh(game) < 96.56 && elapsed < 15) {
    stepSimulationVehicle(game, { ...IDLE, up: true }, FIXED_DT, true);
    elapsed += FIXED_DT;
  }

  assert.ok(elapsed >= 10 && elapsed <= 11.6, `0-60 mph took ${elapsed.toFixed(2)} seconds`);
  assert.ok(game.simulationVehicle.gear >= 2);
  assert.ok(game.simulationVehicle.engineRpm >= CROWN_TAXI_SPECS.idleRpm);

  stepFor(game, 50, { up: true });
  assert.ok(displayedKmh(game) >= 170 && displayedKmh(game) <= 195);
  assert.ok(game.simulationVehicle.gear >= 3);
});

test("service brakes stop from 60 mph in a realistic distance without selecting reverse", () => {
  const game = makeGame("street-ace", 94, "free-run", "simulation");
  while (displayedKmh(game) < 96.56) {
    stepSimulationVehicle(game, { ...IDLE, up: true }, FIXED_DT, true);
  }

  let distanceM = 0;
  let elapsed = 0;
  while (Math.abs(game.simulationVehicle.longitudinalSpeed) > 0.05 && elapsed < 8) {
    stepSimulationVehicle(game, { ...IDLE, down: true }, FIXED_DT, true);
    distanceM += Math.max(0, game.simulationVehicle.longitudinalSpeed) * FIXED_DT;
    elapsed += FIXED_DT;
  }

  assert.ok(distanceM >= 40 && distanceM <= 47, `60-0 distance was ${distanceM.toFixed(1)} m`);
  assert.ok(elapsed >= 2.7 && elapsed <= 3.5);
  assert.notEqual(game.simulationVehicle.gear, -1);
});

test("reverse engages only after the brake is held through a stop", () => {
  const game = makeGame("street-ace", 95, "free-run", "simulation");
  stepFor(game, 0.25, { down: true });
  assert.equal(game.simulationVehicle.gear, 1);
  assert.equal(game.simulationVehicle.longitudinalSpeed, 0);

  stepFor(game, 0.5, { down: true });
  assert.equal(game.simulationVehicle.gear, -1);
  assert.ok(game.simulationVehicle.longitudinalSpeed < 0);

  const reverseSpeed = game.simulationVehicle.longitudinalSpeed;
  stepFor(game, 0.5, { up: true });
  assert.ok(game.simulationVehicle.longitudinalSpeed > reverseSpeed);
});

test("high-speed sideways and backward slides lose momentum through forces, not parking helpers", () => {
  for (const heading of [Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]) {
    const game = makeGame("street-ace", 119, "free-run", "simulation");
    game.heading = heading;
    game.vx = 100 / SPEED_KMH_PER_WORLD_UNIT;
    game.vy = 0;
    game.speed = game.vx;
    game.simulationVehicle.gear = 3;
    stepSimulationVehicle(game, IDLE, FIXED_DT, true);

    // At 100 km/h a single 1/60 s tick cannot remove 13–68 km/h on flat
    // asphalt. This loose 1 km/h bound allows tire force, drag and integration.
    assert.ok(displayedKmh(game) > 99, `heading ${heading}: ${displayedKmh(game)} km/h`);
    assert.ok(displayedKmh(game) < 100.1);
    assertFiniteVehicleState(game);
  }
});

test("reverse remains engine-governed without clipping a backward collision impulse", () => {
  const game = makeGame("street-ace", 120, "free-run", "simulation");
  stepFor(game, 30, { down: true });
  assert.equal(game.simulationVehicle.gear, -1);
  assert.ok(game.simulationVehicle.longitudinalSpeed < -7);
  assert.ok(game.simulationVehicle.longitudinalSpeed >= -CROWN_TAXI_SPECS.governedReverseSpeedMps);
});

test("full steering lock at 100 km/h saturates into a mirrored broad slide without an untripped rollover", () => {
  const maneuver = (direction: "left" | "right", seed: number) => {
    const game = makeGame("street-ace", seed, "free-run", "simulation");
    while (displayedKmh(game) < 100) stepSimulationVehicle(game, { ...IDLE, up: true }, FIXED_DT, true);
    const startHeading = game.heading;
    let peakFrontSlip = 0;
    let peakBodySlip = 0;
    let peakLateralAcceleration = 0;
    let peakRoll = 0;
    let peakYawRate = 0;
    for (let tick = 0; tick < 120; tick += 1) {
      stepSimulationVehicle(game, { ...IDLE, up: true, [direction]: true }, FIXED_DT, true);
      peakFrontSlip = Math.max(peakFrontSlip, Math.abs(game.simulationVehicle.frontSlipAngle));
      peakBodySlip = Math.max(peakBodySlip, Math.abs(game.driftAngle));
      peakLateralAcceleration = Math.max(
        peakLateralAcceleration,
        Math.abs(game.simulationVehicle.lateralAcceleration),
      );
      peakRoll = Math.max(peakRoll, Math.abs(game.simulationVehicle.bodyRoll));
      peakYawRate = Math.max(peakYawRate, Math.abs(game.simulationVehicle.yawRate));
    }
    return {
      game,
      headingChange: normalizeAngle(game.heading - startHeading),
      peakFrontSlip,
      peakBodySlip,
      peakLateralAcceleration,
      peakRoll,
      peakYawRate,
    };
  };

  const left = maneuver("left", 96);
  const right = maneuver("right", 97);
  for (const result of [left, right]) {
    assert.ok(Math.abs(result.game.simulationVehicle.steeringAngle) > 0.52);
    assert.ok(result.peakFrontSlip > 12 * Math.PI / 180);
    assert.ok(result.peakBodySlip > 20 * Math.PI / 180);
    assert.ok(result.peakBodySlip < 45 * Math.PI / 180);
    assert.ok(result.peakYawRate < 60 * Math.PI / 180);
    assert.ok(result.peakLateralAcceleration / 9.81 >= 0.65);
    assert.ok(result.peakLateralAcceleration / 9.81 <= 1);
    assert.ok(result.peakRoll < 12 * Math.PI / 180);
    assert.ok(displayedKmh(result.game) >= 70 && displayedKmh(result.game) <= 96);
    assert.equal(result.game.simulationVehicle.overturned, false);
    assert.ok(Math.abs(result.game.simulationVehicle.wheelLift) >= 0.3);
    assert.ok(Math.abs(result.game.simulationVehicle.wheelLift) < 0.8);
    assert.ok(Math.abs(result.headingChange) >= 45 * Math.PI / 180);
    assert.ok(Math.abs(result.headingChange) <= 80 * Math.PI / 180);
  }
  assert.ok(left.headingChange < 0);
  assert.ok(right.headingChange > 0);
  assert.ok(Math.abs(Math.abs(left.headingChange) - Math.abs(right.headingChange)) < 1e-9);
  assert.ok(Math.abs(left.peakBodySlip - right.peakBodySlip) < 1e-9);
});

test("moderate turning distinguishes held throttle, lift-off, and service braking", () => {
  const maneuver = (kind: "control" | "lift" | "brake") => {
    const game = makeGame("street-ace", 107, "free-run", "simulation");
    for (let tick = 0; tick < 900 && displayedKmh(game) < 80; tick += 1) {
      stepSimulationVehicle(game, { ...IDLE, up: true }, FIXED_DT, true);
    }
    for (let tick = 0; tick < 12; tick += 1) {
      stepSimulationVehicle(game, { ...IDLE, up: true, right: true }, FIXED_DT, true);
    }
    let peakYawRate = 0;
    let peakBodySlip = 0;
    let peakRearSlip = 0;
    let peakLateralAcceleration = 0;
    for (let tick = 0; tick < 30; tick += 1) {
      const input = kind === "control"
        ? { ...IDLE, up: true, right: true }
        : kind === "brake"
          ? { ...IDLE, down: true, right: true }
          : { ...IDLE, right: true };
      stepSimulationVehicle(game, input, FIXED_DT, true);
      assertFiniteVehicleState(game);
      peakYawRate = Math.max(peakYawRate, Math.abs(game.simulationVehicle.yawRate));
      peakBodySlip = Math.max(peakBodySlip, Math.abs(game.driftAngle));
      peakRearSlip = Math.max(peakRearSlip, Math.abs(game.simulationVehicle.rearSlipAngle));
      peakLateralAcceleration = Math.max(
        peakLateralAcceleration,
        Math.abs(game.simulationVehicle.lateralAcceleration),
      );
    }
    return { game, peakYawRate, peakBodySlip, peakRearSlip, peakLateralAcceleration };
  };

  const control = maneuver("control");
  const lift = maneuver("lift");
  const brake = maneuver("brake");
  assert.ok(control.peakLateralAcceleration / 9.81 >= 0.35);
  assert.ok(control.peakLateralAcceleration / 9.81 <= 0.85);
  assert.ok(control.peakBodySlip < 10 * Math.PI / 180);
  assert.ok(displayedKmh(lift.game) < displayedKmh(control.game) - 3);
  assert.ok(lift.peakYawRate >= control.peakYawRate * 1.04);
  assert.ok(lift.peakRearSlip > control.peakRearSlip + 0.1 * Math.PI / 180);
  assert.ok(lift.peakBodySlip < 10 * Math.PI / 180);
  assert.ok(displayedKmh(brake.game) < displayedKmh(lift.game) - 10);
  assert.ok(brake.peakBodySlip > lift.peakBodySlip + 2 * Math.PI / 180);
  assert.ok(brake.peakRearSlip > lift.peakRearSlip + 2 * Math.PI / 180);
  assert.ok(brake.peakBodySlip < 20 * Math.PI / 180);
  assert.equal(brake.game.simulationVehicle.overturned, false);
});

test("reverse steering yaws opposite to the same forward steering input", () => {
  const forward = makeGame("street-ace", 108, "free-run", "simulation");
  const reverse = makeGame("street-ace", 108, "free-run", "simulation");
  stepFor(forward, 1.2, { up: true });
  stepFor(reverse, 1.2, { down: true });
  const forwardHeading = forward.heading;
  const reverseHeading = reverse.heading;
  stepFor(forward, 0.5, { up: true, right: true });
  stepFor(reverse, 0.5, { down: true, right: true });
  assert.ok(normalizeAngle(forward.heading - forwardHeading) > 0.05);
  assert.ok(normalizeAngle(reverse.heading - reverseHeading) < -0.05);
  assert.ok(forward.simulationVehicle.longitudinalSpeed > 0);
  assert.ok(reverse.simulationVehicle.longitudinalSpeed < 0);
});

test("the rear parking brake consumes the rear friction circle and produces a spin", () => {
  const control = makeGame("street-ace", 98, "free-run", "simulation");
  const sliding = makeGame("street-ace", 98, "free-run", "simulation");
  stepFor(control, 8, { up: true });
  stepFor(sliding, 8, { up: true });
  stepFor(control, 1, { up: true, right: true });
  stepFor(sliding, 1, { up: true, right: true, boost: true });
  assert.ok(sliding.simulationVehicle.parkingBrake > 0.9);
  assert.ok(Math.abs(sliding.driftAngle) > Math.abs(control.driftAngle) * 2.5);
  assert.ok(Math.abs(sliding.simulationVehicle.yawRate) > Math.abs(control.simulationVehicle.yawRate) * 2.5);
  assert.ok(Math.abs(sliding.simulationVehicle.rearSlipAngle) > 20 * Math.PI / 180);
  assert.equal(sliding.drifting, true);
  assert.equal(sliding.simulationVehicle.overturned, false);
  assert.equal(sliding.boosting, false);
  assert.equal(sliding.boost, 0);
  assert.equal(sliding.score, 0);
});

test("a ground-level collision impulse brackets rocking, wheel lift, and a genuine rollover", () => {
  const worldUnitsPerMps = 3.6 / SPEED_KMH_PER_WORLD_UNIT;
  const trip = (lateralMps: number, seed: number) => {
    const game = makeGame("street-ace", seed, "free-run", "simulation");
    game.heading = 0;
    applySimulationGroundImpulse(game, 0, -lateralMps * worldUnitsPerMps);
    let peakRoll = 0;
    let peakUnload = 0;
    let rolloverAt = -1;
    for (let tick = 0; tick < 180; tick += 1) {
      stepSimulationVehicle(game, IDLE, FIXED_DT, true);
      peakRoll = Math.max(peakRoll, Math.abs(game.simulationVehicle.bodyRoll));
      peakUnload = Math.max(peakUnload, Math.abs(game.simulationVehicle.wheelLift));
      if (game.simulationVehicle.overturned && rolloverAt < 0) rolloverAt = tick * FIXED_DT;
    }
    return { game, peakRoll, peakUnload, rolloverAt };
  };

  const low = trip(3, 100);
  const transition = trip(6, 101);
  const rollover = trip(10, 102);
  assert.equal(low.game.simulationVehicle.overturned, false);
  assert.ok(low.peakRoll < 15 * Math.PI / 180);
  assert.equal(transition.game.simulationVehicle.overturned, false);
  assert.ok(transition.peakRoll > low.peakRoll * 3);
  assert.ok(transition.peakUnload > low.peakUnload);
  assert.equal(rollover.game.simulationVehicle.overturned, true);
  assert.ok(rollover.peakRoll >= Math.PI / 2);
  assert.ok(rollover.rolloverAt >= 0.3 && rollover.rolloverAt <= 1.2);
});

test("a sideways road-to-shoulder transition trips the chassis through finite states", () => {
  const worldUnitsPerMps = 3.6 / SPEED_KMH_PER_WORLD_UNIT;
  const trip = (lateralMps: number, seed: number) => {
    const game = makeGame("street-ace", seed, "free-run", "simulation");
    game.heading = 0;
    game.vx = 15 * worldUnitsPerMps;
    game.vy = lateralMps * worldUnitsPerMps;
    game.speed = Math.hypot(game.vx, game.vy);
    game.simulationVehicle.longitudinalSpeed = 15;
    game.simulationVehicle.lateralSpeed = lateralMps;
    game.simulationVehicle.surfaceOnRoad = true;
    let peakRoll = 0;
    let peakUnload = 0;
    for (let tick = 0; tick < 180; tick += 1) {
      stepSimulationVehicle(game, IDLE, FIXED_DT, false);
      peakRoll = Math.max(peakRoll, Math.abs(game.simulationVehicle.bodyRoll));
      peakUnload = Math.max(peakUnload, Math.abs(game.simulationVehicle.wheelLift));
      assert.ok([
        game.vx,
        game.vy,
        game.simulationVehicle.lateralAcceleration,
        game.simulationVehicle.bodyRoll,
        game.simulationVehicle.rollRate,
      ].every(Number.isFinite));
    }
    return { game, peakRoll, peakUnload };
  };

  const low = trip(3, 103);
  const transition = trip(6, 104);
  const rollover = trip(10, 105);
  assert.equal(low.game.simulationVehicle.overturned, false);
  assert.ok(low.peakRoll < 20 * Math.PI / 180);
  assert.ok(transition.peakRoll > low.peakRoll);
  assert.ok(transition.peakUnload > low.peakUnload);
  assert.equal(rollover.game.simulationVehicle.overturned, true);
  assert.ok(rollover.peakRoll >= Math.PI / 2);
  assert.equal(rollover.peakUnload, 1);
});

test("overturning emits one semantic event and blocks passenger handoff until recovery", () => {
  const game = makeGame("street-ace", 106, "free-run", "simulation");
  game.traffic = [];
  const job = game.fareJobs[game.jobIndex];
  game.x = job.pickup.x;
  game.y = job.pickup.y;
  game.simulationVehicle.bodyRoll = Math.PI / 2 - 0.01;
  game.simulationVehicle.rollRate = 2.4;
  const events = [];
  for (let tick = 0; tick < 20; tick += 1) {
    events.push(...stepGame(game, IDLE, FIXED_DT, makeTestWorld(), () => 1));
  }
  assert.equal(events.filter((event) => event.type === "vehicle-overturned").length, 1);
  assert.equal(events.some((event) => event.type === "pickup"), false);
  assert.equal(game.simulationVehicle.overturned, true);
  assert.equal(game.onboard, false);
  assert.equal(game.objectiveDwell, 0);
});

test("simulation chassis evolution stays deterministic through a spin", () => {
  const first = makeGame("street-ace", 98, "free-run", "simulation");
  const second = makeGame("street-ace", 98, "free-run", "simulation");
  for (let tick = 0; tick < 720; tick += 1) {
    const input = {
      ...IDLE,
      up: tick < 510,
      right: tick >= 240 && tick < 390,
      boost: tick >= 330 && tick < 350,
    };
    stepSimulationVehicle(first, input, FIXED_DT, true);
    stepSimulationVehicle(second, input, FIXED_DT, true);
    assertFiniteVehicleState(first);
    assertFiniteVehicleState(second);
  }
  assert.deepEqual(first, second);
});

test("straight-line coasting loses speed without depending on a prior spin", () => {
  const game = makeGame("street-ace", 121, "free-run", "simulation");
  stepFor(game, 8, { up: true });
  const speedBeforeCoast = displayedKmh(game);
  assert.ok(speedBeforeCoast > 60);
  stepFor(game, 5, {});
  assert.ok(displayedKmh(game) < speedBeforeCoast - 8);
  assert.equal(game.simulationVehicle.throttle < 0.01, true);
});

test("one 60 Hz update exactly matches two 120 Hz vehicle substeps", () => {
  const outer = makeGame("street-ace", 109, "free-run", "simulation");
  const halves = makeGame("street-ace", 109, "free-run", "simulation");
  for (let tick = 0; tick < 360; tick += 1) {
    const input = {
      ...IDLE,
      up: tick < 270,
      down: tick >= 300,
      right: tick >= 90 && tick < 190,
      left: tick >= 210 && tick < 250,
      boost: tick >= 160 && tick < 180,
    };
    stepSimulationVehicle(outer, input, FIXED_DT, tick < 235);
    stepSimulationVehicle(halves, input, FIXED_DT / 2, tick < 235);
    stepSimulationVehicle(halves, input, FIXED_DT / 2, tick < 235);
    assertFiniteVehicleState(outer);
    assertFiniteVehicleState(halves);
  }
  assert.deepEqual(outer, halves);
});

test("Simulation Free Run keeps the shared fare loop and never awards arcade boost", () => {
  const game = makeGame("street-ace", 99, "free-run", "simulation");
  game.traffic = [];
  const job = game.fareJobs[game.jobIndex];
  game.x = job.pickup.x;
  game.y = job.pickup.y;
  const events = [];
  for (let tick = 0; tick < 11; tick += 1) {
    events.push(...stepGame(game, IDLE, FIXED_DT, makeTestWorld(), () => 1));
  }
  const pickup = events.find((event) => event.type === "pickup");
  assert.ok(pickup && pickup.type === "pickup");
  assert.equal(pickup.fareId, job.id);
  assert.equal(pickup.runKind, "free-run");
  assert.equal(game.onboard, true);
  assert.equal(game.timeLeft, 75);
  assert.equal(game.boost, 0);
});

test("an airborne Crown cab has no tire acceleration, service braking or steering grip", () => {
  const coasting = makeGame("street-ace", 108, "free-run", "simulation");
  coasting.heading = 0; coasting.vx = 30; coasting.vy = 0;
  coasting.z = 10; coasting.roadMotion.grounded = false;
  const powered = structuredClone(coasting);
  const braked = structuredClone(coasting);
  stepFor(coasting, 0.5, {});
  stepFor(powered, 0.5, { up: true, right: true });
  stepFor(braked, 0.5, { down: true, left: true, boost: true });
  for (const game of [powered, braked]) {
    assertFiniteVehicleState(game);
    assert.equal(game.vx, coasting.vx);
    assert.equal(game.vy, coasting.vy);
    assert.equal(game.heading, coasting.heading);
    assert.ok(game.speed > 29.5 && game.speed < 30, "only aerodynamic drag slows the airborne body");
    assert.equal(game.boost, 0);
  }
});
