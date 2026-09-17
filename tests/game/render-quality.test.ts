import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptResolution,
  initialAdaptiveState,
  MIN_RESOLUTION_SCALE,
  renderQuality,
  resolveRenderTier,
} from "../../game/render/quality";
import { cascadeSplits, SUN_DIRECTION, shadowCascades, frustumCorners } from "../../game/render/sun";
import { makeGame } from "../../game/state";
import { INSTANCE_FLOATS, packBoxes, packBoxesInto } from "../../game/render/packing";
import { cameraDepthRange, viewProjection } from "../../game/render/view-projection";
import { MAT_FOLIAGE } from "../../game/config";
import type { Box, Camera } from "../../game/model";

test("a discrete desktop GPU reaches the ultra tier", () => {
  const tier = resolveRenderTier({
    mobile: false,
    vendor: "nvidia",
    architecture: "lovelace",
    hardwareConcurrency: 24,
    deviceMemory: 8,
  });
  assert.equal(tier, "ultra");
  const quality = renderQuality(tier);
  assert.equal(quality.shadowCascades, 3);
  assert.equal(quality.sampleCount, 4);
  assert.equal(quality.ambientOcclusion, true);
});

test("a 2025 flagship phone keeps shadows and multisampling at a smaller budget", () => {
  const tier = resolveRenderTier({
    mobile: true,
    vendor: "qualcomm",
    architecture: "adreno-8xx",
    hardwareConcurrency: 8,
    deviceMemory: 8,
    devicePixelRatio: 3,
  });
  assert.equal(tier, "high");
  const quality = renderQuality(tier);
  assert.equal(quality.sampleCount, 4, "MSAA resolves in tile memory on mobile");
  assert.equal(quality.shadowCascades, 2);
  assert.equal(quality.shadowMapSize, 1024);
  assert.equal(quality.ambientOcclusion, false);
  assert.ok(quality.pixelBudget <= 2_500_000);
});

test("a low-core mobile device falls back to the plain path", () => {
  const tier = resolveRenderTier({ mobile: true, hardwareConcurrency: 4, deviceMemory: 3 });
  assert.equal(tier, "compatibility");
  const quality = renderQuality(tier);
  assert.equal(quality.shadowCascades, 0);
  assert.equal(quality.sampleCount, 1);
  assert.equal(quality.bloomLevels, 0);
});

test("a masked adapter on a capable desktop still gets effects", () => {
  const tier = resolveRenderTier({ mobile: false, hardwareConcurrency: 12, deviceMemory: 8 });
  assert.equal(tier, "balanced");
  assert.equal(renderQuality(tier).shadowCascades, 2);
});

test("adaptive resolution needs agreeing samples before it moves", () => {
  let state = initialAdaptiveState();
  state = adaptResolution(state, 30, 16.7);
  assert.equal(state.scale, 1, "one slow second is a hitch, not a trend");
  state = adaptResolution(state, 30, 16.7);
  assert.ok(state.scale < 1, "two agreeing samples lower the scale");
  const lowered = state.scale;
  state = adaptResolution(state, 5, 16.7);
  assert.equal(state.scale, lowered, "recovery is slower than degradation");
  for (let sample = 0; sample < 6; sample += 1) state = adaptResolution(state, 5, 16.7);
  assert.ok(state.scale > lowered, "a sustained fast run restores resolution");
});

test("adaptive resolution never collapses the scene surface", () => {
  let state = initialAdaptiveState();
  for (let sample = 0; sample < 200; sample += 1) state = adaptResolution(state, 100, 16.7);
  assert.equal(state.scale, MIN_RESOLUTION_SCALE);
});

test("the shared sun direction is a unit vector pointing up and east", () => {
  assert.ok(Math.abs(Math.hypot(...SUN_DIRECTION) - 1) < 1e-6);
  assert.ok(SUN_DIRECTION[0] > 0 && SUN_DIRECTION[2] > 0);
});

