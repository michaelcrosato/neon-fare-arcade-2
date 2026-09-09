"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  ROAD_HALF,
  DISPLAY_METERS_PER_WORLD_UNIT,
  ROAD_SPACING,
  WORLD_MAX_X,
  WORLD_MIN_X,
  WORLD_ROAD_MAX_X,
  WORLD_ROAD_MAX_Y,
  WORLD_ROAD_MIN_X,
  WORLD_ROAD_MIN_Y,
} from "@/game/config";
import { nearestRoadX, nearestRoadY, normalizeAngle } from "@/game/math";
import { nextTurnCue } from "@/game/navigation";
import {
  CUSTOM_DESTINATION_KEYBOARD_STEP,
  customDestinationForMapPoint,
  mapClientPointToWorld,
  moveCustomDestination,
} from "@/game/custom-destination";
import type { Hud, NavigationPlan, Vec2 } from "@/game/model";
import { FEATURED_CITY_LANDMARKS, landmarkWorldCenter } from "@/game/landmarks";
import { ACTIVE_WORLD_REGIONS, regionRoadBounds } from "@/game/regions";
import {
  REGIONAL_MAP_SLOTS,
  clampRegionalMapView,
  fitRegionalMapBounds,
  panRegionalMapView,
  regionalMapDetail,
  regionalMapOverviewView,
  regionalMapPlayerView,
  regionalMapRegionView,
  regionalMapViewBox,
  regionalMapZoomPercent,
  zoomRegionalMapView,
} from "@/game/regional-map";
import { REGIONAL_CONTENT } from "@/game/regional-content";
import { gridStreetSegmentEnabled } from "@/game/road-topology";
import { SPECIAL_ROADS } from "@/game/road-layout";
import { NorthstarTopography, CopperTopography, CoastTopography } from "./gps-terrain";
import { inCoastTerrain } from "@/game/terrain/coast-forms";
import { inNorthstarTerrain } from "@/game/terrain/northstar-forms";
import { inCopperTerrain } from "@/game/terrain/copper-forms";

type GpsMapProps = {
  hud: Hud;
  full?: boolean;
  draftDestination?: Vec2 | null;
  draftPlan?: NavigationPlan | null;
  onDestinationDraft?: (point: Vec2) => void;
  onDestinationCommit?: () => void;
};

