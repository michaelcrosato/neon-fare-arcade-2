import { NAVIGATION_REPLAN_COOLDOWN, NAVIGATION_REROUTE_DISTANCE_METERS, UTURN_MIN_SAVINGS_METERS } from "./config";

export type NavigationSettings = {
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
  rerouteDistanceMeters: NAVIGATION_REROUTE_DISTANCE_METERS,
  uTurnSavingsMeters: UTURN_MIN_SAVINGS_METERS,
  arrowVisibility: "contextual",
  arrowTarget: "route",
  arrowSmoothing: "smooth",
  routeStyle: "dashes",
  corridorVisibility: "off-route",
  corridorHeightMeters: 160,
  corridorOpacity: .12,
  offRouteDistanceMeters: 12,
  rerouteMode: "distance",
  rerouteCooldownSeconds: NAVIGATION_REPLAN_COOLDOWN,
  showRoadTurns: true,
  showDiagnostics: false,
};

/** Shared by both menus and the controller. Old saves retain the original behavior. */
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

export const NAVIGATION_PRESETS = [
  { id: "classic", label: "CURRENT SYSTEM", detail: "Timed arrow · road dashes", settings: DEFAULT_NAVIGATION_SETTINGS },
  { id: "compass", label: "DESTINATION COMPASS", detail: "Always on · points at the center", settings: normalizeNavigationSettings({
    arrowVisibility: "always", arrowTarget: "destination", arrowSmoothing: "instant",
  }) },
  { id: "red-guide", label: "RED DESTINATION", detail: "Dropoff arrow · vertical red dots", settings: normalizeNavigationSettings({
    arrowVisibility: "destination", arrowTarget: "destination", arrowSmoothing: "instant", routeStyle: "both",
    rerouteDistanceMeters: 1000,
  }) },
] as const;
