import assert from "node:assert/strict";
import test from "node:test";
import {
  compileRoad, projectRoadSegment, roadDistance, roadRibbon, sampleRoad, sampleRoadCurve,
  type RoadControlPoint,
} from "../../game/roads/geometry";
import { RoadSpatialIndex } from "../../game/roads/spatial-index";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { compiledSpecialRoad, sampleSpecialRoad } from "../../game/road-network";

const near = (actual: number, expected: number, tolerance = 1e-7) => (
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
);
const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;

test("3D adaptive curves preserve controls, bound spans and deterministic output", () => {
  const controls: RoadControlPoint[] = [
    { x: 0, y: 0, z: 0, halfWidth: 6 },
    { x: 6, y: -2, z: 1, halfWidth: 7 },
    { x: 70, y: 20, z: 12, halfWidth: 10 },
    { x: 90, y: -30, z: 24, halfWidth: 6 },
    { x: 100, y: -29, z: 25, halfWidth: 6 },
  ];
  const curve = { kind: "catmull-rom", points: controls } as const;
  const samples = sampleRoadCurve(curve, { maxSegmentLength: 4, maxChordError: 0.05 });
  assert.deepEqual(samples, sampleRoadCurve(curve, { maxSegmentLength: 4, maxChordError: 0.05 }));
  for (const control of controls) assert.ok(samples.some((point) => roadDistance(point, control) === 0));
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(roadDistance(samples[index - 1], samples[index]) <= 4 + 1e-8);
    assert.ok((samples[index].halfWidth ?? 0) >= 6);
    assert.ok((samples[index].halfWidth ?? 0) <= 10);
  }
});

test("Bezier S bends and vertical crests cannot hide behind a collinear midpoint", () => {
  const samples = sampleRoadCurve({ kind: "bezier", points: [
    { x: 0, y: 0, z: 0 }, { x: 20, y: 60, z: 30 },
    { x: 80, y: -60, z: -30 }, { x: 100, y: 0, z: 0 },
  ] }, { maxSegmentLength: 200, maxChordError: 0.05 });
  assert.ok(samples.length > 20);
  assert.ok(samples.some((point) => point.y > 15 && point.z! > 7));
  assert.ok(samples.some((point) => point.y < -15 && point.z! < -7));
});

test("stationary Bezier handles are valid and zero-length Catmull controls are removed", () => {
  const samples = sampleRoadCurve({ kind: "bezier", points: [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 0 },
  ] });
  near(samples[0].x, 0);
  near(samples[samples.length - 1].x, 40);
  const repeated = sampleRoadCurve({ kind: "catmull-rom", points: [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 },
  ] });
  assert.ok(repeated.every((point) => Number.isFinite(point.x + point.y)));
});

test("arc length includes elevation, supports reverse and never overshoots open endpoints", () => {
  const road = compileRoad("hill", [{ x: 0, y: 0, z: 0 }, { x: 30, y: 0, z: 40 }], 6);
  near(road.length, 50);
  const mid = sampleRoad(road, 25);
  near(mid.point.x, 15);
  near(mid.point.z, 20);
  near(mid.grade, 4 / 3);
  near(sampleRoad(road, -10).point.x, 0);
  near(sampleRoad(road, 100).point.x, 30);
});

test("banked variable-width sections share an orthonormal frame and exact lane surface", () => {
  const road = compileRoad("bank", [
    { x: 0, y: 0, z: 0, bank: 0.2, halfWidth: 5 },
    { x: 80, y: 0, z: 8, bank: 0.2, halfWidth: 9 },
  ], 6);
  const sample = sampleRoad(road, road.length / 2, 3);
  near(sample.halfWidth, 7);
  near(dot(sample.forward, sample.right), 0);
  near(dot(sample.forward, sample.normal), 0);
  near(dot(sample.right, sample.normal), 0);
  near(dot(sample.normal, sample.normal), 1);
  assert.ok(sample.point.z > sample.center.z);
  const projected = projectRoadSegment(road, 0, sample.point);
  near(projected.lateralOffset, 3);
  near(projected.point.z, sample.point.z);
  near(projected.surfaceDistance, 0);
});

