import { SPEED_KMH_PER_WORLD_UNIT } from "./config";
import type { CareerState } from "./career";
import type { Game, VehicleId, WorldPoint } from "./model";
import { FUEL_SPECS } from "./fuel-specs";
import { nearestRoadProjection } from "./road-network";
import { regionForPosition } from "./regions";
import { vehicleRepairQuote } from "./vehicle-damage";

export const FUEL_PRICE_PER_LITRE = 2;
export const LOW_FUEL_FRACTION = .12;
export type FuelState = { litres: number; distanceKm: number; usedLitres: number; speedLimitKmh: number;
  nextLimitCheck: number; lowWarned: boolean; emptyWarned: boolean };
export function makeFuel(id: VehicleId, litres: number = FUEL_SPECS[id].tankLitres): FuelState {
  return { litres: Math.max(0, Math.min(litres, FUEL_SPECS[id].tankLitres)), distanceKm: 0, usedLitres: 0,
    speedLimitKmh: 50, nextLimitCheck: 0, lowWarned: false, emptyWarned: false };
}
export function hasFuel(game: Pick<Game, "fuel">) { return (game.fuel?.litres ?? 1) > 0; }
export function speedingFuelMultiplier(speedKmh: number, limitKmh: number) {
  return 1 + Math.max(0, Math.min(1, (speedKmh - limitKmh) / (limitKmh * .5)));
}
export function roadSpeedLimitAt(point: WorldPoint) {
  const road = nearestRoadProjection(point);
  if (road.surfaceDistance > 2) return 30;
  if (road.kind === "highway") return 100;
  if (road.kind === "parkway") return 80;
  if (road.kind === "boulevard") return 60;
  if (road.kind === "roundabout") return 30;
  return regionForPosition(point.x, point.y)?.id === "cedar-vale" ? 30 : 50;
}
export function updateFuelRoadLimit(game: Game) {
  if (game.player.kind !== "driving" || game.elapsed < game.fuel.nextLimitCheck) return;
  game.fuel.speedLimitKmh = roadSpeedLimitAt(game);
  game.fuel.nextLimitCheck = game.elapsed + .75;
}

/** Actual resolved travel uses the same metres as the GPS. Idle fuel is clock-based. */
export function stepFuel(game: Game, dt: number, distanceMetres: number): "low" | "empty" | null {
  if (game.player.kind !== "driving") return null;
  const fuel = game.fuel, spec = FUEL_SPECS[game.vehicleId];
  const speed = Math.hypot(game.vx, game.vy) * SPEED_KMH_PER_WORLD_UNIT;
  const km = Math.max(0, distanceMetres) / 1000;
  const multiplier = speedingFuelMultiplier(speed, fuel.speedLimitKmh) * (game.boosting ? 1.2 : 1);
  const used = km > .000001 ? km * spec.combinedL100km / 100 * multiplier : spec.idleLitresPerHour * dt / 3600;
  const burned = Math.min(fuel.litres, used);
  fuel.litres = Math.max(0, fuel.litres - burned); fuel.usedLitres += burned; fuel.distanceKm += km;
  if (fuel.litres <= 0 && !fuel.emptyWarned) { fuel.emptyWarned = true; fuel.lowWarned = true; return "empty"; }
  if (fuel.litres / spec.tankLitres <= LOW_FUEL_FRACTION && !fuel.lowWarned) { fuel.lowWarned = true; return "low"; }
  return null;
}
export function fuelHud(game: Pick<Game, "fuel" | "vehicleId" | "vx" | "vy" | "boosting">) {
  const spec = FUEL_SPECS[game.vehicleId], fuel = game.fuel;
  const multiplier = speedingFuelMultiplier(Math.hypot(game.vx, game.vy) * SPEED_KMH_PER_WORLD_UNIT, fuel.speedLimitKmh) * (game.boosting ? 1.2 : 1);
  return { litres: fuel.litres, capacity: spec.tankLitres, fraction: fuel.litres / spec.tankLitres,
    rangeKm: Math.floor(fuel.litres / (spec.combinedL100km * multiplier) * 100), multiplier,
    speedLimitKmh: fuel.speedLimitKmh, distanceKm: fuel.distanceKm, low: fuel.litres / spec.tankLitres <= LOW_FUEL_FRACTION,
    empty: fuel.litres <= 0 };
}
export type FuelHud = ReturnType<typeof fuelHud>;
export function fuelAmountQuote(vehicleId: VehicleId, tankLitres: number, availableFare: number, requestedLitres: number) {
  const request = Number.isFinite(requestedLitres) ? requestedLitres : 0;
  const litres = Math.max(0, Math.min(FUEL_SPECS[vehicleId].tankLitres - tankLitres, request));
  const cost = Math.max(0, Math.ceil(litres * FUEL_PRICE_PER_LITRE - 1e-8));
  return { litres, cost, shortfall: Math.max(0, cost - availableFare) };
}
export function fuelQuote(game: Game, career: CareerState, requestedLitres: number) {
  return { ...fuelAmountQuote(game.vehicleId, game.fuel.litres, game.fare + career.bank, requestedLitres), eligible: vehicleRepairQuote(game).eligible };
}
export function purchaseFuel(game: Game, career: CareerState, requestedLitres: number) {
  const quote = fuelQuote(game, career, requestedLitres);
  const result = { state: career, cost: quote.cost, litres: quote.litres };
  if (!quote.eligible || !Number.isFinite(requestedLitres) || requestedLitres <= 0) return { ...result, status: "not-ready" as const };
  if (quote.litres < .001) return { ...result, status: "full" as const };
  if (quote.shortfall > 0) return { ...result, status: "insufficient" as const };
  const fromRun = Math.min(game.fare, quote.cost);
  game.fare -= fromRun; game.fuel.litres += quote.litres; game.fuel.emptyWarned = false;
  if (game.fuel.litres / FUEL_SPECS[game.vehicleId].tankLitres > LOW_FUEL_FRACTION) game.fuel.lowWarned = false;
  return { ...result, status: "purchased" as const, state: { ...career, bank: career.bank - (quote.cost - fromRun),
    fuelTanks: { ...career.fuelTanks, [game.vehicleId]: game.fuel.litres } } };
}
