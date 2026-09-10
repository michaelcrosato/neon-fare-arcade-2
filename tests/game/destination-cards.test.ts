import assert from "node:assert/strict";
import test from "node:test";

import { DESTINATION_ART_CELL_COUNT } from "../../game/config";
import { DESTINATION_ART, DESTINATION_PLACES, destinationCardsForPlace, distanceToDestinationPlace } from "../../game/destination-cards";
import { CITY_LANDMARKS } from "../../game/landmarks";
import { REGIONAL_CONTENT } from "../../game/regional-content";
import { DESTINATION_WATER_NEARBY_DISTANCE, createProceduralFareStopPairs, destinationWaterDistance, landmarkDestinationStops } from "../../game/fare-placement";
import { neighborhoodDestinationCard, scenicDestinationCard } from "../../game/destination-environment";
import { createFareJobs } from "../../game/fare-market";
import { ACTIVE_WORLD_REGIONS } from "../../game/regions";
import { districtForPosition, lotForBlock } from "../../game/world";

test("every visually audited destination frame has one semantic category", () => {
  assert.equal(DESTINATION_ART.length, DESTINATION_ART_CELL_COUNT);
  assert.deepEqual(DESTINATION_ART.map(art => art.artCell), Array.from({ length: DESTINATION_ART_CELL_COUNT }, (_, i) => i));
  assert.ok(DESTINATION_ART.every(art => art.subject.length > 3 && art.category));
  for (const cell of [0, 5, 8, 18, 22, 24, 25, 32, 33, 34, 35, 60, 83]) {
    assert.equal(DESTINATION_ART[cell].requiresWater, true, `water is part of card ${cell}'s subject`);
  }
});

test("all major and mini landmarks have distinct occasion cards tied to their actual footprints", () => {
  const anchors = [...CITY_LANDMARKS, ...REGIONAL_CONTENT.flatMap(region => region.anchors)];
  assert.equal(DESTINATION_PLACES.length, anchors.length);
  assert.equal(new Set(DESTINATION_PLACES.map(place => place.id)).size, anchors.length);
  for (const anchor of anchors) {
    const place = DESTINATION_PLACES.find(entry => entry.id === anchor.id);
    assert.ok(place, `${anchor.id} needs a destination`);
    assert.equal(place.label, anchor.label);
    assert.deepEqual(place.bounds, {
      minX: anchor.originX * 36, minY: anchor.originY * 36,
      maxX: (anchor.originX + anchor.width) * 36, maxY: (anchor.originY + anchor.height) * 36,
    });
    const cards = destinationCardsForPlace(place.id);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map(card => card.id)).size, 3);
    assert.equal(new Set(cards.map(card => card.occasion)).size, 3);
    assert.ok(cards.every(card => card.placeId === place.id && card.artCell === place.artCell));
  }
});

test("relocated and misleading legacy landmark IDs use the present-day destination", () => {
  const art = (id: string) => DESTINATION_ART[destinationCardsForPlace(id)[0].artCell];
  assert.equal(art("marina-arcade").requiresWater, false, "this arcade is inland");
  assert.match(art("south-terminal").subject, /bus/i);
  assert.match(art("blackwater-shipyard").subject, /studio/i);
  assert.match(art("cypress-crown").subject, /tennis/i);
  assert.match(art("aurora-lookout").subject, /observatory/i);
});

test("every named destination has safe curbs at its real model and waterfront cards have nearby water", () => {
  for (const place of DESTINATION_PLACES) {
    const stops = landmarkDestinationStops(place.id);
    assert.ok(stops.length, `${place.id} needs at least one validated arrival curb`);
    for (const stop of stops) {
      assert.equal(stop.destinationCard?.placeId, place.id);
      assert.ok(distanceToDestinationPlace(stop.zone, place) <= place.arrivalRadius);
      if (stop.destinationCard?.requiresWater) {
        assert.ok(destinationWaterDistance(stop.zone) <= DESTINATION_WATER_NEARBY_DISTANCE, `${place.id} lacks nearby water`);
      }
    }
  }
});

