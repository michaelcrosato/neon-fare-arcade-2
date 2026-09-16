"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type RefObject } from "react";
import type { Game, Hud, Modal, Mode } from "@/game/model";
import { makeHud } from "@/game/hud";
import { declineVehicleRepair, repairVehicle } from "@/game/vehicle-damage";
import { FuelPurchaseActions } from "./fuel-services";
import { DamageCallout } from "./damage-callout";

type RepairContext = { quote: Hud["damage"]; notice: string; act: (accept: boolean) => void };
const Repairs = createContext<RepairContext | null>(null);

export function VehicleRepairProvider({ gameRef, hud, mode, modal, setHud, checkpoint, children }: {
  gameRef: RefObject<Game>; hud: Hud; mode: Mode; modal: Modal; setHud: (hud: Hud) => void;
  checkpoint: (reason: string) => void; children: ReactNode;
}) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const act = useCallback((accept: boolean) => {
    const game = gameRef.current;
    if (accept) {
      const result = repairVehicle(game);
      if (result.status === "repaired") { game.message = `ALL FIXED! $${result.cost} PAID.`; game.messageUntil = game.elapsed + 3; }
      setNotice(result.status === "repaired" ? `ALL FIXED! $${result.cost} PAID FROM RUN FARE.`
        : result.status === "insufficient" ? `NEED $${result.cost - game.fare} MORE RUN FARE.`
          : "STOP ON THE GAS-STATION LOT FOR REPAIRS.");
    } else { declineVehicleRepair(game); setNotice("LOT SERVICE DECLINED. COME BACK WHEN YOU'RE READY."); }
    checkpoint(accept ? "vehicle-repair" : "vehicle-repair-declined");
    setHud(makeHud(game));
  }, [gameRef, checkpoint, setHud]);
  useEffect(() => {
    if (mode !== "playing" && modal !== "gas" || modal !== null && modal !== "gas") return;
    if (!(hud.damage.eligible && (modal === "gas" || hud.damage.serviceOffer) && (hud.damage.lossKmh > 0 || hud.fuel.fraction < .98))) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable=true]")) return;
      const key = event.key.toLowerCase();
      if (key === "r" && hud.damage.lossKmh > 0 || key === "n" && modal !== "gas") { event.preventDefault(); act(key === "r"); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [act, hud.damage.eligible, hud.damage.lossKmh, hud.damage.serviceOffer, hud.fuel.fraction, modal, mode]);
  return <Repairs value={{ quote: hud.damage, notice, act }}>{children}<span className="sr-only" role="status">{notice}</span></Repairs>;
}

export function VehicleRepairOffer({ inline = false }: { inline?: boolean }) {
  const repair = useContext(Repairs);
  if (!repair || repair.quote.lossKmh === 0 || !(inline ? repair.quote.eligible : repair.quote.showOffer)) return <>
    {inline && repair?.notice.startsWith("ALL FIXED") && <p className="vehicle-repair-receipt" role="status">{repair.notice}</p>}
    <FuelPurchaseActions inline={inline} onDecline={() => repair?.act(false)} />
  </>;
  const { quote, act } = repair;
  return <section className={`vehicle-repair ${inline ? "is-inline" : ""}`} aria-label="Vehicle repairs">
    <small>{quote.station}{" // LOT SERVICE"}</small><h3>LET&apos;S FIX THAT.</h3>
    <p>Restore {quote.lossKmh} km/h of lost top speed.</p>
    <strong>${quote.cost} <small>FROM RUN FARE</small></strong>
    <div><button type="button" disabled={quote.shortfall > 0} onClick={() => act(true)} aria-keyshortcuts="R">
      <kbd>R</kbd> {quote.shortfall > 0 ? `NEED $${quote.shortfall} MORE` : "REPAIR VEHICLE"}
    </button>{!inline && <button type="button" onClick={() => act(false)} aria-keyshortcuts="N"><kbd>N</kbd> NOT NOW</button>}</div>
    <span>{inline ? "BODYWORK REPAIRS RESTORE YOUR TOP SPEED." : "No need to get out. Drive away to skip."}</span>
    <FuelPurchaseActions inline={inline} embedded />
  </section>;
}

export function VehicleDamageFeedback({ damage, runSeed = 0 }: { damage: Hud["damage"]; runSeed?: number }) {
  return <><DamageCallout damage={damage} runSeed={runSeed} />{damage.lossKmh > 0 && <aside className="vehicle-damage-status" aria-label={`Vehicle damage: ${damage.lossKmh} kilometres per hour of top speed lost`}>
    <b>BODYWORK −{damage.lossKmh} KM/H</b><small>REPAIR AT ANY GAS STATION</small>
  </aside>}<VehicleRepairOffer /></>;
}
