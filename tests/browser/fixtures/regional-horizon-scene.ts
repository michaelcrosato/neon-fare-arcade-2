import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { makeGame } from "../../../game/state";
import { CityStream } from "../../../game/world";
import { terrainHeightAt } from "../../../game/terrain/surface";
import { ACTIVE_WORLD_REGIONS, regionRoadBounds, regionForPosition } from "../../../game/regions";
import { buildNavigationPlan } from "../../../game/navigation";
import { chaseCameraPreset } from "../../../game/config";
import type { Camera, CameraMode, Renderer, WorldView } from "../../../game/model";
import type { WorldRegionId } from "../../../game/region-types";
import { paintHorizonPanorama } from "../../../app/horizon-panorama";

type View = {
  region: WorldRegionId;
  heading: number;
  mode?: CameraMode;
  mobile?: boolean;
  position?: { x: number; y: number };
  skyOnly?: boolean;
  seconds?: number;
};
declare global {
  interface Window {
    regionalHorizon: {
      mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>;
      render(view: View): { region: string; boxes: number; x: number; y: number };
      panorama(region: WorldRegionId): { opaque: boolean; continuousBase: boolean; region: string; width: number; height: number };
    };
  }
}
const game = makeGame("street-ace", 1527, "free-run");
const stream = new CityStream();
let renderer: Renderer;
window.regionalHorizon = {
  async mount(kind) {
    const canvas = document.createElement("canvas");
    canvas.id = "horizon-fixture";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999";
    document.body.append(canvas);
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Horizon fixture GPU failed"); }, () => false))!;
    if (!renderer) throw new Error("Horizon fixture adapter unavailable");
    return renderer.kind;
  },
  render({ region, heading, mode = "cab", mobile = false, position, skyOnly = false, seconds = 40 }) {
    const bounds = regionRoadBounds(ACTIVE_WORLD_REGIONS.find(r => r.id === region)!);
    const point = position ?? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const z = terrainHeightAt(point.x, point.y) + 0.64;
    Object.assign(game, point, { z, heading, elapsed: 40, traffic: [] });
    game.roadMotion.pitch = 0; game.roadMotion.roll = 0;
    const world: WorldView = skyOnly
      ? { key: "horizon-only", boxes: [], colliders: [], chunks: [], interactions: [] }
      : stream.update(game.x, game.y, mode === "fixed" ? 1 : 3);
    const camera: Camera = { ...point, heading, mode, zoom: 1, onFoot: false, mobile,
      boom: mode === "chase-high" || mode === "chase-low" ? chaseCameraPreset(mode, false).distance : 0,
      // Isolate the existing backdrop without changing the production renderer.
      heightOffset: skyOnly ? 3000 : z };
    renderer.render(game, camera, seconds, world, buildNavigationPlan(game, { x: 0, y: 2 }, heading));
    return { region: regionForPosition(point.x, point.y).id, boxes: world.boxes.length, ...point };
  },
  panorama(region) {
    const bounds = regionRoadBounds(ACTIVE_WORLD_REGIONS.find(r => r.id === region)!);
    const canvas = document.createElement("canvas"); canvas.id = "panorama-art";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:50vw;z-index:10000";
    document.querySelector("#panorama-art")?.remove(); document.body.append(canvas);
    const profile = paintHorizonPanorama(canvas, { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 });
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = true;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { opaque = false; break; }
    const row = Math.round(canvas.height * (.5 + .04 / Math.PI));
    let continuousBase = true;
    for (let x = 0; x < canvas.width; x++) {
      const offset = (row * canvas.width + x) * 4;
      if (Math.min(data[offset], data[offset + 1], data[offset + 2]) >= 180) continuousBase = false;
    }
    return { opaque, continuousBase, region: profile.regionId, width: canvas.width, height: canvas.height };
  },
};
