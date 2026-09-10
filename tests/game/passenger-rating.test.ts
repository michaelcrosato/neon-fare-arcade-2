import assert from "node:assert/strict";
import test from "node:test";
import { passengerComment, passengerRating, passengerRatingParSeconds, passengerTip, type PassengerStars } from "../../game/passenger-rating";
import { FARE_RIDERS } from "../../game/passengers";
import { makeGame } from "../../game/state";
import { passengerDistanceQuote } from "../../game/fare-market";
import { stepGame } from "../../game/simulation";
import { FIXED_DT } from "../../game/config";
import { makeTestWorld, TEST_IDLE_INPUT } from "./support/fixtures";
import { destinationCardsForPlace } from "../../game/destination-cards";

test("time is the primary rating factor; collisions deduct one star", () => {
  for (const [seconds, expected] of [[1, 5], [100, 5], [100.01, 4], [135, 4], [135.01, 3], [180, 3], [180.01, 2], [240, 2], [241, 1]]) {
    assert.equal(passengerRating(seconds, 100, false), expected);
    assert.equal(passengerRating(seconds, 100, true), Math.max(1, expected - 1));
  }
  assert.equal(passengerTip(100, 5), 25);
  assert.equal(passengerTip(100, 4), 10);
  for (const stars of [1, 2, 3] as const) assert.equal(passengerTip(100, stars), 0);
  assert.equal(passengerRatingParSeconds(0), 11);
  assert.equal(passengerRatingParSeconds(1700), 106);
  assert.equal(passengerRating(100, passengerRatingParSeconds(1700), false), 5);
});

test("every passenger has a unique comment at every rating", () => {
  for (const stars of [1, 2, 3, 4, 5] as const) {
    const comments = FARE_RIDERS.map(rider => passengerComment(rider, stars));
    assert.equal(new Set(comments).size, FARE_RIDERS.length);
    assert.ok(comments.every(comment => !comment.includes("my next adventure")));
  }
});

test("a booked destination occasion replaces an unrelated legacy travel plan in passenger reviews", () => {
  const destinationCard = destinationCardsForPlace("pulse-stadium")[0];
  const job = { passengerArtCell: 5, destinationCard };
  for (const stars of [1, 2, 3, 4, 5] as const) {
    const comment = passengerComment(job, stars);
    assert.match(comment, /championship game/i);
    assert.doesNotMatch(comment, /vinyl digging/i);
  }
});

test("timed, arcade free run and simulation all award one tip and retain the departing rider", () => {
  for (const [runKind, drivingModel] of [["timed", "arcade"], ["free-run", "arcade"], ["free-run", "simulation"]] as const) {
    for (const [ratio, collision, stars] of [[0.5, false, 5], [0.5, true, 4], [1.5, false, 3], [2, false, 2], [3, true, 1]] as const) {
      const game = makeGame("street-ace", 321, runKind, drivingModel);
      const job = game.fareJobs[0];
      game.traffic = [];
      game.onboard = true;
      game.jobIndex = 0;
      game.x = job.dropoff.x;
      game.y = job.dropoff.y;
      game.z = job.dropoff.z ?? 0;
      game.elapsed = passengerRatingParSeconds(passengerDistanceQuote(job).routeDistance) * ratio;
      game.tripHadCollision = collision;
      const world = makeTestWorld();
      const events = Array.from({ length: 12 }, () => stepGame(game, TEST_IDLE_INPUT, FIXED_DT, world, () => 1)).flat();
      const event = events.find(e => e.type === "dropoff");
      assert.ok(event?.type === "dropoff");
      assert.equal(event.stars, stars);
      assert.equal(event.tip, passengerTip(event.fareAward - event.tip, stars as PassengerStars));
      assert.equal(game.fare, event.fareAward);
      assert.equal(game.passengerReview?.job.id, job.id);
      assert.equal(game.passengerReview?.comment, event.comment);
      assert.ok(game.passengerReview!.until > game.elapsed);
      assert.equal(events.filter(e => e.type === "dropoff").length, 1);
    }
  }
});
