import assert from "node:assert/strict";
import test from "node:test";
import { audioMix, DEFAULT_AUDIO_SETTINGS as defaults, normalizeAudioSettings } from "../../app/runtime/audio-settings";

test("invalid or old audio preferences normalize safely and slider boundaries clamp", () => {
  for (const value of [null, "bad", [], { masterVolume: NaN, musicVolume: Infinity, muted: "yes" }]) {
    assert.deepEqual(normalizeAudioSettings(value), defaults);
  }
  assert.deepEqual(normalizeAudioSettings({ masterVolume: 8, musicVolume: -1, effectsVolume: .456, engineVolume: 0, muteWhenHidden: false }),
    { ...defaults, musicVolume: 0, effectsVolume: .46, engineVolume: 0, muteWhenHidden: false });
});

test("the master scales independent music, effects and engine channels without cross-talk", () => {
  assert.deepEqual(audioMix(defaults), { muted: false, music: .38, effects: .24, engine: .24 });
  assert.deepEqual(audioMix({ ...defaults, effectsVolume: 0 }), { muted: false, music: .38, effects: 0, engine: .24 });
  assert.deepEqual(audioMix({ ...defaults, engineVolume: 0 }), { muted: false, music: .38, effects: .24, engine: 0 });
  assert.deepEqual(audioMix({ ...defaults, masterVolume: .5, musicVolume: .5, effectsVolume: .25 }),
    { muted: false, music: .095, effects: .03, engine: .12 });
});

test("mute, master zero and background preference silence all channels without modifying preferences", () => {
  const silent = { music: 0, effects: 0, engine: 0 };
  assert.deepEqual(audioMix({ ...defaults, muted: true }), { ...silent, muted: true });
  assert.deepEqual(audioMix({ ...defaults, masterVolume: 0 }), { ...silent, muted: false });
  assert.deepEqual(audioMix(defaults, true), { ...silent, muted: true });
  assert.deepEqual(audioMix({ ...defaults, muteWhenHidden: false }, true), audioMix(defaults));
  assert.equal(defaults.masterVolume, 1);
});