test("cascade splits cover the range and grow with distance", () => {
  const splits = cascadeSplits(3, 0.15, 300);
  assert.equal(splits.length, 3);
  assert.equal(splits[0].near, 0.15);
  assert.ok(Math.abs(splits[2].far - 300) < 1e-6);
  const spans = splits.map((split) => split.far - split.near);
  assert.ok(spans[0] < spans[1] && spans[1] < spans[2], "near slices stay dense");
  for (let index = 1; index < splits.length; index += 1) {
    assert.ok(splits[index].near < splits[index - 1].far, "consecutive slices overlap");
  }
});

function chaseCamera(): Camera {
  return { x: 12, y: -30, zoom: 1, heading: 0.7, mode: "chase-low", boom: 9, heightOffset: 0 };
}

test("shadow cascades stay finite, ordered and texel-snapped", () => {
  const game = makeGame();
  const cascades = shadowCascades(game, chaseCamera(), 16 / 9, 400, 3, 2048);
  assert.equal(cascades.length, 3);
  let previousFar = 0;
  for (const cascade of cascades) {
    assert.ok(cascade.far > previousFar);
    previousFar = cascade.far;
    assert.ok(cascade.texelWorldSize > 0 && cascade.texelWorldSize < 1);
    for (const value of cascade.matrix) assert.ok(Number.isFinite(value));
  }
  assert.ok(cascades[0].texelWorldSize < cascades[2].texelWorldSize);
});

test("a cascade contains the slice of the camera frustum it covers", () => {
  const game = makeGame();
  const camera = chaseCamera();
  const [cascade] = shadowCascades(game, camera, 16 / 9, 400, 1, 2048, 120);
  // Every corner of the shadowed camera frustum must project inside the light
  // clip volume, otherwise receivers sample outside the map and lose shadows.
  const corners = frustumCorners(cascade.matrix);
  assert.equal(corners.length, 8);
  const inside = (x: number, y: number, z: number) => {
    const m = cascade.matrix;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    const cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    const cz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return Math.abs(cx) <= 1.001 && Math.abs(cy) <= 1.001 && cz >= -0.001 && cz <= 1.001;
  };
  assert.ok(inside(camera.x, camera.y, 0), "the player's own ground is shadowed");
  assert.ok(inside(camera.x + 20, camera.y + 20, 12), "nearby rooftops are inside the cascade");
});

test("camera motion does not resize a cascade", () => {
  const game = makeGame();
  const still = shadowCascades(game, chaseCamera(), 16 / 9, 400, 2, 1024);
  const moved = shadowCascades(game, { ...chaseCamera(), x: 12.37, y: -29.11 }, 16 / 9, 400, 2, 1024);
  for (let index = 0; index < still.length; index += 1) {
    assert.equal(moved[index].texelWorldSize, still[index].texelWorldSize);
  }
});

test("turning in place does not resize a cascade", () => {
  const game = makeGame();
  const forward = shadowCascades(game, chaseCamera(), 16 / 9, 400, 2, 1024);
  const turned = shadowCascades(game, { ...chaseCamera(), heading: 2.4 }, 16 / 9, 400, 2, 1024);
  for (let index = 0; index < forward.length; index += 1) {
    assert.equal(turned[index].texelWorldSize, forward[index].texelWorldSize);
  }
});

test("scratch packing matches the allocating packer byte for byte", () => {
  const boxes: Box[] = [
    { x: 1, y: -2, z: 3, sx: 4, sy: 5, sz: 6, yaw: 0.4, color: [0.1, 0.2, 0.3, 1], material: MAT_FOLIAGE, pitch: 0.2, tilt: -0.3 },
    { x: -7, y: 8, z: 9, sx: 1, sy: 1, sz: 1, yaw: -1.1, color: [1, 0, 0.5, 0.4] },
  ];
  const expected = packBoxes(boxes);
  const scratch = new Float32Array(16 * INSTANCE_FLOATS).fill(99);
  const written = packBoxesInto(boxes, scratch);
  assert.equal(written, boxes.length * INSTANCE_FLOATS);
  assert.deepEqual(Array.from(scratch.subarray(0, written)), Array.from(expected));
});

