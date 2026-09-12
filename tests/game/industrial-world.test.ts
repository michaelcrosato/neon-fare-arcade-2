import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CHUNK_BOXES, MAX_CHUNK_COLLIDERS, MAX_STREAM_BOXES, MAX_STREAM_COLLIDERS } from "../../game/config";
import { MAX_CHUNK_SURFACE_QUADS, MAX_STREAM_SURFACE_QUADS } from "../../game/render/surfaces";
import { IRONWAKE_ANCHORS, IRONWAKE_DRYDOCK, ironwakeIsWater, ironwakeWaterIntervalsAt } from "../../game/industrial-layout";
import { IRONWAKE_ROADS } from "../../game/industrial-roads";
import { industrialAnimatedBoxes } from "../../game/industrial-scenery";
import { generateCityChunk, CityStream } from "../../game/world";
import { circleHitsBuilding, taxiHitsBuilding } from "../../game/collision";
import { ambientPedestrianPointForBlock } from "../../game/render/scene";
import { atRoadElevation } from "../../game/terrain/region-forms";
import { makeTraffic } from "../../game/state";
import type { CityChunk, WorldPoint, WorldView } from "../../game/model";

const cache = new Map<string, CityChunk>();
for (let cx = -16; cx <= -6; cx++) for (let cy = 6; cy <= 16; cy++) cache.set(`${cx},${cy}`, generateCityChunk(cx, cy));
const industrialChunks = [...cache.values()];
for (const road of IRONWAKE_ROADS) for (const p of road.points) {
  const cx = Math.floor((p.x + 72) / 144), cy = Math.floor((p.y + 72) / 144), key = `${cx},${cy}`;
  if (!cache.has(key)) cache.set(key, generateCityChunk(cx, cy));
}
const chunks = [...cache.values()];
const world: WorldView = { key: "ironwake-sweep", chunks, boxes: chunks.flatMap(c => c.boxes),
  surfaces: chunks.flatMap(c => c.surfaces ?? []), colliders: chunks.flatMap(c => c.colliders), interactions: chunks.flatMap(c => c.interactions) };

test("all 121 industrial chunks and radius-three views fit the existing budgets", () => {
  assert.equal(industrialChunks.length, 121);
  for (const chunk of industrialChunks) {
    assert.ok(chunk.boxes.length <= MAX_CHUNK_BOXES);
    assert.ok(chunk.colliders.length <= MAX_CHUNK_COLLIDERS);
    assert.ok(chunk.surfaces!.length <= MAX_CHUNK_SURFACE_QUADS);
    assert.ok(chunk.interactions.length <= 12);
  }
  const stream = new CityStream();
  for (let cx = -16; cx <= -6; cx++) for (let cy = 6; cy <= 16; cy++) {
    const view = stream.update(cx * 144, cy * 144, 3);
    assert.ok(view.boxes.length <= MAX_STREAM_BOXES);
    assert.ok(view.colliders.length <= MAX_STREAM_COLLIDERS);
    assert.ok((view.surfaces?.length ?? 0) + (view.landscapeSurfaces?.length ?? 0) <= MAX_STREAM_SURFACE_QUADS);
    assert.ok(view.chunks.length <= 49);
  }
});

test("every harbor water strip blocks actors, while public gates stay clear and unique", () => {
  for (const chunk of industrialChunks) for (const water of chunk.surfaceRegions) {
    const collider = chunk.colliders.find(c => c.id === water.id);
    assert.ok(collider, water.id);
    assert.equal(collider.halfX, water.halfX);
    assert.equal(collider.halfY, water.halfY);
  }
  for (let y = 800; y < 2376; y += 17) for (const span of ironwakeWaterIntervalsAt(y)) {
    assert.ok(circleHitsBuilding(world, (span.min + span.max) / 2, y, .4, 0), `open water at ${y}`);
  }
  for (const anchor of IRONWAKE_ANCHORS) {
    const entrances = world.interactions.filter(i => i.label === anchor.label);
    assert.equal(entrances.length, 1, anchor.id);
    const p = entrances[0];
    assert.equal(Boolean(circleHitsBuilding(world, p.x, p.y, .55, p.z)), false, `${anchor.id} entrance blocked`);
    assert.equal(ironwakeIsWater(p.x, p.y), false, anchor.id);
  }
  assert.ok(circleHitsBuilding(world, IRONWAKE_DRYDOCK.minX + 5, 1800, .4, 0));
});

test("freight lanes stay driveable at their actual grades, with traffic on four new routes", () => {
  for (const road of IRONWAKE_ROADS) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], heading = Math.atan2(b.y - a.y, b.x - a.x);
    for (const t of [0, .5, 1]) for (const lane of [-2.25, 0, 2.25]) {
      const x = a.x + (b.x - a.x) * t - Math.sin(heading) * lane;
      const y = a.y + (b.y - a.y) * t + Math.cos(heading) * lane;
      const z = (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t + .64;
      assert.equal(Boolean(taxiHitsBuilding(world, x, y, heading, z)), false, `${road.id} blocked at ${x},${y},${z}`);
      assert.equal(ironwakeIsWater(x, y), false, `${road.id} submerged`);
    }
  }
  for (const point of [{ x: -1728, y: 792 }, { x: -792, y: 1368 }]) {
    const h = atRoadElevation<WorldPoint>(point).z!;
    const before = atRoadElevation<WorldPoint>({ x: point.x - .001, y: point.y - .001 }).z!;
    const after = atRoadElevation<WorldPoint>({ x: point.x + .001, y: point.y + .001 }).z!;
    assert.ok(Math.abs(before - h) < .02 && Math.abs(after - h) < .02, "neighbor seam must have continuous elevation");
  }
  const roadIds = new Set(IRONWAKE_ROADS.map(r => r.id));
  assert.equal(makeTraffic().filter(c => c.motion.kind === "path" && roadIds.has(c.motion.roadId)).length, 4);
});

test("industrial workers avoid machinery and water, and animated machinery remains bounded", () => {
  let count = 0;
  for (let bx = -66; bx < -22; bx++) for (let by = 22; by < 66; by++) for (const seconds of [0, 7, 31]) {
    for (let i = 0; i < 6; i++) {
      const p = ambientPedestrianPointForBlock(bx, by, seconds, i);
      if (!p) continue;
      count++;
      assert.equal(ironwakeIsWater(p.x, p.y), false);
      assert.equal(Boolean(circleHitsBuilding(world, p.x, p.y, .44, p.z)), false, `worker ${bx},${by}`);
    }
  }
  assert.ok(count > 500);
  for (const eye of [{ x: -1340, y: 1500 }, { x: -2034, y: 1584 }, { x: -1278, y: 2052 }]) {
    const first = industrialAnimatedBoxes(0, eye), second = industrialAnimatedBoxes(15, eye);
    assert.ok(first.length > 0 && first.length < 100);
    assert.notDeepEqual(first, second);
    assert.deepEqual(first, industrialAnimatedBoxes(0, eye));
  }
  assert.equal(industrialAnimatedBoxes(15, { x: 0, y: 0 }).length, 0);
});
