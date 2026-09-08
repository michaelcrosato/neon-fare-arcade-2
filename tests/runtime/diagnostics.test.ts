import assert from "node:assert/strict";
import test from "node:test";
import { CHUNK_SIZE, COLLISION_STREAM_RADIUS, FIXED_DT } from "@/game/config";
import type { Game, InputState } from "@/game/model";
import { controlledPose } from "@/game/player";
import { mulberry32 } from "@/game/random";
import { stepGame } from "@/game/simulation";
import { makeGame } from "@/game/state";
import { CityStream } from "@/game/world";
import {
  DIAGNOSTIC_SEGMENT_LIMIT,
  DIAGNOSTIC_SEGMENT_TICKS,
  DiagnosticsRecorder,
  decodeDiagnosticInput,
  encodeDiagnosticInput,
  type DiagnosticStreamContext,
} from "@/app/runtime/diagnostics";
import {
  replayDiagnosticSegment,
  verifyDiagnosticsSnapshot,
} from "@/app/runtime/diagnostics-replay";

function streamContext(world: ReturnType<CityStream["update"]>, focus: { x: number; y: number }): DiagnosticStreamContext {
  return {
    focus: { ...focus },
    radius: COLLISION_STREAM_RADIUS,
    worldKey: world.key,
    counts: {
      chunks: world.chunks.length,
      boxes: world.boxes.length,
      colliders: world.colliders.length,
      interactions: world.interactions.length,
    },
  };
}

function recordTick(
  recorder: DiagnosticsRecorder,
  game: Game,
  cityStream: CityStream,
  input: InputState,
  random: () => number,
) {
  const focus = controlledPose(game);
  const world = cityStream.update(focus.x, focus.y, COLLISION_STREAM_RADIUS);
  recorder.beginStep(game, input, streamContext(world, focus));
  const randomValues: number[] = [];
  const events = stepGame(game, input, FIXED_DT, world, () => {
    const value = random();
    randomValues.push(value);
    return value;
  });
  recorder.commitStep(randomValues, events);
  return events;
}

test("all diagnostic input masks round-trip", () => {
  for (let mask = 0; mask < 512; mask += 1) {
    assert.equal(encodeDiagnosticInput(decodeDiagnosticInput(mask)), mask);
  }
});

test("retained real-world trace replays across chunk boundaries and rolling eviction", () => {
  const game = makeGame("street-ace", 0x4e454f4e, "free-run");
  game.x = CHUNK_SIZE / 2 - 4;
  game.y = 2;
  game.heading = 0;
  const recorder = new DiagnosticsRecorder();
  const cityStream = new CityStream();
  const random = mulberry32(0xfacecafe);
  const input: InputState = {
    up: true,
    down: false,
    left: false,
    right: false,
    boost: false,
  };

  const totalTicks = DIAGNOSTIC_SEGMENT_TICKS * DIAGNOSTIC_SEGMENT_LIMIT + 24;
  for (let tick = 0; tick < totalTicks; tick += 1) {
    recordTick(recorder, game, cityStream, input, random);
  }

  const snapshot = recorder.snapshot(game, null, "playing");
  assert.equal(snapshot.trace.segments.length, DIAGNOSTIC_SEGMENT_LIMIT);
  assert.equal(snapshot.trace.segments[0].checkpoint.tick, DIAGNOSTIC_SEGMENT_TICKS);
  assert.ok(new Set(snapshot.trace.segments.flatMap((segment) => segment.ticks.map((tick) => tick.stream.worldKey))).size > 1);
  verifyDiagnosticsSnapshot(snapshot);
  assert.deepEqual(
    replayDiagnosticSegment(snapshot.trace.segments.at(-1)!),
    snapshot.currentGame,
  );
});

