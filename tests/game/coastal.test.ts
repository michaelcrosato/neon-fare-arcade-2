import assert from "node:assert/strict";
import test from "node:test";

import { ROAD_SPACING } from "../../game/config";
import { SOLANA_COAST_ANCHORS, coastalLotForBlock } from "../../game/coastal";
import { COAST_DRIVE_X, COAST_SHORE_X } from "../../game/coastal-layout";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { createFareMarket } from "../../game/fare-market";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import { buildGpsRoute } from "../../game/navigation";
import { SOLANA_COAST_FARE_RIDERS, SHARED_FARE_RIDERS, eligibleFareRiders } from "../../game/passengers";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { isRoadSurface, specialRoadIntersectsSquare } from "../../game/road-network";
import { gridStreetPointEnabled } from "../../game/road-topology";
import { ACTIVE_WORLD_REGIONS, activeCardinalNeighborRegions, containingRegionForPosition, isPlayablePoint } from "../../game/regions";
import { makeGame, makeTraffic } from "../../game/state";
import type { CityChunk, WorldView } from "../../game/model";
import { generateCityChunk } from "../../game/world";

const coast = ACTIVE_WORLD_REGIONS.find((region) => region.id === "solana-coast")!;
const roadIds = ["pacific-coast-drive", "sunset-boulevard", "citrus-scenic-loop", "mariposa-drive"];
const coastRoads = SPECIAL_ROADS.filter((road) => roadIds.includes(road.id));
const chunks: CityChunk[] = [];
for (let cx = coast.chunkMinX; cx <= coast.chunkMaxX; cx += 1) {
  for (let cy = coast.chunkMinY; cy <= coast.chunkMaxY; cy += 1) chunks.push(generateCityChunk(cx, cy));
}
const world: WorldView = {
  key: "solana-coast-sweep", chunks,
  boxes: chunks.flatMap((chunk) => chunk.boxes),
  colliders: chunks.flatMap((chunk) => chunk.colliders),
  interactions: chunks.flatMap((chunk) => chunk.interactions),
};

test("Solana Coast activates only W and connects its four roads to the City", () => {
  assert.equal(chunks.length, 121);
  assert.deepEqual(activeCardinalNeighborRegions(coast.id).map((region) => region.id), ["city-center"]);
  assert.equal(isPlayablePoint(-1000, -1000), false);
  assert.equal(isPlayablePoint(-1000, 1000), false);
  assert.deepEqual(coastRoads.map((road) => road.id), roadIds);
  for (const target of [{ x: COAST_DRIVE_X, y: 0 }, { x: COAST_DRIVE_X, y: -720 }, { x: COAST_DRIVE_X, y: 720 }]) {
    const route = buildGpsRoute({ x: 0, y: 0 }, target);
    // Check actual pavement, including horizontal tangents of authored curves.
    // The legacy axis-route validator only understands the street lattice.
    for (let i = 1; i < route.length; i += 1) {
      const a = route[i - 1], b = route[i];
      const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let j = 0; j <= samples; j += 1) {
        const point = { x: a.x + (b.x - a.x) * j / samples, y: a.y + (b.y - a.y) * j / samples };
        assert.equal(isRoadSurface(point), true, `route left pavement at ${point.x},${point.y}`);
      }
    }
    assert.ok(route.every((point) => isPlayablePoint(point.x, point.y)));
    assert.deepEqual(route.at(-1), target);
  }
  const trafficRoads = new Set(makeTraffic().flatMap((car) => car.motion.kind === "path" && roadIds.includes(car.motion.roadId) ? [car.motion.roadId] : []));
  assert.deepEqual([...trafficRoads].sort(), [...roadIds].sort());
  const seamRoads = (cx: number) => generateCityChunk(cx, 0).boxes.filter((box) => Math.abs(box.x + 792) < 1e-8 && box.sx === 12 && box.sy === ROAD_SPACING).length;
  assert.equal(seamRoads(-5), 4);
  assert.equal(seamRoads(-6), 0);
});

