import { clamp } from "./math";
import type { Game, VehicleRoadMotion, WorldPoint, WorldView } from "./model";
import { ceilingHeightAt } from "./collision";
import { roadSurfaceIndex } from "./road-network";
import { groundContact } from "./roads/contact";
import { terrainSupport } from "./terrain/surface";

export function makeVehicleRoadMotion(): VehicleRoadMotion {
  return { verticalSpeed: 0, grounded: true, roadId: null, pitch: 0, roll: 0, heave: 0, heaveSpeed: 0, landingImpact: 0 };
}

export function groundAt(point: WorldPoint, stepHeight = 0, preferredRoadId?: string | null) {
  return groundContact(roadSurfaceIndex, point, stepHeight, preferredRoadId, terrainSupport(point));
}

/** Normalize older diagnostic snapshots without changing their horizontal pose. */
export function ensureVehicleRoadMotion(game: Game) {
  if (!Number.isFinite(game.z)) game.z = 0;
  game.roadMotion ??= makeVehicleRoadMotion();
  return game.roadMotion;
}

/** Fixed-step support, crest takeoff, gravity and damped landing suspension. */
export function stepVehicleRoadContact(game: Game, dt: number, previousZ: number, world?: WorldView) {
  const motion = ensureVehicleRoadMotion(game);
  const contact = groundAt({ x: game.x, y: game.y, z: previousZ }, motion.grounded ? 0.85 : 0, motion.grounded ? motion.roadId : null);
  const heightChange = contact.height - previousZ;
  const targetVerticalSpeed = -(contact.normal.x * game.vx + contact.normal.y * game.vy) / Math.max(0.2, contact.normal.z);
  const gravity = game.drivingModel === "simulation" ? 12 : 22;
  const atSurface = Math.abs(heightChange) <= 0.85;
  const crestRelease = motion.grounded && atSurface && game.speed > 22
    && motion.verticalSpeed > 1.5 && motion.verticalSpeed - targetVerticalSpeed > gravity * dt * 1.5;
  if (motion.grounded && atSurface && !crestRelease) {
    game.z = contact.height;
    motion.verticalSpeed = targetVerticalSpeed;
    motion.roadId = contact.roadId;
  } else {
    motion.grounded = false;
    motion.verticalSpeed -= gravity * dt;
    game.z = previousZ + motion.verticalSpeed * dt;
    if (world && motion.verticalSpeed > 0) {
      const ceiling = ceilingHeightAt(world, game.x, game.y, previousZ, 1.1);
      if (game.z + 1.9 > ceiling) {
        game.z = Math.max(contact.height, ceiling - 1.9);
        motion.verticalSpeed = 0;
      }
    }
    if (game.z <= contact.height && motion.verticalSpeed <= targetVerticalSpeed) {
      const impact = Math.max(0, targetVerticalSpeed - motion.verticalSpeed);
      game.z = contact.height;
      motion.verticalSpeed = targetVerticalSpeed;
      motion.grounded = true;
      motion.roadId = contact.roadId;
      motion.landingImpact = clamp(impact / 12, 0, 1);
      motion.heaveSpeed -= Math.min(2.5, impact * 0.18);
    }
  }
  if (motion.grounded) {
    const forwardX = Math.cos(game.heading);
    const forwardY = Math.sin(game.heading);
    // Box tilt is a rotation around local Y, so climbing is negative tilt.
    const pitch = Math.atan2(contact.normal.x * forwardX + contact.normal.y * forwardY, contact.normal.z);
    const roll = Math.atan2(contact.normal.x * forwardY - contact.normal.y * forwardX, contact.normal.z);
    motion.pitch += (pitch - motion.pitch) * (1 - Math.exp(-16 * dt));
    motion.roll += (roll - motion.roll) * (1 - Math.exp(-16 * dt));
  } else {
    motion.pitch += (clamp(-Math.atan2(motion.verticalSpeed, Math.max(10, game.speed)), -0.3, 0.3) - motion.pitch) * (1 - Math.exp(-3 * dt));
  }
  motion.heaveSpeed += (-110 * motion.heave - 15 * motion.heaveSpeed) * dt;
  motion.heave = clamp(motion.heave + motion.heaveSpeed * dt, -0.12, 0.22);
  motion.landingImpact = Math.max(0, motion.landingImpact - dt * 2.5);
}
