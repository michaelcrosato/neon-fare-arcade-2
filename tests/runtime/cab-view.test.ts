import assert from "node:assert/strict";
import test from "node:test";
import { compatibilityScene } from "../../app/compatibility-scene";
import { fareImpactObstacles } from "../../app/runtime/fare-impact-layout";
import { MAT_VEHICLE } from "../../game/config";
import type { Camera, NavigationPlan, WorldView } from "../../game/model";
import { makeGame } from "../../game/state";

const world: WorldView = { key: "open-first-person", boxes: [], colliders: [], chunks: [], interactions: [] };
const navigation: NavigationPlan = { route: [], departureYaw: 0, travelHeading: 0, requiresUTurn: false, turnCue: null };

test("Cab View draws no player vehicle or cabin, regardless of vehicle, driving model or graphics quality", () => {
  for (const vehicle of ["crown-cab", "accord-v6"] as const) for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 18, "free-run", model, vehicle);
    game.traffic = []; game.fareDispatchEnabled = false;
    for (const vehicleDetail of ["classic", "detailed"] as const) {
      const camera: Camera = { x: game.x, y: game.y, heading: game.heading, mode: "cab", zoom: 1, boom: 0, heightOffset: game.z, vehicleDetail };
      const scene = compatibilityScene(game, camera, 0, world, navigation);
      assert.equal(scene.focus.length, 0);
      assert.equal(scene.focusSurfaces.length, 0);
      assert.equal(scene.actors.filter(box => box.material === MAT_VEHICLE).length, 0, `${vehicle}/${model}/${vehicleDetail}`);
      assert.deepEqual(fareImpactObstacles(game, camera, 0, navigation, 1280, 800), [], "first-person cards no longer reserve dashboard space");
      const exterior = compatibilityScene(game, { ...camera, mode: "chase-low" }, 0, world, navigation);
      assert.ok(exterior.focus.length + exterior.focusSurfaces.length > 0, "exterior camera still draws the taxi");
    }
  }
});
