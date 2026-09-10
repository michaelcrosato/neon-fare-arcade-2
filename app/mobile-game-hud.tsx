import type { PointerEventHandler, RefObject } from "react";
import type { FareImpact, Hud, InputState, Mode } from "@/game/model";
import { simulationGearLabel } from "@/game/simulation-vehicle";
import type { CourierImpact } from "./courier-impact-overlay";
import { MobileDriveControls } from "./mobile-drive-controls";
import type { TouchDriving } from "./runtime/touch-driving";

type Props = {
  mode: Mode;
  hud: Hud;
  fareImpact: FareImpact | null;
  courierImpact: CourierImpact | null;
  touchDriving: TouchDriving;
  taxiExitRef?: RefObject<HTMLButtonElement | null>;
  onPulseInteraction: () => void;
  onSetMode: (mode: Mode) => void;
  onTouch: PointerEventHandler<HTMLButtonElement>;
};

function TouchButton({ input, label, children, onTouch }: {
  input: Exclude<keyof InputState, "steer">; label: string; children: React.ReactNode;
  onTouch: PointerEventHandler<HTMLButtonElement>;
}) {
  return <button type="button" className={`mobile-input mobile-input--${input}`} data-input={input}
    aria-label={label} onPointerDown={onTouch} onPointerUp={onTouch}
    onPointerCancel={onTouch} onLostPointerCapture={onTouch}>{children}</button>;
}

function walkingDestination(hud: Hud) {
  if (!hud.courierActive) return hud.placeName;
  if (hud.playerMode === "interior") {
    if (hud.courierStage === "dropoff" && !hud.courierLoadedInTaxi) return "Return to your taxi";
    if (hud.courierAtTargetVenue && !hud.courierTaxiAtTarget) return "Bring your taxi closer";
    if (hud.courierAtTargetVenue) return hud.courierStage === "pickup" ? "Find the courier counter" : "Hand off at the courier counter";
    return `Exit · Go to ${hud.courierPlace}`;
  }
  return hud.courierNearEntrance && hud.courierTaxiAtTarget && (hud.courierStage === "pickup" || hud.courierLoadedInTaxi)
    ? `Enter ${hud.courierPlace}` : `Return to taxi · ${hud.courierPlace}`;
}

/** Mobile has its own information hierarchy; no mini-map or desktop card stack. */
export function MobileGameHud({ mode, hud, fareImpact, courierImpact, touchDriving, taxiExitRef, onPulseInteraction, onSetMode, onTouch }: Props) {
  if (mode !== "playing" && mode !== "countdown") return null;
  const driving = hud.playerMode === "driving";
  const simulation = driving && hud.drivingModel === "simulation";
  const roaming = hud.objectiveType === "roam";
  const event = fareImpact ? {
    title: fareImpact.kind === "pickup" ? `${fareImpact.rider} is on board` : `Fare complete · ${fareImpact.rider}`,
    detail: fareImpact.kind === "pickup" ? `To ${fareImpact.destination}` : fareImpact.detail,
  } : courierImpact ? {
    title: courierImpact.kind === "pickup" ? "Parcel collected" : "Delivery complete",
    detail: courierImpact.kind === "pickup" ? `${courierImpact.cargo} · Load into taxi` : courierImpact.detail,
  } : null;
  const touch = (input: Exclude<keyof InputState, "steer">, label: string, content: React.ReactNode) =>
    <TouchButton input={input} label={label} onTouch={onTouch}>{content}</TouchButton>;

  return <div className={`mobile-hud ${driving ? "is-driving" : "is-on-foot"}`}>
    {driving && <MobileDriveControls controller={touchDriving} enabled={mode === "playing"}
      boost={hud.boost} boosting={hud.boosting} simulation={simulation} />}
    <div className="mobile-statusbar">
      <div className="mobile-journey">
        <div className={`mobile-meter ${hud.runKind === "timed" && hud.time <= 10 ? "is-urgent" : ""}`}>
          <span>{hud.runKind === "free-run" ? "FREE RUN" : hud.clockPaused ? "METER PAUSED" : "SHIFT"}</span>
          {hud.runKind !== "free-run" && <strong>{Math.ceil(hud.time)}<small>s</small></strong>}
        </div>
        {!roaming && <span className="mobile-distance" aria-label={`Destination distance ${hud.distance} meters`}>{hud.distance}<small>m</small></span>}
      </div>
      <div className="mobile-earnings"><small>FARE</small><strong>${hud.fare}</strong></div>
      <button type="button" className="mobile-menu-button" onClick={() => onSetMode("paused")}
        disabled={mode !== "playing"} aria-label="Pause game"><span aria-hidden="true">Ⅱ</span><small>MENU</small></button>
    </div>

    {driving && <div className="speedometer mobile-speed"><strong>{hud.speed}</strong><small>KM/H</small>
      {simulation && <b>{simulationGearLabel(hud.simulationVehicle.gear)}</b>}</div>}

    {mode === "playing" && (event || hud.message) && <div className={`mobile-notice ${event ? "is-event" : ""}`} aria-hidden="true">
      <strong>{event?.title ?? hud.message}</strong>{event && <span>{event.detail}</span>}
      {event && fareImpact?.destinationCard && <small className="fare-card-occasion">{fareImpact.destinationCard.occasion}</small>}
    </div>}

    {mode === "playing" && driving && hud.interactionPrompt && <button type="button" ref={taxiExitRef}
      className="mobile-taxi-exit" onClick={onPulseInteraction} aria-label={`${hud.interactionPrompt}. ${hud.interactionDetail}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3h7v18h-7M13 6l-6-3v18l6-3ZM3 12h7m-7 0 3-3m-3 3 3 3" /></svg>
      <span><strong>EXIT TAXI</strong><small>EXPLORE ON FOOT</small></span>
    </button>}

    {mode === "playing" && <div className="mobile-controls" aria-label={driving ? "Nearby actions" : "Touch walking controls"}>
      {!driving && hud.courierActive && <p className="mobile-walking-hint">{walkingDestination(hud)}</p>}
      {!driving && hud.interactionPrompt && <button type="button" className="mobile-interaction" onClick={onPulseInteraction}
        aria-label={`${hud.interactionPrompt}. ${hud.interactionDetail}`}>
        <span aria-hidden="true">{driving ? "↗" : "✦"}</span><strong>{hud.interactionPrompt.replace(/^E · /, "")}</strong>
      </button>}
      {!driving && <><div className="mobile-steering is-dpad">
        {touch("up", "Walk forward", "▲")}
        {touch("left", "Turn left", "◀")}
        {touch("down", "Walk backward", "▼")}
        {touch("right", "Turn right", "▶")}
      </div>
      <div className="mobile-actions">
        {touch("sprint", "Run", "RUN")}
        {touch("crouch", "Crouch", "DUCK")}
        {touch("jump", "Jump", "JUMP")}
      </div></>}
    </div>}
  </div>;
}
