import assert from "node:assert/strict";
import test from "node:test";
import { TouchDriving, mergeDrivingInput } from "../../app/runtime/touch-driving";
import { TAXI_TOP_SPEED_WORLD_UNITS } from "../../game/config";
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

test("pedal drags never steer and stay held independently of the steering thumb", () => {
  const touch = new TouchDriving();
  touch.start(1, "gas", 300, 700, 0); touch.move(1, 269, 700);
  assert.equal(touch.input().up, true); assert.equal(touch.input().steer, 0);
  assert.equal(touch.snapshot().thumb, null);
  touch.start(2, "steer", 100, 400, 100); touch.move(2, 156, 400);
  assert.equal(touch.input().up, true); assert.equal(touch.input().steer, 1);
  touch.end(2, 500); assert.equal(touch.input().steer, 0);
  touch.start(3, "brake", 40, 700, 600); touch.move(3, 71, 700);
  assert.equal(touch.input().down, true); assert.equal(touch.input().up, false); assert.equal(touch.input().steer, 0);
  assert.equal(touch.snapshot().thumb, null);
  touch.end(3, 900, true); assert.equal(touch.input().up, true); assert.equal(touch.input().steer, 0);
  touch.reset(); touch.move(1, 400, 700);
  assert.deepEqual(touch.input(), { ...TEST_IDLE_INPUT, steer: 0 });
  const keys = { ...TEST_IDLE_INPUT, up: true, left: true };
  assert.equal(mergeDrivingInput(keys, touch.input()).up, true, "touch cancellation must not release a held keyboard key");
});

test("a dedicated steering thumb keeps control when pedals are pressed afterward", () => {
  const touch = new TouchDriving();
  touch.start(1, "steer", 300, 240, 0);
  touch.move(1, 269, 240);
  touch.start(2, "gas", 330, 700, 100);
  touch.move(2, 386, 700);
  assert.equal(touch.input().up, true);
  assert.equal(touch.input().steer, -.5);
  assert.deepEqual(touch.snapshot().thumb, { x: 300, y: 240, dx: -31, kind: "steer" });
  touch.start(3, "brake", 40, 700, 200);
  assert.equal(touch.input().down, true);
  assert.equal(touch.input().steer, -.5);
  touch.end(3, 500, true);
  assert.equal(touch.input().up, true);
  assert.equal(touch.input().steer, -.5);
  touch.end(1, 600);
  assert.equal(touch.input().steer, 0, "releasing steering centers it even while a dragged pedal stays held");
  assert.equal(touch.snapshot().thumb, null);
});

test("extra steering fingers cannot take over or reactivate after the owner lifts", () => {
  const touch = new TouchDriving();
  touch.start(1, "steer", 100, 240, 0);
  touch.move(1, 156, 240);
  touch.start(2, "steer", 300, 400, 100);
  touch.move(2, 244, 400);
  assert.equal(touch.input().steer, 1);
  touch.end(1, 500);
  touch.move(2, 230, 400);
  assert.equal(touch.input().steer, 0);
  assert.equal(touch.snapshot().thumb, null);
});

