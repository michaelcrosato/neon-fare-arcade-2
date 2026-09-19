import assert from "node:assert/strict";
import test from "node:test";
import { defaultCameraBoom } from "../../game/config";
import type { Camera } from "../../game/model";
import { NavigationController } from "../../game/navigation";
import { makeGame } from "../../game/state";
import { projectWorldPoint, viewProjection } from "../../game/render/view-projection";
import { presentPickupReminder } from "../../app/runtime/pickup-reminder";

test("pickup reminders follow the cab across cameras and screen sizes without changing gameplay", () => {
  const game = makeGame("street-ace", 91, "free-run");
  const navigation = new NavigationController().update(game);
  for (const mobile of [false, true]) for (const mode of ["fixed", "chase-high", "chase-low", "cab"] as const) {
    for (const [width, height] of mobile ? [[390, 844], [844, 390]] : [[1280, 800], [1264, 625]]) {
      const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading: game.heading,
        mode, boom: defaultCameraBoom(mode), zoom: 1, mobile };
      const element = { style: {}, offsetWidth: mobile ? 350 : 440, offsetHeight: 96 } as unknown as HTMLElement;
      const before = structuredClone(game);
      const bounds = presentPickupReminder(element, game, camera, navigation, width, height)!;
      assert.equal(element.style.visibility, "visible");
      assert.ok(bounds.x >= 12 && bounds.x + bounds.width <= width - 12);
      assert.ok(bounds.y >= 12 && bounds.y + bounds.height <= height - 12);
      const cab = projectWorldPoint(viewProjection(game, camera, width / height, 1200), game.x, game.y, game.z + 2, width, height);
      if (mode !== "cab" && cab && cab.y > 240) assert.ok(bounds.y + bounds.height < cab.y, `${mode}: keep the cab visible below the tip`);
      assert.deepEqual(game, before);
    }
  }
});

test("taller screens bring the reminder down with the cab instead of leaving it at the top HUD", () => {
  const game = makeGame("street-ace", 91, "free-run");
  const navigation = new NavigationController().update(game);
  const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading: game.heading,
    mode: "chase-low", boom: defaultCameraBoom("chase-low"), zoom: 1 };
  const element = { style: {}, offsetWidth: 440, offsetHeight: 96 } as unknown as HTMLElement;
  const short = presentPickupReminder(element, game, camera, navigation, 1280, 625)!;
  const tall = presentPickupReminder(element, game, camera, navigation, 1280, 1000)!;
  assert.ok(tall.y > short.y + 100, "placement must follow the projected cab as the viewport grows");
  const exit = { x: tall.x + 200, y: tall.y + 80, width: 160, height: 70 };
  const adjusted = presentPickupReminder(element, game, camera, navigation, 1280, 1000, exit)!;
  assert.ok(adjusted.y + adjusted.height <= exit.y - 14, "leave a gap above the cab action and its pointer");
});
