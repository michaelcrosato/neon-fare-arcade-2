import type { Box, Camera, Game, NavigationPlan } from "@/game/model";
import { vehicleDepartureArrowBoxes } from "@/game/render/navigation-glyph";
import { taxiBoxes } from "@/game/render/scene";
import { boxSurfaceFaces } from "@/game/render/surfaces";
import { projectWorldPoint, viewProjection } from "@/game/render/view-projection";

export type FareRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export const FARE_CLEARANCE = 18;

/** Center desktop banners; let mobile cards use the largest clear top space. */
export function fitFareImpact(width: number, height: number, obstacles: readonly FareRect[],
  layout: "desktop" | "mobile" = "desktop"): FareRect {
  const blocked = obstacles.map(rect => ({
    x: rect.x - FARE_CLEARANCE, y: rect.y - FARE_CLEARANCE,
    width: rect.width + FARE_CLEARANCE * 2, height: rect.height + FARE_CLEARANCE * 2,
  })).filter(rect => rect.x < width && rect.x + rect.width > 0 && rect.y + rect.height > 0);
  if (layout === "desktop") {
    const cardWidth = Math.floor(width / 2), x = (width - cardWidth) / 2;
    const maxHeight = Math.min(height * .38, cardWidth / 1.5);
    const centered = blocked.filter(rect => rect.x < x + cardWidth && rect.x + rect.width > x);
    // Stay above the cab/arrow. Only a first-person arrow at the top can move
    // the banner down; neither obstacle size nor card kind changes its center.
    const tops = [0, ...centered.map(rect => Math.max(0, Math.ceil(rect.y + rect.height)))].sort((a, b) => a - b);
    for (const y of tops) {
      let cardHeight = Math.min(height - y, maxHeight);
      for (const rect of centered) if (rect.y + rect.height > y) {
        cardHeight = Math.min(cardHeight, Math.max(0, rect.y - y));
      }
      if (cardHeight >= 48) return { x, y, width: cardWidth, height: Math.floor(cardHeight) };
    }
    return { x, y: 0, width: cardWidth, height: 0 };
  }
  const edges = [...new Set([0, width, ...blocked.flatMap(rect => [
    Math.max(0, Math.min(width, rect.x)), Math.max(0, Math.min(width, rect.x + rect.width)),
  ])])].sort((a, b) => a - b);
  let best: FareRect = { x: 0, y: 0, width, height: 0 };
  const search = (tops: number[], minimumWidth: number) => {
    for (const y of tops) for (let left = 0; left < edges.length - 1; left++) for (let right = left + 1; right < edges.length; right++) {
      const x = edges[left], candidateWidth = edges[right] - x;
      // Keep a useful view of the road below the event and avoid tall, thin slivers.
      let candidateHeight = Math.min(height - y, height * .64, candidateWidth * 1.45);
      for (const rect of blocked) if (rect.y + rect.height > y + .01 && rect.x < edges[right] - .01 && rect.x + rect.width > x + .01) {
        candidateHeight = Math.min(candidateHeight, Math.max(0, rect.y - y));
      }
      if (candidateWidth < Math.min(minimumWidth, width) || candidateHeight < 48) continue;
      if (candidateWidth * candidateHeight > best.width * best.height) {
        const pixelX = Math.ceil(x), pixelY = Math.ceil(y);
        best = { x: pixelX, y: pixelY, width: Math.floor(edges[right]) - pixelX, height: Math.floor(y + candidateHeight) - pixelY };
      }
    }
  };
  search([0], 160);
  // A close first-person arrow can reach the top edge. Use a clear gap below it.
  if (best.height === 0) search([0, ...blocked.map(rect => Math.max(0, rect.y + rect.height))], 96);
  return best;
}

