import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_COURIER_MASK,
  COURIER_HANDOFF_TAXI_RADIUS,
  COURIER_CONTRACTS,
  COURIER_PICKUP_TAXI_RADIUS,
  acceptCourierContract,
  availableCourierContracts,
  courierContract,
  courierDistanceQuote,
  courierMapMarkers,
  createCourierOfferOrder,
  markCourierLoadedInTaxi,
  resolveCourierCounter,
} from "../../game/courier";
import { farePickupMarkers } from "../../game/fare-selection";
import { interiorWorld } from "../../game/interiors";
import type { Game, VenueRef, WorldView } from "../../game/model";
import { NavigationController } from "../../game/navigation";
import { playerAvatarBoxes, taxiBoxes } from "../../game/render/scene";
import { stepExploration } from "../../game/exploration";
import { stepGame } from "../../game/simulation";
import { getObjective, getObjectiveKey, getObjectiveLabel } from "../../game/state";
import { generateCityChunk } from "../../game/world";
import { makeGame } from "../../game/state";

const emptyWorld: WorldView = { key: "empty", boxes: [], colliders: [], chunks: [], interactions: [] };

function enterVenue(game: Game, venue: VenueRef, x = -6.2, y = 6.3) {
  game.player = {
    kind: "walking",
    actor: { x, y, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "interior", venue, returnPose: { x: 0, y: 0, heading: 0 } },
  };
  game.interactionHeld = false;
}

function parkTaxi(game: Game, point: { x: number; y: number }) {
  game.x = point.x;
  game.y = point.y;
  game.vx = 0;
  game.vy = 0;
  game.speed = 0;
}

test("courier boards shuffle by run seed and quote the full required taxi route", () => {
  assert.deepEqual(createCourierOfferOrder(1234, 0), createCourierOfferOrder(1234, 0));
  assert.notDeepEqual(createCourierOfferOrder(1234, 0), createCourierOfferOrder(5678, 0));

  const game = makeGame("street-ace", 1234);
  assert.deepEqual(
    availableCourierContracts(game).map((contract) => contract.id),
    createCourierOfferOrder(1234, 0),
  );

  const start = { x: game.x, y: game.y };
  for (const handling of ["standard", "rush", "fragile"] as const) {
    const quotes = COURIER_CONTRACTS
      .filter((contract) => contract.handling === handling)
      .map((contract) => courierDistanceQuote(contract, start))
      .sort((left, right) => left.totalDistance - right.totalDistance);
    assert.equal(quotes.length, 2);
    assert.ok(quotes[1].estimatedCash > quotes[0].estimatedCash);
    assert.ok(quotes[1].totalSeconds > quotes[0].totalSeconds);
  }

  const contract = courierContract("cold-crate");
  const quote = courierDistanceQuote(contract, start);
  assert.ok(quote.pickupDistance > 0);
  assert.equal(quote.totalDistance, quote.pickupDistance + quote.deliveryDistance);
  const before = game.timeLeft;
  const result = acceptCourierContract(game, contract.id);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") assert.fail("courier contract was not accepted");
  assert.equal(result.bonusSeconds, quote.approachSeconds);
  assert.equal(game.timeLeft, before + quote.approachSeconds);
  assert.equal(game.activeCourier?.approachDistance, quote.pickupDistance);
  assert.equal(game.activeCourier?.deliveryDistance, quote.deliveryDistance);
});

test("every courier stop resolves to the authored exterior portal", () => {
  const portals = new Map<string, { x: number; y: number; venue: VenueRef }>();
  for (let cy = -5; cy <= 5; cy += 1) {
    for (let cx = -5; cx <= 5; cx += 1) {
      for (const interaction of generateCityChunk(cx, cy).interactions) {
        if (interaction.kind === "venue-entrance") portals.set(interaction.venue.id, interaction);
      }
    }
  }
  for (const contract of COURIER_CONTRACTS) {
    assert.ok(
      Math.hypot(
        contract.destination.entrance.x - contract.origin.entrance.x,
        contract.destination.entrance.y - contract.origin.entrance.y,
      ) > COURIER_PICKUP_TAXI_RADIUS + COURIER_HANDOFF_TAXI_RADIUS,
      `${contract.id} must require moving the taxi between stops`,
    );
    for (const stop of [contract.origin, contract.destination]) {
      const portal = portals.get(stop.venue.id);
      assert.ok(portal, `${stop.venue.id} missing`);
      assert.deepEqual(portal.venue, stop.venue);
      assert.ok(Math.hypot(portal.x - stop.entrance.x, portal.y - stop.entrance.y) < 1e-8);
    }
  }
});

