import type { DrivingModel, RunKind, TransmissionMode, VehicleId } from "@/game/model";
import { RunSetupProgress } from "./run-setup-progress";
import { VEHICLES, vehicleDefinition } from "@/game/vehicles";

type Props = {
  vehicleId: VehicleId;
  drivingModel: DrivingModel;
  runKind: RunKind;
  onConfirm: () => void;
  transmissionMode: TransmissionMode;
  onVehicleChange: (id: VehicleId) => void;
  onTransmissionChange: (mode: TransmissionMode) => void;
};

export function VehicleSelection({ vehicleId, transmissionMode, onVehicleChange, onTransmissionChange, drivingModel, runKind, onConfirm }: Props) {
  const simulation = drivingModel === "simulation";
  return <div className="vehicle-screen setup-screen">
    <RunSetupProgress current="vehicles" simulation={simulation} />
    <p className="modal-kicker">{simulation ? "SIMULATION FREE RUN" : runKind === "free-run" ? "ARCADE FREE RUN" : "ARCADE SHIFT"} · THE GARAGE</p>
    <h2 id="modal-title">SELECT YOUR VEHICLE</h2>
    <p className="driver-traits__intro" id="vehicle-modal-description">Two rides. Two personalities. Pick the keys you want for this run.</p>
    <section className="vehicle-garage" aria-label="Vehicle selection">
    <div className="vehicle-garage__grid">
      {VEHICLES.map(vehicle => <article key={vehicle.id} className={`vehicle-card ${vehicle.id === vehicleId ? "is-selected" : ""}`}>
        <button type="button" className="vehicle-card__select" data-modal-autofocus={vehicle.id === vehicleId ? "true" : undefined} onClick={() => onVehicleChange(vehicle.id)} aria-pressed={vehicle.id === vehicleId} aria-label={`Select ${vehicle.name}`}>
          <span className="vehicle-card__top"><b>{vehicle.number} / {vehicle.layout}</b><small>{vehicle.id === vehicleId ? "SELECTED ✓" : "SELECT VEHICLE"}</small></span>
          <div className={`garage-car garage-car--${vehicle.id === "accord-v6" ? "accord" : "crown"}`} aria-hidden="true" />
          <strong>{vehicle.name}</strong><span>{vehicle.power}</span><small>{vehicle.transmission}</small>
        </button>
        {vehicle.id === "accord-v6" && <fieldset className="vehicle-transmission"><legend>SHIFTING</legend>
          {(["automatic", "manual"] as const).map(mode => <label key={mode}><input type="radio" name="accord-transmission" checked={transmissionMode === mode} onChange={() => { onVehicleChange("accord-v6"); onTransmissionChange(mode); }} />{mode === "automatic" ? "Automatic" : "Manual"}</label>)}
          <small>{transmissionMode === "automatic" ? "Six gears shift for you. Clutch stuck? Tap GAS three times or pump CLUTCH." : "Hold Shift / CLUTCH; Z / − down, X / + up. Release to engage."}</small>
        </fieldset>}
        <p>{vehicle.description}</p>
        <ul>{vehicle.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
      </article>)}
      <article className="vehicle-card vehicle-card--empty" aria-label="Vehicle slot 3. Empty."><span>03</span><b>EMPTY BAY</b><i aria-hidden="true" /><small>ROOM FOR ONE MORE</small></article>
    </div>
    </section>
    <div className="vehicle-screen__continue"><span>{vehicleDefinition(vehicleId).shortName} <small>{vehicleId === "accord-v6" ? transmissionMode === "automatic" ? "AUTO SHIFT" : "MANUAL" : "AUTOMATIC"}</small></span>
      <button type="button" className="primary-small" onClick={onConfirm} aria-label={`Continue to ${simulation ? "Steering" : "Edge"} selection`}>LOCK IN VEHICLE <b aria-hidden="true">➜</b></button>
    </div>
  </div>;
}
