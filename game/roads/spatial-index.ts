import { projectRoadSegment, sweepRoadSegment, type CompiledRoad, type RoadControlPoint, type RoadSurfaceProjection, type RoadVector } from "./geometry";

type IndexedSegment = { road: CompiledRoad; index: number };

/** Immutable world-space broad phase. Cost depends on nearby roads, not world size. */
export class RoadSpatialIndex {
  private readonly cells = new Map<string, IndexedSegment[]>();

  constructor(roads: readonly CompiledRoad[], private readonly cellSize = 36) {
    if (!(cellSize > 0) || !Number.isFinite(cellSize)) throw new Error("Invalid road index cell size");
    for (const road of roads) {
      for (let index = 0; index < road.sections.length - 1; index += 1) {
        const a = road.sections[index];
        const b = road.sections[index + 1];
        const extent = Math.max(a.halfWidth, b.halfWidth) * 2;
        const minX = Math.floor((Math.min(a.center.x, b.center.x) - extent) / cellSize);
        const maxX = Math.floor((Math.max(a.center.x, b.center.x) + extent) / cellSize);
        const minY = Math.floor((Math.min(a.center.y, b.center.y) - extent) / cellSize);
        const maxY = Math.floor((Math.max(a.center.y, b.center.y) + extent) / cellSize);
        const entry = { road, index };
        for (let x = minX; x <= maxX; x += 1) {
          for (let y = minY; y <= maxY; y += 1) {
            const key = `${x},${y}`;
            const cell = this.cells.get(key);
            if (cell) cell.push(entry);
            else this.cells.set(key, [entry]);
          }
        }
      }
    }
  }

  private nearbySegments(point: RoadControlPoint, radius: number) {
    if (!(radius >= 0) || !Number.isFinite(radius + point.x + point.y + (point.z ?? 0))) {
      throw new Error("Invalid road surface query");
    }
    const candidates = new Set<IndexedSegment>();
    const minX = Math.floor((point.x - radius) / this.cellSize);
    const maxX = Math.floor((point.x + radius) / this.cellSize);
    const minY = Math.floor((point.y - radius) / this.cellSize);
    const maxY = Math.floor((point.y + radius) / this.cellSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (const candidate of this.cells.get(`${x},${y}`) ?? []) candidates.add(candidate);
      }
    }
    return candidates;
  }

  /** All nearby decks, ordered by physical distance with an optional heading hint. */
  query(point: RoadControlPoint, radius = 12, heading?: number): RoadSurfaceProjection[] {
    const results = [...this.nearbySegments(point, radius)]
      .map(({ road, index }) => projectRoadSegment(road, index, point))
      .filter((projection) => projection.surfaceDistance <= radius);
    const score = (projection: RoadSurfaceProjection) => Math.hypot(projection.surfaceDistance, projection.heightDistance)
      + projection.centerDistance * 0.001
      + (heading === undefined ? 0 : Math.abs(Math.sin(projection.heading - heading)) * 0.2);
    return results.sort((a, b) => score(a) - score(b) || a.roadId.localeCompare(b.roadId) || a.segmentIndex - b.segmentIndex);
  }

  /** Feet must cross a real triangle from above; a bridge's underside cannot land them. */
  sweep(from: RoadVector, to: RoadVector): RoadSurfaceProjection | null {
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const radius = Math.hypot(to.x - from.x, to.y - from.y) / 2 + 0.05;
    let first = Infinity, contact: RoadSurfaceProjection | null = null;
    for (const { road, index } of this.nearbySegments(midpoint, radius)) {
      const fraction = sweepRoadSegment(road, index, from, to);
      if (fraction >= first) continue;
      first = fraction;
      contact = projectRoadSegment(road, index, {
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        z: from.z + (to.z - from.z) * fraction,
      });
    }
    return contact;
  }
}
