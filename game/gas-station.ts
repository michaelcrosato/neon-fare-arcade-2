import {
  GAS_CAREER_ITEMS,
  purchaseCareerItem,
  type CareerState,
} from "./career";
import { distance } from "./math";
import type { Game, RunUpgradeId } from "./model";
import { isTimedRun } from "./run-rules";

export const GAS_STATION_TAXI_RADIUS = 14;
export const GAS_TIME_CAP = 99;
export const GAS_TIME_SECONDS = 15;
export const GAS_TIME_COST = 20;
export const GAS_TIME_PURCHASE_LIMIT = 2;
export const BOOST_COOLER_DRAIN_MULTIPLIER = 0.88;
export const RALLY_TIRE_OFFROAD_DRAG = 1.75;
export const IMPACT_BAR_BOOST_LOSS_MULTIPLIER = 0.5;

export type GasStationOfferId = "time-splash" | RunUpgradeId;

export type GasTimeQuote = {
  status: "available" | "meter-full" | "limit-reached";
  secondsAdded: number;
  cost: number;
};

export type GasPurchaseStatus =
  | "purchased"
  | "not-at-station"
  | "taxi-too-far"
  | "passenger-onboard"
  | "owned"
  | "locked"
  | "meter-full"
  | "timer-disabled"
  | "limit-reached"
  | "insufficient";

export type GasPurchaseResult = {
  status: GasPurchaseStatus;
  state: CareerState;
  offerId: GasStationOfferId;
  cost: number;
  secondsAdded: number;
};

export function hasRunUpgrade(game: Game, id: RunUpgradeId) {
  return game.installedUpgrades.includes(id);
}

export function gasStationOfferName(id: GasStationOfferId) {
  if (id === "time-splash") return "TIME SPLASH";
  return GAS_CAREER_ITEMS.find((item) => item.id === id)?.name ?? id;
}

export function isAtGasStation(game: Game) {
  return game.player.kind === "walking"
    && game.player.location.kind === "interior"
    && game.player.location.venue.kind === "gas";
}

export function isTaxiNearGasStation(game: Game) {
  if (!isAtGasStation(game) || game.player.kind !== "walking" || game.player.location.kind !== "interior") {
    return false;
  }
  return distance(
    { x: game.x, y: game.y },
    game.player.location.returnPose,
  ) <= GAS_STATION_TAXI_RADIUS
    && Math.abs(game.z - (game.player.location.returnPose.z ?? 0)) < 2;
}

/** Gas is sold by the second near the 99-second cap, so a top-off never wastes banked fare. */
export function quoteGasTimePurchase(
  timeLeft: number,
  purchases: number,
): GasTimeQuote {
  if (purchases >= GAS_TIME_PURCHASE_LIMIT) {
    return { status: "limit-reached", secondsAdded: 0, cost: 0 };
  }
  const secondsAdded = Math.min(GAS_TIME_SECONDS, Math.max(0, GAS_TIME_CAP - timeLeft));
  if (secondsAdded < 0.1) return { status: "meter-full", secondsAdded: 0, cost: 0 };
  return {
    status: "available",
    secondsAdded,
    cost: Math.max(1, Math.ceil(GAS_TIME_COST * secondsAdded / GAS_TIME_SECONDS)),
  };
}

function failed(
  status: Exclude<GasPurchaseStatus, "purchased">,
  career: CareerState,
  offerId: GasStationOfferId,
  cost = 0,
): GasPurchaseResult {
  return { status, state: career, offerId, cost, secondsAdded: 0 };
}

/**
 * Sole authority for GO-GO GAS transactions. It validates the physical
 * station context before touching either persistent career money or run state.
 */
export function purchaseGasStationOffer(
  game: Game,
  career: CareerState,
  offerId: GasStationOfferId,
): GasPurchaseResult {
  if (!isAtGasStation(game)) return failed("not-at-station", career, offerId);
  if (game.onboard) return failed("passenger-onboard", career, offerId);
  if (!isTaxiNearGasStation(game)) return failed("taxi-too-far", career, offerId);

  if (offerId === "time-splash") {
    if (!isTimedRun(game)) return failed("timer-disabled", career, offerId);
    const quote = quoteGasTimePurchase(game.timeLeft, game.gasTimePurchases);
    if (quote.status !== "available") return failed(quote.status, career, offerId);
    if (career.bank < quote.cost) return failed("insufficient", career, offerId, quote.cost);
    game.timeLeft = Math.min(GAS_TIME_CAP, game.timeLeft + quote.secondsAdded);
    game.gasTimePurchases += 1;
    game.lastBeep = 11;
    return {
      status: "purchased",
      offerId,
      secondsAdded: quote.secondsAdded,
      cost: quote.cost,
      state: { ...career, bank: career.bank - quote.cost },
    };
  }

  const item = GAS_CAREER_ITEMS.find((candidate) => candidate.id === offerId);
  if (!item) throw new Error(`Unknown gas-station upgrade: ${offerId}`);
  const purchase = purchaseCareerItem(career, item.id);
  if (purchase.status !== "purchased") {
    return failed(purchase.status, career, offerId, item.cost);
  }
  if (!game.installedUpgrades.includes(offerId)) game.installedUpgrades.push(offerId);
  return {
    status: "purchased",
    state: purchase.state,
    offerId,
    cost: item.cost,
    secondsAdded: 0,
  };
}
