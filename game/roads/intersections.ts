import type { RoadGraphSegment } from "./graph";
import { roadDistance, type RoadControlPoint } from "./geometry";

/** Split physical crossings once at compile time; XY overlap alone never joins decks. */
export function splitRoadIntersections(segments: readonly RoadGraphSegment[]): RoadGraphSegment[] {
  const cuts = segments.map((segment) => [{ t: 0, point: segment.a }, { t: 1, point: segment.b }]);
  const cells = new Map<string, number[]>();
  const checked = new Set<string>();
  const pointAt = (segment: RoadGraphSegment, t: number): RoadControlPoint => ({
    x: segment.a.x + (segment.b.x - segment.a.x) * t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
    z: (segment.a.z ?? 0) + ((segment.b.z ?? 0) - (segment.a.z ?? 0)) * t,
  });
  for (const [index, segment] of segments.entries()) {
    const minX = Math.floor(Math.min(segment.a.x, segment.b.x) / 36);
    const maxX = Math.floor(Math.max(segment.a.x, segment.b.x) / 36);
    const minY = Math.floor(Math.min(segment.a.y, segment.b.y) / 36);
    const maxY = Math.floor(Math.max(segment.a.y, segment.b.y) / 36);
    for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) {
      const key = `${x},${y}`;
      const cell = cells.get(key) ?? [];
      for (const otherIndex of cell) {
        const pairKey = `${otherIndex}:${index}`;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);
        const other = segments[otherIndex];
        const dx = segment.b.x - segment.a.x, dy = segment.b.y - segment.a.y;
        const ox = other.b.x - other.a.x, oy = other.b.y - other.a.y;
        const qx = other.a.x - segment.a.x, qy = other.a.y - segment.a.y;
        const denominator = dx * oy - dy * ox;
        if (Math.abs(denominator) < 1e-8) continue;
        const t = (qx * oy - qy * ox) / denominator;
        const u = (qx * dy - qy * dx) / denominator;
        if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) continue;
        const a = pointAt(segment, Math.max(0, Math.min(1, t)));
        const b = pointAt(other, Math.max(0, Math.min(1, u)));
        if (Math.abs((a.z ?? 0) - (b.z ?? 0)) > 0.015) continue;
        // Endpoints are authoritative, keeping IDs and all already-authored joins.
        const point = t < 1e-6 ? segment.a : t > 1 - 1e-6 ? segment.b
          : u < 1e-6 ? other.a : u > 1 - 1e-6 ? other.b : a;
        cuts[index].push({ t, point });
        cuts[otherIndex].push({ t: u, point });
      }
      cell.push(index);
      cells.set(key, cell);
    }
  }
  return segments.flatMap((segment, index) => {
    const points = cuts[index].sort((a, b) => a.t - b.t)
      .filter((point, i, all) => i === 0 || point.t - all[i - 1].t > 1e-6);
    return points.slice(1).flatMap((cut, i) => roadDistance(points[i].point, cut.point) < 0.001 ? [] : [{
      ...segment, id: `${segment.id}/${i}`, a: points[i].point, b: cut.point,
    }]);
  });
}
