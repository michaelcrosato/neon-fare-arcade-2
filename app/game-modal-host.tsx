import type { RefObject } from "react";
import { DISPLAY_METERS_PER_WORLD_UNIT } from "@/game/config";
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
  CourierContractId,
  DrivingModel,
  DrivingTraitId,
  Hud,
  Modal,
  Mode,
  NavigationPlan,
  RunKind,
  RunRecord,
  Vec2,
} from "@/game/model";
import { routeLength } from "@/game/navigation";
import { CourierBoardPanel } from "./courier-board-panel";
import { DriverTraitPanel } from "./driver-trait-panel";
import { GasStationPanel } from "./gas-station-panel";
import { GpsMap } from "./gps-map";
import { HomeBasePanel } from "./home-base-panel";

type GameModalHostProps = Readonly<{
  modal: Modal;
  modalParent: "home" | null;
  mode: Mode;
  pendingRunKind: RunKind;
  pendingDrivingModel: DrivingModel;
  hud: Hud;
  career: CareerState;
  records: readonly RunRecord[];
  mapDraft: Vec2 | null;
  mapDraftPlan: NavigationPlan | null;
  mapNotice: string;
  homeNotice: string;
  courierNotice: string;
  gasNotice: string;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onBeginRun: (id: DrivingTraitId) => void;
  onDraftDestination: (point: Vec2) => void;
  onCommitDestination: () => void;
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
  mapDraft,
  mapDraftPlan,
  mapNotice,
  homeNotice,
  courierNotice,
  gasNotice,
  dialogRef,
  onClose,
  onBeginRun,
  onDraftDestination,
  onCommitDestination,
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
      <section ref={dialogRef} className={`comic-modal ${modal === "traits" ? "trait-modal" : modal === "gas" ? "gas-modal" : modal === "map" ? "map-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby={modal === "traits" ? "trait-modal-description" : modal === "gas" ? "gas-station-description" : undefined} tabIndex={-1}>
        <button className="modal-close" onClick={onClose} aria-label={modal === "traits" ? "Back without starting" : modalParent === "home" && modal !== "home" ? "Back to Home Hub" : "Close dialog"}>×</button>
        {modal === "traits" ? (
          <DriverTraitPanel onSelect={onBeginRun} runKind={pendingRunKind} drivingModel={pendingDrivingModel} />
        ) : modal === "how" ? (
          <>
            <p className="modal-kicker">DRIVER ORIENTATION</p>
            <h2 id="modal-title">HOW TO PLAY</h2>
            <div className="instruction-grid">
              <article><b>01</b><h3>CHOOSE YOUR SHIFT</h3><p>Play a 75-second Arcade Shift, untimed Arcade Free Run, or Simulation Free Run in the 1990s Crown Cab.</p></article>
              <article><b>02</b><h3>FOLLOW THE GPS</h3><p>The floating yellow arrow marks your next real turn. Open the regional map, tap any street, then set a custom route—or press G anytime.</p></article>
              <article><b>03</b><h3>HIT THE STREET</h3><p>Stop and press E to explore on foot. Run, jump, crouch, enter marked buildings, or return to the parked taxi whenever you are ready.</p></article>
            </div>
            <div className="mobile-help mobile-control-guide">
              <article><b>DRIVE WITH YOUR THUMBS</b><p>Steer on the left. Hold GAS on the right. BRAKE slows you down; keep holding to reverse. BOOST gives your arcade cab a burst of speed; PARK is the simulation cab’s parking brake.</p></article>
              <article><b>EXPLORE ON FOOT</b><p>Stop, then tap EXIT TAXI. Use the direction pad to walk and turn. RUN, JUMP, and DUCK sit on the right; nearby doors and actions appear above the controls.</p></article>
              <article><b>YOUR CITY, ON DEMAND</b><p>Tap the route strip to open the map. Tap MENU to pause, change camera, adjust audio, or review your fares. The world pauses while you browse.</p></article>
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
            <p className="full-map-help"><span className="desktop-help">TAP A STREET TO DROP A PIN · DRAG TO PAN · WHEEL OR +/− TO ZOOM · SHIFT+ARROWS MOVE PIN · ENTER SETS</span><span className="mobile-help">Tap a street to drop a pin. Drag to pan; use + / − to zoom.</span></p>
            <div className="full-map-shell">
              <GpsMap
                hud={hud}
                full
                draftDestination={mapDraft}
                draftPlan={mapDraftPlan}
                onDestinationDraft={onDraftDestination}
                onDestinationCommit={onCommitDestination}
              />
              <div className="full-map-legend">
                <span><i className="taxi-dot" /> TAXI · {hud.district}</span>
                {hud.walker && <span><i className="walker-dot" /> WALKER · TAXI PARKED</span>}
                {hud.missionType !== "roam" && <span><i className={hud.missionType} /> JOB · {hud.missionObjective}</span>}
                {hud.missionType === "roam" && <span><i className="roam" /> OFF DUTY · PASSENGER DISPATCH OFF</span>}
                {hud.customDestination && <span><i className="waypoint" /> CUSTOM ROUTE ACTIVE</span>}
                <span><i className="courier-pickup" /> DIAMONDS · COURIER LOCATIONS</span>
                <strong>
                  {mapDraft
                    ? hud.fareDispatchEnabled ? "CUSTOM DETOUR · JOB STAYS ACTIVE · PREVIEW ROUTE" : "CUSTOM ROUTE PREVIEW · OFF DUTY"
                    : hud.objectiveType === "roam"
                      ? "OFF DUTY · EXPLORE OR SET A CUSTOM ROUTE"
                      : hud.runKind === "free-run" ? `FREE RUN · OPTIONAL ROUTE · ${hud.gpsInstruction}` : hud.gpsInstruction}
                  {(mapDraft || hud.objectiveType !== "roam") && ` · ${mapDraftPlan ? Math.round(routeLength(mapDraftPlan.route) * DISPLAY_METERS_PER_WORLD_UNIT) : hud.distance}m`}
                </strong>
              </div>
            </div>
            <p className="full-map-status" role="status" aria-label="GPS pin status" aria-live="polite">{mapNotice}</p>
            <div className="full-map-actions">
              <button className="primary-small" onClick={onCommitDestination} disabled={!mapDraft}>SET GPS ROUTE</button>
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
              <button onClick={onClose}>{modalParent === "home" ? "BACK TO HOME HUB" : "BACK TO THE STREET"}</button>
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
