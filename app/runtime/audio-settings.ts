export type AudioSettings = Readonly<{
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  engineVolume: number;
  muted: boolean;
  muteWhenHidden: boolean;
}>;

export const AUDIO_SETTINGS_KEY = "neon-fare-audio-v1";
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1, musicVolume: 1, effectsVolume: 1, engineVolume: 1,
  muted: false, muteWhenHidden: true,
};

export function normalizeAudioSettings(value: unknown): AudioSettings {
  const stored = value && typeof value === "object" ? value as Partial<AudioSettings> : {};
  const volume = (key: "masterVolume" | "musicVolume" | "effectsVolume" | "engineVolume") => {
    const number = stored[key];
    return typeof number === "number" && Number.isFinite(number)
      ? Math.round(Math.max(0, Math.min(1, number)) * 100) / 100 : DEFAULT_AUDIO_SETTINGS[key];
  };
  return {
    masterVolume: volume("masterVolume"), musicVolume: volume("musicVolume"),
    effectsVolume: volume("effectsVolume"), engineVolume: volume("engineVolume"),
    muted: typeof stored.muted === "boolean" ? stored.muted : DEFAULT_AUDIO_SETTINGS.muted,
    muteWhenHidden: typeof stored.muteWhenHidden === "boolean" ? stored.muteWhenHidden : DEFAULT_AUDIO_SETTINGS.muteWhenHidden,
  };
}

/** Preserve the authored mix at 100%; all channels share the master and mute. */
export function audioMix(settings: AudioSettings, hidden = false) {
  const muted = settings.muted || (settings.muteWhenHidden && hidden);
  const master = muted ? 0 : settings.masterVolume;
  return { muted, music: .38 * master * settings.musicVolume,
    effects: .24 * master * settings.effectsVolume, engine: .24 * master * settings.engineVolume };
}
