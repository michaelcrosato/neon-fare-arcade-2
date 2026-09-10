import assert from "node:assert/strict";
import test from "node:test";
import { destinationCardsForPlace } from "../../game/destination-cards";

import { PASSENGER_ART_CELL_COUNT } from "../../game/config";
import { FARE_RIDERS } from "../../game/passengers";
import {
  FARE_CARD_TIMING_MS,
  FARE_IMPACT_DURATION_MS,
  fareArtFrame,
  makeDropoffFareImpact,
  makePickupFareImpact,
} from "../../game/fare-presentation";

test("pickup and dropoff cards retain the selected destination occasion", () => {
  const destinationCard = destinationCardsForPlace("pulse-stadium")[1];
  const common = { fareId: "dex", fareNumber: 6, rider: "DEX", destination: destinationCard.label,
    destinationCard, bonusSeconds: 4, runKind: "timed" as const };
  const pickup = makePickupFareImpact({ ...common, artCell: 5 });
  const dropoff = makeDropoffFareImpact({ ...common, artCell: destinationCard.artCell, fareAward: 100, multiplier: 1 });
  assert.deepEqual(pickup.destinationCard, destinationCard);
  assert.deepEqual(dropoff.destinationCard, destinationCard);
  assert.equal(dropoff.destinationCard!.occasion, "STADIUM CONCERT");
});

test("every stable fare ID maps to one unique art cell", () => {
  const cells = FARE_RIDERS.map((rider) => makePickupFareImpact({
    fareId: rider.id,
    fareNumber: rider.passengerArtCell + 1,
    artCell: rider.passengerArtCell,
    rider: rider.rider,
    destination: "MARINA ARCADE",
    bonusSeconds: 5,
    runKind: "timed",
  }).artCell);

  assert.deepEqual(cells, Array.from({ length: PASSENGER_ART_CELL_COUNT }, (_, index) => index));
  assert.equal(new Set(cells).size, FARE_RIDERS.length);
});

test("168 passenger cells resolve across twenty-eight physical 3-by-2 sprite sheets", () => {
  assert.deepEqual(fareArtFrame(0), { sheet: 0, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(5), { sheet: 0, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(6), { sheet: 1, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(11), { sheet: 1, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(12), { sheet: 2, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(17), { sheet: 2, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(18), { sheet: 3, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(23), { sheet: 3, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(24), { sheet: 4, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(47), { sheet: 7, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(48), { sheet: 8, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(71), { sheet: 11, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(72), { sheet: 12, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(95), { sheet: 15, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(96), { sheet: 16, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(119), { sheet: 19, backgroundPosition: "100% 100%" });
  assert.deepEqual(fareArtFrame(120), { sheet: 20, backgroundPosition: "0% 0%" });
  assert.deepEqual(fareArtFrame(143), { sheet: 23, backgroundPosition: "100% 100%" });
  for (let sheet = 24; sheet < 28; sheet += 1) {
    assert.deepEqual(fareArtFrame(sheet * 6), { sheet, backgroundPosition: "0% 0%" });
    assert.deepEqual(fareArtFrame(sheet * 6 + 5), { sheet, backgroundPosition: "100% 100%" });
  }
  assert.deepEqual(fareArtFrame(29), { sheet: 4, backgroundPosition: "100% 100%" });
});

test("pickup and dropoff presentation copy keeps gameplay rewards intact", () => {
  const pickup = makePickupFareImpact({
    fareId: "rico",
    fareNumber: 1,
    artCell: 0,
    rider: "RICO",
    destination: "MARINA ARCADE",
    bonusSeconds: 5,
    runKind: "timed",
  });
  assert.equal(pickup.headline, "RICO IN!");
  assert.equal(pickup.fareNumber, 1);
  assert.equal(pickup.detail, "+5 SEC · +8 BOOST");
  assert.equal(pickup.durationMs, FARE_IMPACT_DURATION_MS.pickup);

  const dropoff = makeDropoffFareImpact({
    fareId: "rico",
    fareNumber: 1,
    artCell: 7,
    rider: "RICO",
    destination: "MARINA ARCADE",
    fareAward: 49,
    bonusSeconds: 9,
    multiplier: 1.5,
    runKind: "timed",
  });
  assert.equal(dropoff.headline, "+$49");
  assert.equal(dropoff.fareNumber, pickup.fareNumber);
  assert.notEqual(dropoff.artCell, pickup.artCell);
  assert.equal(dropoff.detail, "1.5× MULTI · +9 SEC");
  assert.equal(dropoff.durationMs, FARE_IMPACT_DURATION_MS.dropoff);

  const freePickup = makePickupFareImpact({
    fareId: "sage",
    fareNumber: 13,
    artCell: 12,
    rider: "SAGE",
    destination: "NEON THEATER",
    bonusSeconds: 0,
    runKind: "free-run",
  });
  const freeDropoff = makeDropoffFareImpact({
    fareId: "sage",
    fareNumber: 13,
    artCell: 14,
    rider: "SAGE",
    destination: "NEON THEATER",
    fareAward: 54,
    bonusSeconds: 0,
    multiplier: 2,
    runKind: "free-run",
  });
  assert.equal(freePickup.detail, "+8 BOOST · FREE RUN");
  assert.equal(freeDropoff.detail, "2.0× MULTI · FREE RUN");
});

test("fare cards hold for a full readable beat before docking", () => {
  const total = FARE_CARD_TIMING_MS.enter + FARE_CARD_TIMING_MS.hold + FARE_CARD_TIMING_MS.dock;
  assert.equal(FARE_CARD_TIMING_MS.hold, 1000);
  assert.equal(FARE_IMPACT_DURATION_MS.pickup, total);
  assert.equal(FARE_IMPACT_DURATION_MS.dropoff, total);
});
