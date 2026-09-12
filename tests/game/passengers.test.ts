import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  DESTINATION_ART_CELL_COUNT,
  FARES_PER_CYCLE,
  PASSENGER_ART_CELL_COUNT,
} from "../../game/config";
import {
  CEDAR_VALE_FARE_RIDERS,
  COPPER_MESA_FARE_RIDERS,
  CYPRESS_REACH_FARE_RIDERS,
  FARE_RIDERS,
  NORTHSTAR_RANGE_FARE_RIDERS,
  SHARED_FARE_RIDERS,
  SOLANA_COAST_FARE_RIDERS,
  IRONWAKE_FARE_RIDERS,
  eligibleFareRiders,
  selectFareRiders,
  type FareRiderHistoryByRegion,
} from "../../game/passengers";
import { fareArtAsset, fareArtFrame } from "../../game/fare-presentation";
import { farePassengerAppearance } from "../../game/render/scene";
import { ACTIVE_WORLD_REGIONS, type WorldRegion } from "../../game/regions";

const city = ACTIVE_WORLD_REGIONS.find((region) => region.id === "city-center")!;
const cedar = ACTIVE_WORLD_REGIONS.find((region) => region.id === "cedar-vale")!;
const northstar = ACTIVE_WORLD_REGIONS.find((region) => region.id === "northstar-range")!;
const copperMesa = ACTIVE_WORLD_REGIONS.find((region) => region.id === "copper-mesa")!;
const solanaCoast = ACTIVE_WORLD_REGIONS.find((region) => region.id === "solana-coast")!;
const cypressReach = ACTIVE_WORLD_REGIONS.find((region) => region.id === "cypress-reach")!;
const ironwake = ACTIVE_WORLD_REGIONS.find((region) => region.id === "ironwake-works")!;

function selectedIds(
  region: WorldRegion,
  cycles: number,
  runSeed = 0x51_7a_2026,
) {
  let usedFareRiderIdsByRegion: FareRiderHistoryByRegion = {};
  let previousRiderIds: string[] = [];
  const markets: string[][] = [];
  const resets: boolean[] = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const selection = selectFareRiders({
      runSeed,
      cycle,
      region,
      usedFareRiderIdsByRegion,
      previousRiderIds,
    });
    previousRiderIds = selection.riders.map((rider) => rider.id);
    usedFareRiderIdsByRegion = selection.usedFareRiderIdsByRegion;
    markets.push(previousRiderIds);
    resets.push(selection.didReset);
  }
  return { markets, resets, usedFareRiderIdsByRegion };
}

test("the expanded cast includes six Ironwake workers alongside all existing regional riders", () => {
  assert.equal(SHARED_FARE_RIDERS.length, 48);
  assert.equal(CEDAR_VALE_FARE_RIDERS.length, 24);
  assert.equal(NORTHSTAR_RANGE_FARE_RIDERS.length, 24);
  assert.equal(COPPER_MESA_FARE_RIDERS.length, 24);
  assert.equal(CYPRESS_REACH_FARE_RIDERS.length, 24);
  assert.equal(SOLANA_COAST_FARE_RIDERS.length, 24);
  assert.equal(IRONWAKE_FARE_RIDERS.length, 6);
  assert.equal(FARE_RIDERS.length, 174);
  assert.equal(PASSENGER_ART_CELL_COUNT, 174);
  assert.equal(DESTINATION_ART_CELL_COUNT, 102);
  assert.equal(new Set(FARE_RIDERS.map((rider) => rider.id)).size, FARE_RIDERS.length);
  assert.equal(new Set(FARE_RIDERS.map((rider) => rider.rider)).size, FARE_RIDERS.length);
  assert.deepEqual(
    FARE_RIDERS.map((rider) => rider.passengerArtCell).sort((a, b) => a - b),
    Array.from({ length: PASSENGER_ART_CELL_COUNT }, (_, index) => index),
  );
  assert.ok(SHARED_FARE_RIDERS.every((rider) => rider.exclusiveRegionId === null));
  assert.ok(CEDAR_VALE_FARE_RIDERS.every((rider) => (
    rider.exclusiveRegionId === "cedar-vale"
  )));
  assert.ok(NORTHSTAR_RANGE_FARE_RIDERS.every((rider) => (
    rider.exclusiveRegionId === "northstar-range"
  )));
  assert.ok(COPPER_MESA_FARE_RIDERS.every((rider) => (
    rider.exclusiveRegionId === "copper-mesa"
  )));
  assert.ok(CYPRESS_REACH_FARE_RIDERS.every((rider) => (
    rider.exclusiveRegionId === "cypress-reach"
  )));
});

