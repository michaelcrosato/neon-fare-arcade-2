# Garage and driving

The garage has three bays: the original yellow Crown Cab, a white 2015 Honda
Accord Coupe V6, and one empty bay. Vehicle choice is run-scoped and separate
from Street Ace, Drift Demon and Redline Rush. Both vehicles work in Arcade
Shift, Arcade Free Run and Simulation Free Run. Shifting defaults to Automatic
in every mode. The Accord card also offers Manual in every mode.

The Crown Cab retains its established 1990s Ford Crown Victoria–inspired V8,
four-speed automatic and 1,900 kg loaded simulation chassis. Its arcade
character now emphasizes rear-drive power slides and a tail that rebounds
after a sudden release or correction.

The Accord is a cared-for, lightly worn ninth-generation two-door coupe with
about 150,000 km, a tuned 3.5L V6 making approximately 300 hp, and a six-speed
manual gearbox driving the front axle. Its winter tires have softer dry-road
grip and carry the owner's “still being financed” description. Financing is
vehicle backstory. K&N, Borla, HKS and Hondata badges are cosmetic; they do not
claim a specific fitted parts list or individually add power.

Simulation uses a separate front-heavy 1,640 kg loaded chassis with a 2.725 m
wheelbase. Drive force consumes the front tires' friction circles; the Crown
consumes the rear tires'. The custom torque curve peaks at about 300 hp at
6,200 rpm. Winter grip, inertia, center of gravity and tuned torque are authored
game parameters. The deterministic paved launch takes roughly 7–8 seconds to
60 mph, versus the cab's retained 10–11.6-second contract. Gear ratios are
3.933 / 2.478 / 1.700 / 1.250 / 0.976 / 0.771 with a 3.550 final drive and
6,800 rpm redline.

Honda's [2015 Canadian specification sheet](https://www.honda.ca/Content/honda.ca/en/2015/accord_coupe/ex_10291/GenericLink/Accord_Coupe_specs_EN.pdf)
lists the factory V6 at 278 hp. The game uses the requested custom 300 hp output.
Honda's [V6 six-speed specification table](https://automobiles.honda.com/images/2016/accord-coupe/downloads/2015-accord-coupe-specifications.pdf)
provides the gearbox ratios. That download includes later model equipment;
the modeled body uses the 2015 pre-facelift coupe shape.

## Clutch and shifting

- Automatic assists the same six-speed gearbox. Gas selects forward drive;
  hold brake through a stop to reverse. It shifts up and down on its own.
- Manual: hold Shift (or the CLUTCH touch pedal), tap Z / − to downshift or
  X / + to upshift, then release the clutch. Gear order is R, N, 1–6. Use gas
  to reverse in R; brake always brakes. Launch assistance prevents stalling.
- Reverse is blocked while moving; downshifts that would exceed redline are
  rejected. Holding a shift key cannot skip through gears.
- In either setting, each clutch engagement has a seeded 5% chance to stick
  disengaged. An automatic gear change is an engagement; in Manual, releasing
  the clutch is an engagement. A stuck clutch interrupts drive and arcade
  boost, cancels cruise, and shows a persistent recovery counter.
- Three complete press/release pumps restore drive. Holding the pedal does
  not count repeatedly. Repair pumps do not roll another fault. Fault RNG has
  its own seed/counter and never depends on rendering, particles or traffic.
- Space remains arcade boost or Simulation's rear parking brake. On a phone,
  double-tap and hold the Simulation brake pedal for the parking brake.

## Arcade characterization

The same deliberate drift increase applies in both arcade run kinds. In the
0.4-second, 40-world-unit/s Street Ace turn, the Crown now reaches approximately
27 degrees of slip, versus approximately 16 for the FWD Accord. Drift Demon
opens the cab's slide to about 32 degrees. FWD throttle widens the turning
line; lift-off and trail braking encourage rotation. Lower yaw damping retains
rotation during a correction and permits alternating tail swings before the
car settles. Countersteering still catches the initial slide, with more time
and care required than before. Straight-line Crown launch, reverse, boost
limits, passenger scoring formulas and collision containment are retained.

Both rendering paths consume the same coupe body, glass, wheels, winter tread,
supplier plaques, wear marks and white cockpit hood. Its actor geometry stays
inside the 96-instance ghost budget. The garage and clutch/gear controls are
keyboard-accessible, fit phone rotation, and follow the game's input reset
rules. Diagnostic input masks include clutch and both shift directions.
