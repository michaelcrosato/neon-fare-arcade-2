import assert from "node:assert/strict";
import test from "node:test";
import { RoadGraph, type RoadGraphSegment } from "../../game/roads/graph";
import { roadDistance, type RoadControlPoint } from "../../game/roads/geometry";

function span(id: string, a: RoadControlPoint, b: RoadControlPoint, options: Partial<RoadGraphSegment> = {}): RoadGraphSegment {
  return { id, pathId: id, kind: "street", halfWidth: 6, travelWeight: 1, a, b, allowAB: true, allowBA: true, ...options };
}

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
