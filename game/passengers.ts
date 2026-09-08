import { FARES_PER_CYCLE } from "./config";
import { mulberry32 } from "./math";
import type { FareId, Job } from "./model";
import type { WorldRegion, WorldRegionId } from "./regions";

export type FareRiderProfile = Pick<Job, "id" | "rider" | "passengerArtCell"> & {
  /** Null riders are citywide; regional riders can originate only in this cell. */
  exclusiveRegionId: WorldRegionId | null;
};

export type FareRiderHistoryByRegion = Partial<Record<WorldRegionId, FareId[]>>;

export const SHARED_FARE_RIDERS = [
  { id: "rico", rider: "RICO", passengerArtCell: 0, exclusiveRegionId: null },
  { id: "juno", rider: "JUNO", passengerArtCell: 1, exclusiveRegionId: null },
  { id: "max", rider: "MAX", passengerArtCell: 2, exclusiveRegionId: null },
  { id: "nova", rider: "NOVA", passengerArtCell: 3, exclusiveRegionId: null },
  { id: "bea", rider: "BEA", passengerArtCell: 4, exclusiveRegionId: null },
  { id: "dex", rider: "DEX", passengerArtCell: 5, exclusiveRegionId: null },
  { id: "kai", rider: "KAI", passengerArtCell: 6, exclusiveRegionId: null },
  { id: "lux", rider: "LUX", passengerArtCell: 7, exclusiveRegionId: null },
  { id: "mira", rider: "MIRA", passengerArtCell: 8, exclusiveRegionId: null },
  { id: "zed", rider: "ZED", passengerArtCell: 9, exclusiveRegionId: null },
  { id: "ivy", rider: "IVY", passengerArtCell: 10, exclusiveRegionId: null },
  { id: "omar", rider: "OMAR", passengerArtCell: 11, exclusiveRegionId: null },
  { id: "sage", rider: "SAGE", passengerArtCell: 12, exclusiveRegionId: null },
  { id: "teo", rider: "TEO", passengerArtCell: 13, exclusiveRegionId: null },
  { id: "nyx", rider: "NYX", passengerArtCell: 14, exclusiveRegionId: null },
  { id: "rox", rider: "ROX", passengerArtCell: 15, exclusiveRegionId: null },
  { id: "lev", rider: "LEV", passengerArtCell: 16, exclusiveRegionId: null },
  { id: "ada", rider: "ADA", passengerArtCell: 17, exclusiveRegionId: null },
  { id: "finn", rider: "FINN", passengerArtCell: 18, exclusiveRegionId: null },
  { id: "sora", rider: "SORA", passengerArtCell: 19, exclusiveRegionId: null },
  { id: "pax", rider: "PAX", passengerArtCell: 20, exclusiveRegionId: null },
  { id: "rae", rider: "RAE", passengerArtCell: 21, exclusiveRegionId: null },
  { id: "ezra", rider: "EZRA", passengerArtCell: 22, exclusiveRegionId: null },
  { id: "uma", rider: "UMA", passengerArtCell: 23, exclusiveRegionId: null },
  { id: "axl", rider: "AXL", passengerArtCell: 24, exclusiveRegionId: null },
  { id: "lena", rider: "LENA", passengerArtCell: 25, exclusiveRegionId: null },
  { id: "marco", rider: "MARCO", passengerArtCell: 26, exclusiveRegionId: null },
  { id: "tess", rider: "TESS", passengerArtCell: 27, exclusiveRegionId: null },
  { id: "bo", rider: "BO", passengerArtCell: 28, exclusiveRegionId: null },
  { id: "nia", rider: "NIA", passengerArtCell: 29, exclusiveRegionId: null },
  { id: "cal", rider: "CAL", passengerArtCell: 30, exclusiveRegionId: null },
  { id: "zara", rider: "ZARA", passengerArtCell: 31, exclusiveRegionId: null },
  { id: "ren", rider: "REN", passengerArtCell: 32, exclusiveRegionId: null },
  { id: "eli", rider: "ELI", passengerArtCell: 33, exclusiveRegionId: null },
  { id: "maya", rider: "MAYA", passengerArtCell: 34, exclusiveRegionId: null },
  { id: "sol", rider: "SOL", passengerArtCell: 35, exclusiveRegionId: null },
  { id: "vera", rider: "VERA", passengerArtCell: 36, exclusiveRegionId: null },
  { id: "jet", rider: "JET", passengerArtCell: 37, exclusiveRegionId: null },
  { id: "noa", rider: "NOA", passengerArtCell: 38, exclusiveRegionId: null },
  { id: "arlo", rider: "ARLO", passengerArtCell: 39, exclusiveRegionId: null },
  { id: "kiyo", rider: "KIYO", passengerArtCell: 40, exclusiveRegionId: null },
  { id: "luz", rider: "LUZ", passengerArtCell: 41, exclusiveRegionId: null },
  { id: "tariq", rider: "TARIQ", passengerArtCell: 42, exclusiveRegionId: null },
  { id: "wren", rider: "WREN", passengerArtCell: 43, exclusiveRegionId: null },
  { id: "dani", rider: "DANI", passengerArtCell: 44, exclusiveRegionId: null },
  { id: "indy", rider: "INDY", passengerArtCell: 45, exclusiveRegionId: null },
  { id: "yara", rider: "YARA", passengerArtCell: 46, exclusiveRegionId: null },
  { id: "bram", rider: "BRAM", passengerArtCell: 47, exclusiveRegionId: null },
] as const satisfies readonly FareRiderProfile[];

