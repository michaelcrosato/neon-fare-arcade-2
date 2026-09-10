"use client";

import { memo, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { FareImpact } from "@/game/model";
import { fareArtAsset, fareArtFrame } from "@/game/fare-presentation";

type FareCardStackProps = {
  cards: readonly FareImpact[];
  onOpen: () => void;
};

type FareCardBrowserProps = {
  cards: readonly FareImpact[];
};

function artPresentation(card: FareImpact) {
  const frame = fareArtFrame(card.artCell);
  return {
    className: `fare-card-art fare-card-art--${card.kind} fare-art-sheet-${frame.sheet}`,
    style: {
      backgroundImage: `url("${fareArtAsset(card.kind, frame.sheet)}")`,
      backgroundPosition: frame.backgroundPosition,
    },
  };
}

function fareNumber(card: FareImpact) {
  return String(card.fareNumber).padStart(2, "0");
}

export const FareCardStack = memo(function FareCardStack({ cards, onOpen }: FareCardStackProps) {
  if (cards.length === 0) return null;
  const visibleCards = cards.slice(-3);
  const latest = cards[cards.length - 1];

  return (
    <button
      className="fare-card-stack"
      onClick={onOpen}
      aria-label={`Pause and browse ${cards.length} run ${cards.length === 1 ? "card" : "cards"}. Latest: ${latest.headline}.`}
    >
      <span className="fare-card-stack__cards" aria-hidden="true">
        {visibleCards.map((card, index) => {
          const depth = visibleCards.length - index - 1;
          return (
            <span
              className={`fare-card-stack__card fare-card-stack__card--${card.kind}`}
              key={card.id}
              style={{ "--fare-stack-depth": depth } as CSSProperties}
            >
              <i {...artPresentation(card)} />
              <span>
                <small>{`${card.kind === "pickup" ? "PICKUP" : "DROP"} // ${fareNumber(card)}`}</small>
                <strong>{card.headline}</strong>
                <em>{card.rider}</em>
              </span>
            </span>
          );
        })}
      </span>
      <span className="fare-card-stack__label">
        <b>{cards.length}</b>
        <span>RUN {cards.length === 1 ? "CARD" : "CARDS"}</span>
        <em>PAUSE TO FLIP</em>
      </span>
    </button>
  );
});

export const FareCardBrowser = memo(function FareCardBrowser({ cards }: FareCardBrowserProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedFromId = selectedId === null ? -1 : cards.findIndex((card) => card.id === selectedId);
  const selectedIndex = selectedFromId >= 0 ? selectedFromId : cards.length - 1;
  const card = cards[selectedIndex] ?? null;

  const selectIndex = (nextIndex: number) => {
    const next = cards[nextIndex];
    if (next) setSelectedId(next.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    selectIndex(selectedIndex + (event.key === "ArrowLeft" ? -1 : 1));
  };

  return (
    <section
      className="fare-deck-browser"
      aria-label="Run fare card deck"
      autoFocus
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <header>
        <span>
          <small>SHIFT ARCHIVE</small>
          <strong>RUN FARE DECK</strong>
        </span>
        <b>{cards.length.toString().padStart(2, "0")} {cards.length === 1 ? "CARD" : "CARDS"}</b>
      </header>

      {card ? (
        <>
          <article
            className={`fare-deck-browser__card fare-deck-browser__card--${card.kind}`}
            aria-live="polite"
          >
            <div className="fare-deck-browser__art">
              <i {...artPresentation(card)} />
              <span>FARE // {fareNumber(card)}</span>
              <b>{card.kind === "pickup" ? "PICKUP" : "DROP"}</b>
            </div>
            <div className="fare-deck-browser__copy">
              <small>{card.eyebrow}</small>
              <h3>{card.headline}</h3>
              <p><b>{card.rider}</b><i aria-hidden="true">➜</i><span>{card.destination}</span></p>
              {card.destinationCard && <div className="fare-card-occasion">{card.destinationCard.occasion}</div>}
              <em>{card.detail}</em>
            </div>
          </article>
          <footer>
            <button
              type="button"
              onClick={() => selectIndex(selectedIndex - 1)}
              disabled={selectedIndex <= 0}
              aria-label="Previous fare card"
            >
              ← PREV
            </button>
            <span><b>{selectedIndex + 1}</b> / {cards.length}</span>
            <button
              type="button"
              onClick={() => selectIndex(selectedIndex + 1)}
              disabled={selectedIndex >= cards.length - 1}
              aria-label="Next fare card"
            >
              NEXT →
            </button>
          </footer>
        </>
      ) : (
        <div className="fare-deck-browser__empty">
          <b>NO CARDS—YET!</b>
          <span>FIND THE FIRST FARE AND PUT SOME RUBBER DOWN.</span>
        </div>
      )}
    </section>
  );
});
