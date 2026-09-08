import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCareerRunBonuses,
  makeCareerState,
  type CareerState,
} from "../../game/career";
import {
  BOOST_OVERDRIVE_BONUS_KMH,
  FIXED_DT,
  SPEED_KMH_PER_WORLD_UNIT,
} from "../../game/config";
import {
  GAS_TIME_PURCHASE_LIMIT,
  isTaxiNearGasStation,
  purchaseGasStationOffer,
  quoteGasTimePurchase,
} from "../../game/gas-station";
import type { Game, InputState, WorldView } from "../../game/model";
import { stepGame } from "../../game/simulation";
import { makeGame } from "../../game/state";

const EMPTY_WORLD: WorldView = { key: "gas-test", boxes: [], colliders: [], chunks: [], interactions: [] };
const IDLE: InputState = { up: false, down: false, left: false, right: false, boost: false };

function stationGame(): Game {
  const game = makeGame();
  game.x = 100;
  game.y = -70;
  game.player = {
    kind: "walking",
    actor: { x: 2.4, y: -3.7, vx: 0, vy: 0, heading: 0, speed: 0 },
    location: {
      kind: "interior",
      venue: { id: "gas-test", kind: "gas", label: "GO-GO GAS" },
      returnPose: { x: 106, y: -70, heading: 0 },
    },
  };
  return game;
}

function fundedCareer(bank = 500): CareerState {
  return { ...makeCareerState(), bank };
}

test("time fills quote exact, prorated top-offs without exceeding the run cap", () => {
  assert.deepEqual(quoteGasTimePurchase(40, 0), {
    status: "available",
    secondsAdded: 15,
    cost: 20,
  });
  assert.deepEqual(quoteGasTimePurchase(94, 1), {
    status: "available",
    secondsAdded: 5,
    cost: 7,
  });
  assert.deepEqual(quoteGasTimePurchase(98.95, 0), {
    status: "meter-full",
    secondsAdded: 0,
    cost: 0,
  });
  assert.deepEqual(quoteGasTimePurchase(20, GAS_TIME_PURCHASE_LIMIT), {
    status: "limit-reached",
    secondsAdded: 0,
    cost: 0,
  });
});

test("station transactions reject every invalid context without mutation", () => {
  const cases = [
    {
      status: "not-at-station",
      setup(game: Game) { game.player = { kind: "driving" }; },
    },
    {
      status: "passenger-onboard",
      setup(game: Game) { game.onboard = true; },
    },
    {
      status: "taxi-too-far",
      setup(game: Game) {
        if (game.player.kind === "walking" && game.player.location.kind === "interior") {
          game.player.location.returnPose.x = 150;
        }
      },
    },
  ] as const;
  for (const fixture of cases) {
    const game = stationGame();
    fixture.setup(game);
    const career = fundedCareer();
    const gameBefore = structuredClone(game);
    const careerBefore = structuredClone(career);
    const result = purchaseGasStationOffer(game, career, "time-splash");
    assert.equal(result.status, fixture.status);
    assert.deepEqual(game, gameBefore);
    assert.deepEqual(result.state, careerBefore);
    assert.equal(result.state, career);
  }

  const poorGame = stationGame();
  const poorCareer = fundedCareer(5);
  const poorBefore = structuredClone(poorGame);
  const poorResult = purchaseGasStationOffer(poorGame, poorCareer, "time-splash");
  assert.equal(poorResult.status, "insufficient");
  assert.equal(poorResult.cost, 20);
  assert.deepEqual(poorGame, poorBefore);
  assert.equal(poorResult.state, poorCareer);
});

test("two time fills debit banked fare, reset warnings, and stop at the shift limit", () => {
  const game = stationGame();
  game.timeLeft = 70;
  game.fare = 86;
  game.lastBeep = 4;
  let career = fundedCareer(100);
  assert.equal(isTaxiNearGasStation(game), true);

  const first = purchaseGasStationOffer(game, career, "time-splash");
  assert.equal(first.status, "purchased");
  assert.equal(first.secondsAdded, 15);
  assert.equal(first.cost, 20);
  assert.equal(game.timeLeft, 85);
  assert.equal(game.gasTimePurchases, 1);
  assert.equal(game.lastBeep, 11);
  assert.equal(first.state.bank, 80);
  career = first.state;

  game.timeLeft = 94;
  const second = purchaseGasStationOffer(game, career, "time-splash");
  assert.equal(second.status, "purchased");
  assert.equal(second.secondsAdded, 5);
  assert.equal(second.cost, 7);
  assert.equal(game.timeLeft, 99);
  assert.equal(game.gasTimePurchases, 2);
  assert.equal(second.state.bank, 73);
  assert.equal(game.fare, 86, "the station never spends this run's unbanked fare");

  const gameBefore = structuredClone(game);
  const third = purchaseGasStationOffer(game, second.state, "time-splash");
  assert.equal(third.status, "limit-reached");
  assert.deepEqual(game, gameBefore);
  assert.equal(third.state, second.state);
});

test("permanent station upgrades install once now and on every future run", () => {
  const game = stationGame();
  const career = fundedCareer();
  const purchase = purchaseGasStationOffer(game, career, "boost-cooler");
  assert.equal(purchase.status, "purchased");
  assert.equal(purchase.state.bank, 320);
  assert.deepEqual(purchase.state.owned, ["boost-cooler"]);
  assert.deepEqual(game.installedUpgrades, ["boost-cooler"]);

  const repeat = purchaseGasStationOffer(game, purchase.state, "boost-cooler");
  assert.equal(repeat.status, "owned");
  assert.equal(repeat.state, purchase.state);
  assert.deepEqual(game.installedUpgrades, ["boost-cooler"]);

  const fresh = makeGame();
  applyCareerRunBonuses(fresh, purchase.state);
  assert.deepEqual(fresh.installedUpgrades, ["boost-cooler"]);
  assert.equal(fresh.gasTimePurchases, 0);
});

