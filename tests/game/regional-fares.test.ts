import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_FARES_MASK,
  FARE_PICKUP_RADIUS,
  FIXED_DT,
  MAX_REGIONAL_FARE_TRIP_DISTANCE,
  MIN_REGIONAL_FARE_TRIP_DISTANCE,
  REGIONAL_FARE_DESTINATION_DEPTH,
} from "../../game/config";
import {
  analyzeFareStopPlacement,
} from "../../game/fare-placement";
import { createFareMarket, passengerTripDistance } from "../../game/fare-market";
import {
  isFareAvailable,
  markFarePickedUp,
  refreshFarePoolAfterRegionalArrival,
  setFareDispatchEnabled,
  syncNearestFareTarget,
} from "../../game/fare-selection";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import {
  ACTIVE_WORLD_REGIONS,
  activeCardinalNeighborRegions,
  containingRegionForPosition,
  regionRoadBounds,
} from "../../game/regions";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";
import type { InputState, Job, WorldView } from "../../game/model";

const IDLE_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

const EMPTY_WORLD: WorldView = {
  key: "regional-fare-test",
  boxes: [],
  colliders: [],
  chunks: [],
  interactions: [],
};

function localRegionId(job: Job) {
  const pickupRegion = containingRegionForPosition(job.pickup.x, job.pickup.y);
  const dropoffRegion = containingRegionForPosition(job.dropoff.x, job.dropoff.y);
  assert.ok(pickupRegion);
  assert.ok(dropoffRegion);
  assert.equal(pickupRegion.id, dropoffRegion.id);
  return pickupRegion.id;
}

function gameInRegion(
  seed: number,
  region: (typeof ACTIVE_WORLD_REGIONS)[number],
  fareCycle: number,
) {
  const game = makeGame("street-ace", seed, "free-run");
  game.fareCycle = fareCycle;
  game.fareServiceRegionId = region.id;
  const market = createFareMarket(
    seed,
    fareCycle,
    [],
    region,
    game.usedFareRiderIdsByRegion,
  );
  game.fareJobs = market.jobs;
  game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;
  game.availableFareMask = ALL_FARES_MASK;
  return game;
}

function leaveOnlyFareWaiting(game: ReturnType<typeof makeGame>, waitingIndex: number) {
  const completedIndex = waitingIndex === 0 ? 1 : 0;
  game.jobIndex = completedIndex;
  game.availableFareMask = 1 << waitingIndex;
  const completedJob = game.fareJobs[completedIndex];
  game.x = completedJob.dropoff.x;
  game.y = completedJob.dropoff.y;
  return completedJob;
}

test("the first five fares stay local and whichever fare remains sixth always becomes regional", () => {
  const formerMissAndBoundarySeeds = [0, 2, 4, 17, 98, 0xffff_ffff];
  for (let waitingIndex = 0; waitingIndex < 6; waitingIndex += 1) {
    const game = makeGame(
      "street-ace",
      formerMissAndBoundarySeeds[waitingIndex],
      "free-run",
    );
    assert.ok(game.fareJobs.every((job) => (
      localRegionId(job) === game.fareServiceRegionId && job.regionalTransfer === null
    )));

    const completedJob = leaveOnlyFareWaiting(game, waitingIndex);
    const waitingJobBefore = structuredClone(game.fareJobs[waitingIndex]);
    const offer = scheduleSixthFareTransfer(game, completedJob);
    assert.ok(offer, `fare index ${waitingIndex} should become the sixth-fare transfer`);
    assert.equal(offer.jobIndex, waitingIndex);
    assert.equal(isFareAvailable(game, waitingIndex), true);

    const transfer = game.fareJobs[waitingIndex];
    assert.equal(transfer.id, waitingJobBefore.id);
    assert.equal(transfer.rider, waitingJobBefore.rider);
    assert.equal(transfer.pickupStopId, waitingJobBefore.pickupStopId);
    assert.deepEqual(transfer.pickup, waitingJobBefore.pickup);
    assert.deepEqual(transfer.pickupApproach, waitingJobBefore.pickupApproach);
    assert.notEqual(transfer.dropoffStopId, waitingJobBefore.dropoffStopId);
    assert.equal(transfer.regionalTransfer?.originRegionId, game.fareServiceRegionId);
    assert.notEqual(
      transfer.regionalTransfer?.destinationRegionId,
      game.fareServiceRegionId,
    );
    assert.equal(
      containingRegionForPosition(transfer.pickup.x, transfer.pickup.y)?.id,
      game.fareServiceRegionId,
    );
    assert.equal(
      containingRegionForPosition(transfer.dropoff.x, transfer.dropoff.y)?.id,
      offer.destinationRegionId,
    );
    assert.ok(passengerTripDistance(transfer) <= MAX_REGIONAL_FARE_TRIP_DISTANCE);
    assert.ok(passengerTripDistance(transfer) >= MIN_REGIONAL_FARE_TRIP_DISTANCE);
    assert.equal(analyzeFareStopPlacement(transfer.pickup, FARE_PICKUP_RADIUS).safe, true);
    assert.equal(analyzeFareStopPlacement(transfer.dropoff).safe, true);

    syncNearestFareTarget(game, true);
    assert.equal(game.jobIndex, waitingIndex, "the sixth fare should own GPS guidance");
  }
});

