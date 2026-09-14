import { BOOST_OVERDRIVE_BONUS_KMH, BOOST_OVERDRIVE_TOP_SPEED_KMH, SPEED_KMH_PER_WORLD_UNIT, TAXI_TOP_SPEED_KMH } from "./config";
import { drivingTraitPackage } from "./driving-traits";
import type { Game, WorldInteraction, WorldView } from "./model";
import { terrainHeightAt } from "./terrain/surface";
import { VEHICLE_GOVERNED_SPEED_KMH } from "./vehicles";

export const REPAIR_COST_PER_KMH = 10;
export const MIN_DAMAGED_SPEED_KMH = 10;
const REPAIR_STOP_SECONDS = .6;
export const DAMAGE_LINES = [
  "There goes the quarter panel!", "There goes the radiator!", "That bumper had one job.",
  "The alignment has left the chat.", "One less headlight. Very mysterious.", "The exhaust just became a percussion instrument.",
  "That's a custom hood vent now.", "The suspension would like a word.", "There goes the other mirror!",
  "The trunk has acquired a new personality.", "That fender is now limited edition.", "The grille just lost a few teeth.",
  "I think the hubcap took the next exit.", "That door closes with an accent now.", "The oil cooler has seen better shifts.",
  "There goes the front splitter!", "The mechanic is going to love this.", "That was definitely not a parking sensor.",
  "The dashboard has another rattle.", "We have achieved aerodynamic character.", "The radiator fan is applauding.",
  "The tail light has clocked out.", "Another dent for the autobiography.", "That panel used to be symmetrical.",
] as const;

type GasEntrance = Extract<WorldInteraction, { kind: "venue-entrance" }>;
export type VehicleDamageState = {
  lossKmh: number; impacts: number; contacts: Record<string, number>;
  lastLine: string; lastAt: number; lastLoss: number;
  station: GasEntrance | null; stoppedFor: number; declinedStation: string | null;
};
export function makeVehicleDamage(): VehicleDamageState {
  return { lossKmh: 0, impacts: 0, contacts: {}, lastLine: "", lastAt: -10, lastLoss: 0,
    station: null, stoppedFor: 0, declinedStation: null };
}
function state(game: Game) { return game.damage ??= makeVehicleDamage(); }

/** The floor is a speed ceiling, never a minimum moving speed or forced throttle. */
export function damageSpeedLimit(game: Partial<Pick<Game, "damage">>, healthyKmh: number) {
  const loss = game.damage?.lossKmh ?? 0;
  return loss > 0 ? Math.max(MIN_DAMAGED_SPEED_KMH, healthyKmh - loss) : healthyKmh;
}
function maximumLoss(game: Game) {
  const overdrive = game.installedUpgrades.includes("boost-overdrive");
  const top = game.drivingModel === "simulation" || game.vehicleId === "accord-v6" && game.transmissionMode === "manual"
    ? VEHICLE_GOVERNED_SPEED_KMH[game.vehicleId]
    : Math.min(overdrive ? BOOST_OVERDRIVE_TOP_SPEED_KMH : TAXI_TOP_SPEED_KMH,
      drivingTraitPackage(game.drivingTraitId).modifiers.maxBoostSpeed * SPEED_KMH_PER_WORLD_UNIT + (overdrive ? BOOST_OVERDRIVE_BONUS_KMH : 0));
  return Math.ceil(top - MIN_DAMAGED_SPEED_KMH);
}

/** One point per new physical contact. Brief contact jitter is still the same scrape. */
export function recordVehicleContacts(game: Game, contacts: readonly string[]) {
  const damage = state(game);
  damage.contacts = Object.fromEntries(Object.entries(damage.contacts).filter(([, time]) => game.elapsed - time < .25).slice(-32));
  const hits: Array<{ line: string; lossKmh: number; totalLossKmh: number }> = [];
  for (const id of new Set(contacts)) {
    if (!(id in damage.contacts)) {
      const previous = damage.lossKmh;
      damage.lossKmh = Math.min(maximumLoss(game), damage.lossKmh + 1);
      damage.lastLine = DAMAGE_LINES[damage.impacts++ % DAMAGE_LINES.length];
      damage.lastAt = game.elapsed; damage.lastLoss = damage.lossKmh - previous;
      hits.push({ line: damage.lastLine, lossKmh: damage.lastLoss, totalLossKmh: damage.lossKmh });
    }
    damage.contacts[id] = game.elapsed;
  }
  return hits;
}

