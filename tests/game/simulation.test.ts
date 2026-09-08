import assert from "node:assert/strict";
import test from "node:test";

import {
  BOOST_OVERDRIVE_BONUS_KMH,
  BOOST_OVERDRIVE_TOP_SPEED_KMH,
  BOOST_OVERDRIVE_TOP_SPEED_WORLD_UNITS,
  FIXED_DT,
  HIGHWAY_SPEED_BONUS_KMH,
  SPEED_KMH_PER_WORLD_UNIT,
  TAXI_TOP_SPEED_KMH,
  TAXI_TOP_SPEED_WORLD_UNITS,
  WHITE,
} from "../../game/config";
import { taxiHitsBuilding } from "../../game/collision";
import { DRIVING_TRAIT_PACKAGES } from "../../game/driving-traits";
import { passengerDistanceQuote } from "../../game/fare-market";
import type { InputState, Job, WorldView } from "../../game/model";
import { isHighwaySpeedSurface, isRoadSurface, sampleSpecialRoad } from "../../game/road-network";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";
import { makeTestWorld } from "./support/fixtures";

const EMPTY_WORLD: WorldView = makeTestWorld({
  key: "test",
});

const IDLE_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

function approximate(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function runTicks(
  input: InputState,
  count = 60,
  setup?: (game: ReturnType<typeof makeGame>) => void,
) {
  const game = makeGame();
  game.traffic = [];
  setup?.(game);
  const events = [];
  for (let tick = 0; tick < count; tick += 1) {
    events.push(...stepGame(game, input, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  return { game, events };
}

test("fixed-step driving replay keeps straight acceleration and reverse while steering builds progressively", () => {
  const forward = runTicks({ ...IDLE_INPUT, up: true }).game;
  approximate(forward.x, 0);
  approximate(forward.y, -6.298771745502387);
  approximate(forward.speed, 16.266791511819967);
  approximate(forward.elapsed, 1);
  approximate(forward.timeLeft, 74);

  const steering = runTicks({ ...IDLE_INPUT, up: true, right: true }).game;
  assert.ok(steering.x > 6);
  assert.ok(steering.steering > 0.99);
  assert.ok(steering.heading > 0 && steering.heading < 0.3);
  assert.ok(steering.speed > 16);
  assert.ok(steering.boost > 45);
  assert.equal(steering.drifting, true);
  assert.ok(steering.driftIntensity > 0.1 && steering.driftIntensity < 0.3);
  assert.ok(Math.abs(steering.driftAngle) > 0);
  assert.ok(steering.driftBank > 0);

  const reverse = runTicks({ ...IDLE_INPUT, down: true }).game;
  approximate(reverse.y, 5.745953882470124);
  approximate(reverse.speed, 7);

  const boosted = runTicks({ ...IDLE_INPUT, up: true, boost: true }).game;
  assert.ok(boosted.y < -14.5);
  assert.ok(boosted.speed > 32);
  approximate(boosted.boost, 20);
});

test("grid traffic turns onto open perimeter lanes instead of crossing a landmark campus", () => {
  const game = makeGame();
  game.x = -360;
  game.y = -72;
  game.traffic = [
    {
      x: -318.05,
      y: 2.25,
      heading: 0,
      motion: { kind: "grid", axis: "x" },
      dir: 1,
      speed: 12,
      color: WHITE,
      activeAt: 0,
      cooldown: 0,
    },
    {
      x: -290.25,
      y: -30.05,
      heading: Math.PI / 2,
      motion: { kind: "grid", axis: "y" },
      dir: 1,
      speed: 12,
      color: WHITE,
      activeAt: 0,
      cooldown: 0,
    },
  ];

  stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1);

  const horizontal = game.traffic[0];
  assert.deepEqual(horizontal.motion, { kind: "grid", axis: "y" });
  assert.equal(horizontal.dir, 1);
  approximate(horizontal.x, -326.25);
  approximate(horizontal.heading, Math.PI / 2);
  assert.equal(isRoadSurface(horizontal, -0.3), true);

  const vertical = game.traffic[1];
  assert.deepEqual(vertical.motion, { kind: "grid", axis: "x" });
  assert.equal(vertical.dir, -1);
  approximate(vertical.y, -38.25);
  approximate(vertical.heading, Math.PI);
  assert.equal(isRoadSurface(vertical, -0.3), true);
});

test("drift intensity and slip scale with speed and held turning angle", () => {
  const slide = (initialSpeed: number, ticks: number) => runTicks(
    { ...IDLE_INPUT, up: true, right: true },
    ticks,
    (game) => {
      game.x = -40;
      game.y = 0;
      game.heading = 0;
      game.vx = initialSpeed;
      game.vy = 0;
    },
  ).game;

  const slow = slide(10, 12);
  const fast = slide(40, 12);
  assert.ok(fast.driftIntensity > slow.driftIntensity * 4);
  assert.ok(Math.abs(fast.driftAngle) > Math.abs(slow.driftAngle) * 8);

  const tap = slide(40, 3);
  const held = slide(40, 18);
  assert.ok(held.steering > tap.steering * 2);
  assert.ok(held.driftIntensity > tap.driftIntensity * 6);
  assert.ok(Math.abs(held.driftAngle) > Math.abs(tap.driftAngle) * 20);
});

test("a committed slide emits two finite rear-tire smoke trails", () => {
  const game = runTicks(
    { ...IDLE_INPUT, up: true, right: true },
    24,
    (candidate) => {
      candidate.x = -40;
      candidate.y = 0;
      candidate.heading = 0;
      candidate.vx = 40;
      candidate.vy = 0;
    },
  ).game;
  game.particles = [];

  stepGame(
    game,
    { ...IDLE_INPUT, up: true, right: true },
    FIXED_DT,
    EMPTY_WORLD,
    () => 0,
  );

  const driftSmoke = game.particles.filter((particle) => particle.maxLife === 0.9);
  assert.equal(driftSmoke.length, 2);
  assert.ok(driftSmoke.every((particle) => (
    particle.life > 0.5
      && [particle.x, particle.y, particle.vx, particle.vy].every(Number.isFinite)
  )));
  assert.ok(driftSmoke.every((particle) => (
    particle.color.every((channel, index) => channel === WHITE[index])
  )));
});

test("a brake tap adds one short rotation kick while holding brake cannot retrigger it", () => {
  const prepared = makeGame();
  prepared.traffic = [];
  prepared.x = -40;
  prepared.y = 0;
  prepared.heading = 0;
  prepared.vx = 40;
  prepared.vy = 0;
  prepared.steering = 1;
  prepared.drifting = true;
  prepared.driftIntensity = 0.6;
  const tapped = structuredClone(prepared);
  const held = structuredClone(prepared);
  const brakeRight = { ...IDLE_INPUT, down: true, right: true };
  const gasRight = { ...IDLE_INPUT, up: true, right: true };
  const tapEvents = [];
  const holdEvents = [];

  for (let tick = 0; tick < 24; tick += 1) {
    tapEvents.push(...stepGame(
      tapped,
      tick === 0 ? brakeRight : gasRight,
      FIXED_DT,
      EMPTY_WORLD,
      () => 1,
    ));
    holdEvents.push(...stepGame(held, brakeRight, FIXED_DT, EMPTY_WORLD, () => 1));
  }

  assert.equal(tapEvents.filter((event) => event.type === "brake-drift-kick").length, 1);
  assert.equal(holdEvents.filter((event) => event.type === "brake-drift-kick").length, 1);
  assert.equal(held.brakeDriftKick, 0);
  assert.ok(held.speed < tapped.speed, "holding brake should keep slowing the taxi");
  assert.ok(held.heading < tapped.heading, "holding brake should not refresh the rotation pulse");

  stepGame(held, { ...IDLE_INPUT, right: true }, FIXED_DT, EMPTY_WORLD, () => 1);
  const rearmed = stepGame(held, brakeRight, FIXED_DT, EMPTY_WORLD, () => 1);
  assert.equal(rearmed.filter((event) => event.type === "brake-drift-kick").length, 1);
});

test("brake-kick rotation scales with speed and steering angle, then mirrors direction", () => {
  const kickAt = (speed: number, direction: -1 | 1, armed: boolean, commitment = 1) => {
    const game = makeGame();
    game.traffic = [];
    game.x = -40;
    game.y = 0;
    game.heading = 0;
    game.vx = speed;
    game.vy = 0;
    game.steering = direction * commitment;
    game.drifting = true;
    game.driftIntensity = 0.6;
    game.brakeInputHeld = !armed;
    const events = stepGame(
      game,
      { ...IDLE_INPUT, down: true, left: direction < 0, right: direction > 0 },
      FIXED_DT,
      EMPTY_WORLD,
      () => 1,
    );
    return { game, events };
  };

  const slow = kickAt(8, 1, true);
  const medium = kickAt(20, 1, true);
  const mediumControl = kickAt(20, 1, false);
  const fast = kickAt(40, 1, true);
  const fastControl = kickAt(40, 1, false);
  const shallow = kickAt(40, 1, true, 0.25);
  assert.equal(slow.events.some((event) => event.type === "brake-drift-kick"), false);
  assert.equal(medium.events.filter((event) => event.type === "brake-drift-kick").length, 1);
  assert.equal(fast.events.filter((event) => event.type === "brake-drift-kick").length, 1);
  assert.ok(fast.game.brakeDriftKick > medium.game.brakeDriftKick * 2);
  assert.ok(fast.game.brakeDriftKick > shallow.game.brakeDriftKick * 1.7);
  assert.ok(
    fast.game.heading - fastControl.game.heading
      > (medium.game.heading - mediumControl.game.heading) * 2,
  );
  assert.ok(
    Math.abs(fast.game.driftAngle) - Math.abs(fastControl.game.driftAngle)
      > Math.abs(medium.game.driftAngle) - Math.abs(mediumControl.game.driftAngle),
  );
  assert.equal(fast.game.particles.filter((particle) => particle.maxLife === 0.86).length, 2);

  const left = kickAt(40, -1, true).game;
  approximate(left.heading, -fast.game.heading);
  approximate(left.driftAngle, -fast.game.driftAngle);
  approximate(left.brakeDriftKick, -fast.game.brakeDriftKick);
});

test("brake-kick yaw gains an extra ramp only at high speed", () => {
  const pulseResult = (speed: number) => {
    const kicked = makeGame();
    kicked.traffic = [];
    kicked.x = -40;
    kicked.y = 0;
    kicked.heading = 0;
    kicked.vx = speed;
    kicked.vy = 0;
    kicked.steering = 1;
    kicked.drifting = true;
    kicked.driftIntensity = 0.6;
    const control = structuredClone(kicked);
    control.brakeInputHeld = true;
    const brakeRight = { ...IDLE_INPUT, down: true, right: true };
    const coastRight = { ...IDLE_INPUT, right: true };
    for (let tick = 0; tick < 12; tick += 1) {
      stepGame(
        kicked,
        tick === 0 ? brakeRight : coastRight,
        FIXED_DT,
        EMPTY_WORLD,
        () => 1,
      );
      stepGame(control, coastRight, FIXED_DT, EMPTY_WORLD, () => 1);
    }
    return {
      headingGain: kicked.heading - control.heading,
      speedCost: control.speed - kicked.speed,
    };
  };

  const medium = pulseResult(35.5); // 110 km/h: below the added ramp.
  const highway = pulseResult(48.5); // 150 km/h: near the top of the ramp.
  assert.ok(highway.headingGain > medium.headingGain * 1.4);
  assert.ok(highway.headingGain < medium.headingGain * 1.55);
  assert.ok(highway.speedCost * SPEED_KMH_PER_WORLD_UNIT > 6);
  assert.ok(highway.speedCost * SPEED_KMH_PER_WORLD_UNIT < 8);
});

test("countersteering suppresses a brake kick instead of defeating slide recovery", () => {
  const built = runTicks(
    { ...IDLE_INPUT, up: true, right: true },
    18,
    (game) => {
      game.x = -40;
      game.y = 0;
      game.heading = 0;
      game.vx = 40;
      game.vy = 0;
    },
  ).game;
  const counterTap = structuredClone(built);
  const heldControl = structuredClone(built);
  heldControl.brakeInputHeld = true;
  const counterBrake = { ...IDLE_INPUT, down: true, left: true };

  const events = stepGame(counterTap, counterBrake, FIXED_DT, EMPTY_WORLD, () => 1);
  stepGame(heldControl, counterBrake, FIXED_DT, EMPTY_WORLD, () => 1);

  assert.equal(events.some((event) => event.type === "brake-drift-kick"), false);
  assert.equal(counterTap.brakeDriftKick, 0);
  approximate(counterTap.heading, heldControl.heading);
  approximate(counterTap.driftAngle, heldControl.driftAngle);
});

test("countersteering catches a slide faster than holding the turn", () => {
  const built = runTicks(
    { ...IDLE_INPUT, up: true, right: true },
    18,
    (game) => {
      game.x = -40;
      game.y = 0;
      game.heading = 0;
      game.vx = 40;
      game.vy = 0;
    },
  ).game;
  const counter = structuredClone(built);
  const continued = structuredClone(built);
  for (let tick = 0; tick < 9; tick += 1) {
    stepGame(counter, { ...IDLE_INPUT, up: true, left: true }, FIXED_DT, EMPTY_WORLD, () => 1);
    stepGame(continued, { ...IDLE_INPUT, up: true, right: true }, FIXED_DT, EMPTY_WORLD, () => 1);
  }
  assert.ok(counter.driftIntensity < continued.driftIntensity * 0.35);
  assert.ok(Math.abs(counter.driftAngle) < Math.abs(continued.driftAngle) * 0.25);
});

test("every four-lane corridor raises normal and boosted top speed by exactly 10 km/h", () => {
  const bonusRoads = [
    "aurora-boulevard",
    "crosstown-boulevard",
    "neon-beltway",
  ] as const;
  const roadSamples = bonusRoads.map((roadId) => sampleSpecialRoad(roadId, 180));
  assert.ok(roadSamples.every(Boolean));

  const cappedSpeed = (
    drivingTraitId: (typeof DRIVING_TRAIT_PACKAGES)[number]["id"],
    x: number,
    y: number,
    heading: number,
    boosting: boolean,
    initialForwardSpeed = 100,
  ) => {
    const game = makeGame(drivingTraitId);
    game.traffic = [];
    game.x = x;
    game.y = y;
    game.heading = heading;
    game.vx = Math.cos(heading) * initialForwardSpeed;
    game.vy = Math.sin(heading) * initialForwardSpeed;
    game.boost = 100;
    stepGame(
      game,
      { ...IDLE_INPUT, boost: boosting },
      FIXED_DT,
      EMPTY_WORLD,
      () => 1,
    );
    return game.speed;
  };

  for (const trait of DRIVING_TRAIT_PACKAGES) {
    const streetSpeed = cappedSpeed(trait.id, 0, 0, 0, false);
    const streetBoostSpeed = cappedSpeed(trait.id, 0, 0, 0, true);
    for (const sample of roadSamples) {
      assert.ok(sample);
      const highwaySpeed = cappedSpeed(
        trait.id,
        sample.point.x,
        sample.point.y,
        sample.heading,
        false,
      );
      approximate(
        (highwaySpeed - streetSpeed) * SPEED_KMH_PER_WORLD_UNIT,
        HIGHWAY_SPEED_BONUS_KMH,
      );

      const highwayBoostSpeed = cappedSpeed(
        trait.id,
        sample.point.x,
        sample.point.y,
        sample.heading,
        true,
      );
      approximate(
        (highwayBoostSpeed - streetBoostSpeed) * SPEED_KMH_PER_WORLD_UNIT,
        HIGHWAY_SPEED_BONUS_KMH,
      );

      approximate(cappedSpeed(
        trait.id,
        sample.point.x,
        sample.point.y,
        sample.heading,
        false,
        -100,
      ), 7);
    }
  }
});

test("the global highway ceiling is exactly 180 km/h", () => {
  const sample = sampleSpecialRoad("neon-beltway", 180);
  assert.ok(sample);
  for (const trait of DRIVING_TRAIT_PACKAGES) {
    const game = makeGame(trait.id);
    game.traffic = [];
    game.x = sample.point.x;
    game.y = sample.point.y;
    game.heading = sample.heading;
    game.vx = Math.cos(sample.heading) * 100 + Math.sin(sample.heading) * 60;
    game.vy = Math.sin(sample.heading) * 100 - Math.cos(sample.heading) * 60;
    game.steering = 1;
    game.drifting = true;
    game.driftIntensity = 0.6;
    game.boost = 100;
    const events = stepGame(
      game,
      { ...IDLE_INPUT, down: true, right: true, boost: true },
      FIXED_DT,
      EMPTY_WORLD,
      () => 1,
    );
    assert.equal(events.filter((event) => event.type === "brake-drift-kick").length, 1);
    approximate(game.speed * SPEED_KMH_PER_WORLD_UNIT, TAXI_TOP_SPEED_KMH);
  }
});

test("Boost Overdrive adds exactly 60 km/h of same-road boosted headroom", () => {
  const highway = sampleSpecialRoad("neon-beltway", 180);
  assert.ok(highway);
  const cappedSpeed = (
    drivingTraitId: (typeof DRIVING_TRAIT_PACKAGES)[number]["id"],
    x: number,
    y: number,
    heading: number,
    boosting: boolean,
  ) => {
    const game = makeGame(drivingTraitId);
    game.traffic = [];
    game.installedUpgrades = ["boost-overdrive"];
    game.x = x;
    game.y = y;
    game.heading = heading;
    game.vx = Math.cos(heading) * 100;
    game.vy = Math.sin(heading) * 100;
    game.boost = 100;
    stepGame(game, { ...IDLE_INPUT, boost: boosting }, FIXED_DT, EMPTY_WORLD, () => 1);
    return game.speed * SPEED_KMH_PER_WORLD_UNIT;
  };

  for (const trait of DRIVING_TRAIT_PACKAGES) {
    const streetNormal = cappedSpeed(trait.id, 0, 0, 0, false);
    const streetBoost = cappedSpeed(trait.id, 0, 0, 0, true);
    const highwayNormal = cappedSpeed(trait.id, highway.point.x, highway.point.y, highway.heading, false);
    const highwayBoost = cappedSpeed(trait.id, highway.point.x, highway.point.y, highway.heading, true);
    approximate(streetBoost - streetNormal, BOOST_OVERDRIVE_BONUS_KMH);
    approximate(highwayBoost - highwayNormal, BOOST_OVERDRIVE_BONUS_KMH);
    approximate(highwayNormal - streetNormal, HIGHWAY_SPEED_BONUS_KMH);
    approximate(highwayBoost - streetBoost, HIGHWAY_SPEED_BONUS_KMH);
  }
  approximate(
    cappedSpeed("redline-rush", highway.point.x, highway.point.y, highway.heading, true),
    BOOST_OVERDRIVE_TOP_SPEED_KMH,
  );
});

test("brake-kick steering remains collision-safe beside a facade", () => {
  const world: WorldView = makeTestWorld({
    key: "brake-kick-wall",
    colliders: [{ id: "wall", x: 5, y: 0, halfX: 3, halfY: 20, height: 8 }],
  });
  const game = makeGame();
  game.traffic = [];
  game.x = 0.95;
  game.y = -10;
  game.heading = Math.PI / 2;
  game.vx = 0;
  game.vy = 40;
  game.steering = -1;
  game.drifting = true;
  game.driftIntensity = 0.6;
  let kickEvents = 0;

  for (let tick = 0; tick < 20; tick += 1) {
    const events = stepGame(
      game,
      { ...IDLE_INPUT, down: tick === 0, left: true },
      FIXED_DT,
      world,
      () => 1,
    );
    kickEvents += events.filter((event) => event.type === "brake-drift-kick").length;
    assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);
    assert.ok([game.x, game.y, game.heading, game.vx, game.vy].every(Number.isFinite));
  }
  assert.equal(kickEvents, 1);
});

test("only authored four-lane corridor surfaces activate the speed bonus", () => {
  const aurora = sampleSpecialRoad("aurora-boulevard", 180);
  const auroraShoulder = sampleSpecialRoad("aurora-boulevard", 180, 14);
  const crosstown = sampleSpecialRoad("crosstown-boulevard", 180);
  const crosstownShoulder = sampleSpecialRoad("crosstown-boulevard", 180, 14);
  const beltway = sampleSpecialRoad("neon-beltway", 180);
  const beltwayShoulder = sampleSpecialRoad("neon-beltway", 180, 15);
  const parkway = sampleSpecialRoad("harbor-parkway", 180);
  const ramp = sampleSpecialRoad("northwest-inner-ramp", 40);
  const roundabout = sampleSpecialRoad("apex-circle", 30);
  assert.ok(
    aurora && auroraShoulder && crosstown && crosstownShoulder
    && beltway && beltwayShoulder && parkway && ramp && roundabout,
  );

  assert.equal(isHighwaySpeedSurface(aurora.point), true);
  assert.equal(isHighwaySpeedSurface(crosstown.point), true);
  assert.equal(isHighwaySpeedSurface(beltway.point), true);
  assert.equal(isHighwaySpeedSurface(auroraShoulder.point), false);
  assert.equal(isHighwaySpeedSurface(crosstownShoulder.point), false);
  assert.equal(isHighwaySpeedSurface(beltwayShoulder.point), false);
  assert.equal(isHighwaySpeedSurface(parkway.point), false);
  assert.equal(isHighwaySpeedSurface(ramp.point), false);
  assert.equal(isHighwaySpeedSurface(roundabout.point), false);
  assert.equal(isHighwaySpeedSurface({ x: 0, y: 0 }), false);
});

test("steering beside a facade cannot rotate the taxi into a permanent overlap", () => {
  const world: WorldView = makeTestWorld({
    key: "wall",
    colliders: [{ id: "wall", x: 5, y: 0, halfX: 3, halfY: 20, height: 8 }],
  });
  const game = makeGame();
  game.traffic = [];
  game.x = 0.95;
  game.y = -10;
  game.heading = Math.PI / 2;
  game.vx = 0;
  game.vy = 12;

  stepGame(game, { ...IDLE_INPUT, up: true, left: true }, FIXED_DT, world, () => 1);
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);

  const contactX = game.x;
  const contactY = game.y;
  let firstReverseTick: number | null = null;
  let furthestY = contactY;
  for (let tick = 0; tick < 60; tick += 1) {
    stepGame(game, { ...IDLE_INPUT, down: true }, FIXED_DT, world, () => 1);
    assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);
    furthestY = Math.max(furthestY, game.y);
    if (firstReverseTick === null && game.vy < 0) firstReverseTick = tick + 1;
  }
  assert.ok(firstReverseTick !== null && firstReverseTick <= 30, "reverse should engage within 0.5 seconds");
  assert.ok(furthestY - game.y > 1.8, "the taxi should retreat from its furthest contact point");
  assert.ok(game.vy < -5, "reverse should have useful recovery speed");
  assert.ok(Math.abs(game.x - contactX) < 0.12);
});