test("courier offers remain separate from passenger occupancy and availability", () => {
  const game = makeGame();
  game.onboard = true;
  game.message = "PASSENGER ABOARD";
  game.objectiveLockUntil = 4.25;
  const beforeBlocked = {
    onboard: game.onboard,
    availableFareMask: game.availableFareMask,
    jobIndex: game.jobIndex,
    message: game.message,
    objectiveLockUntil: game.objectiveLockUntil,
    timeLeft: game.timeLeft,
    lastBeep: game.lastBeep,
    availableCourierMask: game.availableCourierMask,
    activeCourier: game.activeCourier,
  };
  const blocked = acceptCourierContract(game, "paper-rush");
  assert.equal(blocked.status, "passenger-onboard");
  assert.deepEqual({
    onboard: game.onboard,
    availableFareMask: game.availableFareMask,
    jobIndex: game.jobIndex,
    message: game.message,
    objectiveLockUntil: game.objectiveLockUntil,
    timeLeft: game.timeLeft,
    lastBeep: game.lastBeep,
    availableCourierMask: game.availableCourierMask,
    activeCourier: game.activeCourier,
  }, beforeBlocked);
  assert.equal(game.availableCourierMask, ALL_COURIER_MASK);

  game.onboard = false;
  const passengerMask = game.availableFareMask;
  const accepted = acceptCourierContract(game, "paper-rush");
  assert.equal(accepted.status, "accepted");
  assert.equal(game.availableFareMask, passengerMask);
  assert.equal(farePickupMarkers(game).length, 0);
  assert.equal(courierMapMarkers(game).length, 1);
  assert.equal(courierMapMarkers(game)[0].active, true);
  assert.deepEqual(getObjective(game), courierContract("paper-rush").origin.entrance);
  assert.equal(getObjectiveKey(game), "courier:paper-rush:pickup");
  assert.match(getObjectiveLabel(game), /COURIER PICKUP/);
});

test("courier pickup and indoor handoff fire once at the correct counters", () => {
  const game = makeGame();
  const contract = courierContract("paper-rush");
  assert.equal(acceptCourierContract(game, contract.id).status, "accepted");

  const wrong = resolveCourierCounter(game, contract.destination.venue);
  assert.deepEqual(wrong, { type: "courier-blocked", reason: "wrong-venue" });
  assert.equal(game.activeCourier?.stage, "pickup");

  assert.deepEqual(resolveCourierCounter(game, contract.origin.venue), {
    type: "courier-blocked",
    reason: "pickup-taxi-too-far",
  });
  parkTaxi(game, contract.origin.entrance);
  const pickup = resolveCourierCounter(game, contract.origin.venue);
  assert.equal(pickup.type, "courier-pickup");
  assert.equal(game.activeCourier?.stage, "dropoff");
  assert.deepEqual(getObjective(game), contract.destination.entrance);
  assert.equal(getObjectiveKey(game), "courier:paper-rush:dropoff");

  const repeated = resolveCourierCounter(game, contract.origin.venue);
  assert.deepEqual(repeated, { type: "courier-blocked", reason: "wrong-venue" });
  const before = { score: game.score, fare: game.fare, time: game.timeLeft, deliveries: game.deliveries };
  game.elapsed += 14;
  assert.deepEqual(resolveCourierCounter(game, contract.destination.venue), { type: "courier-blocked", reason: "return-to-taxi" });
  markCourierLoadedInTaxi(game);
  assert.deepEqual(resolveCourierCounter(game, contract.destination.venue), { type: "courier-blocked", reason: "taxi-too-far" });
  parkTaxi(game, contract.destination.entrance);
  const dropoff = resolveCourierCounter(game, contract.destination.venue);
  assert.equal(dropoff.type, "courier-dropoff");
  assert.equal(game.activeCourier, null);
  assert.equal(game.deliveries, before.deliveries + 1);
  assert.equal(game.courierDeliveries, 1);
  assert.ok(game.score > before.score);
  assert.ok(game.fare > before.fare);
  assert.ok(game.timeLeft > before.time);
  assert.ok(farePickupMarkers(game).length > 0);
  assert.deepEqual(resolveCourierCounter(game, contract.destination.venue), { type: "courier-blocked", reason: "no-contract" });
});

