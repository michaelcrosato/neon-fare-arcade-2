import assert from "node:assert/strict";
import test from "node:test";

import {
  clearCustomDestination,
  customDestinationForMapPoint,
  mapClientPointToWorld,
  moveCustomDestination,
  setCustomDestination,
} from "../../game/custom-destination";
import { FIXED_DT, YELLOW } from "../../game/config";
import {
  refreshFareDispatch,
  setFareDispatchEnabled,
} from "../../game/fare-selection";
import { distance } from "../../game/math";
import type { InputState, WorldView } from "../../game/model";
import { NavigationController, buildNavigationPlan } from "../../game/navigation";
import { routeBoxes } from "../../game/render/scene";
import { containingRegionForPosition } from "../../game/regions";
import { isRoadSurface } from "../../game/road-network";
import { stepGame } from "../../game/simulation";
import {
  getNavigationLabel,
  getNavigationTarget,
  getNavigationType,
  getObjective,
  getObjectiveKey,
  makeGame,
} from "../../game/state";

const EMPTY_WORLD: WorldView = {
  key: "custom-destination-test",
  boxes: [],
  colliders: [],
  chunks: [],
  interactions: [],
};

const IDLE_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

test("full-map pointer conversion accounts for horizontal and vertical letterboxing", () => {
  const viewBox = { minX: -100, minY: -50, width: 200, height: 100 };

  assert.deepEqual(
    mapClientPointToWorld(
      { x: 310, y: 120 },
      { left: 10, top: 20, width: 600, height: 200 },
      viewBox,
    ),
    { x: 0, y: 0 },
  );
  assert.equal(
    mapClientPointToWorld(
      { x: 50, y: 120 },
      { left: 10, top: 20, width: 600, height: 200 },
      viewBox,
    ),
    null,
  );
  assert.deepEqual(
    mapClientPointToWorld(
      { x: 210, y: 220 },
      { left: 10, top: 20, width: 400, height: 400 },
      viewBox,
    ),
    { x: 0, y: 0 },
  );
  assert.equal(
    mapClientPointToWorld(
      { x: 210, y: 60 },
      { left: 10, top: 20, width: 400, height: 400 },
      viewBox,
    ),
    null,
  );
  assert.equal(
    mapClientPointToWorld(
      { x: 0, y: 0 },
      { left: 0, top: 0, width: Number.NaN, height: 100 },
      viewBox,
    ),
    null,
  );
});

test("custom destinations snap to authored roads and reject inactive region cells", () => {
  const cedarStreet = customDestinationForMapPoint({ x: 1019, y: 17 });
  assert.ok(cedarStreet);
  assert.ok(distance(cedarStreet, { x: 1019, y: 17 }) < 50);
  assert.ok(isRoadSurface(cedarStreet));
  const copperMesaStreet = customDestinationForMapPoint({ x: 0, y: 1200 });
  assert.ok(copperMesaStreet);
  assert.equal(containingRegionForPosition(copperMesaStreet.x, copperMesaStreet.y)?.id, "copper-mesa");
  const cypressReachStreet = customDestinationForMapPoint({ x: 1000, y: 1200 });
  assert.ok(cypressReachStreet);
  assert.equal(containingRegionForPosition(cypressReachStreet.x, cypressReachStreet.y)?.id, "cypress-reach");
  assert.equal(customDestinationForMapPoint({ x: 1000, y: -1200 }), null);

  const moved = moveCustomDestination(cedarStreet, 36, 0);
  assert.ok(moved.x > cedarStreet.x);
  assert.equal(customDestinationForMapPoint(moved) !== null, true);
});

test("setting, replacing, and clearing a destination is run-scoped and idempotent", () => {
  const game = makeGame();
  assert.equal(game.customDestination, null);

  const first = setCustomDestination(game, { x: 108, y: 12 });
  assert.ok(first);
  assert.deepEqual(game.customDestination, first);
  const second = setCustomDestination(game, { x: 122, y: 72 });
  assert.ok(second);
  assert.deepEqual(game.customDestination, second);
  assert.notDeepEqual(second, first);

  assert.equal(clearCustomDestination(game), true);
  assert.equal(clearCustomDestination(game), false);
  assert.equal(game.customDestination, null);
  assert.equal(makeGame().customDestination, null);
});

