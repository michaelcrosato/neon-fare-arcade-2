import assert from "node:assert/strict";
import test from "node:test";

import {
  CHUNK_SIZE,
  MAX_CHUNK_BOXES,
  MAX_CHUNK_COLLIDERS,
  MAX_CHUNK_INTERACTIONS,
  MAX_STREAM_BOXES,
  MAX_STREAM_COLLIDERS,
  MAX_STREAM_INTERACTIONS,
  ROAD_SPACING,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  WORLD_ROAD_MIN_Y,
} from "../../game/config";
import { circleHitsBuilding } from "../../game/collision";
import { buildNavigationPlan } from "../../game/navigation";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import {
  ACTIVE_WORLD_REGIONS,
  WORLD_REGION_SLOTS,
  activeCardinalNeighborRegions,
  activeChunkCoordinates,
  clampPointToActiveRegions,
  containingRegionForPosition,
  isActiveChunk,
  isPlayablePoint,
  regionForBlock,
} from "../../game/regions";
import { CEDAR_VALE_ANCHORS } from "../../game/residential";
import { NORTHSTAR_RANGE_ANCHORS } from "../../game/mountain";
import { COPPER_MESA_ANCHORS } from "../../game/desert";
import { CYPRESS_REACH_ANCHORS } from "../../game/wetland";
import { isRoadSurface } from "../../game/road-network";
import type { WorldView } from "../../game/model";
import {
  CityStream,
  districtForBlock,
  generateCityChunk,
  lotForBlock,
} from "../../game/world";

test("the active region registry reserves nine compass cells and activates five square regions and the extended southeast", () => {
  assert.equal(WORLD_REGION_SLOTS.length, 9);
  assert.equal(new Set(WORLD_REGION_SLOTS.map((slot) => slot.direction)).size, 9);
  assert.deepEqual(ACTIVE_WORLD_REGIONS.map((region) => ({
    id: region.id,
    direction: region.direction,
    width: region.chunkMaxX - region.chunkMinX + 1,
    height: region.chunkMaxY - region.chunkMinY + 1,
  })), [
    { id: "city-center", direction: "C", width: 11, height: 11 },
    { id: "cedar-vale", direction: "E", width: 11, height: 11 },
    { id: "northstar-range", direction: "N", width: 11, height: 11 },
    { id: "copper-mesa", direction: "S", width: 11, height: 11 },
    { id: "cypress-reach", direction: "SE", width: 11, height: 18 },
    { id: "solana-coast", direction: "W", width: 11, height: 11 },
  ]);
  const active = activeChunkCoordinates();
  assert.equal(active.length, 803);
  assert.equal(new Set(active.map(([cx, cy]) => `${cx},${cy}`)).size, 803);
  assert.equal(isActiveChunk(-5, -5), true);
  assert.equal(isActiveChunk(16, 5), true);
  assert.equal(isActiveChunk(0, -6), true);
  assert.equal(isActiveChunk(0, -16), true);
  assert.equal(isActiveChunk(0, 6), true);
  assert.equal(isActiveChunk(0, 16), true);
  assert.equal(isActiveChunk(16, 16), true);
  assert.equal(isActiveChunk(8, -8), false);
  assert.equal(isActiveChunk(-6, 0), true);
  assert.equal(regionForBlock(21, 0)?.id, "city-center");
  assert.equal(regionForBlock(22, 0)?.id, "cedar-vale");
  assert.equal(regionForBlock(0, -23)?.id, "northstar-range");
  assert.equal(regionForBlock(0, 22)?.id, "copper-mesa");
  assert.equal(regionForBlock(22, 22)?.id, "cypress-reach");
  assert.deepEqual(
    activeCardinalNeighborRegions("city-center").map((region) => region.id),
    ["northstar-range", "solana-coast", "cedar-vale", "copper-mesa"],
  );
  assert.deepEqual(
    activeCardinalNeighborRegions("cedar-vale").map((region) => region.id),
    ["city-center", "cypress-reach"],
  );
  assert.deepEqual(
    activeCardinalNeighborRegions("northstar-range").map((region) => region.id),
    ["city-center"],
  );
  assert.deepEqual(
    activeCardinalNeighborRegions("copper-mesa").map((region) => region.id),
    ["city-center", "cypress-reach"],
  );
  assert.deepEqual(
    activeCardinalNeighborRegions("cypress-reach").map((region) => region.id),
    ["cedar-vale", "copper-mesa"],
  );
});

