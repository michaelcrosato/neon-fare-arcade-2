import type { Game } from "../../game/model";
import { navigationSettingsForGame } from "../../game/development-settings";

/** Opening either map entry point should describe the pin and its routing setting consistently. */
export function mapOpeningNotice(game: Game) {
  if (game.customDestination) {
    if (!navigationSettingsForGame(game).routeCustomDestinations) return "CUSTOM PIN ACTIVE · GPS ROUTING OFF · MOVE OR CLEAR THE PIN";
    return game.fareDispatchEnabled ? "CUSTOM ROUTE ACTIVE · MOVE THE PIN OR RETURN TO THE JOB"
      : "CUSTOM ROUTE ACTIVE · MOVE THE PIN OR CLEAR THE ROUTE";
  }
  return game.fareDispatchEnabled ? "TAP A STREET TO SET GPS" : "OFF DUTY · TAP A STREET FOR AN OPTIONAL ROUTE";
}