function taxiOnLot(game: Game, station: GasEntrance | null) {
  const lot = station?.serviceLot;
  if (!station || !lot || Math.abs(game.x - lot.x) > lot.halfX || Math.abs(game.y - lot.y) > lot.halfY) return false;
  const height = terrainHeightAt(game.x, game.y) + (station.z ?? 0) - terrainHeightAt(station.x, station.y);
  return Math.abs(game.z - height) < 1.5;
}
function playerAtStation(game: Game, station: GasEntrance | null) {
  if (!station) return false;
  if (game.player.kind === "driving") return true;
  if (game.player.location.kind === "interior") return game.player.location.venue.id === station.venue.id;
  const lot = station.serviceLot!;
  return Math.abs(game.player.actor.x - lot.x) <= lot.halfX && Math.abs(game.player.actor.y - lot.y) <= lot.halfY;
}
function stopped(game: Game) {
  return Math.hypot(game.vx, game.vy) * SPEED_KMH_PER_WORLD_UNIT < 2
    && game.roadMotion.grounded && !game.simulationVehicle.overturned;
}

/** Lot identity survives going inside. Only driving off the lot re-arms a declined offer. */
export function stepRepairLot(game: Game, world: WorldView, dt: number) {
  const damage = state(game);
  const found = world.interactions.find((entry): entry is GasEntrance => entry.kind === "venue-entrance"
    && entry.venue.kind === "gas" && taxiOnLot(game, entry));
  const station = found ?? (taxiOnLot(game, damage.station) ? damage.station : null);
  if (station?.id !== damage.station?.id) {
    damage.declinedStation = null; damage.stoppedFor = 0;
  }
  damage.station = station;
  damage.stoppedFor = station && stopped(game) ? Math.min(1, damage.stoppedFor + dt) : 0;
}

export function vehicleRepairQuote(game: Game) {
  const damage = game.damage ?? makeVehicleDamage();
  const onLot = taxiOnLot(game, damage.station) && playerAtStation(game, damage.station);
  const eligible = onLot && stopped(game) && damage.stoppedFor >= REPAIR_STOP_SECONDS;
  const cost = damage.lossKmh * REPAIR_COST_PER_KMH;
  return { lossKmh: damage.lossKmh, cost, shortfall: Math.max(0, cost - game.fare), eligible,
    serviceOffer: eligible && damage.declinedStation !== damage.station?.id,
    station: damage.station?.label ?? "GO-GO GAS", showOffer: eligible && damage.lossKmh > 0 && damage.declinedStation !== damage.station?.id,
    line: game.elapsed - damage.lastAt < 3 ? damage.lastLine : "", lastLoss: damage.lastLoss };
}
export type VehicleDamageHud = ReturnType<typeof vehicleRepairQuote>;

export function declineVehicleRepair(game: Game) {
  const damage = state(game);
  if (damage.station) damage.declinedStation = damage.station.id;
}

export function repairVehicle(game: Game) {
  const damage = state(game);
  if (damage.lossKmh === 0) return { status: "undamaged" as const, cost: 0 };
  if (!taxiOnLot(game, damage.station) || !playerAtStation(game, damage.station)) return { status: "not-at-station" as const, cost: 0 };
  if (!stopped(game) || damage.stoppedFor < REPAIR_STOP_SECONDS) return { status: "moving" as const, cost: 0 };
  const cost = damage.lossKmh * REPAIR_COST_PER_KMH;
  if (game.fare < cost) return { status: "insufficient" as const, cost };
  game.fare -= cost; damage.lossKmh = 0; damage.lastLine = "";
  return { status: "repaired" as const, cost };
}
