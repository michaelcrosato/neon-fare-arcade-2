import assert from "node:assert/strict";
import test from "node:test";
import { CEDAR_ROADS, CEDAR_COURTS } from "../../game/cedar-layout";
import { CEDAR_VALE_ANCHORS, cedarNeighborhoodForBlock, cedarParcels, cedarParcelPoint } from "../../game/residential";
import { compiledSpecialRoad, isRoadSurface, nearestRoadProjection, routeRoadNetworkShortest } from "../../game/road-network";
import { gridStreetSegmentEnabled } from "../../game/road-topology";
import { sampleRoad } from "../../game/roads/geometry";
import { circleHitsBuilding, obbOverlap, taxiHitsBuilding } from "../../game/collision";
import { CityStream, generateCityChunk } from "../../game/world";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { groundAt } from "../../game/vehicle-road-contact";
import { ACTIVE_WORLD_REGIONS, containingRegionForPosition } from "../../game/regions";
import { createFareMarket } from "../../game/fare-market";
import type { WorldInteraction } from "../../game/model";

const idle = { up: false, down: false, left: false, right: false, boost: false };
const gate = { x: 792, y: 0 };

test("Cedar has separate street-facing yards in every neighborhood and a sparse local grid", () => {
  const parcels = [...cedarParcels().values()];
  assert.ok(parcels.length > 500 && parcels.length < 750);
  for (const court of CEDAR_COURTS) assert.ok(parcels.filter(p => p.roadId === `${court.id}-turnaround`).length >= 3, court.id);
  for (const neighborhood of ["willow-gate", "pine-ridge", "maple-commons", "brookside", "garden-end"]) {
    assert.ok(parcels.filter(p => cedarNeighborhoodForBlock(p.blockX, p.blockY) === neighborhood).length > 60, neighborhood);
  }
  for (const [i, a] of parcels.entries()) {
    const front = cedarParcelPoint(a, 0, -23);
    assert.ok(nearestRoadProjection(front).centerDistance < 0.2, `driveway has a road at ${a.blockX},${a.blockY}`);
    for (const b of parcels.slice(i + 1)) {
      if (Math.hypot(a.x - b.x, a.y - b.y) > 42) continue;
      assert.equal(obbOverlap({ ...cedarParcelPoint(a, 0, 1), heading: a.heading, halfLength: 14, halfWidth: 14.5 },
        { ...cedarParcelPoint(b, 0, 1), heading: b.heading, halfLength: 14, halfWidth: 14.5 }), false, "yards cannot overlap");
    }
  }
  let streets = 0;
  for (let x = 792; x < 2376; x += 36) for (let y = -792; y < 792; y += 36) {
    if (gridStreetSegmentEnabled({ x, y }, { x: x + 36, y })) streets++;
    if (gridStreetSegmentEnabled({ x, y }, { x, y: y + 36 })) streets++;
  }
  assert.ok(streets > 300 && streets < 1000, "local streets no longer carpet all 1,936 cells");
});

test("every Cedar road connects to the city and both lanes clear houses, fences, trees and campuses", () => {
  const stream = new CityStream();
  for (const road of CEDAR_ROADS) {
    const geometry = compiledSpecialRoad(road.id)!;
    assert.ok(routeRoadNetworkShortest(gate, sampleRoad(geometry, geometry.length / 2).center), road.id);
    for (let distance = 1; distance < geometry.length; distance += 2) for (const side of [-1, 1]) {
      const p = sampleRoad(geometry, distance, side * 2.25);
      const world = stream.update(p.point.x, p.point.y, 1);
      assert.equal(taxiHitsBuilding(world, p.point.x, p.point.y, p.heading, 0.64), undefined, `${road.id} at ${distance}`);
      assert.ok(Math.abs(groundAt({ ...p.point, z: 0.64 }, 0.85, road.id).height - 0.64) < 0.01);
    }
  }
  for (let x = 792; x <= 2376; x += 36) for (let y = -792; y < 792; y += 36) for (const vertical of [true, false]) {
    if (!gridStreetSegmentEnabled({ x, y }, { x: x + (vertical ? 0 : 36), y: y + (vertical ? 36 : 0) })) continue;
    for (let d = 2; d < 36; d += 4) for (const side of [-1, 1]) {
      const p = { x: x + (vertical ? side * 2.25 : d), y: y + (vertical ? d : side * 2.25) };
      assert.equal(taxiHitsBuilding(stream.update(p.x, p.y, 1), p.x, p.y, vertical ? Math.PI / 2 : 0, 0), undefined, `local street ${x},${y}`);
    }
  }
});

test("all eight Cedar destinations remain accessible and return the walker outside safely", () => {
  const stream = new CityStream();
  const entrances: WorldInteraction[] = [];
  for (let cx = 6; cx <= 16; cx++) for (let cy = -5; cy <= 5; cy++) entrances.push(...generateCityChunk(cx, cy).interactions);
  for (const anchor of CEDAR_VALE_ANCHORS) {
    const matching = entrances.filter(p => p.id.endsWith(`:${anchor.id}`));
    assert.equal(matching.length, 1, anchor.id);
    const portal = matching[0];
    assert.ok(portal.kind === "venue-entrance");
    assert.equal(portal.venue.kind, anchor.venueKind);
    const parking = nearestRoadProjection(portal);
    assert.ok(parking.centerDistance < 12);
    assert.ok(routeRoadNetworkShortest(gate, parking.point), anchor.id);
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
  const pool = entrances.find(p => p.id.endsWith(":brookside-rec"))!;
  const world = stream.update(pool.x, pool.y, 1);
  const water = world.chunks.flatMap(c => c.surfaceRegions).find(p => p.id === "brookside-pool:44:12")!;
  assert.ok(water);
  assert.ok(circleHitsBuilding(world, water.x, water.y, WALKER_RADIUS));
});

test("Cedar residents follow their frontages without clipping nearby parcels across chunk boundaries", () => {
  const stream = new CityStream();
  let samples = 0;
  for (const parcel of cedarParcels().values()) {
    for (const seconds of [0, 3, 10, 19, 27]) for (let person = 0; person < 6; person++) {
      const point = ambientPedestrianPointForBlock(parcel.blockX, parcel.blockY, seconds, person);
      if (!point) continue;
      const road = nearestRoadProjection(point);
      assert.ok(road.centerDistance > 5.5 && road.centerDistance < 10, "walkers stay beside traffic lanes");
      assert.equal(circleHitsBuilding(stream.update(point.x, point.y, 1), point.x, point.y, WALKER_RADIUS, point.z), undefined,
        `${parcel.blockX},${parcel.blockY} at ${seconds}`);
      samples++;
    }
  }
  assert.ok(samples > 2000);
});

test("Cedar fares complete pickups and dropoffs at accessible road approaches", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "cedar-vale")!;
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

test("Cedar recycles the existing traffic roster onto its local streets and curves", () => {
  const game = makeGame("street-ace", 98, "free-run");
  game.fareDispatchEnabled = false;
  const stream = new CityStream();
  let checked = 0, curves = 0;
  for (const focus of [{ x: 1476, y: -612 }, { x: 1836, y: 432 }, { x: 2304, y: -288 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: 0.64, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      assert.equal(game.traffic.length, 36);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || containingRegionForPosition(car.x, car.y)?.id !== "cedar-vale") continue;
        assert.ok(isRoadSurface(car), `traffic left the road at ${car.x},${car.y}`);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});
