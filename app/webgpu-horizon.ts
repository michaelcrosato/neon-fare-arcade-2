/* eslint-disable @typescript-eslint/no-explicit-any -- Runtime WebGPU types. */
import type { Camera, Game } from "@/game/model";
import { controlledPose } from "@/game/player";
import { HORIZON_HEIGHT, HORIZON_WIDTH } from "@/game/render/horizon";
import { HORIZON_UNIFORM_BYTES, horizonView } from "@/game/render/horizon-view";
import { HorizonPanorama } from "./horizon-panorama";

export class WebGPUHorizon {
  private panorama = new HorizonPanorama();
  private revision = -1;
  private pipeline: any;
  private uniform: any;
  private textures: any[];
  private group: any;

  constructor(private device: any, format: string, sampleCount = 1, depthFormat = "depth24plus") {
    const shader = device.createShaderModule({ code: `
struct View { right: vec4<f32>, up: vec4<f32>, forward: vec4<f32>, options: vec4<f32> };
@group(0) @binding(0) var<uniform> view: View;
@group(0) @binding(1) var panoramaSampler: sampler;
@group(0) @binding(2) var previous: texture_2d<f32>;
@group(0) @binding(3) var current: texture_2d<f32>;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) clip: vec2<f32> };
@vertex fn vertex(@builtin(vertex_index) i: u32) -> Vertex {
  let positions = array<vec2<f32>, 3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));
  // Exactly the far plane: the pass draws after opaque geometry and a
  // less-or-equal test then limits it to pixels nothing else covered.
  var out: Vertex; out.clip=positions[i]; out.position=vec4<f32>(out.clip,1.0,1); return out;
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4<f32> {
  if (view.options.x < 0.5) {
    return vec4<f32>(mix(vec3<f32>(.74,.83,.85),vec3<f32>(.3,.65,.83),clamp(v.clip.y*.5+.5,0,1)),1);
  }
  let ray = view.forward.xyz + view.right.xyz*v.clip.x + view.up.xyz*v.clip.y;
  let uv = vec2<f32>(atan2(ray.y,ray.x)/6.283185307+.5, .5-atan2(ray.z,length(ray.xy))/3.141592654);
  return mix(textureSampleLevel(previous,panoramaSampler,uv,0),textureSampleLevel(current,panoramaSampler,uv,0),view.options.y);
}` });
    this.pipeline = device.createRenderPipeline({ layout: "auto",
      vertex: { module: shader, entryPoint: "vertex" }, fragment: { module: shader, entryPoint: "fragment", targets: [{ format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      // The panorama shares the scene pass, so it must match its attachments.
      multisample: { count: sampleCount },
      depthStencil: { format: depthFormat, depthWriteEnabled: false, depthCompare: "less-equal" } });
    this.uniform = device.createBuffer({ size: HORIZON_UNIFORM_BYTES, usage: 0x40 | 0x08 });
    this.textures = [0, 1].map(() => device.createTexture({ size: [HORIZON_WIDTH, HORIZON_HEIGHT], format: "rgba8unorm", usage: 0x04 | 0x02 | 0x10 }));
    const sampler = device.createSampler({ addressModeU: "repeat", addressModeV: "clamp-to-edge", minFilter: "linear", magFilter: "linear" });
    this.group = device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.uniform } }, { binding: 1, resource: sampler },
      ...this.textures.map((texture, i) => ({ binding: i + 2, resource: texture.createView() })),
    ] });
  }
  render(pass: any, game: Game, camera: Camera, seconds: number, aspect: number) {
    const frame = this.panorama.update(controlledPose(game), seconds);
    if (this.revision !== frame.revision) {
      [frame.previous, frame.current].forEach((source, i) => this.device.queue.copyExternalImageToTexture(
        { source }, { texture: this.textures[i] }, [HORIZON_WIDTH, HORIZON_HEIGHT]));
      this.revision = frame.revision;
    }
    this.device.queue.writeBuffer(this.uniform, 0, horizonView(game, camera, aspect, frame.blend));
    pass.setPipeline(this.pipeline); pass.setBindGroup(0, this.group); pass.draw(3);
    return frame.regionId;
  }
  destroy() { this.uniform.destroy(); for (const texture of this.textures) texture.destroy(); }
}
