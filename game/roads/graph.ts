import { roadDistance, type RoadControlPoint } from "./geometry";

export type RoadGraphSegment = {
  id: string;
  pathId: string;
  kind: string;
  halfWidth: number;
  travelWeight: number;
  a: RoadControlPoint;
  b: RoadControlPoint;
  allowAB: boolean;
  allowBA: boolean;
};
type Edge = { id: number; to: string; segment: RoadGraphSegment; cost: number; yaw: number };
export type RouteSearchStats = { expanded: number; queued: number };
type RouteSearchOptions = { heuristicWeight?: number; stats?: RouteSearchStats };
export type GraphProjection = {
  segment: RoadGraphSegment;
  point: RoadControlPoint;
  t: number;
  centerDistance: number;
  heightDistance: number;
  tangentYaw: number;
};
export type GraphRoute = {
  route: RoadControlPoint[];
  departureYaw: number;
  cost: number;
  usesSpecialRoad: boolean;
};
type Bounds = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
type Tree = { bounds: Bounds; children?: [Tree, Tree]; segments?: RoadGraphSegment[] };
type QueueEntry<T> = { value: T; priority: number };

class MinQueue<T> {
  private readonly items: QueueEntry<T>[] = [];
  get length() { return this.items.length; }
  push(value: T, priority: number) {
    const item = { value, priority };
    let index = this.items.length;
    this.items.push(item);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    const first = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length) {
      let index = 0;
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child += 1;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

/** Millimeter world precision; equal XY on different decks is never one node. */
export function roadNodeKey(point: RoadControlPoint) {
  return `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)},${Math.round((point.z ?? 0) * 1000)}`;
}

function project(point: RoadControlPoint, segment: RoadGraphSegment): GraphProjection {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / (dx * dx + dy * dy)));
  const position: RoadControlPoint = { x: segment.a.x + dx * t, y: segment.a.y + dy * t };
  if (segment.a.z !== undefined || segment.b.z !== undefined) position.z = (segment.a.z ?? 0) + ((segment.b.z ?? 0) - (segment.a.z ?? 0)) * t;
  return {
    segment, point: position, t,
    centerDistance: Math.hypot(point.x - position.x, point.y - position.y),
    heightDistance: Math.abs((point.z ?? 0) - (position.z ?? 0)),
    tangentYaw: Math.atan2(dy, dx),
  };
}

function boundsFor(segments: readonly RoadGraphSegment[]): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (const segment of segments) {
    for (const point of [segment.a, segment.b]) {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.minZ = Math.min(bounds.minZ, point.z ?? 0);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
      bounds.maxZ = Math.max(bounds.maxZ, point.z ?? 0);
    }
  }
  return bounds;
}

function buildTree(segments: RoadGraphSegment[]): Tree {
  const bounds = boundsFor(segments);
  if (segments.length <= 12) return { bounds, segments };
  const axis = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY ? "x" : "y";
  segments.sort((a, b) => (a.a[axis] + a.b[axis]) - (b.a[axis] + b.b[axis]));
  const middle = Math.floor(segments.length / 2);
  return { bounds, children: [buildTree(segments.slice(0, middle)), buildTree(segments.slice(middle))] };
}

function boundsDistance(point: RoadControlPoint, bounds: Bounds) {
  return Math.hypot(
    Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX),
    Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY),
    Math.max(bounds.minZ - (point.z ?? 0), 0, (point.z ?? 0) - bounds.maxZ) * 4,
  );
}

function unique(points: RoadControlPoint[]) {
  const result: RoadControlPoint[] = [];
  for (const [index, point] of points.entries()) {
    if (!result.length || roadDistance(point, result[result.length - 1]) > 0.00001) result.push(point);
    else if (index === points.length - 1) result[result.length - 1] = point;
  }
  return result;
}

/**
 * Directed 3D routing over physically connected spans. Authoring splits actual
 * junctions before constructing the graph. Crossing in XY alone never adds an
 * edge. Virtual start/end points avoid routing to an endpoint and doubling back.
 */
export class RoadGraph {
  private readonly nodes = new Map<string, RoadControlPoint>();
  private readonly edges = new Map<string, Edge[]>();
  private readonly neighbors = new Map<string, Set<string>>();
  private readonly tree: Tree;
  private readonly minWeight: number;
  private readonly segmentOrder = new Map<RoadGraphSegment, number>();
  private readonly nodeOrder = new Map<string, number>();
  private readonly landmarks: Float64Array[] = [];

