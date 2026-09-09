/** Renderer-independent road geometry. World axes: east, south, up. */
export type RoadVector = { x: number; y: number; z: number };
export type RoadControlPoint = {
  x: number;
  y: number;
  z?: number;
  /** Half of the paved width, interpolated through this control point. */
  halfWidth?: number;
  /** Radians: positive banking raises the right edge along increasing distance. */
  bank?: number;
};
export type RoadCurve = {
  kind: "polyline" | "catmull-rom" | "bezier";
  points: readonly RoadControlPoint[];
  closed?: boolean;
};
export type RoadSamplingOptions = {
  maxSegmentLength?: number;
  maxChordError?: number;
  maxDepth?: number;
  maxSamples?: number;
};
export type RoadSection = {
  center: RoadVector;
  forward: RoadVector;
  right: RoadVector;
  normal: RoadVector;
  /** A bounded miter makes adjacent pavement and lane strips meet exactly. */
  lateral: RoadVector;
  halfWidth: number;
  bank: number;
  distance: number;
};
export type CompiledRoad = {
  id: string;
  closed: boolean;
  sections: readonly RoadSection[];
  length: number;
};
export type RoadSample = {
  point: RoadVector;
  center: RoadVector;
  forward: RoadVector;
  right: RoadVector;
  normal: RoadVector;
  heading: number;
  grade: number;
  bank: number;
  halfWidth: number;
  distance: number;
  segmentIndex: number;
};
export type RoadSurfaceProjection = RoadSample & {
  roadId: string;
  lateralOffset: number;
  centerDistance: number;
  surfaceDistance: number;
  heightDistance: number;
};

