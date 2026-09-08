import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { CityStream, generateCityChunk } from "../../game/world";
import { createFareMarket } from "../../game/fare-market";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { COPPER_MESA_ANCHORS } from "../../game/desert";
import { nearestRoadProjection, isRoadSurface } from "../../game/road-network";
import { groundAt } from "../../game/vehicle-road-contact";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { inCopperTerrain } from "../../game/terrain/copper-forms";
import type { WorldInteraction } from "../../game/model";
import { copperAnimatedBoxes, copperArchPose } from "../../game/copper-scenery";
import { COPPER_RIVER } from "../../game/terrain/watercourses";
import { terrainHeightAt } from "../../game/terrain/surface";
import { isTaxiNearGasStation, purchaseGasStationOffer } from "../../game/gas-station";
import { makeCareerState } from "../../game/career";

const idle = { up: false, down: false, left: false, right: false, boost: false };

function copperEntrances() {
  const entrances: WorldInteraction[] = [];
  for (let cx = -5; cx <= 5; cx++) for (let cy = 6; cy <= 16; cy++) {
    entrances.push(...generateCityChunk(cx, cy).interactions);
  }
  return entrances;
}

test("all ten desert venues enter and return on their actual elevated ground", () => {
  const stream = new CityStream(), entrances = copperEntrances();
  for (const anchor of COPPER_MESA_ANCHORS) {
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
  const stations = copperEntrances().filter(item => item.kind === "venue-entrance" && item.venue.kind === "gas" && (item.z ?? 0) > 1);
  assert.ok(stations.length >= 2, "desert fuel service remains available beyond the city seam");
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

test("desert fares pick up and drop off from their safe elevated road approaches", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "copper-mesa")!;
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

test("recycled Copper Mesa traffic follows actual streets or adopts a curved road", () => {
  const game = makeGame("street-ace", 98, "free-run");
  game.fareDispatchEnabled = false;
  const stream = new CityStream();
  let checked = 0, curves = 0;
  for (const focus of [{ x: 0, y: 1332 }, { x: -540, y: 1728 }, { x: 360, y: 1944 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: (parked.point.z ?? 0) + 0.64, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || !inCopperTerrain(car.x, car.y)) continue;
        assert.equal(isRoadSurface(car), true, `traffic left its road: ${car.x},${car.y}`);
        assert.ok(Math.abs((car.z ?? 0) - groundAt(car, 0.85, car.motion.kind === "path" ? car.motion.roadId : undefined).height) < 0.15);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});

test("the rock arch has an open road passage, the canyon river has a real bed, and desert animations are deterministic", () => {
  const stream = new CityStream(), arch = copperArchPose(), world = stream.update(arch.point.x, arch.point.y, 1);
  assert.equal(taxiHitsBuilding(world, arch.point.x, arch.point.y, arch.heading, arch.point.z + 0.64), undefined);
  assert.ok(circleHitsBuilding(world, arch.point.x, arch.point.y, 0.4, arch.point.z + 16, 2.4), "arch crown is solid overhead");
  const river = COPPER_RIVER[44];
  assert.ok(terrainHeightAt(river.x, river.y) < river.z - 1.5, "water sits in an excavated channel");
  assert.ok(circleHitsBuilding(stream.update(river.x, river.y, 1), river.x, river.y, 0.4, river.z - 0.5), "river is impassable on foot");
  const first = copperAnimatedBoxes(4, { x: 0, y: 1600 }), later = copperAnimatedBoxes(9, { x: 0, y: 1600 });
  assert.ok(first.length > 50 && first.length < 180);
  assert.notDeepEqual(first, later);
  assert.deepEqual(first, copperAnimatedBoxes(4, { x: 0, y: 1600 }));
  assert.ok(first.every(box => [box.x, box.y, box.z, box.sx, box.sy, box.sz].every(Number.isFinite)));
});
