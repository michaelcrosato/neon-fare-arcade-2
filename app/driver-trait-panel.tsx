"use client";

import { DRIVING_TRAIT_PACKAGES } from "@/game/driving-traits";
import type { DrivingModel, DrivingTraitId, RunKind, VehicleId, TransmissionMode } from "@/game/model";
import type { ReactNode } from "react";
import { vehicleDefinition } from "@/game/vehicles";
import { VehicleSelection } from "./vehicle-selection";
import { useMobileLayout } from "./use-mobile-layout";

type DriverTraitPanelProps = {
  onSelect: (traitId: DrivingTraitId) => void;
  runKind: RunKind;
  drivingModel: DrivingModel;
  vehicleId: VehicleId;
  transmissionMode: TransmissionMode;
  onVehicleChange: (id: VehicleId) => void;
  onTransmissionChange: (mode: TransmissionMode) => void;
};

function StatMeter({ label, value }: { label: string; value: number }) {
  return (
    <span className="driver-trait__stat" aria-label={`${label}: ${value} out of 5`}>
      <small>{label}</small>
      <i aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <b key={index} className={index < value ? "is-on" : ""} />)}
      </i>
    </span>
  );
}

function HandlingDetails({ mobile, children }: { mobile: boolean; children: ReactNode }) {
  return mobile ? <details className="driver-trait__details"><summary>HANDLING DETAILS</summary>{children}</details> : <>{children}</>;
}

export function DriverTraitPanel({ onSelect, runKind, drivingModel, vehicleId, transmissionMode, onVehicleChange, onTransmissionChange }: DriverTraitPanelProps) {
  const mobile = useMobileLayout();
  const vehicle = vehicleDefinition(vehicleId);
  const garage = <VehicleSelection vehicleId={vehicleId} transmissionMode={transmissionMode} onVehicleChange={onVehicleChange} onTransmissionChange={onTransmissionChange} />;
  if (drivingModel === "simulation") {
    return <div className="driver-traits driver-traits--simulation">
      <p className="modal-kicker">SIMULATION FREE RUN · NO TIMER</p>
      <h2 id="modal-title">CHOOSE YOUR VEHICLE</h2>
      <p className="driver-traits__intro" id="trait-modal-description">Real weight, tire grip, engine load and body roll. Pick a car for this run.</p>
      {garage}
      <div className="simulation-start">
        <strong>{vehicle.name} · {vehicle.layout}</strong>
        <p>{vehicleId === "accord-v6" ? transmissionMode === "manual"
          ? "Hold Shift (CLUTCH), tap Z / X (− / +) to change gear, then release. Reverse is below neutral; use GAS to back up. Launch assistance prevents stalling."
          : "Six manual gears with automatic shifting assistance. GAS goes forward; hold BRAKE through a stop to reverse. Pump CLUTCH three times if it sticks."
          : "Four-speed automatic. GAS goes forward; hold BRAKE through a stop to reverse. Heavy V8, rear-wheel drive."} Space operates the parking brake.</p>
        <button type="button" className="driver-trait__pick" data-modal-autofocus="true" onClick={() => onSelect("street-ace")} aria-label={`Start Simulation Free Run in the ${vehicleId === "crown-cab" ? "Crown Cab 96" : vehicle.name}.`}>START SIMULATION <b aria-hidden="true">➜</b></button>
      </div>
    </div>;
  }
  const freeRun = runKind === "free-run";
  return (
    <div className="driver-traits">
      <p className="modal-kicker">{freeRun ? "FREE RUN · NO TIMER" : "ARCADE SHIFT · 75 SEC"}</p>
      <h2 id="modal-title">PICK YOUR EDGE</h2>
      <p className="driver-traits__intro" id="trait-modal-description">
        {mobile ? "Choose your handling. Open the details to compare; you can pick again before your next run." : freeRun
          ? "Choose one package, then explore all seven regions at your pace, including the new Ironwake Works industrial harbor. Fares, courier jobs, interiors, and earnings stay active with no time pressure."
          : "Choose one package for this run. Passenger and courier payouts stay the same; handling, boost rhythm, and drift scoring can change."}
      </p>
      {garage}
      <h3 className="garage-handling-title">CHOOSE YOUR ARCADE HANDLING</h3>
      <div className="driver-traits__grid" role="list" aria-label="Driving trait packages">
        {DRIVING_TRAIT_PACKAGES.map((trait) => (
          <article
            key={trait.id}
            role="listitem"
            className={`driver-trait driver-trait--${trait.id}`}
          >
            <span className="driver-trait__number">{trait.number}</span>
            <span className="driver-trait__icon" aria-hidden="true"><i /><b /></span>
            <small className="driver-trait__role">{trait.role}</small>
            <strong className="driver-trait__name">{trait.name}</strong>
            <p>{trait.tagline}</p>
            <HandlingDetails mobile={mobile}><ul aria-label={`${trait.name} highlights`}>
              {trait.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            </ul>
            <div className="driver-trait__stats">
              <StatMeter label="SPEED" value={trait.stats.speed} />
              <StatMeter label="CONTROL" value={trait.stats.control} />
              <StatMeter label="DRIFT" value={trait.stats.drift} />
            </div>
            <em>{trait.tradeoff}</em></HandlingDetails>
            <button
              type="button"
              className="driver-trait__pick"
              data-modal-autofocus={trait.id === "street-ace" ? "true" : undefined}
              onClick={() => onSelect(trait.id)}
              aria-label={`Choose ${trait.name}. ${trait.tagline} ${trait.tradeoff}.`}
            >
              LOCK IN {trait.name} <b aria-hidden="true">➜</b>
            </button>
          </article>
        ))}
      </div>
      <p className="driver-traits__footnote">A fresh package can be chosen before every {freeRun ? "Free Run" : "run"}.</p>
    </div>
  );
}
