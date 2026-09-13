import { SPEED_KMH_PER_WORLD_UNIT } from "./config";
import { drivingTraitPackage } from "./driving-traits";
import { clamp } from "./math";
import type { CruisePedals, Game, InputState } from "./model";
import { simulationVehicleSpecs } from "./simulation-vehicle";

export const MIN_CRUISE_KMH = 10;

export function cruiseSpeedLimit(game: Pick<Game, "drivingModel" | "drivingTraitId" | "vehicleId">) {
  return Math.floor(game.drivingModel === "simulation"
    ? simulationVehicleSpecs(game.vehicleId).governedTopSpeedMps * 3.6
    : drivingTraitPackage(game.drivingTraitId).modifiers.maxForwardSpeed * SPEED_KMH_PER_WORLD_UNIT);
}

export function cancelCruiseControl(game: Game) {
  game.cruiseControl = null;
}

/** Player-set speed is in displayed km/h; regulation remains in world units. */
export function setCruiseControl(game: Game, speedKmh: number | null): boolean {
  if (speedKmh === null) { cancelCruiseControl(game); return true; }
  if (game.runKind !== "free-run" || game.player.kind !== "driving"
    || game.simulationVehicle.overturned || !Number.isFinite(speedKmh)) return false;
  game.cruiseControl = {
    speed: clamp(Math.round(speedKmh), MIN_CRUISE_KMH, cruiseSpeedLimit(game)) / SPEED_KMH_PER_WORLD_UNIT,
    integral: 0,
  };
  return true;
}

/** Normal engine/service-brake demand, never a velocity assignment or extra power. */
export function stepCruiseControl(game: Game, input: Readonly<InputState>, dt: number): CruisePedals | null {
  const cruise = game.cruiseControl;
  if (!cruise) return null;
  if (game.runKind !== "free-run" || game.player.kind !== "driving" || (input.down && !input.brakePreservesCruise)
    || (game.vehicleId === "accord-v6" && (input.clutch || game.transmission.stuck || game.transmission.gear <= 0))
    || game.simulationVehicle.overturned || (game.drivingModel === "simulation" && input.boost)) {
    cancelCruiseControl(game);
    return null;
  }
  // Joystick braking/reverse, accelerator and arcade boost preserve the selected speed.
  if (input.up || input.down || (game.drivingModel === "arcade" && input.boost)) {
    cruise.integral = 0;
    return null;
  }
  const forwardSpeed = game.vx * Math.cos(game.heading) + game.vy * Math.sin(game.heading);
  const error = cruise.speed - forwardSpeed;
  // Bound integral wind-up while approaching the target or traversing a steep grade.
  if (Math.abs(error) < 3) cruise.integral = clamp(cruise.integral + error * dt * 0.25, 0, 1);
  return {
    throttle: clamp(cruise.integral + error * 0.65, 0, 1),
    brake: clamp(-error * 0.25 - 0.1, 0, 0.5),
  };
}
