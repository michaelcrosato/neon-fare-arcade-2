# Gameplay contract

These are compatibility rules, not suggestions. Tests intentionally freeze them
so refactors cannot silently change game feel. The engine rebuild deliberately
updates the arcade launch, steering, road elevation and contact rules below.

## Coordinates and roads

- New browsers start in Chase Low; an explicitly saved camera selection wins.
- Passenger reviews award 1–5 stars. Travel time divided by the route's par time
  earns 5 stars at ≤1.0, 4 at ≤1.35, 3 at ≤1.8, 2 at ≤2.4, and 1 above that.
  Review par time is `max(11, road distance / 17 + 6)` seconds, without the
  arcade bonus's 62-second cap, so long regional trips can earn five stars too.
  Any recorded collision during the occupied trip subtracts one star, floored at 1.
  Five stars add a rounded 25% cash tip; four add 10%; lower ratings add none.
  Tips are added to the existing cash fare, not the score. This applies to every
  driving model and run kind; Free Run's score still has no quick-time bonus.
  The departing passenger and their unique review remain at the destination for
  eight simulation seconds (or until the next pickup), with a head-anchored bubble.
- Browser music loops track 02 through the mode and driver selection menus,
  stops at the countdown, and loops 01 while inside a venue on foot. Each run
  shuffles 04–08 once. Driving starts the first song; each pickup starts the next
  song, and natural endings advance through that order. Music continues between
  fares. After 30 seconds without a passenger it fades over three seconds to
  silence; pickup immediately restores music. Occupied fares never time out the
  music, and paused time does not count toward the 30 seconds. Interiors temporarily replace
  fare music and resume its position on exit. Pause/hidden tabs stop playback;
  the audio toggle mutes music and sound effects together. Browser autoplay may
  defer menu music until the first click or keypress.

- `+x` points east, `+y` points south, and `+z` points up.
- Local street coordinates use a 36-unit lattice with a 6-unit half width.
  Neon City retains a predominantly local grid, interrupted by four green
  districts and ten continuous landmark campuses. Cedar Vale uses neighborhood collectors,
  loops, planted turning courts and a compact town grid. Northstar Range, Copper
  Mesa, Palm Reach, and Solana Coast expose compact town grids and sparse rural spines.
  Authored boulevards, parkways, highways, ramps, roundabouts, mountain roads,
  desert roads, coastal drives, and peninsula causeways complete the shared graph. Pavement,
  physics, routes, traffic, fares, pedestrians, and both GPS maps consume the
  same enabled-street topology.
- Authored curves carry height, width and bank through one compiled surface.
  Neon City uses physical hills, level landmark terraces and twelve-unit
  junction tables between graded blocks. Its unused beltway and eight ramps
  have been removed. Tire contact stays 0.64 above the shared road design;
  fast crest takeoff and landing use the existing vehicle physics. Equal XY
  coordinates on different decks do not form a junction. Northstar, Copper,
  and Solana Coast also use physical terrain and sustained road grades; Palm
  Reach adds a raised bay crossing. Cedar retains its established ground plane.
- Horizontal right-hand traffic: `laneY = roadY + dir * 2.25`.
- Vertical right-hand traffic: `laneX = roadX - dir * 2.25`.
- The player taxi starts at `(0, 2)`, heading north (`-π/2`). This centered
  spawn avoids an initial lateral GPS segment.

## Time and physics

- Mobile driving uses a floating thumbstick anywhere on the playfield. Horizontal
  travel has a six-pixel dead zone and reaches full steering at 56 pixels.
  The initial touch is neutral; a floating indicator shows displacement.
  A thumb on the playfield keeps steering ownership regardless of pedal press
  order; extra steering touches are ignored until it lifts. Releasing it centers
  steering even when a pedal remains held. Gas and brake never steer, including
  when their captured pointers drag outside the button. Both pedals sit on the
  right. The guide and labels are visible during countdown, with input locked
  until play starts. The guide remains visible during play and fades while the
  thumb supplies nonzero steering. Gas and brake stay held
  independently, with touch braking suppressing touch throttle and arcade boost.
  Double-tap gas and hold the second tap for arcade boost; gas fill shows reserve.
  In simulation, double-tap and hold brake operates the parking brake. Keyboard
  steering retains priority. Pointer cancellation, pause, blur, resizing, and leaving driving
  clear touch input. Digital steering and all existing physics tuning are preserved.

