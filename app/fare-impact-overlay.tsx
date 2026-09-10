import { memo, type CSSProperties } from "react";
import type { FareImpact } from "@/game/model";
import { fareArtAsset, fareArtFrame } from "@/game/fare-presentation";

type FareImpactOverlayProps = {
  impact: FareImpact;
};

export const FareImpactOverlay = memo(function FareImpactOverlay({ impact }: FareImpactOverlayProps) {
  const artFrame = fareArtFrame(impact.artCell);
  const number = String(impact.fareNumber).padStart(2, "0");
  const isPickup = impact.kind === "pickup";
  const style = {
    "--fare-duration": `${impact.durationMs}ms`,
  } as CSSProperties;

  return (
    <div
      className={`fare-impact fare-impact--${impact.kind}`}
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
          <div className="fare-impact__route">
            <b>{impact.rider}</b>
            <i aria-hidden="true">➜</i>
            <span>{impact.destination}</span>
          </div>
          <strong>{impact.headline}</strong>
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
