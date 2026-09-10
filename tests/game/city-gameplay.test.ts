import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { CityStream, generateCityChunk } from "../../game/world";
import { createFareMarket } from "../../game/fare-market";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { nearestRoadProjection, isRoadSurface } from "../../game/road-network";
import { groundAt } from "../../game/vehicle-road-contact";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import type { WorldInteraction } from "../../game/model";
import { isTaxiNearGasStation, purchaseGasStationOffer } from "../../game/gas-station";
import { makeCareerState } from "../../game/career";
import { terrainHeightAt } from "../../game/terrain/surface";


import { CITY_LANDMARKS } from "../../game/landmarks";
import { inCityTerrain } from "../../game/terrain/city-forms";
const idle = { up: false, down: false, left: false, right: false, boost: false };
function cityEntrances() {
  const entrances: WorldInteraction[] = [];
  for (let cx = -5; cx <= 5; cx++) for (let cy = -5; cy <= 5; cy++) entrances.push(...generateCityChunk(cx, cy).interactions);
  return entrances;
}

test("every city entrance and return pose stands on clear physical ground", () => {
  let count = 0;
  for (let cx = -5; cx <= 5; cx++) for (let cy = -5; cy <= 5; cy++) {
    const chunk = generateCityChunk(cx, cy), world = { ...chunk, chunks: [chunk] };
    for (const entrance of chunk.interactions) {
      count++;
      assert.ok(Math.abs((entrance.z ?? 0) - terrainHeightAt(entrance.x, entrance.y)) < .01, entrance.id);
      for (const offset of [0, 1.15]) {
        const x = entrance.x + Math.cos(entrance.heading) * offset, y = entrance.y + Math.sin(entrance.heading) * offset;
        assert.equal(circleHitsBuilding(world, x, y, WALKER_RADIUS, terrainHeightAt(x, y)), undefined, entrance.id);
      }
    }
  }
  assert.ok(count > 1100, "city shops, residences and services remain populated");
});

test("all sixteen city landmarks enter and return on their actual elevated ground", () => {
  const stream = new CityStream(), entrances = cityEntrances();
  for (const anchor of CITY_LANDMARKS) {
    const entrance = entrances.find(item => item.kind === "venue-entrance" && item.venue.label === anchor.label)!;
    assert.ok(entrance.kind === "venue-entrance");
    const game = makeGame("street-ace", 94, "free-run");
    game.traffic = [];
    const parking = nearestRoadProjection(entrance);
    Object.assign(game, parking.point, { z: (parking.point.z ?? 0) + 0.64 });
    game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor({ ...entrance, vx: 0, vy: 0, speed: 0 }) };
    const world = stream.update(entrance.x, entrance.y, 1);
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-entered"), anchor.id);
    assert.ok(game.player.kind === "walking" && game.player.location.kind === "interior");
    stepExploration(game, idle, 1 / 60, world);
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-exited"), anchor.id);
    for (let tick = 0; tick < 30; tick++) stepExploration(game, idle, 1 / 60, world);
    assert.ok(game.player.kind === "walking");
    const actor = game.player.actor;
    assert.ok(Math.abs((actor.elevation ?? 0) - (entrance.z ?? 0)) < 0.85, anchor.id);
    assert.equal(circleHitsBuilding(world, actor.x, actor.y, WALKER_RADIUS, actor.elevation), undefined, anchor.id);
    assert.equal(actor.grounded, true, anchor.id);
  }
});
test("elevated city forecourts service a parked cab and reject one below the station", () => {
  const stream = new CityStream();
  const stations = cityEntrances().filter(item => item.kind === "venue-entrance" && item.venue.kind === "gas" && (item.z ?? 0) > 1);
  assert.ok(stations.length > 30, "fuel service remains distributed through the hill districts");
  for (const gas of stations) {
    const game = makeGame("street-ace", 94, "free-run");
    const point = { x: gas.x + Math.cos(gas.heading) * 6, y: gas.y + Math.sin(gas.heading) * 6 };
    Object.assign(game, point, { z: groundAt({ ...point, z: terrainHeightAt(point.x, point.y) + .64 }, .85).height, heading: gas.heading });
    const world = stream.update(gas.x, gas.y, 1);
    assert.equal(taxiHitsBuilding(world, game.x, game.y, game.heading, game.z), undefined, gas.id);
    game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor({ ...gas, vx: 0, vy: 0, speed: 0 }) };
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-entered"), gas.id);
    assert.equal(isTaxiNearGasStation(game), true, gas.id);
    assert.equal(purchaseGasStationOffer(game, { ...makeCareerState(), bank: 500 }, "boost-cooler").status, "purchased");
    game.z -= 20;
    assert.equal(isTaxiNearGasStation(game), false, "a taxi below an elevated station cannot be serviced");
  }
});
test("all six city fares pick up and deliver on their shared elevated approaches", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "city-center")!;
  const jobs = createFareMarket(871, 2, [], region).jobs;
  const stream = new CityStream();
  for (const [index, job] of jobs.entries()) {
    const game = makeGame("street-ace", 871, "free-run");
    game.traffic = [];
    game.fareJobs = jobs;
    game.fareServiceRegionId = region.id;
    game.fareStreamCheckAt = 1e9;
    game.jobIndex = index;
    game.availableFareMask = 1 << index;
    for (const stage of ["pickup", "dropoff"] as const) {
      const point = stage === "pickup" ? job.pickupApproach : job.dropoffApproach;
      Object.assign(game, point, { z: point.z ?? 0, vx: 0, vy: 0, speed: 0,
        heading: nearestRoadProjection(point).tangentYaw });
      game.roadMotion.grounded = true;
      game.roadMotion.roadId = null;
      const world = stream.update(point.x, point.y, 1);
      assert.equal(taxiHitsBuilding(world, game.x, game.y, game.heading, game.z), undefined, `${index} ${stage}`);
      const events = [];
      for (let tick = 0; tick < 20; tick++) events.push(...stepGame(game, idle, 1 / 60, world, () => 1));
      assert.equal(events.filter(e => e.type === stage).length, 1, `${index} ${stage}`);
    }
  }
});

test("recycled City traffic follows actual streets or adopts a curved road", () => {
  const game = makeGame("street-ace", 98, "free-run");
  game.fareDispatchEnabled = false;
  const stream = new CityStream();
  let checked = 0, curves = 0;
  for (const focus of [{ x: 0, y: 0 }, { x: -684, y: -180 }, { x: 36, y: -648 }, { x: 432, y: -252 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: (parked.point.z ?? 0) + 0.64, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || !inCityTerrain(car.x, car.y)) continue;
        assert.equal(isRoadSurface(car), true, `traffic left its road: ${car.x},${car.y}`);
        assert.ok(Math.abs((car.z ?? 0) - groundAt(car, 0.85, car.motion.kind === "path" ? car.motion.roadId : undefined).height) < 0.15);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});
