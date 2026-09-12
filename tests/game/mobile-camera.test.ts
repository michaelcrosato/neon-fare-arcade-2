import assert from "node:assert/strict";
import test from "node:test";
import { defaultCameraBoom } from "../../game/config";
import type { Camera, CameraMode } from "../../game/model";
import { chaseCameraEyeHeight, MOBILE_CAB_ANCHOR_Z, perspectiveSkyView } from "../../game/render/camera";
import { projectWorldPoint, viewProjection } from "../../game/render/view-projection";
import { makeGame } from "../../game/state";

const game = makeGame("street-ace", 714, "free-run");
const viewports = [[390, 844], [844, 390], [320, 568], [1280, 800]] as const;
function camera(mode: CameraMode, scale: 1 | 2 | 4 | 8, heading = -Math.PI / 2): Camera {
  return { x: game.x, y: game.y, heightOffset: game.z, heading, mode, mobile: true,
    boom: defaultCameraBoom(mode, scale), distanceScale: scale, zoom: 1 };
}

test("mobile chase places the cab at 75% height for every zoom, orientation, heading and shortened boom", () => {
  for (const mode of ["chase-high", "chase-low"] as const) {
    for (const scale of [1, 2, 4, 8] as const) {
      for (const [width, height] of viewports) {
        for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          for (const zoom of [1, .88]) {
            for (const boom of [2.4, defaultCameraBoom(mode, scale)]) {
              const view = { ...camera(mode, scale, heading), boom, zoom };
              const matrix = viewProjection(game, view, width / height, 1400);
              const cab = projectWorldPoint(matrix, game.x, game.y, game.z + MOBILE_CAB_ANCHOR_Z, width, height)!;
              assert.ok(cab, "cab stays in front of the camera");
              assert.ok(Math.abs(cab.x / width - .5) < .00001);
              assert.ok(Math.abs(cab.y / height - .75) < .00001);
            }
          }
        }
      }
    }
  }
});

test("mobile fixed camera leaves three quarters of its view ahead in every compass direction and zoom", () => {
  for (const scale of [1, 2, 4, 8] as const) {
    for (const [width, height] of viewports) {
      for (let index = 0; index < 8; index++) {
        const heading = index * Math.PI / 4;
        for (const zoom of [1, .84]) {
          const matrix = viewProjection(game, { ...camera("fixed", scale, heading), zoom }, width / height, 1400);
          const cab = projectWorldPoint(matrix, game.x, game.y, game.z + MOBILE_CAB_ANCHOR_Z, width, height)!;
          const ahead = projectWorldPoint(matrix, game.x + Math.cos(heading), game.y + Math.sin(heading), game.z + MOBILE_CAB_ANCHOR_Z, width, height)!;
          const dx = ahead.x - cab.x, dy = ahead.y - cab.y;
          assert.ok((width / 2 - cab.x) * dx + (height / 2 - cab.y) * dy > 0, "center is ahead of the cab");
          const offset = Math.max(Math.abs(cab.x / width - .5), Math.abs(cab.y / height - .5));
          assert.ok(Math.abs(offset - .25) < .00001, "trailing margin is a quarter of the screen");
        }
      }
    }
  }
});

test("mobile composition preserves cab and walking cameras", () => {
  for (const mode of ["chase-low", "chase-high", "fixed", "cab"] as const) {
    const view = camera(mode, 4);
    if (mode === "cab") {
      assert.deepEqual(viewProjection(game, view, .5, 1400), viewProjection(game, { ...view, mobile: false }, .5, 1400));
    }
    const walking = { ...game, player: { kind: "walking" as const,
      actor: { x: game.x, y: game.y, vx: 0, vy: 0, speed: 0, heading: game.heading }, location: { kind: "city" as const } } };
    assert.deepEqual(viewProjection(walking, { ...view, onFoot: true }, .5, 1400),
      viewProjection(walking, { ...view, onFoot: true, mobile: false }, .5, 1400));
  }
});

test("mobile chase preserves the road horizon and collision ray at every zoom", () => {
  for (const mode of ["chase-low", "chase-high"] as const) {
    for (const scale of [1, 2, 4, 8] as const) {
      const view = camera(mode, scale);
      const mobileSky = perspectiveSkyView(view)!;
      const desktopSky = perspectiveSkyView({ ...view, mobile: false })!;
      assert.ok(Math.abs(mobileSky.pitch - desktopSky.pitch) < .00001);
      const halfwayHeight = 1.65 + (chaseCameraEyeHeight(view) - 1.65) / 2;
      assert.ok(Math.abs(chaseCameraEyeHeight(view, view.boom / 2) - halfwayHeight) < .00001);
    }
  }
});
