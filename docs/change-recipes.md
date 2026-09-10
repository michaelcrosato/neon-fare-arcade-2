# Change recipes

## Add a building or district variant

1. For Neon City, add deterministic geometry in `game/world.ts`. Cedar buildings
   belong in `game/residential-buildings.ts`, with reusable meshes in
   `game/cedar-assets.ts`. For Northstar, Copper, Cypress, or Solana, edit the
   owning theme module. Use the chunk/lot random source rather than
   `Math.random`.
2. Add colliders only for solid footprints.
3. Run the world tests and inspect the changed budget totals.
4. Update the characterization hash only if the content change is intentional.
5. Inspect streaming boundaries from multiple camera modes.

## Add or resize a landmark campus

1. Neon City landmarks use `game/landmarks.ts` plus `game/world.ts`; regional
   anchors use the owning theme module. Keep existing IDs and portals stable.
2. Register any grid-interrupting multi-tile footprint through the shared
   regional metadata and `game/campuses.ts`. Each tile owns only its own boxes,
   axis-aligned colliders, semantic water, and portal contribution.
3. Keep ordinary streets between footprint tiles unless the campus belongs in
   the explicit `game/campuses.ts` grid-interruption registry. That shared seam
   must simultaneously drive road-network, traffic, navigation, fare-route,
   physics, pedestrians, world pavement, and both GPS maps.
4. Assert unique IDs/labels, non-overlap, bounds, special-road clearance,
   cross-chunk resolution, one clear portal, and solid water footprints.
5. Sweep fare seeds and rerun the exact world, pedestrian, portal, chunk, and
   radius-three stream budgets, then inspect the campus and full-map marker.

## Tune driving

1. Add or modify a replay fixture in `tests/game/simulation.test.ts`.
2. Change only `game/simulation.ts` and named tuning in `game/config.ts`.
3. Verify forward, reverse, steering, drift, boost, collision, and fare dwell.
4. Keep browser/audio effects in the simulation-event handler, not the step.

## Add or reshape a road

1. Edit only the data in `game/road-layout.ts`; sample curves densely enough
   that adjacent points stay below the seam limit in `world.test.ts`.
2. If the local grid changes, edit `game/road-topology.ts` so pavement, physics,
   graph routing, traffic, fares, pedestrians, and both GPS maps share the same
   enabled segments. Declare whether authored crossings are real junctions or
   grade-separated.
3. Keep destination landmark blocks clear unless moving that landmark is the
   explicit goal.
4. Let `road-network.ts` feed world carving, GPS, routing, off-road physics, and
   path traffic. Do not draw a renderer-only road.
5. Re-run world budgets, the cross-city route, the roundabout-island route, and
   both forward/reverse departure fixtures.
6. Preview at least one boulevard, curved parkway, interchange, highway, and
   roundabout in a driving camera and on both GPS map sizes.

## Change GPS or U-turn policy

1. Add threshold cases to `tests/game/navigation.test.ts`.
2. Change routes/cues in `game/navigation.ts` and tuning in `config.ts`.
3. Ensure minimap copy and 3D cue still use the same plan.
4. Run the simulation fare fixtures because canonical route length affects
   scoring and time bonuses.
5. Test starting aligned, perpendicular, and opposite the route.

## Change procedural passenger-stop placement

1. Change candidate geometry or validation in `game/fare-placement.ts`; do not
   add a coordinate catalog to config or `fare-market.ts`.
2. Preserve the zone/approach split: markers, waiting passengers, and dwell use
   the off-road zone; GPS and economy use the collision-clear road approach.
3. Keep the public 50% overlap rule buffered at 47% for road, collider, water,
   and combined obstruction, plus the open-ground, portal, junction, passenger,
   road-class, world-bound, and taxi-clearance gates.
4. Preserve the cycle-zero opener: its validated zone stays 14–22 units ahead,
   6–8 units left, route-near, visible, and selected after nearest-fare sync.
5. Sweep explicit seeds and adjacent cycles for determinism, six unique jobs,
   route bounds, block separation, prior-stop clearance, and stop supply beyond
   any former catalog size.
6. Keep timer, cash, event copy, and UI estimates on the shared distance quote.

## Add or replace fare-card portraits

1. Edit rider profiles in `game/passengers.ts`. The current cast is 48 shared
   riders plus five 24-rider pickup casts exclusive to Cedar Vale, Northstar
   Range, Copper Mesa, Cypress Reach, and Solana Coast; keep
   `FARES_PER_CYCLE` at six so roster growth never expands the six-bit
   availability mask or actor budget.
