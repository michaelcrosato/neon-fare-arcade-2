import type { VehicleId } from "./model";

/** Manufacturer tank capacities and published combined consumption; see docs/fuel.md. */
export const FUEL_SPECS = {
  "gtr-r35": { tankLitres: 73.8, combinedL100km: 235.214583 / 19, idleLitresPerHour: 1.1 },
  "crown-cab": { tankLitres: 75.7, combinedL100km: 235.214583 / 18, idleLitresPerHour: 1.2 },
  "accord-v6": { tankLitres: 65, combinedL100km: 10.9, idleLitresPerHour: .9 },
} as const satisfies Record<VehicleId, { tankLitres: number; combinedL100km: number; idleLitresPerHour: number }>;

export type FuelTanks = Record<VehicleId, number>;
export function fullFuelTanks(): FuelTanks { return { "crown-cab": FUEL_SPECS["crown-cab"].tankLitres, "accord-v6": FUEL_SPECS["accord-v6"].tankLitres, "gtr-r35": FUEL_SPECS["gtr-r35"].tankLitres }; }
export function normalizeFuelTanks(raw: unknown): FuelTanks {
  const tanks = fullFuelTanks();
  if (!raw || typeof raw !== "object") return tanks;
  for (const id of Object.keys(tanks) as VehicleId[]) {
    const value = (raw as Partial<FuelTanks>)[id];
    if (typeof value === "number" && Number.isFinite(value)) tanks[id] = Math.max(0, Math.min(tanks[id], value));
  }
  return tanks;
}
