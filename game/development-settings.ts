import type { Game } from "./model";
import { DEFAULT_NAVIGATION_SETTINGS, normalizeNavigationSettings, type NavigationSettings } from "./navigation-policy";

export type DevelopmentSettings = {
  enabled: boolean;
  freezeClock: boolean;
  infiniteBoost: boolean;
  timeScale: number;
  showDiagnostics: boolean;
  navigation: NavigationSettings;
};

/** Validate device-local settings at the browser boundary; defaults never alter play. */
export function normalizeDevelopmentSettings(value: unknown): DevelopmentSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    enabled: source.enabled === true,
    freezeClock: source.freezeClock === true,
    infiniteBoost: source.infiniteBoost === true,
    timeScale: typeof source.timeScale === "number" && Number.isFinite(source.timeScale)
      ? Math.max(.25, Math.min(2, source.timeScale)) : 1,
    showDiagnostics: source.showDiagnostics === true,
    navigation: normalizeNavigationSettings(source.navigation && typeof source.navigation === "object"
      ? source.navigation as Partial<NavigationSettings> : undefined),
  };
}

export function applyDevelopmentSettings(game: Game, value: unknown): DevelopmentSettings {
  const settings = normalizeDevelopmentSettings(value);
  game.development = settings;
  if (settings.enabled && (settings.freezeClock || settings.infiniteBoost || settings.timeScale !== 1)) game.playtest = true;
  return settings;
}

export function navigationSettingsForGame(game: Game): Readonly<NavigationSettings> {
  return game.development?.enabled ? game.development.navigation : DEFAULT_NAVIGATION_SETTINGS;
}

export function developmentTimeScale(game: Game) {
  return game.development?.enabled ? game.development.timeScale : 1;
}