- The menu offers Arcade Shift, Arcade Free Run, and Simulation Free Run.
  Arcade modes open the same three-package driver draft. Simulation Free Run
  opens the Crown Cab specification instead and never exposes arcade traits.
  Run kind and driving model are orthogonal, run-scoped selections, but the
  simulation model is authoritatively normalized back to arcade for timed runs.
- Street Ace uses the shared responsive arcade launch, braking, steering and
  drift model. Launch acceleration tapers from 23.5 to 20 world units/s²;
  service braking is 34. Reverse tuning is preserved. Drift
  Demon changes drift rotation, charge, and style scoring; Redline Rush changes
  launch, boost acceleration, boost supply, and high-speed control. Passenger
  and courier payout formulas remain package-neutral.
- Simulation Free Run replaces only the taxi vehicle model. The fare market,
  couriers, navigation, traffic, collisions, walking, interiors, career bank,
  and untimed completion rules remain shared. Its reference vehicle is a
  1990s full-size body-on-frame Crown Victoria-style fleet taxi: 1,900 kg
  loaded with driver and fleet equipment,
  2.91 m wheelbase, rear-wheel drive, naturally aspirated V8, and four-speed
  automatic. Powertrain and chassis state use SI units inside
  `simulation-vehicle.ts`, then project into the shared world-space pose.
- Simulation throttle, service brakes, aero/rolling resistance, automatic
  shifts, engine RPM, nonlinear front/rear tire slip, load-sensitive friction
  circles, longitudinal/lateral load transfer, yaw inertia, low-speed bicycle
  behavior, sprung pitch/roll, wheel lift, and rollover are fixed-step state. W
  selects drive; S first applies the service brake and engages reverse only
  after being held through a complete stop. Space is the rear parking brake.
  Simulation has no boost, brake-kick, arcade drift charge, or drift scoring.
  Engine governors limit drive force, never the momentum of a backward slide.
  Low-speed handling blends from total planar speed, not forward speed alone.
  Steering retains its physical 32-degree road-wheel lock at every speed and is
  rate-limited instead of electronically reduced. At high speed, excess steer
  saturates the tires and runs wide; lift-off, braking, throttle, and the rear
  parking brake redistribute the same finite grip and can produce a spin.
  Flat-road tire grip is below the Crown cab's 1.43 static-stability factor, so
  steering angle alone cannot manufacture a rollover. A broadside cab can be
  tripped by a curb/road-edge transition, soft shoulder, building, or traffic
  impulse; the resulting angular momentum determines whether it rocks back,
  lands on its side, or reaches the roof. A stopped overturned cab can be exited
  and righted on foot before re-entry. Overturning emits one semantic simulation
  event, and a cab resting on its side or roof cannot satisfy passenger pickup
  or drop-off dwell.
- The simulation performance characterization targets roughly 10–11.6 seconds
  from 0–60 mph, 40–47 m from 60–0, and a plausible roof-sign-limited maximum
  speed. These ranges are deterministic regression contracts, not display copy.
- World physics uses a fixed 1/60-second step. The one player simulation vehicle
  takes two bounded 1/120-second chassis substeps for stable tire saturation,
  spins, and trip impulses at negligible world/render cost.
- The frame loop caps accumulated render-frame time, but countdown uses real
  wall time.
- `Game` is mutated in place inside `stepGame`; do not clone it per tick.
- Speed is calculated before collision/off-road damping and refreshes on the
  following tick. That timing is part of the current feel.
- Digital steering input resolves into a progressive front-wheel angle, so a
  tap makes a shallow turn while a held input reaches full lock. A drift builds
  progressively above roughly 25 km/h. Higher speed and harder steering retain
  more world-space momentum while the taxi rotates, producing a pronounced but
  controllable signed slip angle rather than a binary grip swap. Slide intensity,
  yaw, tire grip, smoke, drift charge, and drift score scale with that angle and
  speed. Releasing steering restores grip; countersteering restores it faster
  and actively pulls the taxi back into line.
- A 50 ms steering tap reaches about half lock; a 300 ms hold reaches full lock.
  Rotation follows a damped yaw rate, while countersteer responds faster than
  ordinary steering. Acceleration/braking and lateral load drive bounded body
  pitch/roll. The Street Ace one-second launch reaches 20.225 world units/s
  (previously 16.267); Redline reaches 22.634. Boost activates at the same speed
  threshold and drains at the same rate, so the faster launch starts it earlier.
