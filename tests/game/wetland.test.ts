import assert from "node:assert/strict";
import test from "node:test";
import { CHUNK_SIZE, ROAD_SPACING } from "../../game/config";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { createFareMarket } from "../../game/fare-market";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import { buildGpsRoute } from "../../game/navigation";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { isRoadSurface, sampleSpecialRoad, specialRoadLength, nearestRoadProjection } from "../../game/road-network";
import { gridStreetPointEnabled, gridStreetSegmentEnabled } from "../../game/road-topology";
import { ACTIVE_WORLD_REGIONS, containingRegionForPosition, isPlayablePoint } from "../../game/regions";
import { makeGame, makeTraffic } from "../../game/state";
import type { CityChunk, WorldView, Vec2 } from "../../game/model";
import { PALM_REACH_ANCHORS } from "../../game/reach-destinations";
import { REACH_ROADS, REACH_ROAD_IDS } from "../../game/reach-roads";
import { REACH_BOUNDS, reachIsLandAt, reachShoreAt } from "../../game/reach-layout";
import { CityStream, generateCityChunk } from "../../game/world";

const cypressReach = ACTIVE_WORLD_REGIONS.find(region => region.id === "cypress-reach")!;
const chunks: CityChunk[] = [];
for (let cx = 6; cx <= 16; cx++) for (let cy = 6; cy <= 23; cy++) chunks.push(generateCityChunk(cx, cy));
const world: WorldView = { key: "palm-reach-sweep", chunks, boxes: [],
  colliders: chunks.flatMap(chunk => chunk.colliders), interactions: chunks.flatMap(chunk => chunk.interactions) };

function assertPavedRoute(from: Vec2, to: Vec2) {
  const route = buildGpsRoute(from, to);
  assert.ok(route.length > 1);
  assert.ok(Math.hypot(route.at(-1)!.x - to.x, route.at(-1)!.y - to.y) <= .1,
    `route ${JSON.stringify(from)} to ${JSON.stringify(to)} ended at ${JSON.stringify(route.at(-1))}`);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let j = 0; j <= count; j++) {
      const p = { x: a.x + (b.x - a.x) * j / count, y: a.y + (b.y - a.y) * j / count,
        z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * j / count };
      assert.ok(isPlayablePoint(p.x, p.y) && isRoadSurface(p), `route left pavement at ${p.x},${p.y}`);
    }
  }
  return route;
}

test("Palm Reach extends seven rows into a tapered peninsula with open water on both sides", () => {
  assert.equal(chunks.length, 198);
  assert.equal(cypressReach.name, "PALM REACH");
  assert.equal(cypressReach.chunkMinX * CHUNK_SIZE - CHUNK_SIZE / 2, 792);
  assert.equal(REACH_BOUNDS.maxY, 3384);
  for (const [y, maxWidth] of [[2376, 550], [2952, 400], [3222, 185]]) {
    const shore = reachShoreAt(y);
    assert.ok(shore.east - shore.west < maxWidth);
    assert.ok(reachIsLandAt((shore.west + shore.east) / 2, y));
    assert.ok(!reachIsLandAt(shore.west - 10, y) && !reachIsLandAt(shore.east + 10, y));
  }
  assert.equal(reachIsLandAt(1683, 3300), false);
  for (const p of [{ x: 2376, y: 2000 }, { x: 1800, y: 3384 }, { x: 1100, y: 2200 }]) {
    assert.equal(isRoadSurface(p), false);
    assert.equal(gridStreetPointEnabled(p, "vertical"), false);
    assert.equal(gridStreetPointEnabled(p, "horizontal"), false);
  }
});

