import {
  ALL_FARES_MASK,
  FARE_GPS_RETARGET_DISTANCE,
  FARE_PICKUP_RADIUS,
  FARE_STOP_RULES,
  FARE_STREAM_CHECK_INTERVAL,
  FARE_STREAM_MIN_TRAVEL,
  FARE_STREAM_NEARBY_TARGET,
  FARE_TARGET_SWITCH_MARGIN,
} from "./config";
import { createFareMarket, createFareStreamMarket } from "./fare-market";
import { distance } from "./math";
import type { FarePickupMarker, Game, Job, Vec2 } from "./model";
import { buildGpsRoute, routeLength } from "./route-geometry";
import { ACTIVE_WORLD_REGIONS, containingRegionForPosition } from "./regions";

export type WaitingFare = {
  index: number;
  job: Job;
};

export function farePickupRouteDistance(point: Vec2, job: Job) {
  return routeLength(buildGpsRoute(point, job.pickupApproach));
}

export function nearestFareIndex(point: Vec2, jobs: readonly Job[]) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < jobs.length; index += 1) {
    const routeDistance = farePickupRouteDistance(point, jobs[index]);
    if (routeDistance < nearestDistance) {
      nearestDistance = routeDistance;
      nearestIndex = index;
    }
  }
  return nearestIndex;
}

export function isFareAvailable(game: Game, index: number) {
  return (game.availableFareMask & (1 << index)) !== 0;
}

export function nearestAvailableFareIndex(game: Game) {
  const player = { x: game.x, y: game.y };
  let nearestIndex = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < game.fareJobs.length; index += 1) {
    if (!isFareAvailable(game, index)) continue;
    const routeDistance = farePickupRouteDistance(player, game.fareJobs[index]);
    if (routeDistance < nearestDistance) {
      nearestDistance = routeDistance;
      nearestIndex = index;
    }
  }
  return nearestIndex;
}

/** A successful regional dispatch stays on GPS until collected or completed. */
export function availableRegionalFareIndex(game: Game) {
  return game.fareJobs.findIndex((job, index) => (
    isFareAvailable(game, index) && job.regionalTransfer !== null
  ));
}

export function markFarePickedUp(game: Game, index: number) {
  game.availableFareMask &= ~(1 << index);
}

function generationHistory(previousJobs: readonly Job[], completedJob: Job) {
  return [
    ...previousJobs.filter((job) => job !== completedJob),
    completedJob,
  ];
}

function replaceFarePool(
  game: Game,
  completedJob: Job,
  region: ReturnType<typeof containingRegionForPosition>,
) {
  const previousJobs = game.fareJobs;
  game.fareCycle += 1;
  const market = createFareMarket(
    game.runSeed,
    game.fareCycle,
    generationHistory(previousJobs, completedJob),
    region,
    game.usedFareRiderIdsByRegion,
  );
  game.fareJobs = market.jobs;
  game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;
  game.availableFareMask = ALL_FARES_MASK;
  game.fareStreamAnchor = { x: game.x, y: game.y };
  game.fareStreamRevision = 0;
  game.fareStreamCheckAt = game.elapsed + FARE_STREAM_CHECK_INTERVAL;
}

export function refillFarePool(game: Game) {
  if (game.availableFareMask !== 0) return false;
  const completedJob = game.fareJobs[game.jobIndex % game.fareJobs.length];
  const serviceRegion = ACTIVE_WORLD_REGIONS.find(
    (region) => region.id === game.fareServiceRegionId,
  ) ?? null;
  replaceFarePool(game, completedJob, serviceRegion);
  return true;
}

/** A regional arrival retires the old-zone market and seeds six local fares. */
export function refreshFarePoolAfterRegionalArrival(game: Game, completedJob: Job) {
  if (!completedJob.regionalTransfer) return false;
  const arrivalRegion = containingRegionForPosition(
    completedJob.dropoff.x,
    completedJob.dropoff.y,
  );
  if (!arrivalRegion) return false;
  game.fareServiceRegionId = arrivalRegion.id;
  replaceFarePool(game, completedJob, arrivalRegion);
  return true;
}

