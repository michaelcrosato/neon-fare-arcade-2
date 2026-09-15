import { MAT_VEHICLE } from "../config";
import type { Camera, Color, Game, MeshFace, Vec3, VehicleId } from "../model";
import { isInterior } from "../player";
import { roadPosePoint } from "./road-pose";
import { taxiRoadPose } from "./scene";
import { boxSurfaceFaces } from "./surfaces";
import { accordBalancedModel, type VehicleSurfaceModel } from "./accord";

/** A separate, bounded dynamic mesh; never charged to world or box-instance budgets. */
export const MAX_VEHICLE_SURFACE_FACES = 2_048;
const INK: Color = [.035, .045, .055, 1];
const RUBBER: Color = [.07, .075, .08, 1];
const GLASS: Color = [.075, .23, .29, 1];
const CHROME: Color = [.67, .74, .76, 1];
const WHITE: Color = [.94, .95, .9, 1];
const RED: Color = [.94, .085, .045, 1];
const LAMP: Color = [1, .94, .69, 1];
const cache = new Map<VehicleId, VehicleSurfaceModel>();
export function usesVehicleMesh(game: Game, camera: Camera) {
  return game.vehicleId === "accord-v6" || camera.vehicleDetail === "detailed";
}
const point = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const face = (corners: MeshFace["corners"], color: Color): MeshFace => ({ corners, color, material: MAT_VEHICLE, kind: "architecture" });
function mapCorners(c: MeshFace["corners"], transform: (p: Vec3) => Vec3): MeshFace["corners"] {
  return c.length === 3 ? [transform(c[0]), transform(c[1]), transform(c[2])]
    : [transform(c[0]), transform(c[1]), transform(c[2]), transform(c[3])];
}

function box(out: MeshFace[], x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color, yaw = 0) {
  out.push(...boxSurfaceFaces({ x, y, z, sx, sy, sz, color, yaw, material: MAT_VEHICLE }));
}

