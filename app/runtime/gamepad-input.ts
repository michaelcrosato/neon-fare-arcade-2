import type { InputState } from "@/game/model";

type Pad = Pick<Gamepad, "connected" | "mapping" | "axes" | "buttons">;
export type GamepadActions = { pause: boolean; confirm: boolean; camera: boolean };
const idle = (): InputState => ({ up: false, down: false, left: false, right: false, boost: false });

/** Standard browser mapping includes PS5-style controllers. Physical wheels remain unsupported. */
export class GamepadInput {
  private held = new Set<number>();
  private needsRelease = false;

  sample(pads: readonly (Pad | null)[], playing: boolean, walking = false) {
    const pad = pads.find(p => p?.connected && p.mapping === "standard");
    if (!pad) { this.held.clear(); this.needsRelease = false; return { input: idle(), actions: { pause: false, confirm: false, camera: false } }; }
    const down = (index: number) => Boolean(pad.buttons[index]?.pressed || pad.buttons[index]?.value > .12);
    const next = new Set(pad.buttons.flatMap((_, i) => down(i) ? [i] : []));
    const pressed = (index: number) => next.has(index) && !this.held.has(index);
    const actions: GamepadActions = { pause: pressed(9), confirm: pressed(0), camera: pressed(3) };
    const raw = Number.isFinite(pad.axes[0]) ? pad.axes[0] : 0;
    const steer = Math.abs(raw) <= .15 ? 0 : Math.sign(raw) * Math.min(1, (Math.abs(raw) - .15) / .85);
    const vertical = Number.isFinite(pad.axes[1]) ? pad.axes[1] : 0;
    const input: InputState = { up: walking ? vertical < -.25 : down(7), down: walking ? vertical > .25 : down(6),
      left: false, right: false, steer, boost: !walking && down(0),
      interact: pressed(2), jump: walking && pressed(0), sprint: walking && down(10), crouch: walking && down(1),
      clutch: !walking && down(4), shiftDown: !walking && down(14), shiftUp: !walking && down(15) };
    if (walking) { input.left = steer < -.15; input.right = steer > .15; }
    this.held = next;
    if (!playing) this.needsRelease = true;
    if (!next.size && steer === 0 && Math.abs(vertical) <= .25) this.needsRelease = false;
    return { input: playing && !this.needsRelease ? input : idle(), actions };
  }
}

export function mergeGamepadInput(keys: InputState, pad: InputState): InputState {
  const merged = { ...keys };
  for (const key of ["up", "down", "left", "right", "boost", "clutch", "shiftDown", "shiftUp", "interact", "jump", "sprint", "crouch"] as const) merged[key] = Boolean(keys[key] || pad[key]);
  merged.steer = keys.steer || pad.steer || 0;
  if (pad.down) merged.brakePreservesCruise = false;
  return merged;
}

export function connectedGamepads() {
  try { return Array.from(navigator.getGamepads?.() ?? []); } catch { return []; }
}
