import assert from "node:assert/strict";
import test from "node:test";
import { FIXED_DT, SPEED_KMH_PER_WORLD_UNIT } from "../../game/config";
import type { Game, InputState, VehicleId, SimulationGear } from "../../game/model";
import { makeGame } from "../../game/state";
import { stepGame } from "../../game/simulation";
import { accordCoupledRpm, accordEngineIndicators, clutchConnected, stepManualTransmission } from "../../game/manual-transmission";
import { ACCORD_V6_SPECS, CROWN_TAXI_SPECS, stepSimulationVehicle } from "../../game/simulation-vehicle";
import { taxiBoxes } from "../../game/render/scene";
import { makeTestWorld } from "./support/fixtures";

const IDLE: InputState = { up: false, down: false, left: false, right: false, boost: false };
const WORLD = makeTestWorld();

test("Accord shift and VTEC lights follow revs, load and clutch engagement", () => {
  assert.deepEqual(accordEngineIndicators(4_800, true, 2, true), { shift: false, vtec: false });
  assert.deepEqual(accordEngineIndicators(5_300, true, 2, true), { shift: false, vtec: true });
  assert.deepEqual(accordEngineIndicators(6_300, true, 2, true), { shift: true, vtec: true });
  assert.deepEqual(accordEngineIndicators(6_300, false, 2, true), { shift: true, vtec: false });
  for (const gear of [-1, 0, 2] as const) assert.deepEqual(accordEngineIndicators(6_300, true, gear, false), { shift: false, vtec: false });
  assert.equal(accordEngineIndicators(6_300, true, 6, true).shift, false, "sixth has no upshift available");
});

test("manual Accord gearing limits first and second, rewards downshifts, and cannot be bypassed by boost", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const run = (gear: SimulationGear, kmh: number, seconds: number, boost = false) => {
      const game = makeGame("street-ace", 91, "free-run", model, "accord-v6", "manual");
      game.traffic = []; game.heading = 0; game.vx = kmh / SPEED_KMH_PER_WORLD_UNIT; game.speed = game.vx;
      game.transmission.gear = gear;
      for (let tick = 0; tick < seconds / FIXED_DT; tick++) {
        if (model === "simulation") stepSimulationVehicle(game, { ...IDLE, up: true, boost: false }, FIXED_DT, true);
        else arcadeStep(game, { up: true, boost });
      }
      return game.speed * SPEED_KMH_PER_WORLD_UNIT;
    };
    const first = run(1, 0, 12), second = run(2, 50, 12);
    assert.ok(first > 58 && first < 61.5, `${model}: first redline ${first}`);
    assert.ok(second > 96 && second < 98, `${model}: second redline ${second}`);
    assert.ok(run(2, 50, 2) - 50 > (run(5, 50, 2) - 50) * 2, `${model}: passing needs a downshift`);
    assert.ok(run(1, 0, 2) < 36, `${model}: realistic launch instead of arcade catapult`);
    assert.ok(run(6, 0, 2) < 10, `${model}: sixth cannot launch like first`);
    assert.equal(run(0, 0, 2), 0, `${model}: neutral cannot propel`);
    if (model === "arcade") assert.ok(run(1, 0, 12, true) < 61.5, "boost respects first-gear redline");
  }
});

test("shifting the manual Accord through its power band gives a plausible 0–60 mph launch", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 91, "free-run", model, "accord-v6", "manual");
    game.traffic = []; game.heading = 0;
    let elapsed = 0, shifting = 0;
    while (elapsed < 12 && game.speed * SPEED_KMH_PER_WORLD_UNIT < 96.56064) {
      if (!shifting && accordCoupledRpm(game.speed * SPEED_KMH_PER_WORLD_UNIT / 3.6, game.transmission.gear) > 6_300) shifting = 15;
      const input = { ...IDLE, up: shifting === 0, clutch: shifting > 1 || game.transmission.stuck && Math.round(elapsed / FIXED_DT) % 2 === 0, shiftUp: shifting === 10 };
      if (model === "simulation") stepSimulationVehicle(game, input, FIXED_DT, true);
      else arcadeStep(game, input);
      shifting = Math.max(0, shifting - 1);
      elapsed += FIXED_DT;
    }
    assert.ok(elapsed > 6 && elapsed < 9, `${model}: 0–60 mph in ${elapsed.toFixed(2)} s`);
    assert.ok(game.transmission.gear >= 2, "launch requires shifting out of first");
  }
});
function clutch(game: Game, pressed: boolean, input: Partial<InputState> = {}) {
  stepManualTransmission(game, { ...IDLE, clutch: pressed, ...input }, FIXED_DT);
}
function arcadeStep(game: Game, input: Partial<InputState>) {
  // Isolate chassis behavior on one flat paved sample.
  game.x = 0; game.y = 0;
  stepGame(game, { ...IDLE, ...input }, FIXED_DT, WORLD, () => 1);
}
function slide(vehicleId: VehicleId, runKind: "timed" | "free-run" = "free-run") {
  const game = makeGame("street-ace", 91, runKind, "arcade", vehicleId);
  game.traffic = []; game.heading = 0; game.vx = 40; game.vy = 0; game.speed = 40;
  for (let t = 0; t < 24; t++) arcadeStep(game, { up: true, right: true });
  return game;
}

