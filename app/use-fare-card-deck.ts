"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  createFareCardDeck,
  fareCardDeckReducer,
  viewFareCardDeck,
} from "@/game/fare-card-deck";
import type { FareImpact } from "@/game/model";

export function useFareCardDeck(paused: boolean) {
  const [state, dispatch] = useReducer(fareCardDeckReducer, undefined, createFareCardDeck);
  const nextIdRef = useRef(0);
  const timedCardIdRef = useRef<number | null>(null);
  const remainingMsRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const deck = useMemo(() => viewFareCardDeck(state), [state]);

  useEffect(() => {
    if (!deck.active) {
      timedCardIdRef.current = null;
      remainingMsRef.current = 0;
      startedAtRef.current = null;
      return;
    }

    if (timedCardIdRef.current !== deck.active.id) {
      timedCardIdRef.current = deck.active.id;
      remainingMsRef.current = deck.active.durationMs;
      startedAtRef.current = null;
    }

    if (paused) return;

    const activeId = deck.active.id;
    const startedAt = window.performance.now();
    startedAtRef.current = startedAt;
    const timer = window.setTimeout(() => {
      dispatch({ type: "dock-active", id: activeId });
    }, remainingMsRef.current);

    return () => {
      window.clearTimeout(timer);
      if (startedAtRef.current !== startedAt) return;
      remainingMsRef.current = Math.max(
        0,
        remainingMsRef.current - (window.performance.now() - startedAt),
      );
      startedAtRef.current = null;
    };
  }, [deck.active, paused]);

  const addFareCard = useCallback((draft: Omit<FareImpact, "id">) => {
    const card = { ...draft, id: ++nextIdRef.current };
    dispatch({ type: "add-card", card });
    return card;
  }, []);

  const resetFareCards = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    ...deck,
    addFareCard,
    resetFareCards,
  };
}
