# Rendering engine audit — 2026-09-16

Target platforms: Samsung Galaxy S25 (Chrome, WebGPU) and desktop with an
RTX 4070 Super. Measured on the 4070 Super at 1600x828 with vsync disabled,
driving forward through Neon City's starting core.

## Baseline

| path | CPU frame (mean) | p50 | p95 |
| --- | --- | --- | --- |
| WebGPU, chase low | 1.08 ms | 0.9 | 1.6 |
| WebGPU, fixed ISO | 1.11 ms | 0.9 | 1.7 |
| Canvas / WebGL2 fallback | 2.34 ms | 2.0 | 3.6 |

Desktop had roughly fifteen times the headroom needed for 60 Hz and eight times
for 144 Hz. Nothing was resolution or fill bound; the ceiling was the JavaScript
frame loop. That is what made the effect work affordable.

## Findings

Ordered by the size of the effect, not by where they were found.

1. **Every opaque cuboid rasterized both sides.** All pipelines used
   `cullMode: "none"`, so each box shaded six faces instead of three. The
   geometry is closed and consistently wound; only a possible negative instance
   scale made culling unsafe, and a cube is symmetric about all three axes, so
   `abs()` on the scale in the vertex shader makes the winding uniform without
   changing any silhouette. Both shared projections mirror X, so the outward
   faces arrive clockwise.
2. **The frame loop forced four synchronous layouts per frame.** Both renderers
   wrote `canvas.dataset.vehicleDetail`, `dataset.horizonRegion` and
   `dataset.renderer` on every frame, and the four HUD presenters then each
   called `getBoundingClientRect`. Attribute write plus measurement is the
   textbook layout-thrash pattern. The stage is now measured once per resize and
   dataset attributes are only written when the value changes.
3. **Per-frame garbage in the packing path.** `packBoxes` allocated a fresh
   `Float32Array` for every stream on every frame — in the WebGL fallback that
   was up to ~730 KB per frame for the streamed city alone. `packBoxesInto`
   writes into renderer-owned scratch arrays instead.
4. **The WebGL fallback re-resolved uniforms and reallocated buffers every frame.**
   `getUniformLocation` is a validated string lookup and was called eight or more
   times per frame; `bufferData` with a new typed array reallocated the buffer
   store every frame. Locations are cached at link time and the stores now grow
   geometrically and are filled with `bufferSubData`.
5. **The Canvas fallback held a second GPU context for the whole session.**
   `Canvas2DRenderer` builds a `WebGLScene` — its own canvas, program set,
   instance buffers and 16 MiB of horizon textures — and kept it alive after
   WebGPU took over. It is now released on WebGPU activation and rebuilt only if
   the fallback is actually needed again.
6. **Five bind groups for one uniform.** `layout: "auto"` produced a separate
   bind group layout per pipeline. One explicit layout now serves every scene
   pipeline.
7. **Twenty-three sequential float comparisons per fragment.** The material
   treatments were an `if` chain on a float. They are now one `switch` on the
   flat integer material id.
8. **No sun shadows.** Only the painted contact decal under the taxi and
   Canvas's elliptical blobs existed. Buildings, trees, signs and the player's
   own car did not darken anything.
9. **No real antialiasing.** A five-tap edge blur in the composite stood in for
   it, which softened silhouettes instead of resolving them.
10. **Bloom had no radius.** The "glow" reused the four antialiasing taps, so it
    could only brighten the pixel next to a bright one.
11. **No ambient occlusion, no dithering, no sharpening, and an ad-hoc tone
    curve** in the composite.
12. **No device tiering and no adaptive resolution.** One fixed 2.5 M pixel
    budget for every device, and no response to a device that could not hold the
    frame.
13. **No instrumentation.** No GPU pass timings and no way to reproduce a
    measurement, so any performance claim was unfalsifiable.

## What changed

- Back-face culling on the box pipelines; road, terrain and vehicle faces stay
  double sided because they are authored without a winding rule.
- Cascaded sun shadow maps (`game/render/sun.ts`): sphere-bounded, texel-snapped
  cascades, front-face-culled depth passes, hardware PCF, a cool pre-quantization
  shadow tint so the posterized bands stay crisp, and emissive materials exempt.
- 4x MSAA resolving inside the render pass, with `storeOp: "discard"` on the
  multisampled surface.
- A real bloom pyramid: soft-knee prefilter, thirteen-tap downsample chain,
  additive nine-tap tent upsample.
- Screen-space ambient occlusion using the Alchemy estimator over view positions
  and normals rebuilt from depth.
- A composite pass with exposure, a filmic shoulder, contrast-adaptive
  sharpening and a triangular-PDF dither for the sky gradient.
