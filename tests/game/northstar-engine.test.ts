import assert from "node:assert/strict";
import test from "node:test";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { compiledSpecialRoad, sampleSpecialRoad } from "../../game/road-network";
import { CityStream, generateCityChunk } from "../../game/world";
import { groundAt } from "../../game/vehicle-road-contact";
import { taxiHitsBuilding, circleHitsBuilding } from "../../game/collision";
import { terrainHeightAt, terrainBarrier } from "../../game/terrain/surface";
import { inNorthstarTerrain } from "../../game/terrain/northstar-forms";
import { boxSurfaceFaces, packSurfaceQuads, roadStripQuad, SURFACE_VERTEX_FLOATS } from "../../game/render/surfaces";
import { gabledRoof } from "../../game/architecture";
import { NORTHSTAR_RANGE_ANCHORS } from "../../game/mountain";
import type { WorldInteraction } from "../../game/model";
import { MAT_ROAD, ROAD } from "../../game/config";

test("triangle architecture packs exact vertices and normals without degenerate roof faces", () => {
  const roof = gabledRoof(0, 0, 7, 12, 10, 5, [0.5, 0.1, 0.1, 1], [0.7, 0.6, 0.4, 1]);
  const packed = packSurfaceQuads(roof);
  assert.equal(packed.length, 18 * SURFACE_VERTEX_FLOATS);
  for (let i = 0; i < packed.length; i += SURFACE_VERTEX_FLOATS) {
    assert.ok(Math.abs(Math.hypot(...packed.slice(i + 4, i + 7)) - 1) < 1e-6);
  }
});

test("full cuboid faces preserve the GPU roll, pitch, and yaw transform", () => {
  const faces = boxSurfaceFaces({ x: 10, y: 20, z: 30, sx: 8, sy: 4, sz: 2,
    yaw: Math.PI / 2, tilt: Math.PI / 2, pitch: Math.PI / 2, color: ROAD });
  const points = faces.flatMap(face => face.corners);
  assert.equal(faces.length, 6);
  for (const [axis, center, extent] of [["x", 10, 2], ["y", 20, 4], ["z", 30, 8]] as const) {
    assert.ok(Math.abs(Math.max(...points.map(p => p[axis])) - center - extent / 2) < 1e-8, axis);
    assert.ok(Math.abs(Math.min(...points.map(p => p[axis])) - center + extent / 2) < 1e-8, axis);
  }
  assert.equal(packSurfaceQuads(faces).length, 36 * SURFACE_VERTEX_FLOATS);
});

test("every Northstar ribbon remains unfolded through hairpins and uneven height-field knots", () => {
  for (const road of SPECIAL_ROADS.filter(road => road.points.some(p => inNorthstarTerrain(p.x, p.y)))) {
    const geometry = compiledSpecialRoad(road.id)!;
    for (let i = 1; i < geometry.sections.length; i++) {
      const a = geometry.sections[i - 1], b = geometry.sections[i];
      const face = roadStripQuad(a, b, -a.halfWidth, a.halfWidth, 0.64, ROAD, MAT_ROAD, -b.halfWidth, b.halfWidth);
      for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
        const p = face.corners[i0], q = face.corners[i1], r = face.corners[i2];
        assert.ok((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) > 1e-8, `${road.id}:${i}`);
      }
    }
  }
});

test("Northstar lanes share tire support and stay clear of terrain and solid scenery", () => {
  const stream = new CityStream();
  const blocked = new Set<string>(), buried: string[] = [], unsupported: string[] = [];
  for (const road of SPECIAL_ROADS.filter((road) => road.points.some((point) => inNorthstarTerrain(point.x, point.y)))) {
    const geometry = compiledSpecialRoad(road.id)!;
    for (let distance = 2; distance < geometry.length - 2; distance += 4) {
      for (const lane of [-3, 3]) {
        const sample = sampleSpecialRoad(road.id, distance, lane)!;
        const { x, y, z } = sample.point;
        const top = z + 0.64;
        const world = stream.update(x, y, 1);
        const solid = taxiHitsBuilding(world, x, y, sample.heading, top);
        if (solid) blocked.add(`${road.id}:${solid.id}`);
        const ground = terrainHeightAt(x, y);
        if (ground > top + 0.08 && buried.length < 12) buried.push(`${road.id}@${distance}: ${ground - top}`);
        const support = groundAt({ x, y, z: top }, 0.85, road.id);
        if (Math.abs(support.height - top) > 0.12 && unsupported.length < 12) unsupported.push(`${road.id}@${distance}: ${support.height - top}`);
      }
    }
  }
  assert.deepEqual({ blocked: [...blocked], buried, unsupported }, { blocked: [], buried: [], unsupported: [] });
});

test("every named Northstar entrance has an elevated, unobstructed walking pose", () => {
  const entrances: WorldInteraction[] = [];
  for (let cx = -5; cx <= 5; cx += 1) for (let cy = -16; cy <= -6; cy += 1) {
    entrances.push(...generateCityChunk(cx, cy).interactions.filter((item) => item.kind === "venue-entrance"));
  }
  const stream = new CityStream();
  for (const anchor of NORTHSTAR_RANGE_ANCHORS) {
    const entrance = entrances.find((item) => item.kind === "venue-entrance" && item.venue.label === anchor.label);
    assert.ok(entrance, anchor.id);
    assert.ok((entrance.z ?? 0) > 4, anchor.id);
    const world = stream.update(entrance.x, entrance.y, 1);
    assert.equal(circleHitsBuilding(world, entrance.x, entrance.y, 0.38, entrance.z), undefined, anchor.id);
    assert.ok(Math.abs(terrainHeightAt(entrance.x, entrance.y) - (entrance.z ?? 0)) < 0.85, anchor.id);
  }
});

test("steep rock faces stop uphill movement while downhill drops stay open", () => {
  let checked = false;
  for (let x = 300; x < 690 && !checked; x += 9) for (let y = -1680; y < -1120 && !checked; y += 9) {
    const a = { x, y, z: terrainHeightAt(x, y) };
    const b = { x: x + 0.2, y, z: terrainHeightAt(x + 0.2, y) };
    if (Math.abs(a.z - b.z) < 0.22) continue;
    const [low, high] = a.z < b.z ? [a, b] : [b, a];
    assert.ok(terrainBarrier(low, high));
    assert.equal(terrainBarrier(high, low), null);
    checked = true;
  }
  assert.ok(checked, "fixture contains a physical cliff slope");
});
