import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_FARES_MASK,
  BLOCKS_PER_CHUNK,
  CHUNK_MAX,
  CHUNK_MIN,
  FARES_PER_CYCLE,
  FARE_GPS_RETARGET_DISTANCE,
  FARE_STOP_RULES,
  FARE_TARGET_SWITCH_MARGIN,
  FIXED_DT,
  MAT_MARKER,
  MAT_PERSON,
  MIN_FARE_HANDOFF_DISTANCE,
  ROAD_SPACING,
} from "../../game/config";
import {
  farePickupMarkers,
  farePickupRouteDistance,
  fareAtPickupRange,
  maintainFareStream,
  markFarePickedUp,
  nearestFareIndex,
  refillFarePool,
  setFareDispatchEnabled,
  shouldSwitchFareTarget,
  syncNearestFareTarget,
  waitingFares,
} from "../../game/fare-selection";
import { distance } from "../../game/math";
import { makeHud } from "../../game/hud";
import type { InputState, Job, WorldView } from "../../game/model";
import { eligibleFareRiders } from "../../game/passengers";
import { analyzeFareStopPlacement } from "../../game/fare-placement";
import { containingRegionForPosition } from "../../game/regions";
import { buildGpsRoute, routeLength } from "../../game/navigation";
import { ACTOR_INSTANCE_CAPACITY } from "../../game/render/packing";
import { ambientPeopleBoxes, dynamicBoxes, farePresentationBoxes } from "../../game/render/scene";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";

const IDLE_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

const EMPTY_WORLD: WorldView = { key: "fare-test", boxes: [], colliders: [], chunks: [], interactions: [] };
const FIXTURE_JOBS = makeGame().fareJobs;

test("fare pickups are separated from every drop-off and from one another", () => {
  for (const dropJob of FIXTURE_JOBS) {
    for (const pickupJob of FIXTURE_JOBS) {
      const handoff = routeLength(buildGpsRoute(dropJob.dropoffApproach, pickupJob.pickupApproach));
      assert.ok(
        handoff >= MIN_FARE_HANDOFF_DISTANCE,
        `${dropJob.id} drop to ${pickupJob.id} pickup is only ${handoff}`,
      );
    }
  }
  for (let left = 0; left < FIXTURE_JOBS.length; left += 1) {
    for (let right = left + 1; right < FIXTURE_JOBS.length; right += 1) {
      assert.ok(distance(FIXTURE_JOBS[left].pickup, FIXTURE_JOBS[right].pickup) >= ROAD_SPACING);
    }
  }
});

test("nearest fare uses street-route distance rather than straight-line distance", () => {
  const point = { x: -108, y: -108 };
  const offers: readonly Job[] = [
    { ...FIXTURE_JOBS[0], pickup: { x: -108, y: -60 }, pickupApproach: { x: -108, y: -60 } },
    { ...FIXTURE_JOBS[1], pickup: { x: -84, y: -84 }, pickupApproach: { x: -84, y: -84 } },
  ];
  assert.ok(distance(point, offers[1].pickup) < distance(point, offers[0].pickup));
  assert.equal(routeLength(buildGpsRoute(point, offers[0].pickup)), 48);
  assert.equal(routeLength(buildGpsRoute(point, offers[1].pickup)), 72);
  assert.equal(nearestFareIndex(point, offers), 0);
});

test("fare targeting has a half-block hysteresis margin", () => {
  assert.equal(FARE_TARGET_SWITCH_MARGIN, 18);
  assert.equal(shouldSwitchFareTarget(100, 82.1), false);
  assert.equal(shouldSwitchFareTarget(100, 81.9), true);
});

