import { coastRoadHeight, inCoastTerrain } from "../../game/terrain/coast-forms";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { compiledSpecialRoad, sampleSpecialRoad } from "../../game/road-network";
import { CityStream } from "../../game/world";
import { groundAt } from "../../game/vehicle-road-contact";
import { taxiHitsBuilding } from "../../game/collision";
import { buildGpsRoute } from "../../game/navigation";
import { coastTopography } from "../../game/terrain/map";
import assert from "node:assert/strict";
import test from "node:test";
import { terrainHeightAt } from "../../game/terrain/surface";
import { inElevatedTerrain, roadDesignHeight, drapeRegionalRoad } from "../../game/terrain/region-forms";

test("Solana Coast has a low beach, real bluffs and hills, and an exact flat City seam", () => {
  assert.equal(inElevatedTerrain(-1600, -500), true);
  assert.ok(terrainHeightAt(-1740, -480) > 20, "palisades must be physical terrain");
  assert.ok(terrainHeightAt(-1350, -600) > 50, "Citrus Heights must rise above the coast");
  assert.ok(terrainHeightAt(-2070, 144) < 2, "beach remains low and walkable");
  for (let y = -792; y <= 792; y += 9) {
    assert.equal(terrainHeightAt(-792, y), 0);
    assert.equal(roadDesignHeight(-792, y), 0);
  }
  assert.equal(inElevatedTerrain(-1000, -1000), false);
  assert.equal(inElevatedTerrain(-1000, 1000), false);
});

test("Coast ribbons share exact design planes across road and grid intersections", () => {
  const points = drapeRegionalRoad([{ x: -2300, y: -740 }, { x: -900, y: 740 }]);
  assert.ok(points.length > 50);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1], b = points[i];
    for (const t of [0.2, 0.5, 0.8]) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      assert.ok(Math.abs(coastRoadHeight(x, y) - (a.z! + (b.z! - a.z!) * t)) < 1e-8);
    }
  }
});

test("coastal GPS preserves connectivity through tiny terrain cuts and caches physical contour data", () => {
  for (const road of SPECIAL_ROADS.filter(road => road.points.some(point => inCoastTerrain(point.x, point.y)))) {
    const geometry = compiledSpecialRoad(road.id)!;
    for (const fraction of [0.05, 0.4, 0.9]) {
      const target = sampleSpecialRoad(road.id, geometry.length * fraction)!.point;
      const route = buildGpsRoute({ x: -1764, y: 0 }, target);
      assert.ok(route.length > 1, `${road.id} disconnected at ${fraction}`);
      const arrival = route.at(-1)!;
      // Route compaction deliberately merges points within 0.1 world units.
      assert.ok(Math.hypot(arrival.x - target.x, arrival.y - target.y, (arrival.z ?? 0) - target.z) < 0.1,
        `${road.id} route must reach the sampled deck`);
    }
  }
  const map = coastTopography();
  assert.equal(map, coastTopography());
  assert.ok(map.fills.length > 100);
  assert.ok(map.contours.some(contour => contour.height >= 64), "GPS shows the physical coastal hills");
});

test("all Coast lanes stay clear of scenery and terrain and share physical tire support", () => {
  const stream = new CityStream();
  const blocked = new Set<string>(), buried: string[] = [], unsupported: string[] = [];
  for (const road of SPECIAL_ROADS.filter((road) => road.points.some((point) => inCoastTerrain(point.x, point.y)))) {
    const geometry = compiledSpecialRoad(road.id)!;
    for (let distance = 2; distance < geometry.length - 2; distance += 4) {
      for (const lane of [-2.7, 2.7]) {
        const sample = sampleSpecialRoad(road.id, distance, lane)!;
        const { x, y, z } = sample.point, top = z + 0.64;
        const world = stream.update(x, y, 1);
        const solid = taxiHitsBuilding(world, x, y, sample.heading, top);
        if (solid) blocked.add(`${road.id}:${solid.id}`);
        const ground = terrainHeightAt(x, y);
        if (ground > top + 0.08 && buried.length < 16) buried.push(`${road.id}@${distance}: ${ground - top}`);
        const support = groundAt({ x, y, z: top }, 0.85, road.id);
        if (Math.abs(support.height - top) > 0.12 && unsupported.length < 16) unsupported.push(`${road.id}@${distance}: ${support.height - top}`);
      }
    }
  }
  assert.deepEqual({ blocked: [...blocked], buried, unsupported }, { blocked: [], buried: [], unsupported: [] });
});
