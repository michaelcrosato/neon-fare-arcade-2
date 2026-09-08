import { NAVIGATION_ARRIVAL_RADIUS, ROAD_HALF, ROAD_SPACING } from "./config";
import { distance } from "./math";
import type { Game, Vec2, WorldPoint } from "./model";
import { clampPointToActiveRegions, isPlayablePoint } from "./regions";
import { isRoadSurface, nearestRoadProjection, nearestSpecialRoadProjection } from "./road-network";

export type MapViewBox = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type MapViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Converts a pointer position into SVG world coordinates while accounting for
 * the letterboxing created by the map's default xMidYMid meet behavior.
 */
export function mapClientPointToWorld(
  client: Vec2,
  viewport: MapViewport,
  viewBox: MapViewBox,
): Vec2 | null {
  const values = [
    client.x,
    client.y,
    viewport.left,
    viewport.top,
    viewport.width,
    viewport.height,
    viewBox.minX,
    viewBox.minY,
    viewBox.width,
    viewBox.height,
  ];
  if (
    values.some((value) => !Number.isFinite(value))
    || viewport.width <= 0
    || viewport.height <= 0
    || viewBox.width <= 0
    || viewBox.height <= 0
  ) {
    return null;
  }
  const scale = Math.min(viewport.width / viewBox.width, viewport.height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const offsetX = viewport.left + (viewport.width - renderedWidth) / 2;
  const offsetY = viewport.top + (viewport.height - renderedHeight) / 2;
  const localX = client.x - offsetX;
  const localY = client.y - offsetY;
  if (localX < 0 || localX > renderedWidth || localY < 0 || localY > renderedHeight) return null;
  return {
    x: viewBox.minX + localX / scale,
    y: viewBox.minY + localY / scale,
  };
}

/** A map pin always resolves onto the centerline of an authored drivable road. */
export function customDestinationForMapPoint(point: WorldPoint): WorldPoint | null {
  if (!isPlayablePoint(point.x, point.y)) return null;
  const nearest = nearestRoadProjection(point);
  const special = point.z === undefined ? nearestSpecialRoadProjection(point) : null;
  const projection = special && special.centerDistance < nearest.centerDistance && special.surfaceDistance <= 0
    ? special : nearest;
  if (!isRoadSurface(projection.point)) return null;
  if (!isPlayablePoint(projection.point.x, projection.point.y, ROAD_HALF)) return null;
  return {
    x: Math.round(projection.point.x * 100) / 100,
    y: Math.round(projection.point.y * 100) / 100,
    ...((projection.point.z ?? 0) === 0 ? {} : { z: projection.point.z }),
  };
}

/** Keyboard map movement stays on the active-region union and re-snaps to roads. */
export function moveCustomDestination(point: WorldPoint, dx: number, dy: number): WorldPoint {
  const candidate = clampPointToActiveRegions({ x: point.x + dx, y: point.y + dy }, ROAD_HALF);
  return customDestinationForMapPoint(candidate) ?? point;
}

export function setCustomDestination(game: Game, point: WorldPoint) {
  const destination = customDestinationForMapPoint(point);
  if (!destination) return null;
  game.customDestination = destination;
  return destination;
}

export function clearCustomDestination(game: Game) {
  const hadDestination = game.customDestination !== null;
  game.customDestination = null;
  return hadDestination;
}

export function customDestinationReached(game: Game) {
  return Boolean(
    game.customDestination
    && Math.abs((game.z ?? 0) - (game.customDestination.z ?? 0)) < 1.4
    && distance({ x: game.x, y: game.y }, game.customDestination) <= NAVIGATION_ARRIVAL_RADIUS,
  );
}

export const CUSTOM_DESTINATION_KEYBOARD_STEP = ROAD_SPACING;
