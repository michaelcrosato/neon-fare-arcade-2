# Tests and characterization fixtures

## Commands

- One file: `npm run test:file -- tests/game/player.test.ts`
- Fast logic/gameplay suite: `npm run test:core`
- Exhaustive geography/budgets: `npm run test:world`
- Full deterministic suite: `npm run test:unit`
- Runtime diagnostics/replay: `npm run test:runtime`
- Browser smoke suite: `npm run test:browser`
- Standard feedback gate: `npm run check:fast`
- Publication gate: `npm run check`

## Rules

- Deterministic tests import `game/*`, never `app/page.tsx`. Runtime tests may
  import browser-free modules under `app/runtime/`.
- Pass explicit seeds and random sources; do not consume runtime RNG or wall
  clocks.
- Use typed builders from `tests/game/support/fixtures.ts` for shared worlds,
  jobs, input, and career state.
- Update a world hash/count only for an intentional reviewed content change.
- Prefer invariants and boundary cases over private implementation assertions.
- Retain exact payout and physics fixtures during refactors.
- Every region activation needs active-union, seam, route, fare, portal/water,
  pedestrian/traffic, map, chunk, and radius-three stream coverage.
- Renderer protocol changes need exact packing/capacity assertions; WGSL still
  requires browser verification.

## Test map

- Driving: `simulation.test.ts`, `driving-traits.test.ts`
- Fares: `fare-market`, `fare-selection`, `regional-fares`, `passengers`
- Roads/GPS: `navigation`, `mountain-roads`, `regional-map`
- World/regions: `world`, `regions`, regional theme tests
- Walking/interiors: `player`, `exploration`
- Rendering: `render-contract`; courier/career/gas use their named tests
- Runtime boundaries/replay: `tests/runtime/diagnostics.test.ts`
- End-to-end input, focus, storage, and mobile: `tests/browser/game-smoke.spec.ts`
