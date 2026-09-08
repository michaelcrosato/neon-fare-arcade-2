import assert from "node:assert/strict";
import test from "node:test";

import { ROAD_SPACING } from "../../game/config";
import { customDestinationForMapPoint } from "../../game/custom-destination";
import { buildGpsRoute, routeLength } from "../../game/route-geometry";
import {
  SPECIAL_ROAD_SEGMENTS,
  isRoadSurface,
  routeRoadNetworkShortest,
} from "../../game/road-network";
import {
  gridStreetPointEnabled,
  gridStreetSegmentEnabled,
} from "../../game/road-topology";
import { isPlayablePoint } from "../../game/regions";
import { generateCityChunk } from "../../game/world";

function routeSamples(route: readonly { x: number; y: number }[], spacing = 3) {
  const output: Array<{ x: number; y: number }> = [];
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1];
    const b = route[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const samples = Math.max(1, Math.ceil(length / spacing));
    for (let sample = 0; sample <= samples; sample += 1) {
      const t = sample / samples;
      output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return output;
}

test("Northstar replaces the city lattice with one shared sparse-road policy", () => {
  const villageStreet = [{ x: 0, y: -1440 }, { x: ROAD_SPACING, y: -1440 }] as const;
  const wildernessStreet = [{ x: 72, y: -1800 }, { x: 72, y: -1764 }] as const;
  assert.equal(gridStreetSegmentEnabled(...villageStreet), true);
  assert.equal(gridStreetSegmentEnabled(...wildernessStreet), false);
  assert.equal(gridStreetPointEnabled({ x: 72, y: -1782 }, "vertical"), false);
  assert.equal(isRoadSurface({ x: 72, y: -1782 }), false);

  const townChunk = generateCityChunk(0, -10);
  assert.ok(townChunk.boxes.some((box) => (
    Math.abs(box.x - 18) < 0.01
    && Math.abs(box.y + 1440) < 0.01
    && Math.abs(box.sx - ROAD_SPACING) < 0.01
    && Math.abs(box.sy - 12) < 0.01
  )));
  const woodsChunk = generateCityChunk(1, -12);
  assert.equal(woodsChunk.boxes.some((box) => (
    Math.abs(box.x - 72) < 0.01
    && Math.abs(box.y + 1782) < 0.01
    && Math.abs(box.sx - 12) < 0.01
    && Math.abs(box.sy - ROAD_SPACING) < 0.01
  )), false);
});

test("every authored Northstar road stays playable and joins the shared graph", () => {
  const northRoadIds = new Set([
    "northstar-highway",
    "pinehook-loop",
    "mirror-lake-road",
    "silver-run-switchbacks",
  ]);
  const segments = SPECIAL_ROAD_SEGMENTS.filter((segment) => northRoadIds.has(segment.pathId));
  assert.ok(segments.length > 300);
  for (const segment of segments) {
    for (const point of routeSamples([segment.a, segment.b], 3)) {
      assert.equal(isPlayablePoint(point.x, point.y), true, segment.id);
      assert.equal(isRoadSurface(point), true, segment.id);
    }
  }
  for (const target of [
    { x: -600, y: -1800 },
    { x: 600, y: -1872 },
    { x: 216, y: -2268 },
  ]) {
    const route = routeRoadNetworkShortest({ x: 0, y: -792 }, target);
    assert.ok(route, `${target.x},${target.y}`);
    assert.ok(route!.usesSpecialRoad);
    assert.ok(routeLength(route!.route) > 500);
  }
});

test("Northstar-to-Cedar routes descend through Neon City and never enter inactive northeast", () => {
  for (const [start, target] of [
    [{ x: 0, y: -2250 }, { x: 2250, y: 0 }],
    [{ x: 2250, y: 0 }, { x: -540, y: -1800 }],
  ] as const) {
    const route = buildGpsRoute(start, target);
    assert.ok(route.some((point) => point.y >= -792 && point.x <= 792));
    for (const point of routeSamples(route, 3)) {
      assert.equal(isPlayablePoint(point.x, point.y), true, `${point.x},${point.y}`);
      assert.equal(point.x > 792 && point.y < -792, false, "route entered inactive northeast");
    }
  }
});

test("Northstar GPS pins snap to mountain roads while the inactive northeast rejects pins", () => {
  const northstarPin = customDestinationForMapPoint({ x: 0, y: -1800 });
  assert.ok(northstarPin);
  assert.equal(isRoadSurface(northstarPin), true);
  assert.equal(isPlayablePoint(northstarPin.x, northstarPin.y), true);
  assert.equal(customDestinationForMapPoint({ x: 1008, y: -1008 }), null);

  const route = buildGpsRoute({ x: 2250, y: 0 }, northstarPin);
  for (const point of routeSamples(route, 3)) {
    assert.equal(isPlayablePoint(point.x, point.y), true, `${point.x},${point.y}`);
    assert.equal(point.x > 792 && point.y < -792, false, "custom route entered inactive northeast");
  }
});
