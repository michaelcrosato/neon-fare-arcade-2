import assert from "node:assert/strict";
import test from "node:test";
import { BackgroundMusic, shuffledFareTracks } from "../../app/runtime/background-music";
import { makeGame } from "../../game/state";

class FakeAudio extends EventTarget {
  volume = 1; preload = ""; src = ""; loop = false; muted = false; currentTime = 0; paused = true;
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ""; }
  load() {}
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test("playlist shuffles once and visits all five tracks before repeating", () => {
  const order = shuffledFareTracks(() => 0.3);
  assert.deepEqual([...order].sort(), [4, 5, 6, 7, 8]);
  assert.notDeepEqual(order, shuffledFareTracks(() => 0.8));
});

test("menu, start, pickups, completion, interiors, pause, mute and new-run reset", async () => {
  const audio = new FakeAudio();
  const music = new BackgroundMusic(audio as unknown as HTMLAudioElement, () => 0.3);
  const game = makeGame("street-ace", 123, "free-run");
  const update = async (mode: "menu" | "countdown" | "playing" | "paused" | "ended" = "playing", muted = false, hidden = false) => {
    music.update(game, mode, muted, hidden); await settled();
  };
  await update("menu"); assert.equal(audio.src, "/music/bgm_02.mp3"); assert.equal(audio.loop, true);
  await update("countdown"); assert.equal(audio.paused, true);
  const order = shuffledFareTracks(() => 0.3);
  for (const track of order) {
    game.onboard = true; await update();
    assert.equal(audio.src, `/music/bgm_0${track}.mp3`);
    assert.equal(audio.loop, false);
    game.onboard = false; await update(); assert.equal(audio.paused, true);
  }
  game.onboard = true; await update();
  assert.equal(audio.src, `/music/bgm_0${order[0]}.mp3`);
  audio.currentTime = 19;
  game.player = { kind: "walking", actor: { x: 0, y: 0, vx: 0, vy: 0, heading: 0, speed: 0 }, location: { kind: "interior", venue: { id: "test", kind: "diner", label: "DINER" }, returnPose: { x: 0, y: 0, heading: 0 } } };
  await update(); assert.equal(audio.src, "/music/bgm_01.mp3");
  game.player = { kind: "driving" }; await update(); assert.equal(audio.currentTime, 19);
  await update("paused"); assert.equal(audio.paused, true);
  await update("playing", true); assert.equal(audio.muted, true);
  await update("playing", false, true); assert.equal(audio.paused, true);
  await update(); audio.dispatchEvent(new Event("ended")); await settled();
  assert.equal(audio.src, `/music/bgm_0${order[1]}.mp3`); assert.equal(audio.currentTime, 0);
  music.update(makeGame("street-ace", 456), "countdown", false, false);
  game.onboard = true;
  music.update(game, "playing", false, false); await settled();
  assert.equal(audio.src, `/music/bgm_0${order[0]}.mp3`);
  music.update(game, "ended", false, false, true); await settled();
  assert.equal(audio.src, "/music/bgm_02.mp3"); assert.equal(audio.paused, false);
  music.update(game, "ended", false, false, false); assert.equal(audio.paused, true);
  music.destroy(); assert.equal(audio.paused, true); assert.equal(audio.src, "");
});