/** Rings revolve around the axle (Y). Bevels and round sidewalls remain actual geometry. */
function wheelModel(): MeshFace[] {
  const out: MeshFace[] = [], segments = 20;
  const ring = (y: number, radius: number, angle: number) => point(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  const profile = [[-.18, .32], [-.15, .42], [-.09, .46], [.09, .46], [.15, .42], [.18, .32]];
  for (let i = 0; i < segments; i++) {
    const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
    for (let j = 1; j < profile.length; j++) {
      const [y0, r0] = profile[j - 1], [y1, r1] = profile[j];
      out.push(face([ring(y0, r0, a), ring(y0, r0, b), ring(y1, r1, b), ring(y1, r1, a)], j === 3 && i % 2 ? INK : RUBBER));
    }
    for (const side of [-1, 1]) {
      const y = side * .181;
      out.push(face([ring(y, .32, a), ring(y, .32, b), ring(y, .27, b), ring(y, .27, a)], CHROME));
      out.push(face([point(0, y * .99, 0), ring(y * .99, .27, a), ring(y * .99, .27, b)], INK));
      if (i % 4 < 2) out.push(face([ring(y * 1.02, .08, a), ring(y * 1.02, .27, a + .06), ring(y * 1.02, .27, b - .04), ring(y * 1.02, .08, b)], CHROME));
    }
  }
  box(out, 0, 0, 0, .13, .38, .13, CHROME);
  return out;
}

function buildCrownModel(): VehicleSurfaceModel {
  const body: MeshFace[] = [];
  const paint: Color = [1, .78, .015, 1];
  const shade: Color = [.86, .5, .018, 1];
  const length = 5.5, halfWidth = 1.12;
  const axles = [-1.62, 1.53];
  const rear = -1.55, front = 1.17;
  const roofRear = -1.03, roofFront = .68;
  const roofHeight = 2.03, roofWidth = halfWidth * .78;
  const waist = 1.19;
  const widthAt = (x: number) => halfWidth * (1 - .16 * Math.pow(Math.abs(x) / (length / 2), 4));
  const archAt = (x: number) => Math.max(.36, ...axles.map(axle => Math.abs(x - axle) <= .54 ? .49 + Math.sqrt(Math.max(0, .54 ** 2 - (x - axle) ** 2)) : .36));
  const sections = [-length / 2, -length / 2 + .16, 0, length / 2 - .18, length / 2,
    ...axles.flatMap(axle => Array.from({ length: 13 }, (_, i) => axle - .54 + i * .09))].sort((a, b) => a - b);
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1], b = sections[i], wa = widthAt(a), wb = widthAt(b);
    for (const side of [-1, 1]) {
      const surface = [point(a, side * wa, archAt(a)), point(b, side * wb, archAt(b)), point(b, side * wb, 1.08), point(a, side * wa, 1.08)] as const;
      body.push(face(side > 0 ? [surface[3], surface[2], surface[1], surface[0]] : surface, paint));
      body.push(face([point(a, side * wa, 1.08), point(b, side * wb, 1.08), point(b, side * wb * .93, waist), point(a, side * wa * .93, waist)], paint));
    }
    body.push(face([point(a, -wa * .93, waist), point(b, -wb * .93, waist), point(b, wb * .93, waist), point(a, wa * .93, waist)], paint));
  }
  box(body, 0, 0, .38, length - .4, halfWidth * 1.15, .2, INK);
  for (const end of [-1, 1]) {
    const x = end * length / 2, w = widthAt(x);
    body.push(face([point(x, -w, .36), point(x, w, .36), point(x, w, 1.08), point(x, -w, 1.08)], paint));
    body.push(face([point(x, -w, 1.08), point(x, w, 1.08), point(x, w * .93, waist), point(x, -w * .93, waist)], paint));
    box(body, x + end * .01, 0, .49, .06, w * 1.94, .07, INK);
    box(body, x + end * .02, 0, .76, .05, 1.18, .27, INK);
    box(body, x + end * .052, 0, .76, .015, .39, .14, WHITE);
    if (end > 0) {
      for (let slat = 0; slat < 4; slat++) box(body, x + .04, 0, .87 + slat * .055, .04, 1.25, .018, CHROME);
    }
    for (const side of [-1, 1]) {
      const inner = side * w * .6, outer = side * w * .95;
      body.push(face([point(x + end * .034, inner, .94), point(x + end * .034, outer, .86), point(x + end * .034, outer, 1.08), point(x + end * .034, inner, 1.07)], end > 0 ? LAMP : RED));
      box(body, x - end * .17, side * (w + .005), .99, .34, .024, .14, end < 0 ? RED : [1, .52, .04, 1]);
      if (end < 0) box(body, x - .035, side * .67, .36, .20, .19, .11, CHROME);
    }
  }
  // The cabin is a tapered glasshouse, with separate pillars and a gently crowned roof.
  const sideWindow = (side: number, x: number, z: number) => {
    const blend = (z - waist) / (roofHeight - waist);
    return point(x, side * (halfWidth * .925 * (1 - blend) + roofWidth * blend), z);
  };
  for (const side of [-1, 1]) {
    body.push(face([sideWindow(side, rear, waist + .006), sideWindow(side, front, waist + .006), sideWindow(side, roofFront, roofHeight), sideWindow(side, roofRear, roofHeight)], GLASS));
    const pillar = (lowX: number, highX: number, thickness: number, color: Color) => {
      const corners = [sideWindow(side, lowX - thickness, waist), sideWindow(side, lowX, waist), sideWindow(side, highX, roofHeight), sideWindow(side, highX - thickness, roofHeight)] as const;
      body.push(face(mapCorners(corners, p => ({ ...p, y: p.y + side * .012 })), color));
    };
    pillar(front, roofFront, .065, paint);
    pillar(rear + .15, roofRear + .09, .15, paint);
    pillar(-.12, -.11, .055, INK);
    box(body, (front + rear) / 2, side * halfWidth * .93, waist, front - rear, .045, .035, CHROME);
    const doorRear = -.21;
    for (const edge of [-1.23, doorRear, .94]) {
      box(body, edge, side * (widthAt(edge) + .006), .77, .014, .012, .55, shade);
    }
    for (const handle of [-1.04, .06]) box(body, handle, side * (widthAt(handle) + .014), 1.018, .2, .055, .028, CHROME);
    box(body, .87, side * 1.03, 1.24, .11, .28, .065, INK);
    box(body, .86, side * 1.14, 1.32, .24, .22, .13, paint);
    box(body, .733, side * 1.14, 1.33, .009, .18, .08, CHROME);
    box(body, -.1, side * halfWidth, .38, 1.54, .06, .10, shade);
    for (let tile = 0; tile < 12; tile++) box(body, -1.25 + tile * .2, side * (widthAt(-1.25 + tile * .2) + .014), .91 + tile % 2 * .07, .19, .018, .065, INK);
  }
  for (const [lowX, highX, isFront] of [[front, roofFront, true], [rear, roofRear, false]] as const) {
    body.push(face([point(lowX, -halfWidth * .925, waist), point(lowX, halfWidth * .925, waist), point(highX, roofWidth, roofHeight), point(highX, -roofWidth, roofHeight)], GLASS));
    // Bright reflected strip and dark glass seals emphasize curvature without transparency sorting.
    const mid = lowX * .82 + highX * .18, h = waist * .82 + roofHeight * .18;
    const w = halfWidth * .925 * .82 + roofWidth * .18;
    body.push(face([point(mid, -w * .88, h + .009), point(mid, w * .88, h + .009), point(mid + (isFront ? -.05 : .05), w * .88, h + .04), point(mid + (isFront ? -.05 : .05), -w * .88, h + .04)], [.24, .48, .52, 1]));
  }
  const roofSections = [-1, -.75, 0, .75, 1];
  for (let i = 1; i < roofSections.length; i++) {
    const a = roofSections[i - 1], b = roofSections[i];
    const z = (t: number) => roofHeight + (1 - t * t) * .065;
    body.push(face([point(roofRear, roofWidth * a, z(a)), point(roofFront, roofWidth * a, z(a)), point(roofFront, roofWidth * b, z(b)), point(roofRear, roofWidth * b, z(b))], paint));
  }
  // Bonnet creases, trunk lip and roof equipment give each silhouette its own character.
  for (const side of [-1, 1]) body.push(face([point(front + .05, side * .61, waist + .008), point(length / 2 - .22, side * .49, waist + .008), point(length / 2 - .22, side * .51, waist + .008), point(front + .05, side * .65, waist + .008)], shade));
  box(body, -length / 2 + .28, 0, 1.21, .14, halfWidth * 1.70, .055, paint);
  {
    box(body, -.08, 0, roofHeight + .10, .58, .9, .065, INK);
    box(body, -.08, 0, roofHeight + .23, .46, .78, .21, LAMP);
    const letters = ["111010010010010", "010101111101101", "101101010101101", "111010010010111"];
    for (const side of [-1, 1]) for (let letter = 0; letter < 4; letter++) for (let pixel = 0; pixel < 15; pixel++) {
      if (letters[letter][pixel] !== "1") continue;
      const y = -side * (-.28 + letter * .145 + pixel % 3 * .035), z = roofHeight + .29 - Math.floor(pixel / 3) * .027;
      const x = -.08 + side * .232;
      body.push(face([point(x, y, z), point(x, y - side * .028, z), point(x, y - side * .028, z - .023), point(x, y, z - .023)], INK));
    }
  }
  const wheel = wheelModel();
  return { body, wheels: axles.flatMap(axle => [-1, 1].map(side => ({
    pivot: point(axle, side * (halfWidth - .04), .49), steers: axle > 0, faces: wheel,
  }))) };
}

