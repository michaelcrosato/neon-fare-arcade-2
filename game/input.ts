import type { InputState } from "./model";

/** Digital keys retain priority; touch steering is proportional to thumb travel. */
export function steeringInput(input: Readonly<InputState>): number {
  if (input.left || input.right) return Number(input.right) - Number(input.left);
  return Number.isFinite(input.steer) ? Math.max(-1, Math.min(1, input.steer!)) : 0;
}
