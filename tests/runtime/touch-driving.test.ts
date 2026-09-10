import assert from "node:assert/strict";
import test from "node:test";
import { TouchDriving, mergeDrivingInput } from "../../app/runtime/touch-driving";
import { TEST_IDLE_INPUT } from "../game/support/fixtures";

test("floating thumbstick is proportional, clamps travel, and releases to neutral", () => {
  const touch = new TouchDriving();
  touch.start(1, "steer", 190, 200, 0);
  touch.move(1, 195, 180); assert.equal(touch.input().steer, 0);
  touch.move(1, 221, 150); assert.equal(touch.input().steer, .5);
  touch.move(1, 2, 190); assert.equal(touch.input().steer, -1);
  touch.end(1, 800); assert.equal(touch.input().steer, 0);
  assert.equal(touch.snapshot().thumb, null);
});

test("gas and brake can steer, independently release, and survive a second steering finger", () => {
  const touch = new TouchDriving();
  touch.start(1, "gas", 300, 700, 0); touch.move(1, 269, 700);
  assert.equal(touch.input().up, true); assert.equal(touch.input().steer, -.5);
  touch.start(2, "steer", 100, 400, 100); touch.move(2, 156, 400);
  assert.equal(touch.input().up, true); assert.equal(touch.input().steer, 1);
  touch.end(2, 500); assert.equal(touch.input().steer, -.5);
  touch.start(3, "brake", 40, 700, 600); touch.move(3, 71, 700);
  assert.equal(touch.input().down, true); assert.equal(touch.input().up, false); assert.equal(touch.input().steer, .5);
  touch.end(3, 900, true); assert.equal(touch.input().up, true); assert.equal(touch.input().steer, -.5);
  touch.reset(); touch.move(1, 400, 700);
  assert.deepEqual(touch.input(), { ...TEST_IDLE_INPUT, steer: 0 });
  const keys = { ...TEST_IDLE_INPUT, up: true, left: true };
  assert.equal(mergeDrivingInput(keys, touch.input()).up, true, "touch cancellation must not release a held keyboard key");
});

test("only a quick gas tap then a held second tap boosts; brake suppresses boost", () => {
  const touch = new TouchDriving();
  touch.start(1, "gas", 0, 0, 0); assert.equal(touch.input().boost, false);
  touch.end(1, 100);
  touch.start(2, "gas", 0, 0, 250); assert.equal(touch.input().boost, true);
  touch.move(2, 31, 0); assert.equal(touch.input().steer, .5); assert.equal(touch.input().boost, true);
  assert.equal(touch.input(true).boost, false, "double gas must never apply the simulation parking brake");
  touch.start(3, "brake", 0, 0, 1000); assert.equal(touch.input().boost, false);
  touch.end(3, 1300); assert.equal(touch.input().boost, true);
  touch.end(2, 3000); assert.equal(touch.input().boost, false);
  touch.start(4, "gas", 0, 0, 3100); assert.equal(touch.input().boost, false);
  touch.end(4, 3500); touch.start(5, "gas", 0, 0, 3600); assert.equal(touch.input().boost, false, "a long driving hold is not a tap");
  touch.end(5, 3700, true); touch.start(6, "gas", 0, 0, 3800); assert.equal(touch.input().boost, false, "cancel is not a tap");
  touch.move(6, 50, 0); touch.end(6, 3900); touch.start(7, "gas", 0, 0, 4000);
  assert.equal(touch.input().boost, false, "a steering drag is not a tap");
  touch.reset(); touch.start(8, "gas", 0, 0, 4100); touch.end(8, 4150);
  touch.start(9, "gas", 0, 0, 4600); assert.equal(touch.input().boost, false, "late second tap does not boost");
});

test("simulation parking brake uses double-brake hold and cancellation clears its latch", () => {
  const touch = new TouchDriving();
  touch.start(1, "brake", 0, 0, 0); touch.end(1, 100);
  touch.start(2, "brake", 0, 0, 200);
  assert.equal(touch.input(true).boost, true); assert.equal(touch.input(false).boost, false);
  touch.end(2, 500, true); assert.equal(touch.input(true).boost, false);
});
