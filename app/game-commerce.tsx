"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type RefObject } from "react";
import type { Game, Hud, Modal, Mode, WorldPoint } from "@/game/model";
import { makeHud } from "@/game/hud";
import { FURNISHINGS, type FurnishingId } from "@/game/furnishing-catalog";
import { fuelAmountQuote } from "@/game/fuel";
import type { StoreId } from "@/game/brands";
import { storeEntrance, homeEntrance, cityFuelEntrance } from "@/game/shopping-routes";
import type { useCareer } from "./use-career";

type Career = ReturnType<typeof useCareer>;
type Commerce = { career: Career["career"]; hud: Hud; notice: string; fuelNotice: string;
  buy: (id: FurnishingId) => void; place: (id: FurnishingId, placed: boolean) => void;
  refuel: (litres: number) => void; route: (id: StoreId | "home" | "gas") => void };
const Context = createContext<Commerce | null>(null);
export const useCommerce = () => useContext(Context);

export function GameCommerceProvider({ api, gameRef, hud, mode, modal, setHud, checkpoint, onNavigate, onClose, children }: {
  api: Career; gameRef: RefObject<Game>; hud: Hud; mode: Mode; modal: Modal; setHud: (hud: Hud) => void;
  checkpoint: (reason: string) => void; onNavigate: (point: WorldPoint) => void; onClose: () => void; children: ReactNode;
}) {
  const { career, saveFuel, buyFuel, buyFurnishing, setFurnishing } = api;
  const [notice, setNotice] = useState(""), [fuelNotice, setFuelNotice] = useState("");
  useEffect(() => {
    if (!notice && !fuelNotice) return;
    const timer = window.setTimeout(() => { setNotice(""); setFuelNotice(""); }, 6500);
    return () => window.clearTimeout(timer);
  }, [notice, fuelNotice]);
  useEffect(() => {
    if (mode === "menu" || mode === "countdown") return;
    const save = () => saveFuel(gameRef.current);
    save();
    const timer = window.setInterval(save, 5000);
    const visibility = () => { if (document.hidden) save(); };
    window.addEventListener("pagehide", save); document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(timer); window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", visibility); save(); };
  }, [gameRef, mode, saveFuel]);
  const changed = useCallback((reason: string) => { checkpoint(reason); setHud(makeHud(gameRef.current)); }, [checkpoint, gameRef, setHud]);
  const refuel = useCallback((litres: number) => {
    const result = buyFuel(gameRef.current, litres);
    const message = result.status === "purchased" ? `${result.litres.toFixed(1)} L FILLED · $${result.cost} PAID`
      : result.status === "full" ? "TANK IS FULL" : result.status === "insufficient" ? "NOT ENOUGH FARE FOR THAT FILL" : "STOP ON THE GAS-STATION LOT FIRST";
    setFuelNotice(message); gameRef.current.message = message; gameRef.current.messageUntil = gameRef.current.elapsed + 3;
    changed("fuel:purchase");
  }, [buyFuel, changed, gameRef]);
  useEffect(() => {
    const atCounter = modal === "gas";
    if (!(atCounter || mode === "playing" && modal === null) || !hud.damage.eligible
      || !(atCounter || hud.damage.serviceOffer) || hud.fuel.fraction >= (atCounter ? .9999 : .98)) return;
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      const quote = fuelAmountQuote(hud.vehicleId, hud.fuel.litres, hud.fare + career.bank, hud.fuel.capacity);
      event.preventDefault(); if (quote.shortfall === 0) refuel(hud.fuel.capacity);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [career.bank, hud.damage.eligible, hud.damage.serviceOffer, hud.fare, hud.fuel, hud.vehicleId, modal, mode, refuel]);
  const buy = (id: FurnishingId) => {
    const result = buyFurnishing(gameRef.current, id), item = FURNISHINGS.find(item => item.id === id)!;
    setNotice(result.status === "purchased" ? `${item.name} · DELIVERED AND PLACED AT NEON LOFTS.`
      : result.status === "owned" ? "ALREADY YOURS. MANAGE IT AT HOME." : result.status === "insufficient" ? "BANK MORE FARE FOR THIS ONE." : "VISIT THE ITEM'S STORE COUNTER.");
    changed(`furnishing:buy:${id}`);
  };
  const place = (id: FurnishingId, placed: boolean) => {
    const result = setFurnishing(gameRef.current, id, placed);
    setNotice(result.status === "placed" ? placed ? "PLACED IN YOUR APARTMENT." : "STORED. YOU STILL OWN IT." : "MANAGE YOUR FURNITURE AT HOME.");
    changed(`furnishing:place:${id}`);
  };
  const route = (id: StoreId | "home" | "gas") => { onNavigate(id === "home" ? homeEntrance() : id === "gas" ? cityFuelEntrance() : storeEntrance(id)); onClose(); };
  return <Context value={{ career, hud, notice, fuelNotice, buy, place, refuel, route }}>{children}</Context>;
}