test("low-speed steering can back the taxi out from between close props", () => {
  const world: WorldView = makeTestWorld({
    key: "prop-gap",
    colliders: [
      { id: "truck", x: 0, y: 0, halfX: 1.925, halfY: 0.91, height: 2 },
      { id: "tanks", x: 9.7, y: -2.9, halfX: 2.75, halfY: 1.25, height: 5 },
    ],
  });
  const game = makeGame();
  game.traffic = [];
  game.x = 4.923577832735873;
  game.y = -3.580273520770106;
  game.heading = 3 * Math.PI / 4;
  game.vx = 0.25087231643215174;
  game.vy = 0.04599617634971505;
  const startX = game.x;
  const startY = game.y;
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);

  for (let tick = 0; tick < 180; tick += 1) {
    stepGame(game, { ...IDLE_INPUT, down: true, left: true }, FIXED_DT, world, () => 1);
    assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);
  }
  assert.ok(Math.hypot(game.x - startX, game.y - startY) > 2.5);
});

test("high-speed and glancing building impacts rebound once and preserve wall slide", () => {
  const world: WorldView = makeTestWorld({
    key: "wall",
    colliders: [{ id: "wall", x: 5, y: 0, halfX: 5, halfY: 20, height: 8 }],
  });

  const headOn = makeGame();
  headOn.traffic = [];
  headOn.x = -2.5;
  headOn.y = 0;
  headOn.heading = 0;
  headOn.vx = 24;
  headOn.vy = 0;
  assert.deepEqual(stepGame(headOn, IDLE_INPUT, FIXED_DT, world, () => 1), [{ type: "building-collision" }]);
  assert.ok(headOn.vx < 0, "the rebound must point away from the facade");
  assert.equal(Boolean(taxiHitsBuilding(world, headOn.x, headOn.y, headOn.heading)), false);

  const topSpeed = makeGame();
  topSpeed.traffic = [];
  topSpeed.x = -2.5;
  topSpeed.y = 8;
  topSpeed.heading = 0;
  topSpeed.vx = TAXI_TOP_SPEED_WORLD_UNITS;
  topSpeed.vy = 0;
  assert.deepEqual(stepGame(topSpeed, IDLE_INPUT, FIXED_DT, world, () => 1), [{ type: "building-collision" }]);
  assert.ok(topSpeed.vx < 0, "the top-speed rebound must point away from the facade");
  assert.equal(Boolean(taxiHitsBuilding(world, topSpeed.x, topSpeed.y, topSpeed.heading)), false);

  const overdriveSpeed = makeGame("redline-rush");
  overdriveSpeed.traffic = [];
  overdriveSpeed.installedUpgrades = ["boost-overdrive"];
  overdriveSpeed.x = -2.5;
  overdriveSpeed.y = -8;
  overdriveSpeed.heading = 0;
  overdriveSpeed.vx = BOOST_OVERDRIVE_TOP_SPEED_WORLD_UNITS;
  overdriveSpeed.vy = 0;
  overdriveSpeed.boost = 100;
  assert.deepEqual(
    stepGame(overdriveSpeed, { ...IDLE_INPUT, boost: true }, FIXED_DT, world, () => 1),
    [{ type: "building-collision" }],
  );
  assert.ok(overdriveSpeed.vx < 0, "the overdrive rebound must point away from the facade");
  assert.equal(Boolean(taxiHitsBuilding(world, overdriveSpeed.x, overdriveSpeed.y, overdriveSpeed.heading)), false);

  const glancing = makeGame();
  glancing.traffic = [];
  glancing.x = -2.4;
  glancing.y = -5;
  glancing.heading = 0;
  glancing.vx = 16;
  glancing.vy = 8;
  stepGame(glancing, IDLE_INPUT, FIXED_DT, world, () => 1);
  assert.equal(Boolean(taxiHitsBuilding(world, glancing.x, glancing.y, glancing.heading)), false);
  assert.ok(glancing.vy > 5, "tangential speed should carry the taxi along the wall");

  const scrape = makeGame();
  const scrapeWorld: WorldView = {
    ...world,
    colliders: [{ id: "scrape-wall", x: 5, y: 0, halfX: 3, halfY: 30, height: 8 }],
  };
  scrape.traffic = [];
  scrape.x = 0.82;
  scrape.y = -10;
  scrape.heading = Math.PI / 2 - 0.05;
  scrape.vx = Math.cos(scrape.heading) * 20;
  scrape.vy = Math.sin(scrape.heading) * 20;
  for (let tick = 0; tick < 30; tick += 1) {
    stepGame(scrape, { ...IDLE_INPUT, up: true }, FIXED_DT, scrapeWorld, () => 1);
    assert.equal(Boolean(taxiHitsBuilding(scrapeWorld, scrape.x, scrape.y, scrape.heading)), false);
  }
  assert.ok(scrape.y > 0, "a shallow scrape should keep sliding along the facade");
  assert.ok(Math.hypot(scrape.vx, scrape.vy) > 20, "repeated contact should not erase tangential speed");
});

