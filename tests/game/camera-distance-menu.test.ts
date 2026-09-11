import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { CAMERA_DISTANCE_SCALES } from "../../game/config";
import type { Camera } from "../../game/model";
import { requestedChaseBoom } from "../../game/render/view-projection";

const OVERLAY_PATH = resolve(import.meta.dirname, "../../app/game-session-overlays.tsx");

test("pause camera menu exposes 1x 2x 4x 8x and those values drive chase boom", () => {
  assert.deepEqual([...CAMERA_DISTANCE_SCALES], [1, 2, 4, 8]);
  const overlay = readFileSync(OVERLAY_PATH, "utf8");
  assert.match(overlay, /onSetCameraDistanceScale/);
  assert.match(overlay, /CAMERA_DISTANCE_SCALES\.map/);
  assert.match(overlay, /onSetCameraDistanceScale\(scale\)/);
  assert.match(overlay, /\{scale\}x/);

  const camera = (scale: 1 | 2 | 4 | 8): Camera => ({
    x: 0,
    y: 0,
    zoom: 1,
    heading: 0,
    mode: "chase-low",
    boom: 0,
    heightOffset: 0,
    distanceScale: scale,
  });
  assert.equal(requestedChaseBoom(camera(1)), 9.5);
  assert.equal(requestedChaseBoom(camera(8)), 76);
});
