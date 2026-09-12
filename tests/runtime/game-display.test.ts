import assert from "node:assert/strict";
import test from "node:test";
import { protectGameGestures, requestGameFullscreen } from "../../app/runtime/game-display";

test("fullscreen uses the document root and hides navigation without blocking unsupported starts", async () => {
  const calls: unknown[] = [];
  const doc = { fullscreenElement: null, documentElement: {
    requestFullscreen(options: unknown) { calls.push(options); return Promise.resolve(); },
  } };
  await requestGameFullscreen(doc as unknown as Document);
  assert.deepEqual(calls, [{ navigationUI: "hide" }]);
  await requestGameFullscreen({ ...doc, fullscreenElement: {} } as unknown as Document);
  assert.equal(calls.length, 1);
  await assert.doesNotReject(requestGameFullscreen({ documentElement: {} } as Document));
  await assert.doesNotReject(requestGameFullscreen({ documentElement: {
    requestFullscreen: () => Promise.reject(new Error("Not supported")),
  } } as unknown as Document));
  let webkitCalls = 0;
  await requestGameFullscreen({ documentElement: { webkitRequestFullscreen() { webkitCalls++; } } } as unknown as Document);
  assert.equal(webkitCalls, 1);
});

test("touch gestures are canceled only while playing and listeners are released on cleanup", () => {
  const stage = new EventTarget();
  let playing = true;
  const cleanup = protectGameGestures(stage as HTMLElement, () => playing);
  for (const type of ["touchmove", "gesturestart", "gesturechange", "contextmenu"]) {
    const event = new Event(type, { cancelable: true });
    stage.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  playing = false;
  const menuScroll = new Event("touchmove", { cancelable: true });
  stage.dispatchEvent(menuScroll);
  assert.equal(menuScroll.defaultPrevented, false, "menus remain scrollable");
  playing = true;
  cleanup();
  const afterCleanup = new Event("touchmove", { cancelable: true });
  stage.dispatchEvent(afterCleanup);
  assert.equal(afterCleanup.defaultPrevented, false);
});
