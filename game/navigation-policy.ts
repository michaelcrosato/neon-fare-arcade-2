import { NAVIGATION_REROUTE_DISTANCE_METERS, UTURN_MIN_SAVINGS_METERS } from "./config";

export type NavigationSettings = {
  rerouteDistanceMeters: number;
  uTurnSavingsMeters: number;
};

export const DEFAULT_NAVIGATION_SETTINGS: Readonly<NavigationSettings> = {
  rerouteDistanceMeters: NAVIGATION_REROUTE_DISTANCE_METERS,
  uTurnSavingsMeters: UTURN_MIN_SAVINGS_METERS,
};

/** Shared by the controller and Dev Mode; invalid saved/input values use defaults. */
export function normalizeNavigationSettings(value?: Partial<NavigationSettings> | null): NavigationSettings {
  const meters = (input: number | undefined, fallback: number) => Number.isFinite(input)
    ? Math.max(0, Math.min(10000, input!)) : fallback;
  return {
    rerouteDistanceMeters: meters(value?.rerouteDistanceMeters, DEFAULT_NAVIGATION_SETTINGS.rerouteDistanceMeters),
    uTurnSavingsMeters: meters(value?.uTurnSavingsMeters, DEFAULT_NAVIGATION_SETTINGS.uTurnSavingsMeters),
  };
}
