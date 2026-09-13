import { DISPLAY_METERS_PER_WORLD_UNIT } from "./config";
import type { DrivingStunts, DrivingStuntsHud, Game, StuntDistance, StuntRunRecord, Vec2 } from "./model";

function distanceTracker(): StuntDistance {
  return { active: false, meters: 0, totalMeters: 0, bestMeters: 0, lastMeters: 0, count: 0, gapSeconds: 0, resultUntil: 0 };
}

export function makeDrivingStunts(): DrivingStunts {
  return { drift: distanceTracker(), air: distanceTracker() };
}

function track(state: StuntDistance, active: boolean, meters: number, dt: number, elapsed: number, grace: number) {
  if (active && !state.active) {
    state.active = true;
    state.meters = 0;
  }
  if (state.active) {
    state.meters += meters;
    state.totalMeters += meters;
    state.bestMeters = Math.max(state.bestMeters, state.meters);
    state.gapSeconds = active ? 0 : state.gapSeconds + dt;
    if (!active && state.gapSeconds >= grace) {
      state.active = false;
      state.lastMeters = state.meters;
      state.count++;
      state.resultUntil = elapsed + 4;
    }
  }
}

/** Measure resolved horizontal travel, never vertical bounce or a saved/teleported position. */
export function stepDrivingStunts(game: Game, previous: Vec2, wasGrounded: boolean, dt: number) {
  if (dt <= 0) return;
  const stunts = game.stunts ??= makeDrivingStunts();
  const driving = game.player.kind === "driving";
  const traveled = Math.hypot(game.x - previous.x, game.y - previous.y);
  const meters = driving && Number.isFinite(traveled) && traveled <= Math.max(2, game.speed * dt * 1.5)
    ? traveled * DISPLAY_METERS_PER_WORLD_UNIT : 0;
  const grounded = game.roadMotion.grounded;
  const drifting = driving && grounded && game.drifting;
  const airborne = driving && !grounded;
  // Brief neutral slip while countersteering keeps one drift, without counting the straight section.
  track(stunts.drift, drifting, drifting ? meters : 0, dt, game.elapsed, grounded && driving ? .3 : 0);
  // Include the final horizontal landing segment as well as the takeoff segment.
  track(stunts.air, airborne, airborne || (driving && !wasGrounded && stunts.air.active) ? meters : 0, dt, game.elapsed, 0);
}

export function drivingStuntsHud(stunts: DrivingStunts, elapsed: number): DrivingStuntsHud {
  const hud = (state: StuntDistance) => ({ active: state.active, meters: state.meters, lastMeters: state.lastMeters,
    totalMeters: state.totalMeters, bestMeters: state.bestMeters, count: state.count,
    showResult: !state.active && state.lastMeters >= .5 && elapsed < state.resultUntil });
  return { drift: hud(stunts.drift), air: hud(stunts.air) };
}

export function stuntRunRecord(stunts: DrivingStunts): StuntRunRecord {
  return { driftTotalMeters: stunts.drift.totalMeters, driftBestMeters: stunts.drift.bestMeters,
    airTotalMeters: stunts.air.totalMeters, airBestMeters: stunts.air.bestMeters };
}
