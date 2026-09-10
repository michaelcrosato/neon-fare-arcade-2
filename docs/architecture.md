# Architecture

Neon Fare has two halves: deterministic game code under `game/`, and browser
orchestration and presentation under `app/`.

## Dependency flow

```text
model
  └─ config + road-layout
       └─ road-network ──┐
            └─ math      │
       ├─ state + collision
       ├─ navigation ◀───┤
       ├─ world ◀────────┤
       ├─ traffic ◀──────┤
       ├─ simulation ◀───┘
       └─ render contracts and scene builders
            └─ app renderers + page runtime + UI
```

Modules use direct imports instead of barrel exports so an AI agent can see the
true dependency in one hop and avoid accidental cycles.

## Runtime ownership

`app/page.tsx` is the browser composition shell. It owns React state, input and
audio refs, modal focus, and user actions. `app/runtime/use-game-runtime.ts`
owns the animation frame, city stream, camera smoothing, renderer selection,
and fallback. Each fixed tick calls `stepGame(...)`. The simulation mutates the
current `Game` object in place to avoid 60 Hz allocation churn, then returns
ordered `SimulationEvent` values. The runtime immediately hands those values to
the exhaustive switch in `app/runtime/present-simulation-events.ts` for sound,
announcements, modals, and impact cards. Adding a new event without adding its
presentation is therefore a TypeScript error.

The order is intentional: building collision, traffic collision, fare event,
then clock warning. Do not batch events until the end of a rendered frame.
A service event can pause during a catch-up frame. Stop the remaining ticks
at that boundary and discard their accumulated time before resuming.

Career progression is split along the same boundary. `game/career.ts` contains
pure banking, prerequisite, purchase, and loadout rules. `app/use-career.ts`
persists that state to the current device and migrates pre-career run logs once.
Both the Run Log UI and legacy migration use `app/runtime/run-records.ts` to
reject malformed rows and retain up to five valid entries from local storage.
Interior service events carry stable semantic IDs; React opens the appropriate
hub without parsing labels or importing browser APIs into simulation code.

Courier assignments follow the same boundary. `game/courier.ts` owns the
contract catalog, availability mask, phase transitions, reward rules, map
markers, and semantic counter resolution. `game/state.ts` exposes the
interaction objective, navigation target, key, and type so passenger and courier
consumers cannot drift apart. React owns only the contract-board modal,
announcements, and impact presentation.

Run kind is orthogonal to lifecycle mode and player location. `game/run-rules.ts`
owns the pure Arcade Shift/Free Run policy used by simulation, passenger, and
courier rewards: only a timed shift can advance, credit, warn, expire, or award
quick-time value. React owns mode selection and the untimed presentation, while
career banking remains a shared one-shot end-of-run operation guarded by the
page lifecycle. Free Run is deliberately excluded from the timed best score and
Run Log.

Passenger assignments are run-owned data rather than static config lookups.
`game/passengers.ts` owns 48 shared identities plus five 24-rider pickup casts
exclusive to Cedar Vale, Northstar Range, Copper Mesa, Palm Reach and Solana Coast, with
independent regional usage windows. A market draws only fresh eligible
identities until half of that region's deck has appeared; the window then resets
while the immediately previous six remain blocked.
`game/fare-placement.ts` derives finite curb candidates from each active
region's enabled local streets and authored roadside geometry, ranks them by
seed, and validates candidates against generated colliders, semantic water,
road class, portals, world bounds, and taxi clearance. Every accepted stop
snapshots an off-road interaction zone and a separate driveable road approach.
`game/fare-market.ts` pairs those stops with selected identities and owns the
shared distance quote. Selection, navigation, and rendering consume the same
six stable `Game.fareJobs` slots. Unaccepted local slots beyond the rolling
market radius may be replaced with fresh, region-eligible fares near the taxi;
picked-up jobs, availability bits, completed progress, and fare six never move.

`game/destination-cards.ts` classifies all destination artwork and connects
named places to their actual model bounds and occasion cards.
`game/destination-environment.ts` maps generated built lots and rare rider-matched
outings to that artwork. Placement favors landmarks while retaining the same
procedural safety, distance and six-slot invariants. Selected cards travel with
the job through semantic events, reviews and both mobile and desktop presentation.

