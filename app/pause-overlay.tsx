import { useRef, type ReactNode } from "react";

function controlFor(target: EventTarget | null) {
  return target instanceof Element ? target.closest("button, a, summary, [role='button']") ?? target : null;
}

/** A driving finger can outlive its unmounted pedal when the game pauses. */
export function PauseOverlay({ children }: { children: ReactNode }) {
  const pressed = useRef(new WeakSet<Element>());
  return <div className="pause-overlay" role="region" aria-label="Game paused"
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