test("every active service region has a cardinal destination for its guaranteed fare six", () => {
  for (const region of ACTIVE_WORLD_REGIONS) {
    const neighbors = activeCardinalNeighborRegions(region.id);
    assert.ok(neighbors.length > 0, `${region.name} must have a transfer destination`);
    assert.ok(neighbors.every((neighbor) => neighbor.id !== region.id));
  }
});

test("the transfer scheduler cannot promote a fare before five local fares are taken", () => {
  const game = makeGame("street-ace", 98, "free-run");
  const completedJob = game.fareJobs[0];
  for (const availableFareMask of [ALL_FARES_MASK, 0b11_1110, 0b00_0011]) {
    game.availableFareMask = availableFareMask;
    const jobsBefore = structuredClone(game.fareJobs);
    assert.equal(scheduleSixthFareTransfer(game, completedJob), null);
    assert.deepEqual(game.fareJobs, jobsBefore);
  }
});

test("a promoted fare six survives an Off Duty regional roam unchanged", () => {
  const game = makeGame("street-ace", 0x6f6f, "free-run");
  const completedJob = leaveOnlyFareWaiting(game, 5);
  assert.ok(scheduleSixthFareTransfer(game, completedJob));
  const jobsBefore = structuredClone(game.fareJobs);
  const maskBefore = game.availableFareMask;
  const indexBefore = game.jobIndex;

  assert.equal(setFareDispatchEnabled(game, false), true);
  game.x = 1008;
  game.y = 0;
  game.elapsed = 4;
  assert.equal(setFareDispatchEnabled(game, true), true);

  assert.deepEqual(game.fareJobs, jobsBefore);
  assert.equal(game.availableFareMask, maskBefore);
  assert.equal(game.jobIndex, indexBefore);
  assert.equal(game.fareStreamRevision, 0);
  assert.ok(game.fareJobs[indexBefore].regionalTransfer);
});

test("an arbitrary real pickup order promotes only the sixth remaining passenger", () => {
  const game = makeGame("street-ace", 317, "free-run");
  const pickupOrder = [4, 1, 5, 0, 3];
  for (const [completion, index] of pickupOrder.entries()) {
    const completedJob = game.fareJobs[index];
    game.jobIndex = index;
    game.x = completedJob.dropoff.x;
    game.y = completedJob.dropoff.y;
    markFarePickedUp(game, index);
    const offer = scheduleSixthFareTransfer(game, completedJob);
    if (completion < 4) {
      assert.equal(offer, null);
      assert.equal(game.fareJobs.some((job) => job.regionalTransfer), false);
    } else {
      assert.ok(offer);
      assert.equal(offer.jobIndex, 2);
      assert.equal(game.availableFareMask, 1 << 2);
    }
  }
});

test("finishing fare six starts a fresh local cycle that schedules its own sixth transfer", () => {
  const game = makeGame("street-ace", 143, "free-run");
  const completedJob = leaveOnlyFareWaiting(game, 5);
  const firstOffer = scheduleSixthFareTransfer(game, completedJob);
  assert.ok(firstOffer);

  const firstTransfer = game.fareJobs[firstOffer.jobIndex];
  markFarePickedUp(game, firstOffer.jobIndex);
  const cycleBefore = game.fareCycle;
  assert.equal(refreshFarePoolAfterRegionalArrival(game, firstTransfer), true);
  assert.equal(game.fareCycle, cycleBefore + 1);
  assert.equal(game.fareServiceRegionId, firstOffer.destinationRegionId);
  assert.equal(game.availableFareMask, ALL_FARES_MASK);
  assert.ok(game.fareJobs.every((job) => (
    localRegionId(job) === firstOffer.destinationRegionId
      && job.regionalTransfer === null
  )));

  const secondCompletedJob = leaveOnlyFareWaiting(game, 2);
  const secondOffer = scheduleSixthFareTransfer(game, secondCompletedJob);
  assert.ok(secondOffer);
  assert.equal(secondOffer.jobIndex, 2);
  assert.equal(secondOffer.originRegionId, firstOffer.destinationRegionId);
  assert.notEqual(secondOffer.destinationRegionId, firstOffer.destinationRegionId);
});

