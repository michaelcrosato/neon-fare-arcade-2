import assert from "node:assert/strict";
import test from "node:test";
import { drapeNorthstarRoad, naturalTerrainHeight, northstarRoadHeight, triangularHeight } from "../../game/terrain/northstar-forms";

test("Northstar landforms climb from a seamless city gateway into substantial mountain relief", () => {
  for (let x = -792; x <= 792; x += 36) {
    assert.equal(naturalTerrainHeight(x, -792), 0);
    assert.equal(northstarRoadHeight(x, -792), 0);
  }
  assert.equal(naturalTerrainHeight(1200, -1800), 0, "inactive northeast has no terrain");
  assert.equal(northstarRoadHeight(0, -1440), 44);
  assert.equal(naturalTerrainHeight(432, -1836), 82);
  assert.ok(naturalTerrainHeight(-450, -2016) > 240);
  assert.ok(northstarRoadHeight(360, -2232) > 150);
});

test("triangular terrain interpolation preserves a plane and both sides of cell boundaries", () => {
  const vertex = (x: number, y: number) => x * 0.12 + y * 0.05 + 30;
  for (const [x, y] of [[2, 7], [-12, 14], [18, -36], [36, 36]]) {
    assert.ok(Math.abs(triangularHeight(x, y, 9, vertex) - vertex(x, y)) < 1e-9);
  }
  assert.ok(Math.abs(northstarRoadHeight(36 - 1e-7, -1941) - northstarRoadHeight(36 + 1e-7, -1941)) < 1e-6);
});

test("draped road spans remain on their exact design plane through all grid and diagonal crossings", () => {
  const path = drapeNorthstarRoad([{ x: -249, y: -1789 }, { x: 361, y: -2137 }]);
  assert.ok(path.length > 30);
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1], b = path[i];
    for (const t of [0.2, 0.5, 0.8]) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      assert.ok(Math.abs(northstarRoadHeight(x, y) - (a.z! + (b.z! - a.z!) * t)) < 1e-8);
    }
  }
});