- Tire contact follows the actual pavement triangles. At a fast crest the cab
  may leave the surface, retain its horizontal momentum and land with a damped
  suspension impulse. Air steering is limited and airborne slides earn no drift
  score or charge. Bridge decks and rails have vertical collision intervals;
  traffic and arrival dwell must be on the same level as the taxi.
  Landings sweep the full foot trajectory against pavement triangles, including
  when both the taxi and the road are rising. Parallel road overlaps retain the
  followed ribbon; a turn can transfer support onto a climbing ramp.
- The simulation cab also requires ground contact for tire, brake, rolling
  resistance and terrain-trip forces. Its airborne body retains momentum under
  aerodynamic drag until the shared road-contact controller lands it.
- Tapping brake while committed to a turn above roughly 31 km/h creates one
  short trail-brake rotation pulse in the steering direction. Its yaw, rear
  grip release, smoke, and momentum cost scale with speed and steering angle.
  Above roughly 118 km/h, yaw gains an additional progressive high-speed ramp
  while kick strength, braking cost, and cooldown remain unchanged.
  Holding brake continues normal deceleration but never retriggers the pulse;
  release and tap again after the cooldown to rotate again. Countersteering and
  collision-clipped turns suppress the effect.
- Standard packages cap at 160 displayed km/h and 170 km/h under boost;
  Redline Rush reaches 165 km/h without boost. Road class never increases
  those caps: highways and four-lane boulevards use the same handling package
  as local streets. Boost Overdrive raises the boosted cap exactly 60 km/h
  above the selected package's normal cap, reaching 225 km/h for Redline Rush.
  Reverse speed, trait modifiers, and payout
  formulas remain unchanged; a
  faster trip may still earn a larger existing quick-time bonus. High-speed
  movement uses additional collision substeps so the taxi cannot tunnel through
  ordinary world colliders.
- Building movement resolves X then Y with precomputed substeps.
- Pickup/dropoff bonuses apply before that tick subtracts remaining time.
- In Arcade Shift, the visible meter advances while driving or whenever a
  passenger is onboard. An empty taxi pauses it on the exit tick, keeps it
  frozen while the driver explores, and resumes it on the re-entry tick. With a
  passenger, exit, walking, venue, and re-entry ticks all remain live. Free Run
  has no countdown meter after the start sequence: time never decrements,
  credits, warns, or ends the run. `elapsed`, traffic, messages, and fare leg
  time always continue in either mode.

## Player activity and interactions

- `Game.x/y/z/vx/vy/heading/speed` always belong to the taxi. The walking actor is
  the discriminated `Game.player` state; use `controlledPose(game)` for camera
  and streaming focus.
- E is a context action with a simulation-owned held-input latch. Below 10 km/h
  (using the unrounded speed), a taxi exits on the first safe side; at or above
  that speed both the prompt and action are unavailable. The mobile exit action
  follows the driver’s door in exterior cameras and sits on the driver’s side in
  Cab View. A held key cannot exit and re-enter on
  adjacent ticks.
  Exit clears the simulation cab's drive controls and yaw state so it stays
  parked. Body roll and roll rate remain live; exit never rights the cab.
- Exterior walking preserves the selected driving perspective. Cab View becomes
  first-person on foot; entering an interior temporarily uses its fixed cutaway
  without changing the exterior selection.
- Walking uses the same fixed 60 Hz step and a swept circular collision body.
  X/Y resolution allows wall sliding without reusing the taxi OBB. Collision
  uses each solid's height interval, including bridge undersides and guardrails.
  Walking follows the same supporting road deck as driving, and jumping cannot
  pass through a low ceiling. Semantic water and active-region edges remain solid.
- W/S walk forward/backward, A/D turn, Shift runs, Space jumps, and either C or
  Ctrl crouches. Ground motion accelerates and brakes instead of snapping to a
  speed. Running reaches 8.2 world units/second, normal walking 4.5, crouching
  2.35, and reverse 72% of the active forward pace. Air control is deliberately
  limited so a running jump preserves momentum while remaining correctable.
- Jump presses are edge-triggered with a 120 ms input buffer and 100 ms coyote
  window. Holding Space produces the full jump arc; releasing early increases
  gravity for a shorter hop. Landing returns elevation to the supporting deck and a
  held key cannot cause automatic bunny hops. Context interactions are hidden
  and rejected until the actor is grounded.
- Crouching eases into a lower visual stance and first-person eye height while
  retaining the stable circular collision footprint. Low overhead clearance
  keeps the actor crouched until standing fits. Reduced-motion mode
  removes gait bob, body lean, and landing shake but preserves movement rules,
  jump height, and crouch height.
