import assert from "node:assert/strict";
import test from "node:test";

import { CHUNK_SIZE, ROAD_SPACING } from "../../game/config";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { COPPER_MESA_ANCHORS } from "../../game/desert";
import { createFareMarket } from "../../game/fare-market";
import { scheduleSixthFareTransfer } from "../../game/regional-fares";
import { buildGpsRoute } from "../../game/navigation";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { SPECIAL_ROADS } from "../../game/road-layout";
import {
  isRoadSurface,
  nearestSpecialRoadProjection,
  specialRoadIntersectsSquare,
} from "../../game/road-network";
import { gridStreetPointEnabled, routeStaysOnEnabledRoads } from "../../game/road-topology";
import {
  ACTIVE_WORLD_REGIONS,
  containingRegionForPosition,
  isPlayablePoint,
} from "../../game/regions";
import { makeGame } from "../../game/state";
import type { WorldView } from "../../game/model";
import { generateCityChunk } from "../../game/world";

const copperMesa = ACTIVE_WORLD_REGIONS.find((region) => region.id === "copper-mesa")!;
const DESERT_ROAD_IDS = [
  "sundown-highway",
  "copper-loop",
  "arroyo-road",
  "painted-canyon-drive",
] as const;

test("Copper Mesa replaces the city lattice with a connected desert road hierarchy", () => {
  assert.equal(gridStreetPointEnabled({ x: 0, y: 36 * ROAD_SPACING }, "vertical"), true);
  assert.equal(gridStreetPointEnabled({ x: 3 * ROAD_SPACING, y: 38 * ROAD_SPACING }, "vertical"), true);
  assert.equal(gridStreetPointEnabled({ x: 3 * ROAD_SPACING, y: 58 * ROAD_SPACING }, "vertical"), false);
  assert.equal(gridStreetPointEnabled({ x: 16 * ROAD_SPACING, y: 58 * ROAD_SPACING }, "vertical"), true);

  const roads = SPECIAL_ROADS.filter((road) => DESERT_ROAD_IDS.includes(road.id as typeof DESERT_ROAD_IDS[number]));
  assert.deepEqual(roads.map((road) => road.id), DESERT_ROAD_IDS);
  for (const road of roads) {
    for (const point of road.points) {
      assert.equal(isPlayablePoint(point.x, point.y), true, `${road.id} left Copper Mesa`);
      assert.equal(isRoadSurface(point), true, `${road.id} point is not paved`);
    }
  }

  const route = buildGpsRoute({ x: 0, y: 720 }, { x: 72, y: 2300 });
  assert.equal(routeStaysOnEnabledRoads(route), true);
  assert.ok(route.some((point) => point.y > 1900));
  assert.ok(route.every((point) => isPlayablePoint(point.x, point.y)));
});

test("Copper Mesa anchors publish one collision-clear portal and continuous landmark grounds", () => {
  const chunks = [];
  for (let cx = copperMesa.chunkMinX; cx <= copperMesa.chunkMaxX; cx += 1) {
    for (let cy = copperMesa.chunkMinY; cy <= copperMesa.chunkMaxY; cy += 1) {
      chunks.push(generateCityChunk(cx, cy));
    }
  }
  const world: WorldView = {
    key: "copper-mesa-anchor-sweep",
    boxes: chunks.flatMap((chunk) => chunk.boxes),
    colliders: chunks.flatMap((chunk) => chunk.colliders),
    chunks,
    interactions: chunks.flatMap((chunk) => chunk.interactions),
  };
  const portals = COPPER_MESA_ANCHORS.flatMap((anchor) => world.interactions.filter((interaction) => (
    interaction.label === anchor.label && interaction.id.endsWith(`:${anchor.portal.suffix}`)
  )));
  assert.equal(portals.length, COPPER_MESA_ANCHORS.length);
  assert.equal(new Set(portals.map((portal) => portal.label)).size, COPPER_MESA_ANCHORS.length);
  for (const portal of portals) {
    assert.equal(Boolean(circleHitsBuilding(world, portal.x, portal.y, 0.44)), false, `${portal.label} entrance`);
    const returnX = portal.x + Math.cos(portal.heading) * 1.15;
    const returnY = portal.y + Math.sin(portal.heading) * 1.15;
    assert.equal(Boolean(circleHitsBuilding(world, returnX, returnY, 0.44)), false, `${portal.label} return pose`);
  }
  for (const interaction of world.interactions) {
    assert.equal(Boolean(circleHitsBuilding(world, interaction.x, interaction.y, 0.44)), false, `${interaction.id} entrance`);
    const returnX = interaction.x + Math.cos(interaction.heading) * 1.15;
    const returnY = interaction.y + Math.sin(interaction.heading) * 1.15;
    assert.equal(Boolean(circleHitsBuilding(world, returnX, returnY, 0.44)), false, `${interaction.id} return pose`);
  }
  const paintedAnchor = COPPER_MESA_ANCHORS.find((anchor) => anchor.id === "painted-canyon")!;
  const painted = chunks.flatMap((chunk) => chunk.boxes).filter((box) => (
    box.y >= paintedAnchor.originY * ROAD_SPACING
      && box.y <= (paintedAnchor.originY + paintedAnchor.height) * ROAD_SPACING
      && box.x >= paintedAnchor.originX * ROAD_SPACING
      && box.x <= (paintedAnchor.originX + paintedAnchor.width) * ROAD_SPACING
  ));
  assert.ok(painted.some((box) => box.z > 8), "Painted Canyon should read as elevated red rock");
});

