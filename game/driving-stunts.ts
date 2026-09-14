import { DISPLAY_METERS_PER_WORLD_UNIT } from "./config";
import { drivingTraitPackage } from "./driving-traits";
import { clamp } from "./math";
import type { DrivingStunts, DrivingStuntsHud, Game, StuntDistance, StuntRunRecord, Vec2 } from "./model";

function distanceTracker(): StuntDistance {
  return { active: false, meters: 0, totalMeters: 0, bestMeters: 0, lastMeters: 0, count: 0, gapSeconds: 0, resultUntil: 0 };
}

export function makeDrivingStunts(): DrivingStunts {
  return { drift: { ...distanceTracker(), score: 0, lastScore: 0 }, air: distanceTracker() };
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
  if (drifting && !stunts.drift.active) {
    stunts.drift.score = 0;
    game.driftScoreCarry = 0;
  }
  if (drifting && meters > 0) {
    // Reward actual slip in either direction, up to a sideways (90 degree) slide.
    // Distance comes after collision resolution, so pushing a wall earns nothing.
    const angleReward = clamp(Math.abs(game.driftAngle), 0, Math.PI / 2) / (Math.PI / 7);
    const speedReward = .55 + clamp((game.speed - 8) / 30, 0, 1) * .45;
    game.driftScoreCarry += meters / DISPLAY_METERS_PER_WORLD_UNIT * game.combo
      * game.driftIntensity * (.35 + angleReward * .65) * speedReward * 1.6
      * drivingTraitPackage(game.drivingTraitId).modifiers.driftScoreMultiplier;
    const points = Math.floor(game.driftScoreCarry + 1e-9);
    game.driftScoreCarry -= points;
    stunts.drift.score += points;
    game.score += points;
  }
  // Brief neutral slip while countersteering keeps one drift, without counting the straight section.
  track(stunts.drift, drifting, drifting ? meters : 0, dt, game.elapsed, grounded && driving ? .3 : 0);
  if (!stunts.drift.active) stunts.drift.lastScore = stunts.drift.score;
  // Include the final horizontal landing segment as well as the takeoff segment.
  track(stunts.air, airborne, airborne || (driving && !wasGrounded && stunts.air.active) ? meters : 0, dt, game.elapsed, 0);
}

export function drivingStuntsHud(stunts: DrivingStunts, elapsed: number): DrivingStuntsHud {
  const hud = (state: StuntDistance, minimumMeters: number) => ({ active: state.active, meters: state.meters, lastMeters: state.lastMeters,
    totalMeters: state.totalMeters, bestMeters: state.bestMeters, count: state.count,
    showActive: state.active && state.meters > minimumMeters,
    showResult: !state.active && state.lastMeters > minimumMeters && elapsed < state.resultUntil });
  return { drift: { ...hud(stunts.drift, 10), score: stunts.drift.score, lastScore: stunts.drift.lastScore },
    air: { ...hud(stunts.air, 0), showActive: stunts.air.active,
      showResult: !stunts.air.active && stunts.air.lastMeters >= .5 && elapsed < stunts.air.resultUntil } };
}

export function stuntRunRecord(stunts: DrivingStunts): StuntRunRecord {
  return { driftTotalMeters: stunts.drift.totalMeters, driftBestMeters: stunts.drift.bestMeters,
    airTotalMeters: stunts.air.totalMeters, airBestMeters: stunts.air.bestMeters };
}