test("only a quick gas tap then a held second tap boosts; brake suppresses boost", () => {
  const touch = new TouchDriving();
  touch.start(1, "gas", 0, 0, 0); assert.equal(touch.input().boost, false);
  touch.end(1, 100);
  touch.start(2, "gas", 0, 0, 250); assert.equal(touch.input().boost, true);
  touch.move(2, 31, 0); assert.equal(touch.input().steer, 0); assert.equal(touch.input().boost, true);
  assert.equal(touch.input(true).boost, false, "double gas must never apply the simulation parking brake");
  touch.start(3, "brake", 0, 0, 1000); assert.equal(touch.input().boost, false);
  touch.end(3, 1300); assert.equal(touch.input().boost, true);
  touch.end(2, 3000); assert.equal(touch.input().boost, false);
  touch.start(4, "gas", 0, 0, 3100); assert.equal(touch.input().boost, false);
  touch.end(4, 3500); touch.start(5, "gas", 0, 0, 3600); assert.equal(touch.input().boost, false, "a long driving hold is not a tap");
  touch.end(5, 3700, true); touch.start(6, "gas", 0, 0, 3800); assert.equal(touch.input().boost, false, "cancel is not a tap");
  touch.move(6, 50, 0); touch.end(6, 3900); touch.start(7, "gas", 0, 0, 4000);
  assert.equal(touch.input().boost, false, "a pedal drag is not a tap");
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

test("joystick mode honors 7% steer deadzone and 12% throttle/brake deadzones with diagonal movement", () => {
  const touch = new TouchDriving();
  touch.setMode("joystick");
  assert.equal(touch.getMode(), "joystick");

  // Center is (100, 100), radius is 60
  touch.startJoystick(1, 100, 100, 100, 100);
  assert.equal(touch.input().steer, 0);
  assert.equal(touch.input().up, false);
  assert.equal(touch.input().down, false);

  // 5% to the right (within 7% dead zone) -> straight ahead (0)
  touch.moveJoystick(1, 103, 100); // dx = 3 / 60 = 0.05
  assert.equal(touch.input().steer, 0);

  // 10% upward (within 12% throttle dead zone) -> no gas
  touch.moveJoystick(1, 100, 94); // dy = -6 / 60 = +0.10 up
  assert.equal(touch.input().up, false);

  // 10% downward (within 12% brake dead zone) -> no brake
  touch.moveJoystick(1, 100, 106); // dy = +6 / 60 = -0.10 down
  assert.equal(touch.input().down, false);

  // 50% right and 50% upward -> simultaneous diagonal turn right + accelerate
  // dx = +30 (50%), dy = -30 (50% up)
  touch.moveJoystick(1, 130, 70);
  assert.equal(touch.input().up, true);
  assert.equal(touch.input().down, false);
  const steer50 = touch.input().steer!;
  assert.ok(steer50 > 0.4 && steer50 < 0.5, `steer50 was ${steer50}`);

  // Full right (dx = 60) -> full steering (1.0)
  touch.moveJoystick(1, 160, 100);
  assert.equal(touch.input().steer, 1);

  // Full left (dx = -60) -> full left steering (-1.0)
  touch.moveJoystick(1, 40, 100);
  assert.equal(touch.input().steer, -1);

  // Full downward (dy = 60) -> brake active
  touch.moveJoystick(1, 100, 160);
  assert.equal(touch.input().down, true);
  assert.equal(touch.input().up, false);

  // Release -> immediately zeroes steering, throttle, and brake
  touch.endJoystick(1);
  assert.equal(touch.input().steer, 0);
  assert.equal(touch.input().up, false);
  assert.equal(touch.input().down, false);
  assert.equal(touch.snapshot().joystick.active, false);
});

test("wheel return mode tracks rotation across 360° boundary, clamps to 630°, and auto-centers at speed", () => {
  const touch = new TouchDriving();
  touch.setMode("wheel");
  assert.equal(touch.getMode(), "wheel");

  // Center is (100, 100). Radius 50.
  // Start at 0° (east: 150, 100)
  touch.startWheel(1, 150, 100, 100, 100);
  assert.equal(touch.snapshot().wheel.angle, 0);
  assert.equal(touch.input().steer, 0);

  // Rotate 90° clockwise to south (100, 150)
  touch.moveWheel(1, 100, 150);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 90) < 0.1);

  // Rotate to 315° (50% steering lock)
  // 315° = -45°: x = 100 + 50*cos(-45°), y = 100 + 50*sin(-45°)
  // Let's rotate sequentially past 360° boundary:
  // e.g. angle around 350° to 359° to 2° to 10°
  // Reset to test exact sequence
  touch.endWheel(1);
  touch.reset();

  // Point at 350° (-10°): cos(-10°) ≈ 0.9848, sin(-10°) ≈ -0.1736
  const cx = 200, cy = 200, r = 80;
  const p350x = cx + r * Math.cos(-10 * Math.PI / 180);
  const p350y = cy + r * Math.sin(-10 * Math.PI / 180);
  touch.startWheel(1, p350x, p350y, cx, cy);

  // Move to 359° (-1°) -> delta +9°
  const p359x = cx + r * Math.cos(-1 * Math.PI / 180);
  const p359y = cy + r * Math.sin(-1 * Math.PI / 180);
  touch.moveWheel(1, p359x, p359y);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 9) < 0.1);

  // Move across 0° boundary to 2° (+2°) -> delta +3° (total +12°)
  const p2x = cx + r * Math.cos(2 * Math.PI / 180);
  const p2y = cy + r * Math.sin(2 * Math.PI / 180);
  touch.moveWheel(1, p2x, p2y);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 12) < 0.1);

  // Move to 10° (+10°) -> delta +8° (total +20°)
  const p10x = cx + r * Math.cos(10 * Math.PI / 180);
  const p10y = cy + r * Math.sin(10 * Math.PI / 180);
  touch.moveWheel(1, p10x, p10y);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 20) < 0.1);

  // Test holding thumb does NOT return the wheel
  touch.tick(1.0, 0); // 1 second passes while holding
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 20) < 0.1, "holding thumb must keep wheel in place");

  // Multi-rotation to 630° clamp (3.5 turns lock-to-lock)
  // Simulate 3 full clockwise turns (+1080°)
  for (let i = 0; i < 12; i++) {
    const a = ((i + 1) * 90) * Math.PI / 180;
    touch.moveWheel(1, cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  assert.equal(touch.snapshot().wheel.angle, 630, "wheel angle must clamp at +630°");
  assert.equal(touch.input().steer, 1.0, "630° wheel angle maps to 100% steering");

  // Release thumb
  touch.endWheel(1);
  assert.equal(touch.snapshot().wheel.isHolding, false);

  // Auto-center at 0 road speed: base rate 260°/s
  // 1 second tick should reduce angle by 260°: 630 - 260 = 370°
  touch.tick(1.0, 0);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 370) < 0.1);

  // The established 180 km/h centering reference is independent of boost caps.
  touch.tick(0.5, 90 / 3.1);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 197.75) < 0.1);
  touch.tick(0.1, 180 / 3.1);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 154.85) < 0.1);
  touch.tick(0.1, 330 / 3.1);
  assert.ok(Math.abs(touch.snapshot().wheel.angle - 111.95) < 0.1);
  // Full return rate remains capped at 429°/s even under boost.
  touch.tick(1.0, TAXI_TOP_SPEED_WORLD_UNITS);
  assert.equal(touch.snapshot().wheel.angle, 0);
  assert.equal(touch.input().steer, 0);
});
