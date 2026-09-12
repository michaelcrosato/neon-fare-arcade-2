import type { Color } from "../model";
import { inIronwake } from "../industrial-layout";
import { coastRoadHeight } from "./coast-forms";
import { copperRoadHeight } from "./copper-forms";

const smooth = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

/** Level reclaimed land, with long approach grades matching both existing neighbors. */
export function ironwakeRoadHeight(x: number, y: number) {
  if (!inIronwake(x, y)) return 0;
  const natural = coastRoadHeight(x, 792) * (1 - smooth((y - 792) / 180))
    + copperRoadHeight(-792, y) * smooth((x + 1008) / 216);
  // The arrival checkpoint sits on a level six-unit terrace. Feather before
  // the Coast seam so the road, gate buildings and walking surface agree.
  const gateDistance = Math.hypot(Math.max(-1737 - x, 0, x + 1647), Math.max(855 - y, 0, y - 945));
  const gateInfluence = 1 - smooth(gateDistance / 45);
  return natural * (1 - gateInfluence) + 6 * gateInfluence;
}

export function ironwakeTerrainColor(x: number, y: number): Color {
  if (x < -2016) return [0.31, 0.35, 0.34, 1];
  if (y > 1908) return [0.34, 0.29, 0.22, 1];
  return Math.sin(x / 54 + y / 36) > 0 ? [0.3, 0.32, 0.3, 1] : [0.36, 0.37, 0.32, 1];
}
