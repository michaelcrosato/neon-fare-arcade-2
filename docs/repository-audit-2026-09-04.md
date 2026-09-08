# Repository audit — 4 September 2026

## Scope

Source audit of the current Neon Fare game. Reviewed vehicle physics,
exploration, camera math, GPU packing, browser runtime, saved data, fare art,
tests, and dependencies. This pass fixes proven faults. It does not rewrite
the engine or certify the whole application as fault-free.

## Fixed faults

| Fault | Evidence | Repair and regression coverage |
|---|---|---|
| Backward slides hit the reverse speed cap in Drive | A 100 km/h backward slide fell to 32.009 km/h in one tick | Remove the directional velocity clamp. Retain engine governors and the total-speed safety bound. Test backward momentum and normal reverse speed. |
| Broadside slides use parking-speed damping | A 100 km/h sideways slide fell to 87.081 km/h in one tick | Select low-speed behavior from total planar speed. Test left/right broadside slides. |
| Parked simulation cab moves after exit | Residual throttle moved the taxi about 0.67 world units in two seconds | Clear drive input, local velocity, and yaw on exit. Preserve rollover state. Test parking and continued rollover settling. |
| Simulation Cab View follows the parked taxi on foot | Renderer used taxi pose based on driving model alone | Use the rolling pose only while driving. Test walking, Arcade, and rolling-cab matrices. |
| Invalid Run Log rows crash the UI or migration | Null rows fail score access; missing fields fail rendering | Validate rows before either consumer. Keep up to five valid rows and discard invalid rows. Test mixed data and legacy banking. |
| A pause event does not stop catch-up ticks | A 50 ms frame ran three ticks after the first tick opened a modal | Recheck live mode each tick and discard paused remainder. Test the real hook with a manual frame clock, then resume. |
| Simulation pickups promise nonexistent boost | Both cards and announcements said +8 boost | Pass driving model to presentation. Test Simulation and unchanged Arcade copy. |

The existing spin/coasting test depended on the old damping. After the fix,
its spin ends below 1 km/h, so a later demand for an 8 km/h loss is invalid.
The deterministic spin check remains. Coasting now has its own straight-line
fixture. Existing launch, brake-distance, full-lock, reverse, and rollover
checks remain in place.

## Measured optimization

`packBoxes` now writes directly into its Float32Array. It no longer creates
a temporary JavaScript array for every box. The 16-float protocol, defaults,
reserved zeros, and output bytes are unchanged.

Node CPU microbenchmark, three measured trials after warm-up:

| Boxes per call | Original time | Updated time |
|---|---:|---:|
| 600 | 0.0352–0.0375 ms | 0.0103–0.0157 ms |
| 37,240 | 2.0313–2.3163 ms | 0.6985–0.8841 ms |

This measures packing, not complete frame time or player-visible FPS.
Byte equality is covered by a regression test.

## Dependencies

React, React DOM, and React Server DOM Webpack move together from 19.2.6 to
19.2.8. This meets peer constraints and includes the RSC server-function
denial-of-service patch. [React advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g).

Vite moves from 8.0.13 to 8.0.16, within its existing minor series. This
includes the Windows development-server path fix.
[Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).

A no-force lockfile refresh also updates compatible transitive packages.
No major framework migration or dependency override was used.
The audit count drops from 20 package findings (17 high, 1 moderate, 2 low)
to 11 (10 high, 1 low). These counts include transitive and development tools;
they do not mean 11 proven attack paths in this game.

Remaining packages: Next, its nested PostCSS, Sharp, Cloudflare Vite plugin,
Wrangler, Miniflare, Undici, ws, nested esbuild, Vinext, and image-size.
These need a coordinated compatibility and security pass. In particular,
the suggested Vinext replacement is a major/pre-release migration. Do not
use `npm audit fix --force` as an unreviewed shortcut.

## Deferred checks

- The WebGPU sky has no roll input while the simulation cabin can roll.
  Correcting its shader needs GPU browser verification. No shader change was
  made in this pass.
- Help during countdown and repeated pause-key events need focused input
  tests. Their behavior was not changed.
- The friend-PC fare-art failure was not reproduced. All atlas files, hashes,
  dimensions, rider mappings, and generated asset URLs have source tests.
  No speculative image-loader repair was made.
- No browser playtest, WebGPU visual check, FPS claim, or public deployment
  is part of this source-only audit.

## Verification

Use the existing gates: lint, TypeScript, architecture, runtime, complete game
tests, production build, and rendered HTML. New tests cover the faults above.
The architecture checks retain the pure game/browser boundary and reject
import cycles. The React review kept save validation at the storage boundary;
no layout or hook lifecycle redesign was added.
