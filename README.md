# Neon Fare — Comic Overdrive

An arcade taxi game with a deterministic, streamed six-region low-poly world,
WebGPU rendering, Canvas fallback, multiple cameras, and shared turn-by-turn GPS
guidance. It runs on [vinext](https://github.com/cloudflare/vinext).

Drivers can leave a stopped cab and explore the city on foot. In Arcade Shift,
the meter pauses only while the taxi is empty; Free Run is always untimed. Neon
Lofts provides the device-local career and garage home base, and banked run
fares fund persistent upgrades.

## Code map

- `game/`: deterministic gameplay, navigation, collision, world generation,
  regional content, and renderer-neutral scene contracts
- `app/`: React UI, browser lifecycle, audio, persistence adapters, and the
  concrete WebGPU/Canvas renderers
- `tests/game/`: deterministic behavior, world, and budget characterization
- `docs/gameplay-contract.md`: normative game-feel and compatibility rules
- `docs/regions.md`: active-cell geography and regional expansion contract
- `docs/rendering.md`: renderer protocol, camera, and streaming contracts
- `docs/assets.md`: fare-art atlas manifest and provenance requirements
- `docs/change-recipes.md`: safe paths for common modifications
- `AGENTS.md`, `app/AGENTS.md`, `game/AGENTS.md`, `tests/AGENTS.md`: scoped
  guidance for people and coding agents

## Requirements and setup

- Node.js `24.19.0` is the checked-in development target; the supported floor
  remains `>=22.13.0`.
- Linux build helpers require `flock`, `curl`, and GNU `timeout`.

The Sites lifecycle prepares dependencies automatically. For a standalone
checkout, run `npm ci` once. Edit deterministic gameplay and world code under
`game/`; edit browser runtime, concrete renderers, UI, and styles under `app/`.

## Quality commands

- `npm run test:file -- tests/game/player.test.ts`: run one focused test file
- `npm run test:core`: run the quick gameplay suite
- `npm run test:world`: run exhaustive geography and budget coverage
- `npm run test:unit`: run all deterministic game tests
- `npm run typecheck`: enforce the strict TypeScript contract
- `npm run check:fast`: lint, typecheck, architecture checks, and core tests
- `npm run check`: the complete test, production-build, and rendered-output gate
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

`.vinext/fonts/` is intentionally retained for the existing offline font build;
do not hand-edit it. Migrating those fonts to stable public assets is a separate
visual-verification task because changing font loading can alter layout.