const EPSILON = 1e-8;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const vector = (point: RoadControlPoint): RoadVector => ({ x: point.x, y: point.y, z: point.z ?? 0 });
const subtract = (a: RoadVector, b: RoadVector): RoadVector => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: RoadVector, b: RoadVector): RoadVector => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: RoadVector, s: number): RoadVector => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const dot = (a: RoadVector, b: RoadVector) => a.x * b.x + a.y * b.y + a.z * b.z;
const magnitude = (v: RoadVector) => Math.hypot(v.x, v.y, v.z);
const unit = (v: RoadVector) => scale(v, 1 / Math.max(EPSILON, magnitude(v)));
const blend = (a: RoadVector, b: RoadVector, t: number) => add(scale(a, 1 - t), scale(b, t));
const cross = (a: RoadVector, b: RoadVector): RoadVector => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export function roadDistance(a: RoadControlPoint, b: RoadControlPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function validatePoint(point: RoadControlPoint) {
  if (![point.x, point.y, point.z ?? 0, point.bank ?? 0, point.halfWidth ?? 1].every(Number.isFinite)) {
    throw new Error("Road control points must be finite");
  }
  if ((point.halfWidth ?? 1) <= 0) throw new Error("Road width must be positive");
  if (Math.abs(point.bank ?? 0) >= Math.PI / 3) throw new Error("Road banking must be below 60 degrees");
}

function profile(a: RoadControlPoint, b: RoadControlPoint, t: number) {
  const output: Pick<RoadControlPoint, "halfWidth" | "bank"> = {};
  if (a.halfWidth !== undefined || b.halfWidth !== undefined) {
    output.halfWidth = lerp(a.halfWidth ?? b.halfWidth!, b.halfWidth ?? a.halfWidth!, t);
  }
  if (a.bank !== undefined || b.bank !== undefined) output.bank = lerp(a.bank ?? 0, b.bank ?? 0, t);
  return output;
}

/**
 * Adaptive 3D tessellation, retaining every authored control/end point. Testing
 * quarter points as well as the midpoint catches symmetric S curves and crests.
 * Centripetal Catmull-Rom avoids the loops produced by uneven uniform controls.
 */
export function sampleRoadCurve(curve: RoadCurve, options: RoadSamplingOptions = {}): RoadControlPoint[] {
  const maxLength = options.maxSegmentLength ?? 12;
  const maxError = options.maxChordError ?? 0.12;
  const maxDepth = options.maxDepth ?? 16;
  const maxSamples = options.maxSamples ?? 8_192;
  if (!(maxLength > 0) || !(maxError > 0) || !Number.isFinite(maxLength + maxError)
    || !Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 20
    || !Number.isInteger(maxSamples) || maxSamples < 2 || maxSamples > 65_536) {
    throw new Error("Invalid road tessellation limits");
  }
  curve.points.forEach(validatePoint);
  const points = curve.kind === "bezier" ? [...curve.points] : curve.points.filter((point, index) => index === 0 || roadDistance(point, curve.points[index - 1]) > EPSILON);
  if (curve.closed && points.length > 1 && roadDistance(points[0], points[points.length - 1]) < EPSILON) points.pop();
  if (points.length < (curve.closed ? 3 : 2)) throw new Error("Road needs distinct control points");
  if (curve.kind === "bezier" && (curve.closed || points.length < 4 || (points.length - 1) % 3 !== 0)) {
    throw new Error("Bezier roads need 3n + 1 controls and explicit closure");
  }
  const output: RoadControlPoint[] = [];
  const count = curve.kind === "bezier" ? (points.length - 1) / 3 : points.length - (curve.closed ? 0 : 1);
  for (let segment = 0; segment < count; segment += 1) {
    const index = curve.kind === "bezier" ? segment * 3 : segment;
    const a = points[index];
    const b = points[curve.kind === "bezier" ? index + 3 : (index + 1) % points.length];
    const av = vector(a);
    const bv = vector(b);
    const before = index > 0 ? vector(points[index - 1]) : curve.closed
      ? vector(points[points.length - 1]) : subtract(scale(av, 2), bv);
    const after = index + 2 < points.length ? vector(points[index + 2]) : curve.closed
      ? vector(points[(index + 2) % points.length]) : subtract(scale(bv, 2), av);
    // Knot spacing uses the square root of Euclidean distance (alpha = 1/2).
    const t0 = 0;
    const t1 = Math.sqrt(magnitude(subtract(av, before)));
    const t2 = t1 + Math.sqrt(magnitude(subtract(bv, av)));
    const t3 = t2 + Math.sqrt(magnitude(subtract(after, bv)));
    const at = (left: RoadVector, right: RoadVector, lo: number, hi: number, time: number) => (
      blend(left, right, (time - lo) / Math.max(EPSILON, hi - lo))
    );
    const evaluate = (t: number): RoadControlPoint => {
      if (t === 0) return { ...a };
      if (t === 1) return { ...b };
      let position: RoadVector;
      if (curve.kind === "polyline") position = blend(av, bv, t);
      else if (curve.kind === "bezier") {
        const inverse = 1 - t;
        position = add(add(scale(av, inverse ** 3), scale(vector(points[index + 1]), 3 * inverse ** 2 * t)),
          add(scale(vector(points[index + 2]), 3 * inverse * t * t), scale(bv, t ** 3)));
      } else {
        const time = lerp(t1, t2, t);
        const a1 = at(before, av, t0, t1, time);
        const a2 = at(av, bv, t1, t2, time);
        const a3 = at(bv, after, t2, t3, time);
        position = at(at(a1, a2, t0, t2, time), at(a2, a3, t1, t3, time), t1, t2, time);
      }
      return { ...position, ...profile(a, b, t) };
    };
    const subdivide = (lo: number, hi: number, left: RoadControlPoint, right: RoadControlPoint, depth: number) => {
      const middle = evaluate((lo + hi) / 2);
      const error = Math.max(...[0.25, 0.5, 0.75].map((fraction) => (
        roadDistance(evaluate(lerp(lo, hi, fraction)), blend(vector(left), vector(right), fraction))
      )));
      if (roadDistance(left, right) > maxLength || error > maxError) {
        if (depth >= maxDepth) throw new Error("Road tessellation exceeded its subdivision budget");
        subdivide(lo, (lo + hi) / 2, left, middle, depth + 1);
        subdivide((lo + hi) / 2, hi, middle, right, depth + 1);
      } else {
        if (output.length >= maxSamples - 1) throw new Error("Road tessellation exceeded its sample budget");
        output.push(left);
      }
    };
    subdivide(0, 1, evaluate(0), evaluate(1), 0);
  }
  if (!curve.closed) output.push({ ...points[points.length - 1] });
  return output;
}

function frame(forward: RoadVector, bank: number) {
  const flatRight = unit({ x: -forward.y, y: forward.x, z: 0 });
  const up = cross(forward, flatRight);
  const right = add(scale(flatRight, Math.cos(bank)), scale(up, Math.sin(bank)));
  return { right, normal: unit(cross(forward, right)) };
}

/** Compile once; traffic, road meshes and surface contact share these sections. */
export function compileRoad(
  id: string,
  authoredPoints: readonly RoadControlPoint[],
  halfWidth: number,
  closed = false,
  frameSmoothingDistance = 0,
): CompiledRoad {
  if (!id || !(halfWidth > 0) || !Number.isFinite(halfWidth)) throw new Error("Invalid road identity or width");
  authoredPoints.forEach(validatePoint);
  const points = authoredPoints.filter((point, index) => index === 0 || roadDistance(point, authoredPoints[index - 1]) > EPSILON);
  if (closed && points.length > 1 && roadDistance(points[0], points[points.length - 1]) < EPSILON) points.pop();
  if (points.length < (closed ? 3 : 2)) throw new Error(`Road ${id} has no usable span`);
  if (!Number.isFinite(frameSmoothingDistance) || frameSmoothingDistance < 0) throw new Error("Invalid road frame smoothing distance");
  const pointAway = (index: number, direction: number): RoadVector => {
    let remaining = frameSmoothingDistance, current = index;
    for (let step = 0; step < points.length; step += 1) {
      const next = current + direction;
      if (!closed && (next < 0 || next >= points.length)) return vector(points[current]);
      const wrapped = (next + points.length) % points.length;
      const length = roadDistance(points[current], points[wrapped]);
      if (length >= remaining) return blend(vector(points[current]), vector(points[wrapped]), remaining / length);
      remaining -= length;
      current = wrapped;
    }
    return vector(points[current]);
  };
  const sections: RoadSection[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const center = vector(points[index]);
    const previous = vector(points[index > 0 ? index - 1 : closed ? points.length - 1 : 0]);
    const next = vector(points[index + 1 < points.length ? index + 1 : closed ? 0 : index]);
    const incoming = unit(subtract(center, previous));
    const outgoing = unit(subtract(next, center));
    // Height-field and crossing cuts may create very short spans. A physical
    // tangent window avoids pinched inner lanes at those unevenly spaced knots.
    const forward = frameSmoothingDistance > 0
      ? unit(subtract(pointAway(index, 1), pointAway(index, -1))) : unit(add(incoming, outgoing));
    if (Math.hypot(forward.x, forward.y) < EPSILON) throw new Error(`Road ${id} has a vertical or reversing cusp`);
    const bank = points[index].bank ?? 0;
    const { right, normal } = frame(forward, bank);
    const segmentDirection = magnitude(outgoing) > 0.5 ? outgoing : incoming;
    const miter = Math.min(2, 1 / Math.max(0.5, dot(forward, segmentDirection)));
    sections.push({
      center, forward, right, normal, lateral: scale(right, miter),
      bank, halfWidth: points[index].halfWidth ?? halfWidth,
      distance: index === 0 ? 0 : sections[index - 1].distance + roadDistance(previous, center),
    });
  }
  if (closed) {
    const last = sections[sections.length - 1];
    sections.push({ ...sections[0], distance: last.distance + roadDistance(last.center, sections[0].center) });
  }
  return { id, closed, sections, length: sections[sections.length - 1].distance };
}

/** Height on the very same two triangles used by the pavement vertex buffer. */
function triangleSurfaceHeight(a: RoadSection, b: RoadSection, point: RoadVector) {
  const edge = (section: RoadSection, side: number) => add(section.center, scale(section.lateral, section.halfWidth * side));
  const corners = [edge(a, -1), edge(b, -1), edge(b, 1), edge(a, 1)];
  for (const indices of [[0, 1, 2], [0, 2, 3]]) {
    const [p, q, r] = indices.map((index) => corners[index]);
    const x = point.x - p.x, y = point.y - p.y;
    const ax = q.x - p.x, ay = q.y - p.y, bx = r.x - p.x, by = r.y - p.y;
    const determinant = ax * by - ay * bx;
    if (Math.abs(determinant) < EPSILON) continue;
    const u = (x * by - y * bx) / determinant;
    const v = (ax * y - ay * x) / determinant;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return p.z + u * (q.z - p.z) + v * (r.z - p.z);
  }
  return point.z;
}

/** First downward crossing of the pavement triangles, including uphill flight. */
export function sweepRoadSegment(road: CompiledRoad, index: number, from: RoadVector, to: RoadVector) {
  const edge = (section: RoadSection, side: number) => add(section.center, scale(section.lateral, section.halfWidth * side));
  const a = road.sections[index], b = road.sections[index + 1];
  const corners = [edge(a, -1), edge(b, -1), edge(b, 1), edge(a, 1)];
  let first = Infinity;
  for (const indices of [[0, 1, 2], [0, 2, 3]]) {
    const [p, q, r] = indices.map((vertex) => corners[vertex]);
    const normal = cross(subtract(q, p), subtract(r, p));
    const upward = scale(normal, normal.z < 0 ? -1 : 1);
    const start = dot(subtract(from, p), upward), end = dot(subtract(to, p), upward);
    if (start < -EPSILON || end > EPSILON || start - end <= EPSILON) continue;
    const fraction = clamp(start / (start - end), 0, 1);
    const point = blend(from, to, fraction);
    const ax = q.x - p.x, ay = q.y - p.y, bx = r.x - p.x, by = r.y - p.y;
    const determinant = ax * by - ay * bx;
    if (Math.abs(determinant) < EPSILON) continue;
    const u = ((point.x - p.x) * by - (point.y - p.y) * bx) / determinant;
    const v = (ax * (point.y - p.y) - ay * (point.x - p.x)) / determinant;
    if (u >= -EPSILON && v >= -EPSILON && u + v <= 1 + EPSILON) first = Math.min(first, fraction);
  }
  return first;
}

function sampleSegment(road: CompiledRoad, index: number, t: number, lateralOffset: number): RoadSample {
  const a = road.sections[index];
  const b = road.sections[index + 1];
  const center = blend(a.center, b.center, t);
  const forward = unit(blend(a.forward, b.forward, t));
  const bank = lerp(a.bank, b.bank, t);
  const point = add(center, scale(blend(a.lateral, b.lateral, t), lateralOffset));
  if (t > EPSILON && t < 1 - EPSILON) point.z = triangleSurfaceHeight(a, b, point);
  return {
    center,
    point,
    forward,
    ...frame(forward, bank),
    heading: Math.atan2(forward.y, forward.x),
    grade: forward.z / Math.max(EPSILON, Math.hypot(forward.x, forward.y)),
    bank,
    halfWidth: lerp(a.halfWidth, b.halfWidth, t),
    distance: lerp(a.distance, b.distance, t),
    segmentIndex: index,
  };
}

/** Physical arc distance, including hills; closed roads wrap in either direction. */
export function sampleRoad(road: CompiledRoad, distanceAlong: number, lateralOffset = 0): RoadSample {
  if (!Number.isFinite(distanceAlong) || !Number.isFinite(lateralOffset)) throw new Error("Road sample must be finite");
  const distance = road.closed ? ((distanceAlong % road.length) + road.length) % road.length : clamp(distanceAlong, 0, road.length);
  let low = 0;
  let high = road.sections.length - 2;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (road.sections[middle + 1].distance < distance) low = middle + 1;
    else high = middle;
  }
  const a = road.sections[low];
  const b = road.sections[low + 1];
  return sampleSegment(road, low, (distance - a.distance) / (b.distance - a.distance), lateralOffset);
}

