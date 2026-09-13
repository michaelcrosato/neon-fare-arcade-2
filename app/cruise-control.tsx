import { useId, useRef, useState } from "react";
import { MIN_CRUISE_KMH } from "@/game/cruise-control";
import type { Hud } from "@/game/model";

export function CruiseControl({ hud, onSetSpeed, joystick = false }: { hud: Hud; onSetSpeed: (speed: number | null) => void; joystick?: boolean }) {
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(String(hud.cruiseSpeed ?? Math.max(MIN_CRUISE_KMH, Math.min(hud.cruiseMaxSpeed, hud.speed || 50))));
  const value = Number(speed);
  const valid = speed.trim() !== "" && Number.isFinite(value) && value >= MIN_CRUISE_KMH && value <= hud.cruiseMaxSpeed;
  const close = () => { setOpen(false); toggle.current?.focus({ preventScroll: true }); };
  return <div className="cruise-control" data-active={hud.cruiseSpeed !== null ? "" : undefined}>
    <button ref={toggle} type="button" className="cruise-control__toggle" aria-expanded={open} aria-controls={panelId}
      aria-label={hud.cruiseSpeed === null ? "Cruise control off. Set speed." : `Cruise control set to ${hud.cruiseSpeed} kilometers per hour. Change speed.`}
      onClick={() => {
        if (!open) setSpeed(String(hud.cruiseSpeed ?? Math.max(MIN_CRUISE_KMH, Math.min(hud.cruiseMaxSpeed, hud.speed || 50))));
        setOpen(current => !current);
      }}><span>CRUISE</span><b>{hud.cruiseSpeed ?? "OFF"}</b></button>
    {open && <form id={panelId} className="cruise-control__panel" aria-label="Cruise control settings"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
      onSubmit={event => {
        event.preventDefault();
        if (valid) { onSetSpeed(value); close(); }
      }}>
      <label>Set speed (km/h)<input type="number" min={MIN_CRUISE_KMH} max={hud.cruiseMaxSpeed} step="1"
        inputMode="numeric" value={speed} onChange={event => setSpeed(event.target.value)} /></label>
      <div className="cruise-control__actions">
        <button type="button" onClick={() => setSpeed(String(Math.max(MIN_CRUISE_KMH, Math.min(hud.cruiseMaxSpeed, hud.speed))))}>USE CURRENT</button>
        <button type="submit" disabled={!valid}>SET CRUISE</button>
      </div>
      {hud.cruiseSpeed !== null && <button type="button" className="cruise-control__cancel"
        onClick={() => { onSetSpeed(null); close(); }}>CANCEL CRUISE</button>}
      <p>{joystick
        ? "Joystick gas, brake and reverse temporarily override. Release to resume. Use CANCEL CRUISE to turn it off; collisions also cancel."
        : "Gas temporarily overrides. Brake or a collision turns cruise off."}</p>
    </form>}
    <span className="sr-only" aria-live="polite">{hud.cruiseSpeed === null ? "Cruise control off" : `Cruise set to ${hud.cruiseSpeed} kilometers per hour`}</span>
  </div>;
}
