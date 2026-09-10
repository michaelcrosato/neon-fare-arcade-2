import { CAMERA_OPTIONS } from "@/game/config";
import { drivingTraitPackage } from "@/game/driving-traits";
import { rankFor } from "@/game/math";
import type {
  CameraMode,
  DrivingModel,
  FareImpact,
  Hud,
  Mode,
  RunKind,
} from "@/game/model";
import { FareCardBrowser } from "./fare-card-deck";
import { useMobileLayout } from "./use-mobile-layout";
import { TowReceipt } from "./tow-receipt";
import { PauseOverlay } from "./pause-overlay";

type GameSessionOverlaysProps = Readonly<{
  mode: Mode;
  hud: Hud;
  cameraMode: CameraMode;
  careerBank: number;
  fareCards: readonly FareImpact[];
  diagnosticsActive: boolean;
  diagnosticsNotice: string;
  muted: boolean;
  onToggleMute: () => void;
  onOpenMap: () => void;
  onSetCameraMode: (mode: CameraMode) => void;
  onSetMode: (mode: Mode) => void;
  onOpenHow: () => void;
  onOpenOptions: () => void;
  onFinishRun: () => void;
  onToggleFareDispatch: () => void;
  onRequestStartRun: (runKind: RunKind, drivingModel?: DrivingModel) => void;
  onOpenScores: () => void;
  onCopyDiagnostics: () => void;
  onRecover: () => void;
}>;

