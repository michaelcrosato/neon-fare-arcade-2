import assert from "node:assert/strict";
import test from "node:test";
import { applyDevelopmentSettings, navigationSettingsForGame, normalizeDevelopmentSettings } from "../../game/development-settings";
import { NavigationController } from "../../game/navigation";
import { DEFAULT_NAVIGATION_SETTINGS, normalizeNavigationSettings } from "../../game/navigation-policy";
import { activePassengerJob, makeGame } from "../../game/state";
import { vehicleDepartureArrowBoxes } from "../../game/render/navigation-glyph";
import { routeCorridorBoxes, ROUTE_GUIDE_BUDGET } from "../../game/render/route-corridor";
import { routeBoxes } from "../../game/render/scene";
import { normalizeAngle } from "../../game/math";
import { makeWalkingActor, taxiPose } from "../../game/player";
import { sampleSpecialRoad } from "../../game/road-network";
import type { NavigationPlan } from "../../game/model";
import { projectWorldPoint, viewProjection } from "../../game/render/view-projection";
import { boxSurfaceFaces } from "../../game/render/surfaces";

test("navigation experiments validate old saves and malformed controls without enabling Dev Mode", () => {
  const game = makeGame("street-ace", 91);
  const defaults = normalizeNavigationSettings({ rerouteDistanceMeters: 600 });
  assert.equal(defaults.rerouteDistanceMeters, 600);
  assert.equal(defaults.arrowVisibility, "contextual");
  assert.deepEqual(normalizeNavigationSettings({ arrowVisibility: "invalid", corridorOpacity: "0.8", showDiagnostics: "true" }), DEFAULT_NAVIGATION_SETTINGS);
  const bounded = normalizeNavigationSettings({ corridorHeightMeters: Infinity, corridorOpacity: 8, rerouteCooldownSeconds: -2 });
  assert.equal(bounded.corridorHeightMeters, DEFAULT_NAVIGATION_SETTINGS.corridorHeightMeters);
  assert.equal(bounded.corridorOpacity, .4);
  assert.equal(bounded.rerouteCooldownSeconds, .1);
  applyDevelopmentSettings(game, { enabled: false, navigation: { arrowVisibility: "always", rerouteDistanceMeters: 600 } });
  assert.equal(navigationSettingsForGame(game).rerouteDistanceMeters, 600);
  assert.equal(game.playtest, undefined);
  assert.equal(normalizeDevelopmentSettings({ enabled: false, navigation: { rerouteDistanceMeters: 600 } }).navigation.rerouteDistanceMeters, 100,
    "old inactive GPS tuning must not become active during migration");
  assert.equal(normalizeDevelopmentSettings({ enabled: true, navigation: { rerouteDistanceMeters: 600 } }).navigation.rerouteDistanceMeters, 600);
});

test("always-on destination arrow tracks the actual ring center after the departure timer expires", () => {
  const game = makeGame("street-ace", 91);
  const controller = new NavigationController();
  const job = activePassengerJob(game);
  const settings = normalizeNavigationSettings({ arrowVisibility: "always", arrowTarget: "destination", arrowSmoothing: "instant", rerouteMode: "locked" });
  controller.update(game, settings);
  for (const onboard of [false, true]) {
    game.onboard = onboard;
    const ring = onboard ? job.dropoff : job.pickup;
    game.x = ring.x + 180; game.y = ring.y + 80; game.elapsed += 10;
    const plan = controller.update(game, settings);
    game.elapsed += 10;
    const later = controller.update(game, settings);
    assert.equal(later.vehicleArrowVisible, true);
    assert.ok(Math.abs(normalizeAngle(later.departureArrowYaw! - Math.atan2(ring.y - game.y, ring.x - game.x))) < 1e-9);
    assert.equal(vehicleDepartureArrowBoxes(game, 0, later, "chase-low").length, 13);
    assert.equal(later.diagnostics?.revision, plan.diagnostics?.revision);
  }
});

