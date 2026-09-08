import {
  ROAD_SPACING,
  TRAFFIC_LANE_OFFSET,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  WORLD_ROAD_MIN_X,
  WORLD_ROAD_MIN_Y,
} from "./config";
import type { Color, Vec2 } from "./model";
export { blockRandom, mulberry32 } from "./random";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function rgba(color: Color, alpha = color[3]) {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${alpha})`;
}

function nearestRoadOnAxis(value: number, min: number, max: number) {
  return clamp(
    Math.round(value / ROAD_SPACING) * ROAD_SPACING,
    min,
    max,
  );
}

/** Legacy scalar helper; X is the wider active axis during the east expansion. */
export function nearestRoad(value: number) {
  return nearestRoadOnAxis(value, WORLD_ROAD_MIN_X, WORLD_ROAD_MAX_X);
}

export function nearestRoadX(value: number) {
  return nearestRoadOnAxis(value, WORLD_ROAD_MIN_X, WORLD_ROAD_MAX_X);
}

export function nearestRoadY(value: number) {
  return nearestRoadOnAxis(value, WORLD_ROAD_MIN_Y, WORLD_ROAD_MAX_Y);
}

export function nearestRoadDistance(value: number, axis: "x" | "y" = "x") {
  return Math.abs(value - (axis === "x" ? nearestRoadX(value) : nearestRoadY(value)));
}

export function rightHandTrafficLane(
  axis: "x" | "y",
  road: number,
  dir: 1 | -1,
) {
  return axis === "x"
    ? road + dir * TRAFFIC_LANE_OFFSET
    : road - dir * TRAFFIC_LANE_OFFSET;
}

export function rankFor(score: number) {
  if (score >= 6000) return "S";
  if (score >= 4500) return "A";
  if (score >= 3000) return "B";
  return "C";
}

export function localPoint(
  x: number,
  y: number,
  yaw: number,
  forward: number,
  right: number,
) {
  return {
    x: x + Math.cos(yaw) * forward - Math.sin(yaw) * right,
    y: y + Math.sin(yaw) * forward + Math.cos(yaw) * right,
  };
}

export function normalizeAngle(angle: number) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function segmentYaw(a: Vec2, b: Vec2) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
