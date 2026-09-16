import assert from "node:assert/strict";
import test from "node:test";
import { readDevelopmentPreferences, savedDevelopmentPreferences } from "../../app/runtime/development-preferences";
import { normalizeDevelopmentSettings } from "../../game/development-settings";
import { CLASSIC_NAVIGATION_SETTINGS, DEFAULT_NAVIGATION_SETTINGS } from "../../game/navigation-policy";

test("new devices and untouched old navigation saves receive the selected game defaults", () => {
  for (const raw of [null, {}, { navigation: CLASSIC_NAVIGATION_SETTINGS }, { navigation: { arrowVisibility: "contextual" } }]) {
    assert.deepEqual(readDevelopmentPreferences(raw).navigation, DEFAULT_NAVIGATION_SETTINGS);
  }
});

test("default migration preserves customized navigation and unrelated Dev Mode preferences", () => {
  const settings = normalizeDevelopmentSettings({ enabled: true, freezeClock: true, timeScale: .5,
    navigation: { ...CLASSIC_NAVIGATION_SETTINGS, rerouteDistanceMeters: 600 } });
  assert.deepEqual(readDevelopmentPreferences(settings), settings);
  assert.deepEqual(readDevelopmentPreferences(savedDevelopmentPreferences(settings)), settings);
});

test("an explicitly selected Classic preset survives saving and reloading after migration", () => {
  const classic = normalizeDevelopmentSettings({ navigation: CLASSIC_NAVIGATION_SETTINGS });
  assert.deepEqual(readDevelopmentPreferences(savedDevelopmentPreferences(classic)), classic);
  const defaults = normalizeDevelopmentSettings(null);
  assert.deepEqual(readDevelopmentPreferences(savedDevelopmentPreferences(defaults)), defaults);
});
