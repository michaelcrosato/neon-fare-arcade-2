import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { createWebGPURenderer } from "../../../app/webgpu-renderer";
import { activePassengerJob, makeGame } from "../../../game/state";
import { NavigationController } from "../../../game/navigation";
import { normalizeNavigationSettings, type NavigationSettings } from "../../../game/navigation-policy";
import { defaultCameraBoom } from "../../../game/config";
import { CityStream } from "../../../game/world";
import { routeBoxes } from "../../../game/render/scene";
import { vehicleDepartureArrowBoxes } from "../../../game/render/navigation-glyph";
import type { Camera, CameraMode, Renderer } from "../../../game/model";

const game = makeGame("street-ace", 91, "free-run");
game.traffic = []; game.onboard = true;
const job = activePassengerJob(game);
job.dropoff = { x: 8, y: -360 }; job.dropoffApproach = { x: 0, y: -360 };
const stream = new CityStream();
const canvas = document.createElement("canvas");
canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
document.body.append(canvas);
let renderer: Renderer;
function draw(mode: CameraMode, patch: Partial<NavigationSettings> = {}, offRoute = true) {
  const settings = normalizeNavigationSettings({ arrowVisibility: "destination", arrowTarget: "destination", arrowSmoothing: "instant",
    routeStyle: "both", rerouteMode: "locked", ...patch });
  const controller = new NavigationController();
  Object.assign(game, { x: 0, y: -12, z: 0, heading: -Math.PI / 2, elapsed: 0 });
  controller.update(game, settings);
  Object.assign(game, { x: offRoute ? 36 : 0, elapsed: 8 });
  const navigation = controller.update(game, settings);
  const camera: Camera = { x: game.x, y: game.y, heightOffset: game.z, heading: game.heading, mode,
    mobile: innerWidth < 820, zoom: 1, boom: defaultCameraBoom(mode, 1), onFoot: false, distanceScale: 1 };
  const world = stream.update(game.x, game.y, mode === "fixed" ? 1 : 3);
  renderer.render(game, camera, 0, world, navigation);
  const boxes = routeBoxes(game, navigation.route, navigation);
  return { columns: boxes.filter(box => box.sz >= 40).length, total: boxes.length, offRoute: navigation.offRoute,
    arrow: vehicleDepartureArrowBoxes(game, 0, navigation, mode).length,
    yaw: navigation.departureArrowYaw, expectedYaw: Math.atan2(job.dropoff.y - game.y, job.dropoff.x - game.x) };
}
declare global { interface Window { navigationLabScene: { mount(kind: "WebGPU" | "Canvas 2D"): Promise<string>; draw: typeof draw } } }
window.navigationLabScene = {
  async mount(kind) {
    renderer = kind === "Canvas 2D" ? new Canvas2DRenderer(canvas)
      : (await createWebGPURenderer(canvas, () => { throw new Error("Navigation Lab GPU failure"); }, () => false))!;
    if (!renderer) throw new Error("WebGPU adapter unavailable");
    return renderer.kind;
  }, draw,
};