  constructor(readonly segments: readonly RoadGraphSegment[], landmarkCount = segments.length >= 512 ? 8 : 0) {
    if (!segments.length) throw new Error("Road graph requires connected spans");
    let minWeight = Infinity;
    for (const [index, segment] of segments.entries()) {
      if (!(segment.travelWeight > 0) || !Number.isFinite(segment.travelWeight)
        || ![segment.a.x, segment.a.y, segment.a.z ?? 0, segment.b.x, segment.b.y, segment.b.z ?? 0].every(Number.isFinite)
        || Math.hypot(segment.a.x - segment.b.x, segment.a.y - segment.b.y) < 1e-8) {
        throw new Error(`Invalid road graph span: ${segment.id}`);
      }
      this.segmentOrder.set(segment, index);
      const a = roadNodeKey(segment.a);
      const b = roadNodeKey(segment.b);
      for (const [id, point] of [[a, segment.a], [b, segment.b]] as const) {
        if (!this.nodes.has(id)) this.nodes.set(id, { ...point });
        if (!this.edges.has(id)) this.edges.set(id, []);
        if (!this.neighbors.has(id)) this.neighbors.set(id, new Set());
      }
      const cost = roadDistance(segment.a, segment.b) * segment.travelWeight;
      const first = this.nodes.get(a)!, second = this.nodes.get(b)!;
      if (segment.allowAB) this.edges.get(a)!.push({ id: index * 2, to: b, cost, segment,
        yaw: Math.atan2(second.y - first.y, second.x - first.x) });
      if (segment.allowBA) this.edges.get(b)!.push({ id: index * 2 + 1, to: a, cost, segment,
        yaw: Math.atan2(first.y - second.y, first.x - second.x) });
      this.neighbors.get(a)!.add(b);
      this.neighbors.get(b)!.add(a);
      minWeight = Math.min(minWeight, segment.travelWeight);
    }
    this.minWeight = minWeight;
    this.tree = buildTree([...segments]);
    for (const node of this.nodes.keys()) this.nodeOrder.set(node, this.nodeOrder.size);
    this.prepareLandmarks(landmarkCount);
  }

  /** Once per immutable graph: relaxed, undirected distances are lower bounds
   * even with one-way roads, arrival directions and maneuver penalties. */
  private prepareLandmarks(count: number) {
    if (count <= 0) return;
    const adjacency: { to: number; cost: number }[][] = Array.from(this.nodes, () => []);
    for (const segment of this.segments) {
      const a = this.nodeOrder.get(roadNodeKey(segment.a))!, b = this.nodeOrder.get(roadNodeKey(segment.b))!;
      const cost = roadDistance(segment.a, segment.b) * segment.travelWeight;
      adjacency[a].push({ to: b, cost }); adjacency[b].push({ to: a, cost });
    }
    const nearestLandmark = new Float64Array(adjacency.length).fill(Infinity);
    let origin = 0;
    for (let index = 0; index < Math.min(8, count, adjacency.length); index++) {
      const distances = new Float64Array(adjacency.length).fill(Infinity);
      distances[origin] = 0;
      const queue = new MinQueue<number>(); queue.push(origin, 0);
      while (queue.length) {
        const { value: node, priority: cost } = queue.pop();
        if (cost !== distances[node]) continue;
        for (const edge of adjacency[node]) {
          const next = cost + edge.cost;
          if (next >= distances[edge.to]) continue;
          distances[edge.to] = next; queue.push(edge.to, next);
        }
      }
      this.landmarks.push(distances);
      let farthest = -1;
      for (let node = 0; node < adjacency.length; node++) {
        nearestLandmark[node] = Math.min(nearestLandmark[node], distances[node]);
        if (nearestLandmark[node] > farthest) { farthest = nearestLandmark[node]; origin = node; }
      }
      if (farthest === 0) break;
    }
  }

