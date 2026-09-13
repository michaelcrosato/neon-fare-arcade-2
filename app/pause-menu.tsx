import { useRef, type KeyboardEvent } from "react";
import { CAMERA_DISTANCE_SCALES, CAMERA_OPTIONS, type CameraDistanceScale } from "@/game/config";
import type { CameraMode, FareImpact, Hud } from "@/game/model";
import { vehicleDefinition } from "@/game/vehicles";
import { StuntStatistics } from "./driving-stunt-feedback";
import { FareCardBrowser } from "./fare-card-deck";
import { PauseOverlay } from "./pause-overlay";

export type PauseView = "drive" | "fares";
type PauseMenuProps = {
  hud: Hud; hasRun: boolean; view: PauseView; onChangeView: (view: PauseView) => void;
  cameraMode: CameraMode; cameraDistanceScale: CameraDistanceScale; fareCards: readonly FareImpact[];
  diagnosticsActive: boolean; diagnosticsNotice: string; muted: boolean;
  onResume: () => void; onToggleMute: () => void; onOpenMap: () => void;
  onSetCameraMode: (mode: CameraMode) => void; onSetCameraDistanceScale: (scale: CameraDistanceScale) => void;
  onOpenHow: () => void; onOpenOptions: (tab?: "game" | "dev") => void;
  onEndRun: () => void; onToggleFareDispatch: () => void; onOpenScores: () => void;
  onCopyDiagnostics: () => void; onRecover: () => void;
};

