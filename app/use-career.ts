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
import { purchaseFuel } from "@/game/fuel";
import { placeFurnishing, purchaseFurnishing } from "@/game/furnishings";
import type { FurnishingId } from "@/game/furnishing-catalog";
import { normalizeRunRecords } from "./runtime/run-records";
import {
  purchaseGasStationOffer,
  type GasStationOfferId,
} from "@/game/gas-station";

function storeCareer(career: CareerState) {
  try { localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(career)); } catch {}
}

/**
 * Device-local persistence adapter, and the source of truth while playing.
 * Career rules stay pure in game/career.ts, so the optional Google cloud save
 * in use-cloud-career.ts layers on top through `replaceCareer` without any
 * rule living in two places. Signed out, this hook behaves exactly as before.
 */
export function useCareer() {
  const [career, setCareer] = useState<CareerState>(() => makeCareerState());
  const [ready, setReady] = useState(false);
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
        shouldPersist = JSON.stringify(next) !== saved;
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
    const frame = window.requestAnimationFrame(() => {
      setCareer(next);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const bankRun = useCallback((result: Game) => {
    const next = bankCareerRun(careerRef.current, result);
    return commitCareer(result.playtest ? next : { ...next, fuelTanks: { ...next.fuelTanks, [result.vehicleId]: result.fuel.litres } });
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

  const saveFuel = useCallback((game: Game) => {
    if (game.playtest || careerRef.current.fuelTanks[game.vehicleId] === game.fuel.litres) return;
    commitCareer({ ...careerRef.current, fuelTanks: { ...careerRef.current.fuelTanks, [game.vehicleId]: game.fuel.litres } });
  }, [commitCareer]);
  const buyFuel = useCallback((game: Game, litres: number) => {
    const result = purchaseFuel(game, careerRef.current, litres);
    if (result.status === "purchased") commitCareer(result.state);
    return result;
  }, [commitCareer]);
  const buyFurnishing = useCallback((game: Game, id: FurnishingId) => {
    const result = purchaseFurnishing(game, careerRef.current, id);
    if (result.status === "purchased") commitCareer(result.state);
    return result;
  }, [commitCareer]);
  const setFurnishing = useCallback((game: Game, id: FurnishingId, placed: boolean) => {
    const result = placeFurnishing(game, careerRef.current, id, placed);
    if (result.status === "placed") commitCareer(result.state);
    return result;
  }, [commitCareer]);
  // Adopting an account's career replaces device state wholesale; normalizing
  // here means a save written by a newer build can never install a bad shape.
  const replaceCareer = useCallback((next: CareerState) => commitCareer(normalizeCareerState(next)), [commitCareer]);

  return { career, careerRef, ready, bankRun, buyItem, buyGasStationOffer, saveFuel, buyFuel, buyFurnishing, setFurnishing, replaceCareer };
}
