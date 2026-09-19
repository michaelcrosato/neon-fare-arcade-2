import type { Game, Vec2 } from "./model";
import { containingRegionForPosition } from "./regions";

/** Run-local exploration history; entering a region counts even while Off Duty. */
export function recordRegionVisit(game: Game, position: Vec2) {
  const region = containingRegionForPosition(position.x, position.y);
  if (!region) return;
  // Older replay checkpoints may predate exploration history.
  game.visitedRegionIds ??= [game.fareServiceRegionId];
  if (!game.visitedRegionIds.includes(region.id)) game.visitedRegionIds.push(region.id);
}
