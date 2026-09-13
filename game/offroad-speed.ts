import { OFFROAD_SPEED_LOSS_KMH, OFFROAD_SPEED_LOSS_RATE_KMH, OFFROAD_SPEED_RECOVERY_RATE_KMH } from "./config";
import { RALLY_TIRE_OFFROAD_PENALTY_MULTIPLIER } from "./gas-station";
import type { Game } from "./model";

/** Advance with physics time. Airborne travel does not add a ground penalty. */
export function stepOffroadSpeedLimit(game: Game, onRoad: boolean, dt: number) {
  if (dt <= 0 || game.roadMotion.grounded === false) return;
  const target = onRoad ? 0 : OFFROAD_SPEED_LOSS_KMH
    * (game.installedUpgrades.includes("rally-tires") ? RALLY_TIRE_OFFROAD_PENALTY_MULTIPLIER : 1);
  const current = game.offroadSpeedPenaltyKmh ?? 0;
  const rate = target > current ? OFFROAD_SPEED_LOSS_RATE_KMH : OFFROAD_SPEED_RECOVERY_RATE_KMH;
  game.offroadSpeedPenaltyKmh = current + Math.sign(target - current) * Math.min(Math.abs(target - current), rate * dt);
}