export function shouldSwitchFareTarget(currentDistance: number, nearestDistance: number) {
  return nearestDistance + FARE_TARGET_SWITCH_MARGIN < currentDistance;
}

/**
 * Keep the selected fare steady near route-distance ties. This prevents the
 * GPS and turn cue from swapping back and forth while the taxi crosses lanes.
 */
export function syncNearestFareTarget(game: Game, force = false) {
  if (
    !game.fareDispatchEnabled
    || game.onboard
    || game.activeCourier
    || game.customDestination
    || game.player.kind !== "driving"
  ) return game.jobIndex;
  const regionalIndex = availableRegionalFareIndex(game);
  if (regionalIndex >= 0) {
    game.jobIndex = regionalIndex;
    return regionalIndex;
  }
  const player = { x: game.x, y: game.y };
  const currentIndex = game.jobIndex % game.fareJobs.length;
  const nearestIndex = nearestAvailableFareIndex(game);
  if (nearestIndex < 0) return currentIndex;
  if (force || !isFareAvailable(game, currentIndex) || nearestIndex === currentIndex) {
    game.jobIndex = nearestIndex;
    return nearestIndex;
  }
  const currentDistance = farePickupRouteDistance(player, game.fareJobs[currentIndex]);
  const nearestDistance = farePickupRouteDistance(player, game.fareJobs[nearestIndex]);
  if (
    (currentDistance > FARE_GPS_RETARGET_DISTANCE && nearestDistance < currentDistance)
    || shouldSwitchFareTarget(currentDistance, nearestDistance)
  ) {
    game.jobIndex = nearestIndex;
  }
  return game.jobIndex;
}

/**
 * Replace only stale, unaccepted local slots as the empty taxi moves. The six
 * completion bits never reset, so the sole sixth passenger still becomes the
 * guaranteed regional transfer after five completed fares.
 */
export function maintainFareStream(game: Game) {
  if (
    !game.fareDispatchEnabled
    || game.player.kind !== "driving"
    || game.onboard
    || game.activeCourier
    || game.customDestination
    || availableRegionalFareIndex(game) >= 0
  ) return false;
  if (game.elapsed < game.fareStreamCheckAt) return false;

  const player = { x: game.x, y: game.y };
  const region = containingRegionForPosition(player.x, player.y);
  if (!region) return false;
  const crossedRegion = region.id !== game.fareServiceRegionId;
  if (!crossedRegion && distance(player, game.fareStreamAnchor) < FARE_STREAM_MIN_TRAVEL) {
    return false;
  }

  game.fareStreamAnchor = { ...player };
  game.fareStreamCheckAt = game.elapsed + FARE_STREAM_CHECK_INTERVAL;
  const availableIndices = game.fareJobs.flatMap((job, index) => (
    isFareAvailable(game, index) && job.regionalTransfer === null ? [index] : []
  ));
  // The sole survivor is fare six's immutable pickup and is promoted on dropoff.
  if (availableIndices.length <= 1) return false;

  const routeDistances = new Map(availableIndices.map((index) => [
    index,
    farePickupRouteDistance(player, game.fareJobs[index]),
  ]));
  const currentIndex = game.jobIndex % game.fareJobs.length;
  const currentPickupRegion = containingRegionForPosition(
    game.fareJobs[currentIndex]?.pickup.x ?? player.x,
    game.fareJobs[currentIndex]?.pickup.y ?? player.y,
  );
  const protectedCurrent = isFareAvailable(game, currentIndex)
    && currentPickupRegion?.id === region.id
    && (routeDistances.get(currentIndex) ?? Number.POSITIVE_INFINITY) <= FARE_GPS_RETARGET_DISTANCE;
  const nearbyIndices = availableIndices.filter((index) => (
    containingRegionForPosition(
      game.fareJobs[index].pickup.x,
      game.fareJobs[index].pickup.y,
    )?.id === region.id
    && (routeDistances.get(index) ?? Number.POSITIVE_INFINITY) <= FARE_STOP_RULES.nearbyPickupRadius
  ));
  const replacements = new Set<number>();
  for (const index of availableIndices) {
    const pickupRegion = containingRegionForPosition(
      game.fareJobs[index].pickup.x,
      game.fareJobs[index].pickup.y,
    );
    if (
      crossedRegion
      || pickupRegion?.id !== region.id
      || (routeDistances.get(index) ?? 0) > FARE_GPS_RETARGET_DISTANCE
    ) {
      if (index !== currentIndex || !protectedCurrent) replacements.add(index);
    }
  }

  const nearbyTarget = Math.min(FARE_STREAM_NEARBY_TARGET, availableIndices.length);
  const additionalNeeded = Math.max(0, nearbyTarget - nearbyIndices.length - replacements.size);
  if (additionalNeeded > 0) {
    const candidates = availableIndices
      .filter((index) => !nearbyIndices.includes(index) && !replacements.has(index))
      .filter((index) => index !== currentIndex || !protectedCurrent)
      .sort((left, right) => (
        (routeDistances.get(right) ?? 0) - (routeDistances.get(left) ?? 0)
      ));
    for (const index of candidates.slice(0, additionalNeeded)) replacements.add(index);
  }
  if (replacements.size === 0) return false;

  const replacementIndices = [...replacements].sort((left, right) => left - right);
  const market = createFareStreamMarket({
    runSeed: game.runSeed,
    cycle: game.fareCycle,
    revision: game.fareStreamRevision,
    previousJobs: game.fareJobs,
    region,
    usedFareRiderIdsByRegion: game.usedFareRiderIdsByRegion,
    anchor: player,
    count: replacementIndices.length,
  });
  const jobs = [...game.fareJobs];
  replacementIndices.forEach((index, replacementIndex) => {
    jobs[index] = market.jobs[replacementIndex];
  });
  game.fareJobs = jobs;
  game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;
  game.fareServiceRegionId = region.id;
  game.fareStreamRevision += 1;
  syncNearestFareTarget(game, true);
  return true;
}

