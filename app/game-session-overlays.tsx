import type { CameraDistanceScale } from "@/game/config";
import { drivingTraitPackage } from "@/game/driving-traits";
import { vehicleDefinition } from "@/game/vehicles";
import { StuntStatistics } from "./driving-stunt-feedback";
import { rankFor } from "@/game/math";
import type {
  CameraMode,
  DrivingModel,
  FareImpact,
  Hud,
  Mode,
  RunKind,
} from "@/game/model";
import { useMobileLayout } from "./use-mobile-layout";
import { TowReceipt } from "./tow-receipt";
import { PauseMenu, type PauseView } from "./pause-menu";

type GameSessionOverlaysProps = Readonly<{
  mode: Mode;
  menuOptionsOpen?: boolean;
  pauseView?: PauseView;
  onChangePauseView?: (view: PauseView) => void;
  onResume?: () => void;
  hud: Hud;
  cameraMode: CameraMode;
  cameraDistanceScale: CameraDistanceScale;
  careerBank: number;
  fareCards: readonly FareImpact[];
  diagnosticsActive: boolean;
  diagnosticsNotice: string;
  muted: boolean;
  onToggleMute: () => void;
  onOpenMap: () => void;
  onSetCameraMode: (mode: CameraMode) => void;
  onSetCameraDistanceScale: (scale: CameraDistanceScale) => void;
  onSetMode: (mode: Mode) => void;
  onOpenHow: () => void;
  onOpenOptions: (tab?: "game" | "dev") => void;
  onFinishRun: () => void;
  onToggleFareDispatch: () => void;
  onRequestStartRun: (runKind: RunKind, drivingModel?: DrivingModel) => void;
  onOpenScores: () => void;
  onCopyDiagnostics: () => void;
  onRecover: () => void;
}>;

export function GameSessionOverlays({
  mode, menuOptionsOpen = false, pauseView = "drive", onChangePauseView = () => {}, onResume,
  hud,
  cameraMode,
  cameraDistanceScale,
  careerBank,
  fareCards,
  diagnosticsActive,
  diagnosticsNotice,
  muted,
  onToggleMute,
  onOpenMap,
  onSetCameraMode,
  onSetCameraDistanceScale,
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
          <b>{hud.drivingModel === "simulation" ? vehicleDefinition(hud.vehicleId).shortName : `${vehicleDefinition(hud.vehicleId).shortName} · ${drivingTraitPackage(hud.drivingTraitId).name}`}</b>
          <span>{Math.ceil(Math.max(0, hud.countdown)) || "GO!"}</span>
        </div>
      )}

      {(mode === "paused" || menuOptionsOpen) && <PauseMenu
        hud={hud} hasRun={mode === "paused"} view={pauseView} onChangeView={onChangePauseView}
        cameraMode={cameraMode} cameraDistanceScale={cameraDistanceScale} fareCards={fareCards}
        diagnosticsActive={diagnosticsActive} diagnosticsNotice={diagnosticsNotice} muted={muted}
        onResume={onResume ?? (() => onSetMode("playing"))} onToggleMute={onToggleMute} onOpenMap={onOpenMap}
        onSetCameraMode={onSetCameraMode} onSetCameraDistanceScale={onSetCameraDistanceScale}
        onOpenHow={onOpenHow} onOpenOptions={onOpenOptions} onToggleFareDispatch={onToggleFareDispatch}
        onOpenScores={onOpenScores} onCopyDiagnostics={onCopyDiagnostics} onRecover={onRecover}
        onEndRun={hud.runKind === "free-run" ? onFinishRun : () => onSetMode("menu")}
      />}

      {mode === "ended" && !menuOptionsOpen && (
        <div className="end-overlay">
          <div className={`rank-burst ${hud.runKind === "free-run" ? "is-free-run" : ""}`}><small>{hud.runKind === "free-run" ? "MODE" : "RANK"}</small><strong>{hud.runKind === "free-run" ? "FREE" : rankFor(hud.score)}</strong></div>
          <div className="end-paper">
            <p>{hud.playtest ? "PLAYTEST · LOCAL PROGRESS UNCHANGED" : hud.runKind === "free-run" ? "CAB PARKED · FARE BANKED" : "SHIFT'S OVER"}</p>
            <h2>{hud.playtest ? "PLAYTEST COMPLETE!" : hud.runKind === "free-run" ? "FREE RUN SAVED!" : "RUN COMPLETE!"}</h2>
            <div className="end-total"><span>TOTAL SCORE</span><strong>{hud.score.toLocaleString()}</strong></div>
            <StuntStatistics stunts={hud.stunts} />
            <div className="end-grid">
              <span><small>FARE</small><b>${hud.fare}</b></span>
              <span><small>DELIVERIES</small><b>{hud.deliveries}</b></span>
              <span><small>PACKAGES</small><b>{hud.courierDeliveries}</b></span>
              <span><small>BEST MULTI</small><b>{hud.bestMultiplier.toFixed(1)}×</b></span>
              <span><small>CRASHES</small><b>{hud.collisions}</b></span>
            </div>
            <p className="banked-callout">{hud.playtest ? "PLAYTEST EARNINGS AND SCORES ARE NOT SAVED" : `FARE BANKED +$${Math.max(0, hud.fare)} · CAREER TOTAL $${careerBank}${hud.fare < 0 ? " · WINTER TIRES STILL OWING THIS RUN" : " · NEON LOFTS IS NEAR THE STARTING BLOCK"}`}</p>
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
