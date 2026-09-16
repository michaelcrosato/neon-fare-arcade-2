import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { beginAccordTrip, stepAccordEvents, QUANTUM_FACTS } from "../../game/accord-events";
import { bankCareerRun, makeCareerState } from "../../game/career";
import { makeWalkingActor, taxiPose } from "../../game/player";
import { FARE_RIDERS } from "../../game/passengers";
import { PASSENGER_QUANTUM_RESPONSES } from "../../game/passenger-quantum-responses";

test("only the Accord starts each run with financed winter tires", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const accord = makeGame("street-ace", 91, "free-run", model, "accord-v6");
    assert.equal(accord.fare, -1000);
    assert.equal(makeGame("street-ace", 91, "free-run", model, "crown-cab").fare, 0);
    assert.equal(makeGame("street-ace", 91, "free-run", model, "gtr-r35").fare, 0);
    assert.equal(bankCareerRun(makeCareerState(), accord).bank, 0, "unfinished run debt cannot subtract from the career bank");
    accord.fare = 0;
    assert.equal(stepAccordEvents(accord), null, "zero is not yet a positive balance");
    accord.fare = 1;
    assert.equal(stepAccordEvents(accord)?.kind, "tires-paid");
    accord.fare = -50;
    stepAccordEvents(accord);
    accord.fare = 100;
    assert.equal(stepAccordEvents(accord), null, "payoff celebrates only once per run");
  }
});

test("quantum conversation appears halfway along the passenger route once per trip", () => {
  const game = makeGame("street-ace", 91, "free-run", "arcade", "accord-v6");
  const job = game.fareJobs[0];
  game.onboard = true;
  beginAccordTrip(game, job);
  // A straight fixture isolates progress from the real road routing (which is tested separately).
  game.accordTrip!.route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  game.accordTrip!.length = 100;
  game.elapsed = 4;
  game.x = 49; game.y = 0; game.z = 0;
  assert.equal(stepAccordEvents(game), null);
  game.x = -70;
  assert.equal(stepAccordEvents(game), null, "driving away does not count as halfway");
  game.x = 55; game.y = 80;
  assert.equal(stepAccordEvents(game), null, "a distant parallel street does not project onto the route");
  game.y = 0;
  const replay = structuredClone(game);
  const card = stepAccordEvents(game);
  assert.equal(card?.kind, "quantum");
  assert.deepEqual(stepAccordEvents(replay), card, "fact and response are deterministic");
  assert.equal(stepAccordEvents(game), null);
  game.onboard = false;
  assert.equal(stepAccordEvents(game), null);
  game.onboard = true;
  game.jobStartedAt = 10;
  game.elapsed = 14;
  beginAccordTrip(game, job);
  game.accordTrip!.route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  game.accordTrip!.length = 100;
  assert.equal(stepAccordEvents(game)?.kind, "quantum", "another trip can have another conversation");
  assert.ok(QUANTUM_FACTS.length >= 8);
});

test("empty cars, other vehicles, couriers and walking never start a quantum conversation", () => {
  for (const vehicle of ["crown-cab", "gtr-r35", "accord-v6"] as const) {
    const game = makeGame("street-ace", 93, "free-run", "arcade", vehicle);
    game.fare = -1;
    beginAccordTrip(game, game.fareJobs[0]);
    if (game.accordTrip) {
      game.accordTrip.route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      game.accordTrip.length = 100;
    }
    game.elapsed = 4;
    game.x = 55; game.y = 0; game.z = 0;
    assert.equal(stepAccordEvents(game), null);
    game.onboard = true;
    if (vehicle !== "accord-v6") { assert.equal(stepAccordEvents(game), null); continue; }
    game.player = { kind: "walking", actor: makeWalkingActor(taxiPose(game)), location: { kind: "city" } };
    assert.equal(stepAccordEvents(game), null, "walking past the halfway point does not interrupt exploration");
    game.player = { kind: "driving" };
    game.activeCourier = { contractId: "paper-rush", stage: "dropoff", acceptedAt: 0, pickedUpAt: 1,
      approachDistance: 0, deliveryDistance: 100, hadCollision: false, loadedInTaxi: true };
    assert.equal(stepAccordEvents(game), null, "cargo is not a conversation partner");
    game.activeCourier = null;
    assert.equal(stepAccordEvents(game)?.kind, "quantum", "suppression leaves the passenger's conversation available");
  }
});

