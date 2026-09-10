import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import type { Game, Mode } from "../../game/model";
import { makeGame } from "../../game/state";
import { TouchDriving } from "../../app/runtime/touch-driving";

// Run the real hook body with a manual frame clock. Only React's effect and
// browser services are replaced; no browser or graphics context is required.
const sourceUrl = new URL("../../app/runtime/use-game-runtime.ts", import.meta.url);
const requireSource = createRequire(sourceUrl);
const compiled = ts.transpileModule(readFileSync(sourceUrl, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

test("a service pause stops catch-up ticks and discards paused frame time", (context) => {
  let nextFrame: ((now: number) => void) | undefined;
  let cleanup: (() => void) | undefined;
  let steps = 0;
  const ref = <T,>(current: T) => ({ current });
  const game = makeGame("street-ace", 212, "free-run");
  const mode = ref<Mode>("playing");
  class StubRenderer {
    kind = "Canvas 2D";
    render() {}
    resize() {}
    destroy() {}
  }
  const mocks: Record<string, unknown> = {
    react: { useEffect: (effect: () => (() => void)) => { cleanup = effect(); } },
    "../canvas2d-renderer": { Canvas2DRenderer: StubRenderer },
    "../webgpu-renderer": { createWebGPURenderer: async () => null },
    "./background-music": { BackgroundMusic: class { update() {} unlock() {} destroy() {} } },
    "./runtime-errors": { reportRuntimeError: (_scope: string, error: unknown) => { throw error; } },
    "@/game/simulation": {
      stepGame: (state: Game) => {
        steps += 1;
        state.elapsed += 1 / 60;
        return steps === 1 ? [{ type: "service-used" }] : [];
      },
    },
  };
  const output = {} as { useGameRuntime: (options: unknown) => void };
  vm.runInNewContext(compiled, {
    exports: output,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : requireSource(id),
    performance: { now: () => 0 },
    requestAnimationFrame: (callback: (now: number) => void) => { nextFrame = callback; return 1; },
    cancelAnimationFrame() {},
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} },
    document: { addEventListener() {}, removeEventListener() {} },
    queueMicrotask,
  });
  output.useGameRuntime({
    canvas2dRef: ref({}), webGpuCanvasRef: ref({}), gameRef: ref(game),
    passengerReviewRef: ref(null),
    selectingDriverRef: ref(false),
    cameraRef: ref({ x: 0, y: 0, heading: 0, mode: "fixed", zoom: 1, heightOffset: 0 }),
    cameraModeRef: ref("fixed"), inputRef: ref({}), touchDriving: new TouchDriving(),
    interactionPulseRef: ref(false), jumpPulseRef: ref(false), modeRef: mode,
    mutedRef: ref(false), audioRef: ref(null), engineRef: ref(null), boostAudioActiveRef: ref(false),
    diagnostics: {}, diagnosticsActive: false,
    clearInput() {}, finishRun() {}, setHud() {}, setRendererKind() {}, setAudioAnnouncement() {}, tone() {},
    setMode: (next: Mode) => { mode.current = next; },
    onSimulationEvents: (events: unknown[]) => {
      if (events.length) mode.current = "paused";
    },
  });
  context.after(() => cleanup?.());
  const frame = (now: number) => { assert.ok(nextFrame); nextFrame(now); };
  frame(50);
  assert.equal(mode.current, "paused");
  assert.equal(steps, 1, "the pause event must stop the remaining catch-up ticks");
  mode.current = "playing";
  frame(60);
  assert.equal(steps, 1, "resume must not replay time from the paused frame");
  frame(70);
  assert.equal(steps, 2, "normal fixed stepping resumes with new elapsed time");
});
