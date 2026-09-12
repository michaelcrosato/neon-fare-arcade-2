import assert from "node:assert/strict";
import test from "node:test";
import { IRONWAKE_ANCHORS, IRONWAKE_DRYDOCK, ironwakeAnchorForBlock, ironwakeIsWater } from "../../game/industrial-layout";
import { activeCardinalNeighborRegions, activeChunkCoordinates, containingRegionForPosition, isPlayablePoint } from "../../game/regions";
import { IRONWAKE_ROADS } from "../../game/industrial-roads";
import { buildGpsRoute } from "../../game/navigation";
import { isRoadSurface } from "../../game/road-network";

test("Ironwake activates the complete southwest cell and only its cardinal seams", () => {
  assert.equal(activeChunkCoordinates().length, 924);
  assert.equal(containingRegionForPosition(-1584, 1584)?.id, "ironwake-works");
  assert.deepEqual(activeCardinalNeighborRegions("ironwake-works").map(region => region.id), ["solana-coast", "copper-mesa"]);
  assert.equal(isPlayablePoint(-1584, -1584), false);
  assert.equal(isPlayablePoint(1584, -1584), false);
});

test("every industrial landmark has a unique continuous footprint and one dry public entrance", () => {
  const tiles = new Set<string>();
  assert.equal(IRONWAKE_ANCHORS.length, 10);
  for (const anchor of IRONWAKE_ANCHORS) {
    for (let dx = 0; dx < anchor.width; dx++) for (let dy = 0; dy < anchor.height; dy++) {
      const bx = anchor.originX + dx, by = anchor.originY + dy, key = `${bx},${by}`;
      assert.equal(tiles.has(key), false, key);
      tiles.add(key);
      assert.equal(ironwakeAnchorForBlock(bx, by)?.definition.id, anchor.id);
    }
    const p = anchor.portal;
    assert.equal(ironwakeIsWater((anchor.originX + p.tileX) * 36 + 18 + p.x,
      (anchor.originY + p.tileY) * 36 + 18 + p.y), false, anchor.id);
  }
  assert.equal(ironwakeIsWater(-2300, 1584), true);
  assert.equal(ironwakeIsWater((IRONWAKE_DRYDOCK.minX + IRONWAKE_DRYDOCK.maxX) / 2, 1800), true);
  assert.equal(ironwakeIsWater(-2200, 1250), false, "container pier is reclaimed land");
});

test("industrial freight roads connect to both neighbors through actual pavement", () => {
  for (const target of [{ x: -1872, y: 1584 }, { x: -1152, y: 1296 }, { x: -2088, y: 2268 }]) {
    for (const start of [{ x: -1728, y: 576 }, { x: -612, y: 1368 }]) {
      const route = buildGpsRoute(start, target);
      assert.ok(route.length > 2);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i], count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
        for (let n = 0; n <= count; n++) {
          const x = a.x + (b.x - a.x) * n / count, y = a.y + (b.y - a.y) * n / count;
          assert.equal(isPlayablePoint(x, y), true, `inactive route at ${x},${y}`);
          assert.equal(isRoadSurface({ x, y }), true, `unpaved route at ${x},${y}`);
          assert.equal(ironwakeIsWater(x, y), false, `submerged route at ${x},${y}`);
        }
      }
    }
  }
  assert.equal(IRONWAKE_ROADS.length, 5);
});
