import assert from "node:assert/strict";
import test from "node:test";
import { RoadGraph, type RoadGraphSegment, type RouteSearchStats } from "../../game/roads/graph";
import { roadDistance, type RoadControlPoint } from "../../game/roads/geometry";

function span(id: string, a: RoadControlPoint, b: RoadControlPoint, options: Partial<RoadGraphSegment> = {}): RoadGraphSegment {
  return { id, pathId: id, kind: "street", halfWidth: 6, travelWeight: 1, a, b, allowAB: true, allowBA: true, ...options };
}

test("landmark bounds preserve exact directed, elevated route costs and reduce search work", () => {
  const roads: RoadGraphSegment[] = [];
  for (let x = 0; x <= 28; x++) for (let y = 0; y <= 28; y++) {
    const a = { x: x * 10, y: y * 10, z: x > 14 ? 8 : 0 };
    if (x < 28) roads.push(span(`h${x}:${y}`, a, { ...a, x: a.x + 10, z: x >= 14 ? 8 : 0 }, { allowBA: y % 3 !== 0 }));
    if (y < 28) roads.push(span(`v${x}:${y}`, a, { ...a, y: a.y + 10 }, { travelWeight: x % 7 === 0 ? .8 : 1 }));
  }
  const oracle = new RoadGraph(roads, 0), indexed = new RoadGraph(roads);
  let originalWork = 0, indexedWork = 0, guidanceWork = 0;
  for (const [start, end] of [[{ x: 5, y: 10 }, { x: 275, y: 270, z: 8 }],
    [{ x: 275, y: 270, z: 8 }, { x: 5, y: 10 }], [{ x: 135, y: 20 }, { x: 145, y: 230, z: 8 }]]) {
    for (const direction of [1, -1] as const) {
      const baseline: RouteSearchStats = { expanded: 0, queued: 0 };
      const exact: RouteSearchStats = { expanded: 0, queued: 0 };
      const quick: RouteSearchStats = { expanded: 0, queued: 0 };
      const expected = oracle.route(start, end, 0, direction, 4, { stats: baseline })!;
      const actual = indexed.route(start, end, 0, direction, 4, { stats: exact })!;
      const guidance = indexed.route(start, end, 0, direction, 4, { heuristicWeight: 1.25, stats: quick })!;
      if (!expected) { assert.equal(actual, null); assert.equal(guidance, null); continue; }
      assert.ok(Math.abs(actual.cost - expected.cost) < 1e-7);
      assert.ok(guidance.cost <= expected.cost * 1.25 + 1e-7);
      assert.deepEqual(guidance.route[0], start);
      assert.deepEqual(guidance.route.at(-1), end);
      assert.equal(guidance.departureYaw, actual.departureYaw);
      originalWork += baseline.expanded; indexedWork += exact.expanded; guidanceWork += quick.expanded;
    }
  }
  assert.ok(indexedWork < originalWork * .65, `${indexedWork} vs ${originalWork} expanded states`);
  assert.ok(guidanceWork < indexedWork * .65, `${guidanceWork} vs ${indexedWork} expanded states`);
});

test("guidance retains one-way loops and never joins disconnected decks", () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 }, c = { x: 100, y: 100 }, d = { x: 0, y: 100 };
  const graph = new RoadGraph([span("a", a, b, { allowBA: false }), span("b", b, c, { allowBA: false }),
    span("c", c, d, { allowBA: false }), span("d", d, a, { allowBA: false }),
    span("deck", { ...a, z: 12 }, { ...b, z: 12 })], 4);
  const quick = { heuristicWeight: 1.25 };
  assert.equal(graph.route({ x: 30, y: 0 }, { x: 20, y: 0 }, undefined, 1, 0, quick)!.cost, 390);
  assert.equal(graph.route(a, { ...a, z: 12 }, undefined, 1, 0, quick), null);
});

test("virtual endpoints give a direct route within one span, including a legal reverse", () => {
  const graph = new RoadGraph([span("street", { x: 0, y: 0 }, { x: 100, y: 0 })]);
  const route = graph.route({ x: 20, y: 0 }, { x: 30, y: 0 }, 0)!;
  assert.deepEqual(route.route, [{ x: 20, y: 0 }, { x: 30, y: 0 }]);
  assert.equal(route.cost, 10);
  assert.equal(graph.route({ x: 30, y: 0 }, { x: 20, y: 0 }, 0, -1)!.cost, 10);
});

