import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCKS_PER_CHUNK,
  CHUNK_MAX,
  CHUNK_MIN,
  CITY_BLOCK_MAX,
  CITY_BLOCK_MIN,
  ROAD_SPACING,
} from "../../game/config";
import {
  CITY_LANDMARKS,
  FEATURED_CITY_LANDMARKS,
  landmarkBlocks,
  landmarkInterruptsGrid,
  landmarkTileForBlock,
} from "../../game/landmarks";
import {
  WORLD_CAMPUSES,
  campusBlocksGridStreetSegment,
  routeUsesCampusStreetClosure,
} from "../../game/campuses";
import { CEDAR_VALE_ANCHORS } from "../../game/residential";
import { buildGpsRoute } from "../../game/route-geometry";
import { buildNavigationPlan } from "../../game/navigation";
import { gridStreetPointEnabled } from "../../game/road-topology";
import { isRoadSurface, specialRoadIntersectsSquare } from "../../game/road-network";
import type { WorldInteraction } from "../../game/model";
import { districtForBlock, generateCityChunk, lotForBlock } from "../../game/world";

type VenueEntrance = Extract<WorldInteraction, { kind: "venue-entrance" }>;

const FEATURED_LABELS = [
  "PULSE STADIUM",
  "SKYPORT INTERNATIONAL",
  "NOVA MEGAMALL",
  "NEON TITAN PLAZA",
  "DEEP BLUE AQUARIUM",
  "NEON GENERAL HOSPITAL",
  "APEX UNIVERSITY",
  "VOLT EXPO CENTER",
  "STARFALL OBSERVATORY",
  "LUCKY 88 CASINO",
] as const;

function chunkForBlock(block: number) {
  return Math.max(
    CHUNK_MIN,
    Math.min(CHUNK_MAX, Math.floor((block + BLOCKS_PER_CHUNK / 2) / BLOCKS_PER_CHUNK)),
  );
}

test("the city exposes exactly ten unique featured landmark campuses", () => {
  assert.equal(FEATURED_CITY_LANDMARKS.length, 10);
  assert.deepEqual(FEATURED_CITY_LANDMARKS.map((landmark) => landmark.label), FEATURED_LABELS);
  assert.equal(new Set(FEATURED_CITY_LANDMARKS.map((landmark) => landmark.id)).size, 10);
  assert.equal(new Set(FEATURED_CITY_LANDMARKS.map((landmark) => landmark.label)).size, 10);
  assert.ok(FEATURED_CITY_LANDMARKS.every((landmark) => landmark.width * landmark.height > 1));
  assert.equal(CITY_LANDMARKS.length, 16);
  assert.deepEqual(
    FEATURED_CITY_LANDMARKS.filter(landmarkInterruptsGrid).map((landmark) => (
      [landmark.id, landmark.width, landmark.height]
    )),
    [["pulse-stadium", 3, 2], ["skyport-airport", 3, 2], ["nova-megamall", 2, 2], ["neon-titan", 1, 2],
      ["deep-blue-aquarium", 2, 2], ["neon-general", 2, 2], ["apex-university", 2, 2], ["volt-expo", 3, 1],
      ["starfall-observatory", 2, 1], ["lucky-88-casino", 2, 2]],
  );
  const school = CEDAR_VALE_ANCHORS.find((anchor) => anchor.id === "bellwether-school");
  assert.deepEqual(school && [school.width, school.height], [3, 2]);
});