test("scratch packing clears the reserved fields a reused buffer left behind", () => {
  const scratch = new Float32Array(2 * INSTANCE_FLOATS).fill(7);
  packBoxesInto([{ x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, yaw: 0, color: [1, 1, 1, 1] }], scratch);
  assert.equal(scratch[12], 0, "pitch defaults to zero");
  assert.equal(scratch[13], 0, "tilt defaults to zero");
  assert.equal(scratch[14], 0, "reserved field 14 is not stale");
  assert.equal(scratch[15], 0, "reserved field 15 is not stale");
});

test("scratch packing never writes past the buffer it was given", () => {
  const boxes: Box[] = Array.from({ length: 5 }, (unused, index) => ({
    x: index, y: 0, z: 0, sx: 1, sy: 1, sz: 1, yaw: 0, color: [1, 1, 1, 1],
  }));
  const scratch = new Float32Array(3 * INSTANCE_FLOATS);
  assert.equal(packBoxesInto(boxes, scratch), 3 * INSTANCE_FLOATS);
});

test("a near override slices the same camera without changing the default matrix", () => {
  const game = makeGame();
  const camera = chaseCamera();
  const base = viewProjection(game, camera, 16 / 9, 400);
  const again = viewProjection(game, camera, 16 / 9, 400, undefined);
  assert.deepEqual(Array.from(again), Array.from(base));
  const sliced = viewProjection(game, camera, 16 / 9, 60, 20);
  assert.notDeepEqual(Array.from(sliced), Array.from(base));
  for (const value of sliced) assert.ok(Number.isFinite(value));
});

test("the reported depth range matches what each camera projects with", () => {
  const game = makeGame();
  const chase = cameraDepthRange(game, chaseCamera(), 16 / 9, 400);
  assert.equal(chase.orthographic, false);
  assert.equal(chase.near, 0.15);
  assert.equal(chase.far, 400);
  assert.ok(chase.halfWidth > chase.halfHeight, "a wide viewport is wider than it is tall");

  const cab = cameraDepthRange(game, { ...chaseCamera(), mode: "cab" }, 16 / 9, 400);
  assert.equal(cab.near, 0.08, "the cab eye sits closer to its near plane");

  const fixed = cameraDepthRange(game, { ...chaseCamera(), mode: "fixed", distanceScale: 1 }, 2, 1200);
  assert.equal(fixed.orthographic, true);
  assert.equal(fixed.far, 140, "Fixed ISO keeps its own ortho depth, not the draw distance");
  assert.equal(fixed.halfHeight, 20, "the ortho box matches cameraFraming at scale one");
  assert.equal(fixed.halfWidth, fixed.halfHeight * 2);
  const zoomed = cameraDepthRange(game, { ...chaseCamera(), mode: "fixed", distanceScale: 8, zoom: 2 }, 2, 1200);
  assert.equal(zoomed.far, 140 * 8, "the ortho depth follows the distance setting");
  assert.equal(zoomed.halfHeight, 20 * 8 / 2, "zoom narrows the same ortho box");
});

test("a touchscreen desktop with a discrete GPU is not treated as a phone", () => {
  const tier = resolveRenderTier({
    // The layout breakpoint matches because the pointer is coarse.
    mobile: true,
    vendor: "nvidia",
    architecture: "lovelace",
    hardwareConcurrency: 24,
    deviceMemory: 8,
    devicePixelRatio: 1,
  });
  assert.equal(tier, "ultra");
});

test("a phone GPU stays on the phone budget even at a desktop width", () => {
  const tier = resolveRenderTier({
    mobile: false,
    vendor: "qualcomm",
    architecture: "adreno-8xx",
    hardwareConcurrency: 8,
    deviceMemory: 8,
  });
  assert.equal(tier, "high");
});
