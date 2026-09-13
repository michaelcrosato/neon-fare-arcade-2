import type { PointerEventHandler } from "react";
import type { Hud } from "@/game/model";
import { accordEngineIndicators } from "@/game/manual-transmission";

export type TransmissionInput = "clutch" | "shiftUp" | "shiftDown";
export type TransmissionInputHandler = (input: TransmissionInput, active: boolean) => void;

export function TransmissionControls({ hud, enabled, onTouch, onInput }: { hud: Hud; enabled: boolean; onTouch: PointerEventHandler<HTMLButtonElement>; onInput?: TransmissionInputHandler }) {
  if (hud.vehicleId !== "accord-v6" || hud.playerMode !== "driving") return null;
  const state = hud.transmission;
  const manual = hud.transmissionMode === "manual";
  const gear = state.gear === -1 ? "R" : state.gear === 0 ? "N" : String(state.gear);
  const indicators = accordEngineIndicators(hud.vehicleRpm, state.gasHeld, state.gear, !state.stuck && !state.clutchHeld && state.gear !== 0);
  const button = (input: TransmissionInput, label: string, content: string) => <button type="button" data-input={input} disabled={!enabled} aria-label={label}
    onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch} onLostPointerCapture={onTouch}
    onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onInput?.(input, true); } }}
    onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onInput?.(input, false); } }}
    onBlur={() => onInput?.(input, false)}
  >{content}</button>;
  return <div className={`transmission-controls ${state.stuck ? "is-stuck" : ""}`} aria-label="Accord transmission">
    <div className="transmission-controls__status"><b>{gear}</b><span>{manual ? "6MT" : "6MT · AUTO SHIFT"} · {Math.round(hud.vehicleRpm / 100) * 100} RPM<small role="status">{state.stuck ? `CLUTCH STUCK · ${state.pumpsRemaining} PUMPS` : state.clutchHeld ? "CLUTCH DOWN" : "ACCORD V6"}</small></span></div>
    {manual && <div className="transmission-controls__lights">
      <span className={indicators.shift ? "is-lit shift-light" : "shift-light"} aria-label={indicators.shift ? "Shift up recommended" : "Shift light standby"}>SHIFT ↑</span>
      <span className={indicators.vtec ? "is-lit vtec-light" : "vtec-light"} aria-label={indicators.vtec ? "VTEC active" : "VTEC standby"}>VTEC</span>
    </div>}
    {state.stuck && !manual && <small className="transmission-controls__recovery">TAP GAS ×{state.pumpsRemaining} OR PUMP CLUTCH</small>}
    <div className="transmission-controls__buttons">
      {manual && button("shiftDown", "Shift down. Z key.", "−")}
      {button("clutch", "Clutch. Hold Shift; release to engage. Pump three times if stuck.", state.stuck ? "PUMP CLUTCH" : "CLUTCH")}
      {manual && button("shiftUp", "Shift up. X key.", "+")}
    </div>
    <small className="transmission-controls__keys">{manual ? "SHIFT clutch · Z / X gears · R ↔ N ↔ 1–6" : "TAP GAS ×3 or SHIFT · pump clutch"}</small>
  </div>;
}
