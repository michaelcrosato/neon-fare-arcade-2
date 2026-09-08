import type { Collider, WorldView } from "./model";
import { terrainHeightAt } from "./terrain/surface";

export type Obb = { x: number; y: number; halfLength: number; halfWidth: number; heading: number };
export type ObbContact = { normalX: number; normalY: number; depth: number };
export type BuildingContact = ObbContact & { collider: Collider };
export type CircleContact = { normalX: number; normalY: number; depth: number; collider: Collider };

export function colliderHeightInterval(collider: Collider, x: number, y: number) {
  if (collider.roadDeck) {
    const { a, b, thickness } = collider.roadDeck;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / Math.max(1e-8, dx * dx + dy * dy)));
    const top = a.z + (b.z - a.z) * t;
    return { bottom: top - thickness, top };
  }
  const bottom = collider.baseZ ?? 0;
  return { bottom, top: bottom + collider.height };
}

export function overlapsHeight(collider: Collider, bottom: number, height: number, x = collider.x, y = collider.y) {
  const interval = colliderHeightInterval(collider, x, y);
  // Tires may climb a reachable ramp. The deck's underside still blocks actors below it.
  if (collider.roadDeck && bottom >= interval.top - 0.85) return false;
  return bottom < interval.top - 0.025 && bottom + height > interval.bottom + 0.025;
}

function nearby(collider: Collider, x: number, y: number, margin: number) {
  const c = Math.abs(Math.cos(collider.yaw ?? 0)), s = Math.abs(Math.sin(collider.yaw ?? 0));
  return Math.abs(collider.x - x) <= c * collider.halfX + s * collider.halfY + margin
    && Math.abs(collider.y - y) <= s * collider.halfX + c * collider.halfY + margin;
}

/** First solid ceiling above the actor's feet, including sloped bridge undersides. */
export function ceilingHeightAt(world: WorldView, x: number, y: number, z: number, radius: number) {
  let ceiling = Infinity;
  for (const collider of world.colliders) {
    if (!nearby(collider, x, y, radius)) continue;
    const interval = colliderHeightInterval(collider, x, y);
    if (interval.bottom <= z + 0.1 || interval.bottom >= ceiling) continue;
    const c = Math.cos(collider.yaw ?? 0), s = Math.sin(collider.yaw ?? 0);
    const localX = c * (x - collider.x) + s * (y - collider.y);
    const localY = -s * (x - collider.x) + c * (y - collider.y);
    if (Math.hypot(Math.max(0, Math.abs(localX) - collider.halfX), Math.max(0, Math.abs(localY) - collider.halfY)) <= radius) ceiling = interval.bottom;
  }
  return ceiling;
}

function obbAxes(a: Obb, b: Obb) {
  return [
    { x: Math.cos(a.heading), y: Math.sin(a.heading) },
    { x: -Math.sin(a.heading), y: Math.cos(a.heading) },
    { x: Math.cos(b.heading), y: Math.sin(b.heading) },
    { x: -Math.sin(b.heading), y: Math.cos(b.heading) },
  ];
}

/** Minimum translation that moves A out of B, or null when they are separate. */
export function obbContact(a: Obb, b: Obb): ObbContact | null {
  const axes = obbAxes(a, b);
  const aForward = axes[0];
  const aRight = axes[1];
  const bForward = axes[2];
  const bRight = axes[3];
  let shallowest: ObbContact | null = null;

  for (const axis of axes) {
    const signedDistance = (a.x - b.x) * axis.x + (a.y - b.y) * axis.y;
    const radiusA = a.halfLength * Math.abs(aForward.x * axis.x + aForward.y * axis.y) + a.halfWidth * Math.abs(aRight.x * axis.x + aRight.y * axis.y);
    const radiusB = b.halfLength * Math.abs(bForward.x * axis.x + bForward.y * axis.y) + b.halfWidth * Math.abs(bRight.x * axis.x + bRight.y * axis.y);
    const depth = radiusA + radiusB - Math.abs(signedDistance);
    // Exact touching is a valid clear pose. This small skin avoids numerical
    // oscillation when a taxi is resting or sliding along a facade.
    if (depth <= 1e-6) return null;
    if (!shallowest || depth < shallowest.depth) {
      const direction = signedDistance < 0 ? -1 : 1;
      shallowest = { normalX: axis.x * direction, normalY: axis.y * direction, depth };
    }
  }
  return shallowest;
}

export function obbOverlap(a: Obb, b: Obb) {
  return obbContact(a, b) !== null;
}