test("ordinary destinations exclude empty countryside and scenic outings require matching rider props", () => {
  for (const lot of ["park", "range-meadow", "range-forest-clearing", "range-snowfield", "mesa-dry-wash", "mesa-redrock-shelf", "reach-ocean", "coast-cliff-garden"] as const) {
    assert.equal(neighborhoodDestinationCard(lot, "test", "Test"), null, lot);
  }
  assert.equal(scenicDestinationCard("range-trailhead", "rico", "trail", "Northstar"), null);
  assert.equal(scenicDestinationCard("range-meadow", "beckett", "field", "Northstar"), null);
  assert.match(scenicDestinationCard("range-trailhead", "beckett", "trail", "Northstar")!.occasion, /WILDLIFE/);
  assert.equal(scenicDestinationCard("reach-beach", "beckett", "beach", "Palm Reach"), null);
  assert.equal(scenicDestinationCard("reach-beach", "anouk", "beach", "Palm Reach")!.artCell, 83);
  assert.equal(scenicDestinationCard("coast-beach", "sienna", "beach", "Solana")!.artCell, 24);
});

test("seeded markets favor landmarks and retain environment agreement in every region", () => {
  for (const region of ACTIVE_WORLD_REGIONS) {
    let landmarkCount = 0;
    for (const seed of [0x1234, 0x5678, 0x9abc]) {
      const jobs = createFareJobs(seed, 0, [], region);
      assert.equal(jobs.length, 6);
      assert.ok(jobs.filter(job => job.destinationCard?.kind === "scenic").length <= 1);
      for (const job of jobs) {
        const card = job.destinationCard;
        assert.ok(card, `${region.id}: ${job.destination} needs an environment-backed card`);
        assert.equal(card.artCell, job.destinationArtCell);
        if (card.kind === "landmark") landmarkCount += 1;
        else {
          const lot = lotForBlock(Math.floor(job.dropoff.x / 36), Math.floor(job.dropoff.y / 36), districtForPosition(job.dropoff.x, job.dropoff.y));
          const expected = card.kind === "scenic"
            ? scenicDestinationCard(lot, job.id, card.placeId, card.label)
            : neighborhoodDestinationCard(lot, card.placeId, card.label);
          assert.equal(expected?.artCell, card.artCell, `${region.id}: ${lot} does not match ${card.id}`);
        }
        if (card.requiresWater) assert.ok(destinationWaterDistance(job.dropoff) <= DESTINATION_WATER_NEARBY_DISTANCE);
      }
    }
    assert.ok(landmarkCount >= 9, `${region.id}: only ${landmarkCount}/18 fares reach a landmark`);
  }
});

test("rare scenic rolls produce real trail or beach stops only for the matched passenger", () => {
  for (const [regionId, riderId, seed, artCell] of [
    ["northstar-range", "beckett", 45, 77], ["cypress-reach", "anouk", 3, 83], ["solana-coast", "sienna", 20, 24],
  ] as const) {
    const region = ACTIVE_WORLD_REGIONS.find(entry => entry.id === regionId)!;
    const [trip] = createProceduralFareStopPairs(seed, [], false, region, { count: 1, riderIds: [riderId] });
    assert.equal(trip.dropoff.destinationCard?.kind, "scenic");
    assert.equal(trip.dropoff.artCell, artCell);
    const [ordinary] = createProceduralFareStopPairs(seed, [], false, region, { count: 1, riderIds: ["rico"] });
    assert.notEqual(ordinary.dropoff.destinationCard?.kind, "scenic");
    if (trip.dropoff.destinationCard?.requiresWater) assert.ok(destinationWaterDistance(trip.dropoff.zone) <= DESTINATION_WATER_NEARBY_DISTANCE);
  }
});
