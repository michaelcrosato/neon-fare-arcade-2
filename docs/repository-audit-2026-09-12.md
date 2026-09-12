# Repository audit — 12 September 2026

Reviewed the pending Ironwake Works, mobile camera, fullscreen and music changes,
plus arcade speed limits, input/modal behavior, renderer packing, dependencies,
and both deployment toolchains.

## Repairs

- **Actual double-speed boost.** The old packages requested only 170 km/h, and
  a separate 180 km/h governor would also have blocked a larger boost cap.
  Stock boost now derives from twice the selected package's normal limit:
  Street Ace and Drift Demon reach 320 km/h from 160; Redline Rush reaches
  330 from 165. A regression test reaches those speeds from cruise using each
  package's finite starting tank. Empty tanks and release restore normal limits.
- **Overdrive composes with boost.** Its extra 60 km/h now sits above the
  doubled stock boost, yielding 380/390 km/h. Acceleration, drain, reverse,
  road-class policy and Simulation Free Run's powertrain stay unchanged.
  Collision tests exercise both stock and upgraded high-speed impacts.
- **Stable mobile wheel return.** Its existing 180 km/h reference is now
  independent of the vehicle governor. Tests cover 90, 180 and 330 km/h.
- **One keyboard toggle per press.** Repeated Pause or Mute keydown events
  could toggle state repeatedly. Action keys now ignore repeat events while
  movement still tracks held keys and releases.
- **Countdown dialogs.** Help could leave the countdown running behind the
  dialog. Modal state now remembers whether to resume countdown or play.
- **Build type generation.** Updated Vinext and Next generate different route
  declarations at the same path. The standalone typecheck regenerates Next's
  matching route types before checking. Scratch and build directories are
  excluded from source checking. Run the two builds sequentially.
  Next's automatic agent-file edits are disabled so starting the dev server
  preserves the repository's own contributor instructions.
- **Documentation.** Corrected the old 170/225 km/h limits, removed obsolete
  Beltway directions, corrected keyboard boost to Space and mobile boost to
  double-tap/hold gas, and completed the seven-region navigation description.
- **Existing CI failures.** The previous main-branch run failed browser checks
  that still expected the old 18× display scale. Altitude and navigation fixtures
  now assert the documented one-metre scale. The live camera test presents
  controlled frames before screenshots, avoiding continuous software-GPU work
  during capture. Six CI shards distribute individual cases instead of keeping
  large regional files together; one of the previous four shards timed out.
  Renderer fixtures now reuse stylesheet tags from the real server response,
  avoiding an unnecessary full game initialization before constructing their
  own scene. This removes a source of startup timeouts without relaxing any
  geometry, shader, pixel, layout or real-session checks.

## Measured rendering optimization

Surface packing no longer allocates index arrays and temporary vector objects
for each triangle, and it computes each unit normal once. Triangles and quads
retain the same order, normal signs, RGBA values and float32 bytes. Invalid
geometry and the existing upload budget still reject invalid input.

Node 24 CPU benchmark with three measured trials after warm-up:

| Faces per call | Before | After |
|---|---:|---:|
| 1,000 mixed faces | 0.135–0.267 ms | 0.117–0.135 ms |
| 60,000 mixed faces | 13.559–15.540 ms | 7.285–9.111 ms |

The benchmark also compared the entire packed buffers for exact equality.
This measures CPU packing during world uploads, not complete frame time or FPS.
Committed tests cover mixed triangles, nonplanar quads and reversed winding.

## Dependency compatibility and security

The initial npm audit reported 11 package findings: one critical, nine high
and one low. The updated lockfile reports **zero** findings, including dev
dependencies. A clean install used the declared npm 11.9.0 toolchain.

| Package | Previous | Updated |
|---|---|---|
| Next / eslint-config-next | 16.2.6 | 16.3.5 |
| Cloudflare Vite plugin | 1.37.1 | 1.54.8 |
| Wrangler | 4.92.0 | 4.131.1 |
| Vinext | 0.0.50 | 1.0.0-beta.9 |
| Vite RSC plugin | 0.5.26 | 0.5.34 |

Next includes the Windows-hosted server security patch and updated image
dependencies. [Next advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36),
[Next release](https://github.com/vercel/next.js/releases/tag/v16.3.5).
The Cloudflare packages move together to satisfy their peer constraints.
[Cloudflare release](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare%2Fvite-plugin%401.54.8).
Vinext's current beta removes the vulnerable image-size dependency and retains
the Worker entry points used here. Its peer requires the updated RSC plugin.
This is an explicit beta migration verified against both production builds,
not an automated force-fix. [Vinext release](https://github.com/cloudflare/vinext/releases/tag/vinext%401.0.0-beta.9).

## Verification

Release gates include `npm run check:fast`, `npm run check`, sequential Worker
and Next production builds, rendered HTML, browser input regressions, desktop
and touch layouts, all camera modes, both renderer paths and actual Ironwake
fare completion. The full world suite checks every active chunk and stream
window. The complete repository gate passed: 9 architecture, 35 runtime,
467 game cases and one rendered-HTML case, with lint, TypeScript and the Worker
build. The full browser run passed 110 of 118 scenarios; the eight failures
identified stale display-scale expectations, fixture startup timeouts and a
speed assertion that missed the brief full-boost plateau. All eight are covered
by the corrected 29-case rerun, which passed completely. All four real-input
boost checks reached 320/330 km/h in WebGPU and Canvas with a finite tank.
The final fast gate and both sequential production builds passed after the
documentation and menu changes. The production Worker preview also passed
nine focused browser scenarios: four boost checks, both real Ironwake fare
sessions, software rendering, repeated action keys and countdown dialogs.
