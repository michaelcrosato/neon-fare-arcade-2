import assert from "node:assert/strict";
import test from "node:test";

import {
  REGIONAL_MAP_CELL_SIZE,
  REGIONAL_MAP_MAX_SPAN,
  REGIONAL_MAP_MIN_SPAN,
  REGIONAL_MAP_PLANNED_BOUNDS,
  REGIONAL_MAP_SLOTS,
  clampRegionalMapView,
  regionalMapDetail,
  regionalMapOverviewView,
  regionalMapRegionView,
  regionalMapViewBox,
  zoomRegionalMapView,
} from "../../game/regional-map";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";

test("regional GPS reserves one stable 3x3 footprint before all nine regions exist", () => {
  assert.equal(REGIONAL_MAP_SLOTS.length, 9);
  assert.equal(REGIONAL_MAP_SLOTS.filter((slot) => slot.activeRegion).length, 7);
  assert.deepEqual(REGIONAL_MAP_PLANNED_BOUNDS, {
    minX: -2376,
    maxX: 2376,
    minY: -2376,
    maxY: 3384,
  });
  assert.equal(REGIONAL_MAP_CELL_SIZE, 1584);
});

test("overview and region focus fit at wide and narrow map aspects", () => {
  for (const aspect of [0.72, 1, 1.8]) {
    const overview = regionalMapViewBox(regionalMapOverviewView(aspect), aspect);
    assert.ok(overview.minX <= REGIONAL_MAP_PLANNED_BOUNDS.minX);
    assert.ok(overview.minY <= REGIONAL_MAP_PLANNED_BOUNDS.minY);
    assert.ok(overview.minX + overview.width >= REGIONAL_MAP_PLANNED_BOUNDS.maxX);
    assert.ok(overview.minY + overview.height >= REGIONAL_MAP_PLANNED_BOUNDS.maxY);

    for (const region of ACTIVE_WORLD_REGIONS) {
      const view = regionalMapRegionView(region, aspect);
      const box = regionalMapViewBox(view, aspect);
      assert.ok(Number.isFinite(box.minX) && Number.isFinite(box.minY));
      assert.ok(view.spanY >= REGIONAL_MAP_MIN_SPAN && view.spanY <= REGIONAL_MAP_MAX_SPAN);
    }
  }
});

test("zooming around a cursor keeps that world point under the cursor", () => {
  const aspect = 1.6;
  const view = { center: { x: 0, y: 0 }, spanY: 1200 };
  const focus = { x: 180, y: -120 };
  const before = regionalMapViewBox(view, aspect);
  const normalizedBefore = {
    x: (focus.x - before.minX) / before.width,
    y: (focus.y - before.minY) / before.height,
  };
  const zoomed = zoomRegionalMapView(view, aspect, 0.7, focus);
  const after = regionalMapViewBox(zoomed, aspect);
  assert.ok(Math.abs((focus.x - after.minX) / after.width - normalizedBefore.x) < 1e-9);
  assert.ok(Math.abs((focus.y - after.minY) / after.height - normalizedBefore.y) < 1e-9);
});

test("map pan and zoom clamp to planned bounds and deterministic detail levels", () => {
  const clamped = clampRegionalMapView({
    center: { x: 1_000_000, y: -1_000_000 },
    spanY: 1,
  }, 1.5);
  assert.equal(clamped.spanY, REGIONAL_MAP_MIN_SPAN);
  assert.ok(Math.abs(clamped.center.x) < 3000);
  assert.ok(Math.abs(clamped.center.y) < 3000);
  assert.equal(regionalMapDetail(REGIONAL_MAP_CELL_SIZE * 2), "overview");
  assert.equal(regionalMapDetail(REGIONAL_MAP_CELL_SIZE), "region");
  assert.equal(regionalMapDetail(500), "local");
  assert.equal(regionalMapDetail(2693, 2592), "region", "the complete peninsula retains road and destination detail");
});