test("the fifth dropoff emits exactly one sixth-fare regional offer", () => {
  const game = makeGame("street-ace", 221, "free-run");
  game.traffic = [];
  leaveOnlyFareWaiting(game, 5);
  const completedJob = game.fareJobs[game.jobIndex];
  game.x = completedJob.dropoff.x;
  game.y = completedJob.dropoff.y;
  game.onboard = true;
  game.elapsed = 10;
  game.jobStartedAt = 0;

  const events = [];
  for (let tick = 0; tick < 11; tick += 1) {
    events.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  assert.equal(events.filter((event) => event.type === "regional-fare-offered").length, 1);
  assert.equal(game.fareJobs.filter((job) => job.regionalTransfer).length, 1);
  assert.equal(game.fareJobs[5].regionalTransfer?.originRegionId, game.fareServiceRegionId);
  assert.equal(game.availableFareMask, 1 << 5);
  const transferStopId = game.fareJobs[5].dropoffStopId;

  const idleEvents = [];
  for (let tick = 0; tick < 120; tick += 1) {
    idleEvents.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  assert.equal(idleEvents.some((event) => event.type === "regional-fare-offered"), false);
  assert.equal(game.fareJobs[5].dropoffStopId, transferStopId);
});

test("fare six pickup and arrival complete the regional cycle through simulation", () => {
  const game = makeGame("street-ace", 509, "free-run");
  game.traffic = [];
  const fifthJob = leaveOnlyFareWaiting(game, 5);
  const offer = scheduleSixthFareTransfer(game, fifthJob);
  assert.ok(offer);
  const transfer = game.fareJobs[offer.jobIndex];
  const cycleBefore = game.fareCycle;

  game.x = transfer.pickup.x;
  game.y = transfer.pickup.y;
  const pickupEvents = [];
  for (let tick = 0; tick < 11; tick += 1) {
    pickupEvents.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  assert.equal(pickupEvents.filter((event) => event.type === "pickup").length, 1);
  assert.equal(game.onboard, true);
  assert.equal(game.availableFareMask, 0);

  game.x = transfer.dropoff.x;
  game.y = transfer.dropoff.y;
  const arrivalEvents = [];
  for (let tick = 0; tick < 11; tick += 1) {
    arrivalEvents.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  assert.equal(arrivalEvents.filter((event) => event.type === "dropoff").length, 1);
  assert.equal(
    arrivalEvents.some((event) => event.type === "regional-fare-offered"),
    false,
  );
  assert.equal(game.onboard, false);
  assert.equal(game.fareCycle, cycleBefore + 1);
  assert.equal(game.fareServiceRegionId, offer.destinationRegionId);
  assert.equal(game.availableFareMask, ALL_FARES_MASK);
  assert.ok(game.fareJobs.every((job) => (
    localRegionId(job) === offer.destinationRegionId
      && job.regionalTransfer === null
  )));
});

test("the production scheduler reaches deep destinations from every active region", () => {
  const seeds = [0, 2, 4, 17, 98, 0xffff_ffff];
  for (const [regionIndex, origin] of ACTIVE_WORLD_REGIONS.entries()) {
    for (let waitingIndex = 0; waitingIndex < 6; waitingIndex += 1) {
      const game = gameInRegion(
        seeds[waitingIndex] ^ Math.imul(regionIndex + 1, 0x9e37),
        origin,
        regionIndex + 1,
      );
      const completedJob = leaveOnlyFareWaiting(game, waitingIndex);
      const offer = scheduleSixthFareTransfer(game, completedJob);
      assert.ok(offer, `${origin.name} survivor ${waitingIndex} must schedule`);

      const target = ACTIVE_WORLD_REGIONS.find(
        (region) => region.id === offer.destinationRegionId,
      );
      assert.ok(target);
      const transfer = game.fareJobs[waitingIndex];
      assert.equal(
        containingRegionForPosition(transfer.dropoff.x, transfer.dropoff.y)?.id,
        target.id,
      );
      assert.ok(passengerTripDistance(transfer) >= MIN_REGIONAL_FARE_TRIP_DISTANCE);
      assert.ok(passengerTripDistance(transfer) <= MAX_REGIONAL_FARE_TRIP_DISTANCE);

      const originBounds = regionRoadBounds(origin);
      const targetBounds = regionRoadBounds(target);
      if (targetBounds.minX >= originBounds.maxX) {
        assert.ok(transfer.dropoff.x >= targetBounds.minX + REGIONAL_FARE_DESTINATION_DEPTH);
      } else if (targetBounds.maxX <= originBounds.minX) {
        assert.ok(transfer.dropoff.x <= targetBounds.maxX - REGIONAL_FARE_DESTINATION_DEPTH);
      }
      if (targetBounds.minY >= originBounds.maxY) {
        assert.ok(transfer.dropoff.y >= targetBounds.minY + REGIONAL_FARE_DESTINATION_DEPTH);
      } else if (targetBounds.maxY <= originBounds.minY) {
        assert.ok(transfer.dropoff.y <= targetBounds.maxY - REGIONAL_FARE_DESTINATION_DEPTH);
      }
    }
  }
});
