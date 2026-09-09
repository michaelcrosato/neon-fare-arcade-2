import { CHUNK_SIZE, ROAD_SPACING } from "./config";
import { clamp } from "./math";
import type { Vec2 } from "./model";
import {
  ACTIVE_WORLD_REGIONS,
  WORLD_REGION_SLOTS,
  regionForPosition,
  regionRoadBounds,
  type RegionDirection,
  type WorldRegion,
} from "./regions";
import type { MapViewBox } from "./custom-destination";

export type RegionalMapView = {
  center: Vec2;
  spanY: number;
};

export type RegionalMapDetail = "overview" | "region" | "local";

export const REGIONAL_MAP_MIN_SPAN = ROAD_SPACING * 10;
export const REGIONAL_MAP_REGION_PADDING = ROAD_SPACING * 1.4;

const CENTER_REGION = ACTIVE_WORLD_REGIONS.find((region) => region.direction === "C")!;
const CENTER_BOUNDS = regionRoadBounds(CENTER_REGION);
export const REGIONAL_MAP_CELL_SIZE = CENTER_BOUNDS.maxX - CENTER_BOUNDS.minX;

export type RegionalMapSlot = {
  direction: RegionDirection;
  activeRegion: WorldRegion | null;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

/** Future cells retain their footprint; active regions can extend beyond a cell. */
export const REGIONAL_MAP_SLOTS: readonly RegionalMapSlot[] = WORLD_REGION_SLOTS.map((slot) => {
  const minX = CENTER_BOUNDS.minX + slot.gridX * REGIONAL_MAP_CELL_SIZE;
  const minY = CENTER_BOUNDS.minY + slot.gridY * REGIONAL_MAP_CELL_SIZE;
  const activeRegion = ACTIVE_WORLD_REGIONS.find((region) => region.id === slot.activeRegionId) ?? null;
  return {
    direction: slot.direction,
    activeRegion,
    bounds: activeRegion ? regionRoadBounds(activeRegion) : {
      minX,
      maxX: minX + REGIONAL_MAP_CELL_SIZE,
      minY,
      maxY: minY + REGIONAL_MAP_CELL_SIZE,
    },
  };
});

export const REGIONAL_MAP_PLANNED_BOUNDS = REGIONAL_MAP_SLOTS.reduce((bounds, slot) => ({
  minX: Math.min(bounds.minX, slot.bounds.minX),
  maxX: Math.max(bounds.maxX, slot.bounds.maxX),
  minY: Math.min(bounds.minY, slot.bounds.minY),
  maxY: Math.max(bounds.maxY, slot.bounds.maxY),
}), {
  minX: Number.POSITIVE_INFINITY,
  maxX: Number.NEGATIVE_INFINITY,
  minY: Number.POSITIVE_INFINITY,
  maxY: Number.NEGATIVE_INFINITY,
});

/** Enough vertical span for a complete nine-cell overview on narrow phones. */
export const REGIONAL_MAP_MAX_SPAN = Math.max(
  REGIONAL_MAP_PLANNED_BOUNDS.maxY - REGIONAL_MAP_PLANNED_BOUNDS.minY,
  (REGIONAL_MAP_PLANNED_BOUNDS.maxX - REGIONAL_MAP_PLANNED_BOUNDS.minX) / 0.62,
) + REGIONAL_MAP_REGION_PADDING * 2;

export function regionalMapViewBox(view: RegionalMapView, aspect: number): MapViewBox {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const spanY = clamp(view.spanY, REGIONAL_MAP_MIN_SPAN, REGIONAL_MAP_MAX_SPAN);
  const width = spanY * safeAspect;
  return {
    minX: view.center.x - width / 2,
    minY: view.center.y - spanY / 2,
    width,
    height: spanY,
  };
}

export function clampRegionalMapView(view: RegionalMapView, aspect: number): RegionalMapView {
  const spanY = clamp(view.spanY, REGIONAL_MAP_MIN_SPAN, REGIONAL_MAP_MAX_SPAN);
  const viewBox = regionalMapViewBox({ ...view, spanY }, aspect);
  const padding = REGIONAL_MAP_REGION_PADDING;
  const bounds = {
    minX: REGIONAL_MAP_PLANNED_BOUNDS.minX - padding,
    maxX: REGIONAL_MAP_PLANNED_BOUNDS.maxX + padding,
    minY: REGIONAL_MAP_PLANNED_BOUNDS.minY - padding,
    maxY: REGIONAL_MAP_PLANNED_BOUNDS.maxY + padding,
  };
  const centerForAxis = (
    center: number,
    span: number,
    min: number,
    max: number,
  ) => span >= max - min ? (min + max) / 2 : clamp(center, min + span / 2, max - span / 2);
  return {
    center: {
      x: centerForAxis(view.center.x, viewBox.width, bounds.minX, bounds.maxX),
      y: centerForAxis(view.center.y, viewBox.height, bounds.minY, bounds.maxY),
    },
    spanY,
  };
}

export function fitRegionalMapBounds(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  aspect: number,
  padding = REGIONAL_MAP_REGION_PADDING,
): RegionalMapView {
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;
  const spanY = Math.max(height, width / Math.max(0.1, aspect));
  return clampRegionalMapView({
    center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    spanY,
  }, aspect);
}

export function regionalMapPlayerView(player: Vec2, aspect: number) {
  return fitRegionalMapBounds(regionRoadBounds(regionForPosition(player.x, player.y)), aspect);
}

export function regionalMapOverviewView(aspect: number) {
  return fitRegionalMapBounds(REGIONAL_MAP_PLANNED_BOUNDS, aspect);
}

export function regionalMapRegionView(region: WorldRegion, aspect: number) {
  return fitRegionalMapBounds(regionRoadBounds(region), aspect);
}

export function zoomRegionalMapView(
  view: RegionalMapView,
  aspect: number,
  factor: number,
  focus = view.center,
) {
  const oldBox = regionalMapViewBox(view, aspect);
  const nextSpan = clamp(view.spanY * factor, REGIONAL_MAP_MIN_SPAN, REGIONAL_MAP_MAX_SPAN);
  const normalizedX = (focus.x - oldBox.minX) / oldBox.width;
  const normalizedY = (focus.y - oldBox.minY) / oldBox.height;
  const nextWidth = nextSpan * Math.max(0.1, aspect);
  return clampRegionalMapView({
    center: {
      x: focus.x - (normalizedX - 0.5) * nextWidth,
      y: focus.y - (normalizedY - 0.5) * nextSpan,
    },
    spanY: nextSpan,
  }, aspect);
}

export function panRegionalMapView(
  view: RegionalMapView,
  aspect: number,
  delta: Vec2,
) {
  return clampRegionalMapView({
    ...view,
    center: { x: view.center.x + delta.x, y: view.center.y + delta.y },
  }, aspect);
}

export function regionalMapDetail(spanY: number, regionSpan = REGIONAL_MAP_CELL_SIZE): RegionalMapDetail {
  if (spanY > regionSpan * 1.35) return "overview";
  if (spanY > CHUNK_SIZE * 4.5) return "region";
  return "local";
}

export function regionalMapZoomPercent(spanY: number) {
  return Math.round(clamp(REGIONAL_MAP_CELL_SIZE / spanY * 100, 20, 500));
}
