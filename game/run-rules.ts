import type { Game } from "./model";

export function isTimedRun(game: Pick<Game, "runKind">) {
  return game.runKind === "timed";
}

/** Credit visible meter time only when the current session has a meter. */
export function creditRunTime(
  game: Pick<Game, "runKind" | "timeLeft" | "lastBeep">,
  requestedSeconds: number,
) {
  if (!isTimedRun(game)) return 0;
  const before = game.timeLeft;
  game.timeLeft = Math.min(99, game.timeLeft + requestedSeconds);
  const credited = Math.round((game.timeLeft - before) * 10) / 10;
  if (credited > 0) game.lastBeep = 11;
  return credited;
}

/** Free Run keeps distance, clean-driving, and combo rewards without a stopwatch incentive. */
export function quickTimeBonus(game: Pick<Game, "runKind">, timedBonus: number) {
  return isTimedRun(game) ? timedBonus : 0;
}

export function runHasExpired(game: Pick<Game, "runKind" | "timeLeft">) {
  return isTimedRun(game) && game.timeLeft <= 0;
}
