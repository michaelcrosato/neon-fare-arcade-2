import assert from "node:assert/strict";
import test from "node:test";
import { BackgroundMusic, MENU_MUSIC_TRACK, MUSIC_TRACKS, shuffledMusicTracks } from "../../app/runtime/background-music";
import { DEFAULT_AUDIO_SETTINGS as defaults } from "../../app/runtime/audio-settings";
import { makeGame } from "../../game/state";

class FakeAudio extends EventTarget {
  volume = 1; preload = ""; src = ""; loop = false; muted = false; currentTime = 0; paused = true;
  plays = 0; pauses = 0;
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauses++; this.paused = true; }
  removeAttribute() { this.src = ""; }
  load() {}
}
const settled = () => new Promise(resolve => setImmediate(resolve));
function setup(random = () => .3, context: () => AudioContext | null = () => null) {
  const audio = new FakeAudio(), menu = new FakeAudio();
  const music = new BackgroundMusic(audio as unknown as HTMLAudioElement, random, context, menu as unknown as HTMLAudioElement);
  return { audio, menu, music };
}

test("menus use a separate theme and each driving playlist shuffles once then repeats on natural endings", async () => {
  let randomCalls = 0;
  const { audio, menu, music } = setup(() => { randomCalls++; return .3; });
  const game = makeGame("street-ace", 123, "free-run");
  music.update(game, "menu"); music.unlock(); await settled();
  assert.equal(audio.plays, 0);
  assert.equal(menu.src, `/music/bgm_0${MENU_MUSIC_TRACK}.mp3`);
  assert.equal(menu.loop, true);
  assert.equal(menu.paused, false);
  music.update(game, "countdown"); await settled();
  assert.equal(menu.paused, true);
  const order = shuffledMusicTracks(() => .3);
  assert.deepEqual([...order].sort(), [...MUSIC_TRACKS]);
  assert.equal(order.includes(MENU_MUSIC_TRACK), false);
  assert.notDeepEqual(order, shuffledMusicTracks(() => .8));
  for (let index = 0; index < order.length * 2; index++) {
    assert.equal(audio.src, "/music/bgm_" + String(order[index % order.length]).padStart(2, "0") + ".mp3");
    assert.equal(audio.loop, false);
    audio.currentTime = 120; audio.paused = true;
    audio.dispatchEvent(new Event("ended")); await settled();
    assert.equal(audio.currentTime, 0); assert.equal(audio.paused, false);
    music.update(game, "playing");
  }
  assert.equal(randomCalls, MUSIC_TRACKS.length - 1);
  music.destroy();
  assert.equal(audio.src, ""); assert.equal(menu.src, "");
  assert.equal(audio.paused, true); assert.equal(menu.paused, true);
});

test("pausing saves the driving song position while only menu music plays; resume never reshuffles", async () => {
  const { audio, menu, music } = setup();
  const game = makeGame("street-ace", 917, "free-run");
  music.update(game, "playing"); await settled();
  audio.currentTime = 37; const song = audio.src;
  game.elapsed = 600; game.onboard = true;
  music.update(game, "playing"); assert.equal(audio.currentTime, 37);
  game.onboard = false;
  for (const mode of ["paused", "ended", "menu"] as const) {
    music.update(game, mode); await settled();
    assert.equal(audio.paused, true, "pause must stop the driving song");
    assert.equal(menu.paused, false);
    assert.equal(audio.src, song); assert.equal(audio.currentTime, 37);
    music.update(game, "playing"); await settled();
    assert.equal(menu.paused, true); assert.equal(audio.paused, false);
    assert.equal(audio.currentTime, 37); assert.equal(audio.src, song);
  }
  music.update(makeGame("street-ace", 918, "free-run"), "countdown");
  assert.equal(audio.currentTime, 0, "only a fresh run resets its playlist");
  music.destroy();
});

