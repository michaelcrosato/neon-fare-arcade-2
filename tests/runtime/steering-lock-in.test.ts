import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  STEERING_MODES,
  applySteeringForRun,
  parseStoredSteeringMode,
} from "../../app/runtime/steering-mode";
import { TouchDriving, type SteeringMode } from "../../app/runtime/touch-driving";

const ROOT = resolve(import.meta.dirname, "../..");

function seedPrior(controller: TouchDriving, store: { mode: SteeringMode }, prior: SteeringMode) {
  store.mode = prior;
  controller.setMode(prior);
}

/** Same sequence page lock-in → beginRun uses: persist the click, apply that id last. */
function lockInAndStart(
  controller: TouchDriving,
  store: { mode: SteeringMode },
  locked: SteeringMode,
) {
  applySteeringForRun(controller, locked, (mode) => {
    store.mode = mode;
  });
}

test("lock-in starts the selected steering system even when a different mode was stored", () => {
  const controller = new TouchDriving();
  const store = { mode: "default" as SteeringMode };
  const priors: Record<SteeringMode, SteeringMode> = {
    default: "wheel",
    joystick: "default",
    wheel: "joystick",
  };

  for (const locked of STEERING_MODES) {
    seedPrior(controller, store, priors[locked]);
    assert.notEqual(controller.getMode(), locked);
    assert.notEqual(store.mode, locked);

    lockInAndStart(controller, store, locked);

    assert.equal(controller.getMode(), locked);
    assert.equal(controller.snapshot().mode, locked);
    assert.equal(store.mode, locked, "the locked id is what Options / the next modal remember");
  }
});

test("locking the same system twice is stable regardless of the stored prior", () => {
  const controller = new TouchDriving();
  const store = { mode: "default" as SteeringMode };
  const locked = "joystick" as const;

  for (const prior of ["default", "wheel"] as const) {
    seedPrior(controller, store, prior);
    assert.notEqual(controller.getMode(), locked);

    lockInAndStart(controller, store, locked);

    assert.equal(controller.getMode(), locked);
    assert.equal(controller.snapshot().mode, locked);
    assert.equal(store.mode, locked);
  }
});

test("the locked id wins even if persist mutates the controller first", () => {
  const controller = new TouchDriving();
  controller.setMode("wheel");
  applySteeringForRun(controller, "joystick", () => {
    controller.setMode("default");
  });
  assert.equal(controller.getMode(), "joystick");
  assert.equal(controller.snapshot().mode, "joystick");
});

test("stored steering strings are accepted only for the three live systems", () => {
  assert.equal(parseStoredSteeringMode("joystick"), "joystick");
  assert.equal(parseStoredSteeringMode("wheel"), "wheel");
  assert.equal(parseStoredSteeringMode("default"), "default");
  assert.equal(parseStoredSteeringMode("tank"), "default");
  assert.equal(parseStoredSteeringMode(null), "default");
});

test("page lock-in applies the click id last and does not re-apply stale React steeringMode", () => {
  const page = readFileSync(resolve(ROOT, "app/page.tsx"), "utf8");
  assert.match(page, /from "\.\/runtime\/steering-mode"/);
  assert.match(page, /beginRun\(pendingDrivingTrait,\s*selectedMode\)/);
  assert.match(
    page,
    /applySteeringForRun\(touchDriving,\s*lockedSteering \?\? steeringMode,\s*persistSteeringMode\)/,
  );
  assert.equal(
    page.includes("touchDriving.setMode(steeringMode)"),
    false,
    "beginRun must not re-apply React steeringMode from the previous render",
  );
  assert.equal(
    /selectSteeringAndBegin[\s\S]*?setSteeringMode\(selectedMode\)[\s\S]*?beginRun\(pendingDrivingTrait\)/.test(page),
    false,
    "lock-in must not persist then start with the stale closure value",
  );

  const panel = readFileSync(resolve(ROOT, "app/steering-option-panel.tsx"), "utf8");
  assert.match(panel, /data-modal-autofocus=\{isSelected \? "true" : undefined\}/);
  assert.equal(
    panel.includes('option.id === "default" ? "true"'),
    false,
    "only the highlighted STEERING SYSTEM card may be the Enter/autofocus target",
  );
});
