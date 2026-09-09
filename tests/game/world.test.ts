import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  BLOCKS_PER_CHUNK,
  CHUNK_MAX,
  CHUNK_MIN,
  CHUNK_SIZE,
  FARE_DROPOFF_RADIUS,
  FARE_PICKUP_RADIUS,
  MAX_CHUNK_BOXES,
  MAX_CHUNK_COLLIDERS,
  MAX_CHUNK_INTERACTIONS,
  MAX_STREAM_BOXES,
  MAX_STREAM_COLLIDERS,
  MAX_STREAM_INTERACTIONS,
  GENERIC_LOT_CONTENT_SCALE,
  ROAD_HALF,
  ROAD_SPACING,
} from "../../game/config";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { analyzeFareStopPlacement } from "../../game/fare-placement";
import { createFareJobs } from "../../game/fare-market";
import { CITY_LANDMARKS, landmarkBlocks } from "../../game/landmarks";
import type { WorldView } from "../../game/model";
import { farePassengerPoint } from "../../game/render/scene";
import { ROUNDABOUTS, SPECIAL_ROADS } from "../../game/road-layout";
import {
  isRoadSurface,
  nearestSpecialRoadProjection,
  specialRoadIntersectsSquare,
} from "../../game/road-network";
import { isPlayablePoint } from "../../game/regions";
import {
  CityStream,
  districtForBlock,
  generateCityChunk,
  lotForBlock,
  lotOrientationForBlock,
} from "../../game/world";

test("every deterministic city chunk stays inside its rendering budgets", () => {
  let totalBoxes = 0;
  let totalColliders = 0;
  let maxBoxes = { count: 0, at: "" };
  let maxColliders = { count: 0, at: "" };

  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const chunk = generateCityChunk(cx, cy);
      assert.ok(chunk.boxes.length <= MAX_CHUNK_BOXES);
      assert.ok(chunk.colliders.length <= MAX_CHUNK_COLLIDERS);
      assert.ok(chunk.interactions.length <= MAX_CHUNK_INTERACTIONS);
      totalBoxes += chunk.boxes.length;
      totalColliders += chunk.colliders.length;
      if (chunk.boxes.length > maxBoxes.count) maxBoxes = { count: chunk.boxes.length, at: `${cx},${cy}` };
      if (chunk.colliders.length > maxColliders.count) maxColliders = { count: chunk.colliders.length, at: `${cx},${cy}` };
    }
  }

  assert.deepEqual(maxBoxes, { count: 738, at: "0,5" });
  assert.deepEqual(maxColliders, { count: 134, at: "4,-2" });
  // Adaptive road surfaces, elevated decks, supports and clear ramp corridors.
  assert.equal(totalBoxes, 71092);
  assert.equal(totalColliders, 8581);
});

test("representative chunk output is byte-for-byte deterministic", () => {
  const chunk = generateCityChunk(0, 0);
  const hash = createHash("sha256").update(JSON.stringify(chunk)).digest("hex");
  assert.equal(hash, "6fd1ebe846dc6fef192b0cfb27429755511b3be2d9a8f795d2839d3149de2537");
});

test("ordinary lot contents leave the same widened sidewalk ring in every orientation", () => {
  assert.equal(GENERIC_LOT_CONTENT_SCALE, 0.88);
  const landmarkBlockKeys = new Set(
    CITY_LANDMARKS.flatMap(landmarkBlocks).map(({ blockX, blockY }) => `${blockX},${blockY}`),
  );
  const minimumClearanceByOrientation = [Infinity, Infinity, Infinity, Infinity];
  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      for (const collider of generateCityChunk(cx, cy).colliders) {
        if (collider.id.startsWith("roundabout-island-") || collider.id.startsWith("road-")) continue;
        const blockX = Math.floor(collider.x / ROAD_SPACING);
        const blockY = Math.floor(collider.y / ROAD_SPACING);
        if (landmarkBlockKeys.has(`${blockX},${blockY}`)) continue;
        const centerX = blockX * ROAD_SPACING + ROAD_SPACING / 2;
        const centerY = blockY * ROAD_SPACING + ROAD_SPACING / 2;
        const clearance = Math.min(
          ROAD_SPACING / 2 - ROAD_HALF - Math.abs(collider.x - centerX) - collider.halfX,
          ROAD_SPACING / 2 - ROAD_HALF - Math.abs(collider.y - centerY) - collider.halfY,
        );
        const orientation = lotOrientationForBlock(blockX, blockY);
        minimumClearanceByOrientation[orientation] = Math.min(
          minimumClearanceByOrientation[orientation],
          clearance,
        );
      }
    }
  }
  assert.ok(minimumClearanceByOrientation.every((clearance) => clearance > 1.55));
  assert.ok(Math.max(...minimumClearanceByOrientation) - Math.min(...minimumClearanceByOrientation) < 1e-9);
});

