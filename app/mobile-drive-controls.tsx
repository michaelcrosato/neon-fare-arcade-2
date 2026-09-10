import { useEffect, useId, useState, type CSSProperties, type PointerEvent } from "react";
import type { TouchDriving } from "./runtime/touch-driving";

type Props = { controller: TouchDriving; boost: number; boosting: boolean; simulation: boolean; enabled: boolean };

export function MobileDriveControls({ controller, boost, boosting, simulation, enabled }: Props) {
  const gasHint = useId();
  const steeringHint = useId();
  const [state, setState] = useState(() => controller.snapshot());
  useEffect(() => {
    const reset = () => { controller.reset(); setState(controller.snapshot()); };
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      controller.reset();
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [controller]);

  const pointer = (event: PointerEvent<HTMLElement>, kind: "steer" | "gas" | "brake") => {
    if (event.type === "pointerdown" && event.button !== 0) return;
    event.preventDefault();
    if (!enabled) return;
    if (event.type === "pointerdown") {
      if (!controller.start(event.pointerId, kind, event.clientX, event.clientY, event.timeStamp)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (event.type === "pointermove") {
      controller.move(event.pointerId, event.clientX, event.clientY);
    } else {
      controller.end(event.pointerId, event.timeStamp, event.type !== "pointerup");
    }
    setState(controller.snapshot());
  };
  const handlers = (kind: "steer" | "gas" | "brake") => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => pointer(e, kind),
    onPointerMove: (e: PointerEvent<HTMLElement>) => pointer(e, kind),
    onPointerUp: (e: PointerEvent<HTMLElement>) => pointer(e, kind),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => pointer(e, kind),
    onLostPointerCapture: (e: PointerEvent<HTMLElement>) => pointer(e, kind),
  });

  return <>
    <span id={gasHint} hidden>{simulation ? "Hold to accelerate. Use your other thumb on the road to steer." : "Hold to accelerate. Double tap and hold for boost. The fill shows boost remaining. Use your other thumb on the road to steer."}</span>
    <div className="mobile-steer-surface" aria-label="Drag anywhere to steer" aria-describedby={steeringHint}
      aria-disabled={!enabled} {...handlers("steer")} />
    <div id={steeringHint} className="mobile-steer-guide" data-steering={state.steer !== 0 ? "" : undefined}>
      <span className="mobile-steer-guide__track" aria-hidden="true">‹<i />›</span>
      <strong>DRAG TO STEER</strong><small>LEFT THUMB · ANYWHERE</small>
    </div>
    {state.thumb && <div className="mobile-thumbstick" aria-hidden="true"
      style={{ left: state.thumb.x, top: state.thumb.y }}>
      <i style={{ transform: `translateX(${state.thumb.dx}px)` }} />
    </div>}
    <div className="mobile-pedals" aria-label="Touch driving controls">
      <small className="mobile-pedals__label">RIGHT THUMB</small>
      <button type="button" className="mobile-pedal mobile-pedal--brake" disabled={!enabled} data-held={state.brake ? "" : undefined}
        aria-label={simulation ? "Brake or reverse. Double tap and hold for parking brake." : "Brake or reverse"}
        {...handlers("brake")}><span>BRAKE</span><small>{simulation && state.park ? "PARK" : "REVERSE"}</small></button>
      <button type="button" disabled={!enabled} className={`mobile-pedal mobile-pedal--gas ${boosting ? "is-boosting" : ""}`}
        data-held={state.gas ? "" : undefined} aria-label="Accelerate"
        aria-describedby={gasHint}
        style={{ "--boost-fill": `${simulation ? 100 : Math.max(0, Math.min(100, boost))}%` } as CSSProperties}
        {...handlers("gas")}><i className="mobile-gas-fill" aria-hidden="true" /><span>GAS</span>
        <small>{!simulation && (boosting ? "BOOSTING" : "2× BOOST")}</small></button>
    </div>
  </>;
}