test("playable containment activates southeast and west without inventing northeast or southwest regions", () => {
  assert.equal(containingRegionForPosition(791, 0)?.id, "city-center");
  assert.equal(containingRegionForPosition(793, 0)?.id, "cedar-vale");
  assert.equal(isPlayablePoint(2300, 0), true);
  assert.equal(isPlayablePoint(0, -2300), true);
  assert.equal(isPlayablePoint(1000, -1000), false);
  assert.equal(isPlayablePoint(0, 1000), true);
  assert.equal(containingRegionForPosition(1000, 1000)?.id, "cypress-reach");
  assert.equal(isPlayablePoint(-1000, 0), true);
  assert.deepEqual(
    clampPointToActiveRegions({ x: WORLD_MAX_X + 100, y: 0 }, 2.4),
    { x: WORLD_MAX_X - 2.4, y: 0 },
  );
  assert.deepEqual(
    clampPointToActiveRegions({ x: 0, y: WORLD_MIN_Y - 100 }, 2.4),
    { x: 0, y: WORLD_MIN_Y + 2.4 },
  );
  assert.deepEqual(
    clampPointToActiveRegions({ x: 1683, y: WORLD_MAX_Y + 100 }, 2.4),
    { x: 1683, y: WORLD_MAX_Y - 2.4 },
  );
});

test("Cedar Vale owns a deterministic residential-only lot deck and eight regional anchors", () => {
  const counts = new Map<string, number>();
  for (let blockX = 22; blockX <= 65; blockX += 1) {
    for (let blockY = -22; blockY <= 21; blockY += 1) {
      const district = districtForBlock(blockX, blockY);
      const lot = lotForBlock(blockX, blockY, district);
      assert.equal(district, "residential");
      assert.equal(lot.startsWith("vale-"), true, `${blockX},${blockY} used ${lot}`);
      counts.set(lot, (counts.get(lot) ?? 0) + 1);
    }
  }
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 1936);
  assert.ok(counts.size >= 18);
  for (const kind of [
    "vale-bungalow",
    "vale-ranch",
    "vale-duplex",
    "vale-cottages",
    "vale-rowhomes",
    "vale-garden-apartments",
    "vale-corner-flats",
    "vale-pocket-park",
    "vale-community-garden",
    "vale-recreation",
  ]) assert.ok((counts.get(kind) ?? 0) > 0, kind);
  assert.equal(CEDAR_VALE_ANCHORS.length, 8);
  assert.equal(new Set(CEDAR_VALE_ANCHORS.map((anchor) => anchor.id)).size, 8);
});

test("Northstar Range owns a deterministic mountain-only lot deck and nine regional anchors", () => {
  const counts = new Map<string, number>();
  for (let blockX = -22; blockX <= 21; blockX += 1) {
    for (let blockY = -66; blockY <= -23; blockY += 1) {
      const district = districtForBlock(blockX, blockY);
      const lot = lotForBlock(blockX, blockY, district);
      assert.equal(district, "mountain");
      assert.equal(lot.startsWith("range-"), true, `${blockX},${blockY} used ${lot}`);
      counts.set(lot, (counts.get(lot) ?? 0) + 1);
    }
  }
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 1936);
  assert.ok(counts.size >= 18);
  for (const kind of [
    "range-cabin",
    "range-a-frame",
    "range-forest-clearing",
    "range-campground",
    "range-trailhead",
    "range-main-street",
    "range-general-store",
    "range-gas-stop",
    "range-chalet",
    "range-snowfield",
  ]) assert.ok((counts.get(kind) ?? 0) > 0, kind);
  assert.equal(NORTHSTAR_RANGE_ANCHORS.length, 9);
  assert.equal(new Set(NORTHSTAR_RANGE_ANCHORS.map((anchor) => anchor.id)).size, 9);
});

