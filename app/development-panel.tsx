import { useState } from "react";
import { DESTINATION_PLACES, destinationCardsForPlace } from "@/game/destination-cards";
import type { DevelopmentAction } from "@/game/development-actions";
import { normalizeDevelopmentSettings, type DevelopmentSettings } from "@/game/development-settings";
import { fareArtAsset, fareArtFrame } from "@/game/fare-presentation";
import type { Hud } from "@/game/model";

export type DevelopmentPanelProps = {
  settings: DevelopmentSettings;
  hud: Hud;
  activeRun: boolean;
  notice: string;
  onChange: (settings: DevelopmentSettings) => void;
  onAction: (action: DevelopmentAction) => void;
  onClose: () => void;
};

export function DevelopmentPanel({ settings, hud, activeRun, notice, onChange, onAction, onClose }: DevelopmentPanelProps) {
  const [placeId, setPlaceId] = useState(DESTINATION_PLACES[0].id);
  const [occasion, setOccasion] = useState(0);
  const [seed, setSeed] = useState(String(hud.runSeed ?? 1));
  const cards = destinationCardsForPlace(placeId);
  const card = cards[occasion];
  const frame = fareArtFrame(card.artCell);
  const update = (patch: Partial<DevelopmentSettings>) => onChange({ ...settings, ...patch });
  return <div className="development-panel">
    <p className="modal-kicker">YOUR GAME · YOUR PLAYTEST</p>
    <h2 id="modal-title">OPTIONS</h2>
    <label className="development-enable"><input type="checkbox" checked={settings.enabled}
      onChange={event => update({ enabled: event.target.checked })} /><span><strong>DEV MODE</strong><small>GPS tuning, destination previews and playtest tools</small></span></label>
    {!settings.enabled && <p>Enable Dev Mode to open the tools. Regular GPS uses 1,000 m for rerouting and U-turn savings.</p>}
    {settings.enabled && <>
      <fieldset className="development-section">
        <legend>GPS BEHAVIOR</legend>
        <p>Keep the current route until the taxi is farther than this from its closest remaining point. Recommend a U-turn only when it saves this much road distance.</p>
        <div className="development-fields">
          <label>Reroute distance (m)<input type="number" min="0" max="10000" step="100" value={settings.navigation.rerouteDistanceMeters}
            onChange={event => update({ navigation: { ...settings.navigation, rerouteDistanceMeters: event.target.valueAsNumber } })} /></label>
          <label>U-turn savings (m)<input type="number" min="0" max="10000" step="100" value={settings.navigation.uTurnSavingsMeters}
            onChange={event => update({ navigation: { ...settings.navigation, uTurnSavingsMeters: event.target.valueAsNumber } })} /></label>
        </div>
        <label className="development-check"><input type="checkbox" checked={settings.showDiagnostics}
          onChange={event => update({ showDiagnostics: event.target.checked })} />Show live GPS diagnostics</label>
        <button onClick={() => update({ navigation: normalizeDevelopmentSettings(null).navigation })}>RESET GPS TO 1,000 m</button>
      </fieldset>
      <fieldset className="development-section">
        <legend>PLAYTEST CONTROLS</legend>
        <p>Time, boost, teleport and test-fare tools mark the current run as a playtest. Playtests don’t add career earnings or high scores.</p>
        <label className="development-check"><input type="checkbox" checked={settings.freezeClock}
          onChange={event => update({ freezeClock: event.target.checked })} />Freeze the shift clock</label>
        <label className="development-check"><input type="checkbox" checked={settings.infiniteBoost}
          onChange={event => update({ infiniteBoost: event.target.checked })} />Unlimited arcade boost</label>
        <label className="development-select">Game speed<select value={settings.timeScale} onChange={event => update({ timeScale: Number(event.target.value) })}>
          <option value="0.25">0.25× · slow motion</option><option value="0.5">0.5×</option><option value="1">1× · normal</option><option value="2">2×</option>
        </select></label>
        {!activeRun && <p>Start a run to use the action buttons below.</p>}
        <div className="development-actions">
          <button disabled={!activeRun} onClick={() => onAction({ kind: "reset-taxi" })}>RESET / UPRIGHT TAXI</button>
          <button disabled={!activeRun || hud.drivingModel !== "arcade"} onClick={() => onAction({ kind: "refill-boost" })}>REFILL BOOST</button>
          <button disabled={!activeRun} onClick={() => onAction({ kind: "clear-traffic" })}>CLEAR ACTIVE TRAFFIC</button>
          <button disabled={!activeRun} onClick={() => onAction({ kind: "step" })}>STEP ONE FRAME</button>
          <button disabled={!activeRun} onClick={() => onAction({ kind: "teleport-pickup" })}>JUMP TO PICKUP</button>
          <button disabled={!activeRun} onClick={() => onAction({ kind: "teleport-dropoff" })}>JUMP TO DROPOFF</button>
        </div>
        <div className="development-fields"><label>Run seed<input type="number" min="0" max="4294967295" step="1" value={seed} onChange={event => setSeed(event.target.value)} /></label>
          <button disabled={!activeRun || seed === "" || !Number.isSafeInteger(Number(seed)) || Number(seed) < 0 || Number(seed) > 4294967295}
            onClick={() => onAction({ kind: "restart", seed: Number(seed) })}>RESTART WITH SEED</button></div>
      </fieldset>
      <fieldset className="development-section">
        <legend>DESTINATION EXPLORER · {DESTINATION_PLACES.length} PLACES</legend>
        <label className="development-select">Landmark<select value={placeId} onChange={event => { setPlaceId(event.target.value); setOccasion(0); }}>
          {DESTINATION_PLACES.map(place => <option key={place.id} value={place.id}>{place.label} · {place.regionId}</option>)}
        </select></label>
        <label className="development-select">Occasion<select value={occasion} onChange={event => setOccasion(Number(event.target.value))}>
          {cards.map((entry, index) => <option key={entry.id} value={index}>{entry.occasion}</option>)}
        </select></label>
        <div className="development-destination"><div className="development-art" role="img" aria-label={`${card.label}: ${card.occasion}`}
          style={{ backgroundImage: `url("${fareArtAsset("dropoff", frame.sheet)}")`, backgroundPosition: frame.backgroundPosition }} />
          <div><strong>{card.label}</strong><p>{card.occasion}</p><small>{card.category.toUpperCase()}{card.requiresWater ? " · NEAR WATER" : ""}</small></div></div>
        <div className="development-actions">
          <button disabled={!activeRun} onClick={() => onAction({ kind: "route-landmark", placeId })}>ROUTE HERE</button>
          <button disabled={!activeRun} onClick={() => onAction({ kind: "teleport-landmark", placeId })}>TELEPORT HERE</button>
          <button disabled={!activeRun} onClick={() => onAction({ kind: "load-fare", placeId, occasion })}>LOAD TEST FARE</button>
        </div>
      </fieldset>
      <p className="development-notice" role="status" aria-live="polite">{notice || "Settings save on this device. The game stays paused while Options is open."}</p>
    </>}
    <button className="primary-small" onClick={onClose}>CLOSE OPTIONS</button>
  </div>;
}

export function DevelopmentReadout({ hud }: { hud: Hud }) {
  const diagnostics = hud.navigationDiagnostics;
  return <output className="development-readout" aria-label="Live GPS diagnostics" aria-live="off">
    <strong>{hud.playtest ? "PLAYTEST" : "DEV MODE"} · GPS #{diagnostics?.revision ?? 0}</strong>
    <span>{hud.distance.toLocaleString()} m remaining · {Math.round(diagnostics?.deviationMeters ?? 0)} m off route</span>
    <span>Reroute &gt; {diagnostics?.rerouteDistanceMeters ?? 1000} m · U-turn saves ≥ {diagnostics?.uTurnSavingsMeters ?? 1000} m</span>
    <span>{diagnostics?.reason ?? "start"} · x {hud.player.x.toFixed(1)} / y {hud.player.y.toFixed(1)} / z {(hud.player.z ?? 0).toFixed(1)}</span>
    <span>Seed {hud.runSeed} · {(hud.elapsed ?? 0).toFixed(2)} s · {hud.speed} km/h</span>
  </output>;
}
