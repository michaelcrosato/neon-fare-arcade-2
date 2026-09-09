import type { Camera, Game } from "@/game/model";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

export function presentPassengerReview(element: HTMLDivElement, game: Game, camera: Camera, gpu: boolean, width: number, height: number) {
  const review = game.passengerReview;
  if (!review || game.elapsed >= review.until || (game.player.kind === "walking" && game.player.location.kind === "interior")) {
    element.hidden = true;
    return;
  }
  const point = review.point;
  let screen;
  if (gpu) {
    screen = projectWorldPoint(viewProjection(game, camera, width / height, 1200), point.x, point.y, (point.z ?? 0) + 2.8, width, height);
  } else {
    const denominator = camera.mode === "chase-high" ? camera.onFoot ? 46 : 58 : camera.mode === "chase-low" ? camera.onFoot ? 39 : 48 : camera.mode === "cab" ? 42 : 50;
    const anchor = camera.mode === "chase-high" ? 0.68 : camera.mode === "chase-low" ? 0.77 : camera.mode === "cab" ? 0.84 : 0.5;
    const scale = Math.min(width, height) / denominator * camera.zoom;
    const dx = point.x - camera.x, dy = point.y - camera.y;
    const fx = Math.cos(camera.heading), fy = Math.sin(camera.heading);
    screen = {
      x: width / 2 + (camera.mode === "fixed" ? dx : -fy * dx + fx * dy) * scale,
      y: height * anchor + (camera.mode === "fixed" ? dy : -fx * dx - fy * dy) * scale
        + (camera.heightOffset - (point.z ?? 0)) * scale * 0.6 - Math.max(26, Math.min(62, scale * 2.65)) * 1.08,
    };
  }
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
