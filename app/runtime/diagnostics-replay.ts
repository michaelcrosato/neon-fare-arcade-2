import { FIXED_DT } from "@/game/config";
import type { Game } from "@/game/model";
import { stepGame } from "@/game/simulation";
import { CityStream } from "@/game/world";
import {
  decodeDiagnosticInput,
  type DiagnosticSegment,
  type DiagnosticsSnapshot,
} from "./diagnostics";

function cloneGame(game: Game) {
  return typeof structuredClone === "function"
    ? structuredClone(game)
    : JSON.parse(JSON.stringify(game)) as Game;
}

function stableData(value: unknown) {
  return JSON.stringify(value);
}

function mismatch(message: string): never {
  throw new Error(`Diagnostics replay mismatch: ${message}`);
}

/** Replays one independently checkpointed segment and verifies its inputs. */
export function replayDiagnosticSegment(segment: DiagnosticSegment) {
  const game = cloneGame(segment.checkpoint.game);
  const cityStream = new CityStream();
  let expectedTick = segment.checkpoint.tick;

  for (const tick of segment.ticks) {
    if (tick.tick !== expectedTick) mismatch(`expected tick ${expectedTick}, received ${tick.tick}`);
    const world = cityStream.update(
      tick.stream.focus.x,
      tick.stream.focus.y,
      tick.stream.radius,
    );
    if (world.key !== tick.stream.worldKey) mismatch(`world key at tick ${tick.tick}`);
    const counts = {
      chunks: world.chunks.length,
      boxes: world.boxes.length,
      colliders: world.colliders.length,
      interactions: world.interactions.length,
      ...(tick.stream.counts.surfaceQuads === undefined ? {} : { surfaceQuads: world.surfaces?.length ?? 0 }),
    };
    if (stableData(counts) !== stableData(tick.stream.counts)) mismatch(`world counts at tick ${tick.tick}`);

    let randomIndex = 0;
    let events;
    try {
      events = stepGame(
        game,
        decodeDiagnosticInput(tick.inputMask),
        FIXED_DT,
        world,
        () => {
          if (randomIndex >= tick.randomValues.length) mismatch(`random underflow at tick ${tick.tick}`);
          return tick.randomValues[randomIndex++];
        },
      );
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Diagnostics replay mismatch:")) throw error;
      mismatch(`simulation threw at tick ${tick.tick}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (randomIndex !== tick.randomValues.length) mismatch(`random overflow at tick ${tick.tick}`);
    if (stableData(events) !== stableData(tick.events)) mismatch(`events at tick ${tick.tick}`);
    expectedTick += 1;
  }

  return game;
}

/** Verifies every retained segment and every uninterrupted checkpoint seam. */
export function verifyDiagnosticsSnapshot(snapshot: DiagnosticsSnapshot) {
  const replayed = snapshot.trace.segments.map(replayDiagnosticSegment);
  for (let index = 0; index < replayed.length - 1; index += 1) {
    const next = snapshot.trace.segments[index + 1];
    if (next.reason !== "rolling") continue;
    if (stableData(replayed[index]) !== stableData(next.checkpoint.game)) {
      mismatch(`rolling checkpoint ${index + 1}`);
    }
  }
  const lastSegment = snapshot.trace.segments.at(-1);
  const lastGame = replayed.at(-1);
  if (lastSegment && lastGame && !snapshot.trace.failedStep) {
    if (stableData(lastGame) !== stableData(snapshot.currentGame)) mismatch("current game");
  }
  return replayed;
}
