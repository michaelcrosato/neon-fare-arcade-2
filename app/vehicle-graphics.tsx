"use client";

import { useSyncExternalStore } from "react";
import type { VehicleId } from "@/game/model";
import { VEHICLES } from "@/game/vehicles";

type Detail = "classic" | "detailed";
type Settings = Record<VehicleId, Detail>;
const KEY = "neon-fare-vehicle-graphics-v1";
const DEFAULTS: Settings = { "crown-cab": "classic", "accord-v6": "classic", "gtr-r35": "detailed" };
let settings = DEFAULTS, loaded = false;
const listeners = new Set<() => void>();

function readSettings() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
      settings = { "crown-cab": stored?.["crown-cab"] === "detailed" ? "detailed" : "classic",
        "accord-v6": stored?.["accord-v6"] === "detailed" ? "detailed" : "classic", "gtr-r35": "detailed" };
    } catch { settings = DEFAULTS; }
  }
  return settings;
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const vehicleDetailSetting = (id: VehicleId) => readSettings()[id];

function setDetail(id: VehicleId, detail: Detail) {
  settings = { ...readSettings(), [id]: detail };
  try { window.localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* The choice still works for this visit. */ }
  listeners.forEach(listener => listener());
}

export function VehicleGraphicsOptions() {
  const choices = useSyncExternalStore(subscribe, readSettings, () => DEFAULTS);
  return <div className="vehicle-graphics">
    <h3>VEHICLE MODELS</h3><p>Choose the Crown Cab’s body style. The Accord and GT-R have their own coupe models.</p>
    {VEHICLES.map(vehicle => <label key={vehicle.id}><b>{vehicle.shortName}</b>
      {vehicle.id !== "crown-cab" ? <output aria-label={`${vehicle.shortName} model`}>{vehicle.id === "accord-v6" ? "Balanced coupe" : "Black R35 coupe"}</output> : <select aria-label={`${vehicle.shortName} model quality`} value={choices[vehicle.id]} onChange={event => setDetail(vehicle.id, event.target.value as Detail)}>
        <option value="classic">Classic</option><option value="detailed">Detailed</option>
      </select>}</label>)}
    <small>Applies immediately and is saved on this device. The Detailed Crown uses more graphics power.</small>
  </div>;
}
