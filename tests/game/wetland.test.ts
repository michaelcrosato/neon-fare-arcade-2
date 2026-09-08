import assert from "node:assert/strict";
import test from "node:test";

import { CHUNK_SIZE, ROAD_SPACING, WORLD_ROAD_MAX_X, WORLD_ROAD_MAX_Y } from "../../game/config";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { createFareMarket } from "../../game/fare-market";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import { buildGpsRoute } from "../../game/navigation";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { SPECIAL_ROADS } from "../../game/road-layout";
import {
  isRoadSurface,
  specialRoadIntersectsSquare,
} from "../../game/road-network";
import { gridStreetPointEnabled, routeStaysOnEnabledRoads } from "../../game/road-topology";
import {
  ACTIVE_WORLD_REGIONS,
  containingRegionForPosition,
  isPlayablePoint,
} from "../../game/regions";
import { makeGame, makeTraffic } from "../../game/state";
import type { WorldView } from "../../game/model";
import { CYPRESS_REACH_ANCHORS } from "../../game/wetland";
import { generateCityChunk } from "../../game/world";

const cypressReach = ACTIVE_WORLD_REGIONS.find((region) => region.id === "cypress-reach")!;
const WETLAND_ROAD_IDS = [
  "cypress-causeway",
  "lantern-bay-loop",
  "blackwater-trace",
  "stormwall-levee-road",
] as const;

function cypressWorld(): WorldView {
  const chunks = [];
  for (let cx = cypressReach.chunkMinX; cx <= cypressReach.chunkMaxX; cx += 1) {
    for (let cy = cypressReach.chunkMinY; cy <= cypressReach.chunkMaxY; cy += 1) {
      chunks.push(generateCityChunk(cx, cy));
    }
  }
  return {
    key: "cypress-reach-sweep",
    boxes: chunks.flatMap((chunk) => chunk.boxes),
    colliders: chunks.flatMap((chunk) => chunk.colliders),
    chunks,
    interactions: chunks.flatMap((chunk) => chunk.interactions),
  };
}

test("Cypress Reach combines a compact town grid with four connected wetland roads", () => {
  assert.equal(gridStreetPointEnabled({ x: 38 * ROAD_SPACING, y: 38 * ROAD_SPACING }, "vertical"), true);
  assert.equal(gridStreetPointEnabled({ x: 50 * ROAD_SPACING, y: 50 * ROAD_SPACING }, "vertical"), false);
  assert.equal(gridStreetPointEnabled({ x: 54 * ROAD_SPACING, y: 58 * ROAD_SPACING }, "vertical"), true);

  const roads = SPECIAL_ROADS.filter((road) => WETLAND_ROAD_IDS.includes(road.id as typeof WETLAND_ROAD_IDS[number]));
  assert.deepEqual(roads.map((road) => road.id), WETLAND_ROAD_IDS);
  for (const road of roads) {
    for (const point of road.points) {
      assert.equal(isPlayablePoint(point.x, point.y), true, `${road.id} left Cypress Reach`);
      assert.equal(isRoadSurface(point), true, `${road.id} point is not paved`);
    }
  }

  const route = buildGpsRoute({ x: 1368, y: 792 }, { x: 2200, y: 2250 });
  assert.equal(routeStaysOnEnabledRoads(route), true);
  assert.ok(route.some((point) => point.x > 2000 && point.y > 2000));
  assert.ok(route.every((point) => isPlayablePoint(point.x, point.y)));
});

