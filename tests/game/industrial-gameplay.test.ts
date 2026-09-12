import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { stepExploration } from "../../game/exploration";
import { makeWalkingActor, WALKER_RADIUS } from "../../game/player";
import { CityStream, generateCityChunk } from "../../game/world";
import { createFareMarket } from "../../game/fare-market";
import { ACTIVE_WORLD_REGIONS, chunkCoordinateForBlock } from "../../game/regions";
import { IRONWAKE_ANCHORS, inIronwake, ironwakeIsWater } from "../../game/industrial-layout";
import { nearestRoadProjection, isRoadSurface } from "../../game/road-network";
import { groundAt } from "../../game/vehicle-road-contact";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { isTaxiNearGasStation, purchaseGasStationOffer } from "../../game/gas-station";
import { makeCareerState } from "../../game/career";
import { roadDesignHeight } from "../../game/terrain/region-forms";
import { ROAD_SURFACE_HEIGHT } from "../../game/roads/contact";

const idle = { up: false, down: false, left: false, right: false, boost: false };
const region = ACTIVE_WORLD_REGIONS.find(r => r.id === "ironwake-works")!;
const entrances = IRONWAKE_ANCHORS.map(anchor => {
  const chunk = generateCityChunk(chunkCoordinateForBlock(anchor.originX + anchor.portal.tileX),
    chunkCoordinateForBlock(anchor.originY + anchor.portal.tileY));
  const entrance = chunk.interactions.find(i => i.kind === "venue-entrance" && i.venue.label === anchor.label);
  assert.ok(entrance?.kind === "venue-entrance", anchor.id);
  return entrance;
});

test("all ten Ironwake public gates enter their venue and return safely outside", () => {
  const stream = new CityStream();
  for (const entrance of entrances) {
    const game = makeGame("street-ace", 1704, "free-run");
    game.traffic = [];
    const parking = nearestRoadProjection(entrance);
    Object.assign(game, parking.point, { z: (parking.point.z ?? 0) + ROAD_SURFACE_HEIGHT });
    game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor({ ...entrance, vx: 0, vy: 0, speed: 0 }) };
    const world = stream.update(entrance.x, entrance.y, 1);
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-entered"), entrance.label);
    assert.ok(game.player.kind === "walking" && game.player.location.kind === "interior");
    stepExploration(game, idle, 1 / 60, world);
    assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-exited"), entrance.label);
    for (let tick = 0; tick < 30; tick++) stepExploration(game, idle, 1 / 60, world);
    const actor = game.player.actor;
    assert.equal(actor.grounded, true, entrance.label);
    assert.equal(ironwakeIsWater(actor.x, actor.y), false, entrance.label);
    assert.equal(circleHitsBuilding(world, actor.x, actor.y, WALKER_RADIUS, actor.elevation), undefined, entrance.label);
    assert.ok(Math.abs((actor.elevation ?? 0) - (entrance.z ?? 0)) < .85, entrance.label);
  }
});

test("the truck stop services a taxi parked beside its entrance", () => {
  const gas = entrances.find(e => e.venue.kind === "gas")!;
  const game = makeGame("street-ace", 1704, "free-run"), parking = nearestRoadProjection(gas);
  const distance = Math.hypot(gas.x - parking.point.x, gas.y - parking.point.y);
  const point = { x: parking.point.x + (gas.x - parking.point.x) / distance * 2.25,
    y: parking.point.y + (gas.y - parking.point.y) / distance * 2.25,
    z: (parking.point.z ?? 0) + ROAD_SURFACE_HEIGHT };
  Object.assign(game, point, { z: groundAt(point, .85).height, heading: parking.tangentYaw });
  const world = new CityStream().update(gas.x, gas.y, 1);
  assert.equal(taxiHitsBuilding(world, game.x, game.y, game.heading, game.z), undefined);
  game.player = { kind: "walking", location: { kind: "city" }, actor: makeWalkingActor({ ...gas, vx: 0, vy: 0, speed: 0 }) };
  assert.ok(stepExploration(game, { ...idle, interact: true }, 1 / 60, world).some(e => e.type === "venue-entered"));
  assert.equal(isTaxiNearGasStation(game), true);
  assert.equal(purchaseGasStationOffer(game, { ...makeCareerState(), bank: 500 }, "boost-cooler").status, "purchased");
});

