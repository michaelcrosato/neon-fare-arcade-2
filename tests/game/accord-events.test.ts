import assert from "node:assert/strict";
import test from "node:test";
import { makeGame } from "../../game/state";
import { beginAccordTrip, stepAccordEvents, QUANTUM_FACTS } from "../../game/accord-events";
import { bankCareerRun, makeCareerState } from "../../game/career";
import { makeWalkingActor, taxiPose } from "../../game/player";

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
