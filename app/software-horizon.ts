import { HORIZON_HEIGHT, HORIZON_WIDTH } from "@/game/render/horizon";
import { horizonTexturePoint } from "@/game/render/horizon-view";
import { renderTargetSize } from "@/game/render/resolution";
import type { HorizonFrame } from "./webgl-horizon";

/** The last fallback samples the same artwork and ray basis at a bounded size. */
export class SoftwareHorizon {
  private canvas = document.createElement("canvas");
  private revision = -1;
  private images: Uint8ClampedArray[] = [];
  private key = "";
  render(context: CanvasRenderingContext2D, frame: HorizonFrame, basis: Float32Array, width: number, height: number) {
    if (basis[12] === 0) {
      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#4ca6d4"); sky.addColorStop(1, "#bdd3d8");
      context.fillStyle = sky; context.fillRect(0, 0, width, height); return;
    }
    if (this.revision !== frame.revision) {
      this.images = [frame.previous, frame.current].map(canvas => canvas.getContext("2d")!.getImageData(0, 0, HORIZON_WIDTH, HORIZON_HEIGHT).data);
      this.revision = frame.revision;
    }
    const size = renderTargetSize(width, height, 1, 160000);
    const key = `${frame.revision}:${size.width}:${size.height}:${Array.from(basis).join(":")}`;
    if (key !== this.key) {
      this.key = key; this.canvas.width = size.width; this.canvas.height = size.height;
      const image = new ImageData(size.width, size.height);
      for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
        const uv = horizonTexturePoint(basis, (x + .5) / size.width * 2 - 1, 1 - (y + .5) / size.height * 2);
        const sx = ((uv.u * HORIZON_WIDTH - .5) % HORIZON_WIDTH + HORIZON_WIDTH) % HORIZON_WIDTH;
        const sy = Math.max(0, Math.min(HORIZON_HEIGHT - 1.001, uv.v * HORIZON_HEIGHT - .5));
        const ix = Math.floor(sx), iy = Math.floor(sy), tx = sx - ix, ty = sy - iy;
        const offsets = [(iy * HORIZON_WIDTH + ix) * 4, (iy * HORIZON_WIDTH + (ix + 1) % HORIZON_WIDTH) * 4,
          ((iy + 1) * HORIZON_WIDTH + ix) * 4, ((iy + 1) * HORIZON_WIDTH + (ix + 1) % HORIZON_WIDTH) * 4];
        const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
        const dest = (y * size.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let value = 0;
          for (let sample = 0; sample < 4; sample++) {
            const offset = offsets[sample] + channel;
            value += (this.images[0][offset] * (1 - frame.blend) + this.images[1][offset] * frame.blend) * weights[sample];
          }
          image.data[dest + channel] = value;
        }
        image.data[dest + 3] = 255;
      }
      this.canvas.getContext("2d")!.putImageData(image, 0, 0);
    }
    context.drawImage(this.canvas, 0, 0, width, height);
  }
}