/**
 * Pause or resume passenger dispatch without discarding the current six-slot
 * market. Active passengers and courier contracts must be completed first.
 */
export function setFareDispatchEnabled(game: Game, enabled: boolean) {
  if (game.fareDispatchEnabled === enabled) return true;
  if (!enabled && game.runKind !== "free-run") return false;
  if (game.onboard || game.activeCourier) return false;
  game.fareDispatchEnabled = enabled;
  game.objectiveDwell = 0;
  if (enabled) refreshFareDispatch(game);
  else {
    game.message = "";
    game.messageUntil = game.elapsed;
  }
  return true;
}

/** Run the one bounded market audit needed after a foreground route releases GPS. */
export function refreshFareDispatch(game: Game) {
  if (!game.fareDispatchEnabled) return false;
  game.fareStreamCheckAt = game.elapsed;
  const streamed = maintainFareStream(game);
  syncNearestFareTarget(game, streamed);
  return streamed;
}

/** Every blue pickup ring is actionable, even when the GPS favors another. */
export function fareAtPickupRange(game: Game, radius = FARE_PICKUP_RADIUS) {
  if (!game.fareDispatchEnabled || game.onboard || game.activeCourier) return null;
  const player = { x: game.x, y: game.y };
  let match: { index: number; distance: number } | null = null;
  for (let index = 0; index < game.fareJobs.length; index += 1) {
    if (!isFareAvailable(game, index)) continue;
    const pickupDistance = distance(player, game.fareJobs[index].pickup);
    if (pickupDistance > radius) continue;
    if (!match || pickupDistance < match.distance) match = { index, distance: pickupDistance };
  }
  return match?.index ?? null;
}

export function waitingFares(game: Game): WaitingFare[] {
  if (!game.fareDispatchEnabled || game.activeCourier) return [];
  return game.fareJobs.flatMap((job, index) => (
    isFareAvailable(game, index) && !(game.onboard && index === game.jobIndex)
      ? [{ index, job }]
      : []
  ));
}

export function farePickupMarkers(game: Game): FarePickupMarker[] {
  return waitingFares(game).map(({ index, job }) => ({
    id: job.id,
    rider: job.rider,
    point: job.pickup,
    selected: !game.onboard && index === game.jobIndex,
  }));
}
