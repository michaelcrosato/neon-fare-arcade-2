"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_MINIMAP, MINIMAP_SIZES, MINIMAP_STORAGE_KEY, MINIMAP_ZOOMS, normalizeMinimapPreferences, type MinimapPreferences } from "./runtime/minimap-preferences";

let settings = DEFAULT_MINIMAP, loaded = false;
const listeners = new Set<() => void>();
function readSettings() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { settings = normalizeMinimapPreferences(JSON.parse(localStorage.getItem(MINIMAP_STORAGE_KEY) ?? "null")); }
    catch { settings = DEFAULT_MINIMAP; }
  }
  return settings;
}
const notify = () => listeners.forEach(listener => listener());
const onStorage = (event: StorageEvent) => {
  if (event.key !== MINIMAP_STORAGE_KEY && event.key !== null) return;
  loaded = false; readSettings(); notify();
};
const subscribe = (listener: () => void) => {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener("storage", onStorage); };
};
export const useMinimapSettings = () => useSyncExternalStore(subscribe, readSettings, () => DEFAULT_MINIMAP);
function updateSettings(next: Partial<MinimapPreferences>) {
  settings = normalizeMinimapPreferences({ ...readSettings(), ...next });
  try { localStorage.setItem(MINIMAP_STORAGE_KEY, JSON.stringify(settings)); } catch { /* Still applies for this visit. */ }
  notify();
}

export function MinimapOptions({ mobile }: { mobile: boolean }) {
  const choices = useMinimapSettings();
  return <fieldset className="game-options-section">
    <legend>MINI-MAP</legend>
    <div className="minimap-options">
      <label><b>PANEL SIZE</b><select aria-label="Mini-map size" value={choices.size} onChange={event => updateSettings({ size: Number(event.target.value) })}>
        {MINIMAP_SIZES.map(size => <option key={size} value={size}>{size * 100}%{size === 1 ? " · Default" : ""}</option>)}
      </select><small>Resize the map on screen.</small></label>
      <label><b>MAP ZOOM</b><select aria-label="Mini-map zoom" value={choices.zoom} onChange={event => updateSettings({ zoom: Number(event.target.value) })}>
        {MINIMAP_ZOOMS.map(zoom => <option key={zoom} value={zoom}>{zoom * 100}%{zoom === 1 ? " · Default" : zoom < 1 ? " · Wider area" : " · Closer view"}</option>)}
      </select><small>Zoom out to see more streets.</small></label>
    </div>
    <p className="options-hint">Saved on this device. {mobile ? "These settings apply to the desktop mini-map. On phones, open MAP from the pause menu." : "Panel size and zoom are independent. Large maps fit within your screen."}</p>
  </fieldset>;
}
