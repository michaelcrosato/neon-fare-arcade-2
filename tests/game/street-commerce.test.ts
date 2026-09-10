import assert from "node:assert/strict";
import test from "node:test";

import {
  AMBIENT_PEDESTRIANS_PER_BLOCK,
  BLOCKS_PER_CHUNK,
  CHUNK_MAX,
  CHUNK_MIN,
  ROAD_SPACING,
  STREET_COMMERCE_MAX_SCENES_PER_CHUNK,
} from "../../game/config";
import { obbOverlap } from "../../game/collision";
import { landmarkTileForBlock } from "../../game/landmarks";
import type { Collider } from "../../game/model";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { isRoadSurface, specialRoadIntersectsSquare } from "../../game/road-network";
import {
  STREET_COMMERCE_KINDS,
  generateCityChunk,
} from "../../game/world";

const PREFIX = "street-commerce:";

function pointDistanceToCollider(point: { x: number; y: number }, collider: Collider) {
  return Math.hypot(
    Math.max(Math.abs(point.x - collider.x) - collider.halfX, 0),
    Math.max(Math.abs(point.y - collider.y) - collider.halfY, 0),
  );
}

test("street commerce deterministically sprinkles every scene type without overrunning a chunk", () => {
  const counts = Object.fromEntries(STREET_COMMERCE_KINDS.map((kind) => [kind, 0])) as Record<string, number>;
  const ids = new Set<string>();
  let total = 0;

  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const vendors = generateCityChunk(cx, cy).colliders.filter((collider) => collider.id.startsWith(PREFIX));
      assert.ok(vendors.length <= STREET_COMMERCE_MAX_SCENES_PER_CHUNK);
      total += vendors.length;
      for (const vendor of vendors) {
        assert.equal(ids.has(vendor.id), false, `duplicate vendor scene ${vendor.id}`);
        ids.add(vendor.id);
        const kind = vendor.id.split(":")[1];
        assert.ok(STREET_COMMERCE_KINDS.includes(kind as (typeof STREET_COMMERCE_KINDS)[number]));
        counts[kind] += 1;
      }
    }
  }

  assert.equal(total, 189);
  assert.equal(ids.has("street-commerce:hot-dog-cart:0:0"), true);
  assert.deepEqual(counts, {
    "coffee-cart": 23,
    "busker": 15,
    "food-truck": 48,
    "ice-cream-cart": 25,
    "flower-stand": 18,
    "hot-dog-cart": 31,
    "produce-stand": 18,
    "newsstand": 11,
  });
});

test("vendor scenes preserve roads, water, portals, existing geometry, and walking lanes", () => {
  let checked = 0;
  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      const chunk = generateCityChunk(cx, cy);
      const vendors = chunk.colliders.filter((collider) => collider.id.startsWith(PREFIX));
      for (const vendor of vendors) {
        checked += 1;
        assert.ok([
          vendor.x,
          vendor.y,
          vendor.halfX,
          vendor.halfY,
          vendor.height,
        ].every(Number.isFinite));
        const parts = vendor.id.split(":");
        const blockX = Number(parts[2]);
        const blockY = Number(parts[3]);
        assert.equal(landmarkTileForBlock(blockX, blockY), null);
        const center = {
          x: blockX * ROAD_SPACING + ROAD_SPACING / 2,
          y: blockY * ROAD_SPACING + ROAD_SPACING / 2,
        };
        assert.equal(specialRoadIntersectsSquare(center, 12, 1.5), false);

        const roadSamples = [
          [0, 0],
          [-vendor.halfX, -vendor.halfY],
          [vendor.halfX, -vendor.halfY],
          [-vendor.halfX, vendor.halfY],
          [vendor.halfX, vendor.halfY],
        ] as const;
        for (const [offsetX, offsetY] of roadSamples) {
          assert.equal(isRoadSurface({ x: vendor.x + offsetX, y: vendor.y + offsetY }, 0.45), false);
        }

        for (const other of chunk.colliders) {
          if (other === vendor) continue;
          const separationX = Math.abs(vendor.x - other.x) - vendor.halfX - other.halfX;
          const separationY = Math.abs(vendor.y - other.y) - vendor.halfY - other.halfY;
          assert.ok(
            separationX >= 0.459 || separationY >= 0.459,
            `${vendor.id} crowded ${other.id}`,
          );
        }

        for (const region of chunk.surfaceRegions) {
          assert.equal(obbOverlap({
            x: vendor.x,
            y: vendor.y,
            heading: 0,
            halfLength: vendor.halfX + 0.46,
            halfWidth: vendor.halfY + 0.46,
          }, {
            x: region.x,
            y: region.y,
            heading: region.yaw,
            halfLength: region.halfX + 0.46,
            halfWidth: region.halfY + 0.46,
          }), false, `${vendor.id} entered ${region.id}`);
        }

        for (const interaction of chunk.interactions) {
          assert.ok(pointDistanceToCollider(interaction, vendor) > interaction.radius + 0.749);
          const returnPose = {
            x: interaction.x + Math.cos(interaction.heading) * 1.15,
            y: interaction.y + Math.sin(interaction.heading) * 1.15,
          };
          assert.ok(pointDistanceToCollider(returnPose, vendor) > 0.939);
        }

        for (let seconds = 0; seconds <= 20; seconds += 0.25) {
          for (let pedestrian = 0; pedestrian < AMBIENT_PEDESTRIANS_PER_BLOCK; pedestrian += 1) {
            const point = ambientPedestrianPointForBlock(blockX, blockY, seconds, pedestrian);
            if (point) assert.ok(pointDistanceToCollider(point, vendor) >= 0.44);
          }
        }
      }
    }
  }
  assert.equal(checked, 189);
});

test("vendor blocks stay owned by their generated chunk", () => {
  for (let cx = CHUNK_MIN; cx <= CHUNK_MAX; cx += 1) {
    for (let cy = CHUNK_MIN; cy <= CHUNK_MAX; cy += 1) {
      for (const collider of generateCityChunk(cx, cy).colliders) {
        if (!collider.id.startsWith(PREFIX)) continue;
        const [, , blockXText, blockYText] = collider.id.split(":");
        const blockX = Number(blockXText);
        const blockY = Number(blockYText);
        assert.ok(blockX >= cx * BLOCKS_PER_CHUNK - 2 && blockX <= cx * BLOCKS_PER_CHUNK + 1);
        assert.ok(blockY >= cy * BLOCKS_PER_CHUNK - 2 && blockY <= cy * BLOCKS_PER_CHUNK + 1);
      }
    }
  }
});
