import { Canvas2DRenderer } from "../../../app/canvas2d-renderer";
import { makeGame } from "../../../game/state";
import { defaultCameraBoom } from "../../../game/config";
import { buildNavigationPlan } from "../../../game/navigation";
import type { CameraMode, WorldView } from "../../../game/model";

declare global {
  interface Window {
    fallbackCamera: {
      render(mode: CameraMode): { backend: string; nearWidth: number; farWidth: number; milliseconds: number };
      loseContext(): void;
    };
  }
}

const canvas = document.createElement("canvas");
canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh";
document.body.append(canvas);
const renderer = new Canvas2DRenderer(canvas);
const game = makeGame("street-ace", 543, "free-run");
game.traffic = []; game.fareDispatchEnabled = false; game.x=0;game.y=0;
const world: WorldView = {
  key: "perspective-size-proof", colliders: [], chunks: [], interactions: [], boxes: [
    {x:0,y:0,z:-0.2,sx:200,sy:200,sz:0.2,yaw:0,color:[0.18,0.18,0.18,1]},
    {x:-2.5,y:-10,z:1,sx:2,sy:2,sz:2,yaw:0,color:[1,0,0,1]},
    {x:2.5,y:-30,z:1,sx:2,sy:2,sz:2,yaw:0,color:[1,0,1,1]},
  ],
};
window.fallbackCamera = {
  render(mode) {
    renderer.resize();
    const start = performance.now();
    renderer.render(game, {x:0,y:0,heading:-Math.PI/2,heightOffset:0,zoom:1,mode,boom:defaultCameraBoom(mode)}, 0, world, buildNavigationPlan(game, game, game.heading));
    const milliseconds = performance.now() - start;
    const pixels = canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height).data;
    const near = {min:Infinity,max:-Infinity}, far = {min:Infinity,max:-Infinity};
    for(let i=0;i<pixels.length;i+=4) {
      if(pixels[i]<120 || pixels[i+1]>10) continue;
      const box = pixels[i+2] < 10 ? near : pixels[i+2]>120 ? far : null;
      if(box) {const x=i/4%canvas.width;box.min=Math.min(box.min,x);box.max=Math.max(box.max,x);}
    }
    return {backend:canvas.dataset.renderer!,nearWidth:near.max-near.min,farWidth:far.max-far.min,milliseconds};
  },
  loseContext() {
    // A test-only context capture is installed before construction.
    const gl = (window as unknown as {capturedGL:WebGL2RenderingContext}).capturedGL;
    gl.getExtension("WEBGL_lose_context")!.loseContext();
  },
};
