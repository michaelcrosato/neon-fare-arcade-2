import {
  CYAN,
  DISPLAY_METERS_PER_WORLD_UNIT,
  INK,
  MAT_TURN,
  RED,
  WHITE,
  YELLOW,
} from "../config";
import { clamp, localPoint } from "../math";
import type {
  Box,
  CameraMode,
  Color,
  Game,
  NavigationPlan,
  Vec2,
} from "../model";
import { isDriving } from "../player";
import { routeLength } from "../route-geometry";

export function navigationDistanceBadge(game: Game, seconds: number, navigation: NavigationPlan) {
  if (!isDriving(game) || (!navigation.requiresUTurn && !navigation.turnCue)) return null;
  const meters = (distance: number) => {
    const value = Math.max(0, Math.round(distance * DISPLAY_METERS_PER_WORLD_UNIT));
    return value >= 1000 ? `${(value / 1000).toFixed(1)}km` : `${value}m`;
  };
  const remaining = meters(routeLength(navigation.route));
  const cue = navigation.turnCue;
  const uTurn = navigation.requiresUTurn;
  const origin = uTurn ? localPoint(game.x, game.y, game.heading, 10.5, 0) : cue!.point;
  return {
    point: { x: origin.x, y: origin.y, z: (uTurn ? game.z : cue!.point.z ?? 0) + 9.6 + Math.sin(seconds * 5) * .3 },
    label: uTurn ? "U-TURN" : cue!.kind === "right" ? "TURN RIGHT" : "TURN LEFT",
    distance: uTurn ? remaining : meters(cue!.distance),
    remaining: uTurn ? "TO DESTINATION" : `${remaining} TO GO`,
  };
}

export type ArrowGlyphPiece = { forward: number; cross: number; length: number; breadth: number };

export function navigationArrowPitch(cameraMode: CameraMode) {
  if (cameraMode === "fixed") return 0;
  if (cameraMode === "chase-high") return 1.05;
  if (cameraMode === "chase-low") return 1.38;
  return 1.5;
}

function addArrowGlyphLayer(
  boxes: Box[],
  origin: Vec2,
  yaw: number,
  hover: number,
  pitch: number,
  scale: number,
  pieces: ArrowGlyphPiece[],
  color: Color,
  grow: number,
  depthOffset: number,
  thickness = 0.68,
) {
  const cosine = Math.cos(pitch);
  const sine = Math.sin(pitch);
  for (const piece of pieces) {
    const cross = piece.cross * scale * cosine - depthOffset * sine;
    const point = localPoint(origin.x, origin.y, yaw, piece.forward * scale, cross);
    boxes.push({
      x: point.x,
      y: point.y,
      z: hover + piece.cross * scale * sine + depthOffset * cosine,
      sx: piece.length * scale * grow,
      sy: piece.breadth * scale * grow,
      sz: thickness * grow,
      yaw,
      pitch: clamp(pitch, -Math.PI / 2, Math.PI / 2),
      color,
      material: MAT_TURN,
    });
  }
}

export function turnArrowBoxes(seconds: number, navigation: NavigationPlan, cameraMode: CameraMode) {
  const cue = navigation.turnCue;
  if (!cue) return [];
  const boxes: Box[] = [];
  const arrival = clamp((110 - cue.distance) / 15, 0, 1);
  const nearPulse = cue.distance < 30 ? 1 + Math.sin(seconds * 8) * 0.07 : 1;
  const scale = (0.86 + arrival * 0.24) * nearPulse;
  const hover = 5.9 + Math.sin(seconds * 5) * 0.3;
  const pitch = navigationArrowPitch(cameraMode) * (cue.kind === "right" ? -1 : 1);
  const pieces: ArrowGlyphPiece[] = [
    { forward: 1.4, cross: 0, length: 4.8, breadth: 0.95 },
    { forward: 4.45, cross: 0, length: 1.8, breadth: 0.95 },
    { forward: 3.9, cross: 0.85, length: 1.7, breadth: 0.95 },
    { forward: 3.9, cross: -0.85, length: 1.7, breadth: 0.95 },
    { forward: 3.15, cross: 1.65, length: 1.35, breadth: 0.95 },
    { forward: 3.15, cross: -1.65, length: 1.35, breadth: 0.95 },
  ];

  addArrowGlyphLayer(boxes, cue.point, cue.yaw, hover, pitch, scale, pieces, INK, 1.16, 0);
  addArrowGlyphLayer(boxes, cue.point, cue.yaw, hover, pitch, scale, pieces, YELLOW, 1, 0.46);
  addArrowGlyphLayer(boxes, cue.point, cue.yaw, hover, pitch, scale, [
    { forward: 1.35, cross: pitch < 0 ? -0.32 : 0.32, length: 2.6, breadth: 0.13 },
  ], WHITE, 1, 0.86, 0.12);
  boxes.push({ x: cue.point.x, y: cue.point.y, z: 2.65, sx: 0.18, sy: 0.18, sz: 4.8, yaw: 0, color: CYAN, material: MAT_TURN });
  boxes.push({ x: cue.point.x, y: cue.point.y, z: 0.45, sx: 5.2, sy: 0.22, sz: 0.12, yaw: seconds * 1.8, color: WHITE, material: MAT_TURN });
  boxes.push({ x: cue.point.x, y: cue.point.y, z: 0.45, sx: 5.2, sy: 0.22, sz: 0.12, yaw: seconds * 1.8 + Math.PI / 2, color: CYAN, material: MAT_TURN });
  for (const box of boxes) box.z += cue.point.z ?? 0;
  return boxes;
}

