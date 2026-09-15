import type { Game, Job, WorldPoint } from "./model";
import { buildGpsRoute, routeLength } from "./route-geometry";

export const WINTER_TIRE_FINANCING = 1_000;
// Sources and the distinction between a quantum state and a classical analogy: docs/accord-events.md.
export const QUANTUM_FACTS = [
  { title: "A LITTLE SUPERPOSITION", level: "FIRST PRINCIPLES", symbol: "ψ", text: "A quantum state can combine several possible measurement outcomes. Their amplitudes can interfere, reinforcing or cancelling one another. Measuring gives one outcome, with probabilities set by the state.", aside: "The Accord, sadly, must still pick one lane." },
  { title: "SPOOKY. STILL NO SHORTCUT.", level: "ENTANGLEMENT", symbol: "↔", text: "Entangled particles share a joint quantum state. Their measurement results can be correlated in ways classical local models cannot explain. Those correlations cannot send a message faster than light.", aside: "Even quantum physics cannot text your destination ahead of you." },
  { title: "THROUGH THE IMPOSSIBLE", level: "QUANTUM TUNNELING", symbol: "≈", text: "A quantum particle can have a nonzero chance of crossing an energy barrier that would stop a classical particle with the same energy. Its wavefunction extends into and sometimes beyond the barrier.", aside: "Please do not try this with the Accord and a brick wall." },
  { title: "LIGHT COMES IN PACKETS", level: "PHOTONS", symbol: "hν", text: "Light exchanges energy in discrete packets called photons. A photon’s energy is its frequency multiplied by Planck’s constant: E = hν. Higher-frequency blue light has more energy per photon than red light.", aside: "The neon outside is doing physics all night." },
  { title: "PRECISION HAS A LIMIT", level: "UNCERTAINTY", symbol: "ℏ", text: "Position and momentum cannot both have arbitrarily small spreads in the same quantum state. Their standard deviations obey Δx Δp ≥ ℏ/2. This is a property of quantum states, even with ideal instruments.", aside: "That is not an excuse for missing the next turn." },
  { title: "NO QUANTUM PHOTOCOPIER", level: "NO-CLONING", symbol: "≠", text: "No physical operation can perfectly copy every arbitrary unknown quantum state. Copying ordinary digital data is fine; a universal copier for unknown quantum states is ruled out by quantum mechanics.", aside: "One Accord with this much personality is probably enough." },
  { title: "AN ATOM’S OWN COLORS", level: "ENERGY LEVELS", symbol: "ΔE", text: "Bound electrons in atoms occupy allowed energy levels. When an atom changes between levels, it can absorb or emit a photon whose energy matches the difference. Those transitions give elements distinctive spectral lines.", aside: "Think of it as an atomic signature in light." },
  { title: "A QUBIT IS NOT A CHEAT CODE", level: "QUANTUM COMPUTING", symbol: "|ψ⟩", text: "A qubit can be in a superposition of 0 and 1, but a measurement returns just one result. Quantum algorithms use interference and sometimes entanglement to make useful answers more likely. They do not simply reveal every possible answer at once.", aside: "We still have to do this fare one destination at a time." },
] as const;

const RESPONSES = [
  "Wait, that is actually fascinating. Tell me more next time!",
  "So the universe is stranger than this taxi. I love that.",
  "I was going to check my phone, but now I have questions.",
  "That makes a surprising amount of sense. I think.",
  "I understood about half of that. A personal best.",
  "Does that explain the noise your clutch makes?",
  "Right. Physics. Could you still take the next left?",
  "Okay… thanks. I’m just going to look out the window now.",
  "I asked how your day was, but this works too.",
  "Neat. Is the meter also in a superposition?",
] as const;

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
  return { kind: "quantum", factIndex: ((game.runSeed >>> 0) + trip.sequence) % QUANTUM_FACTS.length,
    rider: job.rider, artCell: job.passengerArtCell,
    response: RESPONSES[((game.runSeed >>> 0) + trip.sequence * 3 + job.passengerArtCell) % RESPONSES.length] };
}