test("store portals and their return poses are stable and clear in every lot orientation", () => {
  const ids = new Set<string>();
  const headings = new Set<number>();
  let portalCount = 0;
  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const chunk = generateCityChunk(cx, cy);
      const chunkWorld: WorldView = {
        key: `portal-test:${cx}:${cy}`,
        boxes: chunk.boxes,
        colliders: chunk.colliders,
        chunks: [chunk],
        interactions: chunk.interactions,
      };
      for (const portal of chunk.interactions) {
        portalCount += 1;
        assert.equal(ids.has(portal.id), false, `duplicate portal ${portal.id}`);
        ids.add(portal.id);
        assert.ok(Number.isFinite(portal.x) && Number.isFinite(portal.y) && Number.isFinite(portal.heading));
        assert.ok(portal.venue);
        headings.add(Math.round(((portal.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 1000));
        assert.equal(Boolean(circleHitsBuilding(chunkWorld, portal.x, portal.y, 0.44)), false, `${portal.id} entrance is blocked`);
        const returnX = portal.x + Math.cos(portal.heading) * 1.15;
        const returnY = portal.y + Math.sin(portal.heading) * 1.15;
        assert.equal(Boolean(circleHitsBuilding(chunkWorld, returnX, returnY, 0.44)), false, `${portal.id} return pose is blocked`);
      }
    }
  }
  assert.equal(portalCount, 1469);
  assert.equal(headings.size, 4);
  const home = generateCityChunk(0, 0).interactions.find((portal) => portal.id === "venue:0:0:home");
  assert.deepEqual(home?.venue, { id: "venue:0:0:home", kind: "home", label: "NEON LOFTS" });
});

test("streaming changes draw radius without expanding collision radius", () => {
  const stream = new CityStream();
  const near = stream.update(0, 0, 1);
  assert.deepEqual(
    { chunks: near.chunks.length, boxes: near.boxes.length, surfaces: near.surfaces?.length, colliders: near.colliders.length },
    { chunks: 9, boxes: 4491, surfaces: 702, colliders: 353 },
  );

  const distant = stream.update(0, 0, 3);
  assert.deepEqual(
    { chunks: distant.chunks.length, boxes: distant.boxes.length, surfaces: distant.surfaces?.length, colliders: distant.colliders.length },
    { chunks: 49, boxes: 27762, surfaces: 3532, colliders: 353 },
  );
  assert.ok(distant.boxes.length <= MAX_STREAM_BOXES);
  assert.ok(distant.colliders.length <= MAX_STREAM_COLLIDERS);
  assert.deepEqual(distant.colliders, near.colliders);
});

