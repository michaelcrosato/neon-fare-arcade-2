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
  closestPointOnRoute,
  pointToSegmentDistance,
} from "../../game/navigation";
import { makeGame } from "../../game/state";
import { SPECIAL_ROADS } from "../../game/road-layout";
import { routeCrossesRoundaboutIsland } from "../../game/road-network";
import { makeTestJob } from "./support/fixtures";
import { DISPLAY_METERS_PER_WORLD_UNIT } from "../../game/config";
import { normalizeNavigationSettings } from "../../game/navigation-policy";

test("route deviation measures the closest physical deck, including elevation", () => {
  const player = { x: 10, y: 0, z: 0 };
  assert.equal(pointToSegmentDistance(player, { x: 0, y: 0, z: 80 }, { x: 20, y: 0, z: 80 }), 80);
  const nearest = closestPointOnRoute(player, [
    { x: 0, y: 0, z: 80 }, { x: 20, y: 0, z: 80 }, { x: 20, y: 40, z: 80 },
    { x: 0, y: 40, z: 0 }, { x: 20, y: 40, z: 0 },
  ]);
  assert.equal(nearest?.segment, 3);
  assert.equal(nearest?.distance, 40);
});

test("navigation settings retain meter units and normalize invalid or extreme input", () => {
  assert.deepEqual(normalizeNavigationSettings(), { rerouteDistanceMeters: 1000, uTurnSavingsMeters: 1000 });
  assert.deepEqual(normalizeNavigationSettings({ rerouteDistanceMeters: NaN, uTurnSavingsMeters: Infinity }), { rerouteDistanceMeters: 1000, uTurnSavingsMeters: 1000 });
  assert.deepEqual(normalizeNavigationSettings({ rerouteDistanceMeters: -10, uTurnSavingsMeters: 10001 }), { rerouteDistanceMeters: 0, uTurnSavingsMeters: 10000 });
});

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
    { x: 0, y: -12, z: 0 },
    { x: 0, y: 108, z: 0 },
    { x: -72, y: 108, z: 0 },
    { x: -72, y: 126, z: 0 },
  ]);
  assert.equal(routeLength(route), 210);
});

test("U-turn policy requires 1000 displayed meters of real distance savings", () => {
  const km = 1000 / DISPLAY_METERS_PER_WORLD_UNIT;
  assert.equal(preferReverseRoute(km - .001, 0), false);
  assert.equal(preferReverseRoute(km, 0), true);
  assert.equal(preferReverseRoute(1000, 940), true, "a long journey does not need a 1.4 route ratio");
  assert.equal(preferReverseRoute(65, 30), false);
  assert.equal(preferReverseRoute(Infinity, 120), false, "unknown forward travel cannot prove the required savings");
  assert.equal(preferReverseRoute(120, Infinity), false);
});

test("U-turn planning compares physical route lengths and respects custom savings", () => {
  const start = { x: 0, y: -25, z: 0 }, target = { x: 0, y: 14, z: 0 };
  assert.equal(buildNavigationPlan(start, target, -Math.PI / 2).requiresUTurn, false, "878m saved is below the default");
  assert.equal(buildNavigationPlan(start, target, -Math.PI / 2,
    { rerouteDistanceMeters: 1000, uTurnSavingsMeters: 500 }).requiresUTurn, true);
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

  assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0, z: 0 });

  // Beginning to rotate is not the same as completing the turn.
  game.y = -5.3;
  game.heading = 1.75;
  game.elapsed = 0.2;
  assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0, z: 0 });

  // Collinearity with the exit road must not compact the current corner out
  // of the live distance path before the turn is complete.
  for (const [x, elapsed] of [[-1, 0.22], [-3, 0.24], [-4.9, 0.26]] as const) {
    game.x = x;
    game.y = 0;
    game.heading = Math.PI;
    game.elapsed = elapsed;
    assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0, z: 0 });
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
  assert.deepEqual(controller.update(game).turnCue?.point, { x: 0, y: 0, z: 0 });

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
    assert.deepEqual(plan.turnCue?.point, { x: 0, y: 0, z: 0 });
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
  assert.deepEqual(aboveOldThreshold.turnCue?.point, { x: 0, y: 0, z: 0 });
  game.vy = -2.9;
  game.elapsed = 0.5;
  const belowOldThreshold = controller.update(game);
  assert.equal(belowOldThreshold.requiresUTurn, false);
  assert.deepEqual(belowOldThreshold.turnCue?.point, { x: 0, y: 0, z: 0 });
});

test("missing a turn by a few meters keeps the selected route and turn", () => {
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
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
  ]);
});