export const CEDAR_VALE_FARE_RIDERS = [
  { id: "ellis", rider: "ELLIS", passengerArtCell: 48, exclusiveRegionId: "cedar-vale" },
  { id: "mae", rider: "MAE", passengerArtCell: 49, exclusiveRegionId: "cedar-vale" },
  { id: "otis", rider: "OTIS", passengerArtCell: 50, exclusiveRegionId: "cedar-vale" },
  { id: "josie", rider: "JOSIE", passengerArtCell: 51, exclusiveRegionId: "cedar-vale" },
  { id: "hank", rider: "HANK", passengerArtCell: 52, exclusiveRegionId: "cedar-vale" },
  { id: "priya", rider: "PRIYA", passengerArtCell: 53, exclusiveRegionId: "cedar-vale" },
  { id: "gus", rider: "GUS", passengerArtCell: 54, exclusiveRegionId: "cedar-vale" },
  { id: "nell", rider: "NELL", passengerArtCell: 55, exclusiveRegionId: "cedar-vale" },
  { id: "dean", rider: "DEAN", passengerArtCell: 56, exclusiveRegionId: "cedar-vale" },
  { id: "rosa", rider: "ROSA", passengerArtCell: 57, exclusiveRegionId: "cedar-vale" },
  { id: "milo", rider: "MILO", passengerArtCell: 58, exclusiveRegionId: "cedar-vale" },
  { id: "june", rider: "JUNE", passengerArtCell: 59, exclusiveRegionId: "cedar-vale" },
  { id: "clark", rider: "CLARK", passengerArtCell: 60, exclusiveRegionId: "cedar-vale" },
  { id: "esme", rider: "ESME", passengerArtCell: 61, exclusiveRegionId: "cedar-vale" },
  { id: "benji", rider: "BENJI", passengerArtCell: 62, exclusiveRegionId: "cedar-vale" },
  { id: "alma", rider: "ALMA", passengerArtCell: 63, exclusiveRegionId: "cedar-vale" },
  { id: "rowan", rider: "ROWAN", passengerArtCell: 64, exclusiveRegionId: "cedar-vale" },
  { id: "faye", rider: "FAYE", passengerArtCell: 65, exclusiveRegionId: "cedar-vale" },
  { id: "samir", rider: "SAMIR", passengerArtCell: 66, exclusiveRegionId: "cedar-vale" },
  { id: "greta", rider: "GRETA", passengerArtCell: 67, exclusiveRegionId: "cedar-vale" },
  { id: "leo", rider: "LEO", passengerArtCell: 68, exclusiveRegionId: "cedar-vale" },
  { id: "mabel", rider: "MABEL", passengerArtCell: 69, exclusiveRegionId: "cedar-vale" },
  { id: "amir", rider: "AMIR", passengerArtCell: 70, exclusiveRegionId: "cedar-vale" },
  { id: "dot", rider: "DOT", passengerArtCell: 71, exclusiveRegionId: "cedar-vale" },
] as const satisfies readonly FareRiderProfile[];

