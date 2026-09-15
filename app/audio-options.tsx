import { resetAudioSettings, toggleAudioMute, updateAudioSettings, useAudioSettings } from "./audio-settings";

const CHANNELS = [
  ["masterVolume", "MASTER", "Overall volume"],
  ["musicVolume", "MUSIC", "Driving and menu music"],
  ["effectsVolume", "SOUND EFFECTS", "Alerts, boost and menu sounds"],
  ["engineVolume", "ENGINE", "Engine and revs"],
] as const;

export function AudioOptions() {
  const settings = useAudioSettings();
  return <fieldset className="game-options-section audio-options">
    <legend>AUDIO &amp; SOUND</legend>
    <button type="button" className={`game-options-toggle ${settings.muted ? "is-off" : "is-on"}`}
      onClick={toggleAudioMute} aria-pressed={settings.muted} aria-label="Mute all audio">
      <span aria-hidden="true">{settings.muted ? "🔇" : "🔊"}</span>
      <div><strong>{settings.muted ? "AUDIO MUTED" : "AUDIO ON"}</strong><small>{settings.muted ? "Unmute to hear your saved mix" : "Adjust your mix below"}</small></div>
    </button>
    <div className="audio-options__sliders">
      {CHANNELS.map(([key, title, description]) => <label key={key} className="audio-options__channel">
        <span><strong>{title}</strong><output>{Math.round(settings[key] * 100)}%</output></span>
        <small>{description}</small>
        <input type="range" min="0" max="100" step="1" value={Math.round(settings[key] * 100)}
          aria-label={`${title.charAt(0)}${title.slice(1).toLowerCase()} volume`}
          aria-valuetext={`${Math.round(settings[key] * 100)} percent`}
          onChange={event => updateAudioSettings({ [key]: Number(event.target.value) / 100 })} />
      </label>)}
    </div>
    <label className="audio-options__background"><input type="checkbox" checked={settings.muteWhenHidden}
      onChange={event => updateAudioSettings({ muteWhenHidden: event.target.checked })} />
      <span><strong>MUTE IN BACKGROUND</strong><small>Silence audio when this tab is hidden.</small></span>
    </label>
    <p className="options-hint">Pause plays the menu theme. Resume picks up your driving song where you left it. Your mix is saved on this device.</p>
    <div className="audio-options__footer"><small><kbd>M</kbd> MUTE / UNMUTE</small>
      <button type="button" onClick={resetAudioSettings}>RESET AUDIO DEFAULTS</button></div>
  </fieldset>;
}
