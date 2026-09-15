import type { Camera, Game, NavigationPlan } from "@/game/model";
import { clamp, localPoint } from "@/game/math";
import { isDriving } from "@/game/player";
import { vehicleDirectionArrowGeometry } from "@/game/render/navigation-glyph";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

/** Project the canonical vehicle arrow even between its temporary appearances. */
export function presentClutchWarning(element: HTMLDivElement, game: Game, camera: Camera,
  seconds: number, navigation: NavigationPlan, width: number, height: number,
  exitBounds?: { x: number; y: number; width: number; height: number }) {
  element.hidden = game.vehicleId !== "accord-v6" || !isDriving(game) || !game.transmission.stuck || width <= 0 || height <= 0;
  if (element.hidden) return;
  const matrix = viewProjection(game, camera, width / height, 1200);
  let left = Infinity, right = -Infinity, top = Infinity;
  // The departure glyph is flat, with yaw only. Its box corners include its outline.
  for (const box of vehicleDirectionArrowGeometry(game, seconds, navigation, camera.mode)) {
    for (const forward of [-.5, .5]) for (const cross of [-.5, .5]) for (const up of [-.5, .5]) {
      const point = localPoint(box.x, box.y, box.yaw, box.sx * forward, box.sy * cross);
      const screen = projectWorldPoint(matrix, point.x, point.y, box.z + box.sz * up, width, height);
      if (!screen) continue;
      left = Math.min(left, screen.x); right = Math.max(right, screen.x); top = Math.min(top, screen.y);
    }
  }
  // Cab view or an obstructed camera may put the whole glyph outside the frustum.
  const anchorX = Number.isFinite(left) ? (left + right) / 2 : width / 2;
  const anchorY = Number.isFinite(top) ? top : height * .45;
  const warningWidth = element.offsetWidth, warningHeight = element.offsetHeight;
  const side = warningWidth / 2 + 12;
  const bottom = warningHeight + (camera.mobile ? 112 : 12);
  let warningTop = anchorY - warningHeight - 12;
  if (exitBounds) {
    const x = clamp(anchorX, side, width - side) - warningWidth / 2;
    const y = clamp(warningTop, Math.min(camera.mobile ? 126 : 12, height - bottom), height - bottom);
    if (x < exitBounds.x + exitBounds.width && x + warningWidth > exitBounds.x
      && y < exitBounds.y + exitBounds.height && y + warningHeight > exitBounds.y) {
      warningTop = exitBounds.y - warningHeight - 12;
    }
  }
  element.style.left = `clamp(${side}px, ${anchorX}px, calc(100% - ${side}px))`;
  element.style.top = `clamp(min(${camera.mobile ? 126 : 12}px, calc(100% - ${bottom}px)), ${warningTop}px, calc(100% - ${bottom}px))`;
}
