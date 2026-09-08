import type { WorldPoint } from "./model";
import { nearestRoadProjection, routeRoadNetworkShortest } from "./road-network";
import { roadDistance } from "./roads/geometry";

export type RoadSnap = { point: WorldPoint; axis: "vertical" | "horizontal" };

export function snapToRoad(point: WorldPoint): RoadSnap {
  const projection = nearestRoadProjection(point);
  return { point: projection.point, axis: Math.abs(Math.sin(projection.tangentYaw)) > Math.SQRT1_2 ? "vertical" : "horizontal" };
}

/** Preserve crests and hairpins while removing redundant 3D collinearity. */
export function compactRoute(points: WorldPoint[]) {
  const unique = points.filter((point, index) => index === 0 || roadDistance(point, points[index - 1]) > 0.1);
  const output: WorldPoint[] = [];
  for (const point of unique) {
    const previous = output[output.length - 1];
    const before = output[output.length - 2];
    if (before && previous) {
      const a = { x: previous.x - before.x, y: previous.y - before.y, z: (previous.z ?? 0) - (before.z ?? 0) };
      const b = { x: point.x - previous.x, y: point.y - previous.y, z: (point.z ?? 0) - (previous.z ?? 0) };
      const scale = Math.max(0.01, Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z));
      const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) / scale;
      if (cross < 0.002 && a.x * b.x + a.y * b.y + a.z * b.z >= 0) output.pop();
    }
    output.push(point);
  }
  return output;
}

export function routeLength(route: readonly WorldPoint[]) {
  let total = 0;
  for (let index = 1; index < route.length; index += 1) total += roadDistance(route[index - 1], route[index]);
  return total;
}

/** All modes and fare quotes use the same connected, directed road graph. */
export function buildGpsRoute(start: WorldPoint, target: WorldPoint) {
  const network = routeRoadNetworkShortest(start, target);
  // No invented straight line through a disconnected deck or inactive region.
  return network ? compactRoute(network.route) : [{ ...start }];
}
