import type { CSSProperties } from "react";
import type { Hud } from "@/game/model";

/** Cosmetic scatter stays fixed for an impact, without consuming gameplay randomness. */
export function DamageCallout({ damage, runSeed }: { damage: Hud["damage"]; runSeed: number }) {
  if (!damage.line) return null;
  let hash = (runSeed ^ Math.imul(damage.impactId, 0x9e3779b1)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash = (hash ^ (hash >>> 16)) >>> 0;
  const tilt = hash % 5 === 0 ? 0 : (hash & 1 ? 1 : -1) * (2 + ((hash >>> 20) % 8) / 2);
  return <div key={damage.impactId} className="damage-callout" aria-hidden="true" style={{
    left: `${42 + (hash & 1023) / 1023 * 16}%`,
    top: `${38 + ((hash >>> 10) & 1023) / 1023 * 20}%`,
    "--damage-tilt": `${tilt}deg`,
  } as CSSProperties}>{damage.line}</div>;
}
