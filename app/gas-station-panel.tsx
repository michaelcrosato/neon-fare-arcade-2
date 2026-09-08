"use client";

import {
  GAS_CAREER_ITEMS,
  careerOwns,
  type CareerState,
} from "@/game/career";
import {
  GAS_TIME_PURCHASE_LIMIT,
  quoteGasTimePurchase,
  type GasStationOfferId,
} from "@/game/gas-station";
import type { DrivingModel, RunKind } from "@/game/model";

export function GasStationPanel({
  career,
  time,
  boost,
  timePurchases,
  taxiNearby,
  passengerOnboard,
  notice,
  onPurchase,
  onClose,
  runKind,
  drivingModel,
}: {
  career: CareerState;
  time: number;
  boost: number;
  timePurchases: number;
  taxiNearby: boolean;
  passengerOnboard: boolean;
  notice: string;
  onPurchase: (id: GasStationOfferId) => void;
  onClose: () => void;
  runKind: RunKind;
  drivingModel: DrivingModel;
}) {
  const freeRun = runKind === "free-run";
  const simulation = drivingModel === "simulation";
  const quote = quoteGasTimePurchase(time, timePurchases);
  const contextBlock = passengerOnboard
    ? "DROP OFF YOUR PASSENGER BEFORE SERVICING THE TAXI."
    : !taxiNearby
      ? "PARK THE TAXI NEAR THE GO-GO GAS ENTRANCE."
      : "";
  const timeShortfall = quote.status === "available" ? Math.max(0, quote.cost - career.bank) : 0;
  const timeDisabled = freeRun || Boolean(contextBlock) || quote.status !== "available" || timeShortfall > 0;
  const timeButton = contextBlock
    ? passengerOnboard ? "TAXI OCCUPIED" : "BRING TAXI CLOSER"
    : freeRun
      ? "NO TIMER IN FREE RUN"
      : quote.status === "limit-reached"
      ? "PUMPS EMPTY THIS SHIFT"
      : quote.status === "meter-full"
        ? "CLOCK FULL · 99 SEC"
        : timeShortfall > 0
          ? `NEED $${timeShortfall} MORE`
          : `BUY +${quote.secondsAdded.toFixed(quote.secondsAdded % 1 ? 1 : 0)} SEC · $${quote.cost}`;

  return (
    <div className="gas-station">
      <header className="gas-station__header">
        <div>
          <p className="modal-kicker">GO-GO GAS // SHIFT SERVICE</p>
          <h2 id="modal-title">PIT STOP!</h2>
          <p id="gas-station-description">{simulation
            ? "Simulation uses its stock powertrain and has no arcade boost. Permanent upgrades can still be installed for arcade runs; Rally Tires continue to affect shared off-road drag."
            : freeRun
            ? "Free Run needs no clock service. Permanent cab upgrades are still available now and on every future session."
            : "Turn banked fare into more clock, then bolt permanent upgrades onto this run and every run after it."}</p>
        </div>
        <dl className="gas-station__gauges" aria-label="Current gas station status">
          <div><dt>BANKED FARE</dt><dd>${career.bank}</dd></div>
          <div><dt>{freeRun ? "MODE" : "RUN TIME"}</dt><dd>{freeRun ? "FREE" : `${time.toFixed(1)}s`}</dd></div>
          <div><dt>{simulation ? "POWERTRAIN" : "BOOST"}</dt><dd>{simulation ? "SIM" : `${Math.round(boost)}%`}</dd></div>
          <div><dt>{freeRun ? "TIMER" : "PUMPS"}</dt><dd>{freeRun ? "OFF" : `${timePurchases}/${GAS_TIME_PURCHASE_LIMIT}`}</dd></div>
        </dl>
      </header>

      {contextBlock && (
        <div id="gas-station-block" className="gas-station__blocked" role="status">
          <small>SERVICE HOLD</small><strong>{contextBlock}</strong>
        </div>
      )}

      <section className="gas-station__section" aria-labelledby="gas-time-title">
        <div className="gas-station__section-title">
          <span>01</span><div><small>FUEL // BUY MORE CLOCK</small><h3 id="gas-time-title">TIME SPLASH</h3></div>
        </div>
        <article className="gas-time-card">
          <div className="gas-time-card__pump" aria-hidden="true"><i /><b>+</b></div>
          <div>
            <p id="gas-time-description">{freeRun
              ? "The Free Run meter is permanently off, so there is no clock to refill and no time purchase to make."
              : "Add up to 15 seconds now. Near the 99-second cap, GO-GO GAS charges only for the seconds that fit. Two fills maximum per run."}</p>
            {!freeRun && quote.status === "available" && !contextBlock && (
              <b>{time.toFixed(1)} → {Math.min(99, time + quote.secondsAdded).toFixed(1)} SEC</b>
            )}
          </div>
          <button
            disabled={timeDisabled}
            aria-describedby={contextBlock ? "gas-station-block" : "gas-time-description"}
            onClick={() => onPurchase("time-splash")}
          >{timeButton}</button>
        </article>
      </section>

      <section className="gas-station__section" aria-labelledby="gas-upgrades-title">
        <div className="gas-station__section-title">
          <span>02</span><div><small>PERMANENT // ACTIVE NOW + FUTURE RUNS</small><h3 id="gas-upgrades-title">CAB UPGRADES</h3></div>
        </div>
        <div className="gas-upgrade-grid">
          {GAS_CAREER_ITEMS.map((item) => {
            const owned = careerOwns(career, item.id);
            const shortfall = Math.max(0, item.cost - career.bank);
            const disabled = owned || Boolean(contextBlock) || shortfall > 0;
            const detailId = `gas-upgrade-${item.id}`;
            const buttonCopy = owned
              ? "INSTALLED"
              : contextBlock
                ? passengerOnboard ? "TAXI OCCUPIED" : "BRING TAXI CLOSER"
                : shortfall > 0
                  ? `NEED $${shortfall} MORE`
                  : `INSTALL · $${item.cost}`;
            return (
              <article key={item.id} className={`gas-upgrade ${owned ? "is-owned" : ""}`}>
                <small>GO-GO UPGRADE</small><span>${item.cost}</span>
                <h4>{item.name}</h4>
                <p id={detailId}>{item.description}</p>
                <b>{item.effect}</b>
                <button
                  disabled={disabled}
                  aria-describedby={contextBlock ? "gas-station-block" : detailId}
                  onClick={() => onPurchase(item.id)}
                >{buttonCopy}</button>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="gas-station__footer">
        <p role="status" aria-live="polite">{notice || "BANKED FARE PAYS THE BILL. CURRENT-RUN FARE STILL BANKS WHEN THE SESSION ENDS."}</p>
        <button className="primary-small" onClick={onClose}>BACK TO GO-GO GAS</button>
      </footer>
    </div>
  );
}
