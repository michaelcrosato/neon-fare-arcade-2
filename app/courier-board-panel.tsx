"use client";

import type { CourierContract, CourierAcceptResult } from "@/game/courier";
import { courierContract, courierDistanceQuote } from "@/game/courier";
import type { CourierContractId, RunKind, Vec2 } from "@/game/model";

export function CourierBoardPanel({
  contracts,
  activeContractId,
  activeStage,
  passengerOnboard,
  taxiPoint,
  notice,
  onAccept,
  onClose,
  backLabel,
  runKind,
}: {
  contracts: readonly CourierContract[];
  activeContractId: CourierContractId | null;
  activeStage: "pickup" | "dropoff" | null;
  passengerOnboard: boolean;
  taxiPoint: Vec2;
  notice: string;
  onAccept: (id: CourierContractId) => CourierAcceptResult;
  onClose: () => void;
  backLabel: string;
  runKind: RunKind;
}) {
  return (
    <>
      <p className="modal-kicker">CITY DISPATCH NETWORK</p>
      <h2 id="modal-title">COURIER BOARD</h2>
      <p className="courier-board__intro">
        PARK. GO INSIDE. SECURE THE PACKAGE. THEN MAKE THE HANDOFF IN PERSON.
      </p>
      {activeContractId && activeStage && (
        <div className="courier-board__active">
          <small>ACTIVE CONTRACT</small>
          <strong>{courierContract(activeContractId).title} · {activeStage.toUpperCase()}</strong>
          <span>Finish this delivery before taking another.</span>
        </div>
      )}
      {passengerOnboard && !activeContractId && (
        <div id="courier-passenger-block" className="courier-board__active is-blocked" role="status">
          <small>TAXI OCCUPIED</small>
          <strong>FINISH THE PASSENGER FARE FIRST</strong>
        </div>
      )}
      {notice && <p className="courier-board__notice" role="status">{notice}</p>}
      <div className="courier-offers" aria-label="Available courier contracts">
        {contracts.map((contract) => {
          const quote = courierDistanceQuote(contract, taxiPoint);
          return (
            <article className={`courier-offer handling-${contract.handling}`} key={contract.id}>
              <span className="courier-offer__tag">{contract.handling}</span>
              <small>{contract.client} {"//"} {quote.routeMeters}m EST. ROUTE</small>
              <h3>{contract.cargo}</h3>
              <p><b>FROM</b> {contract.origin.venue.label}</p>
              <p><b>TO</b> {contract.destination.venue.label}</p>
              <footer>
                <strong>{runKind === "free-run"
                  ? `EST. ~$${quote.estimatedCash} · NO TIMER`
                  : `EST. ~$${quote.estimatedCash} · UP TO +${quote.totalSeconds} SEC`}</strong>
                <button
                  disabled={Boolean(activeContractId) || passengerOnboard}
                  aria-describedby={passengerOnboard && !activeContractId ? "courier-passenger-block" : undefined}
                  onClick={() => onAccept(contract.id)}
                >TAKE JOB</button>
              </footer>
            </article>
          );
        })}
      </div>
      {!contracts.length && !activeContractId && <p className="empty-runs">ALL CONTRACTS CLEARED. NEW RUNS ARE BEING POSTED.</p>}
      <button className="primary-small" onClick={onClose}>{backLabel}</button>
    </>
  );
}