test("industrial fares complete pickup and dropoff at actual collision-clear road approaches", () => {
  const jobs = createFareMarket(1704, 2, [], region).jobs, stream = new CityStream();
  for (const [index, job] of jobs.entries()) {
    const game = makeGame("street-ace", 1704, "free-run");
    Object.assign(game, { traffic: [], fareJobs: jobs, fareServiceRegionId: region.id,
      fareStreamCheckAt: 1e9, jobIndex: index, availableFareMask: 1 << index });
    for (const stage of ["pickup", "dropoff"] as const) {
      const point = stage === "pickup" ? job.pickupApproach : job.dropoffApproach;
      Object.assign(game, point, { z: point.z ?? 0, vx: 0, vy: 0, speed: 0, heading: nearestRoadProjection(point).tangentYaw });
      game.roadMotion.grounded = true;
      game.roadMotion.roadId = null;
      const world = stream.update(point.x, point.y, 1);
      assert.equal(ironwakeIsWater(point.x, point.y), false);
      assert.equal(taxiHitsBuilding(world, game.x, game.y, game.heading, game.z), undefined, `${index} ${stage}`);
      const events = [];
      for (let tick = 0; tick < 20; tick++) events.push(...stepGame(game, idle, 1 / 60, world, () => 1));
      assert.equal(events.filter(e => e.type === stage).length, 1, `${index} ${stage}`);
    }
  }
});

test("recycled industrial traffic remains on dry roads at the actual road elevation", () => {
  const game = makeGame("street-ace", 1704, "free-run"), stream = new CityStream();
  game.fareDispatchEnabled = false;
  let checked = 0, curves = 0;
  for (const focus of [{ x: -1728, y: 1152 }, { x: -1872, y: 1656 }, { x: -1152, y: 2196 }]) {
    const parked = nearestRoadProjection(focus);
    Object.assign(game, parked.point, { z: (parked.point.z ?? 0) + ROAD_SURFACE_HEIGHT, vx: 0, vy: 0, speed: 0 });
    game.roadMotion.roadId = null;
    for (let tick = 0; tick < 300; tick++) {
      stepGame(game, idle, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
      if (tick < 30 || tick % 15) continue;
      for (const car of game.traffic) {
        if (game.elapsed < car.activeAt || !inIronwake(car.x, car.y)) continue;
        assert.equal(isRoadSurface(car), true, `traffic left its road: ${car.x},${car.y}`);
        assert.equal(ironwakeIsWater(car.x, car.y), false);
        assert.ok(Math.abs((car.z ?? 0) - groundAt(car, .85, car.motion.kind === "path" ? car.motion.roadId : undefined).height) < .15);
        checked++;
        if (car.motion.kind === "path") curves++;
      }
    }
  }
  assert.ok(checked > 100 && curves > 50);
});

for (const model of ["arcade", "simulation"] as const) {
  test(`${model} drives both neighboring seams in both directions without a collision or altitude step`, () => {
    const stream = new CityStream();
    for (const seam of [{ x: -1728, y: 792, axis: "y" }, { x: -792, y: 1368, axis: "x" }] as const) for (const direction of [-1, 1]) {
      const game = makeGame("street-ace", 1704, "free-run", model);
      const heading = seam.axis === "y" ? direction * Math.PI / 2 : direction > 0 ? 0 : Math.PI;
      const point = { x: seam.x - Math.cos(heading) * 30 - Math.sin(heading) * 2.25,
        y: seam.y - Math.sin(heading) * 30 + Math.cos(heading) * 2.25 };
      const support = groundAt({ ...point, z: roadDesignHeight(point.x, point.y) + ROAD_SURFACE_HEIGHT }, .85);
      Object.assign(game, point, { z: support.height, heading, vx: Math.cos(heading) * 20,
        vy: Math.sin(heading) * 20, speed: 20, traffic: [], fareDispatchEnabled: false });
      game.roadMotion.roadId = support.roadId;
      let finished = false;
      for (let tick = 0; tick < 300; tick++) {
        stepGame(game, { ...idle, up: game.speed < 20, down: game.speed > 21 }, 1 / 60, stream.update(game.x, game.y, 1), () => 1);
        assert.equal(game.collisions, 0, `${seam.axis} seam ${direction}`);
        assert.ok(Math.abs(game.z - groundAt(game, .85, game.roadMotion.roadId ?? undefined).height) < .1);
        if ((game[seam.axis] - seam[seam.axis]) * direction > 30) { finished = true; break; }
      }
      assert.ok(finished, `${seam.axis} seam ${direction} stopped`);
      assert.ok(game.roadMotion.grounded);
    }
  });
}
