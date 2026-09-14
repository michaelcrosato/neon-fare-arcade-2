import assert from "node:assert/strict";
import test from "node:test";
import { compactMapProjection, DEFAULT_MINIMAP, MINIMAP_SIZES, MINIMAP_ZOOMS, normalizeMinimapPreferences } from "../../app/runtime/minimap-preferences";

test("mini-map choices normalize saved data and keep size independent from geographic zoom", () => {
  for (const invalid of [null, 42, "large", {}, { size: Infinity, zoom: 0 }, { size: "2", zoom: NaN }]) {
    assert.deepEqual(normalizeMinimapPreferences(invalid), DEFAULT_MINIMAP);
  }
  for (const size of MINIMAP_SIZES) for (const zoom of MINIMAP_ZOOMS) {
    assert.deepEqual(normalizeMinimapPreferences({ size, zoom }), { size, zoom });
    assert.ok(compactMapProjection(zoom).radiusMetres * compactMapProjection(zoom).pixelsPerMetre >= Math.hypot(62, 49) - 1e-8);
  }
  assert.equal(compactMapProjection(.5).radiusMetres, compactMapProjection(1).radiusMetres * 2);
  assert.equal(compactMapProjection(2).pixelsPerMetre, compactMapProjection(1).pixelsPerMetre * 2);
});
