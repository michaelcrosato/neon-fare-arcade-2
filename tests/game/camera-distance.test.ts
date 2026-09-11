import assert from "node:assert/strict";
import test from "node:test";

import type { Camera, CameraMode } from "../../game/model";
import { cabViewMatrix } from "../../game/render/cab-camera";
import { cameraFraming, requestedChaseBoom } from "../../game/render/view-projection";
import { makeGame } from "../../game/state";

function cameraAt(mode: CameraMode, scale: 1 | 2 | 4 | 8, extras: Partial<Camera> = {}): Camera {
  const camera: Camera = {
    x: 0,
    y: 0,
    zoom: 1,
    heading: 0,
    mode,
    boom: 0,
    heightOffset: 0,
    distanceScale: scale,
    ...extras,
  };
  if (mode === "chase-high" || mode === "chase-low") camera.boom = requestedChaseBoom(camera);
  return camera;
}

function behindTaxi(camera: Camera) {
  const { eye } = cameraFraming(makeGame(), camera);
  const forwardX = Math.cos(camera.heading);
  const forwardY = Math.sin(camera.heading);
  return -(eye[0] - camera.x) * forwardX - (eye[1] - camera.y) * forwardY;
}

test("1x chase and fixed framing match the current booms and iso eye", () => {
  const game = makeGame();
  assert.equal(behindTaxi(cameraAt("chase-low", 1)), 9.5);
  assert.equal(behindTaxi(cameraAt("chase-high", 1)), 14);
  assert.equal(behindTaxi(cameraAt("chase-low", 1, { onFoot: true })), 6.6);
  assert.equal(behindTaxi(cameraAt("chase-high", 1, { onFoot: true })), 10.5);

  const fixed = cameraFraming(game, cameraAt("fixed", 1));
  assert.deepEqual(fixed.eye, [25, 25, 29]);
  assert.equal(fixed.orthoHalfHeight, 20);
});

test("2x 4x and 8x multiply chase boom and fixed iso offset plus ortho span", () => {
  const game = makeGame();
  for (const scale of [2, 4, 8] as const) {
    assert.equal(behindTaxi(cameraAt("chase-low", scale)), 9.5 * scale);
    assert.equal(behindTaxi(cameraAt("chase-high", scale)), 14 * scale);
    assert.equal(behindTaxi(cameraAt("chase-low", scale, { onFoot: true })), 6.6 * scale);

    const fixed = cameraFraming(game, cameraAt("fixed", scale));
    assert.deepEqual(fixed.eye, [25 * scale, 25 * scale, 29 * scale]);
    assert.equal(fixed.orthoHalfHeight, 20 * scale);
  }
});

test("cab framing is identical at 1x and 8x", () => {
  const game = makeGame();
  const one = cameraAt("cab", 1);
  const eight = cameraAt("cab", 8);
  assert.deepEqual(cabViewMatrix(game, one), cabViewMatrix(game, eight));
  assert.deepEqual(cameraFraming(game, one).eye, cameraFraming(game, eight).eye);
});
