import {
  DISPLAY_METERS_PER_WORLD_UNIT,
  FARE_STREAM_NEARBY_TARGET,
  TAXI_START,
} from "./config";
import { createProceduralFareStopPairs } from "./fare-placement";
import { clamp } from "./math";
import type { Job, Vec2 } from "./model";
import {
  selectFareRiders,
  type FareRiderHistoryByRegion,
} from "./passengers";
import { containingRegionForPosition, type WorldRegion } from "./regions";
import { buildGpsRoute, routeLength } from "./route-geometry";

export const DEFAULT_FARE_RUN_SEED = 0x4e454f4e;

function fareCycleSeed(runSeed: number, cycle: number, stream: number) {
  return (
    (runSeed >>> 0)
    ^ Math.imul(cycle + 1, 0x9e3779b1)
    ^ Math.imul(cycle + 7, 0x85ebca77)
    ^ Math.imul(stream + 11, 0xc2b2ae3d)
  ) >>> 0;
}

/** Canonical street-route length shared by generation, rewards, and UI. */
export function cityRouteDistance(start: Vec2, target: Vec2) {
  return routeLength(buildGpsRoute(start, target));
}

/** Fare economy follows the safe road approaches, not the curbside ring centers. */
export function passengerTripDistance(
  job: Pick<Job, "pickupApproach" | "dropoffApproach">,
) {
  return cityRouteDistance(job.pickupApproach, job.dropoffApproach);
}

export type PassengerDistanceQuote = {
  routeDistance: number;
  routeMeters: number;
  pickupSeconds: number;
  dropoffSeconds: number;
  parSeconds: number;
  baseScore: number;
};

/** One distance quote feeds the timer, score, cash, events, and tests. */
export function passengerDistanceQuote(
  job: Pick<Job, "pickupApproach" | "dropoffApproach">,
): PassengerDistanceQuote {
  const routeDistance = passengerTripDistance(job);
  return {
    routeDistance,
    routeMeters: Math.round(routeDistance * DISPLAY_METERS_PER_WORLD_UNIT),
    pickupSeconds: clamp(Math.round(3 + routeDistance / 55), 4, 16),
    dropoffSeconds: clamp(Math.round(5 + routeDistance / 70), 6, 20),
    parSeconds: clamp(routeDistance / 17 + 6, 11, 62),
    baseScore: 180 + Math.round(routeDistance * 5.5),
  };
}

/**
 * Build the initial six-fare market from seeded, world-validated curb slots.
 * Pickup geography expands with the world. Dropoffs favor authored landmarks
 * and match actual lot content while retaining procedural, validated curb IDs.
 */
export function createFareMarket(
  runSeed: number,
  cycle = 0,
  previousJobs: readonly Job[] = [],
  region: WorldRegion | null = null,
  usedFareRiderIdsByRegion: FareRiderHistoryByRegion = {},
) {
  const riderSelection = selectFareRiders({
    runSeed: fareCycleSeed(runSeed, cycle, 0),
    cycle,
    region,
    usedFareRiderIdsByRegion,
    previousRiderIds: previousJobs.map((job) => job.id),
  });
  const taxiStartRegion = containingRegionForPosition(TAXI_START.x, TAXI_START.y);
  const useOpeningPickup = cycle === 0
    && previousJobs.length === 0
    && (!region || taxiStartRegion?.id === region.id);
  const stopPairs = createProceduralFareStopPairs(
    fareCycleSeed(runSeed, cycle, 1),
    previousJobs,
    useOpeningPickup,
    region,
    { riderIds: riderSelection.riders.map(rider => rider.id) },
  );
  const jobs = riderSelection.riders.map((rider, index): Job => {
    const { pickup, dropoff } = stopPairs[index];
    return {
      id: rider.id,
      rider: rider.rider,
      passengerArtCell: rider.passengerArtCell,
      destinationArtCell: dropoff.artCell,
      destinationCard: dropoff.destinationCard,
      pickupStopId: pickup.id,
      pickup: { ...pickup.zone },
      pickupApproach: { ...pickup.approach },
      dropoffStopId: dropoff.id,
      dropoff: { ...dropoff.zone },
      dropoffApproach: { ...dropoff.approach },
      destination: dropoff.label,
      regionalTransfer: null,
    };
  });
  return {
    jobs,
    usedFareRiderIdsByRegion: riderSelection.usedFareRiderIdsByRegion,
  };
}

/**
 * Seed fresh, unseen passengers around a moving taxi without resetting the
 * six-slot completion mask. The caller merges these jobs into available slots.
 */
export function createFareStreamMarket(input: {
  runSeed: number;
  cycle: number;
  revision: number;
  previousJobs: readonly Job[];
  region: WorldRegion;
  usedFareRiderIdsByRegion: FareRiderHistoryByRegion;
  anchor: Vec2;
  count: number;
}) {
  const seed = fareCycleSeed(input.runSeed, input.cycle, input.revision + 17);
  const riderSelection = selectFareRiders({
    runSeed: seed,
    cycle: input.cycle,
    region: input.region,
    usedFareRiderIdsByRegion: input.usedFareRiderIdsByRegion,
    previousRiderIds: input.previousJobs.map((job) => job.id),
    count: input.count,
  });
  const stopPairs = createProceduralFareStopPairs(
    fareCycleSeed(input.runSeed, input.cycle, input.revision + 31),
    input.previousJobs,
    false,
    input.region,
    {
      anchor: input.anchor,
      count: input.count,
      nearbyPickupCount: Math.min(input.count, FARE_STREAM_NEARBY_TARGET),
      riderIds: riderSelection.riders.map(rider => rider.id),
    },
  );
  const jobs = riderSelection.riders.map((rider, index): Job => {
    const { pickup, dropoff } = stopPairs[index];
    return {
      id: rider.id,
      rider: rider.rider,
      passengerArtCell: rider.passengerArtCell,
      destinationArtCell: dropoff.artCell,
      destinationCard: dropoff.destinationCard,
      pickupStopId: pickup.id,
      pickup: { ...pickup.zone },
      pickupApproach: { ...pickup.approach },
      dropoffStopId: dropoff.id,
      dropoff: { ...dropoff.zone },
      dropoffApproach: { ...dropoff.approach },
      destination: dropoff.label,
      regionalTransfer: null,
    };
  });
  return {
    jobs,
    usedFareRiderIdsByRegion: riderSelection.usedFareRiderIdsByRegion,
  };
}

/** Compatibility helper for geometry and deterministic market characterization. */
export function createFareJobs(
  runSeed: number,
  cycle = 0,
  previousJobs: readonly Job[] = [],
  region: WorldRegion | null = null,
) {
  return createFareMarket(runSeed, cycle, previousJobs, region).jobs;
}
