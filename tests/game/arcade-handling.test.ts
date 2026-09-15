import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { makeTestWorld } from "./support/fixtures";
import type { DrivingTraitId, InputState, RunKind } from "../../game/model";

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

function roadCab(kmh: number, kind: RunKind, trait: DrivingTraitId = "street-ace") {
  const game = makeGame(trait, 23, kind, "arcade", "crown-cab");
  Object.assign(game, { heading: 0, traffic: [], fareDispatchEnabled: false,
    vx: kmh / SPEED_KMH_PER_WORLD_UNIT, speed: kmh / SPEED_KMH_PER_WORLD_UNIT });
  return game;
}

function roadTick(game: ReturnType<typeof cab>, input: Partial<InputState>) {
  // Keep the surface flat and paved while allowing heading and velocity to evolve.
  game.x = -40; game.y = 0;
  return stepGame(game, { ...idle, ...input }, FIXED_DT, world, () => 1);
}

for (const kind of ["timed", "free-run"] as const) {
  test(`${kind}: Crown throttle turns stay composed and straighten without a tail rebound`, () => {
    for (const trait of ["street-ace", "drift-demon", "redline-rush"] as const) {
      for (const kmh of [60, 120, 160, 300]) for (const steer of [-1, -0.35, 0.35, 1]) {
        const game = roadCab(kmh, kind, trait);
        for (let tick = 0; tick < 60; tick++) {
          roadTick(game, { up: true, steer, boost: kmh > 160 });
          assert.ok(Math.abs(game.driftAngle) < Math.PI / 12, `${trait}, ${kmh} km/h: ordinary power turn stays below 15° slip`);
        }
        for (let tick = 0; tick < 60; tick++) {
          roadTick(game, { up: true, boost: kmh > 160 });
          assert.ok(game.driftAngle * Math.sign(steer) < Math.PI / 360, "centering does not throw the tail into an opposite slide");
          if (tick >= 29) assert.ok(Math.abs(game.driftAngle) < Math.PI / 180, "slip settles within half a second under acceleration");
        }
      }
    }
  });

  test(`${kind}: accelerate and boost straight without inventing yaw or drift`, () => {
    for (const boost of [false, true]) {
      const game = roadCab(0, kind);
      for (let tick = 0; tick < 180; tick++) {
        roadTick(game, { up: true, boost });
        assert.equal(game.heading, 0);
        assert.equal(game.vy, 0);
        assert.equal(game.arcadeVehicle.yawRate, 0);
        assert.equal(game.drifting, false);
      }
      assert.ok(game.speed * SPEED_KMH_PER_WORLD_UNIT > 150);
    }
  });

  test(`${kind}: brake and steer together from road speed produce a controlled sideways stop`, () => {
    for (const kmh of [90, 120]) {
      const results = [-1, 1].map(steer => {
        const game = roadCab(kmh, kind);
        let peakSlip = 0, sideways = 0, kicks = 0, stopped = false;
        for (let tick = 0; tick < 120; tick++) {
          kicks += roadTick(game, { down: true, steer }).filter(event => event.type === "brake-drift-kick").length;
          const lateral = -game.vx * Math.sin(game.heading) + game.vy * Math.cos(game.heading);
          sideways += Math.abs(lateral) * FIXED_DT;
          if (game.speed > 5) peakSlip = Math.max(peakSlip, Math.abs(game.driftAngle));
          if (game.speed < 1) { stopped = true; break; }
        }
        assert.equal(kicks, 1, "a single brake press initiates the slide without preloading steering or drift");
        assert.ok(peakSlip > Math.PI / 9 && peakSlip < Math.PI * 0.4, `${kmh} km/h: visible 20–72° slip, not a spin`);
        assert.ok(sideways > 1.5, "the cab actually travels sideways while braking");
        assert.ok(Math.abs(game.heading) < Math.PI, "stopping does not require catching a full spin");
        assert.equal(stopped, true);
        for (let tick = 0; tick < 30; tick++) roadTick(game, {});
        assert.ok(Math.abs(game.arcadeVehicle.yawRate) < 0.02, "rotation settles at the stop");
        return { heading: game.heading, sideways, peakSlip };
      });
      assert.ok(Math.abs(results[0].heading + results[1].heading) < 1e-6);
      assert.ok(Math.abs(results[0].sideways - results[1].sideways) < 1e-6);
    }
  });

  test(`${kind}: low-speed turns and straight braking do not trigger a brake slide`, () => {
    for (const [kmh, steer] of [[25, 1], [40, -1], [120, 0], [120, 0.3]]) {
      const game = roadCab(kmh, kind);
      for (let tick = 0; tick < 60; tick++) {
        const events = roadTick(game, { down: true, steer });
        assert.equal(events.some(event => event.type === "brake-drift-kick"), false);
        assert.ok(Math.abs(game.driftAngle) < Math.PI / 18, "gentle braking retains grip");
      }
    }
  });

  test(`${kind}: centering and countersteering both catch a deliberate braking slide`, () => {
    const built = roadCab(120, kind);
    for (let tick = 0; tick < 24; tick++) roadTick(built, { down: true, right: true });
    assert.ok(Math.abs(built.driftAngle) > Math.PI / 9);
    const centered = structuredClone(built), counter = structuredClone(built);
    for (let tick = 0; tick < 12; tick++) {
      roadTick(centered, { up: true });
      roadTick(counter, { up: true, left: true });
    }
    assert.ok(Math.abs(centered.driftAngle) < Math.abs(built.driftAngle) * 0.5);
    assert.ok(Math.abs(counter.driftAngle) < Math.abs(centered.driftAngle), "countersteer catches the rear faster");
    for (const game of [centered, counter]) {
      for (let tick = 0; tick < 30; tick++) roadTick(game, { up: true });
      assert.ok(Math.abs(game.driftAngle) < Math.PI / 180);
      assert.ok(Math.abs(game.arcadeVehicle.yawRate) < 0.05);
    }
  });
}
