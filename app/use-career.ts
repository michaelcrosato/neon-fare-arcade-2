"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAREER_STORAGE_KEY,
  bankCareerRun,
  careerFromRunRecords,
  makeCareerState,
  normalizeCareerState,
  purchaseCareerItem,
  type CareerItemId,
  type CareerState,
} from "@/game/career";
import type { Game } from "@/game/model";
import { normalizeRunRecords } from "./runtime/run-records";
import {
  purchaseGasStationOffer,
  type GasStationOfferId,
} from "@/game/gas-station";

function storeCareer(career: CareerState) {
  try { localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career)); } catch {}
}

/**
 * Device-local persistence adapter. Career rules stay pure in game/career.ts,
 * so a future account/cloud save can replace this hook without changing them.
 */
export function useCareer() {
  const [career, setCareer] = useState<CareerState>(() => makeCareerState());
  const careerRef = useRef(career);

  const commitCareer = useCallback((next: CareerState) => {
    careerRef.current = next;
    setCareer(next);
    storeCareer(next);
    return next;
  }, []);

  useEffect(() => {
    let next = makeCareerState();
    let shouldPersist = false;
    try {
      const saved = localStorage.getItem(CAREER_STORAGE_KEY);
      if (saved) {
        next = normalizeCareerState(JSON.parse(saved));
      } else {
        const legacy = normalizeRunRecords(JSON.parse(localStorage.getItem("neon-fare-runs") || "[]"));
        next = careerFromRunRecords(legacy);
        shouldPersist = true;
      }
    } catch {
      shouldPersist = true;
    }
    careerRef.current = next;
    if (shouldPersist) storeCareer(next);
    const frame = window.requestAnimationFrame(() => setCareer(next));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const bankRun = useCallback((result: Pick<Game, "fare" | "score" | "deliveries">) => {
    return commitCareer(bankCareerRun(careerRef.current, result));
  }, [commitCareer]);

  const buyItem = useCallback((id: CareerItemId) => {
    const result = purchaseCareerItem(careerRef.current, id);
    if (result.status === "purchased") commitCareer(result.state);
    return result;
  }, [commitCareer]);

  const buyGasStationOffer = useCallback((game: Game, id: GasStationOfferId) => {
    const result = purchaseGasStationOffer(game, careerRef.current, id);
    if (result.status === "purchased") commitCareer(result.state);
    return result;
  }, [commitCareer]);

  return { career, careerRef, bankRun, buyItem, buyGasStationOffer };
}
