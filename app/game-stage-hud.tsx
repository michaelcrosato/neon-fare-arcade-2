import type { PointerEventHandler, RefObject } from "react";
import {
  DISPLAY_METERS_PER_WORLD_UNIT,
  cameraLabel,
} from "@/game/config";
import type {
  CameraMode,
  FareImpact,
  Hud,
  Mode,
} from "@/game/model";
import { simulationGearLabel } from "@/game/simulation-vehicle";
import { CourierImpactOverlay, type CourierImpact } from "./courier-impact-overlay";
import { FareImpactOverlay } from "./fare-impact-overlay";
import { FareCardStack } from "./fare-card-deck";
import { GpsMap } from "./gps-map";
import { MobileGameHud } from "./mobile-game-hud";
import { useMobileLayout } from "./use-mobile-layout";
import type { SteeringMode, TouchDriving } from "./runtime/touch-driving";

type GameStageHudProps = Readonly<{
  mode: Mode;
  hud: Hud;
  cameraMode: CameraMode;
  rendererKind: string;
  fareImpact: FareImpact | null;
  courierImpact: CourierImpact | null;
  dockedFareCards: readonly FareImpact[];
  onOpenFareDeck: () => void;
  onOpenMap: () => void;
  onCycleCamera: () => void;
  onPulseInteraction: () => void;
  onSetMode: (mode: Mode) => void;
  onTouch: PointerEventHandler<HTMLButtonElement>;
  touchDriving: TouchDriving;
  steeringMode?: SteeringMode;
  taxiExitRef: RefObject<HTMLButtonElement | null>;
}>;