test("every city center preserves collision radius and worst-case stream budgets", () => {
  const stream = new CityStream();
  let maxNearBoxes = { count: 0, at: "" };
  let maxFarBoxes = { count: 0, at: "" };
  let maxColliders = { count: 0, at: "" };

  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const x = cx * CHUNK_SIZE;
      const y = cy * CHUNK_SIZE;
      const at = `${cx},${cy}`;
      const near = stream.update(x, y, 1);
      if (near.boxes.length > maxNearBoxes.count) maxNearBoxes = { count: near.boxes.length, at };

      const distant = stream.update(x, y, 3);
      if (distant.boxes.length > maxFarBoxes.count) maxFarBoxes = { count: distant.boxes.length, at };
      if (distant.colliders.length > maxColliders.count) maxColliders = { count: distant.colliders.length, at };
      assert.deepEqual(distant.colliders, near.colliders);
      assert.ok(distant.boxes.length <= MAX_STREAM_BOXES);
      assert.ok(distant.colliders.length <= MAX_STREAM_COLLIDERS);
      assert.ok(distant.interactions.length <= MAX_STREAM_INTERACTIONS);
    }
  }

  assert.deepEqual(maxNearBoxes, { count: 5757, at: "-4,0" });
  assert.deepEqual(maxFarBoxes, { count: 28967, at: "-2,2" });
  assert.deepEqual(maxColliders, { count: 888, at: "-3,-4" });
});

test("the expanded lot catalog appears throughout the world with four orientations", () => {
  const counts: Record<string, number> = {};
  const orientations = [0, 0, 0, 0];
  const minBlock = CHUNK_MIN * BLOCKS_PER_CHUNK - 2;
  const maxBlock = CHUNK_MAX * BLOCKS_PER_CHUNK + 1;

  for (let blockX = minBlock; blockX <= maxBlock; blockX += 1) {
    for (let blockY = minBlock; blockY <= maxBlock; blockY += 1) {
      const lot = lotForBlock(blockX, blockY, districtForBlock(blockX, blockY));
      counts[lot] = (counts[lot] ?? 0) + 1;
      orientations[lotOrientationForBlock(blockX, blockY)] += 1;
    }
  }

  assert.deepEqual(counts, {
    carwash: 91,
    diner: 166,
    motel: 40,
    factory: 153,
    construction: 114,
    warehouse: 162,
    gas: 133,
    homes: 78,
    apartment: 112,
    park: 186,
    market: 45,
    civic: 94,
    plaza: 55,
    shops: 156,
    playground: 56,
    townhouses: 82,
    office: 55,
    landmark: 45,
    tower: 36,
    boardwalk: 39,
    marina: 38,
  });
  assert.deepEqual(orientations, [497, 469, 509, 461]);
});

test("all generated geometry is finite and every collider stays clear of roads", () => {
  const colliderIds = new Set<string>();
  const roadClearance = ROAD_SPACING / 2 - ROAD_HALF;
  let roundaboutIslands = 0;

  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const chunk = generateCityChunk(cx, cy);
      for (const box of chunk.boxes) {
        assert.ok([box.x, box.y, box.z, box.sx, box.sy, box.sz, box.yaw].every(Number.isFinite));
        assert.ok(box.sx > 0 && box.sy > 0 && box.sz > 0);
        assert.ok(box.color.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1));
      }
      for (const collider of chunk.colliders) {
        assert.ok(!colliderIds.has(collider.id), `duplicate collider ${collider.id}`);
        colliderIds.add(collider.id);
        assert.ok([collider.x, collider.y, collider.halfX, collider.halfY, collider.height].every(Number.isFinite));
        assert.ok(collider.halfX > 0 && collider.halfY > 0 && collider.height > 0);
        if (collider.id.startsWith("roundabout-island-")) {
          roundaboutIslands += 1;
          continue;
        }
        // Road decks, piers and rails have their own lane/height clearance tests.
        if (collider.id.startsWith("road-")) continue;
        const centerX = Math.floor(collider.x / ROAD_SPACING) * ROAD_SPACING + ROAD_SPACING / 2;
        const centerY = Math.floor(collider.y / ROAD_SPACING) * ROAD_SPACING + ROAD_SPACING / 2;
        assert.ok(Math.abs(collider.x - centerX) + collider.halfX <= roadClearance + 1e-9);
        assert.ok(Math.abs(collider.y - centerY) + collider.halfY <= roadClearance + 1e-9);

        const specialRoad = nearestSpecialRoadProjection(collider);
        assert.ok(specialRoad);
        const normalX = -Math.sin(specialRoad.tangentYaw);
        const normalY = Math.cos(specialRoad.tangentYaw);
        const colliderRadius = Math.abs(normalX) * collider.halfX + Math.abs(normalY) * collider.halfY;
        assert.ok(
          specialRoad.centerDistance - colliderRadius >= specialRoad.halfWidth + 1.5,
          `${collider.id} intrudes on ${specialRoad.roadId}`,
        );
      }
      for (const region of chunk.surfaceRegions) {
        assert.equal(region.kind, "water");
        assert.ok([region.x, region.y, region.halfX, region.halfY, region.yaw].every(Number.isFinite));
        assert.ok(region.halfX > 0 && region.halfY > 0);
      }
    }
  }
  assert.equal(roundaboutIslands, ROUNDABOUTS.length);
});

