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

  // Keep wheel return animation smooth at 60fps when not touching
  useEffect(() => {
    if (state.mode !== "wheel" || state.wheel.isHolding || state.wheel.angle === 0) return;
    let animId: number;
    const loop = () => {
      const snap = controller.snapshot();
      setState(snap);
      if (!snap.wheel.isHolding && snap.wheel.angle !== 0) {
        animId = requestAnimationFrame(loop);
      }
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [state.mode, state.wheel.isHolding, state.wheel.angle, controller]);

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

  const handleJoystickPointer = (e: PointerEvent<HTMLElement>) => {
    if (e.type === "pointerdown" && e.button !== 0) return;
    e.preventDefault();
    if (!enabled) return;
    if (e.type === "pointerdown") {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (!controller.startJoystick(e.pointerId, e.clientX, e.clientY, cx, cy)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.type === "pointermove") {
      controller.moveJoystick(e.pointerId, e.clientX, e.clientY);
    } else {
      controller.endJoystick(e.pointerId);
    }
    setState(controller.snapshot());
  };

  const joystickHandlers = {
    onPointerDown: handleJoystickPointer,
    onPointerMove: handleJoystickPointer,
    onPointerUp: handleJoystickPointer,
    onPointerCancel: handleJoystickPointer,
    onLostPointerCapture: handleJoystickPointer,
  };

  const handleWheelPointer = (e: PointerEvent<HTMLElement>) => {
    if (e.type === "pointerdown" && e.button !== 0) return;
    e.preventDefault();
    if (!enabled) return;
    if (e.type === "pointerdown") {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (!controller.startWheel(e.pointerId, e.clientX, e.clientY, cx, cy)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.type === "pointermove") {
      controller.moveWheel(e.pointerId, e.clientX, e.clientY);
    } else {
      controller.endWheel(e.pointerId);
    }
    setState(controller.snapshot());
  };

  const wheelHandlers = {
    onPointerDown: handleWheelPointer,
    onPointerMove: handleWheelPointer,
    onPointerUp: handleWheelPointer,
    onPointerCancel: handleWheelPointer,
    onLostPointerCapture: handleWheelPointer,
  };

  const renderPedals = () => (
    <div className="mobile-pedals" aria-label="Touch driving controls">
      <small className="mobile-pedals__label">RIGHT THUMB</small>
      <button
        type="button"
        className="mobile-pedal mobile-pedal--brake"
        disabled={!enabled}
        data-held={state.brake ? "" : undefined}
        aria-label={simulation ? "Brake or reverse. Double tap and hold for parking brake." : "Brake or reverse"}
        {...handlers("brake")}
      >
        <span>BRAKE</span>
        <small>{simulation && state.park ? "PARK" : "REVERSE"}</small>
      </button>
      <button
        type="button"
        disabled={!enabled}
        className={`mobile-pedal mobile-pedal--gas ${boosting ? "is-boosting" : ""}`}
        data-held={state.gas ? "" : undefined}
        aria-label="Accelerate"
        aria-describedby={gasHint}
        style={{ "--boost-fill": `${simulation ? 100 : Math.max(0, Math.min(100, boost))}%` } as CSSProperties}
        {...handlers("gas")}
      >
        <i className="mobile-gas-fill" aria-hidden="true" />
        <span>GAS</span>
        <small>{!simulation && (boosting ? "BOOSTING" : "2× BOOST")}</small>
      </button>
    </div>
  );

  return (
    <>
      <span id={gasHint} hidden>
        {simulation
          ? "Hold to accelerate. Use steering control to steer."
          : "Hold to accelerate. Double tap and hold for boost. The fill shows boost remaining."}
      </span>

      {state.mode === "default" && (
        <>
          <div
            className="mobile-steer-surface"
            aria-label="Drag anywhere to steer"
            aria-describedby={steeringHint}
            aria-disabled={!enabled}
            {...handlers("steer")}
          />
          <div id={steeringHint} className="mobile-steer-guide" data-steering={state.steer !== 0 ? "" : undefined}>
            <span className="mobile-steer-guide__track" aria-hidden="true">‹<i />›</span>
            <strong>DRAG TO STEER</strong>
            <small>LEFT THUMB · ANYWHERE</small>
          </div>
          {state.thumb && (
            <div
              className="mobile-thumbstick"
              aria-hidden="true"
              style={{ left: state.thumb.x, top: state.thumb.y }}
            >
              <i style={{ transform: `translateX(${state.thumb.dx}px)` }} />
            </div>
          )}
          {renderPedals()}
        </>
      )}

      {state.mode === "joystick" && (
        <div className="mobile-joystick-wrap">
          <div
            className="mobile-joystick-base"
            aria-label="Virtual joystick. Move up to accelerate, down to brake, left and right to steer."
            aria-disabled={!enabled}
            data-active={state.joystick.active ? "" : undefined}
            {...joystickHandlers}
          >
            <div className="mobile-joystick-deadzone" aria-hidden="true" />
            <span className="mobile-joy-label mobile-joy-label--up" data-lit={state.gas ? "" : undefined}>▲ GAS</span>
            <span className="mobile-joy-label mobile-joy-label--down" data-lit={state.brake ? "" : undefined}>▼ BRAKE</span>
            <span className="mobile-joy-label mobile-joy-label--left" data-lit={state.steer < -0.05 ? "" : undefined}>◀</span>
            <span className="mobile-joy-label mobile-joy-label--right" data-lit={state.steer > 0.05 ? "" : undefined}>▶</span>
            <div
              className="mobile-joystick-knob"
              aria-hidden="true"
              style={{ transform: `translate(${state.joystick.knobX}px, ${state.joystick.knobY}px)` }}
            >
              <span className="mobile-joystick-knob__grip" />
            </div>
          </div>
          <button
            type="button"
            disabled={!enabled || simulation}
            className={`mobile-pedal mobile-joystick-boost ${boosting ? "is-boosting" : ""}`}
            style={{ "--boost-fill": `${Math.max(0, Math.min(100, boost))}%` } as CSSProperties}
            onPointerDown={(e) => {
              if (e.button === 0 && enabled) {
                e.preventDefault();
                controller.setJoystickBoost(true);
                setState(controller.snapshot());
              }
            }}
            onPointerUp={() => {
              controller.setJoystickBoost(false);
              setState(controller.snapshot());
            }}
            onPointerCancel={() => {
              controller.setJoystickBoost(false);
              setState(controller.snapshot());
            }}
            aria-label="Boost overdrive"
          >
            <i className="mobile-gas-fill" aria-hidden="true" />
            <span>BOOST</span>
            <small>{boosting ? "ACTIVE" : "2× TAP"}</small>
          </button>
        </div>
      )}

      {state.mode === "wheel" && (
        <>
          <div className="mobile-wheel-wrap">
            <div
              className="mobile-wheel-hitarea"
              aria-label="Virtual steering wheel. Rotate around center to steer."
              aria-disabled={!enabled}
              data-holding={state.wheel.isHolding ? "" : undefined}
              {...wheelHandlers}
            >
              <svg
                className="mobile-wheel-svg"
                viewBox="0 0 160 160"
                style={{ transform: `rotate(${state.wheel.angle}deg)` }}
                aria-hidden="true"
              >
                {/* Outer rim */}
                <circle cx="80" cy="80" r="70" className="wheel-rim-base" />
                <circle cx="80" cy="80" r="70" className="wheel-rim-tread" />
                {/* Top 12 o'clock center stripe */}
                <rect x="74" y="8" width="12" height="16" rx="2" className="wheel-top-marker" />
                {/* 3 Spokes */}
                <rect x="18" y="75" width="42" height="10" rx="3" className="wheel-spoke" />
                <rect x="100" y="75" width="42" height="10" rx="3" className="wheel-spoke" />
                <rect x="75" y="100" width="10" height="42" rx="3" className="wheel-spoke" />
                {/* Center Hub */}
                <circle cx="80" cy="80" r="24" className="wheel-hub-outer" />
                <circle cx="80" cy="80" r="16" className="wheel-hub-inner" />
                <text x="80" y="84" textAnchor="middle" className="wheel-hub-text">CAB</text>
              </svg>
              <div className="mobile-wheel-readout" aria-hidden="true">
                <strong>{Math.round(state.wheel.angle)}°</strong>
                <small>{state.wheel.isHolding ? "HOLD" : "RETURN"}</small>
              </div>
            </div>
          </div>
          {renderPedals()}
        </>
      )}
    </>
  );
}

