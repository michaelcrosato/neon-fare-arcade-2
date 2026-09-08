import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_FARES_MASK,
  DESTINATION_ART_CELL_COUNT,
  FARE_DROPOFF_RADIUS,
  FARE_PICKUP_RADIUS,
  FARE_STOP_RULES,
  FARES_PER_CYCLE,
  MAX_FARE_TRIP_DISTANCE,
  MIN_FARE_HANDOFF_DISTANCE,
  ROAD_SPACING,
  WORLD_LIMIT,
} from "../../game/config";
import { FARE_RIDERS, SHARED_FARE_RIDERS } from "../../game/passengers";
import {
  analyzeFareStopPlacement,
  sampledDiskFraction,
} from "../../game/fare-placement";
import {
  cityRouteDistance,
  createFareMarket,
  createFareJobs,
  passengerDistanceQuote,
  passengerTripDistance,
} from "../../game/fare-market";
import { distance } from "../../game/math";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import {
  ACTIVE_WORLD_REGIONS,
  containingRegionForPosition,
} from "../../game/regions";
import { makeGame } from "../../game/state";

function pointKey(point: { x: number; y: number }) {
  return `${point.x},${point.y}`;
}

function signature(seed: number, cycle = 0) {
  return createFareJobs(seed, cycle).map((job) => ({
    id: job.id,
    passengerArtCell: job.passengerArtCell,
    destinationArtCell: job.destinationArtCell,
    pickupStopId: job.pickupStopId,
    pickup: job.pickup,
    pickupApproach: job.pickupApproach,
    dropoffStopId: job.dropoffStopId,
    dropoff: job.dropoff,
    dropoffApproach: job.dropoffApproach,
    destination: job.destination,
  }));
}

test("fare markets are deterministic by seed while procedural geography varies", () => {
  assert.deepEqual(signature(0x12345678), signature(0x12345678));
  assert.notDeepEqual(signature(0x12345678), signature(0x87654321));

  const markets = new Set(Array.from({ length: 8 }, (_, seed) => JSON.stringify(signature(seed))));
  assert.equal(markets.size, 8);
});

test("fare cycles retain six unique riders from the expanded citywide roster", () => {
  assert.equal(FARES_PER_CYCLE, 6);
  assert.equal(ALL_FARES_MASK, 0b111111);
  assert.equal(FARE_RIDERS.length, 168);
  assert.equal(SHARED_FARE_RIDERS.length, 48);
  assert.equal(new Set(FARE_RIDERS.map((rider) => rider.id)).size, FARE_RIDERS.length);
  assert.equal(new Set(FARE_RIDERS.map((rider) => rider.rider)).size, FARE_RIDERS.length);
  assert.deepEqual(
    FARE_RIDERS.map((rider) => rider.passengerArtCell).sort((left, right) => left - right),
    Array.from({ length: FARE_RIDERS.length }, (_, index) => index),
  );

  const jobs = createFareJobs(0xfeedcafe);
  assert.equal(jobs.length, FARES_PER_CYCLE);
  assert.equal(new Set(jobs.map((job) => job.id)).size, jobs.length);
  assert.ok(jobs.every((job) => SHARED_FARE_RIDERS.some((rider) => rider.id === job.id)));
  assert.ok(jobs.every((job) => job.destinationArtCell < DESTINATION_ART_CELL_COUNT));
});