- Fare pickup/dropoff is disabled outside the taxi. Traffic and fixed-step
  simulation continue; the Arcade Shift meter freezes only when no passenger
  is onboard, while Free Run remains untimed everywhere.
- Exterior doors are stable semantic metadata rotated with their procedural
  lot. Entering one swaps to a deterministic local-coordinate pocket scene;
  the parked taxi and fare state remain in city coordinates.
- Interior services emit semantic IDs and venue data. UI and audio belong above
  that boundary; pure purchase rules live in `game/career.ts`.
- Structural city lots publish stable entrances. Parks, playgrounds, and active
  construction sites remain deliberately closed; plaza kiosks and all named
  landmarks are enterable.

## Career and home base

- Current-run `Game.fare` is never spent directly. It is deposited into the
  versioned device-local career bank exactly once when a shift ends.
- Block `(0,0)` owns the stable `NEON LOFTS` home portal. The pocket scene is
  static and cached; property ownership never changes procedural city geometry.
- Purchases are catalog-driven, enforce explicit prerequisites, and affect only
  future runs unless an activity says otherwise. The garage boost refill is
  limited by `Game.homeRechargeUsed` to once per arcade run. Simulation Free
  Run exposes no boost tank, does not consume the garage refill, and keeps
  boost inventory at zero.
- The storage adapter is intentionally outside deterministic game code so a
  future account or cloud-save backend can replace local storage safely.

## GO-GO GAS

- Gas-station transactions spend the persistent career bank. Current-run
  `Game.fare` remains gross shift earnings and is deposited only when the run
  ends.
- The player must be inside a `gas` venue, have no passenger onboard, and park
  the taxi within 14 world units of that venue's exterior return pose. These
  checks live in `purchaseGasStationOffer`; modal disabling is not authoritative.
- During Arcade Shift, a time fill adds up to 15 seconds, prorates its $20 price
  when less fits, never exceeds 99 seconds, and can be purchased at most twice
  per run. A successful fill resets `lastBeep` so the ten-second warning
  sequence can fire again. Free Run authoritatively rejects clock-service
  purchases without spending banked fare.
- `boost-cooler`, `boost-overdrive`, `rally-tires`, and `impact-bars` are permanent career items
  sold only by GO-GO GAS. Successful installation affects the active run
  immediately and is copied into every fresh run by `applyCareerRunBonuses`.
  Boost Overdrive raises the active boosted cap exactly 60 km/h above the
  selected cab package's normal cap on that same road. It leaves acceleration,
  boost drain, reverse, and non-boosted speed unchanged; Redline Rush's upgraded
  boosted cap is 225 km/h on every road class.
- Permanent upgrades remain purchasable during Simulation Free Run because
  ownership applies across modes. Rally Tires improve the simulation cab's
  off-road friction and rolling resistance while retaining the arcade taxi's
  shared off-road damping change. Boost Cooler, Boost Overdrive, Impact Bars, and Boost
  Locker remain owned for arcade taxis but do not manufacture simulation boost.

## Navigation

- Route generation begins in the taxi's current travel direction.
- Six active regions occupy the center, north, east, south, southeast
  and west slots: Neon City, Northstar Range, Cedar Vale, Copper Mesa, Palm
  Reach and Solana Coast. A* graph routing must keep every segment in an active cell;
  Palm Reach connects through Cedar or Copper and routes never cut across an
  inactive diagonal cell.
- A reverse departure or U-turn recommendation requires at least 1,000 displayed
  meters of actual road-distance savings compared with continuing forward.
  Weighted graph costs and route ratios are not passenger-distance savings.
  An unknown/unreachable forward route cannot prove the required savings.
- The controller keeps the selected route until the player is more than 1,000
  displayed meters from the closest point on any remaining segment, measured
  in three dimensions. Passing a turn, leaving one lane, or reversing heading
  cannot bypass that gate. Normal waypoint progress and a valid later rejoin
  trim the existing route without recomputing it. A changed destination, new
  run, explicit Dev Mode relocation, or actual roadside recovery starts a new route immediately; the end of
  the tow animation does not. Dev Mode may adjust both distance thresholds.
- U-turn guidance uses hysteresis and an alignment hold so the warning cannot
  flicker while the taxi rotates.
- The minimap, instruction copy, and 3D cue consume the same
  `NavigationPlan`/`TurnCue` semantics.
- A world-anchored badge above each visible turn or U-turn arrow shows total
  remaining route distance to the destination as its main number, with
  `TO DESTINATION` underneath. It uses the same displayed-meter scale as GPS.
