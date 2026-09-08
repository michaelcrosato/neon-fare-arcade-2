import packageInfo from "../../package.json";
import { FIXED_DT } from "@/game/config";
import type {
  CameraMode,
  Game,
  InputState,
  Modal,
  Mode,
  Vec2,
} from "@/game/model";
import type { SimulationEvent } from "@/game/simulation";
import {
  recentRuntimeErrors,
  serializeRuntimeError,
} from "./runtime-errors";

export const DIAGNOSTICS_SCHEMA_VERSION = 3;
export const DIAGNOSTIC_SEGMENT_TICKS = 300;
export const DIAGNOSTIC_SEGMENT_LIMIT = 3;

const INPUT_BITS = {
  up: 1 << 0,
  down: 1 << 1,
  left: 1 << 2,
  right: 1 << 3,
  boost: 1 << 4,
  sprint: 1 << 5,
  jump: 1 << 6,
  crouch: 1 << 7,
  interact: 1 << 8,
} as const;

export type DiagnosticStreamContext = Readonly<{
  focus: Vec2;
  radius: number;
  worldKey: string;
  counts: Readonly<{
    chunks: number;
    boxes: number;
    colliders: number;
    interactions: number;
    /** Optional for reading older schema-3 captures made before road meshes. */
    surfaceQuads?: number;
  }>;
}>;

export type DiagnosticTick = Readonly<{
  tick: number;
  inputMask: number;
  randomValues: readonly number[];
  events: readonly SimulationEvent[];
  stream: DiagnosticStreamContext;
}>;

export type DiagnosticSegment = Readonly<{
  reason: "run-start" | "rolling" | "external" | "post-failure";
  boundaryReason: string | null;
  checkpoint: Readonly<{ tick: number; game: Game }>;
  ticks: readonly DiagnosticTick[];
}>;

export type DiagnosticRuntimeSummary = Readonly<{
  renderer: string;
  cameraMode: CameraMode;
  worldKey: string;
  playerMode: "driving" | "walking" | "interior";
  position: Vec2;
}>;

export type FailedDiagnosticStep = Readonly<{
  tick: number;
  checkpoint: DiagnosticSegment["checkpoint"];
  priorTicks: readonly DiagnosticTick[];
  attempt: Omit<DiagnosticTick, "events">;
  error: ReturnType<typeof serializeRuntimeError>;
  postFailureGame: Game;
}>;

export type DiagnosticsSnapshot = Readonly<{
  schemaVersion: typeof DIAGNOSTICS_SCHEMA_VERSION;
  app: Readonly<{
    name: string;
    version: string;
    buildId: string;
  }>;
  capturedAt: string;
  fixedDt: number;
  runtime: Readonly<{
    mode: Mode;
    modal: Modal;
  }> & DiagnosticRuntimeSummary;
  run: Readonly<{
    seed: number;
    kind: Game["runKind"];
    drivingModel: Game["drivingModel"];
    drivingTraitId: Game["drivingTraitId"];
  }>;
  trace: Readonly<{
    nextTick: number;
    segments: readonly DiagnosticSegment[];
    failedStep: FailedDiagnosticStep | null;
  }>;
  currentGame: Game;
  recentErrors: ReturnType<typeof recentRuntimeErrors>;
}>;

type PendingStep = Readonly<{
  tick: number;
  inputMask: number;
  stream: DiagnosticStreamContext;
}>;

function cloneData<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function encodeDiagnosticInput(input: Readonly<InputState>) {
  return (input.up ? INPUT_BITS.up : 0)
    | (input.down ? INPUT_BITS.down : 0)
    | (input.left ? INPUT_BITS.left : 0)
    | (input.right ? INPUT_BITS.right : 0)
    | (input.boost ? INPUT_BITS.boost : 0)
    | (input.sprint ? INPUT_BITS.sprint : 0)
    | (input.jump ? INPUT_BITS.jump : 0)
    | (input.crouch ? INPUT_BITS.crouch : 0)
    | (input.interact ? INPUT_BITS.interact : 0);
}

export function decodeDiagnosticInput(mask: number): InputState {
  return {
    up: Boolean(mask & INPUT_BITS.up),
    down: Boolean(mask & INPUT_BITS.down),
    left: Boolean(mask & INPUT_BITS.left),
    right: Boolean(mask & INPUT_BITS.right),
    boost: Boolean(mask & INPUT_BITS.boost),
    sprint: Boolean(mask & INPUT_BITS.sprint),
    jump: Boolean(mask & INPUT_BITS.jump),
    crouch: Boolean(mask & INPUT_BITS.crouch),
    interact: Boolean(mask & INPUT_BITS.interact),
  };
}

