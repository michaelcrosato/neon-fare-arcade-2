import assert from "node:assert/strict";
import test from "node:test";
import { FARE_DROPOFF_RADIUS, FIXED_DT } from "../../game/config";
import { applyDevelopmentSettings, normalizeDevelopmentSettings } from "../../game/development-settings";
import { performDevelopmentAction } from "../../game/development-actions";
import { NavigationController } from "../../game/navigation";
import { makeGame, activePassengerJob } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { isRoadSurface } from "../../game/road-network";
import { makeTestWorld, TEST_IDLE_INPUT } from "./support/fixtures";
import { bankCareerRun, makeCareerState } from "../../game/career";

test("Dev Mode is opt-in, normalizes saved values and restores standard GPS when disabled", () => {
  const game = makeGame("street-ace", 271);
  const defaults = normalizeDevelopmentSettings(null);
  assert.equal(defaults.enabled, false);
  assert.deepEqual(defaults.navigation, { rerouteDistanceMeters: 1000, uTurnSavingsMeters: 1000 });
  assert.deepEqual(normalizeDevelopmentSettings({ enabled: "true", timeScale: Infinity, navigation: null }), defaults);
  const settings = normalizeDevelopmentSettings({ enabled: true, timeScale: 99,
    navigation: { rerouteDistanceMeters: -20, uTurnSavingsMeters: 99999 } });
  assert.equal(settings.timeScale, 2);
  assert.deepEqual(settings.navigation, { rerouteDistanceMeters: 0, uTurnSavingsMeters: 10000 });
  applyDevelopmentSettings(game, { ...defaults, enabled: true, navigation: settings.navigation });
  assert.equal(game.playtest, undefined, "GPS settings alone do not change run rewards");
  const before = structuredClone(game);
  applyDevelopmentSettings(game, { ...defaults, freezeClock: true, infiniteBoost: true });
  const control = structuredClone(before);
  delete control.development;
  stepGame(game, TEST_IDLE_INPUT, FIXED_DT, makeTestWorld(), () => .5);
  stepGame(control, TEST_IDLE_INPUT, FIXED_DT, makeTestWorld(), () => .5);
  assert.equal(game.timeLeft, control.timeLeft);
  assert.equal(game.boost, control.boost);
});

test("clock freeze and unlimited arcade boost are fixed-step rules and mark a sticky playtest", () => {
  const game = makeGame("street-ace", 271);
  game.customDestination = { x: 144, y: 0 };
  game.vy = -10; game.speed = 10; game.boost = 0;
  applyDevelopmentSettings(game, { enabled: true, freezeClock: true, infiniteBoost: true });
  const before = game.timeLeft;
  stepGame(game, { ...TEST_IDLE_INPUT, boost: true }, FIXED_DT, makeTestWorld(), () => .5);
  assert.equal(game.boosting, true);
  assert.equal(game.boost, 100);
  assert.equal(game.timeLeft, before);
  assert.equal(game.elapsed, FIXED_DT);
  assert.equal(game.playtest, true);
  applyDevelopmentSettings(game, { enabled: false });
  assert.equal(game.playtest, true);
  const career = makeCareerState();
  assert.deepEqual(bankCareerRun(career, { ...game, fare: 1000, score: 2000, deliveries: 3 }), career);
  stepGame(game, TEST_IDLE_INPUT, FIXED_DT, makeTestWorld(), () => .5);
  assert.ok(game.timeLeft < before);
  const simulation = makeGame("street-ace", 271, "free-run", "simulation");
  applyDevelopmentSettings(simulation, { enabled: true, infiniteBoost: true });
  stepGame(simulation, TEST_IDLE_INPUT, FIXED_DT, makeTestWorld(), () => .5);
  assert.equal(simulation.boost, 0, "simulation never gains arcade boost");
});

test("disabled Dev Mode cannot mutate the taxi or fare market", () => {
  const game = makeGame("street-ace", 271);
  const before = structuredClone(game);
  const result = performDevelopmentAction(game, { kind: "teleport-landmark", placeId: "pulse-stadium" });
  assert.equal(result.ok, false);
  assert.deepEqual(game, before);
});

test("landmark playtesting preserves six slots and uses safe roads, selected art and an explicit GPS revision", () => {
  const game = makeGame("street-ace", 271);
  applyDevelopmentSettings(game, { enabled: true });
  const controller = new NavigationController();
  const first = controller.update(game);
  const originalIds = game.fareJobs.map(job => job.id);
  assert.equal(performDevelopmentAction(game, { kind: "load-fare", placeId: "pulse-stadium", occasion: 1 }).ok, true);
  assert.equal(game.onboard, true);
  assert.equal(activePassengerJob(game).destinationCard!.occasion, "STADIUM CONCERT");
  assert.equal(activePassengerJob(game).destinationArtCell, 36);
  assert.deepEqual(game.fareJobs.map(job => job.id), originalIds);
  assert.equal(controller.update(game).diagnostics!.reason, "development");
  const fare = game.fare, score = game.score, time = game.timeLeft;
  game.simulationVehicle.overturned = true;
  assert.equal(performDevelopmentAction(game, { kind: "teleport-dropoff" }).ok, true);
  assert.equal(game.player.kind, "driving");
  assert.equal(game.simulationVehicle.overturned, false);
  assert.equal(isRoadSurface(game), true);
  assert.ok(Math.hypot(game.x - activePassengerJob(game).dropoff.x, game.y - activePassengerJob(game).dropoff.y) < FARE_DROPOFF_RADIUS,
    "jump to dropoff must land inside the arrival ring, not merely in the nearest lane");
  assert.equal(game.speed, 0);
  assert.equal(game.fare, fare); assert.equal(game.score, score); assert.equal(game.timeLeft, time);
  const next = controller.update(game);
  assert.ok(next.diagnostics!.revision > first.diagnostics!.revision);
  assert.equal(next.diagnostics!.reason, "development");
  assert.equal(game.playtest, true);
  assert.equal(game.towRecovery, null);
});

test("routing to a landmark preserves the passenger and ordinary run eligibility", () => {
  const game = makeGame("street-ace", 271);
  applyDevelopmentSettings(game, { enabled: true });
  game.onboard = true;
  const job = structuredClone(activePassengerJob(game));
  assert.equal(performDevelopmentAction(game, { kind: "route-landmark", placeId: "marina-arcade" }).ok, true);
  assert.ok(game.customDestination);
  assert.equal(game.onboard, true);
  assert.deepEqual(activePassengerJob(game), job);
  assert.equal(game.playtest, undefined);
  const before = structuredClone(game);
  assert.equal(performDevelopmentAction(game, { kind: "load-fare", placeId: "missing" }).ok, false);
  assert.deepEqual(game, before);
});