export function uTurnArrowBoxes(game: Game, seconds: number, cameraMode: CameraMode) {
  const boxes: Box[] = [];
  const hover = 6.1 + Math.sin(seconds * 5) * 0.3;
  const scale = 1 + Math.sin(seconds * 7) * 0.045;
  const beacon = localPoint(game.x, game.y, game.heading, 10.5, 0);
  const planeYaw = game.heading - Math.PI / 2;
  const pitch = navigationArrowPitch(cameraMode);
  // A classic hairpin: rise on the right, round across the crown, descend
  // on the left, then finish in a broad downward arrowhead.
  const pieces: ArrowGlyphPiece[] = [
    { forward: 2.05, cross: -0.15, length: 0.9, breadth: 3.7 },
    { forward: 1.8, cross: 1.9, length: 1.1, breadth: 0.9 },
    { forward: 1.2, cross: 2.4, length: 1.1, breadth: 0.9 },
    { forward: 0.45, cross: 2.7, length: 1.2, breadth: 0.85 },
    { forward: -0.45, cross: 2.7, length: 1.2, breadth: 0.85 },
    { forward: -1.2, cross: 2.4, length: 1.1, breadth: 0.9 },
    { forward: -1.8, cross: 1.9, length: 1.1, breadth: 0.9 },
    { forward: -2.05, cross: 0.4, length: 0.9, breadth: 2.9 },
    { forward: -2.9, cross: -0.75, length: 1.1, breadth: 0.75 },
    { forward: -1.2, cross: -0.75, length: 1.1, breadth: 0.75 },
    { forward: -2.5, cross: -1.25, length: 0.9, breadth: 0.8 },
    { forward: -1.6, cross: -1.25, length: 0.9, breadth: 0.8 },
    { forward: -2.05, cross: -1.72, length: 0.9, breadth: 0.95 },
  ];

  addArrowGlyphLayer(boxes, beacon, planeYaw, hover, pitch, scale, pieces, INK, 1.16, 0);
  addArrowGlyphLayer(boxes, beacon, planeYaw, hover, pitch, scale, pieces, YELLOW, 1, 0.46);
  addArrowGlyphLayer(boxes, beacon, planeYaw, hover, pitch, scale, [
    { forward: 0, cross: 3.08, length: 1.6, breadth: 0.13 },
  ], WHITE, 1, 0.86, 0.12);
  boxes.push({ x: beacon.x, y: beacon.y, z: 2.65, sx: 0.2, sy: 0.2, sz: 4.8, yaw: 0, color: CYAN, material: MAT_TURN });
  boxes.push({ x: beacon.x, y: beacon.y, z: 0.45, sx: 5.5, sy: 0.24, sz: 0.12, yaw: seconds * 1.8, color: WHITE, material: MAT_TURN });
  boxes.push({ x: beacon.x, y: beacon.y, z: 0.45, sx: 5.5, sy: 0.24, sz: 0.12, yaw: seconds * 1.8 + Math.PI / 2, color: RED, material: MAT_TURN });
  for (const box of boxes) box.z += game.z ?? 0;
  return boxes;
}

export function navigationArrowBoxes(game: Game, seconds: number, navigation: NavigationPlan, cameraMode: CameraMode) {
  if (!isDriving(game)) return [];
  return navigation.requiresUTurn
    ? uTurnArrowBoxes(game, seconds, cameraMode)
    : turnArrowBoxes(seconds, navigation, cameraMode);
}
