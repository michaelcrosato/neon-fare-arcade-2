import assert from "node:assert/strict";
import test from "node:test";
import { clipPolygon, clipVertex, sphereInView } from "../../game/render/clip";
import { viewProjection, projectWorldPoint } from "../../game/render/view-projection";
import { makeGame } from "../../game/state";
import { defaultCameraBoom } from "../../game/config";
import type { Camera } from "../../game/model";

test("perspective cameras shrink distant objects and lift heads above feet", () => {
  const game = makeGame("street-ace", 1);
  for (const mode of ["chase-high", "chase-low", "cab"] as const) {
    const camera: Camera = { x: 0, y: 0, heading: -Math.PI / 2, heightOffset: 0, zoom: 1, mode, boom: defaultCameraBoom(mode) };
    const matrix = viewProjection(game, camera, 4 / 3, 400);
    const nearLeft = projectWorldPoint(matrix, -1, -10, 1, 800, 600)!;
    const nearRight = projectWorldPoint(matrix, 1, -10, 1, 800, 600)!;
    const farLeft = projectWorldPoint(matrix, -1, -30, 1, 800, 600)!;
    const farRight = projectWorldPoint(matrix, 1, -30, 1, 800, 600)!;
    assert.ok(nearRight.x - nearLeft.x > (farRight.x - farLeft.x) * 1.4, mode);
    assert.ok(projectWorldPoint(matrix, 0, -10, 2.8, 800, 600)!.y < projectWorldPoint(matrix, 0, -10, 0, 800, 600)!.y);
    assert.equal(sphereInView(matrix, 0, -10, 1, 2), true);
    assert.equal(sphereInView(matrix, 0, 200, 1, 2), false);
    assert.equal(sphereInView(matrix, 900, -10, 1, 2), false);
    assert.ok(clipVertex(matrix, {x:0,y:-10,z:1}).w > 0);
  }
});

test("near-plane crossings clip to finite coordinates, fully hidden faces are rejected", () => {
  const clipped = clipPolygon([{x:-0.5,y:0,z:-1,w:1},{x:0.5,y:0,z:0.5,w:1},{x:0,y:0.5,z:0.5,w:1}]);
  assert.equal(clipped.length, 4);
  assert.ok(clipped.every(p => p.z >= 0 && p.z <= p.w && p.w > 0));
  assert.equal(clipPolygon([{x:0,y:0,z:-3,w:1},{x:0.5,y:0,z:-2,w:1},{x:0,y:0.5,z:-2,w:1}]).length, 0);
  const eyeCrossing = clipPolygon([{x:0,y:0,z:-1,w:-1},{x:0.5,y:0,z:1,w:2},{x:0,y:0.5,z:1,w:2}]);
  assert.ok(eyeCrossing.length >= 3);
  assert.ok(eyeCrossing.every(p => Number.isFinite(p.x / p.w) && Number.isFinite(p.y / p.w)));
});
