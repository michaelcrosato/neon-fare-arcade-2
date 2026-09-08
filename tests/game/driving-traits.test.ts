import assert from "node:assert/strict";
import test from "node:test";

import { applyCareerRunBonuses } from "../../game/career";
import {
  FIXED_DT,
  SPEED_KMH_PER_WORLD_UNIT,
  TAXI_TOP_SPEED_KMH,
} from "../../game/config";
import {
  DRIVING_TRAIT_PACKAGES,
  drivingTraitPackage,
} from "../../game/driving-traits";
import type { DrivingTraitId, InputState, WorldView } from "../../game/model";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";
import { makeTestCareer } from "./support/fixtures";

const EMPTY_WORLD: WorldView = {
  key: "trait-test",
  boxes: [],
  colliders: [],
  chunks: [],
  interactions: [],
};

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

function runTrait(
  drivingTraitId: DrivingTraitId,
  input: InputState,
  ticks = 60,
) {
  const game = makeGame(drivingTraitId);
  game.traffic = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    stepGame(game, input, FIXED_DT, EMPTY_WORLD, () => 1);
  }
  return game;
}

test("the driver draft exposes exactly three complete and finite packages", () => {
  assert.deepEqual(
    DRIVING_TRAIT_PACKAGES.map((trait) => trait.id),
    ["street-ace", "drift-demon", "redline-rush"],
  );
  assert.equal(new Set(DRIVING_TRAIT_PACKAGES.map((trait) => trait.id)).size, 3);
  for (const trait of DRIVING_TRAIT_PACKAGES) {
    assert.equal(drivingTraitPackage(trait.id), trait);
    assert.equal(trait.highlights.length, 3);
    assert.ok(Object.values(trait.stats).every((value) => value >= 1 && value <= 5));
    assert.ok(Object.values(trait.modifiers).every((value) => Number.isFinite(value) && value > 0));
    assert.ok(trait.modifiers.maxBoostSpeed >= trait.modifiers.maxForwardSpeed);
    assert.ok(trait.modifiers.initialBoost <= 100);
  }
});

test("Street Ace preserves straight launch and reverse tuning under progressive steering", () => {
  const forward = runTrait("street-ace", { ...IDLE_INPUT, up: true });
  approximate(forward.x, 0);
  approximate(forward.y, -6.298771745502387);
  approximate(forward.speed, 16.266791511819967);
  approximate(forward.boost, 45);

  const steering = runTrait("street-ace", { ...IDLE_INPUT, up: true, right: true });
  assert.ok(steering.x > 6);
  assert.ok(steering.steering > 0.99);
  assert.ok(steering.driftIntensity > 0.1);
  assert.ok(Math.abs(steering.driftAngle) > 0);
  assert.ok(steering.boost > 45);

  const boosted = runTrait("street-ace", { ...IDLE_INPUT, up: true, boost: true });
  assert.ok(boosted.speed > 32);
  approximate(boosted.boost, 20);
});

test("Drift Demon holds a larger slip angle and converts it into more charge and score", () => {
  const runSlide = (drivingTraitId: DrivingTraitId) => {
    const game = makeGame(drivingTraitId);
    game.traffic = [];
    game.x = -40;
    game.y = 0;
    game.heading = 0;
    game.vx = 40;
    game.vy = 0;
    for (let tick = 0; tick < 24; tick += 1) {
      stepGame(
        game,
        { ...IDLE_INPUT, up: true, right: true },
        FIXED_DT,
        EMPTY_WORLD,
        () => 1,
      );
    }
    return game;
  };
  const street = runSlide("street-ace");
  const drift = runSlide("drift-demon");
  const streetAngleDegrees = Math.abs(street.driftAngle) * 180 / Math.PI;
  const driftAngleDegrees = Math.abs(drift.driftAngle) * 180 / Math.PI;

  assert.ok(streetAngleDegrees > 9 && streetAngleDegrees < 12);
  assert.ok(driftAngleDegrees > 11.5 && driftAngleDegrees < 15);
  assert.ok(Math.abs(drift.driftAngle) > Math.abs(street.driftAngle) * 1.15);
  assert.ok(drift.boost > street.boost);
  assert.ok(drift.driftBank > street.driftBank * 1.4);
  assert.ok(drift.score > street.score);
});