test("City markets stay shared while each neighboring region adds only its local cast", () => {
  const cityEligible = eligibleFareRiders(city);
  const cedarEligible = eligibleFareRiders(cedar);
  const northstarEligible = eligibleFareRiders(northstar);
  const copperMesaEligible = eligibleFareRiders(copperMesa);
  const cypressReachEligible = eligibleFareRiders(cypressReach);
  const cedarOnlyIds = new Set<string>(CEDAR_VALE_FARE_RIDERS.map((rider) => rider.id));
  const northstarOnlyIds = new Set<string>(NORTHSTAR_RANGE_FARE_RIDERS.map((rider) => rider.id));
  const copperMesaOnlyIds = new Set<string>(COPPER_MESA_FARE_RIDERS.map((rider) => rider.id));
  const cypressReachOnlyIds = new Set<string>(CYPRESS_REACH_FARE_RIDERS.map((rider) => rider.id));
  assert.deepEqual(cityEligible, SHARED_FARE_RIDERS);
  assert.deepEqual(cedarEligible, [...SHARED_FARE_RIDERS, ...CEDAR_VALE_FARE_RIDERS]);
  assert.deepEqual(northstarEligible, [...SHARED_FARE_RIDERS, ...NORTHSTAR_RANGE_FARE_RIDERS]);
  assert.deepEqual(copperMesaEligible, [...SHARED_FARE_RIDERS, ...COPPER_MESA_FARE_RIDERS]);
  assert.deepEqual(cypressReachEligible, [...SHARED_FARE_RIDERS, ...CYPRESS_REACH_FARE_RIDERS]);
  assert.equal(cityEligible.some((rider) => cedarOnlyIds.has(rider.id)), false);
  assert.equal(cityEligible.some((rider) => northstarOnlyIds.has(rider.id)), false);
  assert.equal(cityEligible.some((rider) => copperMesaOnlyIds.has(rider.id)), false);
  assert.equal(cityEligible.some((rider) => cypressReachOnlyIds.has(rider.id)), false);
  assert.equal(cedarEligible.filter((rider) => cedarOnlyIds.has(rider.id)).length, 24);
  assert.equal(cedarEligible.some((rider) => northstarOnlyIds.has(rider.id)), false);
  assert.equal(northstarEligible.filter((rider) => northstarOnlyIds.has(rider.id)).length, 24);
  assert.equal(northstarEligible.some((rider) => cedarOnlyIds.has(rider.id)), false);
  assert.equal(copperMesaEligible.filter((rider) => copperMesaOnlyIds.has(rider.id)).length, 24);
  assert.equal(copperMesaEligible.some((rider) => cedarOnlyIds.has(rider.id) || northstarOnlyIds.has(rider.id)), false);
  assert.equal(cypressReachEligible.filter((rider) => cypressReachOnlyIds.has(rider.id)).length, 24);
  assert.equal(cypressReachEligible.some((rider) => cedarOnlyIds.has(rider.id) || northstarOnlyIds.has(rider.id) || copperMesaOnlyIds.has(rider.id)), false);

  const citySweep = selectedIds(city, 12).markets.flat();
  assert.equal(citySweep.some((id) => cedarOnlyIds.has(id)), false);
  const cedarSweep = selectedIds(cedar, 12).markets.flat();
  assert.ok(cedarSweep.some((id) => cedarOnlyIds.has(id)));
  const northstarSweep = selectedIds(northstar, 12).markets.flat();
  assert.ok(northstarSweep.some((id) => northstarOnlyIds.has(id)));
  const copperMesaSweep = selectedIds(copperMesa, 12).markets.flat();
  assert.ok(copperMesaSweep.some((id) => copperMesaOnlyIds.has(id)));
  const cypressReachSweep = selectedIds(cypressReach, 12).markets.flat();
  assert.ok(cypressReachSweep.some((id) => cypressReachOnlyIds.has(id)));
});

test("each regional deck exhausts at least half its eligible cast before reuse", () => {
  for (const [region, freshCycles, threshold] of [
    [city, 4, 24],
    [cedar, 6, 36],
    [northstar, 6, 36],
    [copperMesa, 6, 36],
    [cypressReach, 6, 36],
    [solanaCoast, 6, 36],
    [ironwake, 5, 30],
  ] as const) {
    const result = selectedIds(region, freshCycles + 1);
    const protectedIds = result.markets.slice(0, freshCycles).flat();
    assert.equal(protectedIds.length, threshold);
    assert.equal(new Set(protectedIds).size, threshold);
    assert.ok(result.markets.every((market) => new Set(market).size === FARES_PER_CYCLE));
    assert.ok(result.resets.slice(0, freshCycles).every((reset) => reset === false));
    assert.equal(result.resets[freshCycles], true);
    assert.equal(
      result.usedFareRiderIdsByRegion[region.id]?.length,
      FARES_PER_CYCLE,
      "the repeat window should restart with the first post-threshold market",
    );
    assert.equal(
      result.markets[freshCycles - 1].some((id) => result.markets[freshCycles].includes(id)),
      false,
      "adjacent markets should not repeat even when the 50% window resets",
    );
  }
});

