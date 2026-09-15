# Garage and driving

The garage has three bays: the original yellow Crown Cab, a white 2015 Honda
Accord Coupe V6, and a black North American 2012 Nissan GT-R. Vehicle choice is run-scoped and separate
from Street Ace, Drift Demon and Redline Rush. All three vehicles work in Arcade
Shift, Arcade Free Run and Simulation Free Run. Shifting defaults to Automatic
in every mode. The Accord card also offers Manual in every mode. The GT-R is automatic only.

Each setup stage is its own screen: Arcade Shift and Free Run use Vehicle →
Edge → Steering; Simulation keeps its physical chassis and uses Vehicle →
Steering. This applies to keyboard and touch. Locking steering starts the
countdown. Back and Escape return one stage while retaining the car and
transmission choices. The garage's new comic artwork and prompts are documented
in [garage-art.md](garage-art.md).
Each vehicle has its own Lock In button, using the same treatment as Edge and
Steering; it commits that card's vehicle even when the other card is selected.
The Accord's selection copy is limited to “Secret special edition. Same streets.
Just goes faster.” and the story link, alongside its shifting controls.

The Crown Cab retains its established 1990s Ford Crown Victoria–inspired V8,
four-speed automatic and 1,900 kg loaded simulation chassis. Its arcade
character favors steady acceleration, composed power turns and easy braking
slides. At roughly 90–120 km/h, lift off the gas and steer while braking to
slide into a stop. Center or countersteer to catch the rear; the cab settles
without repeated tail rebounds. Both Arcade run kinds share this handling.

The Accord is a cared-for, lightly worn ninth-generation two-door coupe with
154,298 km, a 3.5L V6 that feels closer to 300 hp, and a six-speed
manual gearbox driving the front axle. Its winter tires have softer dry-road
grip and begin each run with $1,000 of financing in the run balance. A paused
event card celebrates the first positive balance. Its driver also shares a
quantum fact halfway through each passenger trip; see [accord-events.md](accord-events.md).
K&N, Brembo and Injen stickers are cosmetic; they do not
claim a specific fitted parts list or individually add power.

The garage's **Read the Accord's Story** opens the comic poster at
`/art/vehicle-stories/accord-backstory.png`, with readable companion text and a
link to the full-size artwork. Its clutch caption now says “Clutch sticks
sometimes,” matching the game's descriptive copy without a tuning percentage.
The built-in image edit and its prompt are recorded in [garage-art.md](garage-art.md).
The poster's factory-power wording
is part of the artwork; the game's existing authored torque curve is unchanged.
Escape and Close return focus to the story button without leaving vehicle setup.

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