export const NORTHSTAR_RANGE_FARE_RIDERS = [
  { id: "astrid", rider: "ASTRID", passengerArtCell: 72, exclusiveRegionId: "northstar-range" },
  { id: "beckett", rider: "BECKETT", passengerArtCell: 73, exclusiveRegionId: "northstar-range" },
  { id: "cass", rider: "CASS", passengerArtCell: 74, exclusiveRegionId: "northstar-range" },
  { id: "dev", rider: "DEV", passengerArtCell: 75, exclusiveRegionId: "northstar-range" },
  { id: "eira", rider: "EIRA", passengerArtCell: 76, exclusiveRegionId: "northstar-range" },
  { id: "forrest", rider: "FORREST", passengerArtCell: 77, exclusiveRegionId: "northstar-range" },
  { id: "gabi", rider: "GABI", passengerArtCell: 78, exclusiveRegionId: "northstar-range" },
  { id: "hugo", rider: "HUGO", passengerArtCell: 79, exclusiveRegionId: "northstar-range" },
  { id: "imani", rider: "IMANI", passengerArtCell: 80, exclusiveRegionId: "northstar-range" },
  { id: "jae", rider: "JAE", passengerArtCell: 81, exclusiveRegionId: "northstar-range" },
  { id: "koda", rider: "KODA", passengerArtCell: 82, exclusiveRegionId: "northstar-range" },
  { id: "lark", rider: "LARK", passengerArtCell: 83, exclusiveRegionId: "northstar-range" },
  { id: "maren", rider: "MAREN", passengerArtCell: 84, exclusiveRegionId: "northstar-range" },
  { id: "niko", rider: "NIKO", passengerArtCell: 85, exclusiveRegionId: "northstar-range" },
  { id: "opal", rider: "OPAL", passengerArtCell: 86, exclusiveRegionId: "northstar-range" },
  { id: "quinn", rider: "QUINN", passengerArtCell: 87, exclusiveRegionId: "northstar-range" },
  { id: "ravi", rider: "RAVI", passengerArtCell: 88, exclusiveRegionId: "northstar-range" },
  { id: "skye", rider: "SKYE", passengerArtCell: 89, exclusiveRegionId: "northstar-range" },
  { id: "nash", rider: "NASH", passengerArtCell: 90, exclusiveRegionId: "northstar-range" },
  { id: "tobin", rider: "TOBIN", passengerArtCell: 91, exclusiveRegionId: "northstar-range" },
  { id: "val", rider: "VAL", passengerArtCell: 92, exclusiveRegionId: "northstar-range" },
  { id: "wyatt", rider: "WYATT", passengerArtCell: 93, exclusiveRegionId: "northstar-range" },
  { id: "yuki", rider: "YUKI", passengerArtCell: 94, exclusiveRegionId: "northstar-range" },
  { id: "zola", rider: "ZOLA", passengerArtCell: 95, exclusiveRegionId: "northstar-range" },
] as const satisfies readonly FareRiderProfile[];

