import type { PointerEventHandler } from "react";
import { DISPLAY_METERS_PER_WORLD_UNIT } from "@/game/config";
import type { FareImpact, Hud, InputState, Mode } from "@/game/model";
import { simulationGearLabel } from "@/game/simulation-vehicle";
import type { CourierImpact } from "./courier-impact-overlay";

type Props = {
  mode: Mode;
  hud: Hud;
  fareImpact: FareImpact | null;
  courierImpact: CourierImpact | null;
  onOpenMap: () => void;
  onPulseInteraction: () => void;
  onSetMode: (mode: Mode) => void;
  onTouch: PointerEventHandler<HTMLButtonElement>;
};

function TouchButton({ input, label, children, onTouch }: {
  input: keyof InputState; label: string; children: React.ReactNode;
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
export function MobileGameHud({ mode, hud, fareImpact, courierImpact, onOpenMap, onPulseInteraction, onSetMode, onTouch }: Props) {
  if (mode !== "playing" && mode !== "countdown") return null;
  const driving = hud.playerMode === "driving";
  const simulation = driving && hud.drivingModel === "simulation";
  const roaming = hud.objectiveType === "roam";
  const instruction = driving ? hud.gpsInstruction : hud.courierActive ? "Courier on foot" : hud.playerMode === "interior" ? "Inside" : "On foot";
  const destination = driving ? hud.objective : walkingDestination(hud);
  const turnDistance = Math.round(hud.gpsTurnDistance * DISPLAY_METERS_PER_WORLD_UNIT);
  const turnSymbol = hud.needsUTurn ? "↶" : /left/i.test(instruction) ? "↰" : /right/i.test(instruction) ? "↱" : "↑";
  const event = fareImpact ? {
    title: fareImpact.kind === "pickup" ? `${fareImpact.rider} is on board` : `Fare complete · ${fareImpact.rider}`,
    detail: fareImpact.kind === "pickup" ? `To ${fareImpact.destination}` : fareImpact.detail,
  } : courierImpact ? {
    title: courierImpact.kind === "pickup" ? "Parcel collected" : "Delivery complete",
    detail: courierImpact.kind === "pickup" ? `${courierImpact.cargo} · Load into taxi` : courierImpact.detail,
  } : null;
  const touch = (input: keyof InputState, label: string, content: React.ReactNode) =>
    <TouchButton input={input} label={label} onTouch={onTouch}>{content}</TouchButton>;

  return <div className={`mobile-hud ${driving ? "is-driving" : "is-on-foot"}`}>
    <div className="mobile-statusbar">
      <div className={`mobile-meter ${hud.runKind === "timed" && hud.time <= 10 ? "is-urgent" : ""}`}>
        <span>{hud.runKind === "free-run" ? "FREE RUN" : hud.clockPaused ? "METER PAUSED" : "SHIFT"}</span>
        {hud.runKind !== "free-run" && <strong>{Math.ceil(hud.time)}<small>s</small></strong>}
      </div>
      <div className="mobile-earnings"><small>FARE</small><strong>${hud.fare}</strong></div>
      <button type="button" className="mobile-menu-button" onClick={() => onSetMode("paused")}
        disabled={mode !== "playing"} aria-label="Pause game"><span aria-hidden="true">Ⅱ</span><small>MENU</small></button>
    </div>

    <button type="button" className={`mobile-route ${hud.needsUTurn && driving ? "is-uturn" : ""}`} onClick={onOpenMap}
      disabled={mode !== "playing"} aria-label={`Open regional map. ${instruction}. ${destination}.`}>
      <span className="mobile-route__arrow" aria-hidden="true">{driving && !roaming ? turnSymbol : "◇"}</span>
      <span className="mobile-route__copy"><strong>{instruction}{driving && !roaming && !hud.needsUTurn && turnDistance > 0 ? ` · ${turnDistance}m` : ""}</strong>
        <small>{destination}{driving && !roaming ? ` · ${hud.distance}m` : ""}</small></span>
      <span className="mobile-route__map" aria-hidden="true">MAP<small>↗</small></span>
    </button>

    {mode === "playing" && (event || hud.message) && <div className={`mobile-notice ${event ? "is-event" : ""}`} aria-hidden="true">
      <strong>{event?.title ?? hud.message}</strong>{event && <span>{event.detail}</span>}
    </div>}

    {mode === "playing" && <div className="mobile-controls" aria-label={driving ? "Touch driving controls" : "Touch walking controls"}>
      {hud.interactionPrompt && <button type="button" className="mobile-interaction" onClick={onPulseInteraction}
        aria-label={`${hud.interactionPrompt}. ${hud.interactionDetail}`}>
        <span aria-hidden="true">{driving ? "↗" : "✦"}</span><strong>{hud.interactionPrompt.replace(/^E · /, "")}</strong>
      </button>}
      {driving && <div className="speedometer mobile-speed"><strong>{hud.speed}</strong><small>KM/H</small>
        {simulation && <b>{simulationGearLabel(hud.simulationVehicle.gear)}</b>}</div>}
      <div className={`mobile-steering ${driving ? "" : "is-dpad"}`}>
        {!driving && touch("up", "Walk forward", "▲")}
        {touch("left", driving ? "Steer left" : "Turn left", "◀")}
        {!driving && touch("down", "Walk backward", "▼")}
        {touch("right", driving ? "Steer right" : "Turn right", "▶")}
      </div>
      {driving ? <div className="mobile-pedals">
        {touch("down", simulation ? "Brake. Hold through a complete stop to engage reverse." : "Brake or reverse. Tap while steering at speed to kick out the rear.", <><span>BRAKE</span><small>/ REVERSE</small></>)}
        {touch("up", "Accelerate", <><span>GAS</span><i aria-hidden="true">▲</i></>)}
        {touch("boost", simulation ? "Parking brake" : "Boost", <><span>{simulation ? "PARK" : "BOOST"}</span>
          {!simulation && <small>{Math.round(hud.boost)}%</small>}</>)}
      </div> : <div className="mobile-actions">
        {touch("sprint", "Run", "RUN")}
        {touch("crouch", "Crouch", "DUCK")}
        {touch("jump", "Jump", "JUMP")}
      </div>}
    </div>}
  </div>;
}