test("generated pickup and dropoff zones satisfy the complete placement contract", () => {
  for (let seed = 0; seed < 8; seed += 1) {
    const jobs = createFareJobs(seed);
    assert.equal(new Set(jobs.map((job) => job.pickupStopId)).size, jobs.length);
    assert.equal(new Set(jobs.map((job) => job.dropoffStopId)).size, jobs.length);
    assert.equal(new Set(jobs.map((job) => pointKey(job.pickup))).size, jobs.length);
    assert.equal(new Set(jobs.map((job) => pointKey(job.dropoff))).size, jobs.length);
    assert.equal(new Set(jobs.map((job) => job.destination)).size, jobs.length);

    for (const job of jobs) {
      assert.notEqual(job.pickupStopId, job.dropoffStopId);
      assert.ok(Math.abs(job.pickup.x) + FARE_PICKUP_RADIUS <= WORLD_LIMIT);
      assert.ok(Math.abs(job.pickup.y) + FARE_PICKUP_RADIUS <= WORLD_LIMIT);
      assert.ok(Math.abs(job.dropoff.x) + FARE_DROPOFF_RADIUS <= WORLD_LIMIT);
      assert.ok(Math.abs(job.dropoff.y) + FARE_DROPOFF_RADIUS <= WORLD_LIMIT);
      assert.ok(passengerTripDistance(job) <= MAX_FARE_TRIP_DISTANCE);
      assert.ok(passengerTripDistance(job) >= MIN_FARE_HANDOFF_DISTANCE);

      for (const [zone, approach, radius] of [
        [job.pickup, job.pickupApproach, FARE_PICKUP_RADIUS],
        [job.dropoff, job.dropoffApproach, FARE_DROPOFF_RADIUS],
      ] as const) {
        const report = analyzeFareStopPlacement(zone, radius);
        assert.equal(report.safe, true, `${job.id} has an unsafe procedural stop`);
        assert.equal(report.centerOnRoad, false);
        assert.equal(report.centerInCollider, false);
        assert.equal(report.centerInWater, false);
        assert.equal(report.roadKind, "street");
        assert.ok(report.roadOverlap <= FARE_STOP_RULES.maxRoadOverlap);
        assert.ok(report.colliderOverlap < FARE_STOP_RULES.maxColliderOverlap);
        assert.ok(report.waterOverlap < FARE_STOP_RULES.maxWaterOverlap);
        assert.ok(report.blockedOverlap < FARE_STOP_RULES.maxBlockedOverlap);
        assert.ok(report.openGround >= FARE_STOP_RULES.minOpenGround);
        assert.deepEqual(report.approach, approach);
        assert.ok(distance(zone, approach) < radius);
        assert.equal(report.approachOnRoad, true);
        assert.equal(report.approachClear, true);
      }
    }

    for (const dropoff of jobs) {
      for (const pickup of jobs) {
        const routeDistance = cityRouteDistance(pickup.pickupApproach, dropoff.dropoffApproach);
        assert.ok(routeDistance >= MIN_FARE_HANDOFF_DISTANCE);
        assert.ok(routeDistance <= MAX_FARE_TRIP_DISTANCE);
      }
    }
    for (let left = 0; left < jobs.length; left += 1) {
      for (let right = left + 1; right < jobs.length; right += 1) {
        assert.ok(distance(jobs[left].pickup, jobs[right].pickup) >= ROAD_SPACING);
        assert.ok(distance(jobs[left].dropoff, jobs[right].dropoff) >= ROAD_SPACING);
      }
    }
  }
});

test("procedural stop supply scales beyond the former 100-location catalogs", () => {
  const stops = new Set<string>();
  const riderCoverage = new Set<string>();
  const destinationArtCoverage = new Set<number>();
  for (let seed = 0; seed < 12; seed += 1) {
    for (const job of createFareJobs(seed * 0x9e3779b1)) {
      stops.add(job.pickupStopId);
      stops.add(job.dropoffStopId);
      riderCoverage.add(job.id);
      destinationArtCoverage.add(job.destinationArtCell);
    }
  }
  assert.ok(stops.size > 100, `seed sweep only reached ${stops.size} procedural stops`);
  assert.ok(riderCoverage.size > FARES_PER_CYCLE);
  assert.ok(destinationArtCoverage.size > FARES_PER_CYCLE);
});