export const COPPER_MESA_FARE_RIDERS = [
  { id: "carmen", rider: "CARMEN", passengerArtCell: 96, exclusiveRegionId: "copper-mesa" },
  { id: "diego", rider: "DIEGO", passengerArtCell: 97, exclusiveRegionId: "copper-mesa" },
  { id: "estrella", rider: "ESTRELLA", passengerArtCell: 98, exclusiveRegionId: "copper-mesa" },
  { id: "felix", rider: "FELIX", passengerArtCell: 99, exclusiveRegionId: "copper-mesa" },
  { id: "gloria", rider: "GLORIA", passengerArtCell: 100, exclusiveRegionId: "copper-mesa" },
  { id: "hector", rider: "HECTOR", passengerArtCell: 101, exclusiveRegionId: "copper-mesa" },
  { id: "inez", rider: "INEZ", passengerArtCell: 102, exclusiveRegionId: "copper-mesa" },
  { id: "joel", rider: "JOEL", passengerArtCell: 103, exclusiveRegionId: "copper-mesa" },
  { id: "karina", rider: "KARINA", passengerArtCell: 104, exclusiveRegionId: "copper-mesa" },
  { id: "lola", rider: "LOLA", passengerArtCell: 105, exclusiveRegionId: "copper-mesa" },
  { id: "mateo", rider: "MATEO", passengerArtCell: 106, exclusiveRegionId: "copper-mesa" },
  { id: "nora", rider: "NORA", passengerArtCell: 107, exclusiveRegionId: "copper-mesa" },
  { id: "paloma", rider: "PALOMA", passengerArtCell: 108, exclusiveRegionId: "copper-mesa" },
  { id: "rafa", rider: "RAFA", passengerArtCell: 109, exclusiveRegionId: "copper-mesa" },
  { id: "selena", rider: "SELENA", passengerArtCell: 110, exclusiveRegionId: "copper-mesa" },
  { id: "tomas", rider: "TOMAS", passengerArtCell: 111, exclusiveRegionId: "copper-mesa" },
  { id: "vivi", rider: "VIVI", passengerArtCell: 112, exclusiveRegionId: "copper-mesa" },
  { id: "xavi", rider: "XAVI", passengerArtCell: 113, exclusiveRegionId: "copper-mesa" },
  { id: "brooke", rider: "BROOKE", passengerArtCell: 114, exclusiveRegionId: "copper-mesa" },
  { id: "cole", rider: "COLE", passengerArtCell: 115, exclusiveRegionId: "copper-mesa" },
  { id: "emmy", rider: "EMMY", passengerArtCell: 116, exclusiveRegionId: "copper-mesa" },
  { id: "jules", rider: "JULES", passengerArtCell: 117, exclusiveRegionId: "copper-mesa" },
  { id: "morgan", rider: "MORGAN", passengerArtCell: 118, exclusiveRegionId: "copper-mesa" },
  { id: "wade", rider: "WADE", passengerArtCell: 119, exclusiveRegionId: "copper-mesa" },
] as const satisfies readonly FareRiderProfile[];

