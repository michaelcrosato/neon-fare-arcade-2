import {
  HOME_CAREER_ITEMS,
  careerOwns,
  type CareerItemId,
  type CareerState,
} from "@/game/career";
import type { DrivingModel } from "@/game/model";

type HomeBasePanelProps = {
  career: CareerState;
  rechargeUsed: boolean;
  drivingModel: DrivingModel;
  notice: string;
  onPurchase: (id: CareerItemId) => void;
  onRecharge: () => void;
  onOpenRuns: () => void;
  onOpenMap: () => void;
  onOpenCourier: () => void;
  onClose: () => void;
};

export function HomeBasePanel({
  career,
  rechargeUsed,
  drivingModel,
  notice,
  onPurchase,
  onRecharge,
  onOpenRuns,
  onOpenMap,
  onOpenCourier,
  onClose,
}: HomeBasePanelProps) {
  const ownsLoft = careerOwns(career, "neon-loft");
  const ownsGarage = careerOwns(career, "garage-base");
  const simulation = drivingModel === "simulation";
  const titleFor = (id: CareerItemId) => HOME_CAREER_ITEMS.find((item) => item.id === id)?.name ?? id;

  return (
    <div className="home-hub">
      <div className="home-hub__header">
        <div>
          <p className="modal-kicker">NEON LOFTS // DEVICE-LOCAL CAREER</p>
          <h2 id="modal-title">{ownsLoft ? "YOUR HOME BASE" : "OPEN HOUSE"}</h2>
          <p>{ownsLoft
            ? "Your apartment, garage plans, shift prep, and career history—under one loud roof."
            : "Bank fare at the end of every run, then turn this downtown loft into your permanent base."}</p>
        </div>
        <div className="home-wallet"><small>BANKED FARE</small><strong>${career.bank}</strong><span>{career.runsCompleted} RUNS SAVED</span></div>
      </div>

      <div className="home-purchase-grid">
        {HOME_CAREER_ITEMS.map((item) => {
          const owned = careerOwns(career, item.id);
          const missing = item.requires.find((id) => !careerOwns(career, id));
          const shortfall = Math.max(0, item.cost - career.bank);
          const disabled = owned || Boolean(missing) || shortfall > 0;
          const buttonCopy = owned
            ? "OWNED"
            : missing
              ? `REQUIRES ${titleFor(missing)}`
              : shortfall > 0
                ? `NEED $${shortfall} MORE`
                : `BUY · $${item.cost}`;
          return (
            <article key={item.id} className={`home-purchase ${owned ? "is-owned" : ""}`}>
              <span>{item.category}</span><small className="home-purchase__price">${item.cost}</small>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <b>{item.effect}</b>
              <button disabled={disabled} onClick={() => onPurchase(item.id)}>{buttonCopy}</button>
            </article>
          );
        })}
      </div>

      <div className="home-activity-grid">
        <article>
          <span>GARAGE BAY</span><h3>REST + REFILL</h3>
          <p>{simulation ? "The simulation taxi has no arcade boost tank. Garage ownership still carries into future arcade runs." : "Refill the cab&apos;s boost tank once during this run."}</p>
          <button disabled={!ownsGarage || rechargeUsed || simulation} onClick={onRecharge}>
            {!ownsGarage ? "BUY GARAGE HOME BASE" : simulation ? "NO BOOST IN SIMULATION" : rechargeUsed ? "USED THIS RUN" : "REFILL TO 100%"}
          </button>
        </article>
        <article>
          <span>TROPHY WALL</span><h3>RUN HISTORY</h3>
          <p>{career.lifetimeDeliveries} deliveries · ${career.lifetimeFare} lifetime fare · {career.lifetimeScore.toLocaleString()} score.</p>
          <button onClick={onOpenRuns}>VIEW RUN LOG</button>
        </article>
        <article>
          <span>DISPATCH CORNER</span><h3>COURIER BOARD</h3>
          <p>Take indoor pickup and handoff contracts between enterable venues.</p>
          <button onClick={onOpenCourier}>VIEW CONTRACTS</button>
        </article>
        <article>
          <span>WALL MAP</span><h3>CITY ROUTES</h3>
          <p>Study the live passenger or courier route before heading outside.</p>
          <button onClick={onOpenMap}>OPEN FULL MAP</button>
        </article>
      </div>

      <div className="home-hub__footer">
        <p aria-live="polite">{notice || "RUN FARE IS BANKED WHEN THE SESSION ENDS."}</p>
        <button className="primary-small" onClick={onClose}>BACK TO THE APARTMENT</button>
      </div>
    </div>
  );
}
