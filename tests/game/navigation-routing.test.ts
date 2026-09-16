import assert from "node:assert/strict";
import test from "node:test";
import { applyDevelopmentSettings } from "../../game/development-settings";
import { makeHud } from "../../game/hud";
import { NavigationController, buildNavigationPlan, gpsInstruction } from "../../game/navigation";
import { DEFAULT_NAVIGATION_SETTINGS, normalizeNavigationSettings } from "../../game/navigation-policy";
import { activePassengerJob, getNavigationTarget, makeGame } from "../../game/state";
import { navigationArrowBoxes, navigationDistanceBadge } from "../../game/render/navigation-glyph";
import { farePresentationBoxes, routeBoxes } from "../../game/render/scene";
import { availableCourierContracts, acceptCourierContract } from "../../game/courier";

test("route categories default on, validate saved values and work with Dev Mode off", () => {
  assert.deepEqual(normalizeNavigationSettings({ routePickups: "false", routeDropoffs: null, routeCustomDestinations: 0 }), DEFAULT_NAVIGATION_SETTINGS);
  const game = makeGame("street-ace", 93);
  applyDevelopmentSettings(game, { enabled: false, navigation: { routePickups: false } });
  assert.equal(game.development?.navigation.routePickups, false);
  assert.equal(game.development?.navigation.routeDropoffs, true);
  assert.equal(game.development?.navigation.routeCustomDestinations, true);
  assert.equal(game.playtest, undefined);
});

test("pickup routing switches off across HUD and road guides while fares, markers and the compass remain", () => {
  const game = makeGame("street-ace", 93);
  const jobs = structuredClone(game.fareJobs);
  const ring = activePassengerJob(game).pickup;
  const originalMarkers = farePresentationBoxes(game, 0);
  applyDevelopmentSettings(game, { navigation: normalizeNavigationSettings({ routePickups: false,
    arrowVisibility: "always", arrowTarget: "route", arrowSmoothing: "instant" }) });
  const plan = new NavigationController().update(game);
  assert.equal(plan.routingEnabled, false);
  assert.deepEqual(plan.route, []); assert.deepEqual(plan.roadRoute, []);
  assert.equal(plan.offRoute, false); assert.equal(plan.turnCue, null); assert.equal(plan.requiresUTurn, false);
  assert.equal(plan.vehicleArrowVisible, true);
  assert.equal(plan.departureArrowYaw, Math.atan2(ring.y - game.y, ring.x - game.x));
  assert.deepEqual(routeBoxes(game), []);
  for (const supplied of [undefined, plan, buildNavigationPlan(game, getNavigationTarget(game), game.heading)]) {
    const hud = makeHud(game, supplied);
    assert.deepEqual(hud.route, []); assert.equal(hud.routeDistance, 0);
    assert.equal(hud.gpsInstruction, "GPS ROUTING OFF");
    assert.equal(hud.needsUTurn, false); assert.equal(hud.turnCue, null); assert.equal(hud.routeTurnCue, null);
    assert.ok(hud.availablePickups.length > 0);
    if (supplied) {
      assert.deepEqual(routeBoxes(game, supplied.route, supplied), []);
      assert.equal(navigationDistanceBadge(game, 0, supplied), null);
      assert.equal(navigationArrowBoxes(game, 0, supplied, "fixed").length, supplied.vehicleArrowVisible ? 13 : 0);
    }
  }
  assert.equal(game.fareDispatchEnabled, true);
  assert.deepEqual(game.fareJobs, jobs);
  assert.deepEqual(farePresentationBoxes(game, 0), originalMarkers);
});

test("pickup, passenger dropoff, yellow waypoint and courier routing are independent", () => {
  const game = makeGame("street-ace", 93);
  const controller = new NavigationController();
  const pickupOff = normalizeNavigationSettings({ routePickups: false });
  assert.equal(controller.update(game, pickupOff).route.length, 0);
  game.onboard = true;
  assert.ok(controller.update(game, pickupOff).route.length > 1);
  const dropOff = { ...pickupOff, routeDropoffs: false };
  assert.equal(controller.update(game, dropOff).route.length, 0);
  game.customDestination = { x: 0, y: -360 };
  assert.ok(controller.update(game, dropOff).route.length > 1);
  assert.equal(controller.update(game, { ...dropOff, routeCustomDestinations: false }).route.length, 0);
  assert.deepEqual(game.customDestination, { x: 0, y: -360 });
  game.customDestination = null;
  assert.equal(controller.update(game, dropOff).route.length, 0, "clearing a pin respects disabled dropoff routing");
  game.onboard = false;
  assert.equal(acceptCourierContract(game, availableCourierContracts(game)[0].id).status, "accepted");
  assert.ok(controller.update(game, dropOff).route.length > 1);
  assert.equal(controller.update(game, { ...dropOff, routeCourierJobs: false }).route.length, 0);
  game.activeCourier!.stage = "dropoff";
  assert.equal(controller.update(game, { ...dropOff, routeCourierJobs: false }).route.length, 0);
  assert.ok(controller.update(game, dropOff).route.length > 1);
});

test("reenabling a category plans from the current position even with Hold Route and a long cooldown", () => {
  const game = makeGame("street-ace", 93);
  game.customDestination = { x: 0, y: -360 };
  const controller = new NavigationController();
  const enabled = normalizeNavigationSettings({ rerouteMode: "locked", rerouteCooldownSeconds: 10 });
  const first = controller.update(game, enabled);
  controller.update(game, { ...enabled, routeCustomDestinations: false });
  game.x = 144; game.y = 72; game.elapsed += .1;
  assert.deepEqual(controller.update(game, { ...enabled, routeCustomDestinations: false }).route, []);
  const restored = controller.update(game, enabled);
  assert.equal(restored.routingEnabled, true);
  assert.ok(restored.diagnostics!.revision > first.diagnostics!.revision);
  assert.deepEqual(restored.roadRoute![0], { x: 144, y: 72, z: game.z ?? 0 });
  assert.deepEqual(restored.route.at(-1), first.route.at(-1));
  assert.equal(controller.update(game, { ...enabled, routePickups: false }).diagnostics!.revision, restored.diagnostics!.revision,
    "changing an inactive category must not discard a held route");
});

test("roaming and empty routes never leave stale directions or request a U-turn", () => {
  assert.deepEqual(gpsInstruction([], 0, undefined, true), { text: "GPS ROUTING OFF", distance: 0 });
  const game = makeGame("street-ace", 93);
  game.fareDispatchEnabled = false;
  const plan = new NavigationController().update(game);
  assert.deepEqual(plan.route, []);
  assert.equal(makeHud(game, plan).gpsInstruction, "ROAM FREELY");
});
