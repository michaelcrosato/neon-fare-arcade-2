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
- `webgpu-shaders.ts` builds the WGSL for the tier the device resolved to.
  Effect budgets and the sun/cascade math are renderer-neutral and live in
  `game/render/quality.ts` and `game/render/sun.ts`.
- `graphics-quality.tsx` is the saved graphics preference; `?graphics=<tier>`
  overrides it for one session.
- `use-career.ts` is the device-local persistence adapter.
- `use-fare-card-deck.ts` owns browser timing for card presentation.

## Rendering

- WebGPU and Canvas consume the same `Game`, `Camera`, `WorldView`, HUD, scene,
  and navigation semantics.
- `game/render/packing.ts` is authoritative for instance layout and capacity.
  Per-frame streams use `packBoxesInto` with a renderer-owned scratch array.
- TypeScript does not compile embedded WGSL. Shader, binding, stride, camera,
  and fallback changes require real renderer verification at more than one
  quality tier, because the WGSL and the bind group layouts differ per tier.
- The frame loop measures the stage once per resize. Do not call
  `getBoundingClientRect` per frame, and do not write canvas dataset attributes
  unless the value changed: together they force a layout flush every frame.
- `scripts/render-bench.mjs` reports frame-time percentiles and GPU pass times.
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

## Account sync

Neon Fare still has no server of its own, no D1 and no R2, and
`.openai/hosting.json` stays `d1: null, r2: null`. Do not introduce server
persistence without an explicit capability request.

Google sign-in is optional and deliberately serverless. The career is written
to the player's own Drive `appDataFolder` straight from the browser, so there
is no backend to run and no player data in our custody.

- `game/career-sync.ts` owns every rule: the save envelope, the fingerprint,
  and which side wins. It is pure and takes timestamps as arguments, because
  `game/` may not touch `Date`.
- `app/google-identity.ts` owns the GIS token lifecycle,
  `app/cloud-save.ts` the Drive requests, `app/use-cloud-career.ts` the
  orchestration, and `app/cloud-save-panel.tsx` the presentation.
  `app/cloud-save-surface.tsx` mounts them so `page.tsx` stays a shell.
- `use-career.ts` remains the source of truth during play. The account copy is
  a mirror; nothing on the sync path may sit between a banked run and
  localStorage, and signed out the game must behave exactly as it did before.
- Conflicts are ranked by monotonic progress, never by timestamp: a device with
  a wrong clock must not erase a career that is plainly further along. When
  neither save contains the other, ask the player.
- Scopes must stay non-sensitive (`openid`, `userinfo.profile`,
  `drive.appdata`). Adding a sensitive or restricted scope, an app logo, or an
  eleventh authorized domain forces Google verification and takes the published
  app offline for everyone until it passes.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is public by design and there is no client
  secret anywhere in this project. With the variable unset the whole feature
  stays dark, which is what keeps tests and local dev unaffected.