The GT-R uses a dedicated six-speed automatic dual-clutch model and rear-biased
AWD drive forces in Simulation. Its North American model-year 2012 reference
has a 3.8L twin-turbo V6, 530 hp and 448 lb-ft, as described in the
[Nissan North America brochure](https://www.guide-autosport.com/wp-content/uploads/2014/01/Nissan_US-GT-R_2012.pdf).
Loaded mass, tire response, torque interpolation, shifts and a 315 km/h outer
ceiling are authored game approximations. The AWD split applies drive demand
to both finite axle friction circles. It has no Accord clutch fault or manual
selector. Arcade uses its own stronger launch and planted handling, with a
285 km/h ordinary ceiling and 315 km/h boost ceiling. Damage, fuel and shoulder
penalties still apply. Cruise follows the corresponding ordinary limit.

The renderer-neutral black R35 model includes a coupe glasshouse, bonnet vents,
four circular rear lamps, stock wing and four steering/road-attached wheels.
Both detail settings use it, inside the existing 2,048-face vehicle mesh budget.
WebGPU, WebGL and software Canvas share that geometry. No taxi roof sign or
checker stripe is added. Existing saves initialize its own full fuel tank.

### Accord clutch and shifting

- Automatic assists the same six-speed gearbox. Gas selects forward drive;
  hold brake through a stop to reverse. It shifts up and down on its own.
- Manual acceleration uses the tuned engine's torque curve, real gear/final-drive
  ratios, loaded mass and FWD winter-tire traction in both models. Arcade keeps
  its steering/slides but replaces the generic arcade acceleration and drag
  with SI drive force and road/aero resistance. First/second reach roughly
  61/97 km/h at 6800 RPM; third/fourth have ratio ceilings near 142/193 km/h.
  Fifth/sixth have ratio ceilings near 247/313 km/h. The coupe no longer uses
  the shared Arcade taxi cap or its former 223 km/h governor. Aero drag and
  available engine torque determine its lower unboosted top speed; sixth's
  redline is the outer ceiling, not a promised flat-road speed. Boost cannot
  bypass any gear's limiter, including with automatic shifting.
- First through fourth retain their previous acceleration in each driving and
  shifting mode. Automatic Arcade keeps its quick lower gears, then uses the
  same SI engine/road resistance model as Manual in fifth and sixth. The
  automatic full-throttle fifth-to-sixth shift now occurs at 6200 RPM, near
  225 km/h, instead of the old early shift near 204 km/h.
- Fifth/sixth's low- and mid-RPM torque is calibrated against the same-generation
  [Car and Driver V6 six-speed manual test](https://www.caranddriver.com/reviews/a15103674/2016-honda-accord-coupe-v-6-manual-test-review/):
  sixth takes about eight seconds for both 30–50 and 50–70 mph (48–80 and
  80–113 km/h), without downshifting. Fifth's roughly 5–6-second 50–70 mph
  target is derived from the shared torque and its shorter ratio; it is not a
  separate published measurement. The high-RPM custom 300 hp peak is retained.
  These are unboosted, healthy-car, flat-road targets. The source car's factory
  governor is not applied to this custom game car. Crown tuning stays unchanged.
  In unboosted fifth/sixth, shoulder and damage penalties lower the attainable
  speed calculated from that torque/drag balance, so they remain effective
  below the theoretical redline ceiling. Simulation retains its gradual
  drive-force governor rather than clipping slide momentum.
- The shift lamp lights at 6200 RPM when a forward upshift is available.
  VTEC lights under throttle from 4900 RPM with the clutch connected. This
  crossover is an authored approximation for the custom tune, not a factory
  ECU calibration claim. Both lamps go out with the clutch down or stuck.
- Manual: hold Shift (or the CLUTCH touch pedal), tap Z / − to downshift or
  X / + to upshift, then release the clutch. Gear order is R, N, 1–6. Use gas
  to reverse in R; brake always brakes. Launch assistance prevents stalling.
- Reverse is blocked while moving; downshifts that would exceed redline are
  rejected. Holding a shift key cannot skip through gears.
- In either setting, the clutch sometimes sticks disengaged, using a seeded
  engagement check. An automatic gear change is an engagement; in Manual, releasing
  the clutch is an engagement. A stuck clutch interrupts drive and arcade
  boost, cancels cruise, and shows a persistent red warning immediately above
  the vehicle direction arrow's projected position, even when that arrow is
  temporarily absent. The warning follows every camera, stays inside the screen,
  and counts down recovery taps/pumps without flashing.
- In Automatic, three new complete gas taps or clutch pumps restore drive.
  Mobile Automatic omits the entire clutch/gear control panel to free screen
  space; the warning above the car shows the gas-tap recovery counter. Manual
  retains its clutch and shift controls in both phone orientations.
  A gas key already held when the fault occurs does not count when released.
  Manual still requires three actual clutch pumps. Holding either control does
  not count repeatedly, and simultaneous gas/clutch releases count once.
  Repair pumps do not roll another fault. Fault RNG has
  its own seed/counter and never depends on rendering, particles or traffic.
- Space remains arcade boost or Simulation's rear parking brake. On a phone,
  double-tap and hold the Simulation brake pedal for the parking brake.

## Arcade characterization

Both Arcade run kinds use the same Crown handling. On flat pavement, a
0.4-second Street Ace power turn from 120 km/h reaches about 6° slip, down
from 27°. Centering the steering under throttle settles the rear without an
opposite tail swing. A deliberate brake-and-steer stop from 90–120 km/h builds
roughly 20–60° peak slip; Drift Demon makes that braking slide wider and more
rewarding. Countersteering catches it faster than centering alone. The FWD
Accord retains its own throttle, lift-off, braking and yaw behavior.
Straight-line Crown launch, reverse, boost limits, passenger scoring formulas
and collision containment are retained.

The Accord uses the owner's **B · Accord coupe / Balanced** study from
`accord-coupe-review.html` in both Classic and Detailed settings. The selected
56 parts and 372 triangles are preserved in `game/render/accord-balanced.json`,
including source SHA-256, exact vertices, winding, colors and four wheel pivots.
It has the supplied low roof, long doors, rear quarter glass, trim and eight-sided
wheels. Front wheels steer at their original pivots. The JSON is native Z-up
geometry; no GLB axis conversion, new engine or runtime asset download is needed.
Cab View remains an unobstructed first-person camera with the normal HUD.
The Crown retains its Classic/Detailed selection, sedan shape and taxi equipment.
Classic actor geometry stays inside the 96-instance ghost budget.
The mesh has its own 2,048-face budget, shared by WebGPU, WebGL and software
Canvas. Wheels steer and the body follows road pitch, jumps and rollover pose.
Physics, collision footprints, winter-tire behavior, passengers and cargo do not
depend on detail or the replacement Accord mesh.
The garage and clutch/gear controls are
keyboard-accessible, fit phone rotation, and follow the game's input reset
rules. Diagnostic input masks include clutch and both shift directions.

Both cars record horizontal drift and airborne distance, with live counters,
completion feedback, run bests and pause/result totals. Drifts earn the existing
angle-based distance score; airborne distance is a measurement only. Off-road driving lowers the forward
speed ceiling over three seconds, by a maximum 30 km/h, and restores it over
two seconds on pavement. Rally Tires reduce that penalty to 22.2 km/h. Lower
speeds no longer receive the old abrupt off-road drag.

## Bodywork and repairs

Every distinct vehicle impact removes 1 km/h of available top speed for the rest
of the run, until repaired. Both forward/reverse limits, arcade boost, manual
gears and the Simulation governor respect damage, with a 10 km/h minimum ceiling.
This is not forced movement: braking and stopping still work normally. Continuous
scraping is one contact, with a 0.25-second release tolerance. Tiny resting support
corrections do not count. Quips cycle through 24 lines without consuming RNG.
Once every available ceiling reaches 10, further hits still get a quip but do not
increase the repair bill. New runs start undamaged; tow/unstuck does not repair.

Gas venue interactions own their service-lot rectangle and elevation. Stopping
below 2 km/h for 0.6 seconds on that lot offers a complete repair for $10 per lost
km/h, paid from the current run's fare. Tap **Repair Vehicle** or press **R**;
**Not Now** / **N** dismisses the automatic offer until the cab leaves that lot
and returns. Leaving the vehicle or going inside does not re-arm it. The same
repair can be requested inside the matching gas station with the cab parked on
its lot. Funds, motion, elevation and location are checked again on acceptance;
repeated acceptance never charges twice. Bodywork repairs do not alter upgrades,
passenger jobs, the clock or the Accord's characteristic clutch fault.
