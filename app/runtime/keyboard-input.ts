import type { InputState } from "@/game/model";

/** Actor-aware key bindings; global shortcuts and browser events stay in the shell. */
export function applyKeyboardInput(input: InputState, key: string, pressed: boolean, walkingNow: boolean, repeat: boolean, playing: boolean) {
  if (key === "w" || key === "arrowup") input.up = pressed;
  if (key === "s" || key === "arrowdown") input.down = pressed;
  if (key === "a" || key === "arrowleft") input.left = pressed;
  if (key === "d" || key === "arrowright") input.right = pressed;
  if (key === " ") {
    if (!pressed) {
      input.boost = false;
      input.jump = false;
    } else if (walkingNow) {
      input.boost = false;
      input.jump = true;
    } else {
      input.jump = false;
      input.boost = true;
    }
  }
  if (key === "shift") {
    input.sprint = walkingNow && pressed;
    input.clutch = !walkingNow && pressed;
  }
  if (key === "z") input.shiftDown = !walkingNow && pressed;
  if (key === "x") input.shiftUp = !walkingNow && pressed;
  if (key === "control") input.crouch = pressed;
  if (key === "c") {
    input.crouch = walkingNow ? pressed : false;
  }
  if (key === "e" && !repeat) input.interact = pressed && playing;
}
