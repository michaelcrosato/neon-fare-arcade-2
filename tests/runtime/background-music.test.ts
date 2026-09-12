import assert from "node:assert/strict";
import test from "node:test";
import { BackgroundMusic, MUSIC_TRACKS, shuffledMusicTracks } from "../../app/runtime/background-music";
import { makeGame } from "../../game/state";
import type { Mode } from "../../game/model";

class FakeAudio extends EventTarget {
  volume = 1; preload = ""; src = ""; loop = false; muted = false; currentTime = 0; paused = true;
  plays = 0; pauses = 0;
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauses++; this.paused = true; }
  removeAttribute() { this.src = ""; }
  load() {}
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test("all bundled songs shuffle once per run and loop in that order on natural endings", async () => {
  const audio = new FakeAudio();
  let randomCalls = 0;
  const music = new BackgroundMusic(audio as unknown as HTMLAudioElement, () => { randomCalls++; return .3; });
  const game = makeGame("street-ace", 123, "free-run");
  music.update(game, "menu", false);
  music.unlock();
  await settled();
  assert.equal(audio.plays, 0, "opening menus must not start music");
  music.update(game, "countdown", false);
  await settled();
  const order = shuffledMusicTracks(() => .3);
  assert.deepEqual([...order].sort(), [...MUSIC_TRACKS]);
  assert.notDeepEqual(order, shuffledMusicTracks(() => .8));
  for (let index = 0; index < order.length * 2; index++) {
    assert.equal(audio.src, "/music/bgm_" + String(order[index % order.length]).padStart(2, "0") + ".mp3");
    assert.equal(audio.loop, false, "the whole playlist repeats, not one song");
    audio.currentTime = 120;
    audio.paused = true;
    audio.dispatchEvent(new Event("ended"));
    await settled();
    assert.equal(audio.currentTime, 0);
    assert.equal(audio.paused, false);
    music.update(game, "playing", false);
  }
  assert.equal(randomCalls, MUSIC_TRACKS.length - 1);
  music.destroy();
  assert.equal(audio.src, "");
  assert.equal(audio.paused, true);
});

test("pickup, dropoff, idle time, venues, pause, results and menus never interrupt or replace the song", async () => {
  const audio = new FakeAudio();
  const music = new BackgroundMusic(audio as unknown as HTMLAudioElement, () => .3);
  const game = makeGame("street-ace", 987, "free-run");
  music.update(game, "countdown", false);
  await settled();
  const firstSong = audio.src;
  audio.currentTime = 19;
  const check = async (mode: Mode = "playing", muted = false) => {
    music.update(game, mode, muted);
    await settled();
    assert.equal(audio.src, firstSong);
    assert.equal(audio.currentTime, 19);
    assert.equal(audio.paused, false);
    assert.equal(audio.volume, .38);
    assert.equal(audio.muted, muted);
  };
  game.elapsed = 31.5; await check();
  game.elapsed = 600; await check();
  game.onboard = true; await check();
  game.onboard = false; await check();
  game.player = { kind: "walking", actor: { x: 0, y: 0, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "interior", venue: { id: "test", kind: "diner", label: "DINER" }, returnPose: { x: 0, y: 0, heading: 0 } } };
  await check();
  game.player = { kind: "driving" }; await check();
  for (const mode of ["paused", "playing", "ended", "menu"] as const) await check(mode);
  await check("paused", true);
  await check("playing", false);
  assert.equal(audio.plays, 1);
  assert.equal(audio.pauses, 0);
  const nextGame = makeGame("street-ace", 456, "free-run");
  music.update(nextGame, "countdown", false);
  assert.equal(audio.currentTime, 0, "a new run restarts its shuffled playlist even if the first song is the same");
  music.destroy();
});

test("mobile music uses the shared unlocked Web Audio gain at a constant volume", async () => {
  const audio = new FakeAudio();
  Object.defineProperty(audio, "volume", { get: () => 1, set: () => {} });
  let connected = 0, disconnected = 0, resumed = 0;
  const gain = { gain: { value: 1 }, connect() { connected++; }, disconnect() { disconnected++; } };
  const source = { connect() { connected++; }, disconnect() { disconnected++; } };
  const context = { state: "suspended", destination: {}, createGain: () => gain, createMediaElementSource: () => source,
    resume() { resumed++; this.state = "running"; return Promise.resolve(); } };
  let unlocked: AudioContext | null = null;
  const music = new BackgroundMusic(audio as unknown as HTMLAudioElement, () => .3, () => unlocked);
  const game = makeGame("street-ace", 227, "free-run");
  unlocked = context as unknown as AudioContext;
  music.unlock(); await settled(); assert.equal(resumed, 1);
  music.update(game, "playing", false); await settled();
  game.elapsed = 600; music.update(game, "playing", false);
  assert.equal(gain.gain.value, .38);
  assert.equal(audio.paused, false);
  music.unlock(); assert.equal(connected, 2);
  music.destroy(); assert.equal(disconnected, 2);
  assert.equal(context.state, "running", "the shared context remains owned by the game");
});

test("blocked autoplay retries within a later user gesture and cleanup prevents further playback", async () => {
  const audio = new FakeAudio();
  let blocked = true;
  audio.play = () => {
    audio.plays++;
    if (blocked) return Promise.reject(new DOMException("Gesture required", "NotAllowedError"));
    audio.paused = false;
    return Promise.resolve();
  };
  const music = new BackgroundMusic(audio as unknown as HTMLAudioElement, () => .3);
  const game = makeGame("street-ace", 912);
  music.update(game, "countdown", false); await settled();
  assert.equal(audio.paused, true);
  music.update(game, "playing", false); await settled();
  assert.equal(audio.plays, 1, "do not retry a rejected autoplay on every frame");
  blocked = false;
  music.unlock(); await settled();
  assert.equal(audio.paused, false);
  music.destroy();
  music.unlock();
  music.update(game, "playing", false);
  audio.dispatchEvent(new Event("ended"));
  assert.equal(audio.plays, 2);
});

test("adopts the document audio element without autoplaying the menu", () => {
  const audio = new FakeAudio();
  (globalThis as unknown as Record<string, unknown>).document = {
    getElementById: (id: string) => id === "neon-fare-bgm" ? audio : null,
  };
  try {
    const music = new BackgroundMusic(undefined, () => .3);
    assert.equal(audio.preload, "auto");
    assert.equal(audio.plays, 0);
    music.destroy();
  } finally {
    delete (globalThis as unknown as Record<string, unknown>).document;
  }
});