test("Copper Mesa owns a deterministic desert-only lot deck and ten regional anchors", () => {
  const counts = new Map<string, number>();
  for (let blockX = -22; blockX <= 21; blockX += 1) {
    for (let blockY = 22; blockY <= 65; blockY += 1) {
      const district = districtForBlock(blockX, blockY);
      const lot = lotForBlock(blockX, blockY, district);
      assert.equal(district, "desert");
      assert.equal(lot.startsWith("mesa-"), true, `${blockX},${blockY} used ${lot}`);
      counts.set(lot, (counts.get(lot) ?? 0) + 1);
    }
  }
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 1936);
  assert.ok(counts.size >= 19);
  for (const kind of [
    "mesa-adobe-home",
    "mesa-courtyard-home",
    "mesa-desert-ranch",
    "mesa-trailer-court",
    "mesa-saguaro-scrub",
    "mesa-dry-wash",
    "mesa-redrock-shelf",
    "mesa-main-street",
    "mesa-gas-stop",
    "mesa-motor-court",
  ]) assert.ok((counts.get(kind) ?? 0) > 0, kind);
  assert.equal(COPPER_MESA_ANCHORS.length, 10);
  assert.equal(new Set(COPPER_MESA_ANCHORS.map((anchor) => anchor.id)).size, 10);
});

test("Palm Reach owns a deterministic peninsula lot deck and ten regional anchors", () => {
  const counts = new Map<string, number>();
  for (let blockX = 22; blockX <= 65; blockX += 1) {
    for (let blockY = 22; blockY <= 93; blockY += 1) {
      const district = districtForBlock(blockX, blockY);
      const lot = lotForBlock(blockX, blockY, district);
      assert.equal(district, "wetland");
      assert.equal(lot.startsWith("reach-"), true, `${blockX},${blockY} used ${lot}`);
      counts.set(lot, (counts.get(lot) ?? 0) + 1);
    }
  }
  assert.equal([...counts.values()].reduce((sum, count) => sum + count, 0), 3168);
  assert.ok(counts.size >= 20);
  for (const kind of [
    "reach-deco-hotel", "reach-corner-cafe", "reach-condo", "reach-courtyard",
    "reach-record-shop", "reach-pool-court", "reach-beach", "reach-promenade",
    "reach-palm-hammock", "reach-ocean", "reach-gas-stop", "reach-motel",
  ]) assert.ok((counts.get(kind) ?? 0) > 0, kind);
  assert.equal(CYPRESS_REACH_ANCHORS.length, 10);
  assert.equal(new Set(CYPRESS_REACH_ANCHORS.map((anchor) => anchor.id)).size, 10);
});

test("all 803 chunks and every live regional window stay inside hard budgets", () => {
  const stream = new CityStream();
  let maxBoxes = 0;
  let maxColliders = 0;
  let maxInteractions = 0;
  for (const [cx, cy] of activeChunkCoordinates()) {
    const chunk = generateCityChunk(cx, cy);
    assert.ok(chunk.boxes.length <= MAX_CHUNK_BOXES, chunk.key);
    assert.ok(chunk.colliders.length <= MAX_CHUNK_COLLIDERS, chunk.key);
    assert.ok(chunk.interactions.length <= MAX_CHUNK_INTERACTIONS, chunk.key);
    const world = stream.update(cx * CHUNK_SIZE, cy * CHUNK_SIZE, 3);
    maxBoxes = Math.max(maxBoxes, world.boxes.length);
    maxColliders = Math.max(maxColliders, world.colliders.length);
    maxInteractions = Math.max(maxInteractions, world.interactions.length);
  }
  assert.ok(maxBoxes <= MAX_STREAM_BOXES);
  assert.ok(maxColliders <= MAX_STREAM_COLLIDERS);
  assert.ok(maxInteractions <= MAX_STREAM_INTERACTIONS);
});