export function diagnosticsEnabled(search = typeof window === "undefined" ? "" : window.location.search) {
  const override = new URLSearchParams(search).get("diagnostics");
  if (override === "1") return true;
  if (override === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export class DiagnosticsRecorder {
  private segments: Array<{
    reason: DiagnosticSegment["reason"];
    boundaryReason: string | null;
    checkpoint: { tick: number; game: Game };
    ticks: DiagnosticTick[];
  }> = [];
  private nextTick = 0;
  private pending: PendingStep | null = null;
  private failedStep: FailedDiagnosticStep | null = null;
  private postFailurePending = false;
  private runtimeSummary: DiagnosticRuntimeSummary = {
    renderer: "UNKNOWN",
    cameraMode: "fixed",
    worldKey: "",
    playerMode: "driving",
    position: { x: 0, y: 0 },
  };

  reset() {
    this.segments = [];
    this.nextTick = 0;
    this.pending = null;
    this.failedStep = null;
    this.postFailurePending = false;
  }

  /** Records a browser-owned mutation as an explicit, replayable checkpoint. */
  recordExternalCheckpoint(reason: string, game: Game) {
    if (this.pending) throw new Error("Cannot checkpoint during a diagnostics step");
    const checkpoint = { tick: this.nextTick, game: cloneData(game) };
    const current = this.segments[this.segments.length - 1];
    if (current?.reason === "external" && current.ticks.length === 0 && current.checkpoint.tick === this.nextTick) {
      current.boundaryReason = current.boundaryReason
        ? `${current.boundaryReason}; ${reason}`
        : reason;
      current.checkpoint = checkpoint;
      return;
    }
    this.segments.push({
      reason: "external",
      boundaryReason: reason,
      checkpoint,
      ticks: [],
    });
    if (this.segments.length > DIAGNOSTIC_SEGMENT_LIMIT) this.segments.shift();
  }

  updateRuntime(summary: DiagnosticRuntimeSummary) {
    this.runtimeSummary = {
      ...summary,
      position: { ...summary.position },
    };
  }

  beginStep(game: Game, input: Readonly<InputState>, stream: DiagnosticStreamContext) {
    if (this.pending) throw new Error("Diagnostics step already pending");
    let segment = this.segments[this.segments.length - 1];
    if (!segment || this.postFailurePending || segment.ticks.length >= DIAGNOSTIC_SEGMENT_TICKS) {
      segment = {
        reason: this.postFailurePending
          ? "post-failure"
          : this.nextTick === 0
            ? "run-start"
            : "rolling",
        boundaryReason: null,
        checkpoint: { tick: this.nextTick, game: cloneData(game) },
        ticks: [],
      };
      this.segments.push(segment);
      if (this.segments.length > DIAGNOSTIC_SEGMENT_LIMIT) this.segments.shift();
      this.postFailurePending = false;
    }
    this.pending = {
      tick: this.nextTick,
      inputMask: encodeDiagnosticInput(input),
      stream: {
        focus: { ...stream.focus },
        radius: stream.radius,
        worldKey: stream.worldKey,
        counts: { ...stream.counts },
      },
    };
  }

  commitStep(randomValues: readonly number[], events: readonly SimulationEvent[]) {
    if (!this.pending) throw new Error("Diagnostics step was not started");
    const segment = this.segments[this.segments.length - 1];
    if (!segment) throw new Error("Diagnostics segment is missing");
    segment.ticks.push({
      ...this.pending,
      randomValues: [...randomValues],
      events: events.length ? cloneData(events) : [],
    });
    this.nextTick += 1;
    this.pending = null;
  }

  failStep(error: unknown, randomValues: readonly number[], postFailureGame: Game) {
    if (!this.pending) return;
    const segment = this.segments[this.segments.length - 1];
    if (segment && !this.failedStep) {
      this.failedStep = {
        tick: this.pending.tick,
        checkpoint: cloneData(segment.checkpoint),
        priorTicks: cloneData(segment.ticks),
        attempt: {
          ...this.pending,
          randomValues: [...randomValues],
        },
        error: serializeRuntimeError(error),
        postFailureGame: cloneData(postFailureGame),
      };
    }
    this.pending = null;
    this.postFailurePending = true;
  }

  snapshot(game: Game, modal: Modal, mode: Mode): DiagnosticsSnapshot {
    return {
      schemaVersion: DIAGNOSTICS_SCHEMA_VERSION,
      app: {
        name: packageInfo.displayName,
        version: packageInfo.version,
        buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "development",
      },
      capturedAt: new Date().toISOString(),
      fixedDt: FIXED_DT,
      runtime: {
        mode,
        modal,
        ...cloneData(this.runtimeSummary),
      },
      run: {
        seed: game.runSeed,
        kind: game.runKind,
        drivingModel: game.drivingModel,
        drivingTraitId: game.drivingTraitId,
      },
      trace: {
        nextTick: this.nextTick,
        segments: cloneData(this.segments),
        failedStep: cloneData(this.failedStep),
      },
      currentGame: cloneData(game),
      recentErrors: recentRuntimeErrors(),
    };
  }
}