test("all eight roads and ten destinations connect to both neighbors and the southern tip", () => {
  assert.equal(REACH_ROADS.length, 8);
  for (const road of REACH_ROADS) {
    const target = sampleSpecialRoad(road.id, specialRoadLength(road.id) * .57)!.point;
    assertPavedRoute({ x: 1368, y: 792 }, target);
    const westRoute = assertPavedRoute({ x: 756, y: 1944 }, target);
    assert.ok(westRoute.some(point => Math.abs(point.x - 792) < .1 && Math.abs(point.y - 1944) < .1));
  }
  for (const anchor of PALM_REACH_ANCHORS) {
    const portal = world.interactions.find(p => p.id === anchor.venueId);
    assert.ok(portal, anchor.id);
    const approach = nearestRoadProjection(portal).point;
    assert.ok(Math.hypot(approach.x - portal.x, approach.y - portal.y) < 30, anchor.id);
    assertPavedRoute({ x: 1368, y: 792 }, approach);
  }
  const route = assertPavedRoute({ x: 0, y: 0 }, { x: 1692, y: 3132 });
  const regions = new Set(route.map(p => containingRegionForPosition(p.x, p.y)?.id));
  assert.ok(regions.has("cedar-vale") || regions.has("copper-mesa"));
  assert.ok(regions.has("city-center") && regions.has("cypress-reach"));
});

test("visible shoreline water matches collision, while entrances and their returns are dry and clear", () => {
  let waterCount = 0;
  for (const chunk of chunks) for (const surface of chunk.surfaceRegions) {
    waterCount++;
    const collider = chunk.colliders.find(candidate => candidate.id === surface.id);
    assert.ok(collider, surface.id);
    assert.deepEqual([collider.halfX, collider.halfY].sort((a, b) => a - b),
      [surface.halfX, surface.halfY].sort((a, b) => a - b), surface.id);
    if (surface.id.startsWith("wetland-water-shore:")) {
      assert.ok(!reachIsLandAt(surface.x, surface.y), surface.id);
      assert.ok(chunk.surfaces?.some(face => face.corners.some(p => Math.abs(p.x - (surface.x - surface.halfX)) < .001 && Math.abs(p.y - (surface.y - surface.halfY)) < .001)), surface.id);
    }
  }
  assert.ok(waterCount > 600);
  for (const portal of world.interactions) for (const offset of [0, 1.15]) {
    const x = portal.x + Math.cos(portal.heading) * offset, y = portal.y + Math.sin(portal.heading) * offset;
    assert.ok(reachIsLandAt(x, y, .5), portal.id);
    assert.equal(Boolean(circleHitsBuilding(world, x, y, .44)), false, `${portal.id}:${offset}`);
  }
  for (const anchor of PALM_REACH_ANCHORS) for (const road of REACH_ROADS) for (const point of road.points) {
    const inside = point.x > anchor.originX * ROAD_SPACING + 6 && point.x < (anchor.originX + anchor.width) * ROAD_SPACING - 6
      && point.y > anchor.originY * ROAD_SPACING + 6 && point.y < (anchor.originY + anchor.height) * ROAD_SPACING - 6;
    assert.equal(inside, false, `${road.id} crosses ${anchor.id}`);
  }
});

test("palms, buildings and water leave every authored driving lane clear, including the raised bay crossing", () => {
  const stream = new CityStream();
  for (const road of REACH_ROADS) for (let d = 1; d < specialRoadLength(road.id); d += 3) for (const lane of [-2.25, 0, 2.25]) {
    const sample = sampleSpecialRoad(road.id, d, lane)!;
    const local = stream.update(sample.point.x, sample.point.y, 1);
    assert.equal(Boolean(taxiHitsBuilding(local, sample.point.x, sample.point.y, sample.heading, (sample.point.z ?? 0) + .64)), false, `${road.id}:${d}:${lane}`);
  }
  const bridge = nearestRoadProjection({ x: 1188, y: 1728, z: 9 });
  assert.ok((bridge.point.z ?? 0) > 8);
  assert.equal(reachIsLandAt(bridge.point.x, bridge.point.y), false);
  const trafficRoads = new Set(makeTraffic().flatMap(car => car.motion.kind === "path" && REACH_ROAD_IDS.has(car.motion.roadId) ? [car.motion.roadId] : []));
  assert.deepEqual([...trafficRoads].sort(), REACH_ROADS.slice(0, 4).map(road => road.id).sort());
});