export function PauseMenu({ hud, hasRun, view, onChangeView, cameraMode, cameraDistanceScale, fareCards,
  diagnosticsActive, diagnosticsNotice, muted, onResume, onToggleMute, onOpenMap, onSetCameraMode,
  onSetCameraDistanceScale, onOpenHow, onOpenOptions, onEndRun, onToggleFareDispatch, onOpenScores,
  onCopyDiagnostics, onRecover }: PauseMenuProps) {
  const tabs = useRef<HTMLDivElement>(null);
  const lockedDuty = hud.passengerOnboard || hud.courierActive;
  const tabKeys = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "drive" : event.key === "End" ? "fares" : view === "drive" ? "fares" : "drive";
    onChangeView(next);
    tabs.current?.querySelector<HTMLButtonElement>(`#pause-tab-${next}`)?.focus();
  };
  return <PauseOverlay>
    <section className={`pause-menu ${hasRun ? "" : "is-lobby"}`} aria-label="Pause menu">
      <header className="pause-menu__header">
        <div><p>{hasRun ? `${vehicleDefinition(hud.vehicleId).shortName} / ${hud.drivingModel.toUpperCase()}` : "NEON FARE / DRIVER LOUNGE"}</p>
          <h2>{hasRun ? hud.runKind === "free-run" ? "FREE RUN PAUSED!" : "PAUSED!" : "OPTIONS"}</h2></div>
        <button className="pause-menu__resume" onClick={onResume}>{hasRun ? hud.runKind === "free-run" ? "RESUME FREE RUN" : "RESUME RUN" : "BACK TO MENU"}<span aria-hidden="true">↗</span></button>
      </header>
      {hasRun && <>
        <div className="pause-menu__stats" aria-label="Current run">
          <span><small>FARE</small><b>${hud.fare}</b></span><span><small>SCORE</small><b>{hud.score.toLocaleString()}</b></span>
          <span><small>DELIVERIES</small><b>{hud.deliveries}</b></span><span><small>BEST MULTI</small><b>{hud.bestMultiplier.toFixed(1)}×</b></span>
        </div>
        <div className="pause-menu__tabs" role="tablist" aria-label="Pause views" ref={tabs} onKeyDown={tabKeys}>
          {(["drive", "fares"] as const).map(tab => <button key={tab} id={`pause-tab-${tab}`} role="tab"
            aria-selected={view === tab} aria-controls={`pause-panel-${tab}`} tabIndex={view === tab ? 0 : -1}
            onClick={() => onChangeView(tab)}>{tab === "drive" ? "DRIVE & OPTIONS" : `FARE DECK · ${fareCards.length}`}</button>)}
        </div>
      </>}
      <div className="pause-menu__body" id="pause-panel-drive" role={hasRun ? "tabpanel" : undefined}
        aria-labelledby={hasRun ? "pause-tab-drive" : undefined} hidden={hasRun && view !== "drive"}>
        {hasRun && <section className="pause-menu__driving" aria-label="Driving setup">
          <h3>YOUR DRIVE</h3>
          {hud.playerMode === "driving" && <div className="pause-menu__cameras">
            <div className="pause-camera-options" role="group" aria-label="Camera view"><small>VIEW</small><div>
              {CAMERA_OPTIONS.map(option => <button key={option.id} onClick={() => onSetCameraMode(option.id)} aria-pressed={cameraMode === option.id}>{option.shortLabel}</button>)}
            </div></div>
            <div className="pause-camera-options" role="group" aria-label="Camera distance"><small>DISTANCE</small><div>
              {CAMERA_DISTANCE_SCALES.map(scale => <button key={scale} onClick={() => onSetCameraDistanceScale(scale)} aria-pressed={cameraDistanceScale === scale}>{scale}x</button>)}
            </div></div>
          </div>}
          {hud.runKind === "free-run" && <>
            <button className={`duty-toggle ${hud.fareDispatchEnabled ? "is-on-duty" : "is-off-duty"}`} type="button" role="switch"
              aria-label="Passenger fare dispatch" aria-checked={hud.fareDispatchEnabled} aria-disabled={lockedDuty}
              aria-describedby={lockedDuty ? "pause-duty-lock-note" : undefined} onClick={onToggleFareDispatch}>
              <span><small>PASSENGER DISPATCH</small><strong>{hud.fareDispatchEnabled ? "ON DUTY" : "OFF DUTY"}</strong></span>
              <span className="pause-menu__switch" aria-hidden="true" />
            </button>
            <p className="pause-menu__hint" id="pause-duty-lock-note">{lockedDuty ? "Finish your current job to change duty status." : hud.fareDispatchEnabled ? "Go off duty to roam without passenger fares." : "Go on duty when you’re ready for passenger fares."}</p>
          </>}
          <StuntStatistics stunts={hud.stunts} />
          <button className="pause-recovery" onClick={onRecover} disabled={Boolean(hud.towReceipt)} aria-label="Get unstuck. Tow to the nearest clear road">
            <strong>GET UNSTUCK · CALL A TOW</strong>
            <small>{hud.towReceipt ? "TOW COMPLETE · RESUME TO DRIVE" : hud.towCost ? `$${hud.towCost} FROM RUN FARE · NEAREST CLEAR ROAD` : "FREE RESCUE · UNDER $100? ON THE HOUSE"}</small>
          </button>
        </section>}
        <section className="pause-menu__tools" aria-label="Game tools">
          <h3>MAKE YOURSELF AT HOME</h3>
          <div className="pause-menu__shortcuts">
            {hasRun && <button onClick={onOpenMap}>MAP <span aria-hidden="true">↗</span></button>}
            <button onClick={onToggleMute} aria-pressed={!muted}>{muted ? "AUDIO OFF" : "AUDIO ON"}<span aria-hidden="true">{muted ? "○" : "●"}</span></button>
            <button onClick={onOpenHow}>HOW TO PLAY <span aria-hidden="true">↗</span></button>
            <button onClick={onOpenScores}>RUN LOG <span aria-hidden="true">↗</span></button>
          </div>
          <button className="pause-menu__settings" onClick={() => onOpenOptions("game")}><strong>GAME OPTIONS</strong><small>Steering, camera, audio & display</small><span aria-hidden="true">↗</span></button>
          <div className="pause-menu__advanced"><small>WORKSHOP</small><button onClick={() => onOpenOptions("dev")}>OPTIONS · DEV MODE</button>
            {diagnosticsActive && <button onClick={onCopyDiagnostics}>COPY DIAGNOSTICS</button>}
            {diagnosticsNotice && <p role="status">{diagnosticsNotice}</p>}
          </div>
        </section>
      </div>
      {hasRun && <>
        <div className="pause-menu__fares" id="pause-panel-fares" role="tabpanel" aria-labelledby="pause-tab-fares" hidden={view !== "fares"}>
          <FareCardBrowser cards={fareCards} />
        </div>
        <footer className="pause-menu__footer"><small>{hud.playtest ? "PLAYTEST · LOCAL PROGRESS UNCHANGED" : hud.runKind === "free-run" ? "Your fare is banked when you end this run." : "Leaving ends this shift."}</small>
          <button onClick={onEndRun}>{hud.runKind === "free-run" ? hud.playtest ? "END PLAYTEST" : "END FREE RUN · BANK FARE" : "QUIT TO MENU"}</button>
        </footer>
      </>}
    </section>
  </PauseOverlay>;
}
