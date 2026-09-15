import { clamp } from "./math";
import type { ArcadeVehicleState, Game } from "./model";

export function makeArcadeVehicleState(): ArcadeVehicleState {
  return { yawRate: 0, yawAcceleration: 0, bodyPitch: 0, pitchRate: 0, bodyRoll: 0, rollRate: 0 };
}

/** Fast input response with continuous rotation instead of an instantaneous yaw step. */
export function arcadeHeadingDelta(game: Game, requestedDelta: number, dt: number, counterSteering: boolean) {
  const state = game.arcadeVehicle ??= makeArcadeVehicleState();
  const grounded = game.roadMotion?.grounded !== false;
  const crown = game.vehicleId === "crown-cab";
  const sliding = game.driftIntensity > 0.15 && game.speed > 10;
  const response = counterSteering ? (crown ? 24 : 10) : Math.abs(game.steering) < 0.05 ? (sliding && !crown ? 4.2 : 22) : 16;
  const target = requestedDelta / Math.max(1e-6, dt) * (grounded ? 1 : 0.12);
  // The Crown follows steering without a spring rebound when the driver centers
  // or catches a slide. Keep the coupe's separate momentum-heavy yaw response.
  if (sliding && grounded && !crown) {
    state.yawAcceleration = clamp((state.yawAcceleration ?? 0)
      + ((target - state.yawRate) * 95 - (state.yawAcceleration ?? 0) * (counterSteering ? 11 : 4.5)) * dt, -40, 40);
    state.yawRate += state.yawAcceleration * dt;
  } else {
    state.yawRate += (target - state.yawRate) * (1 - Math.exp(-response * dt));
    state.yawAcceleration = 0;
  }
  state.yawRate = clamp(state.yawRate, -3.6, 3.6);
  return state.yawRate * dt;
}

/** Damped weight transfer gives acceleration, braking and slide recovery a visible load. */
export function stepArcadeChassis(game: Game, beforeVx: number, beforeVy: number, dt: number) {
  const state = game.arcadeVehicle ??= makeArcadeVehicleState();
  const c = Math.cos(game.heading), s = Math.sin(game.heading);
  const ax = (game.vx - beforeVx) / Math.max(dt, 1e-6), ay = (game.vy - beforeVy) / Math.max(dt, 1e-6);
  const pitchTarget = game.roadMotion.grounded ? clamp(-(ax * c + ay * s) * 0.0035, -0.085, 0.11) : 0;
  const rollTarget = game.roadMotion.grounded ? clamp((-ax * s + ay * c) * 0.004, -0.12, 0.12) : 0;
  state.pitchRate += ((pitchTarget - state.bodyPitch) * 120 - state.pitchRate * 20) * dt;
  state.rollRate += ((rollTarget - state.bodyRoll) * 100 - state.rollRate * 18) * dt;
  state.bodyPitch = clamp(state.bodyPitch + state.pitchRate * dt, -0.12, 0.14);
  state.bodyRoll = clamp(state.bodyRoll + state.rollRate * dt, -0.16, 0.16);
}