test("one-way roads reject a backward shortcut and route around the legal loop", () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 }, c = { x: 100, y: 100 }, d = { x: 0, y: 100 };
  const graph = new RoadGraph([
    span("a", a, b, { allowBA: false }), span("b", b, c, { allowBA: false }),
    span("c", c, d, { allowBA: false }), span("d", d, a, { allowBA: false }),
  ]);
  const route = graph.route({ x: 30, y: 0 }, { x: 20, y: 0 })!;
  assert.equal(route.cost, 390);
  assert.ok(route.route.some((point) => point.y === 100));
  assert.equal(graph.route({ x: 30, y: 0 }, { x: 20, y: 0 }, 0, -1), null);
});

test("a crossing at the same XY is disconnected until a real ramp joins its deck", () => {
  const low = { x: 0, y: 0, z: 0 }, high = { x: 0, y: 0, z: 12 };
  const lowEnd = { x: 100, y: 0, z: 0 }, highEnd = { x: 0, y: 100, z: 12 };
  const roads = [span("underpass", low, lowEnd), span("bridge", high, highEnd)];
  const disconnected = new RoadGraph(roads);
  assert.equal(disconnected.nearest(low).segment.id, "underpass");
  assert.equal(disconnected.nearest(high).segment.id, "bridge");
  assert.equal(disconnected.route(low, high), null);
  const graph = new RoadGraph([...roads, span("ramp", lowEnd, highEnd, { kind: "ramp" })]);
  const route = graph.route(low, high)!;
  assert.ok(route.route.some((point) => point.x === 100));
  assert.ok(route.route.some((point) => point.y === 100));
  assert.ok(route.route.some((point) => point.z === 12));
  assert.equal(route.cost, 200 + roadDistance(lowEnd, highEnd));
  assert.equal(route.usesSpecialRoad, true);
});

test("route costs include climbing distance and honor authored travel weights", () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 30, y: 0, z: 40 }, c = { x: 60, y: 0, z: 0 };
  const graph = new RoadGraph([span("up", a, b), span("down", b, c)]);
  assert.equal(graph.route(a, c)!.cost, 100);
  const fast = new RoadGraph([span("up", a, b), span("down", b, c), span("fast", a, c, { travelWeight: 0.5, kind: "highway" })]);
  assert.equal(fast.route(a, c)!.cost, 30);
});

test("directed departure respects heading before a destination behind the driver", () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  const graph = new RoadGraph([span("main", a, b), span("north", b, { x: 100, y: 100 })]);
  const forward = graph.route({ x: 40, y: 0 }, { x: 20, y: 0 }, 0)!;
  assert.equal(forward.departureYaw, 0);
  assert.equal(forward.route[1].x, 100);
  const reverse = graph.route({ x: 40, y: 0 }, { x: 20, y: 0 }, 0, -1)!;
  assert.equal(reverse.cost, 20);
});

test("indexed nearest road agrees with a brute-force oracle across a large elevated lattice", () => {
  const segments: RoadGraphSegment[] = [];
  for (let x = -20; x <= 20; x += 1) {
    for (let y = -20; y <= 20; y += 1) {
      segments.push(span(`${x},${y}`, { x: x * 36, y: y * 36, z: x % 3 === 0 ? 12 : 0 }, { x: x * 36 + 36, y: y * 36, z: x % 3 === 0 ? 12 : 0 }));
    }
  }
  const graph = new RoadGraph(segments);
  for (let index = 0; index < 60; index += 1) {
    const point = { x: Math.sin(index * 13.1) * 800, y: Math.cos(index * 7.3) * 800, z: index % 2 ? 12 : 0 };
    const nearest = graph.nearest(point);
    const oracle = segments.map((segment) => {
      const x = Math.max(segment.a.x, Math.min(segment.b.x, point.x));
      return { segment, score: Math.hypot(point.x - x, point.y - segment.a.y, (point.z - (segment.a.z ?? 0)) * 4) };
    }).sort((a, b) => a.score - b.score)[0];
    assert.equal(nearest.segment.id, oracle.segment.id);
  }
});

test("junction classification also uses elevation", () => {
  const low = { x: 0, y: 0 }, high = { x: 0, y: 0, z: 12 };
  const graph = new RoadGraph([
    span("west", { x: -20, y: 0 }, low), span("east", low, { x: 20, y: 0 }),
    span("north", low, { x: 0, y: -20 }), span("upper", high, { x: 0, y: 20, z: 12 }),
  ]);
  assert.equal(graph.isJunction(low), true);
  assert.equal(graph.isJunction(high), false);
});
