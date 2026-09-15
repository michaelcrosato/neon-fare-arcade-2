import test from "node:test";
import assert from "node:assert/strict";
import { makeGame } from "../../game/state";
import { detailedTaxiSurfaces, detailedVehicleModel, MAX_VEHICLE_SURFACE_FACES } from "../../game/render/detailed-vehicles";
import { packSurfaceQuads, SURFACE_VERTEX_BYTES } from "../../game/render/surfaces";

test("both detailed vehicles have bounded, nondegenerate polygon geometry and distinct silhouettes", () => {
  const lengths: number[] = [];
  for (const id of ["accord-v6", "crown-cab"] as const) {
    const game = makeGame("street-ace", 1, "free-run"), model = detailedVehicleModel(id);
    game.vehicleId = id;
    const faces = detailedTaxiSurfaces(game);
    assert.ok(faces.length >= (id === "accord-v6" ? 250 : 901) && faces.length <= MAX_VEHICLE_SURFACE_FACES);
    assert.equal(model, detailedVehicleModel(id), "local geometry is cached");
    const vertices = packSurfaceQuads(faces);
    assert.ok(vertices.every(Number.isFinite));
    assert.ok(vertices.byteLength <= MAX_VEHICLE_SURFACE_FACES * 6 * SURFACE_VERTEX_BYTES);
    const xs = model.body.flatMap(f => f.corners.map(p => p.x));
    lengths.push(Math.max(...xs) - Math.min(...xs));
    assert.ok(new Set(model.wheels[0].faces.flatMap(f => f.corners.map(p => p.x.toFixed(3)))).size >= (id === "accord-v6" ? 5 : 16), "round wheels retain their authored segment counts");
  }
  assert.ok(lengths[1] > lengths[0] + .3, "the sedan is longer than the coupe");
});

test("detailed geometry follows the taxi's road frame and remains finite through a rollover", () => {
  const game = makeGame("street-ace", 1, "free-run");
  game.vehicleId = "accord-v6";
  const before = detailedTaxiSurfaces(game);
  game.z += 12;
  const after = detailedTaxiSurfaces(game);
  assert.ok(Math.abs(after[0].corners[0].z - before[0].corners[0].z - 12) < 1e-6);
  game.drivingModel = "simulation";
  game.simulationVehicle.bodyRoll = Math.PI * .75;
  game.simulationVehicle.bodyPitch = .3;
  game.steering = 1;
  assert.ok(packSurfaceQuads(detailedTaxiSurfaces(game)).every(Number.isFinite));
});