- Device tiers, a player-facing Graphics Quality preset, a `?graphics=` session
  override, and hysteresis-guarded dynamic resolution.
- The panorama draws after opaque geometry at the far plane with a
  less-or-equal depth test, so it fills only the pixels nothing else covered
  instead of shading a full screen of sky underneath the city.
- The same back-face culling, cached uniform locations, reused buffer stores and
  scratch packing in the Canvas/WebGL2 fallback.
- `window.__renderStats()` plus `scripts/render-bench.mjs` for reproducible
  frame-time and GPU-pass measurement.

## After

Same machine, same route, same viewport, at the `ultra` tier — three cascades,
4x MSAA, five bloom levels and ambient occlusion:

| path | CPU frame (mean) | was | GPU shadow | GPU scene | GPU composite |
| --- | --- | --- | --- | --- | --- |
| WebGPU, chase low | 1.03 ms | 1.08 | 0.116 ms | 0.163 ms | 0.019 ms |
| WebGPU, fixed ISO | 1.00 ms | 1.11 | 0.108 ms | 0.167 ms | 0.019 ms |
| Canvas / WebGL2, chase low | 2.18 ms | 2.34 | — | — | — |

The whole lighting stack costs about 0.3 ms of GPU time and no measurable CPU
frame time: back-face culling and the removed per-frame allocations paid for the
shadows, the multisampling and the bloom chain, and both paths ended slightly
faster than they started. The frame is still bounded by the JavaScript loop,
which is where the remaining desktop headroom is.

One measurement deserves a caveat. On this adapter the single-sample
`compatibility` scene pass measured *slower* than the multisampled one
(0.83 ms against 0.18 ms). That is consistent with NVIDIA's multisample colour
compression on a 16-bit float target, but it is one GPU and one driver; do not
generalize it to the mobile tier.

## Mobile expectations

The S25 was not measured directly — this machine cannot emulate an Adreno. The
`high` tier is a budget, not a measurement: at a 360x780 CSS viewport and DPR 3
the 2.5 M pixel budget resolves to a 720x1560 scene surface, with two 1024
cascades and a four-level bloom chain. The two shadow passes add roughly 800 k
vertices of depth-only work, which is vertex bound rather than fill bound and is
the cheap direction on a tiler. Confirm on hardware before treating the tier as
settled; `scripts/render-bench.mjs --mobile=true` drives the same route, and the
dynamic-resolution controller is the safety net if the budget is wrong.

## Not done, and why

- **Reversed-Z depth.** The 0.15-to-1200 range leaves roughly half a world unit
  of depth resolution at the far plane, so coplanar distant terrain can fight.
  A reversed-Z projection with `depth32float` would remove it, but the
  projection is shared with the Canvas and software rasterizers and with
  `render/clip.ts`, so it inverts depth comparisons in three backends at once.
  No z-fighting was actually observed in the regions checked, so this stays a
  recommendation rather than a change made on suspicion.
- **GPU compute culling.** The streamed city uploads once per world key and
  draws all of it. Compacting visible instances with a compute pass and
  `drawIndirect` would cut the vertex count roughly threefold, but the passes
  are vertex bound and already sub-millisecond on both the measured desktop and
  the mobile budget. Revisit if the draw distance grows.
- **A depth prepass.** It trades vertex work for fragment work, and tile-based
  mobile GPUs already resolve most of that overdraw in hardware.

## Verification

`npm run check` passes: lint, typecheck, the architecture/runtime/unit suites,
the build and the rendered-HTML test.

The Playwright suite was run serially against a production preview, because two
Chromium workers driving WebGPU with video recording cannot meet this suite's
eight-second assertion timeouts on this machine; the parallel run's traces show
the page spending twelve seconds loading before it ever reached
`requestAdapter`. Serial result: **226 passed, 24 failed**. Every one of those
24 reproduces identically on a clean checkout, verified by stashing the branch,
rebuilding and re-running the same files: `mobile-composition` (10),
`development-mode` (4), `boost-speed` (4), and the mountain, desert and coastal
GPS terrain tests (2 each). None are caused by this work.

Renderer behaviour was checked at more than one tier, since the WGSL and the
bind group layouts differ per tier: `?graphics=ultra` and
`?graphics=compatibility` both render every camera without console errors, and
changing the preset in Options rebuilds the device in place — observed going
from `compatibility` to `ultra` mid-session with WebGPU staying active.

## Unrelated pre-existing failure fixed

`tests/browser/game-smoke.spec.ts` expected a normalized career save without the
GT-R's fuel tank. `fullFuelTanks()` has included `gtr-r35` since the GT-R
shipped, so the expectation was stale and the suite could not pass. Confirmed on
a clean tree before changing it.
