# Rendering review — 5 September 2026

The pipeline already uses instanced cuboids, directional and hemisphere light,
procedural material detail, distance fog, a world-relative sky, occlusion
silhouettes, and an HDR scene target. A five-sample post pass resolves edges,
adds a small highlight glow, and applies color grading and vignette.

## Changes

- Canvas adds warm direct/cool ambient surface light, subtle facade bands,
  world-aligned building shadows, and two-layer contact shadows for vehicles,
  foliage, and nearby citizens. Jump shadows lose strength with elevation.
- The Crown cab's ground shadow no longer follows its rolling chassis. The
  WebGPU taxi shadow is also excluded from the yellow occlusion silhouette.
  Taxi body and cockpit geometry are unchanged.
- Canvas caches sky/vignette gradients on resize and replaces vehicle blur
  with small ellipse fills. The portrait vignette uses the larger viewport
  dimension, so it does not collapse into the center on a tall screen.
- Both renderers enforce their existing scene pixel budgets below native
  resolution when necessary. WebGPU respects device texture limits too.
  HTML HUD resolution is unaffected. These are workload bounds, not an FPS
  measurement or guarantee.
- Canvas parcel ownership now matches the shared model: loaded cargo stays
  on the parked taxi and is not also drawn in the walker's hands.

No gameplay, world generation, instance layout, camera uniform, WGSL, shader
binding, or new GPU pass was introduced. Shared scene geometry remains within
the existing actor and ghost budgets.

## Validation and limits

Lint, TypeScript, architecture, runtime replay, core gameplay, and exhaustive
world suites pass. New rendering fixtures cover 4K/8K/portrait/device-limited
targets, flat taxi shadows across complete rolls, body-only silhouettes, and
world-space light/shadow invariants. Managed Chrome ran the Canvas path; fixed,
high chase, low chase, and cabin views plus taxi exit were inspected. No scoped
game errors appeared in the browser console.

The managed browser did not activate WebGPU. Its CPU changes were reviewed and
tested through shared contracts; actual GPU output remains unverified here.
Contact shadows remain approximations: raised surfaces can hide the ground
plane in WebGPU. Full directional cast shadows are not part of this pass.

## Next GPU-only pass, after a supported-device baseline

1. Quantize light instead of RGB to preserve ink detail and palette ratios.
2. Derive sky rays from the actual cabin view basis so the horizon rolls with
   the vehicle; align the painted sun elevation with the lighting direction.
3. Trial a bounded nearby shadow map with stable texel snapping and a strict
   caster budget. Measure GPU frame time before increasing pass count.

Do not merge new WGSL or shadow bindings based only on TypeScript tests.
