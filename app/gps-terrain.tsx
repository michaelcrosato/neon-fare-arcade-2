"use client";

import { memo } from "react";
import { northstarTopography, copperTopography } from "@/game/terrain/map";
import { MIRROR_SPILLWAY, COPPER_RIVER } from "@/game/terrain/watercourses";
import { NORTHSTAR_GONDOLA } from "@/game/mountain-scenery";

/** Static world coordinates let heading-up GPS move one group, not rebuild contours. */
export const NorthstarTopography = memo(function NorthstarTopography() {
  const map = northstarTopography();
  return <g aria-hidden="true" data-map-layer="northstar-terrain">
    <g opacity="0.82">{map.fills.map((cell) => <rect key={`${cell.x}:${cell.y}`} x={cell.x} y={cell.y} width="72.2" height="72.2" fill={cell.color} />)}</g>
    <g fill="none" stroke="#d1e5cf" strokeWidth="1.8" opacity="0.35">
      {map.contours.map((contour) => <path key={contour.height} d={contour.path} />)}
    </g>
    <rect x="366" y="-1902" width="204" height="132" rx="14" fill="#318ca3" stroke="#8ad4d2" strokeWidth="3" />
    <polyline points={MIRROR_SPILLWAY.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#61bed0" strokeWidth="8" strokeLinejoin="round" />
    <line x1={NORTHSTAR_GONDOLA.lower.x} y1={NORTHSTAR_GONDOLA.lower.y} x2={NORTHSTAR_GONDOLA.upper.x} y2={NORTHSTAR_GONDOLA.upper.y}
      stroke="#ffe49b" strokeWidth="4" strokeDasharray="8 7" />
    <circle cx={NORTHSTAR_GONDOLA.upper.x} cy={NORTHSTAR_GONDOLA.upper.y} r="9" fill="#ffe49b" />
  </g>;
});

export const CopperTopography = memo(function CopperTopography() {
  const map = copperTopography();
  return <g aria-hidden="true" data-map-layer="copper-terrain">
    <g opacity="0.85">{map.fills.map((cell) => <rect key={`${cell.x}:${cell.y}`} x={cell.x} y={cell.y} width="72.2" height="72.2" fill={cell.color} />)}</g>
    <g fill="none" stroke="#ffe0a9" strokeWidth="1.8" opacity="0.4">
      {map.contours.map((contour) => <path key={contour.height} d={contour.path} />)}
    </g>
    <polyline points={COPPER_RIVER.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#62d3c4" strokeWidth="12" strokeLinejoin="round" />
    <circle cx="-540" cy="1080" r="25" fill="#473c3b" stroke="#ba9d8b" strokeWidth="3" />
  </g>;
});
