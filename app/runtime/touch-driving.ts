import type { InputState } from "@/game/model";
import { SPEED_KMH_PER_WORLD_UNIT } from "@/game/config";

export type SteeringMode = "default" | "joystick" | "wheel";

type TouchKind = "steer" | "gas" | "brake";
type Pointer = { kind: TouchKind; x: number; y: number; dx: number; travel: number; time: number; double: boolean };

export const DEAD_ZONE = 6;
export const THUMB_TRAVEL = 56;

// Joystick specifications: 7% steer deadzone, 12% pedal deadzones
export const JOYSTICK_RADIUS = 60;
export const JOYSTICK_STEER_DEADZONE = 0.07; // 7% deadzone: -7% to +7% = straight ahead
export const JOYSTICK_THROTTLE_DEADZONE = 0.12; // 12% neutral deadzone for accelerator
export const JOYSTICK_BRAKE_DEADZONE = 0.12; // 12% neutral deadzone for brake

// Wheel specifications: -630° to +630° (3.5 turns lock-to-lock), 260°/s base return, +65% at speed
export const WHEEL_MAX_ANGLE_DEG = 630;
export const WHEEL_BASE_RETURN_RATE_DEG_S = 260;
export const WHEEL_SPEED_RETURN_BOOST = 0.65;
// Keep wheel centering stable when the arcade boost ceiling changes.
const WHEEL_FULL_RETURN_SPEED = 180 / SPEED_KMH_PER_WORLD_UNIT;

export type TouchDrivingSnapshot = {
  mode: SteeringMode;
  gas: boolean;
  brake: boolean;
  gasBoost: boolean;
  park: boolean;
  steer: number;
  thumb: { x: number; y: number; dx: number; kind: TouchKind } | null;
  joystick: {
    active: boolean;
    knobX: number;
    knobY: number;
    normX: number;
    normY: number;
  };
  wheel: {
    angle: number;
    isHolding: boolean;
  };
};

/** Browser-free gesture ownership across Default, Joystick (1 Hand), and Wheel (Return) steering modes. */
export class TouchDriving {
  private mode: SteeringMode = "default";
  private pointers = new Map<number, Pointer>();
  private taps: Partial<Record<TouchKind, number>> = {};

  // Joystick state (Option 2)
  private joystickPointerId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private joystickKnob = { x: 0, y: 0 };
  private joystickNormX = 0;
  private joystickNormY = 0;
  private joystickBoostActive = false;

  // Wheel state (Option 3)
  private wheelAngle = 0; // degrees in [-630, 630]
  private wheelHolding = false;
  private wheelPointerId: number | null = null;
  private wheelCenter = { x: 0, y: 0 };
  private wheelLastAngle = 0;

  getMode(): SteeringMode {
    return this.mode;
  }

  setMode(mode: SteeringMode) {
    this.mode = mode;
    this.reset();
  }

  // --- Pedal & Default Steering Handlers ---
  start(id: number, kind: TouchKind, x: number, y: number, time: number) {
    if (this.pointers.has(id) || (kind === "steer" && [...this.pointers.values()].some(p => p.kind === "steer"))) return false;
    const lastTap = this.taps[kind];
    const double = kind !== "steer" && lastTap !== undefined && time - lastTap <= 320 && time >= lastTap;
    delete this.taps[kind];
    this.pointers.set(id, { kind, x, y, dx: 0, travel: 0, time, double });
    return true;
  }

