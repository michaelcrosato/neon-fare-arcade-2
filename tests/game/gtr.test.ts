import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { VEHICLES } from "../../game/vehicles";
import { normalizeFuelTanks } from "../../game/fuel-specs";
import { applyCareerRunBonuses, normalizeCareerState } from "../../game/career";
import { stepSimulationVehicle, simulationVehicleSpecs } from "../../game/simulation-vehicle";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import { detailedTaxiSurfaces, MAX_VEHICLE_SURFACE_FACES, usesVehicleMesh } from "../../game/render/detailed-vehicles";
import { taxiBoxes } from "../../game/render/scene";
import { TEST_IDLE_INPUT } from "./support/fixtures";
import type { Camera } from "../../game/model";

test("the third bay is a black automatic-only GT-R in every mode", () => {
  assert.equal(VEHICLES.length, 3);
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 91, "free-run", model, "gtr-r35", "manual");
    assert.equal(game.transmissionMode, "automatic");
    assert.equal(game.fare, 0);
    assert.equal(simulationVehicleSpecs(game.vehicleId).forwardGearRatios.length, 7);
    assert.ok(usesVehicleMesh(game, { vehicleDetail: "classic" } as Camera));
    assert.ok(taxiBoxes(game).length < 96);
    const mesh = detailedTaxiSurfaces(game);
    assert.ok(mesh.length > 100 && mesh.length <= MAX_VEHICLE_SURFACE_FACES);
    assert.ok(mesh.every(face => face.corners.every(p => [p.x, p.y, p.z].every(Number.isFinite))));
    assert.notDeepEqual(mesh, detailedTaxiSurfaces(makeGame()));
  }
});

test("existing career saves initialize a full GT-R tank without losing the other tanks", () => {
  const tanks = normalizeFuelTanks({ "crown-cab": 20, "accord-v6": 12 });
  assert.deepEqual(tanks, { "crown-cab": 20, "accord-v6": 12, "gtr-r35": 73.8 });
  const game = makeGame("street-ace", 91, "free-run", "simulation", "gtr-r35");
  applyCareerRunBonuses(game, normalizeCareerState({ fuelTanks: { "accord-v6": 12 } }));
  assert.equal(game.fuel.litres, 73.8);
});

test("GT-R simulation launches through six automatic gears and brakes to reverse", () => {
  const game = makeGame("street-ace", 91, "free-run", "simulation", "gtr-r35");
  game.heading = 0;
  const gears = new Set<number>();
  let timeTo60 = 0;
  for (let tick = 0; tick < 3600; tick++) {
    stepSimulationVehicle(game, { ...TEST_IDLE_INPUT, up: true }, FIXED_DT, true);
    gears.add(game.simulationVehicle.gear);
    if (!timeTo60 && game.speed * SPEED_KMH_PER_WORLD_UNIT >= 96.56) timeTo60 = tick * FIXED_DT;
  }
  assert.ok(timeTo60 > 2.5 && timeTo60 < 5.5, `AWD launch ${timeTo60.toFixed(2)} s`);
  assert.deepEqual([...gears], [1, 2, 3, 4, 5, 6]);
  assert.ok(game.speed * SPEED_KMH_PER_WORLD_UNIT > 240);
  assert.equal(game.transmission.stuck, false);
  for (let tick = 0; tick < 1800; tick++) stepSimulationVehicle(game, { ...TEST_IDLE_INPUT, down: true }, FIXED_DT, true);
  assert.equal(game.simulationVehicle.gear, -1);
  assert.ok(game.vx < 0);
});
