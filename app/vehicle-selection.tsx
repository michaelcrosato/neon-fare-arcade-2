import type { DrivingModel, RunKind, TransmissionMode, VehicleId } from "@/game/model";
import { RunSetupProgress } from "./run-setup-progress";
import { VEHICLES } from "@/game/vehicles";
import { AccordStory } from "./vehicle-story";

type Props = {
  vehicleId: VehicleId;
  drivingModel: DrivingModel;
  runKind: RunKind;
  onConfirm: (id: VehicleId) => void;
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
    <p className="driver-traits__intro" id="vehicle-modal-description">Three rides. Three personalities. Pick the keys you want for this run.</p>
    <section className="vehicle-garage" aria-label="Vehicle selection">
    <div className="vehicle-garage__grid">
      {VEHICLES.map(vehicle => <article key={vehicle.id} className={`vehicle-card ${vehicle.id === vehicleId ? "is-selected" : ""}`}>
        <button type="button" className="vehicle-card__select" onClick={() => onVehicleChange(vehicle.id)} aria-pressed={vehicle.id === vehicleId} aria-label={`Select ${vehicle.name}`}>
          <span className="vehicle-card__top"><b>{vehicle.number} / {vehicle.layout}</b><small>{vehicle.id === vehicleId ? "SELECTED ✓" : "SELECT VEHICLE"}</small></span>
          <div className={`garage-car garage-car--${vehicle.id === "accord-v6" ? "accord" : vehicle.id === "gtr-r35" ? "gtr" : "crown"}`} aria-hidden="true" />
          <strong>{vehicle.name}</strong>
          {vehicle.id !== "accord-v6" && <><span>{vehicle.power}</span><small>{vehicle.transmission}</small></>}
        </button>
        {vehicle.id === "accord-v6" && <fieldset className="vehicle-transmission"><legend>SHIFTING</legend>
          {(["automatic", "manual"] as const).map(mode => <label key={mode}><input type="radio" name="accord-transmission" checked={transmissionMode === mode} onChange={() => { onVehicleChange("accord-v6"); onTransmissionChange(mode); }} />{mode === "automatic" ? "Automatic" : "Manual"}</label>)}
          <small>{transmissionMode === "automatic" ? "Six gears shift for you. Clutch stuck? Tap GAS three times or pump CLUTCH." : "Hold Shift / CLUTCH; Z / − down, X / + up. Release to engage."}</small>
        </fieldset>}
        <p>{vehicle.description}</p>
        {vehicle.id !== "accord-v6" && <ul>{vehicle.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
        {vehicle.id === "accord-v6" && <><small className="vehicle-financing">STARTS AT −$1,000 · FINANCED WINTER TIRES</small><AccordStory /></>}
        <div className="vehicle-card__lock"><button type="button" className="driver-trait__pick"
          data-modal-autofocus={vehicle.id === vehicleId ? "true" : undefined}
          onClick={() => onConfirm(vehicle.id)} aria-label={`Lock in ${vehicle.shortName}`}>
          LOCK IN {vehicle.shortName} <b aria-hidden="true">➜</b>
        </button></div>
      </article>)}
    </div>
    </section>
  </div>;
}