test("a parcel loads exactly once when the courier re-enters the taxi", () => {
  const game = makeGame();
  const contract = courierContract("paper-rush");
  assert.equal(acceptCourierContract(game, contract.id).status, "accepted");
  parkTaxi(game, contract.origin.entrance);
  assert.equal(resolveCourierCounter(game, contract.origin.venue).type, "courier-pickup");
  game.player = {
    kind: "walking",
    actor: { x: game.x, y: game.y, vx: 0, vy: 0, heading: game.heading, speed: 0 },
    location: { kind: "city" },
  };
  game.interactionHeld = false;

  assert.deepEqual(
    stepExploration(game, { up: false, down: false, left: false, right: false, boost: false, interact: true }, 1 / 60, emptyWorld),
    [
      { type: "vehicle-entered" },
      { type: "courier-loaded", cargo: contract.cargo, destination: contract.destination.venue.label },
    ],
  );
  assert.equal(game.activeCourier?.loadedInTaxi, true);
  assert.equal(game.message, "PACKAGE LOADED!");
  stepExploration(game, { up: false, down: false, left: false, right: false, boost: false }, 1 / 60, emptyWorld);
  assert.deepEqual(
    stepExploration(game, { up: false, down: false, left: false, right: false, boost: false, interact: true }, 1 / 60, emptyWorld),
    [{ type: "vehicle-exited" }],
  );
  stepExploration(game, { up: false, down: false, left: false, right: false, boost: false }, 1 / 60, emptyWorld);
  assert.deepEqual(
    stepExploration(game, { up: false, down: false, left: false, right: false, boost: false, interact: true }, 1 / 60, emptyWorld),
    [{ type: "vehicle-entered" }],
  );
});

test("courier navigation replans immediately between exterior stages", () => {
  const game = makeGame();
  const contract = courierContract("paper-rush");
  const navigation = new NavigationController();
  assert.equal(acceptCourierContract(game, contract.id).status, "accepted");
  const pickupPlan = navigation.update(game);
  assert.deepEqual(pickupPlan.route.at(-1), { ...contract.origin.entrance, z: 0 });

  parkTaxi(game, contract.origin.entrance);
  resolveCourierCounter(game, contract.origin.venue);
  game.elapsed += 1 / 60;
  const dropoffPlan = navigation.update(game);
  assert.deepEqual(dropoffPlan.route.at(-1), { ...contract.destination.entrance, z: 0 });
});

