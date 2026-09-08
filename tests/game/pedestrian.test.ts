import assert from "node:assert/strict";
import test from "node:test";

import {
  AMBIENT_PEDESTRIANS_PER_BLOCK,
  BLOCKS_PER_CHUNK,
  CHUNK_MAX,
  CHUNK_MIN,
  ROAD_SPACING,
} from "../../game/config";
import { circleHitsBuilding } from "../../game/collision";
import {
  ambientPeopleBoxes,
  ambientPedestrianPointForBlock,
  isPedestrianBlockWalkable,
} from "../../game/render/scene";
import { landmarkTileForBlock } from "../../game/landmarks";
import { campusTileForBlock } from "../../game/campuses";
import { makeGame } from "../../game/state";
import type { WorldView } from "../../game/model";
import { generateCityChunk } from "../../game/world";
import {
  isRoadSurface,
  specialRoadIntersectsSquare,
} from "../../game/road-network";

test("ambient pedestrians stay on real sidewalks and out of special-road corridors", () => {
  const minBlock = CHUNK_MIN * BLOCKS_PER_CHUNK - 2;
  const maxBlock = CHUNK_MAX * BLOCKS_PER_CHUNK + 1;
  const samples = [0, 3.5, 17.25, 61.75, 180.5];
  let corridorBlocks = 0;
  let pedestrianSamples = 0;

  for (let blockX = minBlock; blockX <= maxBlock; blockX += 1) {
    for (let blockY = minBlock; blockY <= maxBlock; blockY += 1) {
      const center = {
        x: blockX * ROAD_SPACING + ROAD_SPACING / 2,
        y: blockY * ROAD_SPACING + ROAD_SPACING / 2,
      };
      const corridor = specialRoadIntersectsSquare(center, 12, 1.5);
      const landmark = Boolean(landmarkTileForBlock(blockX, blockY));
      const campus = Boolean(campusTileForBlock(blockX, blockY));
      const chunk = generateCityChunk(
        Math.max(CHUNK_MIN, Math.min(CHUNK_MAX, Math.floor((blockX + BLOCKS_PER_CHUNK / 2) / BLOCKS_PER_CHUNK))),
        Math.max(CHUNK_MIN, Math.min(CHUNK_MAX, Math.floor((blockY + BLOCKS_PER_CHUNK / 2) / BLOCKS_PER_CHUNK))),
      );
      const world: WorldView = {
        key: `pedestrian:${blockX}:${blockY}`,
        boxes: chunk.boxes,
        colliders: chunk.colliders,
        chunks: [chunk],
        interactions: chunk.interactions,
      };
      assert.equal(isPedestrianBlockWalkable(blockX, blockY), !corridor && !landmark && !campus);
      if (corridor) corridorBlocks += 1;

      for (const seconds of samples) {
        for (let pedestrianIndex = 0; pedestrianIndex < AMBIENT_PEDESTRIANS_PER_BLOCK; pedestrianIndex += 1) {
          const point = ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrianIndex);
          if (corridor || landmark || campus) {
            assert.equal(point, null, `walker spawned in reserved block ${blockX},${blockY}`);
            continue;
          }
          if (!point) continue;
          pedestrianSamples += 1;
          assert.equal(
            isRoadSurface(point, 0.45),
            false,
            `walker entered a road at ${point.x.toFixed(2)},${point.y.toFixed(2)}`,
          );
          assert.equal(
            Boolean(circleHitsBuilding(world, point.x, point.y, 0.44)),
            false,
            `walker clipped lot geometry at ${point.x.toFixed(2)},${point.y.toFixed(2)}`,
          );
        }
      }
    }
  }

  assert.ok(corridorBlocks > 0, "fixture must include highway and special-road corridors");
  assert.ok(pedestrianSamples > 1000, "ordinary sidewalk activity should remain populated");
});

test("safe-block pedestrians keep walking after corridor filtering", () => {
  const blockX = -4;
  const blockY = -1;
  assert.equal(isPedestrianBlockWalkable(blockX, blockY), true);
  for (let pedestrianIndex = 0; pedestrianIndex < AMBIENT_PEDESTRIANS_PER_BLOCK; pedestrianIndex += 1) {
    const start = ambientPedestrianPointForBlock(blockX, blockY, 0, pedestrianIndex);
    const next = ambientPedestrianPointForBlock(blockX, blockY, 0.25, pedestrianIndex);
    assert.ok(start);
    assert.ok(next);
    const moved = Math.hypot(next.x - start.x, next.y - start.y);
    assert.ok(moved > 1 && moved < 2, `unexpected sidewalk movement ${moved}`);

    for (let seconds = 0; seconds <= 20; seconds += 0.125) {
      const point = ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrianIndex);
      assert.ok(point);
      assert.equal(isRoadSurface(point, 0.45), false);
    }
  }
});

test("ambient sidewalk activity renders six separated walkers across two lanes per populated block", () => {
  assert.equal(AMBIENT_PEDESTRIANS_PER_BLOCK, 6);
  const blockX = -4;
  const blockY = -1;
  for (const seconds of [0, 0.25, 1, 4.5, 17.25]) {
    const points = Array.from({ length: AMBIENT_PEDESTRIANS_PER_BLOCK }, (_, pedestrianIndex) =>
      ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrianIndex));
    assert.ok(points.every((point) => point !== null));
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        const a = points[first];
        const b = points[second];
        assert.ok(a && b);
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 8, "walkers should not stack on the sidewalk");
      }
    }
  }

  const game = makeGame();
  let populatedBlocks = 0;
  const centerBlockX = Math.floor(game.x / ROAD_SPACING);
  const centerBlockY = Math.floor(game.y / ROAD_SPACING);
  for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      if (ambientPedestrianPointForBlock(centerBlockX + offsetX, centerBlockY + offsetY, 0)) {
        populatedBlocks += 1;
      }
    }
  }
  const boxes = ambientPeopleBoxes(game, 0);
  assert.equal(boxes.length, populatedBlocks * AMBIENT_PEDESTRIANS_PER_BLOCK * 2);
});