test("traffic separation cannot push the taxi through a neighboring building", () => {
  const world: WorldView = makeTestWorld({
    key: "traffic-wall",
    colliders: [{ id: "wall", x: 7, y: 0, halfX: 3, halfY: 20, height: 8 }],
  });
  const game = makeGame();
  game.x = 1.5;
  game.y = 0;
  game.heading = 0;
  game.traffic = [{
    x: 0,
    y: 0,
    heading: 0,
    motion: { kind: "grid", axis: "x" },
    dir: 1,
    speed: 0,
    color: [1, 1, 1, 1],
    activeAt: 0,
    cooldown: 0,
  }];

  stepGame(game, IDLE_INPUT, FIXED_DT, world, () => 1);
  assert.equal(game.x, 1.5);
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);
});

test("a shallow legacy overlap is automatically separated on the next tick", () => {
  const world: WorldView = makeTestWorld({
    key: "repair",
    colliders: [{ id: "wall", x: 5, y: 0, halfX: 5, halfY: 20, height: 8 }],
  });
  const game = makeGame();
  game.traffic = [];
  game.x = -1;
  game.y = 0;
  game.heading = 0;
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), true);

  stepGame(game, IDLE_INPUT, FIXED_DT, world, () => 1);
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);
  assert.ok(game.x < -2.25);
});

