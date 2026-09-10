import type { InputState } from "@/game/model";

type TouchKind = "steer" | "gas" | "brake";
type Pointer = { kind: TouchKind; x: number; y: number; dx: number; travel: number; time: number; double: boolean };
const DEAD_ZONE = 6;
export const THUMB_TRAVEL = 56;

/** Browser-free gesture ownership. Each pedal stays held until its own pointer ends. */
export class TouchDriving {
  private pointers = new Map<number, Pointer>();
  private taps: Partial<Record<TouchKind, number>> = {};

  start(id: number, kind: TouchKind, x: number, y: number, time: number) {
    if (this.pointers.has(id) || (kind === "steer" && [...this.pointers.values()].some(p => p.kind === "steer"))) return false;
    const lastTap = this.taps[kind];
    const double = kind !== "steer" && lastTap !== undefined && time - lastTap <= 320 && time >= lastTap;
    delete this.taps[kind];
    this.pointers.set(id, { kind, x, y, dx: 0, travel: 0, time, double });
    return true;
  }

  move(id: number, x: number, y: number) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    pointer.dx = x - pointer.x;
    pointer.travel = Math.max(pointer.travel, Math.hypot(pointer.dx, y - pointer.y));
  }

  end(id: number, time: number, cancelled = false) {
    const pointer = this.pointers.get(id);
    if (!pointer) return;
    if (!cancelled && !pointer.double && pointer.kind !== "steer" && time - pointer.time <= 240 && pointer.travel <= 14) {
      this.taps[pointer.kind] = time;
    } else delete this.taps[pointer.kind];
    this.pointers.delete(id);
  }

  reset() { this.pointers.clear(); this.taps = {}; }

  snapshot() {
    const pointers = [...this.pointers.values()];
    // A separate steering thumb stays in charge, regardless of pedal press order.
    const owner = pointers.find(p => p.kind === "steer") ?? pointers.at(-1);
    const dx = owner?.dx ?? 0;
    const steer = Math.sign(dx) * Math.min(1, Math.max(0, Math.abs(dx) - DEAD_ZONE) / (THUMB_TRAVEL - DEAD_ZONE));
    return {
      gas: pointers.some(p => p.kind === "gas"),
      brake: pointers.some(p => p.kind === "brake"),
      gasBoost: pointers.some(p => p.kind === "gas" && p.double),
      park: pointers.some(p => p.kind === "brake" && p.double),
      steer,
      thumb: owner ? { x: owner.x, y: owner.y, dx: Math.max(-THUMB_TRAVEL, Math.min(THUMB_TRAVEL, dx)), kind: owner.kind } : null,
    };
  }

  input(simulation = false): InputState {
    const state = this.snapshot();
    return { up: state.gas && !state.brake, down: state.brake, left: false, right: false,
      steer: state.steer, boost: simulation ? state.park : state.gasBoost && !state.brake };
  }
}

export function mergeDrivingInput(keys: InputState, touch: InputState): InputState {
  return { ...keys, up: keys.up || touch.up, down: keys.down || touch.down,
    boost: keys.boost || touch.boost, steer: touch.steer };
}