export function taxiBuildingContact(world: WorldView, x: number, y: number, heading: number, z = terrainHeightAt(x, y)): BuildingContact | null {
  const taxi: Obb = { x, y, heading, halfLength: 2.25, halfWidth: 1.03 };
  let deepest: BuildingContact | null = null;
  for (const collider of world.colliders) {
    if (!nearby(collider, x, y, 3) || !overlapsHeight(collider, z, 1.9, x, y)) continue;
    const contact = obbContact(taxi, { x: collider.x, y: collider.y, heading: collider.yaw ?? 0, halfLength: collider.halfX, halfWidth: collider.halfY });
    if (contact && (!deepest || contact.depth > deepest.depth)) deepest = { ...contact, collider };
  }
  return deepest;
}

export function taxiHitsBuilding(world: WorldView, x: number, y: number, heading: number, z = terrainHeightAt(x, y)) {
  return taxiBuildingContact(world, x, y, heading, z)?.collider;
}

export function taxiNearBuilding(world: WorldView, x: number, y: number, heading: number, margin = 0.65, z = terrainHeightAt(x, y)) {
  const taxi: Obb = {
    x,
    y,
    heading,
    halfLength: 2.25 + margin,
    halfWidth: 1.03 + margin,
  };
  return world.colliders.some((collider) => {
    if (!nearby(collider, x, y, 3 + margin) || !overlapsHeight(collider, z, 1.9, x, y)) return false;
    return obbOverlap(taxi, {
      x: collider.x,
      y: collider.y,
      heading: collider.yaw ?? 0,
      halfLength: collider.halfX,
      halfWidth: collider.halfY,
    });
  });
}

/** Minimum translation that moves a circular walking actor out of city geometry. */
export function circleBuildingContact(
  world: WorldView,
  x: number,
  y: number,
  radius: number,
  z = terrainHeightAt(x, y),
  height = 2.4,
): CircleContact | null {
  let deepest: CircleContact | null = null;
  for (const collider of world.colliders) {
    if (!nearby(collider, x, y, radius + 0.1) || !overlapsHeight(collider, z, height, x, y)) continue;
    const cosine = Math.cos(collider.yaw ?? 0), sine = Math.sin(collider.yaw ?? 0);
    const localX = cosine * (x - collider.x) + sine * (y - collider.y);
    const localY = -sine * (x - collider.x) + cosine * (y - collider.y);
    const nearestX = Math.max(-collider.halfX, Math.min(localX, collider.halfX));
    const nearestY = Math.max(-collider.halfY, Math.min(localY, collider.halfY));
    const deltaX = localX - nearestX;
    const deltaY = localY - nearestY;
    const distance = Math.hypot(deltaX, deltaY);
    let contact: CircleContact | null = null;
    if (distance > 1e-8 && distance < radius) {
      contact = {
        normalX: deltaX / distance,
        normalY: deltaY / distance,
        depth: radius - distance,
        collider,
      };
    } else if (distance <= 1e-8) {
      const left = localX + collider.halfX;
      const right = collider.halfX - localX;
      const top = localY + collider.halfY;
      const bottom = collider.halfY - localY;
      const shallowest = Math.min(left, right, top, bottom);
      if (shallowest === left) contact = { normalX: -1, normalY: 0, depth: radius + left, collider };
      else if (shallowest === right) contact = { normalX: 1, normalY: 0, depth: radius + right, collider };
      else if (shallowest === top) contact = { normalX: 0, normalY: -1, depth: radius + top, collider };
      else contact = { normalX: 0, normalY: 1, depth: radius + bottom, collider };
    }
    if (contact && (!deepest || contact.depth > deepest.depth)) deepest = {
      ...contact,
      normalX: cosine * contact.normalX - sine * contact.normalY,
      normalY: sine * contact.normalX + cosine * contact.normalY,
    };
  }
  return deepest;
}

export function circleHitsBuilding(world: WorldView, x: number, y: number, radius: number, z = terrainHeightAt(x, y), height = 2.4) {
  return circleBuildingContact(world, x, y, radius, z, height)?.collider;
}

export function depenetrateTaxi(world: WorldView, x: number, y: number, heading: number, iterations = 8, z = terrainHeightAt(x, y)) {
  let resolvedX = x;
  let resolvedY = y;
  let moved = false;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const contact = taxiBuildingContact(world, resolvedX, resolvedY, heading, z);
    if (!contact) return { x: resolvedX, y: resolvedY, moved, resolved: true };
    const separation = contact.depth + 0.025;
    resolvedX += contact.normalX * separation;
    resolvedY += contact.normalY * separation;
    moved = true;
  }
  return {
    x: resolvedX,
    y: resolvedY,
    moved,
    resolved: !taxiBuildingContact(world, resolvedX, resolvedY, heading, z),
  };
}