test("an irrecoverable legacy overlap falls back to a nearby clear road", () => {
  const world: WorldView = makeTestWorld({
    key: "dense-corner",
    colliders: [
      { id: "northwest", x: -2, y: -2, halfX: 5, halfY: 8, height: 5 },
      { id: "east", x: 6, y: 4, halfX: 5, halfY: 6, height: 5 },
      { id: "southwest", x: -2, y: -4, halfX: 6, halfY: 5, height: 5 },
    ],
  });
  const game = makeGame();
  game.traffic = [];
  game.x = 0;
  game.y = 0;
  game.heading = Math.PI / 2;
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), true);

  stepGame(game, IDLE_INPUT, FIXED_DT, world, () => 1);
  assert.equal(Boolean(taxiHitsBuilding(world, game.x, game.y, game.heading)), false);
  assert.equal(isRoadSurface({ x: game.x, y: game.y }), true);
  assert.ok(Math.hypot(game.x, game.y) >= 30);
  assert.equal(game.vx, 0);
  assert.equal(game.vy, 0);
});

test("pickup mutates game state and emits one semantic event", () => {
  let job!: Job;
  const { game, events } = runTicks(IDLE_INPUT, 11, (state) => {
    job = state.fareJobs[state.jobIndex];
    state.x = job.pickup.x;
    state.y = job.pickup.y;
  });
  const quote = passengerDistanceQuote(job);

  assert.equal(game.onboard, true);
  assert.equal(game.score, 50);
  assert.equal(game.boost, 53);
  approximate(game.timeLeft, 75 + quote.pickupSeconds - FIXED_DT * 11);
  assert.equal(game.particles.length, 14);
  assert.deepEqual(events, [{
    type: "pickup",
    fareId: job.id,
    fareNumber: job.passengerArtCell + 1,
    artCell: job.passengerArtCell,
    rider: job.rider,
    destination: job.destination,
    bonusSeconds: quote.pickupSeconds,
    runKind: "timed",
  }]);
});