test("red-destination-only arrow ignores pickups, custom waypoints, off duty and walking", () => {
  const game = makeGame("street-ace", 91);
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ arrowVisibility: "destination", arrowTarget: "destination" });
  assert.equal(controller.update(game, settings).vehicleArrowVisible, false);
  game.onboard = true;
  assert.equal(controller.update(game, settings).vehicleArrowVisible, true);
  game.customDestination = { x: 144, y: 0 };
  assert.equal(controller.update(game, settings).vehicleArrowVisible, false);
  game.customDestination = null; game.onboard = false; game.fareDispatchEnabled = false;
  assert.equal(controller.update(game, { ...settings, arrowVisibility: "always" }).vehicleArrowVisible, false);
  game.onboard = true;
  game.player = { kind: "walking", actor: makeWalkingActor(taxiPose(game)), location: { kind: "city" } };
  const walking = controller.update(game, settings);
  assert.equal(walking.vehicleArrowVisible, false);
  assert.deepEqual(vehicleDepartureArrowBoxes(game, 0, walking, "cab"), []);
});

test("locked GPS keeps its route after a missed road; destination changes still replan", () => {
  const game = makeGame("street-ace", 91);
  game.customDestination = { x: 0, y: -360 };
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ rerouteMode: "locked", rerouteDistanceMeters: 10 });
  const first = controller.update(game, settings);
  game.x = 72; game.elapsed = 5;
  const missed = controller.update(game, settings);
  assert.equal(missed.diagnostics?.revision, first.diagnostics?.revision);
  assert.equal(missed.offRoute, true);
  assert.deepEqual(missed.roadRoute, first.roadRoute, "road guide never stretches from the deviated cab");
  game.customDestination = { x: 144, y: -360 };
  assert.equal(controller.update(game, settings).diagnostics?.reason, "destination");
});

test("reroute cooldown is configurable and visual changes do not discard the route", () => {
  const game = makeGame("street-ace", 91);
  game.customDestination = { x: 0, y: -360 };
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ rerouteCooldownSeconds: 5, rerouteDistanceMeters: 10 });
  const first = controller.update(game, settings);
  game.x = 72; game.elapsed = 4.9;
  assert.equal(controller.update(game, { ...settings, arrowVisibility: "always" }).diagnostics?.revision, first.diagnostics?.revision);
  game.elapsed = 5;
  assert.equal(controller.update(game, settings).diagnostics?.reason, "deviation");
});

test("vertical red dashes retain the lane footprint, are translucent, bounded and conditional on deviation", () => {
  const game = makeGame("street-ace", 91);
  game.onboard = true;
  game.x = 0; game.y = 0; game.heading = -Math.PI / 2;
  const job = activePassengerJob(game);
  job.dropoff = { x: 8, y: -360 }; job.dropoffApproach = { x: 0, y: -360 };
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ routeStyle: "corridor", rerouteMode: "locked" });
  const initial = controller.update(game, settings);
  assert.ok(routeBoxes(game, initial.route, initial).every(box => box.sz === .1));
  game.x = 72; game.elapsed = 5;
  const plan = controller.update(game, settings);
  const boxes = routeBoxes(game, plan.route, plan);
  assert.ok(boxes.length > 0 && boxes.length <= ROUTE_GUIDE_BUDGET);
  assert.ok(boxes.every(box => box.color[3]! > 0 && box.color[3]! < .5 && box.sz >= 100 && box.sy === .48 && box.sx === 2.8));
  assert.ok(boxes.every(box => Math.abs(box.x) < 10), "thin columns remain on the north/south street");
  const dashes = routeBoxes(game, plan.roadRoute, { ...plan, settings: { ...settings, routeStyle: "dashes" } });
  assert.deepEqual(boxes, routeCorridorBoxes(dashes, settings));
  game.x = 0; game.elapsed = 5.1;
  const rejoined = controller.update(game, settings);
  assert.ok(routeBoxes(game, rejoined.route, rejoined).every(box => box.sz === .1));
});