export function detailedVehicleModel(id: VehicleId) {
  if (!cache.has(id)) cache.set(id, id === "accord-v6" ? accordBalancedModel() : buildCrownModel());
  return cache.get(id)!;
}

/** Both renderer families share wheel steering, road attachment, jumps and rollover pose. */
export function detailedTaxiSurfaces(game: Game): MeshFace[] {
  if (isInterior(game)) return [];
  const model = detailedVehicleModel(game.vehicleId), pose = taxiRoadPose(game);
  const sim = game.drivingModel === "simulation" ? game.simulationVehicle : null;
  const c = Math.cos(game.heading), s = Math.sin(game.heading);
  const cr = Math.cos(sim?.bodyRoll ?? 0), sr = Math.sin(sim?.bodyRoll ?? 0);
  const cp = Math.cos(sim?.bodyPitch ?? 0), sp = Math.sin(sim?.bodyPitch ?? 0);
  const transform = (p: Vec3): Vec3 => {
    const localZ = sim ? p.z - 1.05 : p.z;
    const y = p.y * cr - localZ * sr;
    const z = p.y * sr + localZ * cr;
    const x = cp * p.x + sp * z;
    const height = -sp * p.x + cp * z + (sim ? Math.abs(cr) * 1.05 + Math.abs(sr) * 1.18 : 0);
    return roadPosePoint(pose, { x: game.x + c * x - s * y, y: game.y + s * x + c * y, z: height });
  };
  const out = model.body.map(f => ({ ...f, corners: mapCorners(f.corners, transform) }));
  for (const wheel of model.wheels) {
    const steer = wheel.steers ? game.steering * .48 : 0, cs = Math.cos(steer), ss = Math.sin(steer);
    for (const f of wheel.faces) out.push({ ...f, corners: mapCorners(f.corners, p => transform({
      x: wheel.pivot.x + p.x * cs - p.y * ss, y: wheel.pivot.y + p.x * ss + p.y * cs, z: wheel.pivot.z + p.z,
    })) });
  }
  if (out.length > MAX_VEHICLE_SURFACE_FACES) throw new Error("Detailed vehicle surface budget exceeded");
  return out;
}
