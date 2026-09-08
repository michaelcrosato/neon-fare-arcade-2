import assert from "node:assert/strict";
import test from "node:test";

import {
  NavigationController,
  buildGpsRoute,
  buildNavigationPlan,
  compactRoute,
  gpsInstruction,
  nextTurnCue,
  routeLength,
  preferReverseRoute,
} from "../../game/navigation";
import { makeGame } from "../../game/state";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { routeCrossesRoundaboutIsland } from "../../game/road-network";
import { makeTestJob } from "./support/fixtures";

const NAV_JOB = makeTestJob({
  id: "rico",
  rider: "RICO",
  passengerArtCell: 0,
  destinationArtCell: 0,
  pickupStopId: "navigation-pickup",
  pickup: { x: 4.5, y: -12 },
  pickupApproach: { x: 4.5, y: -12 },
  dropoffStopId: "navigation-dropoff",
  dropoff: { x: -72, y: 18 },
  dropoffApproach: { x: -72, y: 18 },
  destination: "MARINA ARCADE",
});
const NAV_JOBS = [NAV_JOB] as const;

test("route compaction removes duplicates and collinear waypoints", () => {
  assert.deepEqual(
    compactRoute([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 20 },
      { x: 10, y: 20 },
    ]),
    [
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 10, y: 20 },
    ],
  );
});

test("the first fare route keeps its physical distance through the shared graph", () => {
  const route = buildGpsRoute({ x: 0, y: -12 }, { x: -72, y: 126 });
  assert.deepEqual(route, [
    { x: 0, y: -12 },
    { x: 0, y: 108 },
    { x: -72, y: 108 },
    { x: -72, y: 126 },
  ]);
  assert.equal(routeLength(route), 210);
});

test("U-turn policy requires both material savings and route ratio", () => {
  assert.equal(preferReverseRoute(65, 30), false); // ratio is large, savings are too small
  assert.equal(preferReverseRoute(164, 128), false); // savings qualify, ratio does not
  assert.equal(preferReverseRoute(168, 120), true);
  assert.equal(preferReverseRoute(Infinity, 120), true);
  assert.equal(preferReverseRoute(120, Infinity), false);
});

test("turn cues and GPS copy agree on direction", () => {
  const rightRoute = [
    { x: 0, y: 2 },
    { x: 0, y: 36 },
    { x: -36, y: 36 },
  ];
  const rightCue = nextTurnCue(rightRoute);
  assert.equal(rightCue?.kind, "right");
  assert.deepEqual(rightCue?.point, { x: 0, y: 36 });
  assert.equal(rightCue?.distance, 34);
  assert.equal(gpsInstruction(rightRoute, Math.PI / 2).text, "TURN RIGHT");

  const leftRoute = [
    { x: 0, y: 2 },
    { x: 0, y: 36 },
    { x: 36, y: 36 },
  ];
  assert.equal(nextTurnCue(leftRoute)?.kind, "left");
  assert.equal(gpsInstruction(leftRoute, Math.PI / 2).text, "TURN LEFT");
  assert.equal(gpsInstruction(leftRoute, 0).text, "BEAR RIGHT TO ROUTE");
  assert.equal(gpsInstruction(leftRoute, Math.PI / 2, undefined, true).text, "U-TURN WHEN SAFE");
});

test("planned approach direction keeps a lane-offset turn cue stable", () => {
  const laneOffsetRoute = [
    { x: 2.25, y: -20 },
    { x: 0, y: 0 },
    { x: -72, y: 0 },
  ];
  const cue = nextTurnCue(laneOffsetRoute, Math.PI / 2);
  assert.deepEqual(cue?.point, { x: 0, y: 0 });
  assert.equal(cue?.kind, "right");
  assert.equal(cue?.incomingYaw, Math.PI / 2);
});

test("navigation keeps the current turn until the taxi commits to its exit", () => {
  const controller = new NavigationController();
  const game = makeGame();
  game.fareJobs = [...NAV_JOBS];
  game.jobIndex = 0;
  game.onboard = true;
  game.x = 0;
  game.y = -20;
  game.heading = Math.PI / 2;
  game.elapsed = 0;

  assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0 });

  // Beginning to rotate is not the same as completing the turn.
  game.y = -5.3;
  game.heading = 1.75;
  game.elapsed = 0.2;
  assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0 });

  // Collinearity with the exit road must not compact the current corner out
  // of the live distance path before the turn is complete.
  for (const [x, elapsed] of [[-1, 0.22], [-3, 0.24], [-4.9, 0.26]] as const) {
    game.x = x;
    game.y = 0;
    game.heading = Math.PI;
    game.elapsed = elapsed;
    assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0 });
  }

  // Once the cab is established on the outgoing road, the next cue replaces
  // the old one atomically instead of producing a blank frame.
  game.x = -5;
  game.y = 0;
  game.heading = Math.PI;
  game.elapsed = 0.3;
  const nextCue = controller.update(game).turnCue;
  assert.ok(nextCue && nextCue.point.x < -60 && nextCue.point.x > -73 && Math.abs(nextCue.point.y) < 0.01);
  assert.equal(nextCue.kind, "left");
});

