import type { RefObject } from "react";
import type {
  CareerItemId,
  CareerState,
} from "@/game/career";
import {
  courierContract,
  type CourierAcceptResult,
} from "@/game/courier";
import type { GasStationOfferId } from "@/game/gas-station";
import type {
  CameraMode,
  CourierContractId,
  DrivingModel,
  DrivingTraitId,
  Hud,
  Modal,
  Mode,
  RunKind,
  RunRecord,
  WorldPoint,
} from "@/game/model";
import { CourierBoardPanel } from "./courier-board-panel";
import { DriverTraitPanel } from "./driver-trait-panel";
import { SteeringOptionPanel } from "./steering-option-panel";
import type { SteeringMode } from "./runtime/touch-driving";
import { GasStationPanel } from "./gas-station-panel";
import { GpsMap } from "./gps-map";
import { HomeBasePanel } from "./home-base-panel";
import type { DevelopmentPanelProps } from "./development-panel";
import { GameOptionsPanel } from "./game-options-panel";
import { DEFAULT_CAMERA_DISTANCE_SCALE, type CameraDistanceScale } from "@/game/config";

type GameModalHostProps = Readonly<{
  modal: Modal;
  modalParent: "home" | null;
  mode: Mode;
  pendingRunKind: RunKind;
  pendingDrivingModel: DrivingModel;
  hud: Hud;
  career: CareerState;
  records: readonly RunRecord[];
  mapNotice: string;
  homeNotice: string;
  courierNotice: string;
  gasNotice: string;
  development: Omit<DevelopmentPanelProps, "hud" | "onClose">;
  dialogRef: RefObject<HTMLElement | null>;
  optionsTab?: "game" | "dev";
  onSelectOptionsTab?: (tab: "game" | "dev") => void;
  muted?: boolean;
  onToggleMute?: () => void;
  cameraMode?: CameraMode;
  onSetCameraMode?: (mode: CameraMode) => void;
  cameraDistanceScale?: CameraDistanceScale;
  onSetCameraDistanceScale?: (scale: CameraDistanceScale) => void;
  rendererKind?: string;
  steeringMode?: SteeringMode;
  onSetSteeringMode?: (mode: SteeringMode) => void;
  onSelectDriverTrait?: (id: DrivingTraitId) => void;
  onSelectSteering?: (mode: SteeringMode) => void;
  onBackToTraits?: () => void;
  onClose: () => void;
  onBeginRun: (id: DrivingTraitId) => void;
  onSelectDestination: (point: WorldPoint) => void;
  onRemoveDestination: () => void;
  onToggleFareDispatch: () => void;
  onPurchaseHomeItem: (id: CareerItemId) => void;
  onRechargeAtHome: () => void;
  onOpenHomeSubview: (view: "map" | "scores" | "courier") => void;
  onPurchaseGasOffer: (id: GasStationOfferId) => void;
  onTakeCourierContract: (id: CourierContractId) => CourierAcceptResult;
  onRequestStartRun: (kind: RunKind, drivingModel?: DrivingModel) => void;
}>;