test("Cypress Reach anchors, water, portals, and traffic lanes share one collision contract", () => {
  const world = cypressWorld();
  assert.equal(
    world.colliders.some((collider) => collider.id.startsWith("street-commerce:")),
    false,
    "wetland street-commerce density remains intentionally disabled",
  );
  const portals = CYPRESS_REACH_ANCHORS.flatMap((anchor) => world.interactions.filter((interaction) => (
    interaction.label === anchor.label && interaction.id.endsWith(`:${anchor.portal.suffix}`)
  )));
  assert.equal(portals.length, CYPRESS_REACH_ANCHORS.length);
  assert.equal(new Set(portals.map((portal) => portal.label)).size, CYPRESS_REACH_ANCHORS.length);
  for (const portal of world.interactions) {
    assert.equal(Boolean(circleHitsBuilding(world, portal.x, portal.y, 0.44)), false, `${portal.id} entrance`);
    const returnX = portal.x + Math.cos(portal.heading) * 1.15;
    const returnY = portal.y + Math.sin(portal.heading) * 1.15;
    assert.equal(Boolean(circleHitsBuilding(world, returnX, returnY, 0.44)), false, `${portal.id} return pose`);
  }

  let wetlandWater = 0;
  for (const chunk of world.chunks) {
    for (const surface of chunk.surfaceRegions.filter((region) => region.id.startsWith("wetland-water-"))) {
      wetlandWater += 1;
      const collider = chunk.colliders.find((candidate) => candidate.id === surface.id);
      assert.ok(collider, `${surface.id} lacks matching collision`);
      const colliderExtents = [collider!.halfX, collider!.halfY].sort((a, b) => a - b);
      const surfaceExtents = [surface.halfX, surface.halfY].sort((a, b) => a - b);
      assert.ok(colliderExtents[0] >= surfaceExtents[0] && colliderExtents[1] >= surfaceExtents[1]);
    }
  }
  assert.ok(wetlandWater > 250);

  for (const anchor of CYPRESS_REACH_ANCHORS) {
    for (let tileX = 0; tileX < anchor.width; tileX += 1) {
      for (let tileY = 0; tileY < anchor.height; tileY += 1) {
        const center = {
          x: (anchor.originX + tileX) * ROAD_SPACING + ROAD_SPACING / 2,
          y: (anchor.originY + tileY) * ROAD_SPACING + ROAD_SPACING / 2,
        };
        assert.equal(specialRoadIntersectsSquare(center, 12, 1.5), false, `${anchor.id}:${tileX}:${tileY}`);
      }
    }
  }

  for (const road of SPECIAL_ROADS.filter((candidate) => WETLAND_ROAD_IDS.includes(candidate.id as typeof WETLAND_ROAD_IDS[number]))) {
    for (let segment = 1; segment < road.points.length; segment += 1) {
      const a = road.points[segment - 1];
      const b = road.points[segment];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const heading = Math.atan2(b.y - a.y, b.x - a.x);
      const normalX = -Math.sin(heading);
      const normalY = Math.cos(heading);
      const steps = Math.max(1, Math.ceil(length / 3));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        for (const laneOffset of [-2.25, 0, 2.25]) {
          const x = a.x + (b.x - a.x) * t + normalX * laneOffset;
          const y = a.y + (b.y - a.y) * t + normalY * laneOffset;
          assert.equal(Boolean(taxiHitsBuilding(world, x, y, heading)), false, `${road.id} blocked at ${x.toFixed(1)},${y.toFixed(1)}`);
        }
      }
    }
  }
});

test("Lantern Bay is lively while open-water blocks stay free of generic walkers", () => {
  let town = 0;
  let openWater = 0;
  for (let seconds = 0; seconds < 20; seconds += 2) {
    for (let pedestrian = 0; pedestrian < 6; pedestrian += 1) {
      if (ambientPedestrianPointForBlock(38, 38, seconds, pedestrian)) town += 1;
      if (ambientPedestrianPointForBlock(58, 40, seconds, pedestrian)) openWater += 1;
    }
  }
  assert.ok(town >= 40);
  assert.equal(openWater, 0);
});

test("Cypress Reach uses its local cast and fare six transfers only to a cardinal neighbor", () => {
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

test("Cypress Reach occupies 121 chunks, owns both outer edges, and is never a City diagonal shortcut", () => {
  assert.equal((cypressReach.chunkMaxX - cypressReach.chunkMinX + 1) * (cypressReach.chunkMaxY - cypressReach.chunkMinY + 1), 121);
  assert.equal(cypressReach.chunkMinX * CHUNK_SIZE - CHUNK_SIZE / 2, 792);
  assert.equal(cypressReach.chunkMinY * CHUNK_SIZE - CHUNK_SIZE / 2, 792);

  const southeast = generateCityChunk(6, 6);
  const far = generateCityChunk(16, 16);
  const verticalRoadsAt = (x: number) => southeast.boxes.filter((box) => Math.abs(box.x - x) < 1e-8 && Math.abs(box.sx - 12) < 1e-8 && Math.abs(box.sy - ROAD_SPACING) < 1e-8).length;
  const horizontalRoadsAt = (y: number) => southeast.boxes.filter((box) => Math.abs(box.y - y) < 1e-8 && Math.abs(box.sx - ROAD_SPACING) < 1e-8 && Math.abs(box.sy - 12) < 1e-8).length;
  assert.equal(verticalRoadsAt(792), 0);
  assert.equal(horizontalRoadsAt(792), 0);
  assert.ok(far.boxes.some((box) => Math.abs(box.x - WORLD_ROAD_MAX_X) < 1e-8));
  assert.ok(far.boxes.some((box) => Math.abs(box.y - WORLD_ROAD_MAX_Y) < 1e-8));

  const route = buildGpsRoute({ x: 0, y: 0 }, { x: 1600, y: 1600 });
  const regions = new Set(route.map((point) => containingRegionForPosition(point.x, point.y)?.id));
  assert.ok(regions.has("city-center"));
  assert.ok(regions.has("cypress-reach"));
  assert.ok(regions.has("cedar-vale") || regions.has("copper-mesa"));
  assert.equal([...regions].some((id) => id === undefined), false);

  const cypressTrafficRoads = new Set(makeTraffic().flatMap((car) => (
    car.motion.kind === "path" && WETLAND_ROAD_IDS.includes(car.motion.roadId as typeof WETLAND_ROAD_IDS[number])
      ? [car.motion.roadId]
      : []
  )));
  assert.deepEqual([...cypressTrafficRoads].sort(), [...WETLAND_ROAD_IDS].sort());
});
