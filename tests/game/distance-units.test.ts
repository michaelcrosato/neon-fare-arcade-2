import assert from "node:assert/strict";
import test from "node:test";
import { CYAN, DISPLAY_METERS_PER_WORLD_UNIT, FIXED_DT, ORANGE, PINK, RED, SPEED_KMH_PER_WORLD_UNIT, YELLOW } from "../../game/config";
import { acceptCourierContract, availableCourierContracts, COURIER_CONTRACTS, courierDistanceQuote } from "../../game/courier";
import { passengerDistanceQuote } from "../../game/fare-market";
import { makeHud } from "../../game/hud";
import { NavigationController, routeLength } from "../../game/navigation";
import { DEFAULT_NAVIGATION_SETTINGS, normalizeNavigationSettings } from "../../game/navigation-policy";
import { routeBoxes } from "../../game/render/scene";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";
import { makeTestWorld, TEST_IDLE_INPUT } from "./support/fixtures";
import type { NavigationPlan } from "../../game/model";

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} should equal ${expected}`);

test("navigation defaults match the selected playtest setup in full", () => {
  assert.deepEqual(DEFAULT_NAVIGATION_SETTINGS, {
    routePickups: false, routeDropoffs: true, routeCustomDestinations: true, routeCourierJobs: true,
    rerouteDistanceMeters: 200, uTurnSavingsMeters: 1000, arrowVisibility: "destination", arrowTarget: "destination",
    arrowSmoothing: "smooth", routeStyle: "both", corridorVisibility: "off-route", corridorHeightMeters: 400,
    corridorOpacity: .16, offRouteDistanceMeters: 12, rerouteMode: "locked", rerouteCooldownSeconds: 1,
    showRoadTurns: true, showDiagnostics: false,
  });
});

test("GPS meters follow velocity and direction: 60 km/h covers 100 m in six seconds", () => {
  const game = makeGame("street-ace", 1084072266);
  Object.assign(game, { x: 0, y: 0, z: 0, heading: -Math.PI / 2 });
  game.customDestination = { x: 0, y: -144 };
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ rerouteMode: "locked" });
  const first = controller.update(game, settings);
  const speed = 60 / SPEED_KMH_PER_WORLD_UNIT;
  game.y -= speed * 6; game.elapsed = 6;
  const forward = controller.update(game, settings);
  near((routeLength(first.route) - routeLength(forward.route)) * DISPLAY_METERS_PER_WORLD_UNIT, 100);
  near(forward.diagnostics!.deviationMeters, 0);
  assert.equal(makeHud(game, forward).distance, Math.round(routeLength(first.route) * DISPLAY_METERS_PER_WORLD_UNIT - 100));
  game.x += speed; game.elapsed++;
  const sideways = controller.update(game, settings);
  near(sideways.diagnostics!.deviationMeters, 60 / 3.6);
  assert.equal(sideways.offRoute, true);
  game.heading = Math.PI; game.elapsed++;
  near(controller.update(game, settings).diagnostics!.deviationMeters, sideways.diagnostics!.deviationMeters);
  game.y += speed; game.elapsed++;
  near(controller.update(game, settings).diagnostics!.deviationMeters, sideways.diagnostics!.deviationMeters);
  game.x = 0;
  const reverse = controller.update(game, settings);
  near((routeLength(reverse.route) - routeLength(forward.route)) * DISPLAY_METERS_PER_WORLD_UNIT, 60 / 3.6);
});

test("a reroute reports deviation against the new route, without one frame of stale distance", () => {
  const game = makeGame("street-ace", 91);
  game.customDestination = { x: 0, y: -360 };
  const controller = new NavigationController();
  const settings = normalizeNavigationSettings({ rerouteMode: "distance", rerouteDistanceMeters: 20 });
  controller.update(game, settings);
  game.x = 72; game.elapsed = 2;
  const replanned = controller.update(game, settings);
  assert.equal(replanned.diagnostics!.reason, "deviation");
  near(replanned.diagnostics!.deviationMeters, 0);
  assert.equal(replanned.offRoute, false);
});

test("passenger and courier quotes agree on physical route meters", () => {
  const from = { x: 0, y: 0 }, to = { x: 0, y: -144 };
  // 144 world units take 7.44 seconds at 60 km/h: exactly 124 meters.
  assert.equal(passengerDistanceQuote({ pickupApproach: from, dropoffApproach: to }).routeMeters, 124);
  const contract = COURIER_CONTRACTS[0];
  assert.equal(courierDistanceQuote({ ...contract, origin: { ...contract.origin, entrance: from },
    destination: { ...contract.destination, entrance: to } }).routeMeters, 124);
});

test("actual fixed-step travel, speed and the fuel odometer use the same meters in both driving models", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 921, "free-run", model);
    Object.assign(game, { x: 0, y: -12, z: 0, heading: -Math.PI / 2, vx: 0, vy: -60 / SPEED_KMH_PER_WORLD_UNIT, speed: 60 / SPEED_KMH_PER_WORLD_UNIT });
    game.traffic = []; game.fareDispatchEnabled = false;
    let traveled = 0, speedMeters = 0;
    const world = makeTestWorld();
    for (let i = 0; i < 120; i++) {
      const before = { x: game.x, y: game.y };
      stepGame(game, TEST_IDLE_INPUT, FIXED_DT, world, () => .5);
      traveled += Math.hypot(game.x - before.x, game.y - before.y);
      speedMeters += Math.hypot(game.vx, game.vy) * SPEED_KMH_PER_WORLD_UNIT / 3.6 * FIXED_DT;
    }
    assert.ok(traveled > 10);
    near(traveled * DISPLAY_METERS_PER_WORLD_UNIT, speedMeters);
    near(game.fuel.distanceKm * 1000, speedMeters);
  }
});

test("every enabled GPS color gets identical ground and vertical guide styles", () => {
  for (const [kind, color] of [["pickup", CYAN], ["dropoff", RED], ["custom", YELLOW], ["courier-pickup", ORANGE], ["courier-dropoff", PINK]] as const) {
    const game = makeGame("street-ace", 93);
    if (kind === "dropoff") game.onboard = true;
    if (kind === "custom") game.customDestination = { x: 0, y: -360 };
    if (kind.startsWith("courier")) {
      acceptCourierContract(game, availableCourierContracts(game)[0].id);
      if (kind === "courier-dropoff") game.activeCourier!.stage = "dropoff";
    }
    const settings = normalizeNavigationSettings({ routePickups: true });
    const route = [{ x: 0, y: 0 }, { x: 0, y: -360 }];
    const plan: NavigationPlan = { route, roadRoute: route, departureYaw: 0, travelHeading: 0, requiresUTurn: false, turnCue: null, settings, offRoute: true };
    const boxes = routeBoxes(game, route, plan);
    const dashes = boxes.filter(box => box.sz < 1), columns = boxes.filter(box => box.sz > 40);
    assert.ok(columns.length > 0 && boxes.length <= 120, kind);
    assert.equal(columns.length, dashes.length, kind);
    for (let i = 0; i < columns.length; i++) {
      assert.deepEqual(columns[i].color, [...color.slice(0, 3), .16], kind);
      assert.deepEqual([columns[i].x, columns[i].y, columns[i].sx, columns[i].sy], [dashes[i].x, dashes[i].y, dashes[i].sx, dashes[i].sy], kind);
      near(columns[i].sz * DISPLAY_METERS_PER_WORLD_UNIT, 400);
      near(columns[i].z - columns[i].sz / 2, dashes[i].z);
    }
    assert.ok(routeBoxes(game, route, { ...plan, offRoute: false }).every(box => box.sz < 1), kind);
    assert.deepEqual(routeBoxes(game, route, { ...plan, settings: { ...settings, routeStyle: "off" } }), []);
  }
});
