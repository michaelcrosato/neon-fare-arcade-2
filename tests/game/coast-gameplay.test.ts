import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { CityStream, generateCityChunk } from "../../game/world";
import { createFareMarket } from "../../game/fare-market";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { SOLANA_COAST_ANCHORS } from "../../game/coastal";
import { nearestRoadProjection, isRoadSurface } from "../../game/road-network";
import { groundAt } from "../../game/vehicle-road-contact";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { inCoastTerrain } from "../../game/terrain/coast-forms";
import type { WalkingActor, WorldInteraction } from "../../game/model";
import { isTaxiNearGasStation, purchaseGasStationOffer } from "../../game/gas-station";
import { makeCareerState } from "../../game/career";
import { COAST_CANALS, COAST_PIER } from "../../game/coastal-layout";
import { coastAnimatedBoxes } from "../../game/coast-scenery";
import { coastRoadHeight } from "../../game/terrain/coast-forms";
import { terrainHeightAt } from "../../game/terrain/surface";

const idle = { up: false, down: false, left: false, right: false, boost: false };

test("the whole pier supports an ordinary walk beneath the wheel in both directions", () => {
  const stream = new CityStream();
  for (let x = COAST_PIER.minX + 9; x < COAST_PIER.maxX; x += 18) {
    assert.equal(groundAt({ x, y: COAST_PIER.y }).height, COAST_PIER.deckHeight);
    for (const side of [-1, 1]) {
      assert.ok(terrainHeightAt(x, COAST_PIER.y + side * (COAST_PIER.halfWidth + 1)) < 0.2,
        "sand must stay below the water outside the timber deck");
    }
  }
  for (const direction of [-1, 1]) {
    const game = makeGame("street-ace", 94, "free-run");
    const start = direction < 0 ? COAST_PIER.maxX - 2 : COAST_PIER.minX + 2;
    game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor({ x: start, y: COAST_PIER.y,
      z: COAST_PIER.deckHeight, heading: direction < 0 ? Math.PI : 0, vx: 0, vy: 0, speed: 0 }) };
    let finished = false;
    for (let tick = 0; tick < 6000; tick += 1) {
      const actor: WalkingActor = game.player.actor;
      const world = stream.update(actor.x, actor.y, 1);
      stepExploration(game, { ...idle, up: true }, 1 / 60, world);
      assert.equal(actor.grounded, true);
      assert.ok(Math.abs((actor.elevation ?? 0) - COAST_PIER.deckHeight) < 0.01);
      assert.equal(circleHitsBuilding(world, actor.x, actor.y, WALKER_RADIUS, actor.elevation), undefined);
      if (direction < 0 ? actor.x < COAST_PIER.minX + 3 : actor.x > COAST_PIER.maxX - 3) { finished = true; break; }
    }
    assert.equal(finished, true, `pier walk ${direction} stopped`);
  }
});

test("canal bridges carry traffic above solid water and animated coastal scenery is deterministic", () => {
  const stream = new CityStream();
  for (const canal of COAST_CANALS) {
    const world = stream.update(canal.x, 396, 1);
    assert.ok(terrainHeightAt(canal.x, 396) < canal.height - 1);
    assert.ok(circleHitsBuilding(world, canal.x, 396, 0.44, canal.height), "water blocks walking");
    for (const y of [360, 432, 504]) {
      const z = coastRoadHeight(canal.x, y) + 0.64;
      assert.equal(taxiHitsBuilding(world, canal.x, y, 0, z), undefined);
      assert.ok(Math.abs(groundAt({ x: canal.x, y, z }, 0.85).height - z) < 0.01);
      assert.ok(world.colliders.some(item => item.id.startsWith("coast-bridge:") && item.x === canal.x && item.y === y && item.roadDeck));
    }
  }
  const focus = { x: -2160, y: 0 }, first = coastAnimatedBoxes(4, focus);
  assert.ok(first.length > 100 && first.length < 400);
  assert.deepEqual(first, coastAnimatedBoxes(4, focus));
  assert.notDeepEqual(first, coastAnimatedBoxes(9, focus));
  assert.ok(first.every(box => [box.x, box.y, box.z, box.sx, box.sy, box.sz].every(Number.isFinite)));
  assert.deepEqual(coastAnimatedBoxes(4, { x: 0, y: 0 }), []);
});

function coastEntrances() {
  const entrances: WorldInteraction[] = [];
  for (let cx = -16; cx <= -6; cx++) for (let cy = -5; cy <= 5; cy++) {
    entrances.push(...generateCityChunk(cx, cy).interactions);
  }
  return entrances;
}

test("all ten coastal venues enter and return on their actual elevated ground", () => {
  const stream = new CityStream(), entrances = coastEntrances();
  for (const anchor of SOLANA_COAST_ANCHORS) {
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

test("elevated fuel stops service a cab parked in the near lane and reject one below the station", () => {
  const stream = new CityStream();
  const stations = coastEntrances().filter(item => item.kind === "venue-entrance" && item.venue.kind === "gas" && (item.z ?? 0) > 1);
  assert.ok(stations.length >= 1, "coastal fuel service remains available beyond the city seam");
  for (const gas of stations) {
    const game = makeGame("street-ace", 94, "free-run"), parking = nearestRoadProjection(gas);
    // Park in the roadside lane; the centerline is outside the station's service radius.
    const distance = Math.hypot(gas.x - parking.point.x, gas.y - parking.point.y);
    const point = { ...parking.point,
      x: parking.point.x + (gas.x - parking.point.x) / distance * 2.25,
      y: parking.point.y + (gas.y - parking.point.y) / distance * 2.25,
      z: (parking.point.z ?? 0) + 0.64 };
    Object.assign(game, point, { z: groundAt(point, 0.85).height, heading: parking.tangentYaw });
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

test("coastal fares pick up and drop off from their safe elevated road approaches", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "solana-coast")!;
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

test("recycled Solana Coast traffic follows actual streets or adopts a curved road", () => {
  const game = makeGame("street-ace", 98, "free-run");
  game.fareDispatchEnabled = false;
  const stream = new CityStream();
  let checked = 0, curves = 0;
  for (const focus of [{ x: -1764, y: 0 }, { x: -2016, y: 180 }, { x: -1260, y: -648 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: (parked.point.z ?? 0) + 0.64, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || !inCoastTerrain(car.x, car.y)) continue;
        assert.equal(isRoadSurface(car), true, `traffic left its road: ${car.x},${car.y}`);
        assert.ok(Math.abs((car.z ?? 0) - groundAt(car, 0.85, car.motion.kind === "path" ? car.motion.roadId : undefined).height) < 0.15);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});
