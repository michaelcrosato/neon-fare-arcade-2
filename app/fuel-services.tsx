"use client";

import type { Hud } from "@/game/model";
import { fuelAmountQuote, FUEL_PRICE_PER_LITRE } from "@/game/fuel";
import { BrandLogo } from "./brand-logo";
import { useCommerce } from "./game-commerce";

export function FuelGauge({ fuel }: { fuel: Hud["fuel"] }) {
  return <aside className={`fuel-gauge ${fuel.low ? "is-low" : ""}`} aria-label="Vehicle fuel">
    <div><b>FUEL {Math.ceil(fuel.fraction * 100)}%</b><span>{fuel.litres.toFixed(1)} / {fuel.capacity} L</span></div>
    <meter min={0} max={1} low={.12} value={fuel.fraction} aria-label="Fuel tank level" />
    <div><span>{fuel.empty ? "EMPTY · CALL FUEL ASSIST" : `~${fuel.rangeKm} KM RANGE`}</span><b className="fuel-speed-limit" aria-label={`Speed limit ${fuel.speedLimitKmh} kilometres per hour`}>{fuel.speedLimitKmh}</b></div>
    {fuel.multiplier > 1.05 && <small>{fuel.multiplier.toFixed(1)}× FUEL USE · EASE OFF</small>}
  </aside>;
}

export function FuelPurchaseActions({ inline = false, embedded = false, onDecline }: { inline?: boolean; embedded?: boolean; onDecline?: () => void }) {
  const commerce = useCommerce();
  if (!commerce) return null;
  const { hud, career, refuel, fuelNotice } = commerce;
  if (!hud.damage.eligible || !(inline || hud.damage.serviceOffer)) return null;
  if (hud.fuel.fraction >= (inline ? .9999 : .98)) return inline && fuelNotice ? <p role="status" className="vehicle-repair-receipt">{fuelNotice}</p> : null;
  const fill = fuelAmountQuote(hud.vehicleId, hud.fuel.litres, hud.fare + career.bank, hud.fuel.capacity);
  const topUp = fuelAmountQuote(hud.vehicleId, hud.fuel.litres, hud.fare + career.bank, 5);
  return <section className={`${embedded ? "fuel-service--embedded" : `vehicle-repair fuel-service ${inline ? "is-inline" : ""}`}`} aria-label="Fuel service">
    {!embedded && <BrandLogo brand="go-go-gas" />}
    <h3>{embedded ? "FILL UP WHILE YOU'RE HERE." : "A LITTLE GO-JUICE?"}</h3>
    <p>${FUEL_PRICE_PER_LITRE}/L · {hud.fuel.litres.toFixed(1)} / {hud.fuel.capacity} L in your tank</p>
    <div><button type="button" onClick={() => refuel(hud.fuel.capacity)} disabled={fill.shortfall > 0} aria-keyshortcuts="F"><kbd>F</kbd> FILL TANK · ${fill.cost}</button>
      <button type="button" onClick={() => refuel(5)} disabled={topUp.shortfall > 0}>+{topUp.litres.toFixed(1)} L · ${topUp.cost}</button></div>
    {topUp.shortfall > 0 && <p>Need ${topUp.shortfall} more fare for a small fill.</p>}
    <small>RUN FARE FIRST · BANKED FARE COVERS THE REST</small>
    {fuelNotice && <p role="status">{fuelNotice}</p>}
    {!inline && !embedded && onDecline && <button type="button" className="fuel-service__decline" onClick={onDecline}><kbd>N</kbd> NOT NOW</button>}
  </section>;
}
