import type { Camera, Game } from "@/game/model";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

export function presentPassengerReview(element: HTMLDivElement, game: Game, camera: Camera, width: number, height: number) {
  const review = game.passengerReview;
  if (!review || game.elapsed >= review.until || (game.player.kind === "walking" && game.player.location.kind === "interior")) {
    element.hidden = true;
    return;
  }
  const point = review.point;
  const screen = projectWorldPoint(viewProjection(game, camera, width / height, 1200), point.x, point.y, (point.z ?? 0) + 2.8, width, height);
  element.hidden = !screen || screen.x < 0 || screen.x > width || screen.y < 0 || screen.y > height;
  if (!screen) return;
  const text = `${review.job.rider} · ${review.stars}/5\n${"★".repeat(review.stars)}${"☆".repeat(5 - review.stars)}\n“${review.comment}”\n${review.tip ? `+$${review.tip} TIP` : "NO TIP"}`;
  if (element.textContent !== text) element.textContent = text;
  const halfWidth = element.offsetWidth / 2;
  const left = Math.max(halfWidth + 10, Math.min(width - halfWidth - 10, screen.x));
  element.style.left = `${left}px`;
  element.style.top = `${Math.max(element.offsetHeight + 12, screen.y)}px`;
  element.style.setProperty("--review-tail-x", `${Math.max(12, Math.min(element.offsetWidth - 24, halfWidth + screen.x - left - 9))}px`);
}