export function GpsMap({
  hud,
  full = false,
  draftDestination = null,
  draftPlan = null,
  onDestinationDraft,
  onDestinationCommit,
}: GpsMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapAspectReadyRef = useRef(false);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragged: boolean;
  } | null>(null);
  const [mapAspect, setMapAspect] = useState(1.68);
  const [mapView, setMapView] = useState(() => regionalMapPlayerView(hud.player, 1.68));

  useEffect(() => {
    if (!full || !svgRef.current) return;
    const svg = svgRef.current;
    const updateAspect = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nextAspect = rect.width / rect.height;
      setMapAspect(nextAspect);
      if (!mapAspectReadyRef.current) {
        mapAspectReadyRef.current = true;
        setMapView(regionalMapPlayerView(hud.player, nextAspect));
      } else {
        setMapView((current) => clampRegionalMapView(current, nextAspect));
      }
    };
    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [full, hud.player]);

  const compactPoint = (point: Vec2) => {
    const dx = point.x - hud.player.x;
    const dy = point.y - hud.player.y;
    return {
      x: (-Math.sin(hud.heading) * dx + Math.cos(hud.heading) * dy) * 0.58,
      y: -(Math.cos(hud.heading) * dx + Math.sin(hud.heading) * dy) * 0.58,
    };
  };
  const pointFor = (point: Vec2) => full ? point : compactPoint(point);
  const origin = pointFor({ x: 0, y: 0 }), east = pointFor({ x: 1, y: 0 }), south = pointFor({ x: 0, y: 1 });
  const terrainTransform = `matrix(${east.x - origin.x} ${east.y - origin.y} ${south.x - origin.x} ${south.y - origin.y} ${origin.x} ${origin.y})`;
  const mountainPlayer = inNorthstarTerrain(hud.player.x, hud.player.y);
  const copperPlayer = inCopperTerrain(hud.player.x, hud.player.y);
  const coastPlayer = inCoastTerrain(hud.player.x, hud.player.y);
  const activeDraftPlan = full && draftDestination ? draftPlan : null;
  const displayedRoute = activeDraftPlan?.route ?? hud.route;
  const displayedRouteType = full && draftDestination ? "waypoint" : hud.objectiveType;
  const showNavigationTarget = displayedRouteType !== "roam";
  const routePoints = displayedRoute.map(pointFor).map((point) => `${point.x},${point.y}`).join(" ");
  const specialRoadPolylines = SPECIAL_ROADS.map((road) => {
    const points = road.closed ? [...road.points, road.points[0]] : road.points;
    return {
      road,
      points: points.map(pointFor).map((point) => `${point.x},${point.y}`).join(" "),
    };
  });
  const roadLines: Array<{ a: Vec2; b: Vec2; key: string }> = [];
  const mappedRegions = useMemo(() => full
    ? ACTIVE_WORLD_REGIONS.map((region) => ({ region, bounds: regionRoadBounds(region) }))
    : [], [full]);
  if (full) {
    const regionalRoadLines = new Map<string, { a: Vec2; b: Vec2; key: string }>();
    for (const { region, bounds } of mappedRegions) {
      const minX = Math.max(bounds.minX, WORLD_ROAD_MIN_X);
      const maxX = Math.min(bounds.maxX, WORLD_ROAD_MAX_X);
      const minY = Math.max(bounds.minY, WORLD_ROAD_MIN_Y);
      const maxY = Math.min(bounds.maxY, WORLD_ROAD_MAX_Y);
      for (let road = minX; road <= maxX; road += ROAD_SPACING) {
        let runStart: number | null = null;
        for (let y = minY; y < maxY; y += ROAD_SPACING) {
          const a = { x: road, y };
          const b = { x: road, y: Math.min(maxY, y + ROAD_SPACING) };
          const blocked = !gridStreetSegmentEnabled(a, b);
          if (!blocked && runStart === null) runStart = y;
          if ((blocked || b.y >= maxY) && runStart !== null) {
            const runEnd = blocked ? y : b.y;
            const key = `v:${road}:${runStart}`;
            regionalRoadLines.set(key, {
              a: { x: road, y: runStart },
              b: { x: road, y: runEnd },
              key: `${region.id}-${key}`,
            });
            runStart = null;
          }
        }
      }
      for (let road = minY; road <= maxY; road += ROAD_SPACING) {
        let runStart: number | null = null;
        for (let x = minX; x < maxX; x += ROAD_SPACING) {
          const a = { x, y: road };
          const b = { x: Math.min(maxX, x + ROAD_SPACING), y: road };
          const blocked = !gridStreetSegmentEnabled(a, b);
          if (!blocked && runStart === null) runStart = x;
          if ((blocked || b.x >= maxX) && runStart !== null) {
            const runEnd = blocked ? x : b.x;
            const key = `h:${road}:${runStart}`;
            regionalRoadLines.set(key, {
              a: { x: runStart, y: road },
              b: { x: runEnd, y: road },
              key: `${region.id}-${key}`,
            });
            runStart = null;
          }
        }
      }
    }
    roadLines.push(...regionalRoadLines.values());
  } else {
    const centerRoadX = nearestRoadX(hud.player.x);
    const centerRoadY = nearestRoadY(hud.player.y);
    for (let offset = -4; offset <= 4; offset += 1) {
      const roadX = centerRoadX + offset * ROAD_SPACING;
      const roadY = centerRoadY + offset * ROAD_SPACING;
      const localMinY = Math.floor((hud.player.y - 180) / ROAD_SPACING) * ROAD_SPACING;
      const localMaxY = Math.ceil((hud.player.y + 180) / ROAD_SPACING) * ROAD_SPACING;
      let verticalRunStart: number | null = null;
      for (let y = localMinY; y < localMaxY; y += ROAD_SPACING) {
        const a = { x: roadX, y };
        const b = { x: roadX, y: y + ROAD_SPACING };
        const blocked = !gridStreetSegmentEnabled(a, b);
        if (!blocked && verticalRunStart === null) verticalRunStart = y;
        if ((blocked || b.y >= localMaxY) && verticalRunStart !== null) {
          const runEnd = blocked ? y : b.y;
          roadLines.push({
            a: { x: roadX, y: verticalRunStart },
            b: { x: roadX, y: runEnd },
            key: `v${offset}:${verticalRunStart}`,
          });
          verticalRunStart = null;
        }
      }
      const localMinX = Math.floor((hud.player.x - 180) / ROAD_SPACING) * ROAD_SPACING;
      const localMaxX = Math.ceil((hud.player.x + 180) / ROAD_SPACING) * ROAD_SPACING;
      let horizontalRunStart: number | null = null;
      for (let x = localMinX; x < localMaxX; x += ROAD_SPACING) {
        const a = { x, y: roadY };
        const b = { x: x + ROAD_SPACING, y: roadY };
        const blocked = !gridStreetSegmentEnabled(a, b);
        if (!blocked && horizontalRunStart === null) horizontalRunStart = x;
        if ((blocked || b.x >= localMaxX) && horizontalRunStart !== null) {
          const runEnd = blocked ? x : b.x;
          roadLines.push({
            a: { x: horizontalRunStart, y: roadY },
            b: { x: runEnd, y: roadY },
            key: `h${offset}:${horizontalRunStart}`,
          });
          horizontalRunStart = null;
        }
      }
    }
  }
  const target = pointFor(full && draftDestination ? draftDestination : hud.navigationTarget);
  const player = pointFor(hud.player);
  const walker = hud.walker ? pointFor(hud.walker) : null;
  const pickupMarkers = hud.availablePickups.map((marker) => ({
    ...marker,
    screenPoint: pointFor(marker.point),
  }));
  const courierMarkers = hud.courierMarkers.map((marker) => ({
    ...marker,
    screenPoint: pointFor(marker.point),
  }));
  const turnCue = full
    ? activeDraftPlan
      ? activeDraftPlan.requiresUTurn ? null : nextTurnCue(activeDraftPlan.route, activeDraftPlan.departureYaw)
      : hud.routeTurnCue
    : hud.turnCue;
  const turnPoint = turnCue ? pointFor(turnCue.point) : null;
  const turnRotation = turnCue
    ? full
      ? turnCue.yaw * 180 / Math.PI + 90
      : normalizeAngle(turnCue.yaw - hud.heading) * 180 / Math.PI
    : 0;
  const clipId = full ? "full-gps-clip" : "compact-gps-clip";
  const mapWidth = WORLD_MAX_X - WORLD_MIN_X;
  const fullViewBox = regionalMapViewBox(mapView, mapAspect);
  const compactViewBox = { minX: -62, minY: -49, width: 124, height: 98 };
  const activeViewBox = full ? fullViewBox : compactViewBox;
  const viewBox = `${activeViewBox.minX} ${activeViewBox.minY} ${activeViewBox.width} ${activeViewBox.height}`;
  const mapDetail = full ? regionalMapDetail(mapView.spanY) : "local";
  const markerScale = full ? activeViewBox.height / 600 : 1;
  const centerRegionBounds = mappedRegions.find(({ region }) => region.id === "city-center")?.bounds;

  const clientPointToMap = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect();
    return mapClientPointToWorld(
      { x: clientX, y: clientY },
      {
        left: rect.left + svg.clientLeft,
        top: rect.top + svg.clientTop,
        width: svg.clientWidth,
        height: svg.clientHeight,
      },
      activeViewBox,
    );
  };

  const selectDestination = (clientX: number, clientY: number, svg: SVGSVGElement) => {
    if (!full || !onDestinationDraft) return;
    const point = clientPointToMap(clientX, clientY, svg);
    if (!point) return;
    const destination = customDestinationForMapPoint(point);
    if (destination) onDestinationDraft(destination);
  };

  const focusPlayer = () => setMapView(regionalMapPlayerView(hud.player, mapAspect));
  const showOverview = () => setMapView(regionalMapOverviewView(mapAspect));
  const fitRoute = () => {
    const points = [...displayedRoute, hud.player];
    if (points.length === 0) return focusPlayer();
    setMapView(fitRegionalMapBounds({
      minX: Math.min(...points.map((point) => point.x)),
      maxX: Math.max(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxY: Math.max(...points.map((point) => point.y)),
    }, mapAspect, ROAD_SPACING * 2));
  };

  const handleMapPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!full || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragged: false,
    };
  };

  const handleMapPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pointer = pointerRef.current;
    if (!full || !pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) {
      pointer.dragged = true;
    }
    if (!pointer.dragged) return;
    const svg = event.currentTarget;
    setMapView((current) => panRegionalMapView(current, mapAspect, {
      x: -dx / Math.max(1, svg.clientWidth) * activeViewBox.width,
      y: -dy / Math.max(1, svg.clientHeight) * activeViewBox.height,
    }));
  };

  const handleMapPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!pointer.dragged) selectDestination(event.clientX, event.clientY, event.currentTarget);
  };

  const handleMapWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    if (!full) return;
    event.preventDefault();
    const focus = clientPointToMap(event.clientX, event.clientY, event.currentTarget) ?? mapView.center;
    const factor = event.deltaY < 0 ? 0.78 : 1.28;
    setMapView((current) => zoomRegionalMapView(current, mapAspect, factor, focus));
  };

  const handleMapKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!full) return;
    if (event.key === "Enter" || event.key === " ") {
      if (draftDestination && onDestinationCommit) {
        event.preventDefault();
        onDestinationCommit();
      }
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setMapView((current) => zoomRegionalMapView(current, mapAspect, 0.78));
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      setMapView((current) => zoomRegionalMapView(current, mapAspect, 1.28));
      return;
    }
    if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      showOverview();
      return;
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      focusPlayer();
      return;
    }
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      fitRoute();
      return;
    }
    const movement = event.key === "ArrowLeft"
      ? [-CUSTOM_DESTINATION_KEYBOARD_STEP, 0]
      : event.key === "ArrowRight"
        ? [CUSTOM_DESTINATION_KEYBOARD_STEP, 0]
        : event.key === "ArrowUp"
          ? [0, -CUSTOM_DESTINATION_KEYBOARD_STEP]
          : event.key === "ArrowDown"
            ? [0, CUSTOM_DESTINATION_KEYBOARD_STEP]
            : null;
    if (!movement) return;
    event.preventDefault();
    if (event.shiftKey && onDestinationDraft) {
      const origin = draftDestination ?? hud.customDestination ?? hud.player;
      onDestinationDraft(moveCustomDestination(origin, movement[0], movement[1]));
      return;
    }
    setMapView((current) => panRegionalMapView(current, mapAspect, {
      x: movement[0] / CUSTOM_DESTINATION_KEYBOARD_STEP * current.spanY * 0.12,
      y: movement[1] / CUSTOM_DESTINATION_KEYBOARD_STEP * current.spanY * 0.12,
    }));
  };

  const mapSvg = (
    <svg
      ref={svgRef}
      className={`gps-svg ${full ? "is-full is-selectable" : ""}`}
      viewBox={viewBox}
      role="img"
      tabIndex={full ? 0 : undefined}
      aria-label={full
        ? "Interactive Neon Fare regional GPS. Tap a street to move the pin, drag to pan, use the toolbar or wheel to zoom, and press Enter to set the route."
        : "Heading-up GPS route map"}
      onPointerDown={full ? handleMapPointerDown : undefined}
      onPointerMove={full ? handleMapPointerMove : undefined}
      onPointerUp={full ? handleMapPointerUp : undefined}
      onPointerCancel={full ? () => { pointerRef.current = null; } : undefined}
      onWheel={full ? handleMapWheel : undefined}
      onKeyDown={full ? handleMapKeyDown : undefined}
    >
      <defs><clipPath id={clipId}><rect x={activeViewBox.minX} y={activeViewBox.minY} width={activeViewBox.width} height={activeViewBox.height} rx={full ? markerScale * 8 : 4} /></clipPath></defs>
      <rect className="gps-map-bg" x={activeViewBox.minX} y={activeViewBox.minY} width={activeViewBox.width} height={activeViewBox.height} />
      <g clipPath={`url(#${clipId})`}>
        {full && mapDetail === "overview" && (
          <g className="gps-region-slots" aria-hidden="true">
            {REGIONAL_MAP_SLOTS.map((slot) => {
              const centerX = (slot.bounds.minX + slot.bounds.maxX) / 2;
              const centerY = (slot.bounds.minY + slot.bounds.maxY) / 2;
              return (
                <g key={slot.direction} className={slot.activeRegion ? "is-active" : "is-future"}>
                  <rect
                    x={slot.bounds.minX}
                    y={slot.bounds.minY}
                    width={slot.bounds.maxX - slot.bounds.minX}
                    height={slot.bounds.maxY - slot.bounds.minY}
                    rx={markerScale * 7}
                  />
                  {!slot.activeRegion && (
                    <g transform={`translate(${centerX} ${centerY}) scale(${markerScale})`}>
                      <text textAnchor="middle"><tspan x="0">{slot.direction}</tspan><tspan x="0" dy="17">FUTURE REGION</tspan></text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}
        {full && (
          <g className="gps-regions gps-region-fills" aria-hidden="true">
            {mappedRegions.map(({ region, bounds }) => (
              <rect
                key={region.id}
                className={`gps-region-fill gps-region--${region.theme}`}
                x={bounds.minX}
                y={bounds.minY}
                width={bounds.maxX - bounds.minX}
                height={bounds.maxY - bounds.minY}
                fill={region.mapColor}
              />
            ))}
          </g>
        )}
        {(full || mountainPlayer) && <g transform={terrainTransform}><NorthstarTopography /></g>}
        {(full || copperPlayer) && <g transform={terrainTransform}><CopperTopography /></g>}
        {(full || coastPlayer) && <g transform={terrainTransform}><CoastTopography /></g>}
        {(!full || mapDetail !== "overview") && <g className="gps-roads">
          {roadLines.map((line) => {
            const a = pointFor(line.a);
            const b = pointFor(line.b);
            return <line key={line.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>}
        <g className="gps-special-roads" aria-hidden="true">
          {specialRoadPolylines.map(({ road, points }) => (
            <polyline
              key={road.id}
              className={`gps-special-road gps-special-road--${road.kind}`}
              points={points}
            />
          ))}
        </g>
        {full && (
          <g className="gps-regions gps-region-overlays" aria-hidden="true">
            {mappedRegions.map(({ region, bounds }) => {
              const centerX = (bounds.minX + bounds.maxX) / 2;
              return (
                <g key={region.id} className={`gps-region gps-region--${region.theme}`}>
                  <rect
                    className="gps-region-boundary"
                    x={bounds.minX}
                    y={bounds.minY}
                    width={bounds.maxX - bounds.minX}
                    height={bounds.maxY - bounds.minY}
                    rx="10"
                  />
                  <g className="gps-region-label" transform={`translate(${centerX} ${bounds.minY + markerScale * 36}) scale(${markerScale})`}>
                    <rect x="-102" y="-17" width="204" height="34" rx="5" />
                    <text y="6" textAnchor="middle">{region.direction === "C" ? "CENTER" : region.direction} · {region.name}</text>
                  </g>
                </g>
              );
            })}
          </g>
        )}
        {full && mapDetail !== "overview" && (
          <g className="gps-landmarks" aria-hidden="true">
            {FEATURED_CITY_LANDMARKS.map((landmark) => {
              const center = landmarkWorldCenter(landmark);
              const width = landmark.width * ROAD_SPACING - ROAD_HALF * 2;
              const height = landmark.height * ROAD_SPACING - ROAD_HALF * 2;
              const labelFacesWest = centerRegionBounds
                ? center.x > centerRegionBounds.minX + (centerRegionBounds.maxX - centerRegionBounds.minX) * 0.67
                : center.x > (WORLD_MIN_X + WORLD_MAX_X) / 2;
              return (
                <g key={landmark.id} transform={`translate(${center.x} ${center.y})`}>
                  <rect
                    className="gps-landmark-footprint"
                    x={-width / 2}
                    y={-height / 2}
                    width={width}
                    height={height}
                    rx="7"
                  />
                  <g transform={`scale(${markerScale})`}>
                    <rect className="gps-landmark-marker" x="-6" y="-6" width="12" height="12" rx="2" transform="rotate(45)" />
                    {mapDetail === "local" && <text x={labelFacesWest ? -12 : 12} y="5" textAnchor={labelFacesWest ? "end" : "start"}>{landmark.label}</text>}
                  </g>
                </g>
              );
            })}
            {REGIONAL_CONTENT.flatMap((entry) => entry.anchors.map((anchor) => {
              const center = {
                x: (anchor.originX + anchor.width / 2) * ROAD_SPACING,
                y: (anchor.originY + anchor.height / 2) * ROAD_SPACING,
              };
              const width = anchor.width * ROAD_SPACING - ROAD_HALF * 2;
              const height = anchor.height * ROAD_SPACING - ROAD_HALF * 2;
              const labelFacesWest = entry.mapLabelPolicy === "always-west"
                || (entry.mapLabelPolicy === "far-east" && center.x > WORLD_MIN_X + mapWidth * 0.76)
                || (entry.mapLabelPolicy === "positive-x" && center.x > 0);
              return (
                <g key={`${entry.id}:${anchor.id}`} className={`gps-landmark--${entry.theme}`} transform={`translate(${center.x} ${center.y})`}>
                  <rect
                    className="gps-landmark-footprint"
                    x={-width / 2}
                    y={-height / 2}
                    width={width}
                    height={height}
                    rx="7"
                  />
                  <g transform={`scale(${markerScale})`}>
                    <rect className="gps-landmark-marker" x="-6" y="-6" width="12" height="12" rx="2" transform="rotate(45)" />
                    {mapDetail === "local" && <text x={labelFacesWest ? -12 : 12} y="5" textAnchor={labelFacesWest ? "end" : "start"}>{anchor.label}</text>}
                  </g>
                </g>
              );
            }))}
          </g>
        )}
        <polyline className="gps-route-shadow" points={routePoints} />
        <polyline className={`gps-route-line ${displayedRouteType}`} points={routePoints} />
        {full && hud.customDestination && hud.missionType !== "roam" && (
          <circle
            className={`gps-mission-target ${hud.missionType}`}
            cx={hud.target.x}
            cy={hud.target.y}
            r="13"
            aria-hidden="true"
          />
        )}
        {full && mapDetail !== "overview" && (
          <g className="gps-pois" aria-hidden="true">
            {hud.fareDestinations.map((destination, index) => (
              <g key={destination.id} className={`gps-poi gps-poi--${index % 3}`} transform={`translate(${destination.point.x} ${destination.point.y}) scale(${markerScale})`}>
                {mapDetail === "local" && <rect className="gps-poi-label" x="10" y="-12" width={destination.label.length * 8 + 15} height="24" rx="4" />}
                <rect className="gps-poi-marker" x="-6" y="-6" width="12" height="12" rx="2" />
                {mapDetail === "local" && <text x="15" y="6">{destination.label}</text>}
              </g>
            ))}
          </g>
        )}
        <g className="gps-fares" aria-hidden="true">
          {pickupMarkers.filter((marker) => !full || mapDetail !== "overview" || marker.selected).map((marker) => (
            <g
              key={marker.id}
              className={`gps-fare-marker ${marker.selected ? "is-selected" : ""}`}
              transform={`translate(${marker.screenPoint.x} ${marker.screenPoint.y})${full ? ` scale(${markerScale})` : ""}`}
            >
              <circle r={marker.selected ? (full ? 11 : 8.2) : (full ? 7 : 4.7)} />
              {full && (mapDetail === "local" || marker.selected) && <text x="12" y="5">{marker.rider}</text>}
            </g>
          ))}
        </g>
        {full && <g className="gps-couriers" aria-hidden="true">
          {courierMarkers.map((marker) => (
            <g
              key={marker.id}
              className={`gps-courier-marker ${marker.active ? "is-active" : ""} is-${marker.phase}`}
              transform={`translate(${marker.screenPoint.x} ${marker.screenPoint.y}) scale(${markerScale})`}
            >
              <rect x="-7" y="-7" width="14" height="14" rx="2" transform="rotate(45)" />
              {marker.active && mapDetail !== "overview" && <text x="12" y="5">ACTIVE · {marker.label}</text>}
            </g>
          ))}
        </g>}
        {showNavigationTarget && (full
          ? <g transform={`translate(${target.x} ${target.y}) scale(${markerScale})`}><circle className={`gps-target ${displayedRouteType}`} r="9" /></g>
          : <circle className={`gps-target ${displayedRouteType}`} cx={target.x} cy={target.y} r="5.4" />)}
        {full && draftDestination && (
          <g className="gps-custom-pin is-draft" transform={`translate(${draftDestination.x} ${draftDestination.y}) scale(${markerScale})`} aria-hidden="true">
            <circle r="14" />
            <path d="M 0 -18 C 10 -18 14 -6 9 2 L 0 17 L -9 2 C -14 -6 -10 -18 0 -18 Z" />
            <circle className="gps-custom-pin-core" r="4" cy="-5" />
          </g>
        )}
        {turnCue && turnPoint && (
          <g className="gps-turn-cue" transform={`translate(${turnPoint.x} ${turnPoint.y})${full ? ` scale(${markerScale})` : ""} rotate(${turnRotation})`}>
            <circle r={full ? 31 : 10.5} />
            <polygon points={full ? "0,-31 24,7 9,5 9,28 -9,28 -9,5 -24,7" : "0,-11 8,3 3,2 3,9 -3,9 -3,2 -8,3"} />
          </g>
        )}
        {(activeDraftPlan?.requiresUTurn ?? hud.needsUTurn) && (
          <g className="gps-uturn-cue" transform={`translate(${player.x} ${player.y})${full ? ` scale(${markerScale})` : ""}`}>
            <circle r={full ? 39 : 13} />
            <text y={full ? 15 : 5} fontSize={full ? 49 : 17}>↶</text>
          </g>
        )}
        <g className="gps-taxi" transform={`translate(${player.x} ${player.y}) ${full ? `scale(${markerScale}) rotate(${hud.heading * 180 / Math.PI + 90})` : ""}`}>
          <polygon points={full ? "0,-24 17,18 0,10 -17,18" : "0,-7 5,5 0,3 -5,5"} />
        </g>
        {full && walker && <g className="gps-walker" transform={`translate(${walker.x} ${walker.y}) scale(${markerScale})`}>
          <circle r="18" /><text y="7">W</text>
        </g>}
      </g>
    </svg>
  );
  if (!full) return mapSvg;
  return (
    <div className="regional-map">
      <div className="regional-map-toolbar" aria-label="Map view controls">
        <button type="button" onClick={() => setMapView((current) => zoomRegionalMapView(current, mapAspect, 1.28))} aria-label="Zoom out">−</button>
        <output aria-label="Map zoom">{regionalMapZoomPercent(mapView.spanY)}%</output>
        <button type="button" onClick={() => setMapView((current) => zoomRegionalMapView(current, mapAspect, 0.78))} aria-label="Zoom in">+</button>
        <button type="button" onClick={focusPlayer}>MY CAB</button>
        <button type="button" onClick={fitRoute}>FIT ROUTE</button>
        <button type="button" onClick={showOverview}>ALL 9 REGIONS</button>
        <span>{mapDetail.toUpperCase()} VIEW</span>
        {(mountainPlayer || copperPlayer || coastPlayer) && <output aria-label="Altitude">ELEV {Math.round((hud.player.z ?? 0) * DISPLAY_METERS_PER_WORLD_UNIT).toLocaleString()} m</output>}
      </div>
      <div className="regional-map-regions" aria-label="Active regions">
        {ACTIVE_WORLD_REGIONS.map((region) => (
          <button key={region.id} type="button" onClick={() => setMapView(regionalMapRegionView(region, mapAspect))}>
            {region.direction === "C" ? "CENTER" : region.direction} · {region.shortName}
          </button>
        ))}
      </div>
      {mapSvg}
    </div>
  );
}
