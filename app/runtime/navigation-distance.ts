import type { Camera, Game, NavigationPlan } from "@/game/model";
import { navigationDistanceBadge } from "@/game/render/navigation-glyph";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

/** One world-anchored HTML badge stays crisp over every rendering backend. */
export function presentNavigationDistance(element: HTMLDivElement, game: Game, camera: Camera,
  seconds: number, navigation: NavigationPlan, width: number, height: number) {
  const badge = navigationDistanceBadge(game, seconds, navigation);
  if (!badge || width <= 0 || height <= 0) { element.hidden = true; return; }
  const { point } = badge;
  const screen = projectWorldPoint(viewProjection(game, camera, width / height, 1200), point.x, point.y, point.z, width, height);
  element.hidden = !screen || screen.x < -60 || screen.x > width + 60 || screen.y > height;
  if (!screen || element.hidden) return;
  for (const [index, value] of [badge.label, badge.distance, badge.remaining].entries()) {
    if (element.children[index].textContent !== value) element.children[index].textContent = value;
  }
  element.setAttribute("aria-label", `${badge.label}, ${badge.distance}, ${badge.remaining}`);
  const halfWidth = element.offsetWidth / 2;
  element.style.left = `${Math.max(halfWidth + 12, Math.min(width - halfWidth - 12, screen.x))}px`;
  // Leave the top meters and the mobile speed readout clear as an arrow approaches.
  element.style.top = `${Math.max(element.offsetHeight + 120, screen.y)}px`;
}