test("brake-tap rotation follows each package's drift character", () => {
  const kickGain = (drivingTraitId: DrivingTraitId) => {
    const prepared = makeGame(drivingTraitId);
    prepared.traffic = [];
    prepared.x = -40;
    prepared.y = 0;
    prepared.heading = 0;
    prepared.vx = 40;
    prepared.vy = 0;
    prepared.steering = 1;
    prepared.drifting = true;
    prepared.driftIntensity = 0.6;
    const kicked = structuredClone(prepared);
    const heldControl = structuredClone(prepared);
    heldControl.brakeInputHeld = true;
    const brakeRight = { ...IDLE_INPUT, down: true, right: true };
    const events = stepGame(kicked, brakeRight, FIXED_DT, EMPTY_WORLD, () => 1);
    stepGame(heldControl, brakeRight, FIXED_DT, EMPTY_WORLD, () => 1);
    assert.equal(events.filter((event) => event.type === "brake-drift-kick").length, 1);
    assert.ok(kicked.speed < heldControl.speed);
    return kicked.heading - heldControl.heading;
  };

  const streetGain = kickGain("street-ace");
  const driftGain = kickGain("drift-demon");
  const redlineGain = kickGain("redline-rush");
  assert.ok(driftGain > streetGain * 1.05);
  assert.ok(streetGain > redlineGain * 1.1);
});

test("Redline Rush starts hotter and shares the realistic boost ceiling without changing reverse", () => {
  const street = runTrait("street-ace", { ...IDLE_INPUT, up: true });
  const redline = runTrait("redline-rush", { ...IDLE_INPUT, up: true });
  assert.equal(redline.boost, 60);
  assert.ok(redline.speed > street.speed + 2);
  approximate(redline.y, -7.388496154265946);
  approximate(redline.speed, 18.40280878115924);

  const boosted = runTrait("redline-rush", { ...IDLE_INPUT, up: true, boost: true });
  assert.ok(boosted.speed > 36);
  approximate(boosted.boost, 30.674999999999866);

  const reverse = runTrait("redline-rush", { ...IDLE_INPUT, down: true });
  approximate(reverse.y, 5.745953882470124);
  approximate(reverse.speed, 7);
});

test("every driver package tops out at the same realistic boosted cab speed", () => {
  for (const trait of DRIVING_TRAIT_PACKAGES) {
    const game = makeGame(trait.id);
    game.traffic = [];
    game.x = 0;
    game.y = 0;
    game.heading = 0;
    game.vx = 100;
    game.vy = 0;
    game.boost = 100;
    stepGame(
      game,
      { ...IDLE_INPUT, boost: true },
      FIXED_DT,
      EMPTY_WORLD,
      () => 1,
    );
    approximate(game.speed * SPEED_KMH_PER_WORLD_UNIT, TAXI_TOP_SPEED_KMH - 10);
  }
});

test("run packages are isolated and permanent career bonuses compose after selection", () => {
  const street = makeGame("street-ace");
  const drift = makeGame("drift-demon");
  const redline = makeGame("redline-rush");
  assert.deepEqual(
    [street.boost, drift.boost, redline.boost],
    [45, 45, 60],
  );

  const career = makeTestCareer({
    owned: ["neon-loft", "garage-base", "boost-locker", "dispatch-desk"],
  });
  for (const game of [street, drift, redline]) {
    applyCareerRunBonuses(game, career);
    assert.equal(game.boost, 65);
    assert.equal(game.timeLeft, 80);
  }

  const freshDrift = makeGame("drift-demon");
  assert.equal(freshDrift.drivingTraitId, "drift-demon");
  assert.equal(freshDrift.boost, 45);
  assert.equal(freshDrift.timeLeft, 75);
  assert.equal(freshDrift.elapsed, 0);
});