test("lane positions and headings stay continuous through bends and closed seams", () => {
  const road = compileRoad("loop", sampleRoadCurve({
    kind: "catmull-rom", closed: true,
    points: [{ x: 0, y: -30 }, { x: 30, y: 0 }, { x: 0, y: 30 }, { x: -30, y: 0 }],
  }), 6, true);
  for (const section of road.sections) {
    const before = sampleRoad(road, section.distance - 0.0001, 2.25);
    const after = sampleRoad(road, section.distance + 0.0001, 2.25);
    assert.ok(roadDistance(before.point, after.point) < 0.001);
    assert.ok(dot(before.forward, after.forward) > 0.9999);
  }
  const strip = roadRibbon(road);
  assert.deepEqual(strip[0].left, strip[strip.length - 1].left);
  assert.deepEqual(strip[0].right, strip[strip.length - 1].right);
  assert.deepEqual(sampleRoad(road, -3).point, sampleRoad(road, road.length - 3).point);
});

test("projection agrees with lane sampling across twisting hill sections", () => {
  const road = compileRoad("twist", sampleRoadCurve({ kind: "catmull-rom", points: [
    { x: 0, y: 0, z: 0, bank: 0 }, { x: 35, y: 10, z: 9, bank: 0.15 },
    { x: 50, y: 60, z: 15, bank: -0.1 }, { x: 100, y: 70, z: 8, bank: 0 },
  ] }), 7);
  for (let distance = 0; distance < road.length; distance += 0.7) {
    for (const offset of [-5, -2.25, 0, 2.25, 5]) {
      const sample = sampleRoad(road, distance, offset);
      const projected = projectRoadSegment(road, sample.segmentIndex, sample.point);
      near(projected.lateralOffset, offset, 1e-5);
      near(projected.point.z, sample.point.z, 1e-5);
      near(projected.surfaceDistance, 0, 1e-5);
    }
  }
});

test("the road index separates stacked decks and finds spans across cell boundaries", () => {
  const lower = compileRoad("underpass", [{ x: -90, y: 0 }, { x: 90, y: 0 }], 6);
  const upper = compileRoad("bridge", [{ x: 0, y: -90, z: 12 }, { x: 0, y: 90, z: 12 }], 8);
  const index = new RoadSpatialIndex([upper, lower]);
  assert.equal(index.query({ x: 0, y: 0, z: 0 })[0].roadId, "underpass");
  assert.equal(index.query({ x: 0, y: 0, z: 12 })[0].roadId, "bridge");
  assert.equal(index.query({ x: 71.9, y: 3 }, 0)[0].roadId, "underpass");
  assert.equal(index.query({ x: 500, y: 500 }).length, 0);
  near(index.query({ x: 0, y: 0, z: 0 }).find((sample) => sample.roadId === "bridge")!.heightDistance, 12);
});

test("invalid authoring fails explicitly instead of leaking NaN or exhausting subdivision", () => {
  assert.throws(() => sampleRoadCurve({ kind: "polyline", points: [{ x: 0, y: 0 }, { x: NaN, y: 1 }] }));
  assert.throws(() => compileRoad("bad", [{ x: 0, y: 0 }, { x: 0, y: 0, z: 10 }], 6));
  assert.throws(() => compileRoad("bad", [{ x: 0, y: 0 }, { x: 10, y: 0, halfWidth: -1 }], 6));
  assert.throws(() => sampleRoadCurve({ kind: "polyline", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }, { maxSegmentLength: 0.001, maxDepth: 2 }));
});

test("every existing traffic road uses the compiled geometry with continuous lane joins", () => {
  for (const definition of SPECIAL_ROADS) {
    const road = compiledSpecialRoad(definition.id)!;
    assert.ok(road.length > 0, definition.id);
    for (const section of road.sections.slice(1, -1)) {
      const before = sampleSpecialRoad(definition.id, section.distance - 0.0001, 2.25)!;
      const after = sampleSpecialRoad(definition.id, section.distance + 0.0001, 2.25)!;
      assert.ok(roadDistance(before.point, after.point) < 0.001, definition.id);
      assert.ok(dot(before.forward, after.forward) > 0.9999, definition.id);
    }
  }
});
