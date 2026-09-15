import assert from "node:assert/strict";
import test from "node:test";
import data from "../../game/render/accord-balanced.json";
import { detailedTaxiSurfaces, detailedVehicleModel, usesVehicleMesh } from "../../game/render/detailed-vehicles";
import { taxiBoxes } from "../../game/render/scene";
import { makeGame } from "../../game/state";
import { packSurfaceQuads } from "../../game/render/surfaces";
import type { Camera } from "../../game/model";

test("Accord uses the supplied 372-triangle Balanced study in Classic and Detailed", () => {
  const game = makeGame("street-ace", 7, "free-run", "arcade", "accord-v6");
  game.x = 0; game.y = 0; game.z = 0; game.heading = 0;
  const faces = detailedTaxiSurfaces(game);
  assert.equal(faces.reduce((n, f) => n + f.corners.length - 2, 0), 372);
  assert.equal(data.triangles, 372);
  assert.equal(data.parts.length, 56);
  // Compare every authored vertex/color/face with the source asset at rest, independent of grouping order.
  const canonical = (corners: number[][], color: number[]) => JSON.stringify([corners.map(p => p.map(n => +n.toFixed(7))), color]);
  const source = data.parts.flatMap(p => p.faces.map(f => canonical(f.map(i => p.vertices[i].map((n, axis) => n + p.position[axis])), p.color))).sort();
  const actual = faces.map(f => canonical(f.corners.map(p => [p.x, p.y, p.z]), [...f.color])).sort();
  assert.deepEqual(actual, source);
  for (const detail of [undefined, "classic", "detailed"] as const) {
    assert.equal(usesVehicleMesh(game, { vehicleDetail: detail } as Camera), true);
    assert.equal(taxiBoxes(game, { includeGroundShadow: false }).length, 0, "retired Accord boxes cannot leak into either view");
  }
  assert.ok(packSurfaceQuads(faces).every(Number.isFinite));
});

test("Balanced wheels retain all four pivots and only the front pair steer", () => {
  const model = detailedVehicleModel("accord-v6");
  assert.equal(model.wheels.length, 4);
  assert.deepEqual(model.wheels.map(w => w.pivot), [
    { x: -1.38, y: -.814, z: .342 }, { x: -1.38, y: .814, z: .342 },
    { x: 1.365, y: -.814, z: .342 }, { x: 1.365, y: .814, z: .342 },
  ]);
  const game = makeGame("street-ace", 7, "free-run", "arcade", "accord-v6");
  const before = detailedTaxiSurfaces(game);
  game.steering = .8;
  const after = detailedTaxiSurfaces(game);
  let at = model.body.length;
  assert.deepEqual(after.slice(0, at), before.slice(0, at));
  for (const wheel of model.wheels) {
    const first = before.slice(at, at + wheel.faces.length), second = after.slice(at, at + wheel.faces.length);
    if (wheel.pivot.x > 0) assert.notDeepEqual(first, second);
    else assert.deepEqual(first, second);
    at += wheel.faces.length;
  }
});
