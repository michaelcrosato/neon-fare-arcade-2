"use client";

import { useSyncExternalStore } from "react";
import type { RenderTier } from "@/game/render/quality";

export type GraphicsPreference = "auto" | RenderTier;

const KEY = "neon-fare-graphics-quality-v1";
const VALID: GraphicsPreference[] = ["auto", "ultra", "high", "balanced", "compatibility"];
const DEFAULT: GraphicsPreference = "auto";

let preference: GraphicsPreference = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function readPreference(): GraphicsPreference {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      // A query parameter makes a single session reproducible for renderer
      // verification without changing the saved preference.
      const requested = new URLSearchParams(window.location.search).get("graphics");
      const stored = window.localStorage.getItem(KEY);
      const value = (requested ?? stored) as GraphicsPreference | null;
      preference = value && VALID.includes(value) ? value : DEFAULT;
    } catch {
      preference = DEFAULT;
    }
  }
  return preference;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const graphicsPreference = () => readPreference();

/** The runtime rebuilds its GPU renderer when the saved preset changes. */
export function subscribeGraphicsPreference(listener: () => void) {
  return subscribe(listener);
}

function setPreference(next: GraphicsPreference) {
  preference = next;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // The choice still applies to this visit.
  }
  listeners.forEach((listener) => listener());
}

const LABELS: Record<GraphicsPreference, string> = {
  auto: "Automatic",
  ultra: "Ultra",
  high: "High",
  balanced: "Balanced",
  compatibility: "Performance",
};

const NOTES: Record<GraphicsPreference, string> = {
  auto: "Matches the tier to this device's GPU, cores and memory.",
  ultra: "Three shadow cascades, 4x multisampling, full bloom and ambient occlusion.",
  high: "Two shadow cascades and bloom at a phone-sized pixel budget.",
  balanced: "Two shadow cascades and bloom without ambient occlusion.",
  compatibility: "No sun shadows or bloom. Lowest GPU cost.",
};

export function GraphicsQualityOptions() {
  const current = useSyncExternalStore(subscribe, readPreference, () => DEFAULT);
  return <div className="graphics-quality">
    <h3>GRAPHICS QUALITY</h3>
    <p>Sun shadows, multisampling and bloom scale with this setting.</p>
    <label><b>PRESET</b>
      <select
        aria-label="Graphics quality preset"
        value={current}
        onChange={(event) => setPreference(event.target.value as GraphicsPreference)}
      >
        {VALID.map((option) => <option key={option} value={option}>{LABELS[option]}</option>)}
      </select>
    </label>
    <small>{NOTES[current]} Applies immediately and is saved on this device.</small>
  </div>;
}
