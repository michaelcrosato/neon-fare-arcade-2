import { COLLISION_STREAM_RADIUS, FIXED_DT, defaultCameraBoom } from "@/game/config";
import { applyCareerRunBonuses, type CareerState } from "@/game/career";
import { applyDevelopmentSettings } from "@/game/development-settings";
import { performDevelopmentAction, type DevelopmentAction, type DevelopmentActionResult } from "@/game/development-actions";
import type { Camera, FareImpact, Game, Hud, Mode } from "@/game/model";
import { makeHud } from "@/game/hud";
import { makePickupFareImpact } from "@/game/fare-presentation";
import { controlledPose, isInterior } from "@/game/player";
import { stepGame, type SimulationEvent } from "@/game/simulation";
import { activePassengerJob, makeGame } from "@/game/state";
import { CityStream } from "@/game/world";

export function runDevelopmentCommand(game: Game, action: DevelopmentAction, career: CareerState): DevelopmentActionResult & { game: Game; events?: SimulationEvent[] } {
  if (!game.development?.enabled) return { game, ok: false, message: "Enable Dev Mode first." };
  if (action.kind === "restart") {
    if (!Number.isSafeInteger(action.seed) || action.seed < 0 || action.seed > 0xffffffff) {
      return { game, ok: false, message: "Use a whole seed between 0 and 4,294,967,295." };
    }
    const next = makeGame(game.drivingTraitId, action.seed, game.runKind, game.drivingModel);
    applyCareerRunBonuses(next, career);
    applyDevelopmentSettings(next, game.development);
    next.playtest = true;
    next.navigationRevision = (game.navigationRevision ?? 0) + 1;
    next.countdown = 0;
    return { game: next, ok: true, message: `Playtest restarted with seed ${action.seed}. Close Options and resume.` };
  }
  if (action.kind === "step") {
    game.playtest = true;
    const focus = isInterior(game) ? { x: game.x, y: game.y } : controlledPose(game);
    const world = new CityStream().update(focus.x, focus.y, COLLISION_STREAM_RADIUS);
    const events = stepGame(game, { up: false, down: false, left: false, right: false, boost: false }, FIXED_DT, world);
    return { game, events, ok: true, message: `Advanced one fixed frame. Simulation time: ${game.elapsed.toFixed(3)} s.` };
  }
  return { game, ...performDevelopmentAction(game, action) };
}

type DevelopmentServices = {
  gameRef: { current: Game };
  cameraRef: { current: Camera };
  modeRef: { current: Mode };
  careerRef: { current: CareerState };
  runResultBankedRef: { current: boolean };
  diagnostics: { reset: () => void };
  clearInput: () => void;
  resetFareCards: () => void;
  setCourierImpact: (value: null) => void;
  warmPassengerArt: (jobs: Game["fareJobs"]) => void;
  onSimulationEvents: (events: readonly SimulationEvent[]) => void;
  triggerFareImpact: (impact: Omit<FareImpact, "id">) => void;
  checkpointExternalGameChange: (reason: string) => void;
  setHud: (hud: Hud) => void;
  setDevelopmentNotice: (notice: string) => void;
  setAudioAnnouncement: (notice: string) => void;
};

export function presentDevelopmentCommand(action: DevelopmentAction, services: DevelopmentServices) {
  if (!services.gameRef.current.development?.enabled || services.modeRef.current !== "paused") return;
  services.clearInput();
  const result = runDevelopmentCommand(services.gameRef.current, action, services.careerRef.current);
  const game = result.game;
  services.gameRef.current = game;
  if (result.events) services.onSimulationEvents(result.events);
  if (result.ok && action.kind === "restart") {
    services.runResultBankedRef.current = false;
    services.resetFareCards();
    services.setCourierImpact(null);
    services.diagnostics.reset();
    services.warmPassengerArt(game.fareJobs);
  }
  if (result.ok && action.kind === "load-fare") {
    const job = activePassengerJob(game);
    services.triggerFareImpact(makePickupFareImpact({ fareId: job.id, fareNumber: job.passengerArtCell + 1,
      artCell: job.passengerArtCell, rider: job.rider, destination: job.destination,
      destinationCard: job.destinationCard, bonusSeconds: 0, runKind: game.runKind }));
  }
  if (result.ok && (action.kind === "restart" || action.kind === "reset-taxi" || action.kind.startsWith("teleport-"))) {
    services.cameraRef.current = { ...services.cameraRef.current, x: game.x, y: game.y, heading: game.heading,
      heightOffset: game.z, boom: defaultCameraBoom(services.cameraRef.current.mode), onFoot: false };
  }
  services.checkpointExternalGameChange(`development:${action.kind}`);
  services.setHud(makeHud(game));
  services.setDevelopmentNotice(result.message);
  services.setAudioAnnouncement(result.message);
}
