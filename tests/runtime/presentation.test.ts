import assert from "node:assert/strict";
import test from "node:test";
import { presentSimulationEvents, type SimulationEventPresentation } from "../../app/runtime/present-simulation-events";
import type { DrivingModel, FareImpact, Modal, RunKind } from "../../game/model";
import { makeGame } from "../../game/state";

test("Simulation pickup cards and announcements never promise arcade boost", () => {
  for (const drivingModel of ["arcade", "simulation"] satisfies DrivingModel[]) {
    const game = makeGame("street-ace", 511, "free-run", drivingModel);
    const announcements: string[] = [];
    const cards: Omit<FareImpact, "id">[] = [];
    const presentation: SimulationEventPresentation = {
      game: () => game,
      announce: (message) => { announcements.push(message); },
      triggerFareImpact: (card) => { cards.push(card); },
      tone() {}, warmPassengerArt() {}, triggerCourierImpact() {},
      setHomeNotice() {}, setCourierNotice() {}, setGasNotice() {}, setHud() {}, openModal() {},
      schedule: (callback) => callback(),
    };
    const before = structuredClone(game);
    presentSimulationEvents([{
      type: "pickup", fareId: "rico", fareNumber: 1, artCell: 0, rider: "RICO",
      destination: "MARINA ARCADE", bonusSeconds: 0, runKind: "free-run",
    }], presentation);
    assert.equal(cards.length, 1);
    assert.equal(announcements.length, 1);
    if (drivingModel === "simulation") {
      assert.doesNotMatch(cards[0].detail, /boost/i);
      assert.doesNotMatch(announcements[0], /boost/i);
    } else {
      assert.equal(cards[0].detail, "+8 BOOST · FREE RUN");
      assert.match(announcements[0], /Eight boost added/);
    }
    assert.deepEqual(game, before, "presentation must not change the game");
  }
});

test("gas counter opens repair access even while a passenger is onboard", () => {
  for (const runKind of ["free-run", "timed"] satisfies RunKind[]) {
    const game = makeGame("street-ace", 512, runKind);
    game.onboard = true;
    const opened: Modal[] = [];
    const announcements: string[] = [];
    const before = structuredClone(game);
    presentSimulationEvents([{
      type: "service-used", serviceId: "gas-counter",
      venue: { id: "gas-test", kind: "gas", label: "GO-GO GAS" },
    }], {
      game: () => game,
      announce: (message) => { announcements.push(message); },
      openModal: (modal) => { opened.push(modal); },
      tone() {}, warmPassengerArt() {}, triggerFareImpact() {}, triggerCourierImpact() {},
      setHomeNotice() {}, setCourierNotice() {}, setGasNotice() {}, setHud() {},
    });
    assert.deepEqual(opened, ["gas"]);
    assert.match(announcements[0], /repairs use run fare/i);
    assert.deepEqual(game, before, "opening the counter must not change fare, passenger, or clock");
  }
});