test("vehicle and transmission selections are isolated per run and default to automatic", () => {
  for (const model of ["arcade", "simulation"] as const) {
    assert.equal(makeGame("street-ace", 91, "free-run", model, "accord-v6").transmissionMode, "automatic");
    assert.equal(makeGame("street-ace", 91, "free-run", model, "accord-v6", "manual").transmissionMode, "manual");
  }
  const defaultCab = makeGame();
  assert.equal(defaultCab.vehicleId, "crown-cab");
  assert.equal(makeGame("street-ace", 91, "free-run", "arcade", "crown-cab", "manual").transmissionMode, "automatic");
  assert.equal(defaultCab.transmission.engagements, 0);
  assert.ok(ACCORD_V6_SPECS.massKg < CROWN_TAXI_SPECS.massKg);
  assert.ok(ACCORD_V6_SPECS.roadFriction < CROWN_TAXI_SPECS.roadFriction);
});

test("manual gears require the clutch, reject unsafe reverse and over-rev, and include all six ratios", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 91, "free-run", model, "accord-v6", "manual");
    clutch(game, false, { shiftUp: true });
    assert.equal(game.transmission.gear, 1);
    clutch(game, true);
    for (let gear = 2; gear <= 6; gear++) {
      clutch(game, true, { shiftUp: true });
      assert.equal(game.transmission.gear, gear);
      for (let t = 0; t < 20; t++) clutch(game, true, { shiftUp: true });
      assert.equal(game.transmission.gear, gear, "a held shift never repeats");
      clutch(game, true);
    }
    game.heading = 0; game.vx = 180 / SPEED_KMH_PER_WORLD_UNIT; game.transmission.gear = 3;
    clutch(game, true, { shiftDown: true });
    assert.equal(game.transmission.gear, 3, "second would over-rev at 180 km/h");
    clutch(game, true);
    game.transmission.gear = 0;
    clutch(game, true, { shiftDown: true });
    assert.equal(game.transmission.gear, 0, "reverse is locked out while moving");
    clutch(game, true); game.vx = 0; game.vy = 0;
    clutch(game, true, { shiftDown: true });
    assert.equal(game.transmission.gear, -1);
  }
});

test("clutch failure is deterministic at about 5% per engagement and takes three complete pumps", () => {
  const a = makeGame("street-ace", 918, "free-run", "simulation", "accord-v6", "manual");
  const b = structuredClone(a);
  let faults = 0;
  for (let attempt = 0; attempt < 10_000; attempt++) {
    for (const game of [a, b]) {
      clutch(game, true); clutch(game, false);
    }
    assert.deepEqual(a.transmission, b.transmission);
    if (!a.transmission.stuck) continue;
    faults++;
    assert.equal(a.transmission.pumpsRemaining, 3);
    assert.equal(clutchConnected(a), false);
    const attempts = a.transmission.engagements;
    for (let pump = 0; pump < 3; pump++) for (const game of [a, b]) {
      for (let t = 0; t < 12; t++) clutch(game, true);
      assert.equal(game.transmission.pumpsRemaining, 3 - pump, "holding does not pump");
      clutch(game, false);
      assert.equal(game.transmission.stuck, pump < 2);
    }
    assert.equal(a.transmission.engagements, attempts, "recovery does not reroll the fault");
    assert.equal(clutchConnected(a), true);
  }
  assert.ok(faults > 430 && faults < 570, `faults: ${faults}/10000`);
});

test("a stuck clutch removes propulsion and boost in both models without removing the brakes", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 91, "free-run", model, "accord-v6");
    game.heading = 0; game.vx = 20; game.speed = 20; game.transmission.stuck = true; game.transmission.pumpsRemaining = 3; game.traffic = [];
    const coast = structuredClone(game), braking = structuredClone(game);
    for (let t = 0; t < 30; t++) {
      stepGame(game, { ...IDLE, up: true, boost: true }, FIXED_DT, WORLD, () => 1);
      stepGame(coast, IDLE, FIXED_DT, WORLD, () => 1);
      stepGame(braking, { ...IDLE, down: true }, FIXED_DT, WORLD, () => 1);
    }
    assert.ok(game.speed <= coast.speed + 0.01);
    assert.equal(game.boosting, false);
    assert.ok(braking.speed < coast.speed);
  }
});