test("GPS drops a stale fare beyond 5000m even when the nearer fare saves less than hysteresis", () => {
  const game = makeGame();
  game.x = 0;
  game.y = 0;
  game.availableFareMask = 0b11;
  game.jobIndex = 0;
  game.fareJobs = game.fareJobs.map((job, index) => index < 2 ? {
    ...job,
    pickup: { x: index === 0 ? 288 : 280, y: 0 },
    pickupApproach: { x: index === 0 ? 288 : 280, y: 0 },
  } : job);
  assert.ok(farePickupRouteDistance({ x: 0, y: 0 }, game.fareJobs[0]) > FARE_GPS_RETARGET_DISTANCE);
  assert.ok(
    farePickupRouteDistance({ x: 0, y: 0 }, game.fareJobs[0])
      - farePickupRouteDistance({ x: 0, y: 0 }, game.fareJobs[1])
      < FARE_TARGET_SWITCH_MARGIN,
  );
  syncNearestFareTarget(game);
  assert.equal(game.jobIndex, 1);

  game.jobIndex = 0;
  game.fareJobs = game.fareJobs.map((job, index) => index < 2 ? {
    ...job,
    pickup: { x: index === 0 ? 270 : 262, y: 0 },
    pickupApproach: { x: index === 0 ? 270 : 262, y: 0 },
  } : job);
  assert.ok(farePickupRouteDistance({ x: 0, y: 0 }, game.fareJobs[0]) <= FARE_GPS_RETARGET_DISTANCE);
  syncNearestFareTarget(game);
  assert.equal(game.jobIndex, 0, "normal-distance targets should retain half-block hysteresis");
});

test("rolling fares preserve six-slot progress while spawning safe nearby passengers", () => {
  const game = makeGame("street-ace", 0x51a7, "free-run");
  game.x = 648;
  game.y = 0;
  game.elapsed = 2;
  game.availableFareMask = 0b10_1100;
  const unavailableBefore = game.fareJobs.map((job, index) => (
    (game.availableFareMask & (1 << index)) === 0 ? structuredClone(job) : null
  ));
  game.fareJobs = game.fareJobs.map((job, index) => (
    (game.availableFareMask & (1 << index)) !== 0 ? {
      ...job,
      pickupStopId: `stale-${index}`,
      pickup: { x: -648, y: index * ROAD_SPACING },
      pickupApproach: { x: -648, y: index * ROAD_SPACING },
    } : job
  ));
  const cycleBefore = game.fareCycle;
  const maskBefore = game.availableFareMask;
  game.message = "KEEP THIS MESSAGE";
  game.messageUntil = 99;
  assert.equal(maintainFareStream(game), true);
  assert.equal(game.fareJobs.length, FARES_PER_CYCLE);
  assert.equal(game.availableFareMask, maskBefore);
  assert.equal(game.fareCycle, cycleBefore);
  assert.equal(game.fareStreamRevision, 1);
  assert.equal(game.message, "KEEP THIS MESSAGE", "rolling dispatch should be silent");
  assert.equal(game.messageUntil, 99);
  unavailableBefore.forEach((job, index) => {
    if (job) assert.deepEqual(game.fareJobs[index], job);
  });
  const available = game.fareJobs.filter((_, index) => (
    (game.availableFareMask & (1 << index)) !== 0
  ));
  assert.equal(available.length, 3);
  assert.ok(available.every((job) => (
    farePickupRouteDistance({ x: game.x, y: game.y }, job) <= FARE_STOP_RULES.nearbyPickupRadius
  )));
  assert.ok(available.every((job) => analyzeFareStopPlacement(job.pickup).safe));
  assert.equal(new Set(game.fareJobs.map((job) => job.id)).size, FARES_PER_CYCLE);
  assert.equal(maintainFareStream(game), false, "the same taxi anchor must not churn fares");
});

test("crossing an active seam streams a region-appropriate local market", () => {
  const game = makeGame("street-ace", 0xc3da, "free-run");
  game.x = 1008;
  game.y = 0;
  game.elapsed = 2;
  assert.equal(maintainFareStream(game), true);
  assert.equal(game.fareServiceRegionId, "cedar-vale");
  const eligibleIds = new Set(eligibleFareRiders(
    containingRegionForPosition(game.x, game.y),
  ).map((rider) => rider.id));
  assert.ok(game.fareJobs.every((job) => (
    containingRegionForPosition(job.pickup.x, job.pickup.y)?.id === "cedar-vale"
      && containingRegionForPosition(job.dropoff.x, job.dropoff.y)?.id === "cedar-vale"
      && eligibleIds.has(job.id)
  )));
});