- World route dashes follow the right-hand traffic lane, 2.25 units from the
  road center, capped for narrower roads. Their height, grade and bank come from
  the actual pavement. Canonical route geometry, GPS and fare distances remain
  on the road graph; a taxi already in its lane must not double the offset.
- Tapping a street or moving the GPS pin with Shift+Arrow sets the custom route
  immediately. The map shows the active route without a confirmation step;
  Enter or Back returns from the map. Panning does not place a destination.
- All routes use one directed 3D road graph with physical crossing splits,
  virtual origin/destination projections, corridor weights and a small turn
  cost. Arrival direction is part of the search state, so sample vertices cannot
  manufacture U-turns. Height remains attached to route points through both GPS
  maps, the controller and world-space route markers.

## Roadside recovery

- Every active run exposes **Get Unstuck · Call a Tow** in the pause menu,
  including while walking or inside a venue. Recovery returns the player to
  the taxi on the nearest clear, active road at its actual elevation. Interior
  recovery searches from the exterior return point, not pocket-room coordinates.
- Placement checks pavement, terrain support, building clearance and live
  traffic. The taxi starts stopped, upright and aligned with its driving lane;
  airborne, rollover, drift, steering and held-input state is cleared.
- A tow deducts exactly $100 from the current run fare when at least $100 is
  available; otherwise it is free. It never spends the career bank, creates
  debt, cancels a job or resets the run clock, score, fare roster or destination.
  Carried courier cargo returns to the taxi with the driver.
- Recovery resumes play immediately, snaps the camera to the rescued taxi and
  replans guidance. A red tow truck drives along the road and a comic receipt
  displays the charge (or complimentary service) for 3.6 simulation seconds.
  The truck is visual, has no collider, and disappears after its departure.
  Repeated activation during that same tow cannot charge the player twice.

## Street life

- Up to two deterministic street-commerce scenes may appear in each city
  chunk. The 191 citywide scenes include hot-dog, coffee, and ice-cream carts,
  newsstands, produce and flower stalls, food trucks, and buskers. Their mix
  follows the surrounding district and lot type so each neighborhood reads
  differently.
- Commerce scenes are visual world dressing rather than prompt interactions.
  Each has one solid footprint, a vendor or performer, and a nearby customer;
  every footprint stays clear of roads, semantic water, storefront portals,
  return poses, existing geometry, and both ambient pedestrian lanes.
- A scene uses at most ten static boxes, and a chunk uses at most two scenes.
  These limits preserve distant WebGPU streaming, Canvas fallback cost, and the
  actor budget while still producing several points of activity in a typical
  neighborhood view.

## Landmark campuses

- The city retains its six original one-block landmark venues and adds ten
  featured multi-block campuses: Pulse Stadium, Skyport International, Nova
  Megamall, Neon Titan Plaza, Deep Blue Aquarium, Neon General Hospital, Apex
  University, Volt Expo Center, Starfall Observatory, and Lucky 88 Casino.
- Featured campuses claim 39 deterministic lots. Every footprint is in bounds,
  non-overlapping, clear of authored road corridors, and represented on the
  full city map. Three flagship macro-campuses deliberately interrupt the
  standard grid: the four-tile Neon General Hospital, six-tile Pulse football
  stadium, and six-tile Bellwether School. Their internal streets become
  continuous grounds while every perimeter street remains driveable.
- Each campus has one stable, walker-clear exterior entrance and one reused
  interior family. Geometry, collision, semantic water, and interactions are
  emitted per occupied tile by that tile's owning chunk. Visible landmark water
  is physically impassable.
- Ordinary populated blocks carry six ambient walkers—double the original
  street population—split across two deterministic sidewalk lanes. Generic
  perimeter pedestrians remain suppressed on landmark tiles; landmarks use
  authored people and furniture so walkers cannot clip unique geometry.
- Normal lot contents and collision footprints are inset to create a sidewalk
  ring roughly 2.5× the former usable width. Roads and landmark campus
  footprints keep their authored dimensions.
- The six original portal IDs and positions remain compatibility contracts.
  In particular, APEX HOTEL remains the destination for `cold-crate`.
- Northstar Range adds nine regional anchors: Northstar Gate, Timber Pass Gas &
  General, Northstar Village Square, Timberline Lodge, Pinewatch Ranger Station,
  Old Spruce Mill, Mirror Lake, Silver Run Resort, and Aurora Lookout. Mirror
  Lake is semantic, impassable water; every enterable anchor keeps one clear
  exterior portal.
