import { distance } from "./math";
import { activeCourierContract, courierCounterPrompt } from "./courier";
import type { Game, WorldInteraction, WorldView } from "./model";
import { TAXI_ENTER_RADIUS, TAXI_EXIT_SPEED, controlledPose, walkingMotion } from "./player";
import {
  canRightSimulationVehicle,
  isSimulationVehicleOverturned,
} from "./simulation-vehicle";

export type InteractionCandidate =
  | { kind: "exit-taxi"; id: "taxi-exit"; label: string; detail: string; priority: number }
  | { kind: "right-taxi"; id: "taxi-right"; label: string; detail: string; distance: number; priority: number }
  | { kind: "enter-taxi"; id: "taxi-enter"; label: string; detail: string; distance: number; priority: number }
  | { kind: "world"; id: string; label: string; detail: string; distance: number; priority: number; interaction: WorldInteraction };

export function nearestInteraction(game: Game, world?: WorldView): InteractionCandidate | null {
  if (game.player.kind === "driving") {
    return game.speed < TAXI_EXIT_SPEED
      ? { kind: "exit-taxi", id: "taxi-exit", label: "E · EXIT TAXI", detail: "EXPLORE ON FOOT", priority: 1 }
      : null;
  }
  if (!walkingMotion(game.player.actor).grounded) return null;
  const pose = controlledPose(game);
  const candidates: InteractionCandidate[] = [];
  if (game.player.location.kind === "city") {
    const taxiDistance = distance(pose, { x: game.x, y: game.y });
    if (taxiDistance <= TAXI_ENTER_RADIUS && Math.abs((pose.z ?? 0) - (game.z ?? 0)) < 1) {
      if (isSimulationVehicleOverturned(game)) {
        if (canRightSimulationVehicle(game)) {
          candidates.push({
            kind: "right-taxi",
            id: "taxi-right",
            label: "E · RIGHT TAXI",
            detail: "PUSH FROM THE SAFE SIDE",
            distance: taxiDistance,
            priority: 1,
          });
        }
      } else {
        const activeContract = activeCourierContract(game);
        const loadingParcel = game.activeCourier?.stage === "dropoff" && !game.activeCourier.loadedInTaxi;
        candidates.push({
          kind: "enter-taxi",
          id: "taxi-enter",
          label: "E · ENTER TAXI",
          detail: loadingParcel
            ? `LOAD PARCEL · DRIVE TO ${activeContract?.destination.venue.label ?? "DESTINATION"}`
            : game.activeCourier ? "CONTINUE COURIER RUN" : "BACK TO THE FARE",
          distance: taxiDistance,
          priority: 1,
        });
      }
    }
  }
  for (const interaction of world?.interactions ?? []) {
    const interactionDistance = distance(pose, interaction);
    if (interactionDistance > interaction.radius || Math.abs((pose.z ?? 0) - (interaction.z ?? 0)) > 1.4) continue;
    const courierPrompt = interaction.kind === "courier-counter"
      ? courierCounterPrompt(game, interaction.venue)
      : null;
    const action = interaction.kind === "venue-entrance"
      ? `ENTER ${interaction.label}`
      : interaction.kind === "interior-exit"
        ? "EXIT TO STREET"
        : courierPrompt?.label ?? interaction.label;
    candidates.push({
      kind: "world",
      id: interaction.id,
      label: `E · ${action}`,
      detail: courierPrompt?.detail ?? (interaction.kind === "service"
        ? interaction.serviceId === "home-hub"
          ? "PROPERTY · GARAGE · CAREER"
          : interaction.serviceId === "gas-counter"
            ? "TIME · BOOST · TUNING"
            : "SEE WHAT'S ON OFFER"
        : interaction.kind === "venue-entrance" && interaction.venue.kind === "gas"
          ? "TIME · BOOST · TUNING"
          : "OPEN DOOR"),
      distance: interactionDistance,
      priority: courierPrompt?.priority ?? (interaction.kind === "interior-exit" ? 3 : 2),
      interaction,
    });
  }
  return candidates.sort((a, b) => {
    const distanceA = "distance" in a ? a.distance : 0;
    const distanceB = "distance" in b ? b.distance : 0;
    return a.priority - b.priority || distanceA - distanceB || a.id.localeCompare(b.id);
  })[0] ?? null;
}

export function interactionPrompt(game: Game, world?: WorldView) {
  const candidate = nearestInteraction(game, world);
  return candidate ? { label: candidate.label, detail: candidate.detail } : { label: "", detail: "" };
}
