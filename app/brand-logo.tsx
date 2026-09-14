import { BRANDS, type BrandId } from "@/game/brands";
import { brandIcon, wordmarkRects } from "@/game/brand-art";

export function BrandLogo({ brand, className = "" }: { brand: BrandId; className?: string }) {
  const identity = BRANDS[brand];
  return <svg viewBox="0 0 384 96" className={`brand-logo ${className}`} role="img" aria-label={identity.name}>
    <rect width="384" height="96" fill={identity.background} />
    <g fill={identity.foreground}>
      {brandIcon(brand).map((points, i) => <polygon key={i} points={points.map(point => point.join(",")).join(" ")} />)}
      {wordmarkRects(identity.name).map((r, i) => <rect key={i} x={90 + r.x * 5} y={25 + r.y * 5} width={r.width * 5} height={r.height * 5} />)}
      <path d="M90 70H355V74H90Z" />
    </g>
  </svg>;
}