- Northstar terrain uses shared 9-unit triangles for rendering and contact.
  Road cuts, graded building benches, bridges, cliffs, and elevated water are
  physical. Steep uphill faces block taxi/foot movement; downhill drops permit
  falling and landing. The five authored roads connect the city, village, lake,
  and summit, with level merge landings and no invented northern perimeter road.
  Fares, interaction prompts, interior returns, gas proximity, cameras, and
  traffic respect elevation. All nine named anchor IDs and services remain.
- Copper Mesa uses the same terrain/contact engine with desert mesas, a cinder
  cone, dry washes, a river canyon, seven scenic roads, and ten level destination
  terraces. The city and Palm Reach seams meet z=0; the south edge has no perimeter
  road. The rock arch has a solid crown and an open road passage; river water
  has an excavated bed and matching collision. All ten named anchors and their
  services remain, with elevated fare approaches, portals, gas proximity,
  walking, traffic, and GPS using the same ground heights.
- Palm Reach extends southeast to 198 chunks, with a tapered peninsula,
  open bay and ocean, a continuous beach promenade, eight connected scenic
  roads, and ten redesigned destinations. The `cypress-reach` key, destination
  keys, venue IDs, and service kinds remain stable. The north Cedar entry and
  west Copper approach meet z=0; Mirage Bay Causeway rises to a physical z=9
  bridge. All other land stays level. Shore meshes, semantic water, collision,
  and both GPS views consume identical bands. Roadside palms, furniture,
  entrances, pedestrian frontages, and both traffic lanes must stay clear.
  Southern dispatch serves the extension without changing the six-fare market.
- Solana Coast uses shared terrain/contact with a low beach, physical coastal
  bluffs, sage hills, a canyon climb, seven connected scenic roads, and ten level
  destination terraces. Its City seam stays exactly at z=0. The pier has an
  uninterrupted 288-unit walking deck beneath an animated wheel; canal water
  is solid below drivable bridge decks. All ten anchor services and the pier's
  established entrance remain. Fares, walking, traffic, and GPS share elevation.

## Fares

- Every real run owns a browser-seeded fare market. Each six-fare cycle samples
  six identities from the current service region's eligible roster and pairs
  them with seeded procedural curb slots derived from the active region. The
  cast contains 48 shared identities plus 24 pickup identities exclusive to
  each of Cedar Vale, Northstar Range, Copper Mesa, Palm Reach, and Solana
  Coast. Passenger cards have 168 stable art cells across twenty-eight physical
  3x2 portrait sheets; destination artwork has 96 categorized cells across
  sixteen sheets. The 63 named destinations use their actual model footprints,
  each with three distinct occasion cards. Ordinary neighborhood cards use the
  generated lot's building family. Art is selected by place semantics before
  snapshotting; a stop-ID hash may select an occasion, never an unrelated image.
  Curbs remain procedural and retain their stable IDs. Unit tests use
  explicit seeds for deterministic replay. The six-bit availability mask
  remains cycle-sized, never portrait- or procedural-supply-sized.
- A fresh six-fare market targets four distinct landmarks before filling with
  compatible neighborhood stops. Large/featured landmarks carry extra selection
  weight. All candidates retain the same road distance, safety and separation
  gates, so constrained markets can use more neighborhood stops.
- Waterfront artwork requires a semantic water footprint within three local
  street blocks. Named arrival curbs must serve the actual model; the long
  Solana Pier uses its nearby coast-road access. Misleading legacy IDs do not
  dictate the image: South Terminal is a bus station and Marina Arcade is inland.
- Empty rural lots cannot receive ordinary dropoffs. A compatible outdoor rider
  has a 1-in-20 outing roll, with at most one scenic fare per market; the stop
  must be a real trailhead or beach-access lot with matching artwork and purpose.
  The selected occasion persists through pickup, dropoff, the card deck and
  passenger review. Fare quotes, tips, six slots and regional rider history stay unchanged.
- Rider history is independent per service region. Selection excludes every
  identity already used in the active regional window until at least 50% of
  that region's eligible roster has appeared: 24 shared riders in Neon City or
  36 eligible riders in Cedar Vale, Northstar Range, Copper Mesa, Palm
  Reach, or Solana Coast. The next market restarts
  the window while still blocking the immediately prior six, preventing an
  obvious refill duplicate. Leaving and returning to a region preserves its
  unfinished history.