test("Northstar starts with six local fares and always sends fare six back to Neon City", () => {
  const northstar = ACTIVE_WORLD_REGIONS.find((region) => region.id === "northstar-range")!;
  const game = makeGame("street-ace", 0x4e4f5254, "free-run");
  game.fareCycle = 0;
  game.fareServiceRegionId = northstar.id;
  const market = createFareMarket(
    game.runSeed,
    game.fareCycle,
    [],
    northstar,
    game.usedFareRiderIdsByRegion,
  );
  game.fareJobs = market.jobs;
  game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;

  for (const job of game.fareJobs) {
    assert.equal(containingRegionForPosition(job.pickup.x, job.pickup.y)?.id, northstar.id);
    assert.equal(containingRegionForPosition(job.dropoff.x, job.dropoff.y)?.id, northstar.id);
    assert.equal(job.regionalTransfer, null);
  }

  game.availableFareMask = 1 << 5;
  const fifthCompleted = game.fareJobs[0];
  game.x = fifthCompleted.dropoff.x;
  game.y = fifthCompleted.dropoff.y;
  const offer = scheduleSixthFareTransfer(game, fifthCompleted);
  assert.ok(offer);
  assert.equal(offer.destinationRegionId, "city-center");
  assert.equal(game.fareJobs[5].regionalTransfer?.originRegionId, northstar.id);
  assert.equal(
    containingRegionForPosition(game.fareJobs[5].dropoff.x, game.fareJobs[5].dropoff.y)?.id,
    "city-center",
  );
  for (const localJob of game.fareJobs.slice(0, 5)) {
    assert.equal(containingRegionForPosition(localJob.dropoff.x, localJob.dropoff.y)?.id, northstar.id);
  }
});

test("City fare-six transfers reach all four cardinal neighbors across seeded markets", () => {
  const destinations = new Set<string>();
  for (const seed of [0, 1, 6, 10]) {
    const game = makeGame("street-ace", seed, "free-run");
    game.availableFareMask = 1 << 5;
    const fifthCompleted = game.fareJobs[0];
    game.x = fifthCompleted.dropoff.x;
    game.y = fifthCompleted.dropoff.y;
    const offer = scheduleSixthFareTransfer(game, fifthCompleted);
    assert.ok(offer);
    destinations.add(offer.destinationRegionId);
  }
  assert.deepEqual([...destinations].sort(), ["cedar-vale", "copper-mesa", "northstar-range", "solana-coast"]);
});

test("a new cycle avoids the prior cycle and starts away from the last dropoff", () => {
  for (let seed = 0; seed < 4; seed += 1) {
    const first = createFareJobs(seed, 0);
    const second = createFareJobs(seed, 1, first);
    const oldIds = new Set(first.flatMap((job) => [job.pickupStopId, job.dropoffStopId]));
    const oldPoints = first.flatMap((job) => [job.pickup, job.dropoff]);
    for (const job of second) {
      assert.equal(oldIds.has(job.pickupStopId), false);
      assert.equal(oldIds.has(job.dropoffStopId), false);
      assert.ok(oldPoints.every((point) => (
        distance(point, job.pickup) >= FARE_STOP_RULES.previousStopClearance
      )));
      assert.ok(oldPoints.every((point) => (
        distance(point, job.dropoff) >= FARE_STOP_RULES.previousStopClearance
      )));
      assert.ok(
        cityRouteDistance(first.at(-1)!.dropoffApproach, job.pickupApproach)
          >= MIN_FARE_HANDOFF_DISTANCE,
      );
    }
  }
});

test("passenger timer and base payment quotes increase with required route distance", () => {
  const quotes = [72, 144, 216, 288].map((x) => passengerDistanceQuote({
    pickupApproach: { x: 0, y: 0 },
    dropoffApproach: { x, y: 0 },
  }));

  for (let index = 1; index < quotes.length; index += 1) {
    assert.ok(quotes[index].routeDistance > quotes[index - 1].routeDistance);
    assert.ok(quotes[index].baseScore > quotes[index - 1].baseScore);
    assert.ok(quotes[index].pickupSeconds >= quotes[index - 1].pickupSeconds);
    assert.ok(quotes[index].dropoffSeconds >= quotes[index - 1].dropoffSeconds);
  }
});

test("disk overlap sampling measures empty, full, and half-plane coverage", () => {
  assert.equal(sampledDiskFraction(4, () => false), 0);
  assert.equal(sampledDiskFraction(4, () => true), 1);
  const half = sampledDiskFraction(4, ({ x }) => x >= 0, 25);
  assert.ok(Math.abs(half - 0.5) < 0.04, `half disk measured ${half}`);
});