test("seam roads have one owner and Northstar ends in wilderness at its northern edge", () => {
  const center = generateCityChunk(5, 0);
  const gateway = generateCityChunk(6, 0);
  const far = generateCityChunk(16, 0);
  const verticalRoadsAt = (chunk: ReturnType<typeof generateCityChunk>, x: number) => (
    chunk.boxes.filter((box) => (
      Math.abs(box.x - x) < 1e-8
      && Math.abs(box.sx - 12) < 1e-8
      && Math.abs(box.sy - ROAD_SPACING) < 1e-8
    )).length
  );
  assert.equal(verticalRoadsAt(center, 792), 4);
  assert.equal(verticalRoadsAt(gateway, 792), 0);
  assert.equal(verticalRoadsAt(far, WORLD_ROAD_MAX_X), 4);

  const cityNorth = generateCityChunk(0, -5);
  const northGateway = generateCityChunk(0, -6);
  const farNorth = generateCityChunk(0, -16);
  const horizontalRoadsAt = (chunk: ReturnType<typeof generateCityChunk>, y: number) => (
    chunk.boxes.filter((box) => (
      Math.abs(box.y - y) < 1e-8
      && Math.abs(box.sx - ROAD_SPACING) < 1e-8
      && Math.abs(box.sy - 12) < 1e-8
    )).length
  );
  assert.equal(horizontalRoadsAt(cityNorth, -792), 4);
  assert.equal(horizontalRoadsAt(northGateway, -792), 0);
  assert.equal(horizontalRoadsAt(farNorth, WORLD_ROAD_MIN_Y), 0);
  assert.ok(farNorth.surfaces?.some((surface) => surface.kind === "terrain"));

  const citySouth = generateCityChunk(0, 5);
  const southGateway = generateCityChunk(0, 6);
  const farSouth = generateCityChunk(0, 16);
  assert.equal(horizontalRoadsAt(citySouth, 792), 4);
  assert.equal(horizontalRoadsAt(southGateway, 792), 0);
  assert.equal(horizontalRoadsAt(farSouth, WORLD_ROAD_MAX_Y), 0);
  assert.ok(farSouth.surfaces?.some((surface) => surface.kind === "terrain"));
});

test("deep regional roads route through the city while the inactive northeast cell stays blank", () => {
  assert.equal(isRoadSurface({ x: 2196, y: 0 }), true);
  assert.equal(isRoadSurface({ x: -36, y: -2124 }), true);
  assert.equal(isRoadSurface({ x: 1008, y: -1008 }), false);
  const plan = buildNavigationPlan({ x: 0, y: 0 }, { x: 2300, y: 50 }, 0);
  assert.deepEqual(plan.route[0], { x: 0, y: 0 });
  assert.deepEqual(plan.route.at(-1), { x: 2300, y: 50 });
  assert.equal(plan.requiresUTurn, false);
  assert.ok(plan.route.some((point) => point.x >= 792));
  assert.ok(plan.route.every((point) => isPlayablePoint(point.x, point.y)));

  const crossRange = buildNavigationPlan({ x: 2250, y: 0 }, { x: 0, y: -2200 }, Math.PI);
  assert.ok(crossRange.route.some((point) => point.x < 792 && point.y > -792));
  for (let index = 1; index < crossRange.route.length; index += 1) {
    const a = crossRange.route[index - 1];
    const b = crossRange.route[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const samples = Math.max(1, Math.ceil(length / 3));
    for (let sample = 0; sample <= samples; sample += 1) {
      const t = sample / samples;
      assert.equal(isPlayablePoint(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t), true);
    }
  }
});

test("Cedar portals and moving sidewalk residents remain collision-clear", () => {
  let portals = 0;
  const chunkCache = new Map<string, ReturnType<typeof generateCityChunk>>();
  const chunkForBlock = (blockX: number, blockY: number) => {
    const cx = Math.floor((blockX + 2) / 4);
    const cy = Math.floor((blockY + 2) / 4);
    const key = `${cx},${cy}`;
    let chunk = chunkCache.get(key);
    if (!chunk) {
      chunk = generateCityChunk(cx, cy);
      chunkCache.set(key, chunk);
    }
    return chunk;
  };
  for (let blockX = 22; blockX <= 65; blockX += 1) {
    for (let blockY = -22; blockY <= 21; blockY += 1) {
      const chunk = chunkForBlock(blockX, blockY);
      const world: WorldView = {
        key: `cedar:${chunk.key}`,
        boxes: chunk.boxes,
        colliders: chunk.colliders,
        chunks: [chunk],
        interactions: chunk.interactions,
      };
      for (const portal of chunk.interactions.filter((interaction) => (
        interaction.id.startsWith(`venue:${blockX}:${blockY}:`)
      ))) {
        portals += 1;
        assert.equal(Boolean(circleHitsBuilding(world, portal.x, portal.y, 0.44)), false, portal.id);
        const returnPose = {
          x: portal.x + Math.cos(portal.heading) * 1.15,
          y: portal.y + Math.sin(portal.heading) * 1.15,
        };
        assert.equal(Boolean(circleHitsBuilding(world, returnPose.x, returnPose.y, 0.44)), false, portal.id);
      }
      for (const seconds of [0, 10, 20]) {
        for (let pedestrian = 0; pedestrian < 6; pedestrian += 1) {
          const point = ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrian);
          if (!point) continue;
          assert.equal(Boolean(circleHitsBuilding(world, point.x, point.y, 0.44)), false, `${blockX},${blockY}`);
        }
      }
    }
  }
  assert.ok(portals > 250 && portals < 500, "generous suburban parcels retain hundreds of enterable homes");
});

