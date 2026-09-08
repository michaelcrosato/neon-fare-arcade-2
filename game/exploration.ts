import { distance } from "./math";
import { markCourierLoadedInTaxi, resolveCourierCounter, type CourierCounterEvent } from "./courier";
import { INTERIOR_ENTRY_POSE, interiorWorld } from "./interiors";
import { nearestInteraction } from "./interactions";
import type { Game, InputState, VenueRef, VenueServiceId, WorldView } from "./model";
import {
  TAXI_EXIT_SPEED,
  canEnterTaxi,
  controlledPose,
  findTaxiExitPose,
  makeWalkingActor,
  stepWalkingActor,
  walkingMotion,
} from "./player";
import { rightSimulationVehicle } from "./simulation-vehicle";

const SERVICE_MESSAGES: Record<VenueServiceId, string> = {
  "retail-counter": "NEW STOCK ON THE WAY!",
  "food-counter": "ORDER WINDOW OPEN!",
  "front-desk": "FRONT DESK READY!",
  "resident-bell": "RESIDENT BUZZED!",
  "civic-desk": "PUBLIC DESK READY!",
  "service-desk": "SERVICE BAY READY!",
  "dispatch-desk": "DISPATCH ONLINE!",
  "harbor-desk": "HARBOR DESK READY!",
  "arcade-counter": "PRIZE COUNTER OPEN!",
  "studio-desk": "STUDIO LINE IS LIVE!",
  "kiosk-counter": "KIOSK OPEN!",
  "home-hub": "HOME HUB ONLINE!",
  "courier-board": "COURIER BOARD ONLINE!",
  "gas-counter": "GO-GO GAS READY!",
};

export type ExplorationEvent = CourierCounterEvent
  | { type: "vehicle-exited" }
  | { type: "vehicle-entered" }
  | { type: "vehicle-righted" }
  | { type: "player-jumped" }
  | { type: "player-landed"; strength: number }
  | { type: "courier-loaded"; cargo: string; destination: string }
  | { type: "venue-entered"; label: string }
  | { type: "venue-exited"; label: string }
  | { type: "service-used"; serviceId: VenueServiceId; venue: VenueRef }
  | { type: "interaction-blocked"; reason: "moving" | "no-room" };

export function sceneWorld(game: Game, cityWorld: WorldView) {
  if (game.player.kind === "walking" && game.player.location.kind === "interior") {
    return interiorWorld(game.player.location.venue);
  }
  return cityWorld;
}

export function stepExploration(
  game: Game,
  input: Readonly<InputState>,
  dt: number,
  cityWorld: WorldView,
): ExplorationEvent[] {
  const events: ExplorationEvent[] = [];
  const actionDown = Boolean(input.interact);
  const actionPressed = actionDown && !game.interactionHeld;
  game.interactionHeld = actionDown;

  if (game.player.kind === "driving") {
    if (!actionPressed) return events;
    if (game.speed > TAXI_EXIT_SPEED) {
      events.push({ type: "interaction-blocked", reason: "moving" });
      return events;
    }
    const exitPose = findTaxiExitPose(game, cityWorld);
    if (!exitPose) {
      events.push({ type: "interaction-blocked", reason: "no-room" });
      return events;
    }
    game.vx = 0;
    game.vy = 0;
    game.speed = 0;
    game.steering = 0;
    game.brakeInputHeld = false;
    game.brakeDriftKick = 0;
    game.brakeDriftCooldown = 0;
    game.boosting = false;
    game.drifting = false;
    game.driftIntensity = 0;
    game.driftAngle = 0;
    if (game.drivingModel === "simulation") {
      const vehicle = game.simulationVehicle;
      vehicle.throttle = 0;
      vehicle.brake = 0;
      vehicle.parkingBrake = 0;
      vehicle.reverseHold = 0;
      vehicle.steeringAngle = 0;
      vehicle.yawRate = 0;
      vehicle.longitudinalSpeed = 0;
      vehicle.lateralSpeed = 0;
      vehicle.longitudinalAcceleration = 0;
      vehicle.lateralAcceleration = 0;
      vehicle.frontSlipAngle = 0;
      vehicle.rearSlipAngle = 0;
      // Keep suspension and rollover state: getting out must not right the cab.
    }
    game.player = { kind: "walking", actor: exitPose, location: { kind: "city" } };
    events.push({ type: "vehicle-exited" });
    return events;
  }

  const currentWorld = game.player.location.kind === "interior"
    ? interiorWorld(game.player.location.venue)
    : cityWorld;
  const walkingStep = stepWalkingActor(game.player.actor, input, dt, currentWorld);
  if (walkingStep.jumped) events.push({ type: "player-jumped" });
  if (walkingStep.landed) {
    events.push({ type: "player-landed", strength: Math.min(1, walkingStep.landingSpeed / 8) });
  }
  if (!actionPressed) return events;
  if (!walkingMotion(game.player.actor).grounded) return events;

  const candidate = nearestInteraction(game, currentWorld);
  if (!candidate) return events;
  if (candidate.kind === "right-taxi") {
    if (!rightSimulationVehicle(game)) return events;
    game.message = "CAB RIGHTED · CHECK THE ROAD";
    game.messageUntil = game.elapsed + 1.8;
    events.push({ type: "vehicle-righted" });
    return events;
  }
  if (candidate.kind === "enter-taxi") {
    if (!canEnterTaxi(game, controlledPose(game))) return events;
    const loadedContract = markCourierLoadedInTaxi(game);
    game.player = { kind: "driving" };
    game.interactionHeld = true;
    events.push({ type: "vehicle-entered" });
    if (loadedContract) {
      events.push({
        type: "courier-loaded",
        cargo: loadedContract.cargo,
        destination: loadedContract.destination.venue.label,
      });
    }
    return events;
  }
  if (candidate.kind !== "world") return events;
  const interaction = candidate.interaction;
  if (interaction.kind === "venue-entrance") {
    const outward = {
      x: interaction.x + Math.cos(interaction.heading) * 1.15,
      y: interaction.y + Math.sin(interaction.heading) * 1.15,
      z: interaction.z ?? 0,
      heading: interaction.heading,
    };
    game.player = {
      kind: "walking",
      actor: makeWalkingActor({ ...INTERIOR_ENTRY_POSE }),
      location: { kind: "interior", venue: interaction.venue, returnPose: outward },
    };
    game.interactionHeld = true;
    events.push({ type: "venue-entered", label: interaction.venue.label });
  } else if (interaction.kind === "interior-exit" && game.player.location.kind === "interior") {
    const { venue, returnPose } = game.player.location;
    game.player = {
      kind: "walking",
      actor: makeWalkingActor({ ...returnPose, vx: 0, vy: 0, speed: 0 }),
      location: { kind: "city" },
    };
    game.interactionHeld = true;
    events.push({ type: "venue-exited", label: venue.label });
  } else if (interaction.kind === "service") {
    const gasBlocked = interaction.serviceId === "gas-counter" && game.onboard;
    game.message = gasBlocked
      ? "TAXI OCCUPIED · FINISH THE FARE"
      : SERVICE_MESSAGES[interaction.serviceId];
    game.messageUntil = game.elapsed + (gasBlocked ? 2.2 : 1.8);
    events.push({ type: "service-used", serviceId: interaction.serviceId, venue: interaction.venue });
  } else if (interaction.kind === "courier-counter") {
    events.push(resolveCourierCounter(game, interaction.venue));
  }
  return events;
}

export function distanceFromTaxi(game: Game) {
  return distance(controlledPose(game), { x: game.x, y: game.y });
}
