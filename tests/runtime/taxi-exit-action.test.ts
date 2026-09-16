import assert from "node:assert/strict";
import test from "node:test";
import { presentTaxiExitAction } from "../../app/runtime/taxi-exit-action";
import { makeGame } from "../../game/state";
import { defaultCameraBoom } from "../../game/config";
import { localPoint } from "../../game/math";
import { projectWorldPoint, viewProjection } from "../../game/render/view-projection";
import type { Camera } from "../../game/model";

test("exit action follows the passenger side through exterior cameras, headings and all cars", () => {
  for (const vehicle of ["crown-cab", "accord-v6", "gtr-r35"] as const) for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 91, "free-run", model, vehicle);
    game.x = 0; game.y = 0; game.z = 0;
    for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as const) for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      game.heading = heading;
      const camera: Camera = { x: 0, y: 0, heightOffset: 0, heading, mode, boom: defaultCameraBoom(mode, 1), zoom: 1 };
      const element = { style: {}, dataset: {}, offsetWidth: 126, offsetHeight: 54, parentElement: null } as unknown as HTMLButtonElement;
      const bounds = presentTaxiExitAction(element, game, camera, 1280, 800)!;
      assert.equal(element.style.visibility, "visible");
      if (mode === "cab") { assert.ok(bounds.x > 640, "first-person action belongs on the passenger's right"); continue; }
      const matrix = viewProjection(game, camera, 1.6, 1200);
      const passenger = localPoint(game.x, game.y, heading, -.35, 1.15);
      const driver = localPoint(game.x, game.y, heading, -.35, -1.15);
      const passengerScreen = projectWorldPoint(matrix, passenger.x, passenger.y, 1.15, 1280, 800)!;
      const driverScreen = projectWorldPoint(matrix, driver.x, driver.y, 1.15, 1280, 800)!;
      const center = bounds.x + bounds.width / 2;
      assert.ok(Math.abs(center - passengerScreen.x) < Math.abs(center - driverScreen.x), `${vehicle}/${model}/${mode}/${heading}: action must sit on the passenger side`);
    }
  }
});
