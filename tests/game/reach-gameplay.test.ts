import assert from "node:assert/strict";
import test from "node:test";
import { PALM_REACH_ANCHORS } from "../../game/reach-destinations";
import { reachIsLandAt, reachShoreAt } from "../../game/reach-layout";
import { reachAnimatedBoxes } from "../../game/reach-scenery";
import { isRoadSurface, nearestRoadProjection } from "../../game/road-network";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { CityStream, generateCityChunk } from "../../game/world";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { ACTIVE_WORLD_REGIONS, containingRegionForPosition } from "../../game/regions";
import { createFareMarket, passengerTripDistance } from "../../game/fare-market";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import { MAX_REGIONAL_FARE_TRIP_DISTANCE } from "../../game/config";
import { createProceduralFareStopPairs } from "../../game/fare-placement";
import type { WorldInteraction } from "../../game/model";

const idle = { up: false, down: false, left: false, right: false, boost: false };

test("all ten Palm Reach destinations preserve their services and return the walker outside", () => {
  const stream = new CityStream(), entrances: WorldInteraction[] = [];
  for (let cx = 6; cx <= 16; cx++) for (let cy = 6; cy <= 23; cy++) entrances.push(...generateCityChunk(cx, cy).interactions);
  for (const anchor of PALM_REACH_ANCHORS) {
    const portal = entrances.find(p => p.id === anchor.venueId)!;
    assert.equal(portal.kind, "venue-entrance");
    assert.equal(portal.venue.kind, anchor.portal.kind);
    const game = makeGame("street-ace", 719, "free-run");
    game.traffic = [];
    game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor({ ...portal, vx: 0, vy: 0, speed: 0 }) };
    const world = stream.update(portal.x, portal.y, 1);
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-entered"), anchor.id);
    stepExploration(game, idle, 1 / 60, world);
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-exited"), anchor.id);
    for (let tick = 0; tick < 30; tick++) stepExploration(game, idle, 1 / 60, world);
    assert.equal(circleHitsBuilding(world, game.player.actor.x, game.player.actor.y, WALKER_RADIUS, game.player.actor.elevation), undefined, anchor.id);
    assert.ok(game.player.actor.grounded);
  }
});

test("the continuous ocean promenade stays dry and clear from the northern beach to the cape", () => {
  const stream = new CityStream();
  for (let y = 900; y <= 3222; y += 3) {
    const x = reachShoreAt(y).east - 62;
    assert.ok(reachIsLandAt(x, y, WALKER_RADIUS), `${x},${y}`);
    assert.equal(circleHitsBuilding(stream.update(x, y, 1), x, y, WALKER_RADIUS), undefined, `${x},${y}`);
  }
});

test("southern rolling dispatch finds six local pickups and Palm Reach destination cards", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "cypress-reach")!;
  for (const [seed, anchor] of [{ x: 1692, y: 2952 }, { x: 1656, y: 2700 }, { x: 1638, y: 3204 }].entries()) {
    const pairs = createProceduralFareStopPairs(seed + 81, [], false, region, { anchor, nearbyPickupCount: 2 });
    assert.equal(pairs.length, 6);
    assert.ok(pairs.filter(pair => Math.hypot(pair.pickup.zone.x - anchor.x, pair.pickup.zone.y - anchor.y) < 360).length >= 2);
    assert.ok(pairs.every(pair => pair.pickup.zone.y > 2376));
    for (const { dropoff } of pairs) {
      assert.ok(dropoff.destinationCard, "southern stops need an environment-matched destination card");
      assert.equal(dropoff.artCell, dropoff.destinationCard.artCell);
      assert.equal(containingRegionForPosition(dropoff.zone.x, dropoff.zone.y)?.id, region.id);
    }
    const game = makeGame("street-ace", seed + 81, "free-run");
    game.fareServiceRegionId = region.id;
    game.fareJobs = game.fareJobs.map((job, index) => ({ ...job,
      pickupStopId: pairs[index].pickup.id, pickup: pairs[index].pickup.zone, pickupApproach: pairs[index].pickup.approach,
      dropoffStopId: pairs[index].dropoff.id, dropoff: pairs[index].dropoff.zone, dropoffApproach: pairs[index].dropoff.approach,
      destinationArtCell: pairs[index].dropoff.artCell, destinationCard: pairs[index].dropoff.destinationCard,
      destination: pairs[index].dropoff.label,
    }));
    game.availableFareMask = 1 << 5;
    const offer = scheduleSixthFareTransfer(game, game.fareJobs[0]);
    assert.ok(offer && ["cedar-vale", "copper-mesa"].includes(offer.destinationRegionId));
    assert.ok(passengerTripDistance(game.fareJobs[5]) <= MAX_REGIONAL_FARE_TRIP_DISTANCE);
  }
});

test("waterfront animation is deterministic, bounded, and region-local", () => {
  for (const focus of [{ x: 1188, y: 1728 }, { x: 2124, y: 2016 }, { x: 1692, y: 3132 }]) {
    const a = reachAnimatedBoxes(10, focus), b = reachAnimatedBoxes(25, focus);
    assert.ok(a.length > 0 && a.length < 128);
    assert.deepEqual(a, reachAnimatedBoxes(10, focus));
    assert.notDeepEqual(a, b);
  }
  assert.deepEqual(reachAnimatedBoxes(10, { x: 0, y: 0 }), []);
});

test("Palm Reach fares complete pickups and dropoffs at accessible road approaches", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "cypress-reach")!;
  const jobs = createFareMarket(871, 2, [], region).jobs;
  assert.equal(jobs.length, 6);
  const stream = new CityStream();
  for (const [index, job] of jobs.entries()) {
    const game = makeGame("street-ace", 871, "free-run");
    Object.assign(game, { traffic: [], fareJobs: jobs, fareServiceRegionId: region.id, fareStreamCheckAt: 1e9, jobIndex: index, availableFareMask: 1 << index });
    for (const stage of ["pickup", "dropoff"] as const) {
      const point = stage === "pickup" ? job.pickupApproach : job.dropoffApproach;
      Object.assign(game, point, { z: point.z ?? 0, vx: 0, vy: 0, speed: 0, heading: nearestRoadProjection(point).tangentYaw });
      game.roadMotion.grounded = true; game.roadMotion.roadId = null;
      const world = stream.update(point.x, point.y, 1);
      assert.equal(taxiHitsBuilding(world, game.x, game.y, game.heading, game.z), undefined, `${index} ${stage}`);
      const events = [];
      for (let tick = 0; tick < 20; tick++) events.push(...stepGame(game, idle, 1 / 60, world, () => 1));
      assert.equal(events.filter(e => e.type === stage).length, 1, `${index} ${stage}`);
    }
  }
});

test("Palm Reach recycles the existing traffic roster onto its local streets and curves", () => {
  const game = makeGame("street-ace", 98, "free-run");
  game.fareDispatchEnabled = false;
  const stream = new CityStream();
  let checked = 0, curves = 0;
  for (const focus of [{ x: 1800, y: 1476 }, { x: 1692, y: 2952 }, { x: 1656, y: 2772 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: 0.64, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      assert.equal(game.traffic.length, 40);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || containingRegionForPosition(car.x, car.y)?.id !== "cypress-reach") continue;
        assert.ok(isRoadSurface(car), `traffic left the road at ${car.x},${car.y}`);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});