test("music volume, master and mute affect both transports without changing their positions", async () => {
  const { audio, menu, music } = setup();
  const game = makeGame("street-ace", 345);
  const settings = { ...defaults, masterVolume: .5, musicVolume: .6 };
  music.update(game, "playing", settings); await settled();
  assert.ok(Math.abs(audio.volume - .114) < 1e-9); assert.ok(Math.abs(menu.volume - .114) < 1e-9);
  audio.currentTime = 17;
  music.update(game, "paused", { ...settings, muted: true }); await settled();
  assert.equal(audio.muted, true); assert.equal(menu.muted, true);
  assert.equal(audio.volume, 0); assert.equal(menu.volume, 0);
  music.update(game, "playing", settings); await settled();
  assert.equal(audio.currentTime, 17); assert.ok(Math.abs(audio.volume - .114) < 1e-9);
  assert.equal(audio.muted, false); assert.equal(menu.muted, false);
  music.destroy();
});

test("mobile media uses adjustable Web Audio gains even when native volume is ignored", async () => {
  const gains: { gain: { value: number }; connect(): void; disconnect(): void }[] = [];
  let connected = 0, disconnected = 0, resumed = 0;
  const context = { state: "suspended", destination: {},
    createGain() { const gain = { gain: { value: 1 }, connect() { connected++; }, disconnect() { disconnected++; } }; gains.push(gain); return gain; },
    createMediaElementSource: () => ({ connect() { connected++; }, disconnect() { disconnected++; } }),
    resume() { resumed++; this.state = "running"; return Promise.resolve(); } };
  let unlocked: AudioContext | null = null;
  const { audio, music } = setup(() => .3, () => unlocked);
  Object.defineProperty(audio, "volume", { get: () => 1, set: () => {} });
  const game = makeGame("street-ace", 227, "free-run");
  unlocked = context as unknown as AudioContext;
  music.unlock(); await settled(); assert.equal(resumed, 1);
  music.update(game, "playing", { ...defaults, musicVolume: .5 }); await settled();
  assert.deepEqual(gains.map(gain => gain.gain.value), [.19, .19]);
  music.update(game, "paused", { ...defaults, masterVolume: .5, musicVolume: .5 });
  assert.deepEqual(gains.map(gain => gain.gain.value), [.095, .095]);
  music.unlock(); assert.equal(connected, 4);
  music.destroy(); assert.equal(disconnected, 4);
  assert.equal(context.state, "running");
});

test("hidden-tab preference pauses both transports and can be disabled without changing mute or mix", async () => {
  const { audio, menu, music } = setup();
  const game = makeGame("street-ace", 456);
  music.update(game, "playing"); await settled(); audio.currentTime = 29;
  music.update(game, "paused", defaults, true); await settled();
  assert.equal(audio.paused, true); assert.equal(menu.paused, true);
  assert.equal(audio.volume, 0); assert.equal(menu.volume, 0);
  music.update(game, "paused", { ...defaults, muteWhenHidden: false }, true); await settled();
  assert.equal(menu.paused, false); assert.equal(menu.volume, .38);
  music.update(game, "playing", defaults, false); await settled();
  assert.equal(audio.currentTime, 29); assert.equal(menu.paused, true);
  music.destroy();
});

test("blocked autoplay retries inside a gesture and cleanup prevents further playback", async () => {
  const { audio, menu, music } = setup();
  let blocked = true;
  for (const channel of [audio, menu]) channel.play = () => {
    channel.plays++;
    if (blocked) return Promise.reject(new DOMException("Gesture required", "NotAllowedError"));
    channel.paused = false; return Promise.resolve();
  };
  const game = makeGame("street-ace", 912);
  music.update(game, "menu"); await settled();
  music.update(game, "menu"); await settled(); assert.equal(menu.plays, 1);
  music.update(game, "countdown"); await settled();
  music.update(game, "playing"); await settled(); assert.equal(audio.plays, 1);
  blocked = false; music.unlock(); await settled();
  assert.equal(audio.paused, false); assert.equal(menu.paused, true);
  music.destroy(); music.unlock(); music.update(game, "playing");
  audio.dispatchEvent(new Event("ended")); assert.equal(audio.plays, 2);
});
