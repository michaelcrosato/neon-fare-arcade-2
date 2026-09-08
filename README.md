# Neon Fare — Comic Overdrive

An arcade taxi game with a deterministic, streamed six-region low-poly world,
WebGPU rendering, Canvas fallback, multiple cameras, and shared turn-by-turn GPS
guidance. It runs on [vinext](https://github.com/cloudflare/vinext).

The rebuilt road engine uses shared 3D curves for pavement, routing, traffic,
and tire contact. The Neon Beltway is elevated, with eight driveable ramps,
guardrails, supports, and streets underneath. Arcade taxis have a stronger
launch, responsive steering, recoverable slides, suspension weight transfer,
and crest/landing motion. All three modes and six regions remain available.

Northstar Range is now a physical mountain landscape: forested valleys,
terraced villages, a gorge viaduct, covered road gallery, high lake and waterfall,
summit hairpins, an observatory, and an animated gondola above a snow run.
Terrain, roads, buildings, fares, traffic, walking, cameras, and GPS share the
same elevations in WebGPU and Canvas.

Drivers can leave a stopped cab and explore the city on foot. In Arcade Shift,
the meter pauses only while the taxi is empty; Free Run is always untimed. Neon
Lofts provides the device-local career and garage home base, and banked run
fares fund persistent upgrades.

## Code map

- `game/`: deterministic gameplay, navigation, collision, world generation,
  regional content, and renderer-neutral scene contracts
- `game/roads/`: curve sampling, surface projection, 3D graph, intersections,
  supporting decks, and road structures
- `game/terrain/`: physical landforms, road cuts, settlement benches, watercourse
  beds, distant landscape, and GPS contours
- `app/`: React UI, browser lifecycle, audio, persistence adapters, and the
  concrete WebGPU/Canvas renderers
- `tests/game/`: deterministic behavior, world, and budget characterization
- `docs/gameplay-contract.md`: normative game-feel and compatibility rules
- `docs/regions.md`: active-cell geography and regional expansion contract
- `docs/rendering.md`: renderer protocol, camera, and streaming contracts
- `docs/road-authoring.md`: how to author curves, grades, widths and junctions
- `docs/rebuild-plan.md`: rebuild scope and verification evidence
- `docs/northstar-reimagining.md`: mountain expansion and verification evidence
- `docs/assets.md`: fare-art atlas manifest and provenance requirements
- `docs/change-recipes.md`: safe paths for common modifications
- `AGENTS.md`, `app/AGENTS.md`, `game/AGENTS.md`, `tests/AGENTS.md`: scoped
  guidance for people and coding agents

## Requirements and setup

- Node.js `24.19.0` is the checked-in development target; the supported floor
  remains `>=22.13.0`.
- Linux build helpers require `flock`, `curl`, and GNU `timeout`.
- Windows uses the same locked npm toolchain through native build/lint wrappers.

The Sites lifecycle prepares dependencies automatically. For a standalone
checkout, run `npm ci` once. Edit deterministic gameplay and world code under
`game/`; edit browser runtime, concrete renderers, UI, and styles under `app/`.

Start locally with `npm run dev -- --host 127.0.0.1 --port 4173` and open
`http://127.0.0.1:4173`. No credentials are needed. To inspect the new roads,
start Arcade Free Run and use GPS to set a waypoint on the outer Neon Beltway.
Follow the route onto an interchange; C cycles through the four cameras.
For the mountain region, select **N · RANGE** in the full GPS and set a waypoint
near Mirror Lake or Aurora Lookout. Follow Northstar Highway out of the city's
north edge, then climb the Silver Run Switchbacks to the summit.

## Quality commands

- `npm run test:file -- tests/game/player.test.ts`: run one focused test file
- `npm run test:core`: run the quick gameplay suite
- `npm run test:world`: run exhaustive geography and budget coverage
- `npm run test:unit`: run all deterministic game tests
- `npm run typecheck`: enforce the strict TypeScript contract
- `npm run check:fast`: lint, typecheck, architecture checks, and core tests
- `npm run check`: the complete test, production-build, and rendered-output gate
- `npm run test:browser -- --workers=1`: desktop/mobile play, both renderers,
  and 24 elevated-road camera captures (requires Playwright Chromium)
- `npm run build`: build and validate the deployable Sites artifact
- `npm run validate:artifact`: validate an existing production artifact

`check:fast` is the normal feedback loop. `check` remains authoritative before
publishing. CI runs the same complete gate on pull requests and pushes to main.

## Architecture rules

The fixed-step game under `game/` must not import React, Next, browser APIs, or
`app/`. Its source graph is checked for cycles. Browser code consumes semantic
events and renderer-neutral world/HUD contracts rather than recreating gameplay
rules. Read the nearest directory `AGENTS.md` before making a change.

The game is currently client-side. Career and run data are device-local; Neon
Fare does not use D1, R2, or account identity. Introduce hosted persistence or
authentication only as a separate, explicitly requested capability.

## Sites lifecycle

The locked install is bounded and concurrency-safe. `scripts/sites-env.sh`
provides disposable project-scoped home, npm, XDG, and temporary directories;
`.sites-runtime/` is generated and ignored. The production build emits and
validates the Cloudflare-compatible Sites artifact. Checkpoint only after a
coherent milestone is ready to inspect or publish.

Fonts are self-hosted in `public/fonts/` using the original WOFF2 files and
face/range declarations in `app/fonts.css`. `.vinext/fonts/` remains as the
original cache; startup no longer depends on cache-specific font URLs.
