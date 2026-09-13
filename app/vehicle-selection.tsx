import type { TransmissionMode, VehicleId } from "@/game/model";
import { VEHICLES } from "@/game/vehicles";

function VehicleIllustration({ coupe }: { coupe: boolean }) {
  return <svg className="garage-car" viewBox="0 0 320 120" aria-hidden="true">
    <ellipse cx="162" cy="103" rx="139" ry="9" fill="#111" opacity=".2" />
    <g stroke="#191919" strokeWidth="3" strokeLinejoin="round">
      <path d={coupe ? "M20 74 45 62 95 55 130 28 191 27 240 55 284 64 300 83 294 97 22 97Z" : "M18 67 68 60 93 27 200 27 226 59 289 65 302 87 295 97 17 97Z"} fill={coupe ? "#f5f3e9" : "#f5c825"} />
      <path d={coupe ? "M106 55 134 33 187 33 227 57Z" : "M80 59 99 33 194 33 211 59Z"} fill="#426578" />
      <path d={coupe ? "M176 34 187 58 223 62 220 89 114 89 110 59" : "M146 33V88M78 64V89H214V64"} fill="none" strokeWidth="2" />
      {!coupe && <><path d="M132 26V16H167V26" fill="#f9dd53" /><path d="M101 74H200" strokeDasharray="8 6" strokeWidth="8" /></>}
      <path d="M25 75H48" stroke="#d5372e" strokeWidth="7" />
      <path d="M279 74H294" stroke="#fff9dc" strokeWidth="7" />
      <path d="M31 94H288" stroke="#7d807d" strokeWidth="4" />
      {coupe && <><path d="M217 72H237M217 78H232M217 84H235" stroke="#bd3634" strokeWidth="3" /><path d="M36 88 57 90M256 92H278" stroke="#b7b6b0" strokeWidth="2" /></>}
      {[75, 251].map(x => <g key={x}><circle cx={x} cy="92" r="20" fill="#242727" /><circle cx={x} cy="92" r="11" fill={coupe ? "#959b9d" : "#c4c6bd"} /><path d={`M${x - 8} 92h16M${x} 84v16`} strokeWidth="2" />{coupe && <circle cx={x} cy="92" r="17" fill="none" stroke="#6c7070" strokeWidth="2" strokeDasharray="3 4" />}</g>)}
    </g>
  </svg>;
}

type Props = {
  vehicleId: VehicleId;
  transmissionMode: TransmissionMode;
  onVehicleChange: (id: VehicleId) => void;
  onTransmissionChange: (mode: TransmissionMode) => void;
};

export function VehicleSelection({ vehicleId, transmissionMode, onVehicleChange, onTransmissionChange }: Props) {
  return <section className="vehicle-garage" aria-label="Vehicle selection">
    <div className="vehicle-garage__heading"><span>YOUR GARAGE</span><b>CHOOSE YOUR RIDE</b><small>2 / 3 BAYS FILLED</small></div>
    <div className="vehicle-garage__grid">
      {VEHICLES.map(vehicle => <article key={vehicle.id} className={`vehicle-card ${vehicle.id === vehicleId ? "is-selected" : ""}`}>
        <button type="button" className="vehicle-card__select" data-modal-autofocus={vehicle.id === vehicleId ? "true" : undefined} onClick={() => onVehicleChange(vehicle.id)} aria-pressed={vehicle.id === vehicleId} aria-label={`Select ${vehicle.name}`}>
          <span className="vehicle-card__top"><b>{vehicle.number} / {vehicle.layout}</b><small>{vehicle.id === vehicleId ? "SELECTED ✓" : "SELECT VEHICLE"}</small></span>
          <VehicleIllustration coupe={vehicle.id === "accord-v6"} />
          <strong>{vehicle.name}</strong><span>{vehicle.power}</span><small>{vehicle.transmission}</small>
        </button>
        <p>{vehicle.description}</p>
        <ul>{vehicle.details.map(detail => <li key={detail}>{detail}</li>)}</ul>
        {vehicle.id === "accord-v6" && <fieldset className="vehicle-transmission"><legend>SHIFTING</legend>
          {(["automatic", "manual"] as const).map(mode => <label key={mode}><input type="radio" name="accord-transmission" checked={transmissionMode === mode} onChange={() => { onVehicleChange("accord-v6"); onTransmissionChange(mode); }} />{mode === "automatic" ? "Automatic" : "Manual"}</label>)}
          <small>{transmissionMode === "automatic" ? "Six gears shift for you. Pump the clutch if it sticks." : "Hold Shift / CLUTCH; Z / − down, X / + up. Release to engage."}</small>
        </fieldset>}
      </article>)}
      <article className="vehicle-card vehicle-card--empty" aria-label="Vehicle slot 3. Empty."><span>03</span><b>EMPTY BAY</b><i aria-hidden="true" /><small>ROOM FOR ONE MORE</small></article>
    </div>
  </section>;
}
