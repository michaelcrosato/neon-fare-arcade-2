type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null };
type FullscreenRoot = HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> };

/** Call directly from the start gesture; unsupported browsers keep the full viewport layout. */
export async function requestGameFullscreen(doc: FullscreenDocument = document) {
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
  const root = doc.documentElement as FullscreenRoot;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" });
    else await root.webkitRequestFullscreen?.();
  } catch {
    // Fullscreen can be unavailable in an embedded view or a mobile browser.
    // The game still starts with viewport and touch protection in place.
  }
}

export function protectGameGestures(stage: HTMLElement, active: () => boolean) {
  const preventGesture = (event: Event) => {
    if (active() && event.cancelable) event.preventDefault();
  };
  const events = ["touchmove", "gesturestart", "gesturechange", "contextmenu"] as const;
  for (const event of events) stage.addEventListener(event, preventGesture, { passive: false });
  return () => {
    for (const event of events) stage.removeEventListener(event, preventGesture);
  };
}
