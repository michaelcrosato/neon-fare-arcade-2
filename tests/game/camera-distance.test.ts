import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CAMERA_DISTANCE_SCALE, cameraDistanceScale, defaultCameraBoom } from "../../game/config";
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

test("starting camera distance scale is 4x for chase-low, chase-high, and fixed while excluding cab", () => {
  const game = makeGame();
  assert.equal(DEFAULT_CAMERA_DISTANCE_SCALE, 4);
  assert.equal(cameraDistanceScale(undefined), 4);
  assert.equal(defaultCameraBoom("chase-low"), 9.5 * 4);
  assert.equal(defaultCameraBoom("chase-high"), 14 * 4);
  assert.equal(defaultCameraBoom("fixed"), 0);
  assert.equal(defaultCameraBoom("cab"), 0);

  const defaultChaseLow: Camera = {
    x: 0, y: 0, zoom: 1, heading: 0, mode: "chase-low", boom: defaultCameraBoom("chase-low"),
    heightOffset: 0, onFoot: false, distanceScale: DEFAULT_CAMERA_DISTANCE_SCALE,
  };
  assert.equal(behindTaxi(defaultChaseLow), 9.5 * 4);

  const defaultChaseHigh: Camera = {
    x: 0, y: 0, zoom: 1, heading: 0, mode: "chase-high", boom: defaultCameraBoom("chase-high"),
    heightOffset: 0, onFoot: false, distanceScale: DEFAULT_CAMERA_DISTANCE_SCALE,
  };
  assert.equal(behindTaxi(defaultChaseHigh), 14 * 4);

  const defaultFixed: Camera = {
    x: 0, y: 0, zoom: 1, heading: 0, mode: "fixed", boom: defaultCameraBoom("fixed"),
    heightOffset: 0, onFoot: false, distanceScale: DEFAULT_CAMERA_DISTANCE_SCALE,
  };
  const fixed = cameraFraming(game, defaultFixed);
  assert.deepEqual(fixed.eye, [100, 100, 116]);
  assert.equal(fixed.orthoHalfHeight, 80);

  const defaultCab: Camera = {
    x: 0, y: 0, zoom: 1, heading: 0, mode: "cab", boom: defaultCameraBoom("cab"),
    heightOffset: 0, onFoot: false, distanceScale: DEFAULT_CAMERA_DISTANCE_SCALE,
  };
  const cab1x = cameraFraming(game, cameraAt("cab", 1));
  assert.deepEqual(cameraFraming(game, defaultCab).eye, cab1x.eye);
});
