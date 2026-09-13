import { SPEED_KMH_PER_WORLD_UNIT } from "./config";
import type { Game, InputState, ManualTransmissionState, SimulationGear } from "./model";
import { mulberry32 } from "./random";
import { ACCORD_FINAL_DRIVE, ACCORD_GEARS, ACCORD_REDLINE_RPM, ACCORD_WHEEL_RADIUS_M } from "./vehicles";

export const CLUTCH_STICK_CHANCE = 0.05;
export const CLUTCH_RECOVERY_PUMPS = 3;

export function makeManualTransmission(): ManualTransmissionState {
  return { gear: 1, clutchHeld: false, gasHeld: false, gasPumpArmed: false, shiftUpHeld: false, shiftDownHeld: false,
    stuck: false, pumpsRemaining: 0, engagements: 0, cooldown: 0, reverseHold: 0 };
}

export function accordCoupledRpm(speedMps: number, gear: SimulationGear) {
  const ratio = gear === -1 ? 2.269 : ACCORD_GEARS[gear];
  return Math.abs(speedMps) / ACCORD_WHEEL_RADIUS_M * 60 / (2 * Math.PI) * ratio * ACCORD_FINAL_DRIVE;
}

function engage(game: Game) {
  const state = game.transmission;
  // A dedicated seed/counter keeps the fault independent of particles, traffic
  // and frame rate. Exactly one draw per engagement, never per held frame.
  const chance = mulberry32((game.runSeed ^ Math.imul(++state.engagements, 0x9e3779b1) ^ 0xc1a7c4) >>> 0)();
  if (chance < CLUTCH_STICK_CHANCE) {
    state.stuck = true;
    state.pumpsRemaining = CLUTCH_RECOVERY_PUMPS;
  }
}

/** A stuck hydraulic clutch stays disengaged; three complete pumps free it. */
export function stepManualTransmission(game: Game, input: Readonly<InputState>, dt: number) {
  if (game.vehicleId !== "accord-v6" || dt <= 0) return;
  const state = game.transmission;
  const pressed = Boolean(input.clutch);
  const released = state.clutchHeld && !pressed;
  const gas = Boolean(input.up);
  if (state.stuck && game.transmissionMode === "automatic" && gas && !state.gasHeld) state.gasPumpArmed = true;
  const gasPump = game.transmissionMode === "automatic" && state.gasPumpArmed && state.gasHeld && !gas;
  if (!gas || !state.stuck) state.gasPumpArmed = false;
  state.gasHeld = gas;
  const up = Boolean(input.shiftUp && !state.shiftUpHeld);
  const down = Boolean(input.shiftDown && !state.shiftDownHeld);
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (released || gasPump) {
    if (state.stuck) {
      state.pumpsRemaining = Math.max(0, state.pumpsRemaining - 1);
      if (state.pumpsRemaining === 0) {
        state.stuck = false;
        state.cooldown = 0.35;
        game.message = "CLUTCH FREED · DRIVE READY";
        game.messageUntil = game.elapsed + 1.6;
      }
    } else if (released) engage(game);
  }
  state.clutchHeld = pressed;
  state.shiftUpHeld = Boolean(input.shiftUp);
  state.shiftDownHeld = Boolean(input.shiftDown);
  const forwardSpeed = (game.vx * Math.cos(game.heading) + game.vy * Math.sin(game.heading))
    * SPEED_KMH_PER_WORLD_UNIT / 3.6;

  if (game.transmissionMode === "manual") {
    if (pressed && !state.stuck && up !== down) {
      const next = Math.max(-1, Math.min(6, state.gear + (up ? 1 : -1))) as SimulationGear;
      // Reject reverse while moving and downshifts that would over-rev.
      if ((next !== -1 || Math.abs(forwardSpeed) < 0.5)
        && (next <= 0 || forwardSpeed > -0.5)
        && accordCoupledRpm(forwardSpeed, next) <= ACCORD_REDLINE_RPM) state.gear = next;
    }
  } else if (!state.stuck && !pressed && state.cooldown === 0) {
    let next = state.gear;
    if (input.down && !input.up && forwardSpeed < 0.45) state.reverseHold += dt;
    else state.reverseHold = 0;
    if (state.reverseHold >= 0.28) next = -1;
    else if (input.up && forwardSpeed > -0.45 && state.gear < 1) next = 1;
    else if (state.gear < 1) next = state.gear;
    else {
      const rpm = accordCoupledRpm(forwardSpeed, state.gear);
      const shiftRpm = input.up ? (state.gear === 5 ? 5_600 : 6_200) : 3_600;
      if (rpm > shiftRpm && state.gear < 6) next = (state.gear + 1) as SimulationGear;
      else if (rpm < (input.up ? 2_300 : 1_600) && state.gear > 1) next = (state.gear - 1) as SimulationGear;
    }
    if (next !== state.gear) {
      state.gear = next;
      state.cooldown = 0.25;
      engage(game);
    }
  }
  if (state.stuck) {
    game.cruiseControl = null;
    game.message = game.transmissionMode === "automatic"
      ? `CLUTCH STUCK · TAP GAS ${state.pumpsRemaining} MORE`
      : `CLUTCH STUCK · PUMP ${state.pumpsRemaining} MORE`;
    game.messageUntil = game.elapsed + 0.3;
  }
}

export function clutchConnected(game: Readonly<Game>) {
  return game.vehicleId !== "accord-v6" || (!game.transmission.stuck && !game.transmission.clutchHeld && game.transmission.gear !== 0);
}