test("navigation replans immediately when a custom destination changes or clears", () => {
  const game = makeGame();
  game.traffic = [];
  const controller = new NavigationController();
  const missionTarget = getNavigationTarget(game);
  const missionObjective = getObjective(game);
  const missionKey = getObjectiveKey(game);

  game.customDestination = { x: 72, y: 0 };
  assert.ok(distance(controller.update(game).route.at(-1)!, game.customDestination) < 0.001);
  assert.deepEqual(getObjective(game), missionObjective);
  assert.equal(getObjectiveKey(game), missionKey);
  assert.equal(getNavigationLabel(game), "CUSTOM DESTINATION");
  assert.equal(getNavigationType(game), "waypoint");
  game.customDestination = { x: 108, y: 36 };
  assert.ok(distance(controller.update(game).route.at(-1)!, game.customDestination) < 0.001);
  game.customDestination = null;
  assert.ok(distance(controller.update(game).route.at(-1)!, missionTarget) < 0.001);
});

test("arrival clears once, restores the job route, and never mutates the job", () => {
  const game = makeGame();
  game.traffic = [];
  const originalJob = game.fareJobs[game.jobIndex];
  game.customDestination = { x: game.x, y: game.y };

  const firstEvents = stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1);
  assert.equal(firstEvents.filter((event) => event.type === "custom-destination-arrived").length, 1);
  assert.equal(game.customDestination, null);
  assert.equal(game.onboard, false);
  assert.equal(game.fareJobs[game.jobIndex], originalJob);

  const secondEvents = stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1);
  assert.equal(secondEvents.some((event) => event.type === "custom-destination-arrived"), false);
  assert.deepEqual(getNavigationTarget(game), originalJob.pickupApproach);
});

test("custom GPS remains usable Off Duty and returns to free roam on arrival", () => {
  const game = makeGame("street-ace", 0xc057, "free-run");
  game.traffic = [];
  assert.equal(setFareDispatchEnabled(game, false), true);
  game.customDestination = { x: game.x, y: game.y };

  assert.equal(getNavigationType(game), "waypoint");
  assert.equal(getNavigationLabel(game), "CUSTOM DESTINATION");
  const events = stepGame(game, IDLE_INPUT, FIXED_DT, EMPTY_WORLD, () => 1);

  assert.equal(events.filter((event) => event.type === "custom-destination-arrived").length, 1);
  assert.equal(game.customDestination, null);
  assert.equal(game.message, "WAYPOINT REACHED");
  assert.equal(getNavigationType(game), "roam");
  assert.deepEqual(getNavigationTarget(game), { x: game.x, y: game.y });
});

test("clearing a custom route after Off Duty roaming immediately audits local fares", () => {
  const game = makeGame("street-ace", 0xc1ea, "free-run");
  assert.equal(setFareDispatchEnabled(game, false), true);
  game.customDestination = { x: 108, y: 0 };
  game.x = 1008;
  game.y = 0;
  game.elapsed = 3;

  assert.equal(setFareDispatchEnabled(game, true), true);
  assert.equal(game.fareStreamRevision, 0, "the foreground custom route protects the fare pool");
  assert.equal(clearCustomDestination(game), true);
  assert.equal(refreshFareDispatch(game), true);

  assert.equal(game.fareServiceRegionId, "cedar-vale");
  assert.equal(game.fareStreamRevision, 1);
  assert.equal(
    containingRegionForPosition(
      game.fareJobs[game.jobIndex].pickup.x,
      game.fareJobs[game.jobIndex].pickup.y,
    )?.id,
    "cedar-vale",
  );
  assert.deepEqual(getNavigationTarget(game), game.fareJobs[game.jobIndex].pickupApproach);
});

test("a custom cross-region route reaches its endpoint without exceeding the route actor cap", () => {
  const game = makeGame();
  game.x = 0;
  game.y = 0;
  game.heading = 0;
  game.customDestination = { x: 2300, y: 50 };
  const plan = buildNavigationPlan({ x: game.x, y: game.y }, game.customDestination, game.heading);
  const boxes = routeBoxes(game, plan.route);

  assert.ok(boxes.length > 100 && boxes.length <= 120);
  assert.ok(boxes.every((box) => box.color.every((channel, index) => channel === YELLOW[index])));
  assert.ok(distance(boxes.at(-1)!, game.customDestination) < 40);
});
