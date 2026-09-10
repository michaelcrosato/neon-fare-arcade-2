# Neon Fare engine rebuild

Source baseline: `C:\dev\neon-fare-arcade`, commit
`e5c449e710e7615aea5df249663fe8960307e16e`. The original checkout is unchanged.
The complete tracked source and art were imported as commit `beb9b8e` here.

## Required result

Keep the comic palette, low-poly city and character art, existing world identity,
and gameplay. Replace the flat road infrastructure with authored 3D curves,
variable widths, banking, hills, ramps, and genuine grade-separated crossings.
Navigation, pavement, vehicles, pedestrians, collision, fares, cameras, and both
GPS views must agree about the same roads. Improve arcade handling and feedback
without replacing the taxi game or removing its simulation option.

## Feature preservation and acceptance

- Six regions and all existing venues, landmarks, semantic water, deterministic
  generation, stable IDs, active-cell boundaries, and chunk budgets.
- Arcade Shift, Arcade Free Run, Simulation Free Run; all three arcade packages.
- Six rolling fare slots, 168 rider portraits, 30 destination images, regional
  transfers, passenger history, payouts, drift/near-miss/combo scoring and boosts.
- Walking, sprinting, jumping, crouching, taxi exit/re-entry and interior services.
- Couriers, custom destinations, both GPS maps, fare dispatch controls.
- Career bank, home/garage, gas services, permanent upgrades and local run log.
- Keyboard/touch input, pause/focus/accessibility, sound, reduced motion, all four
  cameras, Canvas startup/fallback and verified WebGPU rendering.

Existing suites are preservation evidence, not proof that the new engine works.
New tests must exercise real curved/elevated roads, bridge/underpass separation,
surface transitions, route continuity, swept collisions, and handling replays.
The final audit includes production build and actual desktop/mobile browser
playthroughs, with renderer-specific checks and visual inspection.

## Implementation sequence

1. Import and verify the full baseline; make the existing toolchain run natively
   on Windows while retaining its Linux build path.
2. Implement deterministic 3D road authoring, bounded adaptive sampling,
   arc-length frames, cross sections and spatial projection; migrate road data.
3. Rebuild routing around connected road surfaces, height-aware junctions and
   lane direction; retain coherent maneuver and map semantics.
4. Integrate elevation-aware vehicle/walking contact, traffic, collision and fare
   approaches. Author playable elevation changes and proper ramp connections.
5. Upgrade shared road geometry and renderer support, actor/camera alignment,
   bridge depth/occlusion, shadows and navigation cues in WebGPU and Canvas.
6. Tune arcade response, recoverable drifts, suspension, hill/landing feedback,
   keeping trait identities, rewards, upgrades and Simulation Free Run.
7. Run preservation suites, new invariants, budgets, production and browser
   gates. Fix discrepancies and document evidence before declaring completion.

## Delivered engine

- Bounded adaptive 3D curves, width/bank profiles, arc-length frames, swept
  pavement, spatial deck queries and height-aware physical intersections.
- One directed A* graph for fare distances and GPS, preserving departure
  direction, U-turn policy, maneuver hysteresis and active regional boundaries.
- This engine checkpoint included the elevated Neon Beltway and eight ramps.
  The later [Neon City rebuild](neon-city-reimagining.md) removes that unused
  structure; active regional bridges retain the shared deck/contact pipeline.
- Shared elevation/contact for driving, walking, traffic, collision, arrivals,
  shadows, route markers and cameras. Cockpit geometry follows the same pose
  as the driving eye. Canvas and WebGPU both render the physical road surfaces.
- Faster arcade launch, progressive steering with continuous yaw, countersteer
  recovery, body load transfer, crest takeoff and landing suspension. Existing
  traits, reverse, upgrade effects, speed ceilings and fare math are retained.
  Simulation keeps its original ground vehicle model; tire forces now require
  ground contact when it leaves an elevated road.
- Native Windows npm lifecycle and self-hosted copies of the original fonts.
  Menu actions become available after career hydration, preventing early
  selection from being lost during initialization.

## Verification — 2026-09-08

- Initial destination was empty; original worktree was clean.
- All 215 tracked source/art/config files are present in the new checkout.
- Locked npm install completed with Node 24.20.0 on Windows.
- Baseline architecture/runtime: 18 tests passed.
- Final `npm run check`: lint, strict TypeScript, 9 architecture tests,
  9 runtime/replay tests, 281 deterministic game tests, production build,
  Worker artifact validation and the rendered HTML test all passed.
- `npm run test:browser -- --workers=1`: all 10 tests passed, covering arcade
  and simulation selection, driving, walking/re-entry, GPS, pause, diagnostics,
  modal focus, valid/malformed saves, mobile held-touch input and both renderers.
- Actual WebGPU and Canvas rendered ramp, bridge and underpass scenes in all
  four cameras (24 captures). Visual review caught and fixed the missing raised
  cockpit and Canvas underside overlap; refreshed captures pass.
- Ordinary control inputs completed all eight ramps, both directions, in both
  vehicle models: 32 journeys, zero collisions. Additional tests check both
  lane clearances, bridge/ground separation, walking jumps and ceilings,
  deck-aware re-entry/speed bonuses, traffic height, airborne forces and landing.
- Exhaustive generation checks cover all 726 active chunks and regional stream
  windows, including road/fare/portal/pedestrian/water and rendering budgets.
- Fare-art manifest checks pass; all 168 rider cells and 30 destination cells
  are unchanged. The original checkout remains clean and untouched.

The curve migration and wider outer ramps intentionally change some procedural
lots: Neon City now has 1,469 generic/landmark portals in its characterization
test, versus 1,476 before. All named landmarks, venue families, home/service
identities and regional features remain covered. Central-city chunk and stream
counts/hashes were reviewed and updated for the new geometry and structures.

Build/test logs are in the ignored `outputs/` directory. Browser captures are
under ignored `test-results/`. See `road-authoring.md` for extension points and
`gameplay-contract.md` for the revised handling contracts.