test("both lanes of every enabled Palm Reach grid segment remain paved and collision-clear", () => {
  const stream = new CityStream();
  let segments = 0;
  for (let x = REACH_BOUNDS.minX; x < REACH_BOUNDS.maxX; x += ROAD_SPACING) {
    for (let y = REACH_BOUNDS.minY; y < REACH_BOUNDS.maxY; y += ROAD_SPACING) {
      for (const axis of ["vertical", "horizontal"] as const) {
        const vertical = axis === "vertical";
        const end = { x: x + (vertical ? 0 : ROAD_SPACING), y: y + (vertical ? ROAD_SPACING : 0) };
        if (!gridStreetSegmentEnabled({ x, y }, end)) continue;
        segments++;
        for (let distance = 3; distance < ROAD_SPACING; distance += 6) for (const lane of [-2.25, 2.25]) {
          const point = { x: x + (vertical ? lane : distance), y: y + (vertical ? distance : lane) };
          const label = `${axis} ${point.x},${point.y}`;
          assert.ok(gridStreetPointEnabled(point, axis), label);
          assert.ok(isRoadSurface(point), label);
          assert.equal(taxiHitsBuilding(stream.update(point.x, point.y, 1), point.x, point.y, vertical ? Math.PI / 2 : 0, .64), undefined, label);
        }
      }
    }
  }
  assert.ok(segments > 400);
});

test("street and promenade walkers stay on dry, collision-clear frontages", () => {
  let count = 0, south = 0;
  for (const chunk of chunks) {
    const local: WorldView = { key: chunk.key, chunks: [chunk], boxes: [], colliders: chunk.colliders, interactions: [] };
    for (let bx = chunk.cx * 4 - 2; bx < chunk.cx * 4 + 2; bx++) for (let by = chunk.cy * 4 - 2; by < chunk.cy * 4 + 2; by++) {
      for (const seconds of [0, 10, 23]) for (let index = 0; index < 6; index++) {
        const p = ambientPedestrianPointForBlock(bx, by, seconds, index);
        if (!p) continue;
        count++;
        if (p.y > 2376) south++;
        assert.ok(reachIsLandAt(p.x, p.y, .44), `${bx},${by}`);
        assert.equal(Boolean(circleHitsBuilding(local, p.x, p.y, .44)), false, `${bx},${by}:${index}:${seconds}`);
      }
    }
  }
  assert.ok(count > 1500 && south > 100);
});

test("Palm Reach uses its local cast and fare six transfers only to a cardinal neighbor", () => {
  const game = makeGame("street-ace", 0x43595052, "free-run");
  const market = createFareMarket(game.runSeed, 0, [], cypressReach, {});
  game.fareJobs = market.jobs;
  game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;
  game.fareServiceRegionId = cypressReach.id;
  for (const job of market.jobs) {
    assert.equal(containingRegionForPosition(job.pickup.x, job.pickup.y)?.id, cypressReach.id);
    assert.equal(containingRegionForPosition(job.dropoff.x, job.dropoff.y)?.id, cypressReach.id);
  }
  assert.ok(market.jobs.some((job) => job.passengerArtCell >= 120));

  const destinations = new Set<string>();
  for (let seed = 0; seed < 12; seed += 1) {
    const seededGame = makeGame("street-ace", seed, "free-run");
    const seededMarket = createFareMarket(seed, 0, [], cypressReach, {});
    seededGame.fareJobs = seededMarket.jobs;
    seededGame.usedFareRiderIdsByRegion = seededMarket.usedFareRiderIdsByRegion;
    seededGame.fareServiceRegionId = cypressReach.id;
    seededGame.availableFareMask = 1 << 5;
    seededGame.x = seededMarket.jobs[0].dropoff.x;
    seededGame.y = seededMarket.jobs[0].dropoff.y;
    const offer = scheduleSixthFareTransfer(seededGame, seededMarket.jobs[0]);
    assert.ok(offer);
    destinations.add(offer.destinationRegionId);
    assert.ok(["cedar-vale", "copper-mesa"].includes(offer.destinationRegionId));
  }
  assert.deepEqual([...destinations].sort(), ["cedar-vale", "copper-mesa"]);
});