  nearest(point: RoadControlPoint, heading?: number): GraphProjection {
    if (![point.x, point.y, point.z ?? 0, heading ?? 0].every(Number.isFinite)) throw new Error("Invalid road projection");
    let best: GraphProjection | null = null;
    let bestScore = Infinity;
    const queue = new MinQueue<Tree>();
    queue.push(this.tree, boundsDistance(point, this.tree.bounds));
    while (queue.length) {
      const current = queue.pop();
      if (current.priority > bestScore) break;
      for (const child of current.value.children ?? []) {
        const lowerBound = boundsDistance(point, child.bounds);
        if (lowerBound <= bestScore) queue.push(child, lowerBound);
      }
      for (const segment of current.value.segments ?? []) {
        const projection = project(point, segment);
        const score = Math.hypot(projection.centerDistance, projection.heightDistance * 4)
          + (heading === undefined ? 0 : Math.abs(Math.sin(projection.tangentYaw - heading)) * 2.2);
        if (score < bestScore || (score === bestScore && best && this.segmentOrder.get(segment)! < this.segmentOrder.get(best.segment)!)) {
          best = projection;
          bestScore = score;
        }
      }
    }
    return best!;
  }

  isJunction(point: RoadControlPoint, tolerance = 1.2) {
    const direct = this.neighbors.get(roadNodeKey(point));
    if (direct) return direct.size >= 3;
    const nearest = this.nearest(point);
    return [nearest.segment.a, nearest.segment.b].some((candidate) => (
      roadDistance(point, candidate) <= tolerance && (this.neighbors.get(roadNodeKey(candidate))?.size ?? 0) >= 3
    ));
  }