test("external boundaries retain the lead-in and remain final-state verifiable", () => {
  const game = makeGame("street-ace", 17, "free-run");
  const recorder = new DiagnosticsRecorder();
  const cityStream = new CityStream();
  const random = mulberry32(23);
  const input: InputState = { up: false, down: false, left: false, right: false, boost: false };
  recordTick(recorder, game, cityStream, input, random);

  game.boosting = false;
  recorder.recordExternalCheckpoint("mode:paused", game);
  const paused = recorder.snapshot(game, null, "paused");
  assert.equal(paused.trace.segments[0].ticks.length, 1);
  assert.equal(paused.trace.segments[1].reason, "external");
  assert.equal(paused.trace.segments[1].boundaryReason, "mode:paused");
  verifyDiagnosticsSnapshot(paused);

  game.score = 11;
  recorder.recordExternalCheckpoint("test:score", game);
  const changed = recorder.snapshot(game, null, "paused");
  assert.equal(changed.trace.segments.length, 2);
  assert.equal(changed.trace.segments[1].boundaryReason, "mode:paused; test:score");
  verifyDiagnosticsSnapshot(changed);

  recordTick(recorder, game, cityStream, input, random);
  const resumed = recorder.snapshot(game, null, "playing");
  assert.equal(resumed.trace.segments.length, 2);
  assert.equal(resumed.trace.segments[1].reason, "external");
  assert.deepEqual(resumed.trace.segments[1].checkpoint.game, changed.currentGame);
  verifyDiagnosticsSnapshot(resumed);
});

test("failed attempts preserve the first exact checkpoint, attempt, error, and partial state", () => {
  const game = makeGame("street-ace", 29, "free-run");
  const recorder = new DiagnosticsRecorder();
  const cityStream = new CityStream();
  const random = mulberry32(41);
  recordTick(
    recorder,
    game,
    cityStream,
    { up: false, down: false, left: false, right: false, boost: false },
    random,
  );
  const focus = controlledPose(game);
  const world = cityStream.update(focus.x, focus.y, COLLISION_STREAM_RADIUS);
  const input: InputState = { up: true, down: false, left: false, right: false, boost: false };
  recorder.beginStep(game, input, streamContext(world, focus));
  game.score = 73;
  const failure = new TypeError("synthetic fixed-step failure");
  recorder.failStep(failure, [0.25, 0.75], game);

  const snapshot = recorder.snapshot(game, null, "playing");
  assert.equal(snapshot.trace.failedStep?.error.name, "TypeError");
  assert.equal(snapshot.trace.failedStep?.error.message, failure.message);
  assert.deepEqual(snapshot.trace.failedStep?.attempt.randomValues, [0.25, 0.75]);
  assert.equal(snapshot.trace.failedStep?.postFailureGame.score, 73);
  assert.equal(snapshot.trace.failedStep?.checkpoint.game.score, 0);
  assert.equal(snapshot.trace.failedStep?.priorTicks.length, 1);

  recorder.beginStep(game, input, streamContext(world, focus));
  game.score = 99;
  recorder.failStep(new Error("retry failure"), [0.5], game);
  const retried = recorder.snapshot(game, null, "paused");
  assert.equal(retried.trace.failedStep?.error.message, failure.message);
  assert.equal(retried.trace.failedStep?.postFailureGame.score, 73);
  assert.equal(retried.trace.failedStep?.priorTicks.length, 1);
});

test("replay rejects tampered world identity and snapshots are defensive copies", () => {
  const game = makeGame("street-ace", 31, "free-run");
  const recorder = new DiagnosticsRecorder();
  recordTick(
    recorder,
    game,
    new CityStream(),
    { up: false, down: false, left: false, right: false, boost: false },
    mulberry32(37),
  );
  const snapshot = recorder.snapshot(game, null, "playing");
  snapshot.currentGame.score = 999;
  const fresh = recorder.snapshot(game, null, "playing");
  assert.notEqual(fresh.currentGame.score, 999);

  const tampered = structuredClone(fresh);
  (tampered.trace.segments[0].ticks[0].stream as { worldKey: string }).worldKey = "tampered";
  assert.throws(() => verifyDiagnosticsSnapshot(tampered), /world key/);
});