test("fare streaming and retargeting freeze during protected activities", () => {
  const variants = [
    (game: ReturnType<typeof makeGame>) => { game.onboard = true; },
    (game: ReturnType<typeof makeGame>) => { game.customDestination = { x: 72, y: 0 }; },
    (game: ReturnType<typeof makeGame>) => {
      game.player = {
        kind: "walking",
        actor: { x: game.x, y: game.y, vx: 0, vy: 0, heading: 0, speed: 0 },
        location: { kind: "city" },
      };
    },
    (game: ReturnType<typeof makeGame>) => {
      game.activeCourier = {
        contractId: "paper-rush",
        stage: "pickup",
        acceptedAt: 0,
        pickedUpAt: 0,
        approachDistance: 0,
        deliveryDistance: 100,
        hadCollision: false,
        loadedInTaxi: false,
      };
    },
  ];
  for (const protect of variants) {
    const game = makeGame("street-ace", 73, "free-run");
    game.x = 648;
    game.y = 0;
    game.elapsed = 2;
    protect(game);
    const jobsBefore = structuredClone(game.fareJobs);
    const indexBefore = game.jobIndex;
    assert.equal(maintainFareStream(game), false);
    syncNearestFareTarget(game, true);
    assert.deepEqual(game.fareJobs, jobsBefore);
    assert.equal(game.jobIndex, indexBefore);
    assert.equal(game.fareStreamRevision, 0);
  }
});

test("Off Duty freezes passenger dispatch and prevents invisible pickup dwell", () => {
  const game = makeGame("street-ace", 0x0ffd, "free-run");
  game.traffic = [];
  const selectedIndex = game.jobIndex;
  const selectedJob = game.fareJobs[selectedIndex];
  const jobsBefore = structuredClone(game.fareJobs);
  const maskBefore = game.availableFareMask;
  const historyBefore = structuredClone(game.usedFareRiderIdsByRegion);

  assert.equal(setFareDispatchEnabled(game, false), true);
  assert.equal(game.fareDispatchEnabled, false);
  assert.equal(waitingFares(game).length, 0);
  assert.equal(farePickupMarkers(game).length, 0);
  assert.equal(fareAtPickupRange(game), null);
  assert.equal(farePresentationBoxes(game, 0).length, 0);

  game.x = selectedJob.pickup.x;
  game.y = selectedJob.pickup.y;
  game.elapsed = 4;
  assert.equal(maintainFareStream(game), false);
  syncNearestFareTarget(game, true);
  const events = [];
  for (let tick = 0; tick < 15; tick += 1) {
    events.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }

  assert.equal(game.onboard, false);
  assert.equal(events.some((event) => event.type === "pickup"), false);
  assert.equal(game.jobIndex, selectedIndex);
  assert.equal(game.availableFareMask, maskBefore);
  assert.deepEqual(game.fareJobs, jobsBefore);
  assert.deepEqual(game.usedFareRiderIdsByRegion, historyBefore);
});

test("returning On Duty after roaming refreshes local fares and restores guidance", () => {
  const game = makeGame("street-ace", 0xd07a, "free-run");
  assert.equal(setFareDispatchEnabled(game, false), true);
  game.x = 1008;
  game.y = 0;
  game.elapsed = 3;

  assert.equal(setFareDispatchEnabled(game, true), true);
  assert.equal(game.fareDispatchEnabled, true);
  assert.equal(game.fareServiceRegionId, "cedar-vale");
  assert.equal(game.fareStreamRevision, 1);
  assert.equal(waitingFares(game).length, FARES_PER_CYCLE);
  assert.equal(farePickupMarkers(game).filter((marker) => marker.selected).length, 1);
  assert.ok(game.fareJobs.every((job) => (
    containingRegionForPosition(job.pickup.x, job.pickup.y)?.id === "cedar-vale"
  )));
});