export const CYPRESS_REACH_FARE_RIDERS = [
  { id: "anouk", rider: "ANOUK", passengerArtCell: 120, exclusiveRegionId: "cypress-reach" },
  { id: "odette", rider: "ODETTE", passengerArtCell: 121, exclusiveRegionId: "cypress-reach" },
  { id: "celeste", rider: "CELESTE", passengerArtCell: 122, exclusiveRegionId: "cypress-reach" },
  { id: "delia", rider: "DELIA", passengerArtCell: 123, exclusiveRegionId: "cypress-reach" },
  { id: "emmett", rider: "EMMETT", passengerArtCell: 124, exclusiveRegionId: "cypress-reach" },
  { id: "frankie", rider: "FRANKIE", passengerArtCell: 125, exclusiveRegionId: "cypress-reach" },
  { id: "hazel", rider: "HAZEL", passengerArtCell: 126, exclusiveRegionId: "cypress-reach" },
  { id: "isaiah", rider: "ISAIAH", passengerArtCell: 127, exclusiveRegionId: "cypress-reach" },
  { id: "jonah", rider: "JONAH", passengerArtCell: 128, exclusiveRegionId: "cypress-reach" },
  { id: "kit", rider: "KIT", passengerArtCell: 129, exclusiveRegionId: "cypress-reach" },
  { id: "lucille", rider: "LUCILLE", passengerArtCell: 130, exclusiveRegionId: "cypress-reach" },
  { id: "minh", rider: "MINH", passengerArtCell: 131, exclusiveRegionId: "cypress-reach" },
  { id: "odessa", rider: "ODESSA", passengerArtCell: 132, exclusiveRegionId: "cypress-reach" },
  { id: "pearl", rider: "PEARL", passengerArtCell: 133, exclusiveRegionId: "cypress-reach" },
  { id: "reed", rider: "REED", passengerArtCell: 134, exclusiveRegionId: "cypress-reach" },
  { id: "simone", rider: "SIMONE", passengerArtCell: 135, exclusiveRegionId: "cypress-reach" },
  { id: "thalia", rider: "THALIA", passengerArtCell: 136, exclusiveRegionId: "cypress-reach" },
  { id: "ulysses", rider: "ULYSSES", passengerArtCell: 137, exclusiveRegionId: "cypress-reach" },
  { id: "vincent", rider: "VINCENT", passengerArtCell: 138, exclusiveRegionId: "cypress-reach" },
  { id: "willow", rider: "WILLOW", passengerArtCell: 139, exclusiveRegionId: "cypress-reach" },
  { id: "yvette", rider: "YVETTE", passengerArtCell: 140, exclusiveRegionId: "cypress-reach" },
  { id: "zeke", rider: "ZEKE", passengerArtCell: 141, exclusiveRegionId: "cypress-reach" },
  { id: "basil", rider: "BASIL", passengerArtCell: 142, exclusiveRegionId: "cypress-reach" },
  { id: "mercy", rider: "MERCY", passengerArtCell: 143, exclusiveRegionId: "cypress-reach" },
] as const satisfies readonly FareRiderProfile[];

export const SOLANA_COAST_FARE_RIDERS = [
  { id: "sienna", rider: "SIENNA", passengerArtCell: 144, exclusiveRegionId: "solana-coast" },
  { id: "dante", rider: "DANTE", passengerArtCell: 145, exclusiveRegionId: "solana-coast" },
  { id: "leila", rider: "LEILA", passengerArtCell: 146, exclusiveRegionId: "solana-coast" },
  { id: "miles", rider: "MILES", passengerArtCell: 147, exclusiveRegionId: "solana-coast" },
  { id: "keiko", rider: "KEIKO", passengerArtCell: 148, exclusiveRegionId: "solana-coast" },
  { id: "eden", rider: "EDEN", passengerArtCell: 149, exclusiveRegionId: "solana-coast" },
  { id: "malik", rider: "MALIK", passengerArtCell: 150, exclusiveRegionId: "solana-coast" },
  { id: "serena", rider: "SERENA", passengerArtCell: 151, exclusiveRegionId: "solana-coast" },
  { id: "adrian", rider: "ADRIAN", passengerArtCell: 152, exclusiveRegionId: "solana-coast" },
  { id: "kira", rider: "KIRA", passengerArtCell: 153, exclusiveRegionId: "solana-coast" },
  { id: "owen", rider: "OWEN", passengerArtCell: 154, exclusiveRegionId: "solana-coast" },
  { id: "nadine", rider: "NADINE", passengerArtCell: 155, exclusiveRegionId: "solana-coast" },
  { id: "remy", rider: "REMY", passengerArtCell: 156, exclusiveRegionId: "solana-coast" },
  { id: "cleo", rider: "CLEO", passengerArtCell: 157, exclusiveRegionId: "solana-coast" },
  { id: "ronan", rider: "RONAN", passengerArtCell: 158, exclusiveRegionId: "solana-coast" },
  { id: "asha", rider: "ASHA", passengerArtCell: 159, exclusiveRegionId: "solana-coast" },
  { id: "luca", rider: "LUCA", passengerArtCell: 160, exclusiveRegionId: "solana-coast" },
  { id: "marisol", rider: "MARISOL", passengerArtCell: 161, exclusiveRegionId: "solana-coast" },
  { id: "theo", rider: "THEO", passengerArtCell: 162, exclusiveRegionId: "solana-coast" },
  { id: "elena", rider: "ELENA", passengerArtCell: 163, exclusiveRegionId: "solana-coast" },
  { id: "callum", rider: "CALLUM", passengerArtCell: 164, exclusiveRegionId: "solana-coast" },
  { id: "veda", rider: "VEDA", passengerArtCell: 165, exclusiveRegionId: "solana-coast" },
  { id: "juniper", rider: "JUNIPER", passengerArtCell: 166, exclusiveRegionId: "solana-coast" },
  { id: "hollis", rider: "HOLLIS", passengerArtCell: 167, exclusiveRegionId: "solana-coast" },
] as const satisfies readonly FareRiderProfile[];