- The market rolls while the taxi is empty and not following a custom or
  courier route. After at least one block of travel, available ordinary fares
  beyond 5,000 displayed meters may retire and fresh region-eligible fares are
  seeded at validated curbs around the taxi. The system keeps up to three
  pickups within the 3,240-meter nearby radius, never grows beyond six slots,
  never re-enables a completed bit, and freezes the sole fare-six survivor.
  Crossing an active regional seam streams the remaining unaccepted slots from
  that region's rider deck and makes it the service region for the current
  cycle.
- Free Run starts On Duty and exposes the same Off Duty switch in Pause and the
  Regional GPS. Off Duty preserves the complete six-slot market, availability
  mask, rider history, and fare-six progress, but freezes rolling dispatch and
  target selection, hides passenger bodies/rings/beacons/map markers, and
  authoritatively disables pickup dwell. No visual fare-refresh notification is
  emitted in either duty state. Custom GPS routes remain available; clearing or
  reaching one returns to quiet free roam rather than passenger guidance.
  An onboard passenger or active courier locks duty status until that job is
  complete. Returning On Duty performs a bounded stream audit at the taxi and
  restores nearest-fare guidance without resetting progress.
- Once accepted, a fare stop has two immutable points: an off-road
  `pickup`/`dropoff` zone for
  its ring and dwell check, and a `pickupApproach`/`dropoffApproach` pose on an
  driveable street for GPS and distance economy. The road approach must remain
  inside the zone radius and be taxi-collision-clear at the center and tangent
  samples. City approaches stay on ordinary local streets; sparse-region
  fares may also use validated curb positions on authored roads, away from
  graph junctions.
- Zone centers must be inside world bounds and outside driveable road, solid
  collider, and semantic water. A deterministic disk sampler enforces a 47%
  ceiling for road, collider, water, and combined blocked overlap—buffering the
  player-facing 50% maximum—and requires at least 25% open non-road ground.
  Zones also stay clear of venue entrances, junction corners, and a standing
  passenger body.
- On cycle zero, job zero is a normal validated stop whose zone is 14–22 world
  units ahead and 6–8 units left of the starting taxi. Its road approach is
  also ahead, its canonical route is no longer than one block, initial guidance
  needs no U-turn, and nearest-fare synchronization must not retarget it. This
  keeps the first passenger, ring, and beacon in the opening camera view.
- Stops within one cycle are unique and at least one 36-unit block apart. A new
  cycle stays at least half a block from every prior pickup/dropoff and its
  first pickup is at least 72 canonical route units from the just-completed
  dropoff. Candidate search expands through finite radii and fails explicitly
  if six validated pickups and destinations cannot be found.
- Generated passenger legs cannot exceed 1,512 route units, keeping the larger
  catalog inside the existing timer and quick-bonus balance envelope.
- Each ordinary waiting market is constrained to one `fareServiceRegionId`;
  every non-transfer trip stays local to the region where it spawned. Rolling
  across a seam transfers that ownership only for still-unaccepted slots. Once
  fare five is dropped off,
  the sole remaining waiting passenger is guaranteed to become fare six's
  regional transfer, regardless of the order in which the six pickups were
  selected. Courier jobs do not affect this passenger-market progress.
- Promoting fare six preserves its existing rider, pickup ring, and validated
  curb; only the destination changes. The destination belongs to an active
  cardinal-neighbor region, sits at least eight blocks beyond the seam, and
  keeps the canonical leg between 360 and 2,160 route units, or up to 3,960 when
  Northstar, Copper, Solana Coast, or Palm Reach is either endpoint to accommodate
  winding roads and the extended peninsula. Depth is measured across the shared
  cardinal seam, independently of region height. Fare six remains
  GPS-prioritized until collected. On arrival, the old market is retired and
  the next six fares are generated locally in the destination region, where the
  same five-local-plus-one-regional cycle repeats. Region exclusivity governs
  where a rider may be generated, not where an already selected fare may be
  delivered. The destination is always selected from the active cardinal
  neighbors of the current service region; Palm Reach therefore connects
  only to Cedar Vale or Copper Mesa and never diagonally to Neon City.
- Every visible blue pickup remains actionable. GPS chooses the nearest
  available runtime assignment and must never fall back to landmark geometry or
  the authored campus registry. Its normal half-block anti-flicker margin is
  overridden when the selected pickup exceeds 5,000 displayed meters: the
  absolute nearest available fare takes guidance immediately.
- Pickup requires remaining within the objective radius at low speed for 0.18s.
- Dropoff uses route distance, elapsed leg time, collision cleanliness, and the
  current multiplier.
