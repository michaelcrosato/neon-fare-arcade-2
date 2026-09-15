import type { VehicleId } from "./model";

export const DEFAULT_VEHICLE_ID: VehicleId = "crown-cab";
export const VEHICLES = [
  {
    id: "crown-cab", name: "Crown Cab ’96", shortName: "CROWN CAB", number: "01",
    layout: "RWD", transmission: "4-speed automatic", power: "V8 fleet tune",
    description: "Our yellow workhorse, inspired by a 1996 Ford Crown Victoria. Planted under power, with easy slides when you brake into a turn.",
    details: ["1,900 kg loaded", "Body-on-frame V8", "Brake into a sideways stop"],
    arcade: { acceleration: 1, steering: 1, powerSlide: 0.46, liftSlide: 0.8, brakeSlide: 2.7, slideGrip: 1, yawRecovery: 1 },
  },
  {
    id: "accord-v6", name: "2015 Honda Accord Coupe V6", shortName: "ACCORD V6", number: "02",
    layout: "FWD", transmission: "6-speed manual", power: "3.5L V6 · feels closer to 300 hp",
    description: "Secret special edition. Same streets. Just goes faster.",
    details: ["154,298 km · still going strong", "Winter tires · still being financed", "K&N · Brembo · Injen stickers", "Clutch sticks sometimes · pump 3 times"],
    arcade: { acceleration: 1.14, steering: 1.09, powerSlide: 0.82, liftSlide: 1.35, brakeSlide: 0, slideGrip: 0.9, yawRecovery: 1.15 },
  },
  {
    id: "gtr-r35", name: "2012 Nissan GT-R", shortName: "GT-R", number: "03",
    layout: "AWD", transmission: "6-speed dual-clutch automatic", power: "3.8L twin-turbo V6 · 530 hp",
    description: "Black paint. Four driven wheels. A very different kind of night shift.",
    details: ["North American R35 · Jet Black", "Automatic only · six forward gears", "Twin turbos · planted AWD launch"],
    arcade: { acceleration: 1.5, steering: 1.02, powerSlide: 0.32, liftSlide: 0.75, brakeSlide: 1.8, slideGrip: 1.12, yawRecovery: 1.2 },
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

// The custom coupe has no shared taxi governor: sixth's redline is the outer
// ceiling. Engine power and aero drag determine its lower unboosted top speed.
export const VEHICLE_GOVERNED_SPEED_KMH: Record<VehicleId, number> = {
  "gtr-r35": 315,
  "crown-cab": 53 * 3.6,
  "accord-v6": ACCORD_REDLINE_RPM * 2 * Math.PI * ACCORD_WHEEL_RADIUS_M * 3.6
    / (60 * ACCORD_GEARS[6] * ACCORD_FINAL_DRIVE),
};
