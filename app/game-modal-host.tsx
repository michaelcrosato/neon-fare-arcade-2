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
  VehicleId,
  TransmissionMode,
  Hud,
  Modal,
  Mode,
  RunKind,
  RunRecord,
  WorldPoint,
} from "@/game/model";
import { CourierBoardPanel } from "./courier-board-panel";
import { DriverTraitPanel } from "./driver-trait-panel";
import { stuntMeters } from "./driving-stunt-feedback";
import { VehicleSelection } from "./vehicle-selection";
import { SteeringOptionPanel } from "./steering-option-panel";
import type { SteeringMode, WheelRange } from "./runtime/touch-driving";
import { GasStationPanel } from "./gas-station-panel";
import { GpsMap } from "./gps-map";
import { HomeBasePanel } from "./home-base-panel";
import { ShoppingPanel, StoreDirectory } from "./shopping-panel";
import type { DevelopmentPanelProps } from "./development-panel";
import { GameOptionsPanel } from "./game-options-panel";
import { DEFAULT_CAMERA_DISTANCE_SCALE, type CameraDistanceScale } from "@/game/config";

type GameModalHostProps = Readonly<{
  modal: Modal;
  modalParent: "home" | null;
  mode: Mode;
  pendingRunKind: RunKind;
  pendingDrivingModel: DrivingModel;
  pendingVehicleId: VehicleId;
  pendingTransmissionMode: TransmissionMode;
  onSelectVehicle: (id: VehicleId) => void;
  onConfirmVehicle?: () => void;
  onSelectTransmission: (mode: TransmissionMode) => void;
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
  wheelRange?: WheelRange;
  onSetWheelRange?: (range: WheelRange) => void;
  onSetSteeringMode?: (mode: SteeringMode) => void;
  onSelectDriverTrait?: (id: DrivingTraitId) => void;
  onSelectSteering?: (mode: SteeringMode) => void;
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
  pendingVehicleId, pendingTransmissionMode, onSelectVehicle, onSelectTransmission, onConfirmVehicle,
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
  wheelRange,
  onSetWheelRange,
  onSetSteeringMode,
  onSelectDriverTrait,
  onSelectSteering,
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
      <section key={modal} ref={dialogRef} className={`comic-modal ${modal === "vehicles" ? "trait-modal vehicle-modal" : modal === "traits" || modal === "steering" ? "trait-modal" : modal === "gas" ? "gas-modal" : modal === "map" ? "map-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={modal === "vehicles" ? "vehicle-modal-description" : modal === "traits" ? "trait-modal-description" : modal === "steering" ? "steering-modal-description" : modal === "gas" ? "gas-station-description" : undefined} tabIndex={-1}>
        <button className="modal-close" onClick={onClose} aria-label={modal === "vehicles" ? "Back without starting" : modal === "traits" ? "Back to vehicle selection" : modal === "steering" ? `Back to ${pendingDrivingModel === "simulation" ? "vehicle" : "edge"} selection` : modalParent === "home" && modal !== "home" ? "Back to Home Hub" : "Close dialog"}>×</button>
        {modal === "vehicles" ? (
          <VehicleSelection vehicleId={pendingVehicleId} transmissionMode={pendingTransmissionMode} drivingModel={pendingDrivingModel} runKind={pendingRunKind}
            onVehicleChange={onSelectVehicle} onTransmissionChange={onSelectTransmission} onConfirm={onConfirmVehicle ?? (() => {})} />
        ) : modal === "traits" ? (
          <DriverTraitPanel onSelect={onSelectDriverTrait ?? onBeginRun} runKind={pendingRunKind} />
        ) : modal === "steering" ? (
          <SteeringOptionPanel
            currentMode={steeringMode ?? "default"}
            wheelRange={wheelRange} onSetWheelRange={onSetWheelRange}
            onSelect={onSelectSteering ?? (() => {})}
            onBack={onClose} simulation={pendingDrivingModel === "simulation"}
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
            wheelRange={wheelRange} onSetWheelRange={onSetWheelRange}
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
              <article><b>01</b><h3>CHOOSE YOUR SHIFT</h3><p>Play a 75-second Arcade Shift, untimed Arcade Free Run, or Simulation Free Run. Choose your vehicle, then your Arcade Edge, then lock in steering. Simulation goes from Vehicle straight to Steering.</p></article>
              <article><b>02</b><h3>FOLLOW THE GPS</h3><p>The floating yellow arrow marks your next turn and shows the total distance remaining to your destination. Open the regional map with G and tap a street to set your route instantly.</p></article>
              <article><b>03</b><h3>HIT THE STREET</h3><p>Stop and press E to explore on foot. Run, jump, crouch, enter marked buildings, or return to the parked taxi whenever you are ready.</p></article>
            </div>
            <div className="mobile-help mobile-control-guide">
              <article><b>FLOATING JOYSTICK &amp; WHEEL</b><p>Both controls start wherever you touch the playfield. Joystick: drag up for gas, down for brake, and sideways to steer. Wheel: turn the rim, then release to let it return. Set Wheel rotation range in the steering selection or Options; fewer degrees give tighter turns.</p></article>
              <article><b>DRIVE WITH YOUR THUMBS</b><p>Place your left thumb anywhere on the playfield, then drag left or right to steer. Your first touch is center; more movement gives a tighter turn. Release to center the steering. Hold GAS or BRAKE on the right with your other thumb; pedal drags never steer. The guide and pedal labels appear during the countdown. The guide fades while you steer and returns when you center or release. Double-tap GAS and hold the second tap to boost; its fill shows your reserve. Hold BRAKE through a stop to reverse. In the simulation cab, double-tap and hold BRAKE for the parking brake.</p></article>
              <article><b>ACCORD CLUTCH</b><p>Automatic shifting is the default. Choose Manual on the Accord card to use CLUTCH with − / + for R, N and gears 1–6. Hold the clutch, change gear, then release. In Manual, GAS moves in the selected direction and BRAKE only brakes. If the clutch sticks in Automatic, tap and release GAS three times or pump CLUTCH. Manual requires three CLUTCH pumps.</p></article>
              <article><b>EXPLORE ON FOOT</b><p>Slow below 10 KM/H, then tap the yellow EXIT TAXI action beside the driver’s door. Use the direction pad to walk and turn. RUN, JUMP, and DUCK sit on the right; nearby doors and actions appear above the controls.</p></article>
              <article><b>YOUR CITY, ON DEMAND</b><p>Tap MENU for the map, camera, audio, and fare history. Destination distance sits beside the timer; speed is at the top center. In Free Run, tap CRUISE to set a speed. Joystick gas, brake and reverse temporarily override it; release to resume. Separate brakes or a collision cancel it. The world pauses while you browse menus.</p></article>
            </div>
            <div className="key-guide desktop-help">
              <span><kbd>W</kbd><kbd>↑</kbd> GAS / WALK</span>
              <span><kbd>S</kbd><kbd>↓</kbd> BRAKE / REVERSE · SIM: HOLD THROUGH STOP</span>
              <span><kbd>A</kbd><kbd>D</kbd> STEER / TURN</span>
              <span><kbd>SPACE</kbd> ARCADE BOOST / SIM PARKING BRAKE / ON-FOOT JUMP</span>
              <span><kbd>SHIFT</kbd> ACCORD CLUTCH / RUN ON FOOT</span>
              <span><kbd>Z</kbd><kbd>X</kbd> MANUAL GEAR DOWN / UP · CLUTCH HELD</span>
              <span><kbd>C</kbd><kbd>CTRL</kbd> CROUCH ON FOOT · C CAMERA IN TAXI</span>
              <span><kbd>E</kbd> EXIT / ENTER / INTERACT</span>
              <span><kbd>P</kbd> PAUSE</span>
              <span><kbd>G</kbd> FULL GPS MAP</span>
              <span><kbd>M</kbd> MUTE</span>
              <span><kbd>F</kbd> FILL TANK AT GAS STATION</span>
            </div>
            <p><b>CROWN CAB · ARCADE DRIFT</b> For a sideways stop, approach at about 90–120 KM/H, release the gas, then steer and brake together. Hold the brake to slow through the slide. Center or countersteer to catch it, and release the brake at rest to avoid reversing. Use S or ↓ on keyboard, or BRAKE with your steering thumb on touch.</p>
            <p>Both cars use real tank capacities and fuel consumption ratings in every mode. Speeding raises fuel use, reaching double at 50% over the posted limit. Stop at GO-GO GAS for fuel; an empty tank can get a 5 L assist through the pause menu tow service. Your fuel level stays with each car between runs.</p>
            <p>Your apartment at Neon Lofts is included. Bank your fare, visit the four home stores from the GPS shopping directory, and furnish your place. Manage owned items at the apartment&apos;s home hub.</p>
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
            <details className="map-shops"><summary>STORES, HOME + FUEL ↗</summary><StoreDirectory /></details>
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
        ) : modal === "shop" ? (
          <ShoppingPanel onClose={onClose} />
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
                    <strong>{index + 1}</strong><b className="run-rank">{record.rank}</b><span><em>{record.score.toLocaleString()}</em><small>{record.deliveries} DELIVERIES · ${record.fare} · {record.date}</small>{record.stunts && <small>DRIFT {stuntMeters(record.stunts.driftTotalMeters)} · AIR {stuntMeters(record.stunts.airTotalMeters)}</small>}</span>
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
