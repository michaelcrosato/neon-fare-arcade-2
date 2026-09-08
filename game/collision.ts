import type { Collider, WorldView } from "./model";

export type Obb = { x: number; y: number; halfLength: number; halfWidth: number; heading: number };
export type ObbContact = { normalX: number; normalY: number; depth: number };
export type BuildingContact = ObbContact & { collider: Collider };
export type CircleContact = { normalX: number; normalY: number; depth: number; collider: Collider };

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

export function taxiBuildingContact(world: WorldView, x: number, y: number, heading: number): BuildingContact | null {
  const taxi: Obb = { x, y, heading, halfLength: 2.25, halfWidth: 1.03 };
  let deepest: BuildingContact | null = null;
  for (const collider of world.colliders) {
    if (Math.abs(collider.x - x) > collider.halfX + 3 || Math.abs(collider.y - y) > collider.halfY + 3) continue;
    const contact = obbContact(taxi, { x: collider.x, y: collider.y, heading: 0, halfLength: collider.halfX, halfWidth: collider.halfY });
    if (contact && (!deepest || contact.depth > deepest.depth)) deepest = { ...contact, collider };
  }
  return deepest;
}

export function taxiHitsBuilding(world: WorldView, x: number, y: number, heading: number) {
  return taxiBuildingContact(world, x, y, heading)?.collider;
}

export function taxiNearBuilding(world: WorldView, x: number, y: number, heading: number, margin = 0.65) {
  const taxi: Obb = {
    x,
    y,
    heading,
    halfLength: 2.25 + margin,
    halfWidth: 1.03 + margin,
  };
  return world.colliders.some((collider) => {
    if (Math.abs(collider.x - x) > collider.halfX + 3 + margin || Math.abs(collider.y - y) > collider.halfY + 3 + margin) return false;
    return obbOverlap(taxi, {
      x: collider.x,
      y: collider.y,
      heading: 0,
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
): CircleContact | null {
  let deepest: CircleContact | null = null;
  for (const collider of world.colliders) {
    if (Math.abs(collider.x - x) > collider.halfX + radius + 0.1
      || Math.abs(collider.y - y) > collider.halfY + radius + 0.1) continue;
    const nearestX = Math.max(collider.x - collider.halfX, Math.min(x, collider.x + collider.halfX));
    const nearestY = Math.max(collider.y - collider.halfY, Math.min(y, collider.y + collider.halfY));
    const deltaX = x - nearestX;
    const deltaY = y - nearestY;
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
      const left = x - (collider.x - collider.halfX);
      const right = collider.x + collider.halfX - x;
      const top = y - (collider.y - collider.halfY);
      const bottom = collider.y + collider.halfY - y;
      const shallowest = Math.min(left, right, top, bottom);
      if (shallowest === left) contact = { normalX: -1, normalY: 0, depth: radius + left, collider };
      else if (shallowest === right) contact = { normalX: 1, normalY: 0, depth: radius + right, collider };
      else if (shallowest === top) contact = { normalX: 0, normalY: -1, depth: radius + top, collider };
      else contact = { normalX: 0, normalY: 1, depth: radius + bottom, collider };
    }
    if (contact && (!deepest || contact.depth > deepest.depth)) deepest = contact;
  }
  return deepest;
}

export function circleHitsBuilding(world: WorldView, x: number, y: number, radius: number) {
  return circleBuildingContact(world, x, y, radius)?.collider;
}

export function depenetrateTaxi(world: WorldView, x: number, y: number, heading: number, iterations = 8) {
  let resolvedX = x;
  let resolvedY = y;
  let moved = false;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const contact = taxiBuildingContact(world, resolvedX, resolvedY, heading);
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
    resolved: !taxiBuildingContact(world, resolvedX, resolvedY, heading),
  };
}