test("the authored road network is varied, continuous, driveable, and avoids landmarks", () => {
  assert.deepEqual(
    [...new Set(SPECIAL_ROADS.map((road) => road.kind))].sort(),
    ["boulevard", "highway", "parkway", "ramp", "roundabout"],
  );
  for (const road of SPECIAL_ROADS) {
    assert.ok(road.points.length >= 2, road.id);
    for (const point of road.points) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), road.id);
      assert.equal(isPlayablePoint(point.x, point.y), true, `${road.id} left the active region union`);
      assert.equal(isRoadSurface(point), true, `${road.id} point is not driveable`);
    }
    for (let index = 1; index < road.points.length; index += 1) {
      assert.ok(
        Math.hypot(
          road.points[index].x - road.points[index - 1].x,
          road.points[index].y - road.points[index - 1].y,
        ) < 24,
        `${road.id} has a visible seam`,
      );
    }
    if (road.closed) {
      assert.ok(
        Math.hypot(
          road.points[0].x - road.points[road.points.length - 1].x,
          road.points[0].y - road.points[road.points.length - 1].y,
        ) < 24,
        `${road.id} does not close cleanly`,
      );
    }
  }

  for (const landmark of CITY_LANDMARKS) {
    for (const { blockX, blockY } of landmarkBlocks(landmark)) {
      const center = {
        x: blockX * ROAD_SPACING + ROAD_SPACING / 2,
        y: blockY * ROAD_SPACING + ROAD_SPACING / 2,
      };
      assert.equal(
        specialRoadIntersectsSquare(center, 12, 1.5),
        false,
        `road crosses landmark ${landmark.id} at ${blockX},${blockY}`,
      );
    }
  }
});

test("procedural fare approaches are driveable and collision clear", () => {
  const stream = new CityStream();
  for (let seed = 0; seed < 4; seed += 1) {
    const jobs = createFareJobs(seed);
    for (const job of jobs) {
      for (const [label, zone, approach, radius] of [
        [`pickup ${job.pickupStopId}`, job.pickup, job.pickupApproach, FARE_PICKUP_RADIUS],
        [`dropoff ${job.dropoffStopId}`, job.dropoff, job.dropoffApproach, FARE_DROPOFF_RADIUS],
      ] as const) {
        const report = analyzeFareStopPlacement(zone, radius);
        assert.equal(report.safe, true, `${label} failed placement validation`);
        assert.equal(isRoadSurface(approach), true, `${label} approach is not on a road`);
        const world = stream.update(approach.x, approach.y, 1);
        assert.equal(
          Boolean(taxiHitsBuilding(world, approach.x, approach.y, report.approachHeading)),
          false,
          `${label} taxi approach is blocked`,
        );
      }
    }
  }
});

test("procedural waiting passengers stand in their clear curbside zones", () => {
  const stream = new CityStream();
  for (let seed = 0; seed < 4; seed += 1) {
    const jobs = createFareJobs(seed);
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const point = farePassengerPoint(job);
      const world = stream.update(point.x, point.y, 1);
      assert.deepEqual(point, job.pickup);
      assert.equal(isRoadSurface(point), false, `${job.pickupStopId} passenger is on a road`);
      assert.equal(
        Boolean(circleHitsBuilding(world, point.x, point.y, 0.9)),
        false,
        `${job.pickupStopId} passenger visually clips a building`,
      );
    }
  }
});