test("every passenger has exactly three distinct, individually authored quantum replies", () => {
  assert.deepEqual(Object.keys(PASSENGER_QUANTUM_RESPONSES).sort(), FARE_RIDERS.map(rider => rider.id).sort());
  const all = FARE_RIDERS.flatMap(rider => {
    const replies = PASSENGER_QUANTUM_RESPONSES[rider.id];
    assert.equal(replies.length, 3, rider.id);
    for (const reply of replies) {
      assert.ok(reply.trim().length > 15 && reply.length <= 190, `${rider.id}: readable reply length`);
    }
    return [...replies];
  });
  assert.equal(new Set(all).size, FARE_RIDERS.length * 3, "no passenger borrows another passenger's line");
});

test("each passenger cycles through all three replies when visits are six trips apart", () => {
  const game = makeGame("street-ace", 91, "free-run", "arcade", "accord-v6");
  game.onboard = true;
  game.elapsed = 4;
  game.x = 55; game.y = 0; game.z = 0;
  const job = game.fareJobs[0];
  for (const rider of FARE_RIDERS) {
    Object.assign(job, rider);
    const replies: string[] = [];
    for (let visit = 0; visit < 4; visit++) {
      beginAccordTrip(game, job);
      game.accordTrip!.route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      game.accordTrip!.length = 100;
      game.accordTrip!.sequence += 5; // beginAccordTrip already advances once: six trips total.
      const replay = structuredClone(game);
      const card = stepAccordEvents(game);
      assert.equal(card?.kind, "quantum");
      if (card?.kind !== "quantum") throw new Error("Missing conversation");
      assert.equal(card.rider, rider.rider);
      assert.equal(card.artCell, rider.passengerArtCell);
      assert.ok(PASSENGER_QUANTUM_RESPONSES[rider.id].includes(card.response), rider.id);
      assert.deepEqual(stepAccordEvents(replay), card, "replay retains the same passenger voice and rotation");
      assert.equal(stepAccordEvents(game), null, "repeated ticks cannot consume another reply");
      replies.push(card.response);
    }
    assert.equal(new Set(replies.slice(0, 3)).size, 3, rider.id);
    assert.equal(replies[3], replies[0], "a fourth conversation wraps this passenger's own deck");
  }
});

test("the expanded lesson deck reaches every lesson before repeating", () => {
  assert.equal(QUANTUM_FACTS.length, 48);
  assert.equal(new Set(QUANTUM_FACTS.map(fact => fact.title)).size, QUANTUM_FACTS.length);
  const game = makeGame("street-ace", 4294967295, "free-run", "arcade", "accord-v6");
  game.onboard = true;
  game.elapsed = 4;
  game.x = 55; game.y = 0; game.z = 0;
  const indices: number[] = [];
  for (let trip = 0; trip <= QUANTUM_FACTS.length; trip++) {
    beginAccordTrip(game, game.fareJobs[0]);
    game.accordTrip!.route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    game.accordTrip!.length = 100;
    const card = stepAccordEvents(game);
    if (card?.kind !== "quantum") throw new Error("Missing lesson");
    const fact = QUANTUM_FACTS[card.factIndex];
    assert.ok(fact.title && fact.level && fact.symbol && fact.aside);
    assert.ok(fact.text.length >= 100 && fact.text.length <= 440, fact.title);
    indices.push(card.factIndex);
  }
  assert.equal(new Set(indices.slice(0, -1)).size, QUANTUM_FACTS.length);
  assert.equal(indices[0], indices.at(-1));
});