export function GameModalHost({
  modal,
  modalParent,
  mode,
  pendingRunKind,
  pendingDrivingModel,
  hud,
  career,
  records,
  mapNotice,
  homeNotice,
  courierNotice,
  gasNotice,
  development,
  dialogRef,
  optionsTab,
  onSelectOptionsTab,
  muted,
  onToggleMute,
  cameraMode,
  onSetCameraMode,
  cameraDistanceScale,
  onSetCameraDistanceScale,
  rendererKind,
  steeringMode,
  onSetSteeringMode,
  onSelectDriverTrait,
  onSelectSteering,
  onBackToTraits,
  onClose,
  onBeginRun,
  onSelectDestination,
  onRemoveDestination,
  onToggleFareDispatch,
  onPurchaseHomeItem,
  onRechargeAtHome,
  onOpenHomeSubview,
  onPurchaseGasOffer,
  onTakeCourierContract,
  onRequestStartRun,
}: GameModalHostProps) {
  if (!modal) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget !== event.target) return;
      onClose();
    }}>
      <section ref={dialogRef} className={`comic-modal ${modal === "traits" || modal === "steering" ? "trait-modal" : modal === "gas" ? "gas-modal" : modal === "map" ? "map-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={modal === "traits" ? "trait-modal-description" : modal === "steering" ? "steering-modal-description" : modal === "gas" ? "gas-station-description" : undefined} tabIndex={-1}>
        <button className="modal-close" onClick={onClose} aria-label={modal === "traits" ? "Back without starting" : modal === "steering" ? "Back to vehicle selection" : modalParent === "home" && modal !== "home" ? "Back to Home Hub" : "Close dialog"}>×</button>
        {modal === "traits" ? (
          <DriverTraitPanel onSelect={onSelectDriverTrait ?? onBeginRun} runKind={pendingRunKind} drivingModel={pendingDrivingModel} />
        ) : modal === "steering" ? (
          <SteeringOptionPanel
            currentMode={steeringMode ?? "default"}
            onSelect={onSelectSteering ?? (() => {})}
            onBack={onBackToTraits ?? onClose}
          />
        ) : modal === "options" ? (
          <GameOptionsPanel
            tab={optionsTab ?? "game"}
            onSelectTab={onSelectOptionsTab ?? (() => {})}
            muted={muted ?? false}
            onToggleMute={onToggleMute ?? (() => {})}
            cameraMode={cameraMode ?? "chase-low"}
            onSetCameraMode={onSetCameraMode ?? (() => {})}
            cameraDistanceScale={cameraDistanceScale ?? DEFAULT_CAMERA_DISTANCE_SCALE}
            onSetCameraDistanceScale={onSetCameraDistanceScale ?? (() => {})}
            steeringMode={steeringMode}
            onSetSteeringMode={onSetSteeringMode}
            rendererKind={rendererKind ?? "WEBGPU ACTIVE"}
            isFreeRun={hud.runKind === "free-run"}
            fareDispatchEnabled={hud.fareDispatchEnabled}
            onToggleFareDispatch={onToggleFareDispatch}
            development={{ ...development, hud, onClose }}
            onClose={onClose}
          />
        ) : modal === "how" ? (
          <>
            <p className="modal-kicker">DRIVER ORIENTATION</p>
            <h2 id="modal-title">HOW TO PLAY</h2>
            <div className="instruction-grid">
              <article><b>01</b><h3>CHOOSE YOUR SHIFT</h3><p>Play a 75-second Arcade Shift, untimed Arcade Free Run, or Simulation Free Run in the 1990s Crown Cab.</p></article>
              <article><b>02</b><h3>FOLLOW THE GPS</h3><p>The floating yellow arrow marks your next turn and shows the total distance remaining to your destination. Open the regional map with G and tap a street to set your route instantly.</p></article>
              <article><b>03</b><h3>HIT THE STREET</h3><p>Stop and press E to explore on foot. Run, jump, crouch, enter marked buildings, or return to the parked taxi whenever you are ready.</p></article>
            </div>
            <div className="mobile-help mobile-control-guide">
              <article><b>DRIVE WITH YOUR THUMBS</b><p>Place your left thumb anywhere on the playfield, then drag left or right to steer. Your first touch is center; more movement gives a tighter turn. Release to center the steering. Hold GAS or BRAKE on the right with your other thumb; pedal drags never steer. The guide and pedal labels appear during the countdown. The guide fades while you steer and returns when you center or release. Double-tap GAS and hold the second tap to boost; its fill shows your reserve. Hold BRAKE through a stop to reverse. In the simulation cab, double-tap and hold BRAKE for the parking brake.</p></article>
              <article><b>EXPLORE ON FOOT</b><p>Slow below 10 KM/H, then tap the yellow EXIT TAXI action beside the driver’s door. Use the direction pad to walk and turn. RUN, JUMP, and DUCK sit on the right; nearby doors and actions appear above the controls.</p></article>
              <article><b>YOUR CITY, ON DEMAND</b><p>Tap MENU for the map, camera, audio, and fare history. Destination distance sits beside the timer; speed is at the top center. Music fades after 30 seconds without a passenger and starts again on pickup. The world pauses while you browse.</p></article>
            </div>
            <div className="key-guide desktop-help">
              <span><kbd>W</kbd><kbd>↑</kbd> GAS / WALK</span>
              <span><kbd>S</kbd><kbd>↓</kbd> BRAKE / REVERSE · SIM: HOLD THROUGH STOP</span>
              <span><kbd>A</kbd><kbd>D</kbd> STEER / TURN</span>
              <span><kbd>SPACE</kbd> ARCADE BOOST / SIM PARKING BRAKE / ON-FOOT JUMP</span>
              <span><kbd>SHIFT</kbd> RUN ON FOOT</span>
              <span><kbd>C</kbd><kbd>CTRL</kbd> CROUCH ON FOOT · C CAMERA IN TAXI</span>
              <span><kbd>E</kbd> EXIT / ENTER / INTERACT</span>
              <span><kbd>P</kbd> PAUSE</span>
              <span><kbd>G</kbd> FULL GPS MAP</span>
              <span><kbd>M</kbd> MUTE</span>
            </div>
            <button className="primary-small" onClick={onClose}>{mode === "menu" ? "BACK TO MODE SELECT" : "BACK TO THE CITY"}</button>
          </>
        ) : modal === "map" ? (
          <>
            <p className="modal-kicker">REGIONAL NAVIGATION</p>
            <h2 id="modal-title">REGIONAL GPS</h2>
            <p className="full-map-help"><span className="desktop-help">TAP A STREET TO SET GPS · DRAG TO PAN · WHEEL OR +/− TO ZOOM · SHIFT+ARROWS MOVE GPS · ENTER RETURNS</span><span className="mobile-help">Tap a street to set GPS instantly. Drag to pan; + / − to zoom.</span></p>
            <div className="full-map-shell">
              <GpsMap
                hud={hud}
                full
                onDestinationSelect={onSelectDestination}
                onReturn={onClose}
              />
              <div className="full-map-legend">
                <span><i className="taxi-dot" /> TAXI · {hud.district}</span>
                {hud.walker && <span><i className="walker-dot" /> WALKER · TAXI PARKED</span>}
                {hud.missionType !== "roam" && <span><i className={hud.missionType} /> JOB · {hud.missionObjective}</span>}
                {hud.missionType === "roam" && <span><i className="roam" /> OFF DUTY · PASSENGER DISPATCH OFF</span>}
                {hud.customDestination && <span><i className="waypoint" /> CUSTOM ROUTE ACTIVE</span>}
                <span><i className="courier-pickup" /> DIAMONDS · COURIER LOCATIONS</span>
                <strong>
                  {hud.objectiveType === "roam"
                      ? "OFF DUTY · EXPLORE OR SET A CUSTOM ROUTE"
                      : hud.runKind === "free-run" ? `FREE RUN · OPTIONAL ROUTE · ${hud.gpsInstruction}` : hud.gpsInstruction}
                  {hud.objectiveType !== "roam" && ` · ${hud.distance}m`}
                </strong>
              </div>
            </div>
            <p className="full-map-status" role="status" aria-label="GPS pin status" aria-live="polite">{mapNotice}</p>
            <div className="full-map-actions">
              {hud.customDestination && <button onClick={onRemoveDestination}>{hud.fareDispatchEnabled ? "RETURN TO JOB ROUTE" : "CLEAR GPS ROUTE"}</button>}
              {hud.runKind === "free-run" && <button
                className={`duty-toggle ${hud.fareDispatchEnabled ? "is-on-duty" : "is-off-duty"}`}
                type="button"
                role="switch"
                aria-label="Passenger fare dispatch"
                aria-checked={hud.fareDispatchEnabled}
                aria-disabled={hud.passengerOnboard || hud.courierActive}
                aria-describedby={hud.passengerOnboard || hud.courierActive ? "map-duty-lock-note" : undefined}
                onClick={onToggleFareDispatch}
              >
                {hud.fareDispatchEnabled ? "GO OFF DUTY · ROAM FREELY" : "GO ON DUTY · FIND FARES"}
              </button>}
              {(hud.runKind === "free-run" && (hud.passengerOnboard || hud.courierActive)) && <span id="map-duty-lock-note" className="sr-only">Finish the current job before changing duty status.</span>}
              <button className="primary-small" onClick={onClose}>{modalParent === "home" ? "BACK TO HOME HUB" : "BACK TO THE STREET"}</button>
            </div>
          </>
        ) : modal === "home" ? (
          <HomeBasePanel
            career={career}
            rechargeUsed={hud.homeRechargeUsed}
            drivingModel={hud.drivingModel}
            notice={homeNotice}
            onPurchase={onPurchaseHomeItem}
            onRecharge={onRechargeAtHome}
            onOpenRuns={() => onOpenHomeSubview("scores")}
            onOpenMap={() => onOpenHomeSubview("map")}
            onOpenCourier={() => onOpenHomeSubview("courier")}
            onClose={onClose}
          />
        ) : modal === "gas" ? (
          <GasStationPanel
            career={career}
            time={hud.time}
            boost={hud.boost}
            timePurchases={hud.gasTimePurchases}
            taxiNearby={hud.gasTaxiNearby}
            passengerOnboard={hud.passengerOnboard}
            notice={gasNotice}
            onPurchase={onPurchaseGasOffer}
            onClose={onClose}
            runKind={hud.runKind}
            drivingModel={hud.drivingModel}
          />
        ) : modal === "courier" ? (
          <CourierBoardPanel
            contracts={hud.courierAvailable.map(courierContract)}
            activeContractId={hud.courierContractId}
            activeStage={hud.courierStage}
            passengerOnboard={hud.passengerOnboard}
            taxiPoint={hud.player}
            notice={courierNotice}
            onAccept={onTakeCourierContract}
            onClose={onClose}
            backLabel={modalParent === "home" ? "BACK TO HOME HUB" : hud.courierActive ? "START ROUTE" : "BACK TO THE CITY"}
            runKind={hud.runKind}
          />
        ) : (
          <>
            <p className="modal-kicker">LOCAL HIGH SCORES</p>
            <h2 id="modal-title">RUN LOG</h2>
            {records.length ? (
              <ol className="run-list">
                {records.map((record, index) => (
                  <li key={`${record.date}-${record.score}-${index}`}>
                    <strong>{index + 1}</strong><b className="run-rank">{record.rank}</b><span><em>{record.score.toLocaleString()}</em><small>{record.deliveries} DELIVERIES · ${record.fare} · {record.date}</small></span>
                  </li>
                ))}
              </ol>
            ) : <p className="empty-runs">NO RUNS YET. THE CITY&apos;S WAITING.</p>}
            <button className="primary-small" onClick={() => {
              if (mode === "menu") onClose();
              else if (mode === "ended") onRequestStartRun("timed");
              else onClose();
            }}>{modalParent === "home" ? "BACK TO HOME HUB" : mode === "menu" ? "BACK TO MODE SELECT" : mode === "ended" ? "START ARCADE SHIFT" : "BACK TO THE CITY"}</button>
          </>
        )}
      </section>
    </div>
  );
}