test("active passenger and courier jobs lock the duty switch", () => {
  const passengerGame = makeGame("street-ace", 17, "free-run");
  passengerGame.onboard = true;
  assert.equal(setFareDispatchEnabled(passengerGame, false), false);
  assert.equal(passengerGame.fareDispatchEnabled, true);

  const courierGame = makeGame("street-ace", 18, "free-run");
  courierGame.activeCourier = {
    contractId: "paper-rush",
    stage: "pickup",
    acceptedAt: 0,
    pickedUpAt: 0,
    approachDistance: 0,
    deliveryDistance: 100,
    hadCollision: false,
    loadedInTaxi: false,
  };
  assert.equal(setFareDispatchEnabled(courierGame, false), false);
  assert.equal(courierGame.fareDispatchEnabled, true);

  const timedGame = makeGame("street-ace", 19, "timed");
  assert.equal(setFareDispatchEnabled(timedGame, false), false);
  assert.equal(timedGame.fareDispatchEnabled, true);
});

test("every visible blue fare is actionable, even when GPS selected another", () => {
  const game = makeGame();
  game.traffic = [];
  const targetIndex = (game.jobIndex + 1) % game.fareJobs.length;
  const target = game.fareJobs[targetIndex];
  game.x = target.pickup.x;
  game.y = target.pickup.y;
  const events = [];
  for (let tick = 0; tick < 11; tick += 1) {
    events.push(...stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1));
  }
  assert.equal(game.jobIndex, targetIndex);
  assert.equal(game.onboard, true);
  assert.equal(events.filter((event) => event.type === "pickup").length, 1);
  assert.equal(events.find((event) => event.type === "pickup")?.fareId, target.id);
});

test("the fare pool serves every rider before it refills", () => {
  const game = makeGame();
  const firstMarketRiders = new Set(game.fareJobs.map((job) => job.id));
  assert.equal(game.usedFareRiderIdsByRegion[game.fareServiceRegionId]?.length, FARES_PER_CYCLE);
  const served = new Set<number>();
  for (let count = 0; count < FARES_PER_CYCLE; count += 1) {
    syncNearestFareTarget(game, true);
    const selected = game.jobIndex;
    assert.equal(served.has(selected), false);
    served.add(selected);
    markFarePickedUp(game, selected);
    game.x = game.fareJobs[selected].dropoff.x;
    game.y = game.fareJobs[selected].dropoff.y;
    if (count < FARES_PER_CYCLE - 1) {
      assert.notEqual(game.availableFareMask, 0);
      syncNearestFareTarget(game, true);
    }
  }
  assert.equal(served.size, FARES_PER_CYCLE);
  assert.equal(game.availableFareMask, 0);
  refillFarePool(game);
  assert.equal(game.availableFareMask, ALL_FARES_MASK);
  assert.equal(game.usedFareRiderIdsByRegion[game.fareServiceRegionId]?.length, FARES_PER_CYCLE * 2);
  assert.ok(game.fareJobs.every((job) => !firstMarketRiders.has(job.id)));
});

