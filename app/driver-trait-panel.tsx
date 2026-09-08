"use client";

import { DRIVING_TRAIT_PACKAGES } from "@/game/driving-traits";
import type { DrivingModel, DrivingTraitId, RunKind } from "@/game/model";

type DriverTraitPanelProps = {
  onSelect: (traitId: DrivingTraitId) => void;
  runKind: RunKind;
  drivingModel: DrivingModel;
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

export function DriverTraitPanel({ onSelect, runKind, drivingModel }: DriverTraitPanelProps) {
  if (drivingModel === "simulation") {
    return (
      <div className="driver-traits driver-traits--simulation">
        <p className="modal-kicker">SIMULATION FREE RUN · NO TIMER</p>
        <h2 id="modal-title">CROWN CAB ’96</h2>
        <p className="driver-traits__intro" id="trait-modal-description">
          A separate full-size taxi model inspired by 1990s Crown Victoria fleet cabs. The city, fares, couriers, interiors, and earnings stay the same; the vehicle does not.
        </p>
        <div className="driver-traits__grid" role="list" aria-label="Simulation taxi specification">
          <article role="listitem" className="driver-trait driver-trait--simulation">
            <span className="driver-trait__number">SIM</span>
            <span className="driver-trait__icon" aria-hidden="true"><i /><b /></span>
            <small className="driver-trait__role">FULL-SIZE · REAR-WHEEL DRIVE</small>
            <strong className="driver-trait__name">CROWN CAB ’96</strong>
            <p>Heavy body-on-frame sedan dynamics with a naturally aspirated V8 and four-speed automatic.</p>
            <ul aria-label="Simulation systems">
              <li>1,900 KG LOADED · 2.91 M WHEELBASE</li>
              <li>4-SPEED AUTO · REAL GEAR/RPM LOAD</li>
              <li>FRICTION CIRCLES · LOAD TRANSFER · BODY ROLL</li>
              <li>WHEEL LIFT · CURB TRIPS · PHYSICAL ROLLOVER</li>
              <li>SPACE = PARKING BRAKE · NO ARCADE BOOST</li>
            </ul>
            <div className="simulation-specs" aria-label="Driving behavior">
              <span><small>THROTTLE</small><b>PROGRESSIVE</b></span>
              <span><small>BRAKES</small><b>WEIGHTED</b></span>
              <span><small>STEERING</small><b>FULL LOCK · RATE-LIMITED</b></span>
              <span><small>REVERSE</small><b>BRAKE · THEN ENGAGE</b></span>
            </div>
            <em>THIS IS NOT A DRIVER TRAIT. IT REPLACES THE ARCADE VEHICLE MODEL FOR THE ENTIRE FREE RUN.</em>
            <button
              type="button"
              className="driver-trait__pick"
              data-modal-autofocus="true"
              onClick={() => onSelect("street-ace")}
              aria-label="Start Simulation Free Run in the Crown Cab 96."
            >
              START SIMULATION <b aria-hidden="true">➜</b>
            </button>
          </article>
        </div>
        <p className="driver-traits__footnote">W / S control the automatic transmission. Hold S through a stop to engage reverse. Exit a stopped overturned cab and press E beside it to right it.</p>
      </div>
    );
  }
  const freeRun = runKind === "free-run";
  return (
    <div className="driver-traits">
      <p className="modal-kicker">{freeRun ? "FREE RUN · NO TIMER" : "ARCADE SHIFT · 75 SEC"}</p>
      <h2 id="modal-title">PICK YOUR EDGE</h2>
      <p className="driver-traits__intro" id="trait-modal-description">
        {freeRun
          ? "Choose one package, then explore all six regions—from Neon City to Solana Coast—at your pace. Fares, courier jobs, interiors, and earnings stay active with no time pressure."
          : "Choose one package for this run. Passenger and courier payouts stay the same; handling, boost rhythm, and drift scoring can change."}
      </p>
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
            <ul aria-label={`${trait.name} highlights`}>
              {trait.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            </ul>
            <div className="driver-trait__stats">
              <StatMeter label="SPEED" value={trait.stats.speed} />
              <StatMeter label="CONTROL" value={trait.stats.control} />
              <StatMeter label="DRIFT" value={trait.stats.drift} />
            </div>
            <em>{trait.tradeoff}</em>
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
