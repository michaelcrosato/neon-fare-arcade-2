import type { VehicleId } from "./model";

export const DEFAULT_VEHICLE_ID: VehicleId = "crown-cab";
export const VEHICLES = [
  {
    id: "crown-cab", name: "Crown Cab ’96", shortName: "CROWN CAB", number: "01",
    layout: "RWD", transmission: "4-speed automatic", power: "V8 fleet tune",
    description: "Our yellow workhorse, inspired by a 1996 Ford Crown Victoria. Heavy, rear-driven, and happy to hang its tail out.",
    details: ["1,900 kg loaded", "Body-on-frame V8", "Rear-drive power slides"],
    arcade: { acceleration: 1, steering: 1, powerSlide: 1.32, liftSlide: 0.8, slideGrip: 1, yawRecovery: 1 },
  },
  {
    id: "accord-v6", name: "2015 Honda Accord Coupe V6", shortName: "ACCORD V6", number: "02",
    layout: "FWD", transmission: "6-speed manual", power: "≈300 hp · tuned 3.5L V6",
    description: "White ninth-generation coupe. Well cared for, lightly worn, and wearing a few too many aftermarket badges.",
    details: ["150,000 km", "Winter tires · still being financed", "K&N · Borla · HKS · Hondata badges", "Clutch sticks on ~5% of engagements · pump 3 times"],
    arcade: { acceleration: 1.14, steering: 1.09, powerSlide: 0.82, liftSlide: 1.35, slideGrip: 0.9, yawRecovery: 1.15 },
  },
] as const;

export function vehicleDefinition(id: VehicleId) {
  return VEHICLES.find(vehicle => vehicle.id === id) ?? VEHICLES[0];
}

// Honda's V6 6MT ratios; the engine output, winter grip and loaded mass are
// authored for this particular car, not a claim about an unmodified Accord.
export const ACCORD_GEARS = [0, 3.933, 2.478, 1.7, 1.25, 0.976, 0.771] as const;
export const ACCORD_FINAL_DRIVE = 3.55;
export const ACCORD_WHEEL_RADIUS_M = 0.334;
export const ACCORD_REDLINE_RPM = 6_800;
