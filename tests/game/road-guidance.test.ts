import assert from "node:assert/strict";
import test from "node:test";
import { DISPLAY_METERS_PER_WORLD_UNIT } from "../../game/config";
import { makeGame } from "../../game/state";
import { roadLanePose } from "../../game/road-lanes";
import { routeBoxes } from "../../game/render/scene";
import { navigationDistanceBadge } from "../../game/render/navigation-glyph";
import { isRoadSurface, sampleSpecialRoad } from "../../game/road-network";
import { groundAt } from "../../game/vehicle-road-contact";
import type { NavigationPlan } from "../../game/model";

test("road guidance occupies the right driving lane in all four travel directions", () => {
  const game = makeGame("street-ace", 501, "free-run");
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const route = [{ x: 0, y: 0, z: 0 }, { x: Math.cos(heading) * 24, y: Math.sin(heading) * 24, z: 0 }];
    const before = structuredClone(route);
    const boxes = routeBoxes(game, route);
    assert.ok(boxes.length > 0);
    for (const box of boxes) {
      const right = -Math.sin(heading) * box.x + Math.cos(heading) * box.y;
      assert.ok(Math.abs(right - 2.25) < .02, `${heading}: lateral ${right}`);
      assert.ok(isRoadSurface(box));
    }
    assert.deepEqual(route, before, "rendering must not change route distances or GPS geometry");
  }
});

test("a taxi already in its lane does not double the guidance offset", () => {
  const game = makeGame("street-ace", 502, "free-run");
  const boxes = routeBoxes(game, [{ x: 2.25, y: 0, z: .64 }, { x: 0, y: -36, z: 0 }]);
  for (const box of boxes) assert.ok(Math.abs(box.x - 2.25) < .02);
});

test("lane guidance follows real curves, grades and deck heights in either direction", () => {
  for (const id of ["starfall-drive", "stormwall-levee-road", "spruce-gorge-viaduct"]) {
    const sample = sampleSpecialRoad(id, 45);
    assert.ok(sample, id);
    for (const direction of [1, -1]) {
      const heading = sample.heading + (direction < 0 ? Math.PI : 0);
      const lane = roadLanePose(sample.center, heading);
      assert.ok(isRoadSurface(lane), `${id} ${direction}`);
      const right = -(lane.x - sample.center.x) * Math.sin(heading) + (lane.y - sample.center.y) * Math.cos(heading);
      assert.ok(right > 1.8 && right < 2.7, `${id}: ${right}`);
      assert.ok(Math.abs(groundAt(lane, .1).height - lane.z) < .03, id);
    }
  }
});

test("floating arrow badges show the total remaining route distance", () => {
  const game = makeGame("street-ace", 503, "free-run");
  const plan: NavigationPlan = { route: [{ x: 0, y: 0 }, { x: 0, y: -36 }, { x: 36, y: -36 }],
    requiresUTurn: false, departureYaw: -Math.PI / 2, travelHeading: -Math.PI / 2,
    turnCue: { point: { x: 0, y: -36, z: 20 }, incomingYaw: -Math.PI / 2, yaw: 0, kind: "right", distance: 36 } };
  const first = navigationDistanceBadge(game, 0, plan)!;
  assert.equal(first.distance, "72m");
  assert.equal(first.remaining, "TO DESTINATION");
  assert.ok(first.point.z > 28, "badge clears the elevated arrow");
  plan.turnCue!.distance = 12;
  assert.equal(navigationDistanceBadge(game, 0, plan)!.distance, "72m", "moving the turn cue does not change the route total");
  plan.route[0] = { x: 0, y: -24 };
  const remaining = `${Math.round(48 * DISPLAY_METERS_PER_WORLD_UNIT)}m`;
  assert.equal(navigationDistanceBadge(game, 0, plan)!.distance, remaining, "route progress reduces the remaining distance");
  plan.requiresUTurn = true;
  assert.equal(navigationDistanceBadge(game, 0, plan)!.label, "U-TURN");
  assert.equal(navigationDistanceBadge(game, 0, plan)!.distance, remaining);
  assert.equal(navigationDistanceBadge(game, 0, plan)!.remaining, "TO DESTINATION");
  plan.requiresUTurn = false; plan.turnCue = null;
  assert.equal(navigationDistanceBadge(game, 0, plan), null);
  game.player = { kind: "walking", actor: { ...game }, location: { kind: "city" } };
  plan.requiresUTurn = true;
  assert.equal(navigationDistanceBadge(game, 0, plan), null);
});