export const FARE_RIDERS: readonly FareRiderProfile[] = [
  ...SHARED_FARE_RIDERS,
  ...CEDAR_VALE_FARE_RIDERS,
  ...NORTHSTAR_RANGE_FARE_RIDERS,
  ...COPPER_MESA_FARE_RIDERS,
  ...CYPRESS_REACH_FARE_RIDERS,
  ...SOLANA_COAST_FARE_RIDERS,
];

export function eligibleFareRiders(region: Pick<WorldRegion, "id"> | null) {
  return FARE_RIDERS.filter((rider) => (
    rider.exclusiveRegionId === null || rider.exclusiveRegionId === region?.id
  ));
}

function riderSelectionSeed(runSeed: number, cycle: number, regionId: WorldRegionId) {
  let seed = (
    (runSeed >>> 0)
    ^ Math.imul(cycle + 1, 0x9e3779b1)
    ^ Math.imul(cycle + 7, 0x85ebca77)
  ) >>> 0;
  for (let index = 0; index < regionId.length; index += 1) {
    seed ^= regionId.charCodeAt(index);
    seed = Math.imul(seed, 0x01000193) >>> 0;
  }
  return seed >>> 0;
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

export function selectFareRiders(input: {
  runSeed: number;
  cycle: number;
  region: Pick<WorldRegion, "id"> | null;
  usedFareRiderIdsByRegion: FareRiderHistoryByRegion;
  previousRiderIds: readonly FareId[];
  count?: number;
}) {
  const eligible = eligibleFareRiders(input.region);
  const regionId = input.region?.id ?? "city-center";
  const eligibleIds = new Set(eligible.map((rider) => rider.id));
  const normalizedHistory = [...new Set(
    (input.usedFareRiderIdsByRegion[regionId] ?? []).filter((id) => eligibleIds.has(id)),
  )];
  const repeatThreshold = Math.ceil(eligible.length / 2);
  const didReset = normalizedHistory.length >= repeatThreshold;
  const activeHistory = didReset ? [] : normalizedHistory;
  const blockedIds = new Set([...activeHistory, ...input.previousRiderIds]);
  const candidates = eligible.filter((rider) => !blockedIds.has(rider.id));
  const count = input.count ?? FARES_PER_CYCLE;
  if (count < 0 || count > FARES_PER_CYCLE) {
    throw new Error(`Passenger selection count ${count} is outside the fare-slot contract`);
  }
  if (candidates.length < count) {
    throw new Error(`Passenger deck ${regionId} has only ${candidates.length} fresh riders`);
  }
  const riders = shuffled(
    candidates,
    mulberry32(riderSelectionSeed(input.runSeed, input.cycle, regionId)),
  ).slice(0, count);
  return {
    riders,
    repeatThreshold,
    didReset,
    usedFareRiderIdsByRegion: {
      ...input.usedFareRiderIdsByRegion,
      [regionId]: [...activeHistory, ...riders.map((rider) => rider.id)],
    },
  };
}