test("clean dropoff preserves fare math, combo, handoff lock, and event payload", () => {
  let job!: Job;
  const { game, events } = runTicks(IDLE_INPUT, 11, (state) => {
    job = state.fareJobs[state.jobIndex];
    state.x = job.dropoff.x;
    state.y = job.dropoff.y;
    state.onboard = true;
    state.elapsed = 10;
    state.jobStartedAt = 0;
  });
  const quote = passengerDistanceQuote(job);
  const legTime = 10 + FIXED_DT * 11;
  const quick = Math.round(Math.max(0, quote.parSeconds - legTime) * 35);
  const expectedScore = Math.round((quote.baseScore + quick + 150) * 1.5);
  const expectedFare = Math.max(12, Math.round(expectedScore / 45));

  assert.equal(game.score, expectedScore);
  assert.equal(game.fare, expectedFare);
  assert.equal(game.deliveries, 1);
  assert.equal(game.combo, 1.5);
  assert.equal(game.bestMultiplier, 1.5);
  assert.equal(game.boost, 73);
  approximate(game.timeLeft, 75 + quote.dropoffSeconds - FIXED_DT * 11);
  assert.notEqual(game.fareJobs[game.jobIndex].id, job.id);
  assert.equal(game.onboard, false);
  approximate(game.objectiveLockUntil, 11.183333333333342);
  assert.equal(game.particles.length, 24);
  assert.deepEqual(events, [{
    type: "dropoff",
    fareId: job.id,
    fareNumber: job.passengerArtCell + 1,
    artCell: job.destinationArtCell,
    rider: job.rider,
    destination: job.destination,
    fareAward: expectedFare,
    bonusSeconds: quote.dropoffSeconds,
    multiplier: 1.5,
    runKind: "timed",
  }]);
});