test("pickup highlights disappear while occupied and return after dropoff without changing availability", () => {
  const game = makeGame("street-ace", 527);
  const seekingMarkers = farePickupMarkers(game);
  assert.equal(seekingMarkers.length, FARES_PER_CYCLE);
  assert.equal(seekingMarkers.filter((marker) => marker.selected).length, 1);

  const seekingBoxes = farePresentationBoxes(game, 0);
  assert.equal(seekingBoxes.filter((box) => box.material === MAT_PERSON).length, FARES_PER_CYCLE * 11);
  assert.equal(seekingBoxes.filter((box) => box.material === MAT_MARKER).length, FARES_PER_CYCLE * 24);
  assert.equal(seekingBoxes.filter((box) => (box.color[3] ?? 1) < 0.99).length, FARES_PER_CYCLE * 12);

  markFarePickedUp(game, game.jobIndex);
  const remainingMask = game.availableFareMask;
  game.onboard = true;
  const onboardMarkers = farePickupMarkers(game);
  assert.deepEqual(onboardMarkers, []);
  const occupiedHud = makeHud(game);
  assert.deepEqual(occupiedHud.availablePickups, []);
  assert.deepEqual(occupiedHud.fareDestinations.map(marker => marker.id), [game.fareJobs[game.jobIndex].id]);
  const onboardBoxes = farePresentationBoxes(game, 0);
  assert.equal(onboardBoxes.filter((box) => box.material === MAT_PERSON).length, 0);
  assert.equal(onboardBoxes.filter((box) => box.material === MAT_MARKER).length, 28);
  assert.equal(onboardBoxes.filter((box) => (box.color[3] ?? 1) < 0.99).length, 14);
  const target = game.fareJobs[game.jobIndex].dropoff;
  assert.ok(onboardBoxes.every(box => Math.hypot(box.x - target.x, box.y - target.y) > 4), "only the ring remains, with no center beacon");
  game.onboard = false;
  assert.equal(farePickupMarkers(game).length, FARES_PER_CYCLE - 1);
  assert.equal(game.availableFareMask, remainingMask);
});

test("all fares, traffic, particles, a full route, and the densest crowd stay inside actor budget", () => {
  const game = makeGame();
  const minBlock = CHUNK_MIN * BLOCKS_PER_CHUNK - 2;
  const maxBlock = CHUNK_MAX * BLOCKS_PER_CHUNK + 1;
  let maxAmbientBoxes = 0;
  let densestBlockX = 0;
  let densestBlockY = 0;
  for (let blockX = minBlock; blockX <= maxBlock; blockX += 1) {
    for (let blockY = minBlock; blockY <= maxBlock; blockY += 1) {
      game.x = blockX * ROAD_SPACING + ROAD_SPACING / 2;
      game.y = blockY * ROAD_SPACING + ROAD_SPACING / 2;
      const ambientBoxes = ambientPeopleBoxes(game, 0).length;
      if (ambientBoxes > maxAmbientBoxes) {
        maxAmbientBoxes = ambientBoxes;
        densestBlockX = blockX;
        densestBlockY = blockY;
      }
    }
  }
  assert.ok(maxAmbientBoxes <= 300, `ambient crowd fixture grew to ${maxAmbientBoxes}`);
  game.x = densestBlockX * ROAD_SPACING + ROAD_SPACING / 2;
  game.y = densestBlockY * ROAD_SPACING + ROAD_SPACING / 2;
  game.elapsed = 60;
  game.particles = Array.from({ length: 90 }, (_, index) => ({
    x: index,
    y: -index,
    vx: 0,
    vy: 0,
    life: 1,
    maxLife: 1,
    color: [1, 1, 1, 1] as const,
  }));
  const route = Array.from({ length: 22 }, (_, index) => ({
    x: index % 2 === 0 ? -720 : 720,
    y: -720 + index * 68,
  }));
  route.unshift({ x: game.x, y: game.y });
  game.boosting = true;
  const actors = dynamicBoxes(game, 0, route);
  assert.ok(actors.length <= 1100, `actor fixture grew to ${actors.length}`);
  assert.ok(actors.length <= ACTOR_INSTANCE_CAPACITY);

  game.player = {
    kind: "walking",
    actor: { x: game.x, y: game.y, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "city" },
  };
  const interactionWorld: WorldView = {
    ...EMPTY_WORLD,
    interactions: Array.from({ length: 6 }, (_, index) => ({
      id: `budget-door-${index}`,
      kind: "venue-entrance" as const,
      label: `DOOR ${index}`,
      x: game.x + 5 + index * 2,
      y: game.y + 5,
      heading: 0,
      radius: 2.35,
      venue: { id: `budget-venue-${index}`, kind: "shop" as const, label: `SHOP ${index}` },
    })),
  };
  const walkingActors = dynamicBoxes(game, 0, route, interactionWorld);
  assert.ok(walkingActors.length <= 1100, `on-foot actor fixture grew to ${walkingActors.length}`);
  assert.ok(walkingActors.length <= ACTOR_INSTANCE_CAPACITY);
});
