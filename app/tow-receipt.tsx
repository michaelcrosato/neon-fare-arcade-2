import { TOW_SECONDS } from "@/game/config";
import type { Hud } from "@/game/model";

export function TowReceipt({ receipt }: { receipt: NonNullable<Hud["towReceipt"]> }) {
  return <aside className={`tow-receipt ${receipt.age > TOW_SECONDS - .5 ? "is-leaving" : ""}`} role="status" aria-live="polite" aria-atomic="true">
    <div className="tow-receipt__stripe">NEON ROADSIDE · RESCUE RECEIPT</div>
    <svg className="tow-receipt__truck" viewBox="0 0 128 74" aria-hidden="true">
      <path d="M8 48V32h47V16h36l20 19v13h8v13H7z" fill="var(--red)" stroke="var(--ink)" strokeWidth="4" />
      <path d="M63 22h24l14 14H63z" fill="var(--cyan)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M19 33V13h12l19 17M22 13v32h-9" fill="none" stroke="var(--ink)" strokeWidth="5" />
      <path d="M9 48h100" stroke="var(--paper)" strokeWidth="5" />
      <path d="M68 10h19" stroke="var(--yellow)" strokeWidth="7" />
      <circle cx="28" cy="60" r="10" fill="var(--ink)" /><circle cx="95" cy="60" r="10" fill="var(--ink)" />
      <circle cx="28" cy="60" r="4" fill="var(--paper)" /><circle cx="95" cy="60" r="4" fill="var(--paper)" />
    </svg>
    <strong className="tow-receipt__amount">{receipt.cost ? `−$${receipt.cost}` : "$0"}</strong>
    <b>BACK IN BUSINESS!</b>
    <p>{receipt.cost ? "TOW PAID · TAKEN FROM RUN FARE" : "ON THE HOUSE · WE’VE GOT YOU"}</p>
    <div className="tow-receipt__meter" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0, 1 - receipt.age / TOW_SECONDS)})` }} /></div>
  </aside>;
}