test("landmark footprints are non-overlapping, in bounds, and clear of authored corridors", () => {
  const occupied = new Map<string, string>();
  let crossesChunkBoundary = false;

  for (const landmark of CITY_LANDMARKS) {
    const footprintChunks = new Set<string>();
    for (const { blockX, blockY } of landmarkBlocks(landmark)) {
      const key = `${blockX},${blockY}`;
      assert.equal(occupied.has(key), false, `${landmark.id} overlaps ${occupied.get(key)} at ${key}`);
      occupied.set(key, landmark.id);
      assert.ok(blockX >= CITY_BLOCK_MIN && blockX <= CITY_BLOCK_MAX, `${landmark.id} x bounds`);
      assert.ok(blockY >= CITY_BLOCK_MIN && blockY <= CITY_BLOCK_MAX, `${landmark.id} y bounds`);
      assert.equal(
        specialRoadIntersectsSquare(
          {
            x: blockX * ROAD_SPACING + ROAD_SPACING / 2,
            y: blockY * ROAD_SPACING + ROAD_SPACING / 2,
          },
          12,
          1.5,
        ),
        false,
        `${landmark.id} intersects an authored road at ${key}`,
      );
      const resolved = landmarkTileForBlock(blockX, blockY);
      assert.equal(resolved?.definition.id, landmark.id);
      assert.equal(lotForBlock(blockX, blockY, districtForBlock(blockX, blockY)), "landmark");
      footprintChunks.add(`${chunkForBlock(blockX)},${chunkForBlock(blockY)}`);
    }
    crossesChunkBoundary ||= footprintChunks.size > 1;
  }

  assert.equal(occupied.size, 45);
  assert.equal(crossesChunkBoundary, true);
  assert.equal(landmarkTileForBlock(0, 0), null, "NEON LOFTS home block must remain reserved");
  assert.equal(landmarkTileForBlock(-1, -1), null, "opening fare block must remain reserved");
});

test("flagship campuses replace only their internal grid streets", () => {
  assert.deepEqual(WORLD_CAMPUSES.map((campus) => campus.id), [
    "pulse-stadium", "skyport-airport", "nova-megamall", "neon-titan", "deep-blue-aquarium",
    "neon-general", "apex-university", "volt-expo", "starfall-observatory", "lucky-88-casino",
    "maple-commons",
    "bellwether-school",
    "cedar-library",
    "brookside-rec",
    "moonbeam-drive-in",
    "northstar-village-square",
    "timberline-lodge",
    "old-spruce-mill",
    "mirror-lake",
    "silver-run-resort",
    "aurora-lookout",
    "copper-junction",
    "coyote-motor-court",
    "desert-bloom-resort",
    "dustwind-airpark",
    "ocotillo-arts",
    "sunstone-solar",
    "saguaro-rodeo",
    "painted-canyon",
    "lantern-bay-market",
    "bayou-belle",
    "stormwall-locks",
    "cypress-crown",
    "gulfwatch-station",
    "moonwater-marina",
    "sunkissed-motel",
    "blackwater-shipyard",
    "saint-lumina",
    "solana-pier",
    "mission-plaza",
    "tidal-aquarium",
    "pacific-club",
    "mariposa-studio",
    "citrus-house",
    "surf-pavilion",
    "sunset-bowl",
  ]);
  for (const campus of WORLD_CAMPUSES) {
    let closedSegments = 0;
    for (let tileX = 1; tileX < campus.width; tileX += 1) {
      const x = (campus.originX + tileX) * ROAD_SPACING;
      for (let tileY = 0; tileY < campus.height; tileY += 1) {
        const y = (campus.originY + tileY) * ROAD_SPACING;
        assert.equal(campusBlocksGridStreetSegment({ x, y }, { x, y: y + ROAD_SPACING }), true);
        closedSegments += 1;
      }
    }
    for (let tileY = 1; tileY < campus.height; tileY += 1) {
      const y = (campus.originY + tileY) * ROAD_SPACING;
      for (let tileX = 0; tileX < campus.width; tileX += 1) {
        const x = (campus.originX + tileX) * ROAD_SPACING;
        assert.equal(campusBlocksGridStreetSegment({ x, y }, { x: x + ROAD_SPACING, y }), true);
        closedSegments += 1;
      }
    }
    assert.equal(closedSegments, campus.width * (campus.height - 1) + campus.height * (campus.width - 1));
    const start = { x: (campus.originX - 1) * ROAD_SPACING, y: (campus.originY + 0.5) * ROAD_SPACING };
    const target = { x: (campus.originX + campus.width + 1) * ROAD_SPACING, y: start.y };
    assert.equal(routeUsesCampusStreetClosure(buildGpsRoute(start, target)), false, campus.id);
    const verticalX = (campus.originX + 1) * ROAD_SPACING;
    const verticalPlan = buildNavigationPlan(
      { x: verticalX, y: (campus.originY - 1) * ROAD_SPACING },
      { x: verticalX, y: (campus.originY + campus.height + 1) * ROAD_SPACING },
      Math.PI / 2,
    );
    assert.equal(routeUsesCampusStreetClosure(verticalPlan.route), false, `${campus.id} vertical route`);
    const horizontalY = (campus.originY + 1) * ROAD_SPACING;
    const horizontalPlan = buildNavigationPlan(
      { x: (campus.originX - 1) * ROAD_SPACING + 9, y: horizontalY },
      { x: (campus.originX + campus.width + 1) * ROAD_SPACING - 9, y: horizontalY },
      0,
    );
    assert.equal(routeUsesCampusStreetClosure(horizontalPlan.route), false, `${campus.id} horizontal route`);
    if (campus.width > 1) {
      assert.equal(gridStreetPointEnabled({ x: verticalX, y: (campus.originY + 0.5) * ROAD_SPACING }, "vertical"), false);
    }
    if (campus.height > 1) {
      assert.equal(gridStreetPointEnabled({ x: (campus.originX + 0.5) * ROAD_SPACING, y: horizontalY }, "horizontal"), false);
    }
    if (campus.source !== "mountain" && campus.source !== "desert" && campus.source !== "wetland" && campus.source !== "coastal") {
      assert.equal(isRoadSurface({ x: campus.originX * ROAD_SPACING, y: (campus.originY + 0.5) * ROAD_SPACING }), true);
      assert.equal(isRoadSurface({ x: (campus.originX + 0.5) * ROAD_SPACING, y: campus.originY * ROAD_SPACING }), true);
    }
  }
});

