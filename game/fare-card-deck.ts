import type { FareImpact } from "./model";

export type FareCardDeckState = {
  cards: FareImpact[];
  dockedCount: number;
};

export type FareCardDeckView = {
  history: readonly FareImpact[];
  docked: readonly FareImpact[];
  active: FareImpact | null;
  queued: readonly FareImpact[];
};

export type FareCardDeckAction =
  | { type: "add-card"; card: FareImpact }
  | { type: "dock-active"; id: number }
  | { type: "reset" };

export function createFareCardDeck(): FareCardDeckState {
  return { cards: [], dockedCount: 0 };
}

export function viewFareCardDeck(state: FareCardDeckState): FareCardDeckView {
  const active = state.cards[state.dockedCount] ?? null;
  return {
    history: state.cards,
    docked: state.cards.slice(0, state.dockedCount),
    active,
    queued: state.cards.slice(state.dockedCount + (active ? 1 : 0)),
  };
}

export function fareCardDeckReducer(
  state: FareCardDeckState,
  action: FareCardDeckAction,
): FareCardDeckState {
  if (action.type === "add-card") {
    return { ...state, cards: [...state.cards, action.card] };
  }

  if (action.type === "dock-active") {
    const active = state.cards[state.dockedCount];
    if (!active || active.id !== action.id) return state;
    return { ...state, dockedCount: state.dockedCount + 1 };
  }

  return createFareCardDeck();
}
