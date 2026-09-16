import { normalizeDevelopmentSettings, type DevelopmentSettings } from "../../game/development-settings";
import { CLASSIC_NAVIGATION_SETTINGS } from "../../game/navigation-policy";

const NAVIGATION_DEFAULTS_VERSION = 2;

/** Upgrade untouched defaults once; keep deliberate experiments, including Classic. */
export function readDevelopmentPreferences(raw: unknown): DevelopmentSettings {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const navigation = source.navigation && typeof source.navigation === "object"
    ? source.navigation as Record<string, unknown> : {};
  const untouched = Object.entries(CLASSIC_NAVIGATION_SETTINGS)
    .every(([key, value]) => navigation[key] === undefined || navigation[key] === value);
  return normalizeDevelopmentSettings(source.navigationDefaultsVersion !== NAVIGATION_DEFAULTS_VERSION && untouched
    ? { ...source, navigation: undefined } : source);
}

export function savedDevelopmentPreferences(settings: DevelopmentSettings) {
  return { ...normalizeDevelopmentSettings(settings), navigationDefaultsVersion: NAVIGATION_DEFAULTS_VERSION };
}
