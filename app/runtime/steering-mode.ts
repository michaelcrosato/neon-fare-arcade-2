import type { SteeringMode } from "./touch-driving";

export const STEERING_MODE_STORAGE_KEY = "neon-fare-steering-mode";

export const STEERING_MODES = ["default", "joystick", "wheel"] as const satisfies readonly SteeringMode[];

/** Untrusted localStorage must not reach the live controller unchecked. */
export function parseStoredSteeringMode(raw: string | null | undefined): SteeringMode {
  if (raw === "default" || raw === "joystick" || raw === "wheel") return raw;
  return "default";
}

/**
 * Commit a steering system for a run (or Options change). Persist first, then
 * apply the locked id to the live controller last so a same-turn stored/React
 * preference cannot override the click.
 */
export function applySteeringForRun(
  controller: { setMode(mode: SteeringMode): void },
  lockedMode: SteeringMode,
  persist: (mode: SteeringMode) => void,
): SteeringMode {
  persist(lockedMode);
  controller.setMode(lockedMode);
  return lockedMode;
}
