import type { RefObject } from "react";
import type { Hud, Mode } from "@/game/model";

export function ClutchWarning({ hud, mode, warningRef }: {
  hud: Hud; mode: Mode; warningRef: RefObject<HTMLDivElement | null>;
}) {
  if (mode !== "playing" || hud.playerMode !== "driving" || hud.vehicleId !== "accord-v6" || !hud.transmission.stuck) return null;
  const pumps = hud.transmission.pumpsRemaining;
  return <div ref={warningRef} className="clutch-warning" role="alert" aria-atomic="true" hidden>
    <svg className="clutch-warning__icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 30 28H2Z" /><path d="M16 11v8m0 4v1" />
    </svg>
    <div className="clutch-warning__copy">
      <strong>CLUTCH STUCK</strong>
      <span>{hud.transmissionMode === "automatic" ? "TAP GAS" : "PUMP CLUTCH"} <b>×{pumps}</b></span>
      <div className="clutch-warning__pumps" aria-hidden="true">
        {[1, 2, 3].map(pump => <i key={pump} className={pump <= 3 - pumps ? "is-done" : ""} />)}
      </div>
    </div>
  </div>;
}