/** Use the same road-attached cab and departure/arrival arrow as both renderers. */
export function fareImpactObstacles(game: Game, camera: Camera, seconds: number,
  navigation: NavigationPlan, width: number, height: number): FareRect[] {
  const matrix = viewProjection(game, camera, width / height, 1400);
  const bounds = (boxes: Box[]): FareRect[] => {
    const points = boxes.flatMap(box => boxSurfaceFaces(box).slice(0, 2).flatMap(face => face.corners))
      .map(point => projectWorldPoint(matrix, point.x, point.y, point.z, width, height))
      .filter(point => point !== null);
    if (!points.length) return [];
    const x = Math.max(0, Math.min(...points.map(point => point.x)));
    const y = Math.max(0, Math.min(...points.map(point => point.y)));
    const right = Math.min(width, Math.max(...points.map(point => point.x)));
    const bottom = Math.min(height, Math.max(...points.map(point => point.y)));
    return right > x && bottom > y ? [{ x, y, width: right - x, height: bottom - y }] : [];
  };
  const cab = camera.mode === "cab"
    ? []
    : bounds(taxiBoxes(game, { includeGroundShadow: false }));
  return [...cab, ...bounds(vehicleDepartureArrowBoxes(game, seconds, navigation, camera.mode))];
}

/** Frame-owned placement follows camera changes without putting game state in React. */
export function presentFareImpact(element: HTMLDivElement, canvas: HTMLCanvasElement, game: Game,
  camera: Camera, seconds: number, navigation: NavigationPlan, badge?: FareRect) {
  const stage = canvas.getBoundingClientRect(), area = element.getBoundingClientRect();
  if (area.width <= 0 || area.height <= 0) return;
  const dock = element.closest(".game-stage")?.querySelector(".fare-card-stack")?.getBoundingClientRect();
  const obstacles = fareImpactObstacles(game, camera, seconds, navigation, stage.width, stage.height)
    .map(rect => ({ ...rect, x: rect.x + stage.x - area.x, y: rect.y + stage.y - area.y }));
  if (badge) obstacles.push({ ...badge, x: badge.x + stage.x - area.x, y: badge.y + stage.y - area.y });
  const rect = fitFareImpact(area.width, area.height, obstacles, camera.mobile ? "mobile" : "desktop");
  const wide = rect.width / Math.max(1, rect.height) >= 1.1;
  const art = Math.max(0, Math.floor(Math.min(wide ? rect.width * (rect.width < 240 ? .4 : .46) : rect.width - 16,
    wide ? rect.height - 8 : rect.height * .52)));
  const unit = wide ? Math.min((rect.width - art - 8) / 300, (rect.height - 8) / 220)
    : Math.min(rect.width / 340, rect.height / 440);
  const image = wide ? Math.max(art, rect.height - 8) : art;
  const values = { x: rect.x, y: rect.y, width: rect.width, height: rect.height, art, image, unit };
  for (const [name, value] of Object.entries(values)) {
    const next = name === "unit" ? value.toFixed(3) : `${value}px`;
    if (element.style.getPropertyValue(`--fare-fit-${name}`) !== next) element.style.setProperty(`--fare-fit-${name}`, next);
  }
  // Measure the actual rail slot (including the empty first-card slot), so the
  // exit stays attached to the deck across viewport and camera changes.
  const canDock = !camera.mobile && dock && dock.width > 0 && dock.height > 0 && rect.height > 0;
  element.dataset.docking = canDock ? "deck" : "fade";
  if (canDock) {
    const docking = {
      x: `${dock.x + dock.width / 2 - area.x - rect.x - rect.width / 2}px`,
      y: `${dock.y + dock.height / 2 - area.y - rect.y - rect.height / 2}px`,
      scale: Math.min(1, dock.width / rect.width, dock.height / rect.height).toFixed(5),
    };
    for (const [name, value] of Object.entries(docking)) {
      if (element.style.getPropertyValue(`--fare-dock-${name}`) !== value) element.style.setProperty(`--fare-dock-${name}`, value);
    }
  }
  element.dataset.layout = wide ? "wide" : "portrait";
  element.dataset.compact = String(wide ? rect.height < 190 || rect.width - art < 190 : rect.height < 300);
  element.dataset.tight = String(rect.height < 160);
  element.style.visibility = rect.height > 0 ? "visible" : "hidden";
}
