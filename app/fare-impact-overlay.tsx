import { memo, type CSSProperties, type RefObject } from "react";
import type { FareImpact } from "@/game/model";
import { fareArtAsset, fareArtFrame } from "@/game/fare-presentation";

type FareImpactOverlayProps = {
  impact: FareImpact;
  overlayRef?: RefObject<HTMLDivElement | null>;
};

export const FareImpactOverlay = memo(function FareImpactOverlay({ impact, overlayRef }: FareImpactOverlayProps) {
  const artFrame = fareArtFrame(impact.artCell);
  const number = String(impact.fareNumber).padStart(2, "0");
  const isPickup = impact.kind === "pickup";
  const style = {
    "--fare-duration": `${impact.durationMs}ms`,
  } as CSSProperties;

  return (
    <div
      ref={overlayRef}
      className={`fare-impact fare-impact--banner fare-impact--${impact.kind}`}
      style={style}
      aria-hidden="true"
    >
      <div className="fare-impact__speed-lines" />
      <div className="fare-impact__sequence">
        <div className="fare-impact__art">
          <div
            className={`fare-impact__sprite fare-art-sheet-${artFrame.sheet}`}
            style={{
              backgroundImage: `url("${fareArtAsset(impact.kind, artFrame.sheet)}")`,
              backgroundPosition: artFrame.backgroundPosition,
            }}
          />
          <span className="fare-impact__fare-number">FARE // {number}</span>
          <strong className="fare-impact__verb">
            {isPickup ? "GET IN!" : "ARRIVED!"}
          </strong>
        </div>

        <div className="fare-impact__copy">
          <small>{impact.eyebrow}</small>
          <strong>{impact.headline}</strong>
          <div className="fare-impact__route">
            {!isPickup && <b>{impact.rider}</b>}
            <i aria-hidden="true">➜</i>
            <span>{impact.destination}</span>
          </div>
          {impact.destinationCard && <p className="fare-card-occasion">{impact.destinationCard.occasion}</p>}
          <em>{impact.detail}</em>
        </div>

        <span className="fare-impact__stamp">
          {isPickup ? "GO! GO! GO!" : "CLEAN DROP!"}
        </span>
      </div>
    </div>
  );
});
