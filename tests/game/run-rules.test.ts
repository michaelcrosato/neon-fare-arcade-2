import assert from "node:assert/strict";
import test from "node:test";

import { creditRunTime, quickTimeBonus, runHasExpired } from "../../game/run-rules";
import { makeGame } from "../../game/state";

test("timed remains the default while Free Run has no expiry or time rewards", () => {
  const timed = makeGame();
  const free = makeGame("street-ace", 1234, "free-run");

  assert.equal(timed.runKind, "timed");
  assert.equal(free.runKind, "free-run");

  timed.timeLeft = 0;
  free.timeLeft = 0;
  assert.equal(runHasExpired(timed), true);
  assert.equal(runHasExpired(free), false);

  free.timeLeft = 75;
  free.lastBeep = 4;
  assert.equal(creditRunTime(free, 16), 0);
  assert.equal(free.timeLeft, 75);
  assert.equal(free.lastBeep, 4);
  assert.equal(quickTimeBonus(free, 800), 0);
  assert.equal(quickTimeBonus(timed, 800), 800);
});
