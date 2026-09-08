import { makeCareerState, type CareerState } from "../../../game/career";
import type { InputState, Job, WorldView } from "../../../game/model";

export const TEST_IDLE_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

export function makeTestWorld(overrides: Partial<WorldView> = {}): WorldView {
  return {
    key: "test-world",
    boxes: [],
    chunks: [],
    colliders: [],
    interactions: [],
    ...overrides,
  };
}

export function makeTestJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "test-fare",
    rider: "TEST RIDER",
    passengerArtCell: 0,
    destinationArtCell: 0,
    pickupStopId: "test-pickup",
    pickup: { x: 4.5, y: -12 },
    pickupApproach: { x: 4.5, y: -12 },
    dropoffStopId: "test-dropoff",
    dropoff: { x: -72, y: 126 },
    dropoffApproach: { x: -72, y: 126 },
    destination: "TEST DESTINATION",
    regionalTransfer: null,
    ...overrides,
  };
}

export function makeTestCareer(overrides: Partial<CareerState> = {}): CareerState {
  return {
    ...makeCareerState(),
    ...overrides,
  };
}