test("vertical guide activates strictly beyond its distance threshold and respects deck height", () => {
  const game = makeGame("street-ace", 91);
  game.z = 0;
  game.customDestination = { x: 0, y: -360 };
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ rerouteMode: "locked", offRouteDistanceMeters: 12 });
  controller.update(game, settings);
  Object.assign(game, { x: 2.25, y: -12, z: .64, elapsed: 3 });
  assert.equal(controller.update(game, settings).offRoute, false, "the ordinary traffic lane is on route");
  Object.assign(game, { x: 12, y: -12, z: 0, elapsed: 4 });
  assert.equal(controller.update(game, settings).offRoute, false);
  game.x += .001;
  assert.equal(controller.update(game, settings).offRoute, true);
  game.x = 0; game.z = 15;
  assert.equal(controller.update(game, settings).offRoute, true, "a different deck is still off route");
});

test("vertical dots start on graded pavement and combined guidance retains the 120-box budget", () => {
  const game = makeGame("street-ace", 91);
  game.onboard = true;
  const settings = normalizeNavigationSettings({ routeStyle: "both", corridorVisibility: "always" });
  for (const id of ["starfall-drive", "stormwall-levee-road", "spruce-gorge-viaduct"]) {
    const a = sampleSpecialRoad(id, 45)!.center;
    const b = sampleSpecialRoad(id, 70)!.center;
    const plan: NavigationPlan = { route: [a, b], roadRoute: [a, b], departureYaw: 0, travelHeading: 0,
      requiresUTurn: false, turnCue: null, settings };
    const boxes = routeBoxes(game, plan.route, plan);
    const dashes = boxes.filter(box => box.sz < 1), columns = boxes.filter(box => box.sz >= 40);
    assert.ok(columns.length > 0);
    assert.equal(columns.length, dashes.length);
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i], dash = dashes[i];
      assert.ok(Math.abs(column.z - column.sz / 2 - dash.z) < 1e-8, `${id}: base stays at pavement`);
      assert.equal(column.x, dash.x); assert.equal(column.y, dash.y);
      assert.equal(column.pitch, 0); assert.equal(column.tilt, 0);
    }
  }
  const route = [{ x: 0, y: 0 }, { x: 0, y: -720 }, { x: 720, y: -720 }, { x: 720, y: 720 }];
  const plan: NavigationPlan = { route, roadRoute: route, departureYaw: 0, travelHeading: 0, requiresUTurn: false, turnCue: null, settings };
  const boxes = routeBoxes(game, route, plan);
  assert.ok(boxes.length >= 100 && boxes.length <= ROUTE_GUIDE_BUDGET);
  game.onboard = false;
  assert.ok(routeBoxes(game, route, plan).every(box => box.sz < 1), "pickup routes never get red columns");
});

test("the Cab View arrow fits above the road in every bearing on desktop and phone", () => {
  const game = makeGame("street-ace", 91);
  Object.assign(game, { x: 0, y: 0, z: 0, heading: 0 });
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const matrix = viewProjection(game, { x: 0, y: 0, heading: 0, heightOffset: 0, mode: "cab", zoom: 1, boom: 0 }, width / height, 1200);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const plan: NavigationPlan = { route: [], departureYaw: yaw, departureArrowYaw: yaw, travelHeading: 0,
        requiresUTurn: false, turnCue: null, vehicleArrowVisible: true, vehicleArrowFade: 1 };
      const points = vehicleDepartureArrowBoxes(game, 0, plan, "cab")
        .flatMap(box => boxSurfaceFaces(box).flatMap(face => face.corners))
        .map(point => projectWorldPoint(matrix, point.x, point.y, point.z, width, height));
      assert.ok(points.every(point => point && point.x >= 0 && point.x <= width && point.y >= 0 && point.y < height / 2),
        `${width}px yaw ${yaw}: ${JSON.stringify({ x: [Math.min(...points.map(p => p?.x ?? 0)), Math.max(...points.map(p => p?.x ?? 0))], y: [Math.min(...points.map(p => p?.y ?? 0)), Math.max(...points.map(p => p?.y ?? 0))] })}`);
      const ys = points.map(point => point!.y);
      assert.ok(Math.max(...ys) - Math.min(...ys) < height * .25, "arrow cannot cover the forward view");
    }
  }
});
