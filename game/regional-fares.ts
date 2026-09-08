import { createRegionalFareDestinationStop } from "./fare-placement";
import { isFareAvailable } from "./fare-selection";
import type { Game, Job } from "./model";
import type { WorldRegionId } from "./region-types";
import { activeCardinalNeighborRegions, containingRegionForPosition } from "./regions";

export type RegionalFareOffer = {
  jobIndex: number;
  originRegionId: WorldRegionId;
  originRegionName: string;
  destinationRegionId: WorldRegionId;
  destinationRegionName: string;
};

function regionalSeed(
  runSeed: number,
  regionId: string,
  fareCycle: number,
  stream = 0,
) {
  let seed = (
    (runSeed >>> 0)
    ^ Math.imul(fareCycle + 1, 0x9e3779b1)
    ^ Math.imul(stream + 7, 0x85ebca77)
  ) >>> 0;
  for (let index = 0; index < regionId.length; index += 1) {
    seed ^= regionId.charCodeAt(index);
    seed = Math.imul(seed, 0x01000193) >>> 0;
  }
  return seed >>> 0;
}

function rankedTransferTargets(game: Game, originRegionId: WorldRegionId) {
  return activeCardinalNeighborRegions(originRegionId)
    .map((region) => ({
      region,
      rank: regionalSeed(
        game.runSeed,
        `${originRegionId}:${region.id}`,
        game.fareCycle,
        1,
      ),
    }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ region }) => region);
}

function soleWaitingFareIndex(game: Game) {
  const waiting = game.fareJobs.flatMap((job, index) => (
    isFareAvailable(game, index) ? [index] : []
  ));
  return waiting.length === 1 ? waiting[0] : -1;
}

/**
 * After five local passenger fares, promote the sole remaining waiting rider
 * into the guaranteed sixth-fare transfer. The existing pickup never moves;
 * only its destination changes to a safe curb deep inside a neighboring region.
 */
export function scheduleSixthFareTransfer(
  game: Game,
  completedJob: Job,
): RegionalFareOffer | null {
  const pickupRegion = containingRegionForPosition(completedJob.pickup.x, completedJob.pickup.y);
  const origin = containingRegionForPosition(completedJob.dropoff.x, completedJob.dropoff.y);
  if (
    !origin
    || !pickupRegion
    || pickupRegion.id !== origin.id
    || origin.id !== game.fareServiceRegionId
  ) return null;

  const jobIndex = soleWaitingFareIndex(game);
  if (jobIndex < 0) return null;
  const current = game.fareJobs[jobIndex];
  if (current.regionalTransfer) return null;

  const previousJobs = game.fareJobs.filter((_, index) => index !== jobIndex);
  const targets = rankedTransferTargets(game, origin.id);
  if (targets.length === 0) {
    throw new Error(`Fare six has no active regional destination from ${origin.id}`);
  }
  for (const target of targets) {
    const pairSeed = regionalSeed(
      game.runSeed,
      `${origin.id}:${target.id}`,
      game.fareCycle,
      2,
    );
    // Preserve normal stop-spacing when possible. The second pass relaxes only
    // history reuse, never road, water, collision, distance, or region safety.
    const dropoff = createRegionalFareDestinationStop(
      pairSeed,
      current,
      origin,
      target,
      previousJobs,
    ) ?? createRegionalFareDestinationStop(
      pairSeed,
      current,
      origin,
      target,
    );
    if (!dropoff) continue;

    game.fareJobs = game.fareJobs.map((job, index) => index === jobIndex ? {
      ...job,
      destinationArtCell: dropoff.artCell,
      dropoffStopId: dropoff.id,
      dropoff: { ...dropoff.zone },
      dropoffApproach: { ...dropoff.approach },
      destination: `${target.shortName} · ${dropoff.label}`,
      regionalTransfer: {
        originRegionId: origin.id,
        originRegionName: origin.name,
        destinationRegionId: target.id,
        destinationRegionName: target.name,
      },
    } : job);
    game.jobIndex = jobIndex;
    game.message = `FARE 6 READY · REGIONAL RUN TO ${target.name}`;
    game.messageUntil = game.elapsed + 3.2;
    return {
      jobIndex,
      originRegionId: origin.id,
      originRegionName: origin.name,
      destinationRegionId: target.id,
      destinationRegionName: target.name,
    };
  }
  throw new Error(`Fare six could not place a safe regional destination from ${origin.id}`);
}