Dev Mode settings are normalized in `game/development-settings.ts` and persisted
by `app/use-development-mode.ts`. Pure landmark/reset commands live in
`game/development-actions.ts`; paused stepping/restarting and their presentation
live in `app/runtime/development-actions.ts`. The main frame loop reads the same
settings and retains fixed-step physics. Clock/boost changes are deterministic
simulation rules. A sticky run flag excludes playtest results from banking and
the run log. Navigation diagnostics report adoption separately from progress.
`game/fare-selection.ts` also owns the Free Run duty switch. Off Duty freezes
passenger dispatch and presentation without discarding the market; returning
On Duty performs one bounded stream/selection pass. Stream refreshes stay
visually silent; both the simulation event and direct duty reactivation warm
the newly selected passenger art.
Rings and dwell use the zone; GPS and economy use the approach.
`game/route-geometry.ts` holds the lower-level
canonical route helpers so reward math does not create a dependency cycle
through `game/state.ts`. City/Cedar trips retain the compact legacy street
route where it is valid; a trip touching Northstar, Copper Mesa, or Palm
Reach uses the same sparse-road graph and A* route as the regional systems.

The first cycle has one extra presentation constraint: placement reserves a
fully validated curb slot just ahead and to the camera-clear side of the taxi,
then stores it at fare index zero. `makeGame` selects that index directly. The
remaining five jobs and every later refill follow the ordinary seeded ranking.

Named city landmarks are authored in the data-only `game/landmarks.ts`
registry. A definition owns a stable ID, label, origin block, rectangular
footprint, orientation, visual style, and one portal tile. `world.ts` resolves
each occupied block independently and emits only that tile's boxes, colliders,
water, and interaction data into the owning chunk. This allows campuses to
cross chunk boundaries without distant collision ownership. Most campuses
retain the ordinary 36-unit street grid between modules. The flagship
grid-interrupting campuses are registered once in `game/campuses.ts`; that
topology is shared by road surfaces, graph routing, world pavement, traffic,
fare guidance, pedestrians, and both GPS maps.

Regional expansion is data-driven through `game/regions.ts`. Neon City is the
center cell; Cedar Vale, Northstar Range, Copper Mesa, Palm Reach, and Solana
Coast occupy east, north, south, southeast, and west. Palm Reach extends seven
chunk rows farther south; all nine compass-slot identities remain stable.
Inactive compass cells remain non-playable even inside the rectangular hull.
Regional modules own their lot decks, anchors, portals, and visual builders.
Palm Reach separates shared shore/grid geometry, roads, destinations, buildings,
landscape, distant skyline proxies, and animation into `reach-*` modules;
`wetland.ts` remains the compatibility entry point. Cedar's homes and campuses
live in `residential-buildings.ts`. `game/regional-content.ts` provides the exhaustive shared
metadata consumed by campus and map integration. `world.ts` owns center construction plus cross-theme dispatch and streaming. See
[regions.md](./regions.md) for coordinate ownership, active-cell rules, budgets,
and the checklist for adding the next regional theme.

`game/interiors.ts` is a venue registry rather than a label switch. Each
`VenueKind` selects a structural layout family and stable service IDs. Exterior
portal IDs, courier contract stops, and interior service IDs are persistent
content contracts; changing them requires the portal/courier fixtures to move
in the same review.

Fare scoring uses one canonical street-route distance between the pickup and
dropoff road approaches. In the original City/Cedar grid, active guidance may
still choose a faster authored shortcut without silently rebalancing payouts.
Sparse-region and cross-region distances use the shared graph because no
complete baseline grid exists there. Changing either route contract changes
pickup time bonuses, dropoff fare, and score; the exact fixtures in
`simulation.test.ts` make that dependency visible.

## Hybrid road network

