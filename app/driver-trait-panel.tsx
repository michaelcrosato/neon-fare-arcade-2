"use client";

import { DRIVING_TRAIT_PACKAGES } from "@/game/driving-traits";
import type { DrivingTraitId, RunKind } from "@/game/model";
import type { ReactNode } from "react";
import { RunSetupProgress } from "./run-setup-progress";
import { useMobileLayout } from "./use-mobile-layout";

type DriverTraitPanelProps = {
  onSelect: (traitId: DrivingTraitId) => void;
  runKind: RunKind;
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

export function DriverTraitPanel({ onSelect, runKind }: DriverTraitPanelProps) {
  const mobile = useMobileLayout();
  const freeRun = runKind === "free-run";
  return (
    <div className="driver-traits setup-screen">
      <RunSetupProgress current="traits" />
      <p className="modal-kicker">{freeRun ? "FREE RUN · NO TIMER" : "ARCADE SHIFT · 75 SEC"}</p>
      <h2 id="modal-title">PICK YOUR EDGE</h2>
      <p className="driver-traits__intro" id="trait-modal-description">
        {mobile ? "Choose your handling. Open the details to compare; you can pick again before your next run." : freeRun
          ? "Choose one package, then explore all seven regions at your pace, including the new Ironwake Works industrial harbor. Fares, courier jobs, interiors, and earnings stay active with no time pressure."
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