test("passenger events report only meter time actually credited at the cap", () => {
  const game = makeGame();
  game.traffic = [];
  const job = game.fareJobs[game.jobIndex];
  game.x = job.pickup.x;
  game.y = job.pickup.y;
  game.timeLeft = 98.4;
  game.lastBeep = 10;
  const events = [];
  for (let tick = 0; tick < 11; tick += 1) {
    events.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  const pickup = events.find((event) => event.type === "pickup");
  assert.ok(pickup && pickup.type === "pickup");
  assert.equal(pickup.bonusSeconds, 0.8);
  approximate(game.timeLeft, 99 - FIXED_DT);
  assert.equal(game.lastBeep, 11);
});

test("Free Run passenger loops keep time fixed and remove hidden quick-time pressure", () => {
  const driving = makeGame("street-ace", 321, "free-run");
  driving.traffic = [];
  driving.timeLeft = 0.01;
  for (let tick = 0; tick < 120; tick += 1) {
    assert.deepEqual(stepGame(driving, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1), []);
  }
  assert.equal(driving.timeLeft, 0.01);
  approximate(driving.elapsed, 2);

  const pickupGame = makeGame("street-ace", 321, "free-run");
  pickupGame.traffic = [];
  const pickupJob = pickupGame.fareJobs[pickupGame.jobIndex];
  pickupGame.x = pickupJob.pickup.x;
  pickupGame.y = pickupJob.pickup.y;
  const pickupEvents = [];
  for (let tick = 0; tick < 11; tick += 1) {
    pickupEvents.push(...stepGame(pickupGame, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  assert.equal(pickupGame.timeLeft, 75);
  assert.deepEqual(pickupEvents, [{
    type: "pickup",
    fareId: pickupJob.id,
    fareNumber: pickupJob.passengerArtCell + 1,
    artCell: pickupJob.passengerArtCell,
    rider: pickupJob.rider,
    destination: pickupJob.destination,
    bonusSeconds: 0,
    runKind: "free-run",
  }]);

  const dropoffGame = makeGame("street-ace", 321, "free-run");
  dropoffGame.traffic = [];
  const dropoffJob = dropoffGame.fareJobs[dropoffGame.jobIndex];
  const quote = passengerDistanceQuote(dropoffJob);
  dropoffGame.x = dropoffJob.dropoff.x;
  dropoffGame.y = dropoffJob.dropoff.y;
  dropoffGame.onboard = true;
  dropoffGame.elapsed = 1;
  dropoffGame.jobStartedAt = 0;
  const dropoffEvents = [];
  for (let tick = 0; tick < 11; tick += 1) {
    dropoffEvents.push(...stepGame(dropoffGame, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  const expectedScore = Math.round((quote.baseScore + 150) * 1.5);
  const expectedFare = Math.max(12, Math.round(expectedScore / 45));
  assert.equal(dropoffGame.timeLeft, 75);
  assert.equal(dropoffGame.score, expectedScore);
  assert.equal(dropoffGame.fare, expectedFare);
  assert.deepEqual(dropoffEvents, [{
    type: "dropoff",
    fareId: dropoffJob.id,
    fareNumber: dropoffJob.passengerArtCell + 1,
    artCell: dropoffJob.destinationArtCell,
    rider: dropoffJob.rider,
    destination: dropoffJob.destination,
    fareAward: expectedFare,
    bonusSeconds: 0,
    multiplier: 1.5,
    runKind: "free-run",
  }]);
});

test("clock warning is emitted once when crossing a displayed second", () => {
  const game = makeGame();
  game.traffic = [];
  game.timeLeft = 10.01;

  assert.deepEqual(
    stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1),
    [{ type: "clock-warning", secondsRemaining: 10 }],
  );
  assert.equal(game.lastBeep, 10);
  assert.deepEqual(
    stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1),
    [],
  );
});

test("the run meter pauses outside an empty taxi while simulation time continues", () => {
  const game = makeGame();
  game.traffic = [];
  game.timeLeft = 10.01;

  assert.deepEqual(stepGame(
    game,
    { ...IDLE_INPUT, interact: true },
    FIXED_DT,
    EMPTY_WORLD,
    () => 1,
  ), [{ type: "vehicle-exited" }]);
  assert.equal(game.timeLeft, 10.01);
  assert.equal(game.lastBeep, 11);

  stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1);
  for (let tick = 0; tick < 60; tick += 1) {
    assert.deepEqual(stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1), []);
  }
  assert.equal(game.timeLeft, 10.01);
  assert.ok(game.elapsed > 1);

  assert.deepEqual(stepGame(
    game,
    { ...IDLE_INPUT, interact: true },
    FIXED_DT,
    EMPTY_WORLD,
    () => 1,
  ), [
    { type: "vehicle-entered" },
    { type: "clock-warning", secondsRemaining: 10 },
  ]);
  approximate(game.timeLeft, 10.01 - FIXED_DT);
});

test("an onboard passenger keeps the run meter live outside the taxi", () => {
  const game = makeGame();
  game.traffic = [];
  game.onboard = true;
  game.timeLeft = 10.01;

  assert.deepEqual(stepGame(
    game,
    { ...IDLE_INPUT, interact: true },
    FIXED_DT,
    EMPTY_WORLD,
    () => 1,
  ), [
    { type: "vehicle-exited" },
    { type: "clock-warning", secondsRemaining: 10 },
  ]);
  approximate(game.timeLeft, 10.01 - FIXED_DT);
  assert.equal(game.lastBeep, 10);

  assert.deepEqual(stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1), []);
  approximate(game.timeLeft, 10.01 - FIXED_DT * 2);

  assert.deepEqual(stepGame(
    game,
    { ...IDLE_INPUT, interact: true },
    FIXED_DT,
    EMPTY_WORLD,
    () => 1,
  ), [{ type: "vehicle-entered" }]);
  approximate(game.timeLeft, 10.01 - FIXED_DT * 3);
});

test("the run meter also stays frozen inside a pocket venue", () => {
  const game = makeGame();
  const venue = { id: "clock-shop", kind: "shop" as const, label: "QUICKBYTE" };
  game.traffic = [];
  game.timeLeft = 5.5;
  game.player = {
    kind: "walking",
    actor: { x: 0, y: 8.3, vx: 0, vy: 0, heading: -Math.PI / 2, speed: 0 },
    location: { kind: "interior", venue, returnPose: { x: 0, y: 0, heading: 0 } },
  };
  for (let tick = 0; tick < 60; tick += 1) {
    assert.deepEqual(stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1), []);
  }
  assert.equal(game.timeLeft, 5.5);
  approximate(game.elapsed, 1);
  assert.equal(game.lastBeep, 11);
});

test("an onboard passenger keeps the run meter live inside a pocket venue", () => {
  const game = makeGame();
  const venue = { id: "live-clock-shop", kind: "shop" as const, label: "QUICKBYTE" };
  game.traffic = [];
  game.onboard = true;
  game.timeLeft = 20.5;
  game.player = {
    kind: "walking",
    actor: { x: 0, y: 8.3, vx: 0, vy: 0, heading: -Math.PI / 2, speed: 0 },
    location: { kind: "interior", venue, returnPose: { x: 0, y: 0, heading: 0 } },
  };
  for (let tick = 0; tick < 60; tick += 1) {
    assert.deepEqual(stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1), []);
  }
  approximate(game.timeLeft, 19.5);
  approximate(game.elapsed, 1);
});
