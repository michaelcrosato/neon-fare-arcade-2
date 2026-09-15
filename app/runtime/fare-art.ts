import type { Game } from "../../game/model";
import { fareArtAsset, fareArtFrame } from "../../game/fare-presentation";

/** One decode per idle slice, with bounded pending work and decoded retention. */
export function createImageWarmQueue<T>(load: (url: string) => Promise<T>, schedule: (work: () => void) => void, capacity = 8) {
  const ready = new Map<string, T>(), pending = new Set<string>();
  let active: string | null = null, scheduled = false;
  const requestNext = () => {
    if (active || scheduled || !pending.size) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      const url = pending.values().next().value;
      if (!url) return;
      pending.delete(url); active = url;
      void load(url).then(image => {
        ready.set(url, image);
        if (ready.size > capacity) ready.delete(ready.keys().next().value!);
      }).catch(() => {
        // A missing/offline sheet must never delay a card or block the queue.
      }).finally(() => { active = null; requestNext(); });
    });
  };
  return (url: string) => {
    if (ready.has(url)) {
      const image = ready.get(url)!; ready.delete(url); ready.set(url, image); return;
    }
    if (url === active || pending.has(url)) return;
    pending.add(url);
    if (pending.size > capacity) pending.delete(pending.values().next().value!);
    requestNext();
  };
}

let warmImage: ReturnType<typeof createImageWarmQueue<HTMLImageElement>> | undefined;
export function warmFareArt(kind: "pickup" | "dropoff", cell: number) {
  if (typeof window === "undefined") return;
  warmImage ??= createImageWarmQueue(async url => {
    const image = new window.Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = url;
    await image.decode();
    return image;
  }, work => {
    if (window.requestIdleCallback) window.requestIdleCallback(work, { timeout: 1000 });
    else window.setTimeout(work, 50);
  });
  warmImage(fareArtAsset(kind, fareArtFrame(cell).sheet));
}

/** Warm only artwork belonging to the current six-fare market. */
export function warmPassengerArt(jobs: Game["fareJobs"]) {
  for (const job of jobs) warmFareArt("pickup", job.passengerArtCell);
}