`road-layout.ts` is data only. Curves are pre-sampled deterministic polylines;
each road declares its class, width, lanes, travel weight, grid-connection
policy, and authored junctions. `road-topology.ts` determines which local-grid
segments actually exist, including campus closures and every sparse regional
skeleton. `road-network.ts` builds the shared graph once, splits legal
at-grade crossings, removes disabled grid traversal, and exposes A*-based
routing plus projection, surface, and path-sampling APIs.

The same definitions drive five consumers:

1. `world.ts` carves corridor lots before generating buildings and streams the
   road surfaces with their owning chunk.
2. `navigation.ts` compares the legacy local-street route with graph shortcuts
   while preserving the forward-first U-turn policy.
3. `simulation.ts` uses shared surface queries for off-road grip, elevation,
   and recovery. Road class does not grant a speed bonus.
4. `traffic.ts` samples closed road paths with arbitrary headings and right-hand
   lane offsets.
5. `GpsMap` draws the exact authored polylines.

Do not implement a road in only one consumer. Regional cliffs, mesas, levees,
bridges, and raised structures provide visual elevation, but every driveable
surface remains on the shared flat plane. True grades and grade-separated roads
require elevation-aware vehicle, traffic, collision, camera, navigation, and
fallback-renderer contracts and remain intentionally deferred.

## Deterministic systems

World chunks, starting traffic, route selection, collision, and fixed-step
physics are independently testable without React or a browser. Runtime effects
use `Math.random` by default, while tests inject a deterministic random source.

`CityStream` caches generated chunks. Visual streaming may use radius 3 while
collision queries remain radius 1. That separation is a performance and game
feel contract.

## Rendering boundary

Both renderers receive the same `Game`, `Camera`, `WorldView`, and
`NavigationPlan`. Shared box construction lives in `game/render/scene.ts`.
WebGPU buffer layout lives in `packing.ts`; camera/view math lives in
`camera.ts`; the canonical arrow silhouette lives in `navigation-glyph.ts`.

Concrete rendering lives in `app/webgpu-renderer.ts` and
`app/canvas2d-renderer.ts`. The regional and compact SVG maps live in
`app/gps-map.tsx`. `app/runtime/use-game-runtime.ts` owns Canvas-first startup,
WebGPU activation after the first successful frame, fallback selection, resize
coordination, and renderer cleanup order. `app/page.tsx` composes that hook with
the typed menu, stage HUD, session overlay, and modal-host components.

## Runtime diagnostics

Diagnostics are visible automatically in development and on a production URL
only when `?diagnostics=1` is present; `?diagnostics=0` disables them locally.
The paused screen can copy a versioned JSON snapshot containing the current
run, recent runtime errors, and up to three 300-tick segments. Every segment
starts from a full `Game` checkpoint and records the exact input mask, RNG
values, ordered events, and the precise `CityStream.update` focus, radius, world
key, and object counts used by each step. This matters because several catch-up
ticks may share a pre-frame world even after the taxi crosses a chunk seam.

`app/runtime/diagnostics-replay.ts` reconstructs each retained segment with a
real `CityStream`, rejects missing or extra RNG calls, and verifies world
identity and ordered events. A throwing step preserves its attempted input,
world context, RNG values, original error, checkpoint, prior ticks, and
partially mutated `Game`. Browser-owned mutation boundaries start a new
checkpoint without discarding the lead-in trace, retain a human-readable
boundary reason, and remain final-state verifiable. A deterministic step error
pauses the session immediately so repeated animation frames cannot overwrite
the first failure or evict its lead-in.

## Presentation styles

`app/globals.css` is intentionally only an import manifest. The numbered files
in `app/styles/` preserve the former single stylesheet's exact source order:
foundation, stage effects, fare presentation, menu, HUD/navigation, controls,
modals/map, career services, responsive/accessibility rules, then courier UI.
The ordering is part of the presentation contract. In particular, global
responsive and reduced-motion overrides stay late and courier-specific rules
stay last unless a visual change explicitly redesigns that cascade.

## Failure handling

Renderer and frame exceptions retain the existing graceful fallback behavior,
but now pass through `app/runtime/runtime-errors.ts`. Browser clocks, logging,
and error buffering no longer leak into `game/`. Messages are scoped and
throttled, and recent records are included in copied diagnostics.
