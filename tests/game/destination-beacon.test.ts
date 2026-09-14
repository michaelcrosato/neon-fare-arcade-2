import assert from "node:assert/strict";
import test from "node:test";
import { MAT_BEACON, MAT_MARKER, RED } from "../../game/config";
import { makeGame, activePassengerJob } from "../../game/state";
import { farePresentationBoxes, dynamicBoxes } from "../../game/render/scene";
import { clipPolygon, clipVertex } from "../../game/render/clip";
import { lookAt, mat4Multiply, perspectiveZO } from "../../game/render/camera";
import { boxSurfaceFaces } from "../../game/render/surfaces";

test("the red destination beam remains anchored and readable beyond every regional draw distance", () => {
  const game = makeGame("street-ace", 82, "free-run");
  Object.assign(game, { x: 0, y: 0, z: 0, onboard: true });
  const job = activePassengerJob(game);
  for (const distance of [20, 400, 1200, 5000, 10000, 100000]) {
    job.dropoff = { x: distance, y: 0, z: 30 };
    const shapes = farePresentationBoxes(game, 0);
    const beam = shapes.filter(box => box.material === MAT_BEACON);
    const ring = shapes.filter(box => box.material === MAT_MARKER);
    assert.equal(beam.length, 14); assert.equal(ring.length, 14);
    assert.ok(beam.every(box => box.color[0] === RED[0] && box.color[3] === .2));
    assert.ok(beam.every(box => Math.abs(box.z - box.sz / 2 - 30) < 1e-8));
    assert.ok(beam.every(box => box.sz >= Math.max(120, distance)));
    assert.ok(beam.some(box => Math.abs(box.x - distance) >= Math.max(4, distance * .004)));
    assert.ok(ring.every(box => Math.hypot(box.x - distance, box.y) < 5), "arrival ring retains its true footprint");
    const matrix = mat4Multiply(perspectiveZO(Math.PI / 2, 1, .1, 400), lookAt([0, 0, 32], [distance, 0, 32]));
    const visibleFaces = beam.flatMap(boxSurfaceFaces).filter(face => clipPolygon(face.corners.map(point => clipVertex(matrix, point, true))).length >= 3);
    assert.ok(visibleFaces.length > 0, `beam disappeared at ${distance} m`);
    if (distance > 1200) assert.ok(beam.flatMap(boxSurfaceFaces).every(face => clipPolygon(face.corners.map(point => clipVertex(matrix, point))).length === 0));
  }
  game.player = { kind: "walking", actor: { x: 0, y: 0, z: 0, heading: 0, vx: 0, vy: 0, speed: 0 }, location: { kind: "interior", venue: { id: "home", kind: "home", label: "Home" }, returnPose: { x: 0, y: 0, heading: 0 } } };
  assert.equal(dynamicBoxes(game, 0, []).filter(box => box.material === MAT_BEACON).length, 0);
});

test("unlimited beacon depth preserves near-plane clipping and ordinary occlusion", () => {
  const matrix = mat4Multiply(perspectiveZO(Math.PI / 2, 1, .1, 400), lookAt([0, 0, 2], [100, 0, 2]));
  const near = { x: 20, y: 0, z: 2 }, distant = { x: 8000, y: 0, z: 2 };
  assert.deepEqual(clipVertex(matrix, near, true), clipVertex(matrix, near));
  const far = clipVertex(matrix, distant, true), foreground = clipVertex(matrix, near);
  assert.ok(far.z < far.w && far.z / far.w > foreground.z / foreground.w);
  const behind = [{ x: -10, y: -1, z: 1 }, { x: -10, y: 1, z: 1 }, { x: -10, y: 0, z: 3 }];
  assert.equal(clipPolygon(behind.map(point => clipVertex(matrix, point, true))).length, 0);
});
