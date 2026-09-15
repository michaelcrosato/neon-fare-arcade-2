import assert from "node:assert/strict";
import test from "node:test";
import { GamepadInput, mergeGamepadInput } from "../../app/runtime/gamepad-input";
const pad = (pressed: number[] = [], axis = 0, mapping: GamepadMappingType = "standard") => ({ connected: true, mapping, axes: [axis, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: false, value: pressed.includes(i) ? 1 : 0 })) });

test("standard gamepads map steering, pedals, clutch, shifts and rising-edge actions", () => {
  const input = new GamepadInput();
  const first = input.sample([pad([7, 0, 2, 9, 3, 4, 15], .575)], true);
  assert.equal(first.input.up, true);
  assert.ok(Math.abs(first.input.steer! - .5) < 1e-9);
  assert.equal(first.input.boost, true);
  assert.equal(first.input.interact, true);
  assert.equal(first.input.clutch, true);
  assert.equal(first.input.shiftUp, true);
  assert.deepEqual(first.actions, { pause: true, confirm: true, camera: true });
  const held = input.sample([pad([9, 3, 2])], true);
  assert.deepEqual(held.actions, { pause: false, confirm: false, camera: false });
  assert.equal(held.input.interact, false);
  assert.equal(input.sample([pad([], .14)], true).input.steer, 0);
  assert.equal(input.sample([pad([7], 1, "")], true).input.up, false, "unknown wheel layouts are not guessed");
});

test("pause and disconnect clear pad controls, and a held pedal must be released before resume", () => {
  const input = new GamepadInput();
  input.sample([pad([7])], true);
  assert.equal(input.sample([pad([7])], false).input.up, false);
  assert.equal(input.sample([pad([7])], true).input.up, false);
  input.sample([pad()], true);
  assert.equal(input.sample([pad([7])], true).input.up, true);
  assert.equal(input.sample([], true).input.up, false);
  const keys = { up: true, down: false, left: true, right: false, boost: false, steer: -.4 };
  assert.equal(mergeGamepadInput(keys, input.sample([pad([6], 1)], true).input).left, true);
  assert.equal(mergeGamepadInput(keys, input.sample([pad([], 1)], true).input).steer, -.4);
});
