import assert from "node:assert/strict";
import test from "node:test";
import { copperNaturalHeight, copperRoadHeight, copperCanyonY, inCopperTerrain } from "../../game/terrain/copper-forms";
import { drapeRegionalRoad } from "../../game/terrain/region-forms";
import { terrainHeightAt } from "../../game/terrain/surface";
import { compiledSpecialRoad, sampleSpecialRoad } from "../../game/road-network";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { CityStream, generateCityChunk } from "../../game/world";
import { groundAt } from "../../game/vehicle-road-contact";
import { taxiHitsBuilding, circleHitsBuilding } from "../../game/collision";
import { COPPER_MESA_ANCHORS } from "../../game/desert";
import type { WorldInteraction } from "../../game/model";

test("Copper Mesa has seamless northern/eastern gateways, flat service benches and substantial desert relief", () => {
  for (let x = -792; x <= 792; x += 36) {
    assert.equal(copperNaturalHeight(x, 792), 0);
    assert.equal(copperRoadHeight(x, 792), 0);
  }
  for (let y = 792; y <= 2376; y += 36) {
    assert.equal(copperNaturalHeight(792, y), 0);
    assert.equal(copperRoadHeight(792, y), 0);
  }
  assert.equal(copperRoadHeight(-54, 1350), 24);
  assert.equal(copperNaturalHeight(-468, 1656), 34);
  assert.ok(copperNaturalHeight(-174, 1752) > 130, "real caprock rises above the desert floor");
  assert.ok(copperNaturalHeight(-540, 1080) > 60, "cinder cone has physical relief");
  assert.ok(copperRoadHeight(0, copperCanyonY(0)) - copperNaturalHeight(0, copperCanyonY(0)) > 55, "canyon remains below its crossing");
  assert.equal(copperNaturalHeight(1000, 2100), 0);
});

test("Copper ribbons share exact design planes across road and grid intersections", () => {
  const points = drapeRegionalRoad([{ x: -470, y: 1750 }, { x: 680, y: 2300 }]);
  assert.ok(points.length > 50);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1], b = points[i];
    for (const t of [0.2, 0.5, 0.8]) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      assert.ok(Math.abs(copperRoadHeight(x, y) - (a.z! + (b.z! - a.z!) * t)) < 1e-8);
    }
  }
});

test("all Copper lanes stay clear of scenery and terrain and share physical tire support", () => {
  const stream = new CityStream();
  const blocked = new Set<string>(), buried: string[] = [], unsupported: string[] = [];
  for (const road of SPECIAL_ROADS.filter((road) => road.points.some((point) => inCopperTerrain(point.x, point.y)))) {
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

test("all ten Copper Mesa entrances sit on accessible elevated ground", () => {
  const entrances: WorldInteraction[] = [];
  for (let cx = -5; cx <= 5; cx += 1) for (let cy = 6; cy <= 16; cy += 1) {
    entrances.push(...generateCityChunk(cx, cy).interactions);
  }
  const stream = new CityStream();
  for (const anchor of COPPER_MESA_ANCHORS) {
    const entrance = entrances.find((item) => item.kind === "venue-entrance" && item.venue.label === anchor.label);
    assert.ok(entrance, anchor.id);
    assert.ok((entrance.z ?? 0) > 4, anchor.id);
    const world = stream.update(entrance.x, entrance.y, 1);
    for (const offset of [0, 1.15]) {
      const x: number = entrance.x + Math.cos(entrance.heading) * offset, y: number = entrance.y + Math.sin(entrance.heading) * offset;
      assert.equal(circleHitsBuilding(world, x, y, 0.44, entrance.z), undefined, anchor.id);
      assert.ok(Math.abs(terrainHeightAt(x, y) - (entrance.z ?? 0)) < 0.85, anchor.id);
    }
  }
});
