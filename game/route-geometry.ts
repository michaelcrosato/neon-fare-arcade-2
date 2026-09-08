import { ROAD_SPACING } from "./config";
import { distance, nearestRoadX, nearestRoadY } from "./math";
import type { Vec2 } from "./model";
import { containingRegionForPosition } from "./regions";
import { routeRoadNetworkShortest } from "./road-network";
import { regionUsesSparseRoadTopology, routeStaysOnEnabledRoads } from "./road-topology";

export type RoadSnap = { point: Vec2; axis: "vertical" | "horizontal" };

export function snapToRoad(point: Vec2): RoadSnap {
  const roadX = nearestRoadX(point.x);
  const roadY = nearestRoadY(point.y);
  if (Math.abs(point.x - roadX) <= Math.abs(point.y - roadY)) {
    return { point: { x: roadX, y: point.y }, axis: "vertical" };
  }
  return { point: { x: point.x, y: roadY }, axis: "horizontal" };
}

export function compactRoute(points: Vec2[]) {
  const unique = points.filter((point, index) => index === 0 || distance(point, points[index - 1]) > 0.1);
  const output: Vec2[] = [];
  for (const point of unique) {
    const previous = output[output.length - 1];
    const before = output[output.length - 2];
    if (before && previous) {
      const firstX = previous.x - before.x;
      const firstY = previous.y - before.y;
      const secondX = point.x - previous.x;
      const secondY = point.y - previous.y;
      const scale = Math.max(0.01, Math.hypot(firstX, firstY) * Math.hypot(secondX, secondY));
      const cross = Math.abs(firstX * secondY - firstY * secondX) / scale;
      const continuesForward = firstX * secondX + firstY * secondY >= 0;
      if (cross < 0.012 && continuesForward) output.pop();
    }
    output.push(point);
  }
  return output;
}

export function routeLength(route: readonly Vec2[]) {
  let total = 0;
  for (let index = 1; index < route.length; index += 1) total += distance(route[index - 1], route[index]);
  return total;
}

function buildLegacyGpsRoute(start: Vec2, target: Vec2) {
  const from = snapToRoad(start);
  const to = snapToRoad(target);
  const base = [start, from.point];
  if (from.axis !== to.axis) {
    const turn = from.axis === "vertical"
      ? { x: from.point.x, y: to.point.y }
      : { x: to.point.x, y: from.point.y };
    const direct = compactRoute([...base, turn, to.point, target]);
    if (routeStaysOnEnabledRoads(direct)) return direct;
    return campusDetourRoute(start, target, from, to);
  }

  if (from.axis === "vertical" && Math.abs(from.point.x - to.point.x) > 0.1) {
    const candidates = [nearestRoadY(start.y), nearestRoadY(target.y)].map((crossY) => compactRoute([
      ...base,
      { x: from.point.x, y: crossY },
      { x: to.point.x, y: crossY },
      to.point,
      target,
    ]));
    const valid = candidates.filter(routeStaysOnEnabledRoads);
    if (valid.length > 0) return valid.sort((a, b) => routeLength(a) - routeLength(b))[0];
    return campusDetourRoute(start, target, from, to);
  }

  if (from.axis === "horizontal" && Math.abs(from.point.y - to.point.y) > 0.1) {
    const candidates = [nearestRoadX(start.x), nearestRoadX(target.x)].map((crossX) => compactRoute([
      ...base,
      { x: crossX, y: from.point.y },
      { x: crossX, y: to.point.y },
      to.point,
      target,
    ]));
    const valid = candidates.filter(routeStaysOnEnabledRoads);
    if (valid.length > 0) return valid.sort((a, b) => routeLength(a) - routeLength(b))[0];
    return campusDetourRoute(start, target, from, to);
  }

  const direct = compactRoute([...base, to.point, target]);
  return routeStaysOnEnabledRoads(direct) ? direct : campusDetourRoute(start, target, from, to);
}

function campusDetourRoute(start: Vec2, target: Vec2, from: RoadSnap, to: RoadSnap) {
  const candidates: Vec2[][] = [];
  const startRoadX = nearestRoadX(start.x);
  const startRoadY = nearestRoadY(start.y);
  const targetRoadX = nearestRoadX(target.x);
  const targetRoadY = nearestRoadY(target.y);
  for (let offset = -3; offset <= 3; offset += 1) {
    const viaY = nearestRoadY((start.y + target.y) / 2 + offset * ROAD_SPACING);
    candidates.push(compactRoute([
      start,
      from.point,
      { x: startRoadX, y: from.point.y },
      { x: startRoadX, y: viaY },
      { x: targetRoadX, y: viaY },
      { x: targetRoadX, y: to.point.y },
      to.point,
      target,
    ]));
    const viaX = nearestRoadX((start.x + target.x) / 2 + offset * ROAD_SPACING);
    candidates.push(compactRoute([
      start,
      from.point,
      { x: from.point.x, y: startRoadY },
      { x: viaX, y: startRoadY },
      { x: viaX, y: targetRoadY },
      { x: to.point.x, y: targetRoadY },
      to.point,
      target,
    ]));
  }
  const valid = candidates
    .filter((route) => route.every((point, index) => {
      if (index === 0) return true;
      const before = route[index - 1];
      return Math.abs(point.x - before.x) < 0.02 || Math.abs(point.y - before.y) < 0.02;
    }))
    .filter(routeStaysOnEnabledRoads)
    .sort((a, b) => routeLength(a) - routeLength(b));
  return valid[0] ?? compactRoute([start, from.point, to.point, target]);
}

export function buildGpsRoute(start: Vec2, target: Vec2) {
  const legacy = buildLegacyGpsRoute(start, target);
  const startRegion = containingRegionForPosition(start.x, start.y);
  const targetRegion = containingRegionForPosition(target.x, target.y);
  const needsRegionalGraph = regionUsesSparseRoadTopology(startRegion?.id)
    || regionUsesSparseRoadTopology(targetRegion?.id)
    || !routeStaysOnEnabledRoads(legacy);
  if (!needsRegionalGraph) return legacy;
  const network = routeRoadNetworkShortest(start, target);
  return network ? compactRoute(network.route) : legacy;
}