test("Boost Overdrive purchases once, activates now, and persists into future runs", () => {
  const game = stationGame();
  const career = fundedCareer();
  const purchase = purchaseGasStationOffer(game, career, "boost-overdrive");
  assert.equal(purchase.status, "purchased");
  assert.equal(purchase.cost, 260);
  assert.equal(purchase.state.bank, 240);
  assert.deepEqual(purchase.state.owned, ["boost-overdrive"]);
  assert.deepEqual(game.installedUpgrades, ["boost-overdrive"]);

  const repeat = purchaseGasStationOffer(game, purchase.state, "boost-overdrive");
  assert.equal(repeat.status, "owned");
  assert.equal(repeat.state, purchase.state);
  assert.deepEqual(game.installedUpgrades, ["boost-overdrive"]);

  const fresh = makeGame();
  applyCareerRunBonuses(fresh, purchase.state);
  assert.deepEqual(fresh.installedUpgrades, ["boost-overdrive"]);
});

test("Free Run rejects clock purchases without blocking permanent upgrades", () => {
  const game = stationGame();
  game.runKind = "free-run";
  const career = fundedCareer();
  const gameBefore = structuredClone(game);
  const timePurchase = purchaseGasStationOffer(game, career, "time-splash");
  assert.equal(timePurchase.status, "timer-disabled");
  assert.equal(timePurchase.state, career);
  assert.deepEqual(game, gameBefore);

  const upgrade = purchaseGasStationOffer(game, career, "boost-cooler");
  assert.equal(upgrade.status, "purchased");
  assert.deepEqual(game.installedUpgrades, ["boost-cooler"]);
});

test("named gas upgrades change only their advertised simulation effects", () => {
  const boostInput: InputState = { ...IDLE, up: true, boost: true };
  const baseline = makeGame();
  const cooled = makeGame();
  baseline.traffic = [];
  cooled.traffic = [];
  cooled.installedUpgrades = ["boost-cooler"];
  for (let tick = 0; tick < 60; tick += 1) {
    stepGame(baseline, boostInput, FIXED_DT, EMPTY_WORLD, () => 1);
    stepGame(cooled, boostInput, FIXED_DT, EMPTY_WORLD, () => 1);
  }
  assert.equal(baseline.boost, 20);
  assert.ok(Math.abs(cooled.boost - 23) < 1e-9);
  assert.equal(cooled.speed, baseline.speed);
  assert.equal(cooled.y, baseline.y);

  const dirt = makeGame();
  const rally = makeGame();
  for (const game of [dirt, rally]) {
    game.traffic = [];
    game.x = 18;
    game.y = 18;
    game.heading = 0;
    game.vx = 12;
  }
  rally.installedUpgrades = ["rally-tires"];
  stepGame(dirt, IDLE, FIXED_DT, EMPTY_WORLD, () => 1);
  stepGame(rally, IDLE, FIXED_DT, EMPTY_WORLD, () => 1);
  assert.ok(rally.vx > dirt.vx);
  assert.equal(rally.x, dirt.x);

  const wall: WorldView = {
    ...EMPTY_WORLD,
    key: "impact-wall",
    colliders: [{ id: "wall", x: 5, y: 0, halfX: 5, halfY: 20, height: 8 }],
  };
  const plainImpact = makeGame();
  const barredImpact = makeGame();
  for (const game of [plainImpact, barredImpact]) {
    game.traffic = [];
    game.x = -2.5;
    game.y = 0;
    game.heading = 0;
    game.vx = 24;
    game.boost = 50;
  }
  barredImpact.installedUpgrades = ["impact-bars"];
  assert.deepEqual(stepGame(plainImpact, IDLE, FIXED_DT, wall, () => 1), [{ type: "building-collision" }]);
  assert.deepEqual(stepGame(barredImpact, IDLE, FIXED_DT, wall, () => 1), [{ type: "building-collision" }]);
  assert.equal(plainImpact.boost, 40);
  assert.equal(barredImpact.boost, 45);
  assert.equal(barredImpact.score, plainImpact.score);
  assert.equal(barredImpact.collisions, plainImpact.collisions);

  const stockBoost = makeGame();
  const overdriveBoost = makeGame();
  for (const game of [stockBoost, overdriveBoost]) {
    game.traffic = [];
    game.x = 0;
    game.y = 0;
    game.heading = 0;
    game.vx = 20;
    game.vy = 0;
    game.boost = 100;
  }
  overdriveBoost.installedUpgrades = ["boost-overdrive"];
  stepGame(stockBoost, boostInput, FIXED_DT, EMPTY_WORLD, () => 1);
  stepGame(overdriveBoost, boostInput, FIXED_DT, EMPTY_WORLD, () => 1);
  assert.equal(overdriveBoost.speed, stockBoost.speed, "overdrive must not change boost acceleration below the cap");
  assert.equal(overdriveBoost.boost, stockBoost.boost, "overdrive must not change boost drain");
  assert.equal(BOOST_OVERDRIVE_BONUS_KMH, 60);
  assert.ok(overdriveBoost.speed * SPEED_KMH_PER_WORLD_UNIT < 160);
});
