import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { CityStream, generateCityChunk } from "../../game/world";
import { createFareMarket } from "../../game/fare-market";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { NORTHSTAR_RANGE_ANCHORS } from "../../game/mountain";
import { nearestRoadProjection, isRoadSurface } from "../../game/road-network";
import { groundAt } from "../../game/vehicle-road-contact";
import { circleHitsBuilding, taxiHitsBuilding, ceilingHeightAt } from "../../game/collision";
import { inNorthstarTerrain } from "../../game/terrain/northstar-forms";
import { terrainHeightAt } from "../../game/terrain/surface";
import { gondolaCablePoint, gondolaStationEave, mountainAnimatedBoxes, NORTHSTAR_GONDOLA } from "../../game/mountain-scenery";
import { isTaxiNearGasStation } from "../../game/gas-station";
import type { WorldInteraction } from "../../game/model";

const idle = { up: false, down: false, left: false, right: false, boost: false };

test("all nine mountain venues enter and return on their actual elevated ground", () => {
  const stream = new CityStream();
  const entrances: WorldInteraction[] = [];
  for (let cx = -5; cx <= 5; cx++) for (let cy = -16; cy <= -6; cy++) {
    entrances.push(...generateCityChunk(cx, cy).interactions);
  }
  for (const anchor of NORTHSTAR_RANGE_ANCHORS) {
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
    if (anchor.id === "copper-pass-gas") {
      assert.equal(isTaxiNearGasStation(game), true);
      game.z -= 20;
      assert.equal(isTaxiNearGasStation(game), false, "a cab below the gas station cannot be serviced");
      game.z += 20;
    }
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

test("mountain fares pick up and drop off from their safe elevated road approaches", () => {
  const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "northstar-range")!;
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

test("recycled Northstar traffic follows actual streets or adopts a curved road", () => {
  const game = makeGame("street-ace", 98, "free-run");
  game.fareDispatchEnabled = false;
  const stream = new CityStream();
  let checked = 0, curves = 0;
  for (const focus of [{ x: 0, y: -1440 }, { x: 0, y: -1800 }, { x: 360, y: -2232 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: (parked.point.z ?? 0) + 0.64, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || !inNorthstarTerrain(car.x, car.y)) continue;
        assert.equal(isRoadSurface(car), true, `traffic left its road: ${car.x},${car.y}`);
        assert.ok(Math.abs((car.z ?? 0) - groundAt(car, 0.85, car.motion.kind === "path" ? car.motion.roadId : undefined).height) < 0.15);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});

test("gondola cabins clear the terrain and both station shells have real walls and ceilings", () => {
  const stream = new CityStream();
  for (const side of [-1, 1]) for (let i = 0; i <= 500; i++) {
    const point = gondolaCablePoint(i / 500, side);
    assert.ok(point.z - 4.5 - terrainHeightAt(point.x, point.y) > 4, `cabin at ${i}`);
    const world = stream.update(point.x, point.y, 1);
    assert.equal(circleHitsBuilding(world, point.x, point.y, 1.6, point.z - 4.5, 3.2), undefined, `cabin clips a structure at ${i}, side ${side}`);
  }
  for (const [index, point] of [NORTHSTAR_GONDOLA.lower, NORTHSTAR_GONDOLA.upper].entries()) {
    const world = stream.update(point.x, point.y, 1), z = terrainHeightAt(point.x, point.y);
    assert.ok(circleHitsBuilding(world, point.x, point.y + 7, WALKER_RADIUS, z));
    assert.equal(circleHitsBuilding(world, point.x + 4.5, point.y, WALKER_RADIUS, z), undefined);
    assert.ok(Math.abs(ceilingHeightAt(world, point.x + 4.5, point.y, z, WALKER_RADIUS) - gondolaStationEave(index === 0 ? 0 : 4)) < 0.01);
  }
  const first = mountainAnimatedBoxes(0, NORTHSTAR_GONDOLA.lower), later = mountainAnimatedBoxes(5, NORTHSTAR_GONDOLA.lower);
  assert.equal(first.length, 32);
  assert.notDeepEqual(first, later);
  assert.deepEqual(first, mountainAnimatedBoxes(0, NORTHSTAR_GONDOLA.lower));
});
