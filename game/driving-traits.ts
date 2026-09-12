import type { DrivingTraitId } from "./model";
import {
  REDLINE_TAXI_FORWARD_SPEED_WORLD_UNITS,
  STANDARD_TAXI_FORWARD_SPEED_WORLD_UNITS,
  TAXI_BOOST_SPEED_MULTIPLIER,
} from "./config";

export type DrivingTraitModifiers = {
  throttleMultiplier: number;
  brakingMultiplier: number;
  boostAccelerationMultiplier: number;
  boostDrainMultiplier: number;
  steeringMultiplier: number;
  driftSteeringMultiplier: number;
  roadGripMultiplier: number;
  driftGripMultiplier: number;
  steeringReferenceSpeed: number;
  maxForwardSpeed: number;
  maxBoostSpeed: number;
  driftBoostGainMultiplier: number;
  driftScoreMultiplier: number;
  initialBoost: number;
};

export type DrivingTraitPackage = {
  id: DrivingTraitId;
  number: string;
  name: string;
  role: string;
  tagline: string;
  tradeoff: string;
  highlights: readonly string[];
  stats: {
    speed: number;
    control: number;
    drift: number;
  };
  modifiers: DrivingTraitModifiers;
};

export const DEFAULT_DRIVING_TRAIT_ID: DrivingTraitId = "street-ace";

/**
 * Run-scoped taxi handling packages. Keep every physics modifier here so
 * tuning a package never requires hunting through the fixed-step simulation.
 */
export const DRIVING_TRAIT_PACKAGES: readonly DrivingTraitPackage[] = [
  {
    id: "street-ace",
    number: "01",
    name: "STREET ACE",
    role: "ALL-ROUND CONTROL",
    tagline: "Predictable response, clean lines, no hidden weakness.",
    tradeoff: "THE ORIGINAL NEON FARE HANDLING",
    highlights: ["FULL ROAD GRIP", "STEADY BRAKING", "BALANCED BOOST"],
    stats: { speed: 3, control: 5, drift: 3 },
    modifiers: {
      throttleMultiplier: 1,
      brakingMultiplier: 1,
      boostAccelerationMultiplier: 1,
      boostDrainMultiplier: 1,
      steeringMultiplier: 1,
      driftSteeringMultiplier: 1,
      roadGripMultiplier: 1,
      driftGripMultiplier: 1,
      steeringReferenceSpeed: 24,
      maxForwardSpeed: STANDARD_TAXI_FORWARD_SPEED_WORLD_UNITS,
      maxBoostSpeed: STANDARD_TAXI_FORWARD_SPEED_WORLD_UNITS * TAXI_BOOST_SPEED_MULTIPLIER,
      driftBoostGainMultiplier: 1,
      driftScoreMultiplier: 1,
      initialBoost: 45,
    },
  },
  {
    id: "drift-demon",
    number: "02",
    name: "DRIFT DEMON",
    role: "STYLE / BOOST CHARGE",
    tagline: "Loose rear, hard rotation, and bigger rewards for holding a slide.",
    tradeoff: "LESS SETTLED WHEN YOU SNAP BACK STRAIGHT",
    highlights: ["1.55× DRIFT CHARGE", "1.30× DRIFT SCORE", "WIDER SLIP ANGLE"],
    stats: { speed: 3, control: 2, drift: 5 },
    modifiers: {
      throttleMultiplier: 1,
      brakingMultiplier: 1,
      boostAccelerationMultiplier: 1,
      boostDrainMultiplier: 1,
      steeringMultiplier: 1,
      driftSteeringMultiplier: 1.15,
      roadGripMultiplier: 0.96,
      driftGripMultiplier: 0.7,
      steeringReferenceSpeed: 24,
      maxForwardSpeed: STANDARD_TAXI_FORWARD_SPEED_WORLD_UNITS,
      maxBoostSpeed: STANDARD_TAXI_FORWARD_SPEED_WORLD_UNITS * TAXI_BOOST_SPEED_MULTIPLIER,
      driftBoostGainMultiplier: 1.55,
      driftScoreMultiplier: 1.3,
      initialBoost: 45,
    },
  },
  {
    id: "redline-rush",
    number: "03",
    name: "REDLINE RUSH",
    role: "LAUNCH / BOOST PUNCH",
    tagline: "A hotter launch, a harder boost surge, and sixty boost ready at the curb.",
    tradeoff: "LIGHTER STEERING AND BRAKES AT SPEED",
    highlights: ["+12% LAUNCH", "22% STRONGER BOOST", "START AT 60 BOOST"],
    stats: { speed: 5, control: 2, drift: 2 },
    modifiers: {
      throttleMultiplier: 1.12,
      brakingMultiplier: 0.94,
      boostAccelerationMultiplier: 1.22,
      boostDrainMultiplier: 1.15,
      steeringMultiplier: 0.9,
      driftSteeringMultiplier: 0.95,
      roadGripMultiplier: 1,
      driftGripMultiplier: 1,
      steeringReferenceSpeed: 26.5,
      maxForwardSpeed: REDLINE_TAXI_FORWARD_SPEED_WORLD_UNITS,
      maxBoostSpeed: REDLINE_TAXI_FORWARD_SPEED_WORLD_UNITS * TAXI_BOOST_SPEED_MULTIPLIER,
      driftBoostGainMultiplier: 0.85,
      driftScoreMultiplier: 1,
      initialBoost: 60,
    },
  },
] as const;

const packagesById = new Map<DrivingTraitId, DrivingTraitPackage>(
  DRIVING_TRAIT_PACKAGES.map((trait) => [trait.id, trait]),
);

export function drivingTraitPackage(id: DrivingTraitId): DrivingTraitPackage {
  return packagesById.get(id) ?? DRIVING_TRAIT_PACKAGES[0];
}