export function GameSessionOverlays({
  mode,
  hud,
  cameraMode,
  careerBank,
  fareCards,
  diagnosticsActive,
  diagnosticsNotice,
  muted,
  onToggleMute,
  onOpenMap,
  onSetCameraMode,
  onSetMode,
  onOpenHow,
  onOpenOptions,
  onFinishRun,
  onToggleFareDispatch,
  onRequestStartRun,
  onOpenScores,
  onCopyDiagnostics,
  onRecover,
}: GameSessionOverlaysProps) {
  const mobile = useMobileLayout();
  return (
    <>
      {mode === "playing" && hud.towReceipt && <TowReceipt receipt={hud.towReceipt} />}
      {mode === "countdown" && (
        <div className="countdown" aria-live="assertive">
          <small>{hud.drivingModel === "simulation" ? "SIMULATION FREE RUN" : hud.runKind === "free-run" ? "FREE RUN · NO TIMER" : "DRIVER PACKAGE"}</small>
          <b>{hud.drivingModel === "simulation" ? "CROWN CAB ’96" : drivingTraitPackage(hud.drivingTraitId).name}</b>
          <span>{Math.ceil(Math.max(0, hud.countdown)) || "GO!"}</span>
        </div>
      )}

      {mode === "paused" && (
        <PauseOverlay>
          <div className="pause-layout">
            <div className="pause-paper">
              <p>{hud.runKind === "free-run" ? "NO RUSH. NO CLOCK." : "THE CITY CAN WAIT…"}</p>
              <h2>{hud.runKind === "free-run" ? "FREE RUN PAUSED!" : "PAUSED!"}</h2>
              {mobile && <>
                <button className="primary-small" onClick={() => onSetMode("playing")}>{hud.runKind === "free-run" ? "RESUME FREE RUN" : "RESUME RUN"}</button>
                <div className="pause-stats"><span><small>FARE</small><b>${hud.fare}</b></span><span><small>SCORE</small><b>{hud.score.toLocaleString()}</b></span><span><small>DROPS</small><b>{hud.deliveries}</b></span></div>
                <div className="pause-tools">
                  <button onClick={onOpenMap}>MAP</button>
                  <button onClick={onOpenScores}>RUN LOG</button>
                  <button onClick={onToggleMute}>{muted ? "AUDIO OFF" : "AUDIO ON"}</button>
                </div>
              </>}
              {hud.playerMode === "driving" && <div className="pause-camera-options" role="group" aria-label="Camera view">
                <small>CAMERA VIEW</small>
                <div>
                  {CAMERA_OPTIONS.map((option) => (
                    <button key={option.id} onClick={() => onSetCameraMode(option.id)} aria-pressed={cameraMode === option.id}>{option.shortLabel}</button>
                  ))}
                </div>
              </div>}
              {hud.runKind === "free-run" && <>
                <button
                  className={`duty-toggle ${hud.fareDispatchEnabled ? "is-on-duty" : "is-off-duty"}`}
                  type="button"
                  role="switch"
                  aria-label="Passenger fare dispatch"
                  aria-checked={hud.fareDispatchEnabled}
                  aria-disabled={hud.passengerOnboard || hud.courierActive}
                  aria-describedby={hud.passengerOnboard || hud.courierActive ? "pause-duty-lock-note" : undefined}
                  onClick={onToggleFareDispatch}
                >
                  <small>PASSENGER DISPATCH · {hud.fareDispatchEnabled ? "ON DUTY" : "OFF DUTY"}</small>
                  <strong>{hud.fareDispatchEnabled ? "GO OFF DUTY · ROAM FREELY" : "GO ON DUTY · FIND FARES"}</strong>
                </button>
                {(hud.passengerOnboard || hud.courierActive) && <small id="pause-duty-lock-note" className="duty-lock-note">FINISH CURRENT JOB TO CHANGE DUTY STATUS</small>}
              </>}
              {!mobile && <button className="primary-small" onClick={() => onSetMode("playing")}>{hud.runKind === "free-run" ? "RESUME FREE RUN" : "RESUME RUN"}</button>}
              <button className="pause-recovery" onClick={onRecover} disabled={Boolean(hud.towReceipt)} aria-label="Get unstuck. Tow to the nearest clear road">
                <strong>GET UNSTUCK · CALL A TOW</strong>
                <small>{hud.towReceipt ? "TOW COMPLETE · RESUME TO DRIVE" : hud.towCost ? `$${hud.towCost} FROM RUN FARE · BACK TO THE NEAREST ROAD` : "FREE RESCUE · UNDER $100? ON THE HOUSE"}</small>
              </button>
              <button onClick={onOpenOptions}>OPTIONS · DEV MODE</button>
              <button onClick={onOpenHow}>HOW TO PLAY</button>
              {diagnosticsActive && <button onClick={onCopyDiagnostics}>COPY DIAGNOSTICS</button>}
              {diagnosticsNotice && <small className="duty-lock-note" role="status" aria-live="polite">{diagnosticsNotice}</small>}
              {hud.runKind === "free-run"
                ? <button onClick={onFinishRun}>{hud.playtest ? "END PLAYTEST" : "END FREE RUN · BANK FARE"}</button>
                : <button onClick={() => onSetMode("menu")}>QUIT TO MENU</button>}
            </div>
            {mobile ? <details className="pause-fares"><summary>FARE HISTORY <span>{fareCards.length}</span></summary><FareCardBrowser cards={fareCards} /></details> : <FareCardBrowser cards={fareCards} />}
          </div>
        </PauseOverlay>
      )}

      {mode === "ended" && (
        <div className="end-overlay">
          <div className={`rank-burst ${hud.runKind === "free-run" ? "is-free-run" : ""}`}><small>{hud.runKind === "free-run" ? "MODE" : "RANK"}</small><strong>{hud.runKind === "free-run" ? "FREE" : rankFor(hud.score)}</strong></div>
          <div className="end-paper">
            <p>{hud.playtest ? "PLAYTEST · LOCAL PROGRESS UNCHANGED" : hud.runKind === "free-run" ? "CAB PARKED · FARE BANKED" : "SHIFT'S OVER"}</p>
            <h2>{hud.playtest ? "PLAYTEST COMPLETE!" : hud.runKind === "free-run" ? "FREE RUN SAVED!" : "RUN COMPLETE!"}</h2>
            <div className="end-total"><span>TOTAL SCORE</span><strong>{hud.score.toLocaleString()}</strong></div>
            <div className="end-grid">
              <span><small>FARE</small><b>${hud.fare}</b></span>
              <span><small>DELIVERIES</small><b>{hud.deliveries}</b></span>
              <span><small>PACKAGES</small><b>{hud.courierDeliveries}</b></span>
              <span><small>BEST MULTI</small><b>{hud.bestMultiplier.toFixed(1)}×</b></span>
              <span><small>CRASHES</small><b>{hud.collisions}</b></span>
            </div>
            <p className="banked-callout">{hud.playtest ? "PLAYTEST EARNINGS AND SCORES ARE NOT SAVED" : `FARE BANKED +$${hud.fare} · CAREER TOTAL $${careerBank} · NEON LOFTS IS NEAR THE STARTING BLOCK`}</p>
            <button className="primary-small" onClick={() => onRequestStartRun(hud.runKind, hud.drivingModel)}>{hud.drivingModel === "simulation" ? "SIMULATION AGAIN" : hud.runKind === "free-run" ? "FREE RUN AGAIN" : "RUN IT BACK"}</button>
            {hud.runKind === "timed"
              ? <><button onClick={onOpenScores}>VIEW RUN LOG</button>{mobile && <button onClick={() => onSetMode("menu")}>RETURN TO MENU</button>}</>
              : <button onClick={() => onSetMode("menu")}>RETURN TO MENU</button>}
          </div>
        </div>
      )}
    </>
  );
}
