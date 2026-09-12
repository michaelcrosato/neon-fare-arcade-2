import assert from "node:assert/strict";
import test from "node:test";
import { CHUNK_SIZE, MAT_ROAD, ROAD } from "../../game/config";
import { compileRoad, sampleRoad } from "../../game/roads/geometry";
import {
  MAX_CHUNK_SURFACE_QUADS, MAX_STREAM_SURFACE_QUADS, SURFACE_VERTEX_BYTES,
  SURFACE_VERTEX_FLOATS, packSurfaceQuads, roadStripQuad,
} from "../../game/render/surfaces";
import { CityStream, generateCityChunk } from "../../game/world";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";

test("swept road vertices and normals match physical bank/grade samples", () => {
  const road = compileRoad("grade", [{ x: 0, y: 0, z: 0, bank: 0.2 }, { x: 30, y: 0, z: 10, bank: 0.2 }], 6);
  const surface = roadStripQuad(road.sections[0], road.sections[1], -6, 6, 0, ROAD, MAT_ROAD);
  assert.deepEqual(surface.corners[0], sampleRoad(road, 0, -6).point);
  assert.deepEqual(surface.corners[1], sampleRoad(road, road.length, -6).point);
  const packed = packSurfaceQuads([surface]);
  assert.equal(packed.byteLength, 6 * SURFACE_VERTEX_BYTES);
  for (let offset = 0; offset < packed.length; offset += SURFACE_VERTEX_FLOATS) {
    assert.equal(packed[offset + 3], MAT_ROAD);
    assert.ok(Math.abs(Math.hypot(packed[offset + 4], packed[offset + 5], packed[offset + 6]) - 1) < 1e-6);
    assert.ok(packed[offset + 6] > 0.9);
    assert.equal(packed[offset + 7], 1);
    assert.equal(packed[offset + 8], Math.fround(ROAD[0]));
    assert.equal(packed[offset + 11], 1);
  }
});

test("all active regions emit finite road surfaces within independent chunk and stream budgets", () => {
  const stream = new CityStream();
  let totalSurfaces = 0;
  for (const region of ACTIVE_WORLD_REGIONS) {
    for (let cx = region.chunkMinX; cx <= region.chunkMaxX; cx += 1) {
      for (let cy = region.chunkMinY; cy <= region.chunkMaxY; cy += 1) {
        const chunk = generateCityChunk(cx, cy);
        const surfaces = chunk.surfaces ?? [];
        totalSurfaces += surfaces.length;
        assert.ok(surfaces.length <= MAX_CHUNK_SURFACE_QUADS, chunk.key);
        assert.ok(packSurfaceQuads(surfaces).every(Number.isFinite), chunk.key);
        const world = stream.update(cx * CHUNK_SIZE, cy * CHUNK_SIZE, 3);
        assert.ok((world.surfaces?.length ?? 0) + (world.landscapeSurfaces?.length ?? 0) <= MAX_STREAM_SURFACE_QUADS, chunk.key);
        if (world.landscapeSurfaces?.length) assert.ok(packSurfaceQuads(world.landscapeSurfaces).every(Number.isFinite), chunk.key);
        assert.equal(world.surfaces?.length, world.chunks.reduce((sum, item) => sum + (item.surfaces?.length ?? 0), 0));
      }
    }
  }
  assert.ok(totalSurfaces > 10_000);
});

test("the mesh budget is enforced at upload and empty interior geometry stays empty", () => {
  assert.equal(packSurfaceQuads([]).length, 0);
  const road = compileRoad("flat", [{ x: 0, y: 0 }, { x: 10, y: 0 }], 6);
  const quad = roadStripQuad(road.sections[0], road.sections[1], -6, 6, 0, ROAD, MAT_ROAD);
  assert.throws(() => packSurfaceQuads(Array.from({ length: MAX_STREAM_SURFACE_QUADS + 1 }, () => quad)), /budget/);
});
