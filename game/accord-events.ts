import type { Game, Job, WorldPoint } from "./model";
import { buildGpsRoute, routeLength } from "./route-geometry";
import { QUANTUM_FACTS } from "./quantum-facts";
import { PASSENGER_QUANTUM_RESPONSES } from "./passenger-quantum-responses";
export { QUANTUM_FACTS } from "./quantum-facts";

export const WINTER_TIRE_FINANCING = 1_000;

export type AccordTrip = { route: WorldPoint[]; length: number; shared: boolean; sequence: number };
export type StoryCard = { kind: "quantum"; factIndex: number; rider: string; artCell: number; response: string }
  | { kind: "tires-paid"; balance: number };

export function beginAccordTrip(game: Game, job: Job) {
  if (game.vehicleId !== "accord-v6") return;
  const route = buildGpsRoute(job.pickupApproach, job.dropoffApproach);
  game.accordTrip = { route, length: routeLength(route), shared: false, sequence: (game.accordTrip?.sequence ?? -1) + 1 };
}

/** Project onto the passenger's actual road route, including elevation at crossings. */
function tripProgress(game: Game, trip: AccordTrip) {
  let along = 0, nearest = Infinity, progress = 0;
  for (let i = 1; i < trip.route.length; i++) {
    const a = trip.route[i - 1], b = trip.route[i];
    const dx = b.x - a.x, dy = b.y - a.y, dz = (b.z ?? 0) - (a.z ?? 0);
    const length = Math.hypot(dx, dy, dz);
    if (length === 0) continue;
    const t = Math.max(0, Math.min(1, ((game.x - a.x) * dx + (game.y - a.y) * dy + (game.z - (a.z ?? 0)) * dz) / length ** 2));
    const gap = Math.hypot(game.x - a.x - dx * t, game.y - a.y - dy * t, (game.z - (a.z ?? 0) - dz * t) * 4);
    if (gap < nearest) { nearest = gap; progress = along + t * length; }
    along += length;
  }
  return nearest <= 24 && trip.length > 0 ? progress / trip.length : 0;
}

/** Returns semantic, one-shot cards; the browser owns pausing and dismissal. */
export function stepAccordEvents(game: Game): StoryCard | null {
  if (game.vehicleId !== "accord-v6") return null;
  if (!game.winterTiresPaid && game.fare > 0) {
    game.winterTiresPaid = true;
    return { kind: "tires-paid", balance: game.fare };
  }
  const trip = game.accordTrip;
  if (!game.onboard || game.activeCourier || game.player.kind !== "driving" || !trip || trip.shared
    || game.elapsed - game.jobStartedAt < .5 || tripProgress(game, trip) < .5) return null;
  trip.shared = true;
  const job = game.fareJobs[game.jobIndex % game.fareJobs.length];
  const counts = game.accordReplyCounts ??= {};
  const visit = counts[job.id] ?? 0;
  const responses = PASSENGER_QUANTUM_RESPONSES[job.id];
  counts[job.id] = (visit + 1) % 3;
  return { kind: "quantum", factIndex: ((game.runSeed >>> 0) + trip.sequence) % QUANTUM_FACTS.length,
    rider: job.rider, artCell: job.passengerArtCell,
    // Unknown custom/test riders keep a neutral voice; roster coverage is tested exhaustively.
    response: responses?.[((game.runSeed >>> 0) + job.passengerArtCell + visit) % 3]
      ?? "I asked how your day was, but this works too." };
}