2. Passenger art cells are global indices `0..167` across twenty-eight sheets;
   destination art is `0..29` across five sheets. Coast destinations use the
   six new cells; existing regions keep their original `0..23` mapping. Keep those counters
   independent.
3. Keep all atlases at 1536×1024 with equal 512×512 cells, no panel bleed, and
   matching `300% 200%` CSS background sizing.
4. Attach passenger art to the rider profile and derive destination art from
   the procedural stop ID; carry both through the immutable job and semantic
   event.
5. Preserve the per-region 50% no-repeat window and keep region-exclusive rules
   scoped to pickup-market generation; fare six may deliver an existing rider
   across the seam.
6. Test every sheet boundary plus shared and every regional eligibility, deck
   exhaustion, adjacent-market blocking, and independent regional history when
   a sixth-fare transfer leaves and later returns to a region.

## Add an enterable venue

1. Add a stable portal in the owning city/regional content module; center and
   Cedar portal transforms currently dispatch through `game/world.ts`.
2. Add or reuse a semantic `VenueKind` and layout in
   `INTERIOR_DEFINITIONS`. Give each service a stable `VenueServiceId`; do not
   infer behavior from the displayed label.
3. Keep the entrance, outward return pose, interior entry, exit, and every
   service point clear for a radius-0.44 walker.
4. Stay below 128 interior boxes, 24 colliders, six interactions, 32
   interactions per chunk, and 720 in a radius-three stream.
5. Run the all-portals and all-interiors fixtures, then preview the entrance in
   all four lot orientations.

## Add a courier contract

1. Add a stable ID and authored source/destination `VenueRef` values in
   `game/courier.ts`. Both IDs and exterior points must exactly match generated
   portal metadata.
2. Keep the assignment parallel to passenger fields. Route consumers use
   `getObjective`, `getObjectiveKey`, and `getObjectiveType`; do not add a
   renderer-only destination.
3. Make both venues publish a semantic `courier-counter`. Pickup and completion
   may occur only at those counters. Preserve the source taxi-proximity gate,
   one-time parcel load event, and destination taxi-proximity gate.
4. Extend deterministic tests for wrong venue, repeated E, stage replanning,
   collision reward, passenger restoration, and cargo presentation.
5. Verify board acceptance, exterior guidance, indoor prompt, pickup impact,
   taxi/avatar cargo handoff, destination completion, and Canvas fallback.

## Change navigation arrows

1. Edit the one piece list in `game/render/navigation-glyph.ts`.
2. Keep `material: MAT_TURN` and use explicit `Box.pitch`.
3. Run `render-contract.test.ts`; remain at or below 32 boxes.
4. Preview the same cue while cycling every camera.
5. Distance labels belong to the shared glyph contract and HTML presenter;
   test their units, live distances and projected desktop/mobile placement.
   Road-lane markers belong to `game/road-lanes.ts` and `routeBoxes`, never the
   canonical routing or fare-distance calculation.

## Change roadside recovery

1. Keep charging, safe-road search, actor reset and tow state in `game/recovery.ts`.
2. Verify a fall below the Northstar gorge bridge, both driving models, walking,
   interior returns, live traffic, all regions and the $0/$99/$100 boundaries.
3. Preserve passenger/courier jobs, run clock and score. Record an external
   diagnostic checkpoint when the pause-menu action changes the game.
4. Verify the actual pause menu and free rescue, plus a paid receipt and the
   moving red truck in both renderers, all cameras and narrow-phone layouts.

## Change WebGPU instance data

1. Update `Box` in `model.ts` if the semantic field is new.
2. Update constants and `packBoxes` in `render/packing.ts`.
3. Update WebGPU buffer stride, attributes, and WGSL together.
4. Extend `render-contract.test.ts` with exact packed floats.
5. Test a real WebGPU browser; TypeScript cannot validate WGSL.

## Diagnose a frozen frame

1. Add `?diagnostics=1`, pause, and choose **Copy Diagnostics** as soon as the
   issue appears. Preserve the JSON with the report.
2. Replay each retained segment using `diagnostics-replay.ts`. Its world-key,
   world-count, RNG-consumption, event, and final-state checks identify the
   first deterministic divergence; `failedStep` preserves the first throwing
   attempt and its lead-in even if the user later resumes.
3. Open the browser console and find `[Neon Fare/<scope>]`.
4. `frame` indicates simulation/runtime orchestration; `render` identifies the
   active renderer; `webgpu-first-frame` points to shader/buffer setup.
5. Reproduce with Canvas fallback to separate gameplay from GPU failures.
6. Add a focused unit fixture before changing deterministic code.