test("the ocean and beach stay continuous, dry pier access stays clear, and no offshore roads spawn", () => {
  const water = chunks.flatMap((chunk) => chunk.surfaceRegions.filter((surface) => surface.id.startsWith("coastal-water:")));
  assert.ok(water.length > 250);
  for (const surface of water) {
    assert.ok(world.colliders.some((collider) => collider.id === surface.id && collider.halfX === surface.halfX && collider.halfY === surface.halfY));
  }
  for (let y = -791; y < 792; y += 3) {
    assert.ok(water.some((surface) => Math.abs(COAST_SHORE_X - 5 - surface.x) <= surface.halfX && Math.abs(y - surface.y) <= surface.halfY) || Math.abs(y + 18) <= 5.4);
    for (const x of [COAST_SHORE_X - 36, COAST_SHORE_X + 36, COAST_DRIVE_X - 36]) {
      assert.equal(isRoadSurface({ x, y }), false, `offshore/beach road at ${x},${y}`);
      assert.equal(gridStreetPointEnabled({ x, y }, "vertical"), false);
    }
  }
  for (let x = -2230; x <= -2054; x += 2) assert.equal(Boolean(circleHitsBuilding(world, x, -18, 0.44)), false, `pier blocked at ${x}`);
  const lots = new Set<string>();
  for (let x = -66; x <= -23; x += 1) for (let y = -22; y <= 21; y += 1) lots.add(coastalLotForBlock(x, y));
  for (const kind of ["coast-ocean", "coast-beach", "coast-promenade", "coast-courtyard", "coast-midcentury", "coast-beach-bungalow", "coast-deco-shops", "coast-surf-shop", "coast-skate-park"]) assert.ok(lots.has(kind), kind);
});

test("all coast venues, walkers, landmark footprints, and taxi lanes remain collision clear", () => {
  const portals = SOLANA_COAST_ANCHORS.flatMap((anchor) => world.interactions.filter((interaction) => interaction.label === anchor.label && interaction.id.endsWith(`:${anchor.portal.suffix}`)));
  assert.equal(portals.length, 10);
  for (const portal of world.interactions) {
    assert.equal(Boolean(circleHitsBuilding(world, portal.x, portal.y, 0.44)), false, `${portal.id} entrance`);
    assert.equal(Boolean(circleHitsBuilding(world, portal.x + Math.cos(portal.heading) * 1.15, portal.y + Math.sin(portal.heading) * 1.15, 0.44)), false, `${portal.id} return`);
  }
  for (const anchor of SOLANA_COAST_ANCHORS) {
    for (let x = 0; x < anchor.width; x += 1) for (let y = 0; y < anchor.height; y += 1) {
      assert.equal(specialRoadIntersectsSquare({ x: (anchor.originX + x + 0.5) * ROAD_SPACING, y: (anchor.originY + y + 0.5) * ROAD_SPACING }, 12, 1.5), false, `${anchor.id}:${x}:${y}`);
    }
  }
  let walkerCount = 0;
  for (let x = -66; x <= -23; x += 1) for (let y = -22; y <= 21; y += 1) {
    for (const seconds of [0, 10]) for (let index = 0; index < 6; index += 1) {
      const point = ambientPedestrianPointForBlock(x, y, seconds, index);
      if (!point) continue;
      walkerCount += 1;
      assert.ok(x > -57, "generic walker on beach or water");
      assert.equal(Boolean(circleHitsBuilding(world, point.x, point.y, 0.44)), false, `walker ${x},${y}`);
    }
  }
  assert.ok(walkerCount > 1000);
  for (const road of coastRoads) for (let segment = 1; segment < road.points.length; segment += 1) {
    const a = road.points[segment - 1], b = road.points[segment];
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let step = 0; step <= steps; step += 1) for (const lane of [-2.25, 0, 2.25]) {
      const x = a.x + (b.x - a.x) * step / steps - Math.sin(heading) * lane;
      const y = a.y + (b.y - a.y) * step / steps + Math.cos(heading) * lane;
      assert.equal(Boolean(taxiHitsBuilding(world, x, y, heading)), false, `${road.id} blocked at ${x},${y}`);
    }
  }
});

test("coastal fares use their local cast and destination art, with City-only transfers", () => {
  assert.deepEqual(eligibleFareRiders(coast), [...SHARED_FARE_RIDERS, ...SOLANA_COAST_FARE_RIDERS]);
  const seenLocal = new Set<string>();
  for (const seed of [12, 47, 501]) {
    const game = makeGame("street-ace", seed, "free-run");
    const market = createFareMarket(seed, 0, [], coast, {});
    assert.equal(market.jobs.length, 6);
    for (const job of market.jobs) {
      assert.equal(containingRegionForPosition(job.pickup.x, job.pickup.y)?.id, coast.id);
      assert.equal(containingRegionForPosition(job.dropoff.x, job.dropoff.y)?.id, coast.id);
      assert.ok(job.destinationArtCell >= 24 && job.destinationArtCell <= 29);
      assert.ok(job.passengerArtCell < 48 || job.passengerArtCell >= 144);
      if (job.passengerArtCell >= 144) seenLocal.add(job.rider);
    }
    game.fareJobs = market.jobs;
    game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;
    game.fareServiceRegionId = coast.id;
    game.availableFareMask = 1 << 5;
    game.x = market.jobs[0].dropoff.x;
    game.y = market.jobs[0].dropoff.y;
    const offer = scheduleSixthFareTransfer(game, market.jobs[0]);
    assert.equal(offer?.destinationRegionId, "city-center");
  }
  assert.ok(seenLocal.size >= 3);
});