/**
 * Vertical projection onto the same ruled cross sections used by the renderer.
 * Height is used to disambiguate decks, never to move a point onto another deck.
 */
export function projectRoadSegment(road: CompiledRoad, index: number, point: RoadControlPoint): RoadSurfaceProjection {
  const a = road.sections[index];
  const b = road.sections[index + 1];
  const delta = subtract(b.center, a.center);
  const planarLengthSquared = delta.x * delta.x + delta.y * delta.y;
  let t = clamp(((point.x - a.center.x) * delta.x + (point.y - a.center.y) * delta.y) / Math.max(EPSILON, planarLengthSquared), 0, 1);
  let lateralOffset = 0;
  const lateralDelta = subtract(b.lateral, a.lateral);
  // Bounded Newton solve of the bilinear strip's XY coordinates. Using both
  // derivatives avoids the drift caused by separately projecting skewed axes.
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const center = blend(a.center, b.center, t);
    const lateral = blend(a.lateral, b.lateral, t);
    const errorX = point.x - center.x - lateral.x * lateralOffset;
    const errorY = point.y - center.y - lateral.y * lateralOffset;
    const derivative = add(delta, scale(lateralDelta, lateralOffset));
    const determinant = derivative.x * lateral.y - derivative.y * lateral.x;
    if (Math.abs(determinant) < EPSILON) break;
    t = clamp(t + (errorX * lateral.y - errorY * lateral.x) / determinant, 0, 1);
    lateralOffset += (derivative.x * errorY - derivative.y * errorX) / determinant;
  }
  const sample = sampleSegment(road, index, t, lateralOffset);
  const residual = Math.hypot(point.x - sample.point.x, point.y - sample.point.y);
  return {
    ...sample,
    roadId: road.id,
    lateralOffset,
    centerDistance: Math.hypot(point.x - sample.center.x, point.y - sample.center.y),
    surfaceDistance: Math.hypot(Math.max(0, Math.abs(lateralOffset) - sample.halfWidth), residual),
    heightDistance: Math.abs((point.z ?? 0) - sample.point.z),
  };
}

/** Cross-section vertices, shared without cracks by neighboring road spans. */
export function roadRibbon(road: CompiledRoad, leftOffset?: number, rightOffset?: number) {
  return road.sections.map((section) => ({
    left: add(section.center, scale(section.lateral, leftOffset ?? -section.halfWidth)),
    right: add(section.center, scale(section.lateral, rightOffset ?? section.halfWidth)),
    normal: section.normal,
    distance: section.distance,
  }));
}