test("rerouting waits until more than 1000 meters from the closest route point", () => {
  const controller = new NavigationController();
  const game = makeGame();
  Object.assign(game, { fareJobs: [...NAV_JOBS], jobIndex: 0, onboard: true,
    x: 0, y: -20, z: 0, heading: Math.PI / 2, elapsed: 0 });
  const initial = controller.update(game);
  for (const meters of [100, 500, 999, 1000]) {
    Object.assign(game, { x: meters / DISPLAY_METERS_PER_WORLD_UNIT, y: -10, elapsed: game.elapsed + 1 });
    const plan = controller.update(game);
    assert.equal(plan.diagnostics?.revision, initial.diagnostics?.revision);
    assert.deepEqual(plan.route.slice(1), initial.route.slice(1), `${meters}m keeps the road path`);
  }
  game.x = 1001 / DISPLAY_METERS_PER_WORLD_UNIT;
  game.elapsed += 1;
  const rerouted = controller.update(game);
  assert.equal(rerouted.diagnostics?.revision, 2);
  assert.equal(rerouted.diagnostics?.reason, "deviation");
});

test("the deviation gate measures every remaining segment, including a later rejoin", () => {
  const controller = new NavigationController();
  const game = makeGame();
  Object.assign(game, { fareJobs: [...NAV_JOBS], jobIndex: 0, onboard: true,
    x: 0, y: -20, z: 0, heading: Math.PI / 2, elapsed: 0 });
  controller.update(game);
  Object.assign(game, { x: -72, y: 10, elapsed: 1 });
  const rejoined = controller.update(game);
  assert.equal(rejoined.diagnostics?.revision, 1, "rejoining a later segment advances the existing route");
  assert.ok((rejoined.diagnostics?.deviationMeters ?? Infinity) < .01);
  assert.ok(routeLength(rejoined.route) < 10);
});

test("a heading reversal near the route cannot force a reroute or unearned U-turn", () => {
  const controller = new NavigationController();
  const game = makeGame();
  Object.assign(game, { fareJobs: [...NAV_JOBS], jobIndex: 0, onboard: true,
    x: 0, y: -20, z: 0, heading: Math.PI / 2, elapsed: 0 });
  const initial = controller.update(game);
  game.heading = -Math.PI / 2;
  game.elapsed = 1;
  const rotated = controller.update(game);
  assert.equal(rotated.requiresUTurn, false);
  assert.deepEqual(rotated.route, initial.route);
  assert.equal(rotated.diagnostics?.revision, 1);
});

test("the reroute threshold can be changed for playtesting", () => {
  const controller = new NavigationController();
  const game = makeGame();
  Object.assign(game, { fareJobs: [...NAV_JOBS], jobIndex: 0, onboard: true,
    x: 0, y: -20, z: 0, heading: Math.PI / 2, elapsed: 0 });
  const settings = { rerouteDistanceMeters: 200, uTurnSavingsMeters: 1000 };
  controller.update(game, settings);
  Object.assign(game, { x: 201 / DISPLAY_METERS_PER_WORLD_UNIT, y: -10, elapsed: 1 });
  assert.equal(controller.update(game, settings).diagnostics?.revision, 2);
});

test("waiting at an arrival point retains one plan and its endpoint while moving nearby", () => {
  const controller = new NavigationController();
  const game = makeGame("street-ace", 12345);
  game.customDestination = { x: game.x, y: game.y, z: game.z };
  const destination = { ...game.customDestination };
  const initial = controller.update(game);
  for (let step = 1; step <= 20; step++) {
    game.elapsed += .1;
    game.x += .01;
    const plan = controller.update(game);
    assert.equal(plan.diagnostics!.revision, initial.diagnostics!.revision, "arrival cannot replan every frame");
    if (step > 10) assert.deepEqual(plan.route.at(-1), destination);
  }
});

test("a streamed curb refreshes the destination even when the rider key is unchanged", () => {
  const game = makeGame("street-ace", 12345);
  game.fareJobs = [structuredClone(NAV_JOB)];
  const controller = new NavigationController();
  const first = controller.update(game);
  game.fareJobs[0].pickupApproach = { x: 36, y: -16, z: 0 };
  const changed = controller.update(game);
  assert.equal(changed.diagnostics!.revision, first.diagnostics!.revision + 1);
  assert.equal(changed.diagnostics!.reason, "destination");
  assert.deepEqual(changed.route.at(-1), game.fareJobs[0].pickupApproach);
  game.fareDispatchEnabled = false;
  const roam = controller.update(game);
  game.x += 1;
  assert.equal(controller.update(game).diagnostics!.revision, roam.diagnostics!.revision, "off-duty motion is not a new destination");
});

test("navigation controller holds U-turn guidance until alignment is stable", () => {
  const controller = new NavigationController();
  const game = makeGame();
  game.fareJobs = [...NAV_JOBS];
  game.jobIndex = 0;
  game.x = 0;
  game.y = -18;
  game.z = 0;
  game.customDestination = { x: 0, y: 14, z: 0 };
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