test("handling and collision state affect courier rewards without duplicating cargo art", () => {
  const complete = (hadCollision: boolean) => {
    const game = makeGame();
    const contract = courierContract("paper-rush");
    acceptCourierContract(game, contract.id);
    parkTaxi(game, contract.origin.entrance);
    resolveCourierCounter(game, contract.origin.venue);
    game.elapsed += 12;
    assert.ok(game.activeCourier);
    game.activeCourier.hadCollision = hadCollision;
    markCourierLoadedInTaxi(game);
    parkTaxi(game, contract.destination.entrance);
    const event = resolveCourierCounter(game, contract.destination.venue);
    assert.equal(event.type, "courier-dropoff");
    return event.type === "courier-dropoff" ? event : null;
  };
  const clean = complete(false);
  const crashed = complete(true);
  assert.ok(clean && crashed);
  assert.ok(clean.scoreAward > crashed.scoreAward);
  assert.ok(clean.fareAward > crashed.fareAward);

  const carrying = makeGame();
  acceptCourierContract(carrying, "paper-rush");
  const carryingContract = courierContract("paper-rush");
  parkTaxi(carrying, carryingContract.origin.entrance);
  resolveCourierCounter(carrying, carryingContract.origin.venue);
  carrying.player = {
    kind: "walking",
    actor: { x: carrying.x, y: carrying.y, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "city" },
  };
  const baselineTaxi = taxiBoxes(makeGame()).length;
  assert.equal(taxiBoxes(carrying).length, baselineTaxi);
  const walkingCargoParts = playerAvatarBoxes(carrying).length;
  markCourierLoadedInTaxi(carrying);
  assert.equal(taxiBoxes(carrying).length, baselineTaxi + 2);
  const baselineWalker = makeGame();
  baselineWalker.player = {
    kind: "walking",
    actor: { x: baselineWalker.x, y: baselineWalker.y, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: { kind: "city" },
  };
  assert.equal(walkingCargoParts, playerAvatarBoxes(baselineWalker).length + 2);
  assert.equal(taxiBoxes(carrying).length, taxiBoxes(baselineWalker).length + 2);
  assert.equal(playerAvatarBoxes(carrying).length, playerAvatarBoxes(baselineWalker).length);
});

test("courier reward copy reports the meter time actually credited at the cap", () => {
  const game = makeGame();
  const contract = courierContract("paper-rush");
  acceptCourierContract(game, contract.id);
  parkTaxi(game, contract.origin.entrance);
  resolveCourierCounter(game, contract.origin.venue);
  markCourierLoadedInTaxi(game);
  parkTaxi(game, contract.destination.entrance);
  game.elapsed = 12;
  game.timeLeft = 98.4;
  const event = resolveCourierCounter(game, contract.destination.venue);
  assert.equal(event.type, "courier-dropoff");
  if (event.type !== "courier-dropoff") assert.fail("courier did not complete");
  assert.equal(event.bonusSeconds, 0.6);
  assert.equal(game.timeLeft, 99);
});

test("Free Run courier jobs keep route rewards but remove time and quick bonuses", () => {
  const game = makeGame("street-ace", 99, "free-run");
  const contract = courierContract("paper-rush");
  const quote = courierDistanceQuote(contract, game);
  const beforeTime = game.timeLeft;
  const accepted = acceptCourierContract(game, contract.id);
  assert.equal(accepted.status, "accepted");
  if (accepted.status !== "accepted") assert.fail("courier contract was not accepted");
  assert.equal(accepted.bonusSeconds, 0);
  assert.equal(game.timeLeft, beforeTime);

  parkTaxi(game, contract.origin.entrance);
  assert.equal(resolveCourierCounter(game, contract.origin.venue).type, "courier-pickup");
  markCourierLoadedInTaxi(game);
  parkTaxi(game, contract.destination.entrance);
  const event = resolveCourierCounter(game, contract.destination.venue);
  assert.equal(event.type, "courier-dropoff");
  if (event.type !== "courier-dropoff") assert.fail("courier did not complete");
  const expectedScore = Math.round((quote.baseScore + 200) * 1.5);
  assert.equal(event.scoreAward, expectedScore);
  assert.equal(event.fareAward, Math.max(18, Math.round(expectedScore / 42)));
  assert.equal(event.bonusSeconds, 0);
  assert.equal(game.timeLeft, beforeTime);
  assert.equal(game.courierDeliveries, 1);
});

test("courier service ticks pause the meter and use semantic interior counters", () => {
  const game = makeGame();
  const contract = courierContract("turbo-parts");
  assert.equal(acceptCourierContract(game, contract.id).status, "accepted");
  parkTaxi(game, contract.origin.entrance);
  enterVenue(game, contract.origin.venue);
  const room = interiorWorld(contract.origin.venue);
  const ids = room.interactions.map((interaction) => interaction.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(room.interactions.some((interaction) => interaction.kind === "courier-counter"));
  assert.ok(room.interactions.some((interaction) => interaction.kind === "service" && interaction.serviceId === "courier-board"));
  const counter = room.interactions.find((interaction) => interaction.kind === "courier-counter");
  assert.ok(counter);
  if (game.player.kind !== "walking") assert.fail("courier fixture did not enter walking state");
  game.player.actor.x = counter.x;
  game.player.actor.y = counter.y;
  const beforeTime = game.timeLeft;
  const events = stepGame(game, { up: false, down: false, left: false, right: false, boost: false, interact: true }, 1 / 60, emptyWorld, () => 1);
  assert.ok(events.some((event) => event.type === "courier-pickup"));
  assert.equal(game.timeLeft, beforeTime);
  assert.equal(game.activeCourier?.stage, "dropoff");
});
