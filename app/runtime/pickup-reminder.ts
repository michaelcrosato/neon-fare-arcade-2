import { clamp, localPoint } from "@/game/math";
import type { Camera, Game, NavigationPlan } from "@/game/model";
import { vehicleDirectionArrowGeometry } from "@/game/render/navigation-glyph";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

/** Keep the pickup tip immediately above the cab and its canonical direction cue. */
export function presentPickupReminder(element: HTMLElement, game: Game, camera: Camera,
  navigation: NavigationPlan, width: number, height: number,
  exitBounds?: { x: number; y: number; width: number; height: number }) {
  const cardWidth = element.offsetWidth, cardHeight = element.offsetHeight;
  // The review and other priority feedback can temporarily hide the reminder.
  if (!cardWidth || !cardHeight || width <= 0 || height <= 0) return;
  const matrix = viewProjection(game, camera, width / height, 1200);
  const cab = projectWorldPoint(matrix, game.x, game.y, (game.z ?? 0) + 2, width, height);
  let cueTop = cab && cab.y >= 0 && cab.y <= height ? cab.y : Infinity;
  // A fixed animation phase prevents the text from bobbing with the arrow.
  for (const box of vehicleDirectionArrowGeometry(game, 0, navigation, camera.mode)) {
    for (const forward of [-.5, .5]) for (const cross of [-.5, .5]) for (const up of [-.5, .5]) {
      const point = localPoint(box.x, box.y, box.yaw, box.sx * forward, box.sy * cross);
      const screen = projectWorldPoint(matrix, point.x, point.y, box.z + box.sz * up, width, height);
      if (screen && screen.y >= 0 && screen.y <= height) cueTop = Math.min(cueTop, screen.y);
    }
  }
  if (!Number.isFinite(cueTop)) cueTop = height * .5;
  const x = clamp(cab?.x ?? width / 2, cardWidth / 2 + 12, width - cardWidth / 2 - 12) - cardWidth / 2;
  if (exitBounds && x < exitBounds.x + exitBounds.width && x + cardWidth > exitBounds.x) {
    cueTop = Math.min(cueTop, exitBounds.y);
  }
  const maxTop = Math.max(12, height - cardHeight - (camera.mobile ? 112 : 12));
  const y = clamp(cueTop - cardHeight - 14, Math.min(camera.mobile ? 126 : 112, maxTop), maxTop);
  element.style.left = `${x + cardWidth / 2}px`;
  element.style.top = `${y}px`;
  element.style.visibility = "visible";
  return { x, y, width: cardWidth, height: cardHeight };
}
