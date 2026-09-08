import assert from "node:assert/strict";
import test from "node:test";

import { FARES_PER_CYCLE } from "../../game/config";
import { EMPTY_HUD, makeHud } from "../../game/hud";
import { makeGame } from "../../game/state";

test("HUD projection exposes the opening fare without browser state", () => {
  const game = makeGame("street-ace", 0x48_55_44, "free-run");
  const hud = makeHud(game);
  assert.equal(hud.playerMode, "driving");
  assert.equal(hud.runKind, "free-run");
  assert.equal(hud.availablePickups.length, FARES_PER_CYCLE);
  assert.equal(hud.fareDestinations.length, FARES_PER_CYCLE);
  assert.ok(hud.route.length > 1);
  assert.ok(hud.distance > 0);
});

test("Off Duty HUD suppresses passenger presentation without mutating its baseline", () => {
  const game = makeGame("street-ace", 0x0f_f0, "free-run");
  game.fareDispatchEnabled = false;
  const hud = makeHud(game);
  assert.deepEqual(hud.route, []);
  assert.deepEqual(hud.availablePickups, []);
  assert.deepEqual(hud.fareDestinations, []);
  assert.equal(hud.gpsInstruction, "ROAM FREELY");
  assert.equal(EMPTY_HUD.fareDispatchEnabled, true);
});

test("HUD exposes simulation powertrain telemetry without browser state", () => {
  const game = makeGame("street-ace", 0x51_4d, "free-run", "simulation");
  game.simulationVehicle.gear = 3;
  game.simulationVehicle.engineRpm = 2_450;
  game.simulationVehicle.throttle = 0.72;
  const hud = makeHud(game);
  assert.equal(hud.drivingModel, "simulation");
  assert.equal(hud.simulationVehicle.gear, 3);
  assert.equal(hud.simulationVehicle.engineRpm, 2_450);
  assert.equal(hud.simulationVehicle.throttle, 0.72);
  assert.notEqual(hud.simulationVehicle, game.simulationVehicle);
  assert.equal(EMPTY_HUD.drivingModel, "arcade");
});
