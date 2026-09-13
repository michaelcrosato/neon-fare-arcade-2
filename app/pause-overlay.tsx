import { useEffect, useRef, type ReactNode } from "react";

function controlFor(target: EventTarget | null) {
  return target instanceof Element ? target.closest("button, a, summary, [role='button']") ?? target : null;
}

/** A driving finger can outlive its unmounted pedal when the game pauses. */
export function PauseOverlay({ children }: { children: ReactNode }) {
  const pressed = useRef(new WeakSet<Element>());
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <div ref={overlay} className="pause-overlay" role="region" aria-label="Game paused"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(overlay.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0'], summary") ?? [])
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onPointerDownCapture={event => {
      const control = controlFor(event.target);
      if (control) pressed.current.add(control);
    }}
    onPointerCancelCapture={event => {
      const control = controlFor(event.target);
      if (control) pressed.current.delete(control);
    }}
    onClickCapture={event => {
      // Keyboard and assistive activation have no preceding pointer press.
      if (event.detail === 0) return;
      const control = controlFor(event.target);
      if (!control || !pressed.current.delete(control)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>{children}</div>;
}