- Pickup/dropoff time and base payment use one `passengerDistanceQuote`. Event
  copy reports only time actually credited below the 99-second cap.
- Free Run preserves distance base pay, clean bonuses, combo scoring, and every
  passenger state transition, but credits zero seconds and removes the
  quick-time reward component so roaming never creates hidden time pressure.
- Fare economy uses the canonical street-route length between road approaches.
  Guidance and fare quotes use the same shared road graph, including Cedar's
  neighborhood roads and all cross-region links. Changing the route contract is a scoring change and
  must pass the exact fare fixtures.
- A completed fare locks the next objective for one second so the dropoff impact
  beat is not replaced by a nearby pickup.

## Courier contracts

- Courier work is an optional foreground assignment parallel to passengers.
  Never reuse `onboard`, `jobIndex`, or the passenger availability mask for it.
- One contract is active at a time. A passenger onboard blocks acceptance;
  accepting a courier contract suppresses passenger presentation without
  consuming the waiting fare pool.
- The board order is seeded per run/cycle. A contract quote includes both the
  parked taxi's route to its source and the source-to-destination leg; those
  distances are snapshotted on acceptance so payment cannot change mid-job.
- During Arcade Shift, distance-scaled approach time is credited on acceptance
  and delivery time is credited on completion, both subject to the 99-second
  cap. Free Run credits no time and shows no clock estimate on the board.
- Navigation always targets a city-space exterior entrance. Pickup and dropoff
  complete only at the correct semantic `courier-counter` inside its pocket
  venue; idling the taxi at the facade never completes a phase.
- The taxi must be parked near the pickup entrance before the counter releases
  cargo. The parcel is then loaded exactly once on re-entry, and handoff is
  blocked until the taxi is parked near the destination entrance. This makes a
  real taxi leg mandatory even though courier-only exploration pauses the run
  meter.
- Pickup awards the package once and switches the same objective controller to
  the destination. Completion awards score, cash, and one delivery exactly
  once, then passenger targeting resumes; meter time is Arcade Shift-only.
- `rush` contracts weight the quick-time bonus more heavily. `fragile`
  contracts carry a larger clean bonus. A collision removes the clean bonus but
  never hard-fails a contract. Free Run removes the quick-time component for
  both contract types while retaining distance, clean, and combo rewards.
- Cargo is shown on the taxi while driving and on the avatar while walking; it
  must never appear on both at once.

## Free Run completion

- Free Run never auto-finishes. The pause menu exposes an explicit end action
  that banks current fare through the same once-per-run career transaction as a
  timed shift. The page lifecycle rejects repeated completion calls.
- Free Run results are unranked: they never update Arcade Shift best score or
  enter the timed Run Log. Ending and banking does not erase the exploration
  score shown on the summary.

## Characterization fixtures

High-value fixtures are in `tests/game/`:

- exact forward, reverse, and boost replays plus progressive steering/drift invariants;
- pickup/dropoff state and semantic event payloads;
- route and U-turn thresholds;
- right-hand lane signs and deterministic traffic;
- all 803 active chunks, plus byte-stable center-city characterization and
  streaming/collision budgets;
- GPU packing and arrow instance counts.

When behavior should change, update implementation and the relevant fixture in
the same reviewed change, with the intended gameplay difference documented.

## Dev Mode

- Options is visible in the header and pause menu. Dev Mode defaults off and
  stores its normalized settings on this device. Turning it off restores the
  normal 1,000 m GPS thresholds and ordinary clock, boost and simulation speed.
- GPS reroute distance and U-turn savings accept 0–10,000 displayed meters.
  Updating thresholds does not itself discard the current route. A live
  readout exposes route revision/reason, deviation, remaining distance, position,
  speed, run seed and elapsed simulation time.
- Clock freeze and infinite arcade boost run inside the fixed-step simulation.
  Slow motion and 2× speed change step frequency, never `FIXED_DT`. Simulation
  handling never receives arcade boost. Single-step runs exactly one idle-input
  fixed frame while paused; seeded restart preserves run kind and driving model.
- Test destinations use the same validated curbs and occasion cards as dispatch.
  Teleport/reset checks real pavement, elevation, collision and traffic, and
  places the taxi upright. Loading a test fare preserves six stable rider slots.
- Position, time, boost, traffic, single-step, restart and test-fare tools mark
  the run as a playtest. This flag remains after disabling Dev Mode. Playtest
  results never add career earnings or run-log records; GPS tuning alone does
  not mark a playtest.