  move(id: number, x: number, y: number) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    pointer.dx = x - pointer.x;
    pointer.travel = Math.max(pointer.travel, Math.hypot(pointer.dx, y - pointer.y));
  }

  end(id: number, time: number, cancelled = false) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    if (!cancelled && !pointer.double && pointer.kind !== "steer" && time - pointer.time <= 240 && pointer.travel <= 14) {
      this.taps[pointer.kind] = time;
    } else delete this.taps[pointer.kind];
    this.pointers.delete(id);
  }

  // --- Joystick Handlers (Option 2) ---
  startJoystick(id: number, touchX: number, touchY: number, centerX: number, centerY: number): boolean {
    if (this.joystickPointerId !== null) return false;
    this.joystickPointerId = id;
    this.joystickCenter = { x: centerX, y: centerY };
    this.updateJoystick(touchX, touchY);
    return true;
  }

  moveJoystick(id: number, touchX: number, touchY: number) {
    if (this.joystickPointerId !== id) return;
    this.updateJoystick(touchX, touchY);
  }

  endJoystick(id: number) {
    if (this.joystickPointerId !== id) return;
    this.joystickPointerId = null;
    this.joystickKnob = { x: 0, y: 0 };
    this.joystickNormX = 0;
    this.joystickNormY = 0;
  }

  setJoystickBoost(active: boolean) {
    this.joystickBoostActive = active;
  }

  private updateJoystick(touchX: number, touchY: number) {
    let dx = touchX - this.joystickCenter.x;
    let dy = touchY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    this.joystickKnob = { x: dx, y: dy };
    this.joystickNormX = dx / JOYSTICK_RADIUS;
    this.joystickNormY = -dy / JOYSTICK_RADIUS; // Up is positive
  }

  private getJoystickInputs() {
    // 7% steering dead zone around center (-7% to +7% = straight ahead)
    let steer = 0;
    const absX = Math.abs(this.joystickNormX);
    if (absX > JOYSTICK_STEER_DEADZONE) {
      steer = Math.sign(this.joystickNormX) * Math.min(1, (absX - JOYSTICK_STEER_DEADZONE) / (1 - JOYSTICK_STEER_DEADZONE));
    }

    // 12% neutral dead zone for accelerator (>12% upward)
    const gas = this.joystickNormY > JOYSTICK_THROTTLE_DEADZONE;

    // 12% neutral dead zone for brake (>12% downward)
    const brake = this.joystickNormY < -JOYSTICK_BRAKE_DEADZONE;

    return { steer, gas, brake };
  }

  // --- Wheel Handlers (Option 3) ---
  startWheel(id: number, touchX: number, touchY: number, centerX: number, centerY: number): boolean {
    if (this.wheelPointerId !== null) return false;
    this.wheelPointerId = id;
    this.wheelCenter = { x: centerX, y: centerY };
    this.wheelLastAngle = Math.atan2(touchY - centerY, touchX - centerX) * (180 / Math.PI);
    this.wheelHolding = true;
    return true;
  }

  moveWheel(id: number, touchX: number, touchY: number) {
    if (this.wheelPointerId !== id) return;
    const currentAngle = Math.atan2(touchY - this.wheelCenter.y, touchX - this.wheelCenter.x) * (180 / Math.PI);
    let delta = currentAngle - this.wheelLastAngle;
    // Continuous 360° boundary tracking without snapping (e.g. 350° -> 359° -> 2° -> 10°)
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    this.wheelAngle = Math.max(-WHEEL_MAX_ANGLE_DEG, Math.min(WHEEL_MAX_ANGLE_DEG, this.wheelAngle + delta));
    this.wheelLastAngle = currentAngle;
  }

  endWheel(id: number) {
    if (this.wheelPointerId !== id) return;
    this.wheelPointerId = null;
    this.wheelHolding = false;
  }

  tick(dt: number, speed = 0) {
    // When released, wheel returns toward center (0°)
    if (this.mode === "wheel" && !this.wheelHolding && this.wheelAngle !== 0) {
      const speedRatio = Math.min(1, Math.max(0, speed / WHEEL_FULL_RETURN_SPEED));
      const returnRate = WHEEL_BASE_RETURN_RATE_DEG_S * (1 + WHEEL_SPEED_RETURN_BOOST * speedRatio);
      const step = returnRate * dt;
      if (Math.abs(this.wheelAngle) <= step) {
        this.wheelAngle = 0;
      } else {
        this.wheelAngle -= Math.sign(this.wheelAngle) * step;
      }
    }
  }

  reset() {
    this.pointers.clear();
    this.taps = {};
    this.joystickPointerId = null;
    this.joystickKnob = { x: 0, y: 0 };
    this.joystickNormX = 0;
    this.joystickNormY = 0;
    this.joystickBoostActive = false;
    this.wheelPointerId = null;
    this.wheelHolding = false;
    this.wheelAngle = 0;
  }

  snapshot(): TouchDrivingSnapshot {
    const pointers = [...this.pointers.values()];
    let steer = 0;
    let gas = pointers.some(p => p.kind === "gas");
    let brake = pointers.some(p => p.kind === "brake");
    const gasBoost = pointers.some(p => p.kind === "gas" && p.double);
    const park = pointers.some(p => p.kind === "brake" && p.double);

    const owner = pointers.find(p => p.kind === "steer");
    if (this.mode === "default") {
      const dx = owner?.dx ?? 0;
      steer = Math.sign(dx) * Math.min(1, Math.max(0, Math.abs(dx) - DEAD_ZONE) / (THUMB_TRAVEL - DEAD_ZONE));
    } else if (this.mode === "joystick") {
      const joy = this.getJoystickInputs();
      steer = joy.steer;
      gas = joy.gas;
      brake = joy.brake;
    } else if (this.mode === "wheel") {
      steer = Math.max(-1, Math.min(1, this.wheelAngle / WHEEL_MAX_ANGLE_DEG));
    }

    return {
      mode: this.mode,
      gas,
      brake,
      gasBoost: this.mode === "joystick" ? this.joystickBoostActive : gasBoost,
      park,
      steer,
      thumb: owner ? { x: owner.x, y: owner.y, dx: Math.max(-THUMB_TRAVEL, Math.min(THUMB_TRAVEL, owner.dx)), kind: owner.kind } : null,
      joystick: {
        active: this.joystickPointerId !== null,
        knobX: this.joystickKnob.x,
        knobY: this.joystickKnob.y,
        normX: this.joystickNormX,
        normY: this.joystickNormY,
      },
      wheel: {
        angle: this.wheelAngle,
        isHolding: this.wheelHolding,
      },
    };
  }

  input(simulation = false): InputState {
    const state = this.snapshot();
    return {
      up: state.gas && !state.brake,
      down: state.brake,
      left: false,
      right: false,
      steer: state.steer,
      boost: simulation ? state.park : state.gasBoost && !state.brake,
    };
  }
}

export function mergeDrivingInput(keys: InputState, touch: InputState): InputState {
  return {
    ...keys,
    up: keys.up || touch.up,
    down: keys.down || touch.down,
    boost: keys.boost || touch.boost,
    steer: touch.steer,
  };
}