test("every Copper Mesa landmark and traffic lane stays clear of authored desert roads", () => {
  const chunks = [];
  for (let cx = copperMesa.chunkMinX; cx <= copperMesa.chunkMaxX; cx += 1) {
    for (let cy = copperMesa.chunkMinY; cy <= copperMesa.chunkMaxY; cy += 1) chunks.push(generateCityChunk(cx, cy));
  }
  const world: WorldView = {
    key: "copper-mesa-road-clearance",
    boxes: chunks.flatMap((chunk) => chunk.boxes),
    colliders: chunks.flatMap((chunk) => chunk.colliders),
    chunks,
    interactions: chunks.flatMap((chunk) => chunk.interactions),
  };

  for (const anchor of COPPER_MESA_ANCHORS) {
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

  for (const collider of world.colliders) {
    const projection = nearestSpecialRoadProjection(collider);
    assert.ok(projection);
    const normalX = -Math.sin(projection.tangentYaw);
    const normalY = Math.cos(projection.tangentYaw);
    const radius = Math.abs(normalX) * collider.halfX + Math.abs(normalY) * collider.halfY;
    assert.ok(
      projection.centerDistance - radius >= projection.halfWidth + 1.5,
      `${collider.id} intrudes on ${projection.roadId}`,
    );
  }

  for (const road of SPECIAL_ROADS.filter((candidate) => DESERT_ROAD_IDS.includes(candidate.id as typeof DESERT_ROAD_IDS[number]))) {
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

test("Copper Mesa keeps town foot traffic lively and wilderness traffic sparse", () => {
  let town = 0;
  let wilderness = 0;
  for (let seconds = 0; seconds < 20; seconds += 2) {
    for (let pedestrian = 0; pedestrian < 6; pedestrian += 1) {
      if (ambientPedestrianPointForBlock(6, 40, seconds, pedestrian)) town += 1;
      if (ambientPedestrianPointForBlock(18, 58, seconds, pedestrian)) wilderness += 1;
    }
  }
  assert.ok(town > 0);
  assert.ok(wilderness < town);
});

test("Copper Mesa fares use its local cast and fare six reaches only a cardinal neighbor", () => {
  const game = makeGame("street-ace", 0x4d455341, "free-run");
  game.fareCycle = 0;
  game.fareServiceRegionId = copperMesa.id;
  const market = createFareMarket(
    game.runSeed,
    game.fareCycle,
    [],
    copperMesa,
    game.usedFareRiderIdsByRegion,
  );
  game.fareJobs = market.jobs;
  game.usedFareRiderIdsByRegion = market.usedFareRiderIdsByRegion;
  for (const job of game.fareJobs) {
    assert.equal(containingRegionForPosition(job.pickup.x, job.pickup.y)?.id, copperMesa.id);
    assert.equal(containingRegionForPosition(job.dropoff.x, job.dropoff.y)?.id, copperMesa.id);
  }
  assert.ok(game.fareJobs.some((job) => job.passengerArtCell >= 96));

  game.availableFareMask = 1 << 5;
  const completed = game.fareJobs[0];
  game.x = completed.dropoff.x;
  game.y = completed.dropoff.y;
  const offer = scheduleSixthFareTransfer(game, completed);
  assert.ok(offer);
  assert.ok(["city-center", "cypress-reach"].includes(offer.destinationRegionId));
  assert.equal(
    containingRegionForPosition(game.fareJobs[5].dropoff.x, game.fareJobs[5].dropoff.y)?.id,
    offer.destinationRegionId,
  );
});

test("Copper Mesa contributes exactly 121 streamed chunks", () => {
  assert.equal(
    (copperMesa.chunkMaxX - copperMesa.chunkMinX + 1)
      * (copperMesa.chunkMaxY - copperMesa.chunkMinY + 1),
    121,
  );
  assert.equal(copperMesa.chunkMinY * CHUNK_SIZE - CHUNK_SIZE / 2, 792);
});
