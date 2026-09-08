# Browser runtime and presentation

## Boundary

React and browser orchestration live here; deterministic rules stay in `game/`.
Panels and overlays consume typed contracts and must not recreate rewards,
eligibility, routing, purchase, or physics rules.

- `page.tsx` is the composition shell for React state, input/audio, modal focus,
  and user actions. Keep browser clocks and renderer lifecycle out of it.
- `runtime/use-game-runtime.ts` owns the fixed-step frame loop, city streaming,
  camera smoothing, renderer fallback, resize/visibility lifecycle, and cleanup.
- `runtime/present-simulation-events.ts` exhaustively consumes the semantic
  event union without mutating `Game`. New event variants must produce a
  compile error there.
- `runtime/diagnostics.ts` captures bounded checkpointed input/world/RNG/event
  traces; `diagnostics-replay.ts` verifies them without React or DOM APIs.
- `game-mode-menu.tsx`, `game-stage-hud.tsx`, `game-session-overlays.tsx`, and
  `game-modal-host.tsx` are typed presentation surfaces, not rule owners.
- `gps-map.tsx` owns compact and regional GPS interaction and SVG presentation.
- `webgpu-renderer.ts` and `canvas2d-renderer.ts` are concrete renderers only;
  renderer selection, fallback activation, and cleanup live in
  `runtime/use-game-runtime.ts`.
- `use-career.ts` is the device-local persistence adapter.
- `use-fare-card-deck.ts` owns browser timing for card presentation.

## Rendering

- WebGPU and Canvas consume the same `Game`, `Camera`, `WorldView`, HUD, scene,
  and navigation semantics.
- `game/render/packing.ts` is authoritative for instance layout and capacity.
- TypeScript does not compile embedded WGSL. Shader, binding, stride, camera,
  and fallback changes require real renderer verification.
- Preserve Canvas-first startup, WebGPU first-frame activation, fallback order,
  and cleanup behavior when changing `runtime/use-game-runtime.ts`.

## UI and styles

- Preserve keyboard/touch parity, focus behavior, live announcements,
  responsive layouts, and reduced-motion behavior.
- `globals.css` is an ordered import manifest. Its numbered files under
  `app/styles/` are cascade slices, not independently reorderable bundles.
- Keep component class prefixes stable. Preserve the numbered import order;
  global responsive/reduced-motion rules must remain late, and courier rules
  remain last until a separately verified cascade redesign.
- Visual or input changes require the relevant camera/mobile states and both
  renderer paths to be checked.

Neon Fare currently uses device-local state, not account identity, D1, or R2.
Do not introduce server persistence without an explicit capability request.
