import { useSyncExternalStore } from "react";
import { AUDIO_SETTINGS_KEY, DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings, type AudioSettings } from "./runtime/audio-settings";

let settings = DEFAULT_AUDIO_SETTINGS, loaded = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
const parse = (stored: string | null) => {
  try { return normalizeAudioSettings(JSON.parse(stored ?? "null")); } catch { return DEFAULT_AUDIO_SETTINGS; }
};

export function getAudioSettings() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { settings = parse(window.localStorage.getItem(AUDIO_SETTINGS_KEY)); } catch { /* Defaults work without storage. */ }
  }
  return settings;
}

function onStorage(event: StorageEvent) {
  if (event.key !== AUDIO_SETTINGS_KEY && event.key !== null) return;
  settings = parse(event.newValue); publish();
}
function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function updateAudioSettings(patch: Partial<AudioSettings>) {
  settings = normalizeAudioSettings({ ...getAudioSettings(), ...patch });
  try { window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Apply for this visit. */ }
  publish();
}
export const resetAudioSettings = () => updateAudioSettings(DEFAULT_AUDIO_SETTINGS);
export const toggleAudioMute = () => updateAudioSettings({ muted: !getAudioSettings().muted });
export const useAudioSettings = () => useSyncExternalStore(subscribe, getAudioSettings, () => DEFAULT_AUDIO_SETTINGS);
