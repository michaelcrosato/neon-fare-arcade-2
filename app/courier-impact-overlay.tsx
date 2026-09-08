"use client";

export type CourierImpact = {
  id: number;
  kind: "pickup" | "dropoff";
  cargo: string;
  destination: string;
  detail: string;
};

export function CourierImpactOverlay({ impact }: { impact: CourierImpact }) {
  return (
    <div className={`courier-impact courier-impact--${impact.kind}`} aria-hidden="true">
      <div className="courier-impact__speed"><i /><i /><i /></div>
      <div className="courier-impact__parcel"><b>✦</b><i /><span>NF</span></div>
      <div className="courier-impact__copy">
        <small>{impact.kind === "pickup" ? `DESTINATION · ${impact.destination}` : "SIGNATURE LOCKED"}</small>
        <strong>{impact.kind === "pickup" ? "PARCEL SECURED!" : "COURIER COMPLETE!"}</strong>
        <b>{impact.cargo}</b>
        <span>{impact.kind === "pickup" ? `${impact.detail} · LOAD PARCEL` : impact.detail}</span>
      </div>
    </div>
  );
}
