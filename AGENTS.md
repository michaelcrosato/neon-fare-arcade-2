# Neon Fare contributor guide

Read this file, then the nearest directory-scoped `AGENTS.md` before editing.
Preserve gameplay unless the task explicitly requests a behavior change.

## Repository boundaries

- `game/` owns deterministic fixed-step state, world generation, roads,
  navigation, collision, jobs, and renderer-neutral scene/HUD contracts. It
  must not import React, Next, DOM APIs, audio, storage, or `app/`.
- `app/` owns browser lifecycle, React state, input, audio, concrete WebGPU and
  Canvas renderers, UI, styles, and device-local persistence adapters.
- `tests/game/` owns deterministic behavior and budget characterization. These
  tests import `game/*`, never `app/page.tsx`.
- `docs/gameplay-contract.md` is normative for game feel;
  `docs/regions.md` for geography; `docs/rendering.md` for rendering and stream
  budgets; `docs/change-recipes.md` for task-specific verification.

## Non-negotiable contracts

- World axes are `+x east`, `+y south`, `+z up`; simulation uses `FIXED_DT`.
- Use exact active-region containment, never the rectangular hull.
- Roads must agree across topology/network, pavement, physics, traffic, fares,
  pedestrians, and both GPS views.
- Gameplay stays renderer-neutral; WebGPU and Canvas remain semantically
  equivalent.
- Preserve stable IDs, seeded generation, six fare slots, semantic
  interactions, and chunk/stream budgets unless the task explicitly changes
  them.
- Do not combine structural moves with gameplay tuning. Move code unchanged,
  verify, then tune separately.

## Safe change sequence

1. Read the owning module and relevant contract or recipe.
2. Add or update the smallest focused characterization test.
3. Change the narrowest owner.
4. Run `npm run test:file -- tests/game/<name>.test.ts`.
5. Run `npm run check:fast`; run `npm run check` before publishing.
6. Perform browser verification when presentation, input, camera, CSS, or
   renderer behavior changes.

## Where to read next

- Gameplay, world, navigation, state, and regional content: `game/AGENTS.md`
- Browser runtime, UI, renderers, and styles: `app/AGENTS.md`
- Tests, fixtures, snapshots, and budgets: `tests/AGENTS.md`

Generated output, build artifacts, and dependency caches are not source.
Never commit `dist/`, `.sites-runtime/`, `.wrangler/`, or `*.tsbuildinfo`.
