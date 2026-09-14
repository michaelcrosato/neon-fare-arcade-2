import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { makeCareerState } from "../../game/career";
import { FUEL_SPECS } from "../../game/fuel-specs";
import { fuelHud, makeFuel, purchaseFuel, speedingFuelMultiplier, stepFuel } from "../../game/fuel";
import { stepRepairLot } from "../../game/vehicle-damage";
import { stepGame } from "../../game/simulation";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import type { DrivingModel, RunKind, VehicleId, WorldView } from "../../game/model";
import { recoverToRoad } from "../../game/recovery";

const emptyWorld: WorldView = { key: "fuel", boxes: [], colliders: [], chunks: [], interactions: [] };
const gas = { id: "fuel-station", kind: "gas" as const, label: "GO-GO GAS" };
const lot: WorldView = { ...emptyWorld, interactions: [{ id: gas.id, kind: "venue-entrance", venue: gas,
  label: gas.label, x: 0, y: 0, z: 0, heading: 0, radius: 2, serviceLot: { x: 0, y: 0, halfX: 10, halfY: 10 } }] };

test("rated tanks vary by vehicle and steady distance consumes published combined litres", () => {
  for (const id of ["crown-cab", "accord-v6"] satisfies VehicleId[]) {
    const game = makeGame("street-ace", 921, "free-run", "arcade", id);
    const spec = FUEL_SPECS[id];
    game.vx = 50 / SPEED_KMH_PER_WORLD_UNIT; game.vy = 0;
    game.fuel = makeFuel(id); game.fuel.speedLimitKmh = 50;
    stepFuel(game, 1, 10_000);
    assert.ok(Math.abs(game.fuel.litres - (spec.tankLitres - spec.combinedL100km / 10)) < 1e-8);
    assert.equal(game.fuel.distanceKm, 10);
    const fullRange = spec.tankLitres / spec.combinedL100km * 100;
    assert.ok(fullRange > 570 && fullRange < 610);
  }
  assert.equal(speedingFuelMultiplier(50, 50), 1);
  assert.ok(speedingFuelMultiplier(55, 50) > 1 && speedingFuelMultiplier(55, 50) < 2);
  assert.equal(speedingFuelMultiplier(75, 50), 2);
  assert.equal(speedingFuelMultiplier(180, 100), 2);
});

test("speeding halves steady range, while parked walking and interiors burn no fuel", () => {
  const game = makeGame("street-ace", 922, "free-run", "arcade", "accord-v6");
  game.vx = 75 / SPEED_KMH_PER_WORLD_UNIT; game.vy = 0; game.fuel.speedLimitKmh = 50;
  stepFuel(game, 1, 10_000);
  assert.ok(Math.abs(game.fuel.litres - (65 - 2 * 10.9 / 10)) < 1e-8);
  assert.equal(fuelHud(game).multiplier, 2);
  game.vx = 0;
  const beforeIdle = game.fuel.litres; stepFuel(game, 3600, 0);
  assert.ok(Math.abs(beforeIdle - game.fuel.litres - .9) < 1e-8);
  game.player = { kind: "walking", actor: { x: 0, y: 0, vx: 0, vy: 0, speed: 0, heading: 0 }, location: { kind: "city" } };
  const beforeWalk = game.fuel.litres; stepFuel(game, 3600, 1000);
  assert.equal(game.fuel.litres, beforeWalk);
});

test("empty tanks disable forward, reverse and boost in every mode without disabling brakes", () => {
  for (const drivingModel of ["arcade", "simulation"] satisfies DrivingModel[]) {
    for (const vehicleId of ["crown-cab", "accord-v6"] satisfies VehicleId[]) for (const runKind of ["timed", "free-run"] satisfies RunKind[]) for (const shift of vehicleId === "accord-v6" ? ["automatic", "manual"] as const : ["automatic"] as const) {
      const game = makeGame("street-ace", 923, runKind, drivingModel, vehicleId, shift);
      game.x = 0; game.y = 0; game.z = 0; game.heading = 0; game.vx = 0; game.vy = 0;
      game.fuel = makeFuel(vehicleId, 0); game.fuel.nextLimitCheck = Infinity;
      for (let i = 0; i < 120; i++) stepGame(game, { up: true, down: false, left: false, right: false, boost: true }, FIXED_DT, emptyWorld, () => .5);
      assert.ok(Math.hypot(game.vx, game.vy) < .1, `${drivingModel}/${vehicleId}/${runKind} must not accelerate empty`);
      assert.equal(game.boosting, false);
      if (shift === "manual") game.transmission.gear = -1;
      for (let i = 0; i < 30; i++) stepGame(game, { up: true, down: false, left: false, right: false, boost: false }, FIXED_DT, emptyWorld, () => .5);
      assert.ok(Math.hypot(game.vx, game.vy) < .1, "an empty manual reverse gear must not drive");
      for (let i = 0; i < 120; i++) stepGame(game, { up: false, down: true, left: false, right: false, boost: false }, FIXED_DT, emptyWorld, () => .5);
      assert.ok(Math.hypot(game.vx, game.vy) < .1, "brake must not become reverse engine power");
    }
  }
});

test("fuel purchases revalidate lot, motion and funds, debit run fare first, and never overfill", () => {
  const game = makeGame("street-ace", 924, "free-run", "arcade", "accord-v6");
  game.x = 0; game.y = 0; game.z = 0; game.vx = 0; game.vy = 0; game.fare = 6; game.fuel.litres = 60;
  const career = { ...makeCareerState(), bank: 100 };
  assert.equal(purchaseFuel(game, career, 5).status, "not-ready");
  stepRepairLot(game, lot, 1);
  for (const invalid of [NaN, Infinity, -5, 0]) {
    const before = structuredClone(game);
    const denied = purchaseFuel(game, career, invalid);
    assert.equal(denied.status, "not-ready"); assert.equal(denied.cost, 0); assert.deepEqual(game, before);
  }
  const result = purchaseFuel(game, career, 5);
  assert.equal(result.status, "purchased"); assert.equal(result.cost, 10); assert.equal(result.litres, 5);
  assert.equal(result.state.bank, 96); assert.equal(game.fare, 0); assert.equal(game.fuel.litres, 65);
  assert.equal(purchaseFuel(game, result.state, 5).status, "full");
  game.fuel.litres = 50; game.vx = 2;
  assert.equal(purchaseFuel(game, result.state, 5).status, "not-ready");
  game.vx = 0;
  assert.equal(purchaseFuel(game, { ...career, bank: 0 }, 5).status, "insufficient");
  game.x = 30;
  assert.equal(purchaseFuel(game, career, 5).status, "not-ready");
});

test("low and empty warnings fire once; rescue adds five litres only to an empty tank", () => {
  const game = makeGame("street-ace", 925, "free-run");
  game.fuel.litres = 1;
  assert.equal(stepFuel(game, 1, 1), "low");
  assert.equal(stepFuel(game, 1, 1), null);
  assert.equal(stepFuel(game, 1, 50_000), "empty");
  assert.equal(stepFuel(game, 1, 100), null);
  assert.equal(game.fuel.litres, 0);
  game.x = 0; game.y = 0; game.z = 0; game.traffic = [];
  assert.ok(recoverToRoad(game, () => emptyWorld));
  assert.equal(game.fuel.litres, 5);
  game.towRecovery = null;
  assert.ok(recoverToRoad(game, () => emptyWorld));
  assert.equal(game.fuel.litres, 5);
});