test("Northstar portals, return poses, and sparse ambient walkers remain collision-clear", () => {
  let portals = 0;
  let pedestrianSamples = 0;
  const anchorLabels = new Set<string>();
  const chunkCache = new Map<string, ReturnType<typeof generateCityChunk>>();
  const chunkForBlock = (blockX: number, blockY: number) => {
    const cx = Math.floor((blockX + 2) / 4);
    const cy = Math.floor((blockY + 2) / 4);
    const key = `${cx},${cy}`;
    let chunk = chunkCache.get(key);
    if (!chunk) {
      chunk = generateCityChunk(cx, cy);
      chunkCache.set(key, chunk);
    }
    return chunk;
  };

  for (let blockX = -22; blockX <= 21; blockX += 1) {
    for (let blockY = -66; blockY <= -23; blockY += 1) {
      const chunk = chunkForBlock(blockX, blockY);
      const world: WorldView = {
        key: `northstar:${chunk.key}`,
        boxes: chunk.boxes,
        colliders: chunk.colliders,
        chunks: [chunk],
        interactions: chunk.interactions,
      };
      for (const portal of chunk.interactions.filter((interaction) => (
        interaction.id.startsWith(`venue:${blockX}:${blockY}:`)
      ))) {
        portals += 1;
        anchorLabels.add(portal.venue.label);
        assert.equal(Boolean(circleHitsBuilding(world, portal.x, portal.y, 0.44)), false, portal.id);
        const returnPose = {
          x: portal.x + Math.cos(portal.heading) * 1.15,
          y: portal.y + Math.sin(portal.heading) * 1.15,
        };
        assert.equal(Boolean(circleHitsBuilding(world, returnPose.x, returnPose.y, 0.44)), false, portal.id);
      }
      for (const seconds of [0, 7, 19, 41]) {
        for (let pedestrian = 0; pedestrian < 6; pedestrian += 1) {
          const point = ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrian);
          if (!point) continue;
          pedestrianSamples += 1;
          assert.equal(Boolean(circleHitsBuilding(world, point.x, point.y, 0.44)), false, `${blockX},${blockY}`);
        }
      }
    }
  }

  assert.ok(portals > NORTHSTAR_RANGE_ANCHORS.length);
  assert.ok(pedestrianSamples > 0);
  for (const anchor of NORTHSTAR_RANGE_ANCHORS) {
    assert.equal(anchorLabels.has(anchor.label), true, `${anchor.label} has no working portal`);
  }
});

test("Mirror Lake publishes a substantial water surface with matching solid collision", () => {
  const waterIds = new Set<string>();
  for (let cx = -5; cx <= 5; cx += 1) {
    for (let cy = -16; cy <= -6; cy += 1) {
      const chunk = generateCityChunk(cx, cy);
      for (const surface of chunk.surfaceRegions.filter((region) => (
        region.id.startsWith("mirror-water:")
      ))) {
        waterIds.add(surface.id);
        assert.equal(surface.kind, "water");
        assert.equal(containingRegionForPosition(surface.x, surface.y)?.id, "northstar-range");
        const collider = chunk.colliders.find((candidate) => candidate.id === surface.id);
        assert.ok(collider, `${surface.id} lacks solid collision`);
        assert.ok(collider!.halfX >= surface.halfX);
        assert.ok(collider!.halfY >= surface.halfY);
      }
    }
  }
  assert.ok(waterIds.size >= 12, `Mirror Lake only generated ${waterIds.size} water tiles`);
});
