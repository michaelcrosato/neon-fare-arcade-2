# Deterministic game code

## Boundary

`game/` may import other `game/` modules only. No React, Next, DOM, browser
clocks, audio, storage, or concrete renderer APIs. `stepGame` mutates `Game` at
fixed-step cadence and returns semantic events.

## Ownership map

- Contracts: `model.ts`; dependency-neutral region IDs: `region-types.ts`.
- Tuning/materials/limits: `config.ts`; taxi packages: `driving-traits.ts`.
- RNG: `random.ts`; shared geometry math: `math.ts`.
- Run creation/objectives: `state.ts`; fixed-step transitions: `simulation.ts`;
  timed/free policy: `run-rules.ts`; HUD projection: `hud.ts`.
- Walking/pose: `player.ts`; exploration: `exploration.ts`; semantic actions:
  `interactions.ts`; pocket scenes: `interiors.ts`.
- Passenger roster/decks: `passengers.ts`; curb validation:
  `fare-placement.ts`; pairing/economy: `fare-market.ts`; targeting/rolling
  dispatch: `fare-selection.ts`; sixth fare: `regional-fares.ts`.
- Custom waypoint: `custom-destination.ts`; courier: `courier.ts`; career:
  `career.ts`; gas service: `gas-station.ts`.
- Roadside rescue and tow charging: `recovery.ts`; right-lane surface poses:
  `road-lanes.ts`; departing truck geometry: `render/tow-truck.ts`.
- Region registry/containment: `regions.ts`; shared regional metadata:
  `regional-content.ts`; regional map math: `regional-map.ts`.
- Cedar parcels/data/portals: `residential.ts`; street plan: `cedar-layout.ts`;
  buildings/campuses: `residential-buildings.ts`; meshes/palette: `cedar-assets.ts`.
  Northstar and Copper data/builders live in `mountain.ts` and `desert.ts`.
  Palm Reach uses `palm-reach.ts` with `wetland.ts` compatibility exports;
  `reach-layout.ts`, `reach-roads.ts`, and `reach-destinations.ts` own its plan,
  while `reach-assets.ts`, `reach-buildings.ts`, `reach-landscape.ts`,
  `reach-distant.ts`, and `reach-scenery.ts` own geometry and animation. Solana Coast owns its data,
  shore, and builders in `coastal.ts`; shared shore coordinates live in
  `coastal-layout.ts`.
- Ironwake's harbor, campuses and grid: `industrial-layout.ts`; freight roads:
  `industrial-roads.ts`; lots and meshes: `industrial.ts`, `industrial-assets.ts`;
  shared water and skyline: `industrial-landscape.ts`; machinery animation:
  `industrial-scenery.ts`; neighbor grades: `terrain/industrial-forms.ts`.
- Neon City street/green policy: `city-layout.ts`; curves: `city-roads.ts`;
  landforms: `terrain/city-forms.ts`; architecture and public realm:
  `city-assets.ts`, `city-buildings.ts`, `city-ground.ts`, `city-landmarks.ts`.
  Landmark identities: `landmarks.ts`; grid-interrupting footprints:
  `campuses.ts`; chunk generation/streaming: `world.ts`.
- Authored roads: `road-layout.ts`; enabled grid: `road-topology.ts`; graph and
  projection: `road-network.ts`; canonical route geometry: `route-geometry.ts`;
  traffic: `traffic.ts`.
- Renderer-neutral scene: `render/scene.ts`; camera: `render/camera.ts`; packing:
  `render/packing.ts`; navigation glyph: `render/navigation-glyph.ts`.

## Rules

- Read `docs/gameplay-contract.md` before behavior work, `docs/regions.md`
  before regional work, and `docs/rendering.md` before renderer-contract work.
- Taxi fields remain the parked taxi pose; use `controlledPose` for the active
  actor. Never replace the active-region union with its hull.
- Fare zones and their road approaches are different semantic points.
- Use semantic interaction and venue IDs; never branch on display copy.
- Pass explicit seeds in tests; simulation randomness remains injected.
- Use road topology/network as the shared authority; never add renderer-only
  asphalt or collision.
- Preserve fixed-step phase and event order when extracting simulation code.
- Add region metadata exhaustively through `region-types.ts`, `regions.ts`, and
  `regional-content.ts`; theme geometry remains in its owning module.
