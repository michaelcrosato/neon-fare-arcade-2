import type { CareerState } from "./career";
import type { Game } from "./model";
import { FURNISHINGS, type FurnishingId } from "./furnishing-catalog";

/** Shopping is only available at that item's actual store counter. */
export function purchaseFurnishing(game: Game, career: CareerState, id: FurnishingId) {
  const item = FURNISHINGS.find(item => item.id === id)!;
  if (!item || game.player.kind !== "walking" || game.player.location.kind !== "interior"
    || game.player.location.venue.brand !== item.store) return { status: "wrong-store" as const, state: career };
  if (career.furnishings.owned.includes(id)) return { status: "owned" as const, state: career };
  if (career.bank < item.cost) return { status: "insufficient" as const, state: career };
  const furnishings = { owned: [...career.furnishings.owned, id], placed: [...career.furnishings.placed, id] };
  game.homeFurnishings = [...furnishings.placed];
  return { status: "purchased" as const, state: { ...career, bank: career.bank - item.cost, furnishings } };
}

/** Fixed room slots keep the exit, dispatch desk and walking routes clear. */
export function placeFurnishing(game: Game, career: CareerState, id: FurnishingId, placed: boolean) {
  if (game.player.kind !== "walking" || game.player.location.kind !== "interior" || game.player.location.venue.kind !== "home"
    || !career.furnishings.owned.includes(id)) return { status: "unavailable" as const, state: career };
  const next = career.furnishings.placed.filter(current => current !== id);
  if (placed) next.push(id);
  game.homeFurnishings = next;
  return { status: "placed" as const, state: { ...career, furnishings: { ...career.furnishings, placed: next } } };
}
