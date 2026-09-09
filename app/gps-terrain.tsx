"use client";

import { memo } from "react";
import { northstarTopography, copperTopography, coastTopography } from "@/game/terrain/map";
import { MIRROR_SPILLWAY, COPPER_RIVER } from "@/game/terrain/watercourses";
import { NORTHSTAR_GONDOLA } from "@/game/mountain-scenery";
import { COAST_CANALS, COAST_PIER, COAST_WHEEL, COAST_PROMENADE_EAST_X, coastShoreXAt } from "@/game/coastal-layout";

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

const coastShore = Array.from({ length: 177 }, (_, i) => ({ x: coastShoreXAt(-792 + i * 9), y: -792 + i * 9 }));
const shorePath = coastShore.map(p => `${p.x},${p.y}`).join(" ");
export const CoastTopography = memo(function CoastTopography() {
  const map = coastTopography();
  return <g aria-hidden="true" data-map-layer="coast-terrain">
    <g opacity="0.88">{map.fills.map(cell => <rect key={`${cell.x}:${cell.y}`} x={cell.x} y={cell.y} width="72.2" height="72.2" fill={cell.color} />)}</g>
    <g fill="none" stroke="#f1e2af" strokeWidth="1.8" opacity="0.45">
      {map.contours.map(contour => <path key={contour.height} d={contour.path} />)}
    </g>
    <polygon points={`${shorePath} ${COAST_PROMENADE_EAST_X},792 ${COAST_PROMENADE_EAST_X},-792`} fill="#f4d694" />
    <polygon points={`-2376,-792 ${shorePath} -2376,792`} fill="#1689ac" />
    <polyline points={shorePath} fill="none" stroke="#c0fff0" strokeWidth="5" />
    <g data-map-layer="coast-canals">{COAST_CANALS.map(canal => <rect key={canal.x} x={canal.x - canal.halfWidth} y={canal.minY}
      width={canal.halfWidth * 2} height={canal.maxY - canal.minY} fill="#36baa9" stroke="#b3efcd" strokeWidth="2" />)}</g>
    <line x1={COAST_PIER.minX} y1={COAST_PIER.y} x2={COAST_PIER.maxX} y2={COAST_PIER.y} stroke="#cb9164" strokeWidth="18" />
    <circle cx={COAST_WHEEL.x} cy={COAST_WHEEL.y} r="11" fill="#ffab6f" stroke="#fff4c8" strokeWidth="3" />
  </g>;
});
