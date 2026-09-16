"use client";

import { useState } from "react";
import { DEFAULT_NAVIGATION_SETTINGS, NAVIGATION_PRESETS, normalizeNavigationSettings, type NavigationSettings } from "@/game/navigation-policy";
import type { DevelopmentPanelProps } from "./development-panel";
import { copyText } from "./runtime/copy-text";

export function NavigationLab({ settings, hud, onChange, onClose }: Pick<DevelopmentPanelProps, "settings" | "hud" | "onChange" | "onClose">) {
  const nav = settings.navigation;
  const [notice, setNotice] = useState("Changes apply immediately and save on this device, including for the next run.");
  const update = (patch: Partial<NavigationSettings>) => {
    onChange({ ...settings, navigation: normalizeNavigationSettings({ ...nav, ...patch }) });
    setNotice("Navigation settings saved. Close Options and resume to try them.");
  };
  const select = <K extends keyof NavigationSettings>(label: string, key: K, options: readonly (readonly [NavigationSettings[K], string])[]) =>
    <label className="navigation-lab__field">{label}<select aria-label={label} value={String(nav[key])}
      onChange={event => update({ [key]: event.target.value })}>
      {options.map(([value, text]) => <option key={String(value)} value={String(value)}>{text}</option>)}
    </select></label>;
  const number = (label: string, key: "rerouteDistanceMeters" | "uTurnSavingsMeters" | "rerouteCooldownSeconds" | "offRouteDistanceMeters", min: number, max: number, step: number) =>
    <label className="navigation-lab__field">{label}<input type="number" value={nav[key]} min={min} max={max} step={step}
      onChange={event => update({ [key]: event.target.valueAsNumber })} /></label>;

  return <div className="navigation-lab" role="tabpanel" aria-label="Navigation Lab">
    <header className="navigation-lab__intro"><p className="modal-kicker">PLAYTEST WORKBENCH</p><h3>NAVIGATION LAB</h3>
      <p>Mix the cab arrow, GPS rules and road guide. Try a preset, then change one thing at a time.</p>
      <small>Available with Dev Mode off. Navigation settings keep normal rewards.</small></header>
    <div className="navigation-lab__presets" aria-label="Navigation presets">
      {NAVIGATION_PRESETS.map(preset => <button key={preset.id} type="button"
        aria-pressed={Object.entries(preset.settings).every(([key, value]) => nav[key as keyof NavigationSettings] === value)}
        onClick={() => { update(preset.settings); setNotice(`${preset.label} applied. All navigation controls now match this preset.`); }}>
        <b>{preset.label}</b><small>{preset.detail}</small></button>)}
    </div>
    <fieldset className="game-options-section"><legend>01 · ARROW ABOVE THE CAB</legend>
      <div className="navigation-lab__fields">
        {select("Show cab arrow", "arrowVisibility", [["contextual", "Current · departure + nearby arrival"], ["always", "Always on while navigating"], ["destination", "Red destination only · passenger onboard"], ["off", "Off"]])}
        {select("Arrow points toward", "arrowTarget", [["route", "GPS route · ring center near arrival"], ["destination", "Destination center · direct bearing"]])}
        {select("Arrow response", "arrowSmoothing", [["smooth", "Smooth rotation"], ["instant", "Instant · exact bearing"]])}
      </div>
      <p className="options-hint">Red destination means the active passenger dropoff. Pickups, custom pins and courier jobs keep this arrow hidden in that mode. Always on needs a destination; the cab arrow stays hidden on foot.</p>
      <label className="navigation-lab__check"><input type="checkbox" checked={nav.showRoadTurns}
        onChange={event => update({ showRoadTurns: event.target.checked })} />Show turn arrows over intersections</label>
    </fieldset>
    <fieldset className="game-options-section"><legend>02 · ROAD GUIDE</legend>
      <div className="navigation-lab__fields">
        {select("Ground route style", "routeStyle", [["dashes", "Current · ground dots"], ["corridor", "Vertical red dots"], ["both", "Ground dots + vertical red dots"], ["off", "Off · GPS map only"]])}
        {select("Show vertical dots", "corridorVisibility", [["off-route", "Only when off the GPS route"], ["always", "Always during a red dropoff"]])}
      </div>
      <p className="options-hint">Thin translucent red columns rise straight up from the existing red dots, with the same width. Ground dots remain while you are on route; pickup and other route colors keep their usual dots.</p>
      <div className="navigation-lab__fields">
        <label className="navigation-lab__field">Column height · {nav.corridorHeightMeters} m<input aria-label="Column height" type="range" min="40" max="400" step="20" value={nav.corridorHeightMeters}
          onChange={event => update({ corridorHeightMeters: event.target.valueAsNumber })} /></label>
        <label className="navigation-lab__field">Column opacity · {Math.round(nav.corridorOpacity * 100)}%<input aria-label="Column opacity" type="range" min="4" max="40" step="1" value={Math.round(nav.corridorOpacity * 100)}
          onChange={event => update({ corridorOpacity: event.target.valueAsNumber / 100 })} /></label>
        {number("Off-route guide distance (m)", "offRouteDistanceMeters", 8, 100, 1)}
      </div>
    </fieldset>
    <fieldset className="game-options-section"><legend>03 · GPS REALIGNMENT</legend>
      {select("Recalculate the GPS route", "rerouteMode", [["distance", "Automatically beyond the distance limit"], ["locked", "Hold route · find your way back"]])}
      <div className="navigation-lab__fields">
        {number("Reroute distance (m)", "rerouteDistanceMeters", 0, 10000, 10)}
        {number("Minimum time between reroutes (s)", "rerouteCooldownSeconds", .1, 10, .05)}
        {number("U-turn savings (m)", "uTurnSavingsMeters", 0, 10000, 100)}
      </div>
      <p className="options-hint">Distance is measured to the closest remaining route segment. Hold route stops automatic recalculation; new destinations and recovery still create a new route. Raise the reroute distance to give yourself more time to follow the vertical dots back.</p>
    </fieldset>
    <fieldset className="game-options-section"><legend>04 · TEST &amp; SHARE</legend>
      <label className="navigation-lab__check"><input type="checkbox" checked={nav.showDiagnostics}
        onChange={event => update({ showDiagnostics: event.target.checked })} />Show live navigation diagnostics</label>
      <p className="navigation-lab__readout">GPS #{hud.navigationDiagnostics?.revision ?? 0} · {hud.navigationDiagnostics?.reason ?? "start"} · {Math.round(hud.navigationDiagnostics?.deviationMeters ?? 0)} m off route</p>
      <div className="navigation-lab__actions">
        <button type="button" onClick={async () => {
          try {
            await copyText(JSON.stringify({ tool: "Neon Fare Navigation Lab", version: 1, settings: nav,
              runSeed: hud.runSeed, position: hud.player, diagnostics: hud.navigationDiagnostics }, null, 2));
            setNotice("Setup copied. Paste it with your feedback so this test can be repeated.");
          } catch { setNotice("Copy failed. Your settings are still saved on this device."); }
        }}>COPY TEST SETUP</button>
        <button type="button" onClick={() => { update(DEFAULT_NAVIGATION_SETTINGS); setNotice("Original navigation behavior restored."); }}>RESET NAVIGATION</button>
      </div>
    </fieldset>
    <p className="navigation-lab__notice" role="status">{notice}</p>
    <button className="primary-small" onClick={onClose}>CLOSE OPTIONS</button>
  </div>;
}