test("each featured landmark publishes one stable exterior entrance", () => {
  const entrances: VenueEntrance[] = [];
  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      entrances.push(...generateCityChunk(cx, cy).interactions.filter((interaction) => (
        interaction.kind === "venue-entrance"
      )));
    }
  }

  for (const landmark of FEATURED_CITY_LANDMARKS) {
    const matches = entrances.filter((entrance) => entrance.label === landmark.label);
    assert.equal(matches.length, 1, `${landmark.id} entrance count`);
    const blockX = landmark.originX + landmark.portal.tileX;
    const blockY = landmark.originY + landmark.portal.tileY;
    assert.equal(matches[0].id, `venue:${blockX}:${blockY}:${landmark.portal.suffix}`);
    assert.equal(matches[0].venue.kind, landmark.portal.kind);
  }
});

test("landmark water is semantic and physically impassable", () => {
  let landmarkWater = 0;
  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const chunk = generateCityChunk(cx, cy);
      for (const region of chunk.surfaceRegions) {
        const blockX = Math.floor(region.x / ROAD_SPACING);
        const blockY = Math.floor(region.y / ROAD_SPACING);
        if (!landmarkTileForBlock(blockX, blockY)) continue;
        landmarkWater += 1;
        assert.equal(
          chunk.colliders.some((collider) => (
            Math.abs(collider.x - region.x) < 0.01
            && Math.abs(collider.y - region.y) < 0.01
            && collider.halfX >= region.halfX
            && collider.halfY >= region.halfY
          )),
          true,
          `${region.id} lacks a solid footprint`,
        );
      }
    }
  }
  assert.ok(landmarkWater >= 3);
});