test("automatic reverse waits for engagement; a stuck clutch still allows braking a backward roll", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const game = makeGame("street-ace", 91, "free-run", model, "accord-v6");
    game.traffic = []; game.heading = 0;
    for (let t = 0; t < 12; t++) arcadeStep(game, { down: true });
    assert.equal(game.transmission.gear, 1);
    assert.ok(game.speed < 0.01);
    for (let t = 0; t < 60; t++) arcadeStep(game, { down: true });
    assert.equal(game.transmission.gear, -1);
    assert.ok(game.vx < -0.5);
    game.transmission.stuck = true; game.transmission.pumpsRemaining = 3;
    const before = game.speed;
    for (let t = 0; t < 30; t++) arcadeStep(game, { down: true });
    assert.ok(game.speed < before * 0.5);
  }
});

test("automatic light-throttle upshifts do not hunt between adjacent gears", () => {
  const game = makeGame("street-ace", 91, "free-run", "simulation", "accord-v6");
  game.heading = 0;
  game.vx = 3_650 / accordCoupledRpm(SPEED_KMH_PER_WORLD_UNIT / 3.6, 1);
  for (let t = 0; t < 120; t++) stepManualTransmission(game, IDLE, FIXED_DT);
  assert.equal(game.transmission.gear, 2);
  assert.equal(game.transmission.engagements, 1);
});

test("the lighter FWD coupe has faster simulation acceleration and automatic use of all six gears", () => {
  const results = ["crown-cab", "accord-v6"].map(id => {
    const game = makeGame("street-ace", 91, "free-run", "simulation", id as VehicleId);
    let timeTo60 = 0;
    const gears = new Set<number>();
    for (let t = 0; t < 3600; t++) {
      // Driver completes real pumps whenever this seed sticks the clutch.
      const clutchDown = game.transmission.stuck && t % 2 === 0;
      stepSimulationVehicle(game, { ...IDLE, up: true, clutch: clutchDown }, FIXED_DT, true);
      gears.add(game.simulationVehicle.gear);
      if (!timeTo60 && game.speed * SPEED_KMH_PER_WORLD_UNIT >= 96.56064) timeTo60 = t * FIXED_DT;
    }
    return { timeTo60, gears, speed: game.speed * SPEED_KMH_PER_WORLD_UNIT };
  });
  assert.ok(results[0].timeTo60 > 10 && results[0].timeTo60 < 11.6);
  assert.ok(results[1].timeTo60 > 6.5 && results[1].timeTo60 < 8.5);
  assert.deepEqual([...results[1].gears], [1, 2, 3, 4, 5, 6]);
  assert.ok(results[1].speed > results[0].speed + 20);
});

test("RWD power slides are wider than FWD and arcade fishtailing rebounds before settling in either run kind", () => {
  for (const kind of ["timed", "free-run"] as const) {
    const crown = slide("crown-cab", kind), accord = slide("accord-v6", kind);
    assert.ok(Math.abs(crown.driftAngle) > 0.4, "Crown holds over 23 degrees");
    assert.ok(Math.abs(crown.driftAngle) > Math.abs(accord.driftAngle) * 1.4);
    const counter = structuredClone(crown);
    let rebound = 0, secondSwing = 0;
    for (let t = 0; t < 120; t++) {
      arcadeStep(crown, { up: true });
      if (t < 35) rebound = Math.max(rebound, crown.driftAngle);
      if (t > 35 && t < 60) secondSwing = Math.min(secondSwing, crown.driftAngle);
      if (t < 16) arcadeStep(counter, { up: true, left: true });
    }
    assert.ok(rebound > 0.04, `opposite tail rebound ${rebound}`);
    assert.ok(secondSwing < -0.02, `second tail swing ${secondSwing}`);
    assert.ok(Math.abs(crown.driftAngle) < 0.01, "eventually settles");
    assert.ok(Math.abs(counter.driftAngle) < 0.2, "early countersteering still catches the initial slide");
  }
});

test("both renderer paths receive distinct finite coupe geometry inside the 96-instance ghost budget", () => {
  for (const model of ["arcade", "simulation"] as const) {
    const accord = makeGame("street-ace", 91, "free-run", model, "accord-v6");
    const crown = makeGame("street-ace", 91, "free-run", model, "crown-cab");
    const boxes = taxiBoxes(accord);
    assert.notDeepEqual(boxes, taxiBoxes(crown));
    assert.ok(boxes.length < 96);
    for (const box of boxes) for (const value of [box.x, box.y, box.z, box.sx, box.sy, box.sz]) assert.ok(Number.isFinite(value));
    accord.simulationVehicle.bodyRoll = Math.PI / 2;
    assert.ok(taxiBoxes(accord).every(box => Number.isFinite(box.z)));
  }
});