test("late exit alignment can complete a wide turn without a radial dead zone", () => {
  const controller = new NavigationController();
  const game = makeGame();
  game.fareJobs = [...NAV_JOBS];
  game.jobIndex = 0;
  game.onboard = true;
  game.x = 0;
  game.y = -20;
  game.heading = Math.PI / 2;
  game.elapsed = 0;
  assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0 });

  game.x = -9;
  game.y = 2.25;
  game.heading = Math.PI;
  game.elapsed = 0.2;
  const nextCue = controller.update(game).turnCue;
  assert.ok(nextCue && nextCue.point.x < -60 && nextCue.point.x > -73 && Math.abs(nextCue.point.y) < 0.01);
  assert.equal(nextCue.kind, "left");
});

test("normal turn guidance does not blink during heading-source jitter", () => {
  const controller = new NavigationController();
  const game = makeGame();
  game.fareJobs = [...NAV_JOBS];
  game.jobIndex = 0;
  game.onboard = true;
  game.x = 0;
  game.y = -20;
  game.heading = Math.PI / 2;
  game.elapsed = 0;
  assert.ok(controller.update(game).turnCue);

  for (const [headingError, elapsed] of [[1.39, 0.1], [1.41, 0.2], [1.39, 0.3]] as const) {
    game.heading = Math.PI / 2 + headingError;
    game.vx = 0;
    game.vy = 0;
    game.elapsed = elapsed;
    const plan = controller.update(game);
    assert.deepEqual(plan.turnCue?.point, { x: 0, y: 0 });
    assert.equal(gpsInstruction(plan.route, plan.travelHeading, plan.turnCue).text, "TURN RIGHT");
  }

  // Crossing the velocity-heading threshold used to destroy and recreate the
  // arrow even though the route itself had not changed.
  game.heading = Math.PI / 2;
  game.vx = 0;
  game.vy = -3.1;
  game.elapsed = 0.4;
  const aboveOldThreshold = controller.update(game);
  assert.equal(aboveOldThreshold.requiresUTurn, false);
  assert.deepEqual(aboveOldThreshold.turnCue?.point, { x: 0, y: 0 });
  game.vy = -2.9;
  game.elapsed = 0.5;
  const belowOldThreshold = controller.update(game);
  assert.equal(belowOldThreshold.requiresUTurn, false);
  assert.deepEqual(belowOldThreshold.turnCue?.point, { x: 0, y: 0 });
});

test("a missed turn swaps guidance on replan without an empty frame", () => {
  const controller = new NavigationController();
  const game = makeGame();
  game.fareJobs = [...NAV_JOBS];
  game.jobIndex = 0;
  game.onboard = true;
  game.x = 0;
  game.heading = Math.PI / 2;

  const samples = [
    { y: -6, elapsed: 0 },
    { y: -0.7, elapsed: 0.1 },
    { y: 0, elapsed: 0.2 },
    { y: 1, elapsed: 0.3 },
    { y: 1.6, elapsed: 0.4 },
  ];
  const cuePoints = samples.map((sample) => {
    game.y = sample.y;
    game.elapsed = sample.elapsed;
    return controller.update(game).turnCue?.point ?? null;
  });

  assert.deepEqual(cuePoints, [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 36 },
  ]);
});

test("navigation controller holds U-turn guidance until alignment is stable", () => {
  const controller = new NavigationController();
  const game = makeGame();
  game.fareJobs = [...NAV_JOBS];
  game.jobIndex = 0;
  game.x = 0;
  game.y = -25;
  game.heading = -Math.PI / 2;
  game.elapsed = 0;

  assert.equal(controller.update(game).requiresUTurn, true);

  game.heading = Math.PI / 2;
  game.elapsed = 0.1;
  assert.equal(controller.update(game).requiresUTurn, true);
  game.elapsed = 0.2;
  assert.equal(controller.update(game).requiresUTurn, true);
  game.elapsed = 0.3;
  assert.equal(controller.update(game).requiresUTurn, false);
});

test("cross-city navigation uses curved boulevards without false curve arrows", () => {
  const start = { x: -640, y: -425 };
  const target = { x: 640, y: 425 };
  const plan = buildNavigationPlan(start, target, 0.6);
  assert.ok(routeLength(plan.route) < 1700);
  assert.ok(plan.route.some((point) => (
    Math.abs(point.x / 36 - Math.round(point.x / 36)) > 0.02
    && Math.abs(point.y / 36 - Math.round(point.y / 36)) > 0.02
  )));
  assert.equal(plan.requiresUTurn, false);
  assert.equal(nextTurnCue(plan.route, plan.departureYaw), null);
});

test("roundabout routes follow the ring instead of crossing the island", () => {
  const plan = buildNavigationPlan(
    { x: 216, y: -182 },
    { x: 250, y: -216 },
    -Math.PI / 2,
  );
  assert.equal(routeCrossesRoundaboutIsland(plan.route), false);
  assert.ok(routeLength(plan.route) > 50 && routeLength(plan.route) < 70);
  assert.ok(plan.route.length >= 7);
  assert.ok(plan.route.some((point) => point.x > 216 && point.y > -216));
});

test("starting along a diagonal keeps the current direction before plotting ahead", () => {
  const boulevard = SPECIAL_ROADS.find((road) => road.id === "aurora-boulevard")!;
  const start = boulevard.points[18];
  const next = boulevard.points[19];
  const heading = Math.atan2(next.y - start.y, next.x - start.x);
  const target = boulevard.points[boulevard.points.length - 12];
  const plan = buildNavigationPlan(start, target, heading);
  assert.equal(plan.requiresUTurn, false);
  assert.ok(Math.abs(plan.departureYaw - heading) < 0.08);
});