export function GameStageHud({
  mode,
  hud,
  cameraMode,
  rendererKind,
  fareImpact,
  courierImpact,
  dockedFareCards,
  onOpenFareDeck,
  onOpenMap,
  onCycleCamera,
  onPulseInteraction,
  onSetMode,
  onTouch,
  touchDriving,
  steeringMode,
  taxiExitRef,
}: GameStageHudProps) {
  const mobile = useMobileLayout();
  if (mobile) return <MobileGameHud mode={mode} hud={hud} fareImpact={fareImpact} courierImpact={courierImpact}
    touchDriving={touchDriving} steeringMode={steeringMode} taxiExitRef={taxiExitRef} onPulseInteraction={onPulseInteraction} onSetMode={onSetMode} onTouch={onTouch} />;
  const simulationDriving = hud.playerMode === "driving" && hud.drivingModel === "simulation";
  const simulationGear = simulationGearLabel(hud.simulationVehicle.gear);
  const cabRollScale = 1 + Math.abs(Math.sin(hud.simulationVehicle.bodyRoll)) * 0.42;
  const canvasCabRoll = simulationDriving && rendererKind !== "WEBGPU ACTIVE";
  return (
    <>
      {fareImpact && <FareImpactOverlay key={fareImpact.id} impact={fareImpact} />}
      {courierImpact && <CourierImpactOverlay key={courierImpact.id} impact={courierImpact} />}
      {mode === "playing" && (
        <FareCardStack
          key={dockedFareCards[dockedFareCards.length - 1]?.id}
          cards={dockedFareCards}
          onOpen={onOpenFareDeck}
        />
      )}
      {mode !== "menu" && cameraMode === "cab" && hud.playerMode === "driving" && (
        <div
          className={`cab-frame ${simulationDriving ? "is-simulation" : ""}`}
          style={canvasCabRoll ? {
            transform: `rotate(${hud.simulationVehicle.bodyRoll}rad) scale(${cabRollScale})`,
            transformOrigin: "50% 70%",
          } : undefined}
          aria-hidden="true"
        >
          <i className="cab-mirror" />
          <span className="cab-pillars" />
          <div className="cab-dashboard">
            <small>{simulationDriving ? `CROWN CAB // ${simulationGear}` : "NEON FARE // CAB"}</small>
            <b>{hud.speed}</b>
            <em>{simulationDriving ? `${Math.round(hud.simulationVehicle.engineRpm / 50) * 50} RPM` : "KM/H"}</em>
          </div>
          <i className="cab-wheel" />
        </div>
      )}

      {mode !== "menu" && (
        <>
          <div className="hud-top">
            <div
              className={`timer-card ${hud.runKind === "free-run" ? "is-free-run" : hud.clockPaused ? "is-paused" : hud.time <= 10 ? "danger" : ""}`}
              aria-label={hud.runKind === "free-run" ? "Free Run. No timer." : undefined}
            >
              {hud.runKind === "free-run" ? (
                <><small className="timer-label">FREE RUN<b>NO TIMER</b></small><strong>∞</strong></>
              ) : (
                <>
                  <small className="timer-label">
                    {hud.clockPaused ? "METER PAUSED" : "TIME"}
                    {hud.playerMode !== "driving" && (
                      <b>{hud.clockPaused ? hud.playerMode === "interior" ? "INSIDE" : "ON FOOT" : "FARE ACTIVE"}</b>
                    )}
                  </small>
                  <strong>{Math.floor(hud.time).toString().padStart(2, "0")}<em>.{Math.floor((hud.time % 1) * 10)}</em></strong>
                </>
              )}
            </div>
            <div className="fare-card"><small>FARE</small><strong>${hud.fare}</strong></div>
            <div className="score-card"><small>SCORE</small><strong>{hud.score.toLocaleString().padStart(5, "0")}</strong></div>
          </div>

          {hud.playerMode === "driving" && <div className={`objective-banner ${hud.needsUTurn ? "is-uturn" : ""} ${hud.objectiveType === "roam" ? "is-roaming" : ""}`}>
            <span className={hud.objectiveType}>{hud.objectiveType === "roam" ? "OFF DUTY" : hud.objectiveType === "waypoint" ? "PIN" : hud.objectiveType.startsWith("courier") ? "COURIER" : hud.objectiveType === "drop" ? "DROP" : "PICKUP"}</span>
            <strong>{hud.objective}</strong>
            {hud.objectiveType !== "roam" && <b>{hud.distance}m</b>}
            {hud.objectiveType !== "roam" && <i className={hud.needsUTurn ? "is-uturn" : ""} style={hud.needsUTurn ? undefined : { transform: `rotate(${hud.objectiveAngle}rad)` }} aria-hidden="true">{hud.needsUTurn ? "↶" : "➤"}</i>}
          </div>}

          {hud.playerMode !== "driving" && hud.courierActive && (
            <button
              type="button"
              className={`courier-task-strip is-${hud.courierStage}`}
              onClick={onOpenMap}
              aria-label={`Open map for courier route to ${hud.courierPlace}`}
            >
              <span>COURIER // {hud.courierStage === "pickup" ? "COLLECT" : "DELIVER"}</span>
              <strong>{hud.playerMode === "interior" && hud.courierStage === "dropoff" && !hud.courierLoadedInTaxi
                ? "EXIT · RETURN TO TAXI"
                : hud.playerMode === "interior" && hud.courierAtTargetVenue && !hud.courierTaxiAtTarget
                  ? "EXIT · BRING TAXI CLOSER"
                  : hud.playerMode === "interior" && hud.courierAtTargetVenue
                    ? hud.courierStage === "pickup" ? "FIND THE COURIER COUNTER" : "HAND OFF AT THE COURIER COUNTER"
                    : hud.playerMode === "interior"
                      ? `EXIT · GO TO ${hud.courierPlace}`
                      : hud.courierNearEntrance && hud.courierTaxiAtTarget && (hud.courierStage === "pickup" || hud.courierLoadedInTaxi)
                        ? `ENTER ${hud.courierPlace}`
                        : `RETURN TO TAXI · ${hud.courierPlace}`}</strong>
              <small>{hud.courierCargo}{hud.playerMode !== "interior" ? " · TAP FOR MAP" : ""}</small>
            </button>
          )}

          {hud.playerMode === "driving" && <button
            className={`gps-panel ${hud.needsUTurn ? "is-uturn" : ""} ${hud.objectiveType === "roam" ? "is-off-duty" : ""}`}
            onClick={onOpenMap}
            aria-label={hud.objectiveType === "roam"
              ? "Open full regional GPS map. Off duty. Passenger fare guidance is off."
              : hud.needsUTurn
                ? "Open full regional GPS map. Wrong way. Make a U-turn when safe."
                : `Open full regional GPS map. ${hud.gpsInstruction} in ${Math.round(hud.gpsTurnDistance * DISPLAY_METERS_PER_WORLD_UNIT)} meters.`}
          >
            <span className="gps-header"><b>{hud.customDestination ? "CUSTOM ROUTE" : hud.objectiveType === "roam" ? "FREE ROAM" : hud.courierActive ? "COURIER GPS" : "FARE-FINDER"}</b><em>GPS // G</em></span>
            <GpsMap hud={hud} />
            <span className="gps-instruction"><b>{hud.gpsInstruction}</b><em>{hud.objectiveType === "roam" ? hud.district : `${hud.needsUTurn ? "TURN AROUND" : `${Math.round(hud.gpsTurnDistance * DISPLAY_METERS_PER_WORLD_UNIT)}m`} · ${hud.district}`}</em></span>
          </button>}

          <button
            className="camera-panel"
            onClick={onCycleCamera}
            disabled={hud.playerMode !== "driving"}
            aria-label={hud.playerMode === "driving"
              ? `Camera: ${cameraLabel(cameraMode)}. Activate to switch camera.`
              : hud.playerMode === "interior"
                ? `Camera: store view. ${cameraLabel(cameraMode)} resumes outside.`
                : `On-foot camera: ${cameraLabel(cameraMode)}. Return to the taxi to switch camera.`}
            aria-keyshortcuts="C"
          >
            <small>{hud.playerMode === "walking" ? "CAM // ON FOOT" : "CAM // C"}</small><strong>{hud.playerMode === "interior" ? "STORE VIEW" : cameraLabel(cameraMode)}</strong><i aria-hidden="true">{hud.playerMode === "driving" ? "↻" : "•"}</i>
          </button>

          {hud.playerMode === "driving" && hud.needsUTurn && (
            <div className="uturn-warning" aria-hidden="true">
              <small>WRONG WAY</small>
              <strong><b>↶</b> U-TURN!</strong>
              <span>TURN AROUND WHEN CLEAR</span>
            </div>
          )}

          <div className="speedometer">
            <small>{hud.playerMode === "driving" ? "KM/H" : "PACE · KM/H"}</small>
            <strong>{hud.speed}</strong>
            <div className="boost-label"><span>{hud.playerMode === "driving"
              ? simulationDriving
                ? hud.simulationVehicle.parkingBrake > 0.05 ? `PARK BRAKE · SLIP ${hud.driftAngle}°`
                  : hud.simulationVehicle.brake > 0.05 ? "SERVICE BRAKE"
                    : hud.simulationVehicle.throttle > 0.05 ? "THROTTLE"
                      : `4-SPEED AUTO · ${simulationGear}`
                : hud.brakeDriftKick > 0.05 ? `BRAKE KICK ${hud.driftAngle}°` : hud.boosting ? "BOOSTING" : hud.drifting ? `DRIFT ${hud.driftAngle}°` : "BOOST"
              : hud.onFootAction === "run" ? "RUNNING · SHIFT"
                : hud.onFootAction === "crouch" ? "CROUCHED · C / CTRL"
                  : hud.onFootAction === "jump" || hud.onFootAction === "fall" ? "AIRBORNE · SPACE"
                    : hud.onFootAction === "walk" ? "WALKING · SHIFT TO RUN"
                      : "READY · WASD"}</span><b>{hud.playerMode === "driving"
                        ? simulationDriving
                          ? `${simulationGear} · ${Math.round(hud.simulationVehicle.engineRpm)} RPM`
                          : `${Math.round(hud.boost)}%`
                        : hud.placeName}</b></div>
            {hud.playerMode === "driving" && <div className={`boost-track ${simulationDriving ? "is-simulation" : ""}`}><i style={{ width: `${simulationDriving ? hud.simulationVehicle.throttle * 100 : hud.boost}%` }} /></div>}
          </div>

          {mode === "playing" && hud.playerMode !== "driving" && (
            <div className="on-foot-guide" aria-label="On-foot controls">
              <span><kbd>SHIFT</kbd> RUN</span>
              <span><kbd>SPACE</kbd> JUMP</span>
              <span><kbd>C</kbd><kbd>CTRL</kbd> CROUCH</span>
            </div>
          )}

          {mode === "playing" && hud.interactionPrompt && (
            <button
              className="interaction-prompt"
              aria-label={`${hud.interactionPrompt}. ${hud.interactionDetail}`}
              aria-keyshortcuts="E"
              onClick={onPulseInteraction}
            >
              <kbd>E</kbd><span><strong>{hud.interactionPrompt.replace(/^E · /, "")}</strong><small>{hud.interactionDetail}</small></span>
            </button>
          )}

          <div className="combo-sticker"><small>MULTI</small><strong>{hud.combo.toFixed(1)}×</strong></div>
          {hud.message && <div className="comic-callout" key={hud.message}>{hud.message}</div>}
          {(mode === "playing" || mode === "paused") && (
            <button className="pause-button" onClick={() => onSetMode(mode === "paused" ? "playing" : "paused")} aria-label={mode === "paused" ? "Resume game" : "Pause game"}>{mode === "paused" ? "▶" : "Ⅱ"}</button>
          )}

          {mode === "playing" && <div className={`touch-controls ${hud.playerMode === "driving" ? "is-driving" : "is-on-foot"}`} aria-label={hud.playerMode === "driving" ? "Touch driving controls" : "Touch walking controls"}>
            <div className="touch-steer">
              <button data-input="left" aria-label={hud.playerMode === "driving" ? "Steer left" : "Turn left"} onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>◀</button>
              <button data-input="right" aria-label={hud.playerMode === "driving" ? "Steer right" : "Turn right"} onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>▶</button>
            </div>
            <div className="touch-pedals">
              <button data-input="down" className="brake" aria-label={hud.playerMode === "driving" ? simulationDriving ? "Brake. Hold through a complete stop to engage reverse." : "Brake or reverse. Tap while steering at speed to kick out the rear." : "Walk backward"} onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>{hud.playerMode === "driving" ? simulationDriving ? "BRAKE / R" : "BRAKE" : "BACK"}</button>
              <button data-input="up" className="gas" aria-label={hud.playerMode === "driving" ? "Accelerate" : "Walk forward"} onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>{hud.playerMode === "driving" ? "GAS" : "WALK"}</button>
              <button data-input={hud.playerMode === "driving" ? "boost" : "sprint"} className="boost" aria-label={hud.playerMode === "driving" ? simulationDriving ? "Parking brake" : "Boost" : "Run"} onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>{hud.playerMode === "driving" ? simulationDriving ? "PARK" : "BOOST" : "RUN"}</button>
              {hud.playerMode !== "driving" && <>
                <button data-input="crouch" className="crouch" aria-label="Crouch" onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>DUCK</button>
                <button data-input="jump" className="jump" aria-label="Jump" onPointerDown={onTouch} onPointerUp={onTouch} onPointerCancel={onTouch}>JUMP</button>
              </>}
            </div>
          </div>}
        </>
      )}
    </>
  );
}