  route(start: RoadControlPoint, target: RoadControlPoint, heading?: number, direction: 1 | -1 = 1, maneuverCost = 0,
    options: RouteSearchOptions = {}): GraphRoute | null {
    if (!Number.isFinite(maneuverCost) || maneuverCost < 0) throw new Error("Invalid maneuver cost");
    const weight = options.heuristicWeight ?? 1;
    if (!Number.isFinite(weight) || weight < 1) throw new Error("Invalid heuristic weight");
    const stats = options.stats;
    if (stats) { stats.expanded = 0; stats.queued = 0; }
    const from = this.nearest(start, heading);
    const to = this.nearest(target);
    const allowedYaw = (yaw: number) => heading === undefined || (
      direction > 0 ? Math.cos(yaw - heading) >= -0.02 : Math.cos(yaw - heading) <= 0.02
    );
    const departures = [
      { point: from.segment.a, allowed: from.segment.allowBA, yaw: from.tangentYaw + Math.PI },
      { point: from.segment.b, allowed: from.segment.allowAB, yaw: from.tangentYaw },
    ].filter((candidate) => candidate.allowed && allowedYaw(candidate.yaw));
    const arrivals = [
      { point: to.segment.a, allowed: to.segment.allowAB },
      { point: to.segment.b, allowed: to.segment.allowBA },
    ].filter((candidate) => candidate.allowed);
    const leadCost = roadDistance(start, from.point);
    const tailCost = roadDistance(to.point, target);
    let best: GraphRoute | null = null;
    if (from.segment === to.segment) {
      const increasing = to.t >= from.t;
      const yaw = from.tangentYaw + (increasing ? 0 : Math.PI);
      if ((increasing ? from.segment.allowAB : from.segment.allowBA) && allowedYaw(yaw)) {
        best = {
          route: unique([start, from.point, to.point, target]), departureYaw: yaw,
          cost: leadCost + roadDistance(from.point, to.point) * from.segment.travelWeight + tailCost,
          usesSpecialRoad: from.segment.kind !== "street",
        };
      }
    }
    if (!departures.length || !arrivals.length) return best;
    const targetCosts = new Map(arrivals.map(({ point }) => [roadNodeKey(point), roadDistance(point, to.point) * to.segment.travelWeight + tailCost]));
    // Arrival direction is part of a search state. A node-only search can
    // manufacture a U-turn at the next tessellation sample on a long curve.
    type SearchState = { id: number; node: string; yaw: number; cost: number };
    const states = new Map<number, SearchState>();
    const distances = new Map<number, number>();
    const previous = new Map<number, { state: number; edge: Edge }>();
    const origins = new Map<number, number>();
    const queue = new MinQueue<SearchState>();
    const targetA = this.nodeOrder.get(roadNodeKey(to.segment.a))!, targetB = this.nodeOrder.get(roadNodeKey(to.segment.b))!;
    const partialA = roadDistance(to.segment.a, to.point) * to.segment.travelWeight;
    const partialB = roadDistance(to.segment.b, to.point) * to.segment.travelWeight;
    const landmarkTargets = this.landmarks.map(distances => Math.min(distances[targetA] + partialA, distances[targetB] + partialB));
    const estimates = new Map<string, number>();
    const heuristic = (id: string) => {
      const cached = estimates.get(id);
      if (cached !== undefined) return cached;
      let bound = roadDistance(this.nodes.get(id)!, to.point) * this.minWeight;
      const node = this.nodeOrder.get(id)!;
      for (let index = 0; index < this.landmarks.length; index++) {
        const delta = Math.abs(this.landmarks[index][node] - landmarkTargets[index]);
        if (Number.isFinite(delta)) bound = Math.max(bound, delta);
      }
      const estimate = (bound + tailCost) * weight;
      estimates.set(id, estimate);
      return estimate;
    };
    for (const [index, departure] of departures.entries()) {
      const node = roadNodeKey(departure.point);
      const id = -index - 1;
      const cost = leadCost + roadDistance(from.point, departure.point) * from.segment.travelWeight;
      if (cost >= (distances.get(id) ?? Infinity)) continue;
      distances.set(id, cost);
      origins.set(id, departure.yaw);
      const yaw = roadDistance(from.point, departure.point) < 0.01
        ? heading === undefined ? NaN : heading + (direction < 0 ? Math.PI : 0)
        : departure.yaw;
      const state = { id, node, yaw, cost };
      states.set(id, state);
      queue.push(state, cost + heuristic(node));
      if (stats) stats.queued++;
    }
    let bestEnd: number | null = null;
    let bestCost = best?.cost ?? Infinity;
    while (queue.length) {
      const current = queue.pop();
      if (current.priority > bestCost + 1e-8) break;
      const { id, node, yaw, cost } = current.value;
      if (cost !== distances.get(id)) continue;
      if (stats) stats.expanded++;
      const arrivalCost = targetCosts.get(node);
      if (arrivalCost !== undefined && cost + arrivalCost < bestCost) {
        const nodePoint = this.nodes.get(node)!;
        const arrivalYaw = Math.atan2(to.point.y - nodePoint.y, to.point.x - nodePoint.x);
        if (roadDistance(nodePoint, to.point) < 0.01 || Math.cos(arrivalYaw - yaw) > -0.98) {
          bestCost = cost + arrivalCost;
          bestEnd = id;
        }
      }
      for (const edge of this.edges.get(node) ?? []) {
        const nextYaw = edge.yaw;
        const reverses = Math.cos(nextYaw - yaw) < -0.98;
        if (reverses && (this.neighbors.get(node)?.size ?? 0) > 1) continue;
        const incoming = previous.get(id)?.edge.segment ?? from.segment;
        const turns = Math.cos(nextYaw - yaw) < 0.94;
        const changesCorridor = incoming.pathId !== edge.segment.pathId
          && (incoming.kind !== "street" || edge.segment.kind !== "street");
        const nextCost = cost + edge.cost + (reverses ? 18 : 0)
          + (turns ? maneuverCost * (changesCorridor ? 2 : 1) : 0);
        const nextId = edge.id;
        if (nextCost + 1e-8 >= (distances.get(nextId) ?? Infinity)) continue;
        const state = { id: nextId, node: edge.to, yaw: nextYaw, cost: nextCost };
        states.set(nextId, state);
        distances.set(nextId, nextCost);
        previous.set(nextId, { state: id, edge });
        origins.set(nextId, Number.isFinite(yaw) ? origins.get(id)! : nextYaw);
        queue.push(state, nextCost + heuristic(edge.to));
        if (stats) stats.queued++;
      }
    }
    if (bestEnd !== null) {
      const points = [this.nodes.get(states.get(bestEnd)!.node)!];
      let cursor = bestEnd;
      let usesSpecialRoad = from.segment.kind !== "street" || to.segment.kind !== "street";
      while (previous.has(cursor)) {
        const step = previous.get(cursor)!;
        usesSpecialRoad ||= step.edge.segment.kind !== "street";
        cursor = step.state;
        points.push(this.nodes.get(states.get(cursor)!.node)!);
      }
      best = {
        route: unique([start, from.point, ...points.reverse(), to.point, target]),
        departureYaw: origins.get(bestEnd)!, cost: bestCost, usesSpecialRoad,
      };
    }
    return best;
  }
}
