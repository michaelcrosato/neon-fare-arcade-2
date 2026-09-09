import type { DrivingModel, FareId, FareImpact, RunKind } from "./model";

export const FARE_CARD_TIMING_MS = {
  enter: 180,
  hold: 1000,
  dock: 420,
} as const;

const FARE_CARD_TOTAL_MS =
  FARE_CARD_TIMING_MS.enter +
  FARE_CARD_TIMING_MS.hold +
  FARE_CARD_TIMING_MS.dock;

export const FARE_IMPACT_DURATION_MS = {
  pickup: FARE_CARD_TOTAL_MS,
  dropoff: FARE_CARD_TOTAL_MS,
} as const;

type FareImpactDraft = Omit<FareImpact, "id">;

export const FARE_ART_CELLS_PER_SHEET = 6;

/** Resolve any art index into its six-cell 3×2 sprite-sheet frame. */
export function fareArtFrame(artCell: number) {
  const sheet = Math.floor(artCell / FARE_ART_CELLS_PER_SHEET);
  const localCell = artCell % FARE_ART_CELLS_PER_SHEET;
  const column = (localCell % 3) * 50;
  const row = Math.floor(localCell / 3) * 100;
  return {
    sheet,
    backgroundPosition: `${column}% ${row}%`,
  };
}

/** Asset naming is data-driven so passenger atlases can grow independently. */
export function fareArtAsset(kind: "pickup" | "dropoff", sheet: number) {
  const stem = kind === "pickup" ? "fare-passengers" : "fare-destinations";
  return `/${stem}${sheet === 0 ? "" : `-${sheet + 1}`}.webp`;
}

export function makePickupFareImpact(input: {
  fareId: FareId;
  fareNumber: number;
  artCell: number;
  rider: string;
  destination: string;
  bonusSeconds: number;
  runKind: RunKind;
  drivingModel?: DrivingModel;
}): FareImpactDraft {
  return {
    kind: "pickup",
    fareId: input.fareId,
    fareNumber: input.fareNumber,
    artCell: input.artCell,
    durationMs: FARE_IMPACT_DURATION_MS.pickup,
    rider: input.rider,
    destination: input.destination,
    eyebrow: "NEW FARE // PICKUP LOCKED",
    headline: `${input.rider} IN!`,
    detail: input.runKind === "free-run"
      ? input.drivingModel === "simulation" ? "SIMULATION · FREE RUN" : "+8 BOOST · FREE RUN"
      : input.bonusSeconds > 0
        ? `+${input.bonusSeconds} SEC · +8 BOOST`
        : "+8 BOOST · METER FULL",
  };
}

export function makeDropoffFareImpact(input: {
  fareId: FareId;
  fareNumber: number;
  artCell: number;
  rider: string;
  destination: string;
  fareAward: number;
  stars?: number;
  tip?: number;
  bonusSeconds: number;
  multiplier: number;
  runKind: RunKind;
}): FareImpactDraft {
  return {
    kind: "dropoff",
    fareId: input.fareId,
    fareNumber: input.fareNumber,
    artCell: input.artCell,
    durationMs: FARE_IMPACT_DURATION_MS.dropoff,
    rider: input.rider,
    destination: input.destination,
    eyebrow: "DESTINATION HIT // FARE COMPLETE",
    headline: `+$${input.fareAward}`,
    detail: input.stars !== undefined
      ? `${"★".repeat(input.stars)}${"☆".repeat(5 - input.stars)} · ${input.tip ? `$${input.tip} TIP` : "NO TIP"}`
      : input.runKind === "free-run"
      ? `${input.multiplier.toFixed(1)}× MULTI · FREE RUN`
      : input.bonusSeconds > 0
        ? `${input.multiplier.toFixed(1)}× MULTI · +${input.bonusSeconds} SEC`
        : `${input.multiplier.toFixed(1)}× MULTI · METER FULL`,
  };
}
