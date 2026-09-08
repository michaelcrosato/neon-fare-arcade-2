import assert from "node:assert/strict";
import test from "node:test";

import {
  createFareCardDeck,
  fareCardDeckReducer,
  viewFareCardDeck,
} from "../../game/fare-card-deck";
import type { FareImpact } from "../../game/model";

function card(id: number, kind: FareImpact["kind"] = "pickup"): FareImpact {
  return {
    id,
    kind,
    fareId: "rico",
    fareNumber: 1,
    artCell: 0,
    durationMs: 1600,
    rider: "RICO",
    destination: "MARINA ARCADE",
    eyebrow: "TEST",
    headline: kind === "pickup" ? "RICO IN!" : "+$40",
    detail: "+5 SEC",
  };
}

test("an empty fare deck derives empty history, stack, active card, and queue", () => {
  const view = viewFareCardDeck(createFareCardDeck());
  assert.deepEqual(view, { history: [], docked: [], active: null, queued: [] });
});

test("fare cards queue in chronological FIFO order without replacing the active card", () => {
  let state = createFareCardDeck();
  state = fareCardDeckReducer(state, { type: "add-card", card: card(1) });
  state = fareCardDeckReducer(state, { type: "add-card", card: card(2, "dropoff") });
  state = fareCardDeckReducer(state, { type: "add-card", card: card(3) });

  const view = viewFareCardDeck(state);
  assert.deepEqual(view.history.map(({ id }) => id), [1, 2, 3]);
  assert.equal(view.active?.id, 1);
  assert.deepEqual(view.queued.map(({ id }) => id), [2, 3]);
  assert.deepEqual(view.docked, []);
});

test("docking promotes the next card and drains the deck in order", () => {
  let state = createFareCardDeck();
  for (const next of [card(1), card(2, "dropoff"), card(3)]) {
    state = fareCardDeckReducer(state, { type: "add-card", card: next });
  }

  state = fareCardDeckReducer(state, { type: "dock-active", id: 1 });
  assert.equal(viewFareCardDeck(state).active?.id, 2);
  assert.deepEqual(viewFareCardDeck(state).docked.map(({ id }) => id), [1]);

  state = fareCardDeckReducer(state, { type: "dock-active", id: 2 });
  state = fareCardDeckReducer(state, { type: "dock-active", id: 3 });
  const drained = viewFareCardDeck(state);
  assert.equal(drained.active, null);
  assert.deepEqual(drained.docked.map(({ id }) => id), [1, 2, 3]);
  assert.deepEqual(drained.queued, []);
});

test("stale and redundant dock timers cannot advance a different card", () => {
  let state = createFareCardDeck();
  state = fareCardDeckReducer(state, { type: "add-card", card: card(7) });
  const unchanged = fareCardDeckReducer(state, { type: "dock-active", id: 6 });
  assert.equal(unchanged, state);
  assert.equal(viewFareCardDeck(unchanged).active?.id, 7);

  state = fareCardDeckReducer(state, { type: "dock-active", id: 7 });
  assert.equal(fareCardDeckReducer(state, { type: "dock-active", id: 7 }), state);
});

test("reset clears a run without mutating its prior history", () => {
  let state = createFareCardDeck();
  state = fareCardDeckReducer(state, { type: "add-card", card: card(10) });
  const prior = state;
  const reset = fareCardDeckReducer(state, { type: "reset" });

  assert.deepEqual(viewFareCardDeck(reset), { history: [], docked: [], active: null, queued: [] });
  assert.deepEqual(prior.cards.map(({ id }) => id), [10]);

  const nextRun = fareCardDeckReducer(reset, { type: "add-card", card: card(11) });
  const staleTimer = fareCardDeckReducer(nextRun, { type: "dock-active", id: 10 });
  assert.equal(staleTimer, nextRun);
  assert.equal(viewFareCardDeck(staleTimer).active?.id, 11);
});
