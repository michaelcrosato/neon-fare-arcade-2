"use client";

import { useEffect, useRef } from "react";
import { QUANTUM_FACTS, type StoryCard as StoryCardData } from "@/game/accord-events";
import { fareArtAsset, fareArtFrame } from "@/game/fare-presentation";

/** Native modal focus containment; the paused scene remains visible around the paper. */
export function StoryCard({ card, onDismiss }: { card: StoryCardData; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressed = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    // A long lesson must open at its beginning, not auto-scroll to the reply button.
    element?.focus({ preventScroll: true });
    if (element) element.scrollTop = 0;
    const key = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      // Keep native scrolling, text copying and Tab navigation, but never let
      // driving keys (including Space on the focused reply) accept the lesson.
      if (["Enter", " ", "Escape"].includes(event.key)) event.preventDefault();
      if (event.type === "keydown" && event.key === "Enter" && !event.repeat && !event.isComposing
        && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) onDismiss();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("keyup", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [onDismiss]);
  const fact = card.kind === "quantum" ? QUANTUM_FACTS[card.factIndex] : null;
  const frame = card.kind === "quantum" ? fareArtFrame(card.artCell) : null;
  return <dialog ref={dialog} tabIndex={-1} className={`story-card story-card--${card.kind}`} aria-labelledby="story-card-title" aria-describedby="story-card-text"
    onCancel={event => event.preventDefault()}>
    <header className="story-card__masthead"><b>{fact ? "THE ACCORD HAS A THEORY" : "A LITTLE TRACTION. A BIG MILESTONE."}</b><span>GAME PAUSED Ⅱ</span></header>
    <div className="story-card__body">
      <div className="story-card__emblem" aria-hidden="true">{fact ? fact.symbol : "✓"}<small>{fact ? "QUANTUM CAB" : "PAID IN FULL"}</small></div>
      <div className="story-card__copy"><p className="story-card__eyebrow">{fact ? fact.level : "WINTER TIRE FINANCING // CLEARED"}</p>
        <h2 id="story-card-title">{fact ? fact.title : "THOSE TIRES ARE YOURS!"}</h2>
        <p id="story-card-text">{fact ? fact.text : "You started this run $1,000 in the red. Fare by fare, you covered the winter tires and brought your balance above zero. Congratulations, driver."}</p>
        <p className="story-card__aside">{fact ? fact.aside : `Run balance: $${card.kind === "tires-paid" ? card.balance.toLocaleString() : 0}. The next fare is yours to earn.`}</p>
      </div>
    </div>
    <footer>
      <button type="button" className="story-card__reply" aria-keyshortcuts="Enter"
        aria-label={card.kind === "quantum" ? `${card.rider}: ${card.response} Resume driving.` : "Winter tires paid off. Resume driving."}
        onPointerDown={event => { pressed.current = event.isPrimary && event.button === 0; }}
        onPointerCancel={() => { pressed.current = false; }}
        onClick={event => {
          const selected = event.detail === 0 || pressed.current;
          pressed.current = false;
          if (selected) onDismiss();
        }}>
        {card.kind === "quantum" && frame && <span className="story-card__portrait" aria-hidden="true" style={{ backgroundImage: `url(${fareArtAsset("pickup", frame.sheet)})`, backgroundPosition: frame.backgroundPosition }} />}
        <span><small>{card.kind === "quantum" ? `${card.rider} REPLIES` : "THE ACCORD APPROVES"}</small><strong>{card.kind === "quantum" ? `“${card.response}”` : "“Same tires. Lighter conscience. Let’s drive.”"}</strong></span><b aria-hidden="true">↗</b>
      </button>
      <p>TO CONTINUE: TAP / CLICK THE REPLY · ENTER · GAMEPAD ✕</p>
    </footer>
  </dialog>;
}
