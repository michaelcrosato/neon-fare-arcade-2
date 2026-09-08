import assert from "node:assert/strict";
import test from "node:test";

import {
  FARE_PICKUP_RADIUS,
  FARE_STOP_RULES,
  TAXI_START,
} from "../../game/config";
import { analyzeFareStopPlacement } from "../../game/fare-placement";
import { syncNearestFareTarget } from "../../game/fare-selection";
import { cityRouteDistance } from "../../game/fare-market";
import {
  nearestRoad,
  normalizeAngle,
  rightHandTrafficLane,
} from "../../game/math";
import { buildNavigationPlan } from "../../game/navigation";
import {
  activePassengerJob,
  getNavigationTarget,
  getNavigationType,
  getObjective,
  getObjectiveKey,
  getObjectiveLabel,
  makeGame,
  makeTraffic,
} from "../../game/state";
import { isRoadSurface } from "../../game/road-network";

test("right-hand traffic uses the correct side for every axis and direction", () => {
  assert.equal(rightHandTrafficLane("x", 0, 1), 2.25);
  assert.equal(rightHandTrafficLane("x", 0, -1), -2.25);
  assert.equal(rightHandTrafficLane("y", 0, 1), -2.25);
  assert.equal(rightHandTrafficLane("y", 0, -1), 2.25);
});

test("traffic and initial game state are deterministic", () => {
  const first = makeTraffic();
  const second = makeTraffic();
  assert.deepEqual(first, second);
  assert.equal(first.length, 36);
  assert.deepEqual(first[0].motion, { kind: "grid", axis: "x" });
  assert.equal(first[0].dir, 1);
  assert.equal(first[0].y, rightHandTrafficLane("x", nearestRoad(first[0].y), 1));
  const pathTraffic = first.filter((car) => car.motion.kind === "path");
  assert.equal(pathTraffic.length, 21);
  assert.ok(pathTraffic.every((car) => isRoadSurface(car)));

  const game = makeGame();
  assert.deepEqual(
    { x: game.x, y: game.y, heading: game.heading, countdown: game.countdown },
    { ...TAXI_START, countdown: 3 },
  );
});

test("cycle zero selects a safe pickup a little ahead and inside the opening view", () => {
  for (let seed = 0; seed < 8; seed += 1) {
    const game = makeGame("street-ace", seed);
    const originalIndex = game.jobIndex;
    const job = activePassengerJob(game);
    const dx = job.pickup.x - game.x;
    const dy = job.pickup.y - game.y;
    const forwardX = Math.cos(game.heading);
    const forwardY = Math.sin(game.heading);
    const forward = dx * forwardX + dy * forwardY;
    const right = dx * -forwardY + dy * forwardX;
    const approachDx = job.pickupApproach.x - game.x;
    const approachDy = job.pickupApproach.y - game.y;
    const approachForward = approachDx * forwardX + approachDy * forwardY;

    assert.equal(originalIndex, 0);
    assert.ok(forward >= FARE_STOP_RULES.openingForwardMin);
    assert.ok(forward <= FARE_STOP_RULES.openingForwardMax);
    assert.ok(right >= FARE_STOP_RULES.openingRightMin);
    assert.ok(right <= FARE_STOP_RULES.openingRightMax);
    assert.ok(approachForward > 0);
    assert.ok(
      cityRouteDistance({ x: game.x, y: game.y }, job.pickupApproach)
        <= FARE_STOP_RULES.openingRouteMax,
    );
    assert.equal(
      buildNavigationPlan(
        { x: game.x, y: game.y },
        job.pickupApproach,
        game.heading,
      ).requiresUTurn,
      false,
    );
    assert.equal(analyzeFareStopPlacement(job.pickup, FARE_PICKUP_RADIUS).safe, true);

    syncNearestFareTarget(game);
    assert.equal(game.jobIndex, originalIndex);
  }
});

test("Off Duty resolves to a stable roam objective at the taxi", () => {
  const game = makeGame("street-ace", 41, "free-run");
  game.x = 216;
  game.y = -144;
  game.fareDispatchEnabled = false;

  assert.deepEqual(getObjective(game), { x: game.x, y: game.y });
  assert.deepEqual(getNavigationTarget(game), { x: game.x, y: game.y });
  assert.equal(getObjectiveLabel(game), "ROAM FREELY");
  assert.equal(getObjectiveKey(game), "off-duty");
  assert.equal(getNavigationType(game), "roam");
});

test("angle normalization is stable across complete rotations", () => {
  assert.equal(normalizeAngle(Math.PI * 2), 0);
  assert.equal(normalizeAngle(-Math.PI * 2), 0);
  assert.ok(Math.abs(normalizeAngle(Math.PI * 2.5) - Math.PI / 2) < 1e-12);
});
