import { NAVIGATION_REPLAN_COOLDOWN, NAVIGATION_REROUTE_DISTANCE_METERS, UTURN_MIN_SAVINGS_METERS } from "./config";
import type { Hud } from "./model";

export type NavigationSettings = {
  routePickups: boolean;
  routeDropoffs: boolean;
  routeCustomDestinations: boolean;
  routeCourierJobs: boolean;
  rerouteDistanceMeters: number;
  uTurnSavingsMeters: number;
  arrowVisibility: "contextual" | "always" | "destination" | "off";
  arrowTarget: "route" | "destination";
  arrowSmoothing: "smooth" | "instant";
  routeStyle: "dashes" | "corridor" | "both" | "off";
  corridorVisibility: "off-route" | "always";
  corridorHeightMeters: number;
  corridorOpacity: number;
  offRouteDistanceMeters: number;
  rerouteMode: "distance" | "locked";
  rerouteCooldownSeconds: number;
  showRoadTurns: boolean;
  showDiagnostics: boolean;
};

export const DEFAULT_NAVIGATION_SETTINGS: Readonly<NavigationSettings> = {
  routePickups: false,
  routeDropoffs: true,
  routeCustomDestinations: true,
  routeCourierJobs: true,
  rerouteDistanceMeters: NAVIGATION_REROUTE_DISTANCE_METERS,
  uTurnSavingsMeters: UTURN_MIN_SAVINGS_METERS,
  arrowVisibility: "destination",
  arrowTarget: "destination",
  arrowSmoothing: "smooth",
  routeStyle: "both",
  corridorVisibility: "off-route",
  corridorHeightMeters: 400,
  corridorOpacity: .16,
  offRouteDistanceMeters: 12,
  rerouteMode: "locked",
  rerouteCooldownSeconds: NAVIGATION_REPLAN_COOLDOWN,
  showRoadTurns: true,
  showDiagnostics: false,
};

/** Original experiment remains selectable; all presets use the same calibrated meters. */
export const CLASSIC_NAVIGATION_SETTINGS: Readonly<NavigationSettings> = {
  ...DEFAULT_NAVIGATION_SETTINGS,
  routePickups: true,
  rerouteDistanceMeters: 100,
  arrowVisibility: "contextual",
  arrowTarget: "route",
  routeStyle: "dashes",
  corridorHeightMeters: 160,
  corridorOpacity: .12,
  rerouteMode: "distance",
  rerouteCooldownSeconds: .35,
};

/** Shared validation for both menus, saved preferences and the controller. */
export function normalizeNavigationSettings(value?: unknown): NavigationSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const defaults = DEFAULT_NAVIGATION_SETTINGS;
  const number = (key: keyof NavigationSettings, min: number, max: number) => {
    const input = source[key];
    return typeof input === "number" && Number.isFinite(input)
      ? Math.max(min, Math.min(max, input)) : defaults[key] as number;
  };
  const choice = <K extends keyof NavigationSettings>(key: K, choices: readonly NavigationSettings[K][]): NavigationSettings[K] =>
    choices.includes(source[key] as NavigationSettings[K]) ? source[key] as NavigationSettings[K] : defaults[key];
  return {
    routePickups: choice("routePickups", [true, false]),
    routeDropoffs: choice("routeDropoffs", [true, false]),
    routeCustomDestinations: choice("routeCustomDestinations", [true, false]),
    routeCourierJobs: choice("routeCourierJobs", [true, false]),
    rerouteDistanceMeters: number("rerouteDistanceMeters", 0, 10000),
    uTurnSavingsMeters: number("uTurnSavingsMeters", 0, 10000),
    arrowVisibility: choice("arrowVisibility", ["contextual", "always", "destination", "off"]),
    arrowTarget: choice("arrowTarget", ["route", "destination"]),
    arrowSmoothing: choice("arrowSmoothing", ["smooth", "instant"]),
    routeStyle: choice("routeStyle", ["dashes", "corridor", "both", "off"]),
    corridorVisibility: choice("corridorVisibility", ["off-route", "always"]),
    corridorHeightMeters: number("corridorHeightMeters", 40, 400),
    corridorOpacity: number("corridorOpacity", .04, .4),
    offRouteDistanceMeters: number("offRouteDistanceMeters", 8, 100),
    rerouteMode: choice("rerouteMode", ["distance", "locked"]),
    rerouteCooldownSeconds: number("rerouteCooldownSeconds", .1, 10),
    showRoadTurns: choice("showRoadTurns", [true, false]),
    showDiagnostics: choice("showDiagnostics", [true, false]),
  };
}

/** Filters guidance for the active objective without changing mission priority or eligibility. */
export function navigationRoutingEnabled(type: Hud["objectiveType"], settings: Readonly<NavigationSettings>) {
  switch (type) {
    case "pickup": return settings.routePickups;
    case "drop": return settings.routeDropoffs;
    case "waypoint": return settings.routeCustomDestinations;
    case "courier-pickup":
    case "courier-drop": return settings.routeCourierJobs;
    case "roam": return false;
  }
}

export const NAVIGATION_PRESETS = [
  { id: "default", label: "GAME DEFAULT", detail: "Dropoff compass · hold route · vertical dots", settings: DEFAULT_NAVIGATION_SETTINGS },
  { id: "classic", label: "CLASSIC SYSTEM", detail: "Timed arrow · road dashes", settings: CLASSIC_NAVIGATION_SETTINGS },
  { id: "compass", label: "DESTINATION COMPASS", detail: "Always on · points at the center", settings: normalizeNavigationSettings({
    ...CLASSIC_NAVIGATION_SETTINGS,
    arrowVisibility: "always", arrowTarget: "destination", arrowSmoothing: "instant",
  }) },
  { id: "red-guide", label: "RED DESTINATION", detail: "Dropoff arrow · vertical route dots", settings: normalizeNavigationSettings({
    ...CLASSIC_NAVIGATION_SETTINGS,
    arrowVisibility: "destination", arrowTarget: "destination", arrowSmoothing: "instant", routeStyle: "both",
    rerouteDistanceMeters: 1000,
  }) },
] as const;