test("Ironwake workers appear only in their pickup region and preserve independent return history", () => {
  assert.deepEqual(eligibleFareRiders(ironwake), [...SHARED_FARE_RIDERS, ...IRONWAKE_FARE_RIDERS]);
  const workerIds = new Set<string>(IRONWAKE_FARE_RIDERS.map(r => r.id));
  for (const region of ACTIVE_WORLD_REGIONS.filter(r => r.id !== ironwake.id)) {
    assert.equal(eligibleFareRiders(region).some(r => workerIds.has(r.id)), false);
  }
  const sweep = selectedIds(ironwake, 20).markets.flat();
  for (const id of workerIds) assert.ok(sweep.includes(id), id);
  const first = selectFareRiders({ runSeed: 1704, cycle: 0, region: ironwake, usedFareRiderIdsByRegion: {}, previousRiderIds: [] });
  const away = selectFareRiders({ runSeed: 1704, cycle: 1, region: solanaCoast,
    usedFareRiderIdsByRegion: first.usedFareRiderIdsByRegion, previousRiderIds: first.riders.map(r => r.id) });
  const back = selectFareRiders({ runSeed: 1704, cycle: 2, region: ironwake,
    usedFareRiderIdsByRegion: away.usedFareRiderIdsByRegion, previousRiderIds: away.riders.map(r => r.id) });
  assert.equal(back.riders.some(r => first.riders.some(old => old.id === r.id)), false);
  assert.equal(back.usedFareRiderIdsByRegion[ironwake.id]?.length, 12);
  assert.deepEqual(back.usedFareRiderIdsByRegion[solanaCoast.id], away.usedFareRiderIdsByRegion[solanaCoast.id]);
});

test("regional histories persist independently through a City-Cedar-City round trip", () => {
  let history: FareRiderHistoryByRegion = {};
  const firstCity = selectFareRiders({
    runSeed: 811,
    cycle: 0,
    region: city,
    usedFareRiderIdsByRegion: history,
    previousRiderIds: [],
  });
  history = firstCity.usedFareRiderIdsByRegion;
  const cedarMarket = selectFareRiders({
    runSeed: 811,
    cycle: 1,
    region: cedar,
    usedFareRiderIdsByRegion: history,
    previousRiderIds: firstCity.riders.map((rider) => rider.id),
  });
  history = cedarMarket.usedFareRiderIdsByRegion;
  const secondCity = selectFareRiders({
    runSeed: 811,
    cycle: 2,
    region: city,
    usedFareRiderIdsByRegion: history,
    previousRiderIds: cedarMarket.riders.map((rider) => rider.id),
  });

  const firstCityIds = new Set(firstCity.riders.map((rider) => rider.id));
  assert.equal(secondCity.riders.some((rider) => firstCityIds.has(rider.id)), false);
  assert.equal(secondCity.usedFareRiderIdsByRegion[city.id]?.length, 12);
  assert.equal(secondCity.usedFareRiderIdsByRegion[cedar.id]?.length, 6);
});

test("passenger art scales to twenty-nine portrait sheets and seventeen destination sheets", () => {
  assert.deepEqual(fareArtFrame(143), { sheet: 23, backgroundPosition: "100% 100%" });
  assert.equal(fareArtAsset("pickup", 0), "/fare-passengers.webp");
  assert.equal(fareArtAsset("pickup", 15), "/fare-passengers-16.webp");
  assert.equal(fareArtAsset("pickup", 16), "/fare-passengers-17.webp");
  assert.equal(fareArtAsset("pickup", 19), "/fare-passengers-20.webp");
  assert.equal(fareArtAsset("pickup", 23), "/fare-passengers-24.webp");
  assert.equal(fareArtAsset("dropoff", 0), "/fare-destinations.webp");
  assert.equal(fareArtAsset("dropoff", 3), "/fare-destinations-4.webp");
  const passengerAssets = [];
  for (let sheet = 0; sheet < PASSENGER_ART_CELL_COUNT / 6; sheet += 1) {
    const asset = fareArtAsset("pickup", sheet);
    passengerAssets.push(asset);
    assert.equal(existsSync(new URL(`../../public${asset}`, import.meta.url)), true, asset);
  }
  assert.equal(new Set(passengerAssets).size, 29);
  const passengerHashes = passengerAssets.map((asset) => createHash("sha256")
    .update(readFileSync(new URL(`../../public${asset}`, import.meta.url)))
    .digest("hex"));
  assert.equal(new Set(passengerHashes).size, 29, "every passenger sheet should contain distinct physical art");
  for (let sheet = 0; sheet < DESTINATION_ART_CELL_COUNT / 6; sheet += 1) {
    const asset = fareArtAsset("dropoff", sheet);
    assert.equal(existsSync(new URL(`../../public${asset}`, import.meta.url)), true, asset);
  }
});

test("in-world passenger appearance is stable by rider identity rather than fare slot", () => {
  const appearances = FARE_RIDERS.map((rider) => (
    JSON.stringify(farePassengerAppearance(rider.passengerArtCell))
  ));
  assert.equal(
    farePassengerAppearance(37),
    farePassengerAppearance(37),
    "appearance lookup should be memoized and stable",
  );
  assert.ok(new Set(appearances).size >= 90, "the 174 riders need substantial world variety");
});
