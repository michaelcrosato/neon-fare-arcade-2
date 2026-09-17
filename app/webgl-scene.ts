import type { Box, Camera, WorldView } from "@/game/model";
import {
  cubeVertices,
  INSTANCE_BYTES,
  INSTANCE_FIELD_OFFSET_BYTES,
  INSTANCE_FLOATS,
  packBoxesInto,
} from "@/game/render/packing";
import { MAX_STREAM_BOXES } from "@/game/config";
import { packSurfaceQuads, SURFACE_VERTEX_BYTES } from "@/game/render/surfaces";
import { BEACON_FAR_DEPTH, sphereInView } from "@/game/render/clip";
import { MAT_WINDOW, MAT_LAMP, MAT_MARKER, MAT_ROUTE, MAT_TURN, MAT_BEACON } from "@/game/config";
import type { CompatibilityScene } from "./compatibility-scene";
import { WebGLHorizon, type HorizonFrame } from "./webgl-horizon";

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 normal;
in vec3 worldPosition;
in vec4 color;
flat in float material;
uniform vec2 cameraXY;
uniform float drawDistance;
uniform bool ghost;
out vec4 pixel;
void main() {
  if (ghost) { pixel=vec4(0.05,0.9,0.95,0.23); return; }
  if (material==${MAT_BEACON}.0) { pixel=color; return; }
  vec3 n=normalize(normal);
  float direct=max(0.0,dot(n,normalize(vec3(0.64,0.22,0.74))));
  float fill=0.7+max(0.0,n.z)*0.12;
  float key=floor(direct*4.0+0.5)/4.0*0.25;
  vec3 light=fill*vec3(0.96,1.0,1.06)+key*vec3(1.07,1.01,0.9);
  if(material==${MAT_WINDOW}.0 || material==${MAT_LAMP}.0 || material==${MAT_MARKER}.0 || material==${MAT_ROUTE}.0 || material==${MAT_TURN}.0) light=max(light,vec3(1.0));
  float fog=smoothstep(drawDistance*0.65,drawDistance,length(worldPosition.xy-cameraXY));
  pixel=vec4(mix(color.rgb*light,vec3(0.59,0.78,0.84),fog),color.a);
}`;

const BOX_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 vertex;
layout(location=1) in vec4 positionMaterial;
layout(location=2) in vec4 scaleYaw;
layout(location=3) in vec4 tint;
layout(location=4) in vec4 orientation;
uniform mat4 matrix;
out vec3 normal;
out vec3 worldPosition;
out vec4 color;
flat out float material;
vec3 rotate(vec3 p) {
  float cr=cos(orientation.x), sr=sin(orientation.x);
  float cp=cos(orientation.y), sp=sin(orientation.y);
  float cy=cos(scaleYaw.w), sy=sin(scaleYaw.w);
  p=vec3(p.x,cr*p.y-sr*p.z,sr*p.y+cr*p.z);
  p=vec3(cp*p.x+sp*p.z,p.y,-sp*p.x+cp*p.z);
  return vec3(cy*p.x-sy*p.y,sy*p.x+cy*p.y,p.z);
}
void main() {
  vec3 n=vertex.w>0.99?vec3(0,0,1):vertex.w<0.51?vec3(0,0,-1):
    abs(vertex.w-0.8)<0.01?vec3(1,0,0):abs(vertex.w-0.62)<0.01?vec3(-1,0,0):
    abs(vertex.w-0.72)<0.01?vec3(0,1,0):vec3(0,-1,0);
  normal=rotate(n);
  // abs() keeps every cuboid wound the same way so back faces can be culled;
  // a cube is symmetric, so a mirrored scale only reversed the triangle order.
  worldPosition=positionMaterial.xyz+rotate(vertex.xyz*abs(scaleYaw.xyz));
  color=tint; material=positionMaterial.w;
  vec4 clip=matrix*vec4(worldPosition,1);
  if (material==${MAT_BEACON}.0) clip.z=min(clip.z,clip.w*${BEACON_FAR_DEPTH});
  gl_Position=vec4(clip.xy,2.0*clip.z-clip.w,clip.w);
}`;

const SURFACE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 positionMaterial;
layout(location=1) in vec4 normalLight;
layout(location=2) in vec4 tint;
uniform mat4 matrix;
out vec3 normal;
out vec3 worldPosition;
out vec4 color;
flat out float material;
void main() {
  normal=normalLight.xyz; worldPosition=positionMaterial.xyz;
  color=tint; material=positionMaterial.w;
  vec4 clip=matrix*vec4(worldPosition,1);
  gl_Position=vec4(clip.xy,2.0*clip.z-clip.w,clip.w);
}`;

type Mesh = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; count: number; capacity: number };
type Uniforms = {
  matrix: WebGLUniformLocation | null;
  cameraXY: WebGLUniformLocation | null;
  drawDistance: WebGLUniformLocation | null;
  ghost: WebGLUniformLocation | null;
};

/** WebGL consumes the existing box/surface protocol and camera matrices. */
export class WebGLScene {
  readonly canvas = document.createElement("canvas");
  private gl: WebGL2RenderingContext;
  private boxProgram: WebGLProgram;
  private surfaceProgram: WebGLProgram;
  private buffers: WebGLBuffer[] = [];
  private arrays: WebGLVertexArrayObject[] = [];
  private programs: WebGLProgram[] = [];
  private cube: WebGLBuffer;
  private city: Mesh;
  private actors: Mesh;
  private transparentActors: Mesh;
  private focus: Mesh;
  private navigation: Mesh;
  private surfaces: Mesh;
  private vehicleSurfaces: Mesh;
  private key: string | null = null;
  private horizon: WebGLHorizon | null = null;
  // `getUniformLocation` is a validated string lookup; it was being called
  // eight or more times per frame.
  private uniforms = new Map<WebGLProgram, Uniforms>();
  private instanceScratch = new Float32Array(MAX_STREAM_BOXES * INSTANCE_FLOATS);
  private visible: Box[] = [];
  private opaque: Box[] = [];
  private translucent: Box[] = [];

  constructor() {
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    try {
      this.horizon = new WebGLHorizon(gl);
      this.boxProgram = this.program(BOX_VERTEX); this.surfaceProgram = this.program(SURFACE_VERTEX);
      for (const program of [this.boxProgram, this.surfaceProgram]) {
        this.uniforms.set(program, {
          matrix: gl.getUniformLocation(program, "matrix"),
          cameraXY: gl.getUniformLocation(program, "cameraXY"),
          drawDistance: gl.getUniformLocation(program, "drawDistance"),
          ghost: gl.getUniformLocation(program, "ghost"),
        });
      }
      this.cube = this.buffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.cube);
      gl.bufferData(gl.ARRAY_BUFFER, cubeVertices(), gl.STATIC_DRAW);
      this.city = this.boxMesh(); this.actors = this.boxMesh();
      this.transparentActors = this.boxMesh();
      this.focus = this.boxMesh(); this.navigation = this.boxMesh();
      this.surfaces = this.mesh(); this.vehicleSurfaces = this.mesh();
      for (const mesh of [this.surfaces, this.vehicleSurfaces]) {
        gl.bindVertexArray(mesh.vao); gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
        for (let i = 0; i < 3; i++) {
          gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, SURFACE_VERTEX_BYTES, i * 16);
        }
      }
    } catch (error) { this.destroy(); throw error; }
  }
  private buffer() {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error("Could not allocate WebGL buffer");
    this.buffers.push(buffer); return buffer;
  }
  private program(vertexSource: string) {
    const gl = this.gl, shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) throw new Error("Could not allocate WebGL program");
    this.programs.push(program);
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Could not allocate WebGL shader");
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "WebGL shader failed");
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "WebGL link failed");
      return program;
    } finally { for (const shader of shaders) gl.deleteShader(shader); }
  }
  private mesh(): Mesh {
    const vao = this.gl.createVertexArray();
    if (!vao) throw new Error("Could not allocate WebGL vertex array");
    this.arrays.push(vao); return { vao, buffer: this.buffer(), count: 0, capacity: 0 };
  }
  private boxMesh() {
    const gl = this.gl, mesh = this.mesh(); gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cube);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    Object.values(INSTANCE_FIELD_OFFSET_BYTES).forEach((offset, i) => {
      gl.enableVertexAttribArray(i + 1); gl.vertexAttribPointer(i + 1, 4, gl.FLOAT, false, INSTANCE_BYTES, offset);
      gl.vertexAttribDivisor(i + 1, 1);
    });
    return mesh;
  }
  /** Reuse one scratch array and one buffer store per stream; `bufferData`
   * with a fresh typed array reallocated hundreds of kilobytes every frame. */
  private upload(mesh: Mesh, boxes: Box[]) {
    const gl = this.gl;
    const floats = packBoxesInto(boxes, this.instanceScratch);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    if (mesh.capacity < boxes.length) {
      mesh.capacity = Math.max(64, boxes.length * 2);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.capacity * INSTANCE_BYTES, gl.DYNAMIC_DRAW);
    }
    if (floats) gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceScratch, 0, floats);
    mesh.count = boxes.length;
  }
  render(matrix: Float32Array, width: number, height: number, camera: Camera, distance: number, world: WorldView, scene: CompatibilityScene, sky: HorizonFrame, skyBasis: Float32Array) {
    const gl = this.gl;
    if (gl.isContextLost()) return false;
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    if (this.key !== world.key) {
      const vertices = packSurfaceQuads([...(world.landscapeSurfaces ?? []), ...(world.surfaces ?? [])]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.surfaces.buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      this.surfaces.count = vertices.byteLength / SURFACE_VERTEX_BYTES; this.key = world.key;
    }
    // Software WebGL drivers otherwise transform the entire radius-three city.
    // Keep the full world streamed, but submit only boxes intersecting the view.
    this.visible.length = 0;
    for (const box of world.boxes) {
      if (sphereInView(matrix, box.x, box.y, box.z, Math.hypot(box.sx, box.sy, box.sz) / 2)) this.visible.push(box);
    }
    this.upload(this.city, this.visible);
    this.opaque.length = 0;
    this.translucent.length = 0;
    for (const box of scene.actors) {
      if ((box.color[3] ?? 1) < 0.99) this.translucent.push(box);
      else this.opaque.push(box);
    }
    this.upload(this.actors, this.opaque);
    this.upload(this.transparentActors, this.translucent);
    this.upload(this.focus, scene.focus); this.upload(this.navigation, scene.navigation);
    const vehicleVertices = packSurfaceQuads(scene.focusSurfaces);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vehicleSurfaces.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vehicleVertices, gl.DYNAMIC_DRAW);
    this.vehicleSurfaces.count = vehicleVertices.byteLength / SURFACE_VERTEX_BYTES;
    gl.viewport(0, 0, width, height); gl.clearColor(0.35, 0.7, 0.88, 1); gl.clearDepth(1);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    // WebGL window space is the vertical mirror of WebGPU's framebuffer space,
    // so the same outward faces read counter-clockwise here.
    gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.horizon!.render(sky, skyBasis);
    const bindProgram = (program: WebGLProgram) => {
      const uniforms = this.uniforms.get(program)!;
      gl.useProgram(program); gl.uniformMatrix4fv(uniforms.matrix, false, matrix);
      gl.uniform2f(uniforms.cameraXY, camera.x, camera.y);
      gl.uniform1f(uniforms.drawDistance, distance); gl.uniform1i(uniforms.ghost, 0);
    };
    const setGhost = (program: WebGLProgram, ghost: number) =>
      gl.uniform1i(this.uniforms.get(program)!.ghost, ghost);
    // Cuboids are closed volumes: drawing their inward halves doubled the
    // fallback's fragment work for no visible difference.
    const boxes = (mesh: Mesh) => {
      gl.enable(gl.CULL_FACE); gl.bindVertexArray(mesh.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, mesh.count);
      gl.disable(gl.CULL_FACE);
    };
    bindProgram(this.surfaceProgram); gl.bindVertexArray(this.surfaces.vao); gl.drawArrays(gl.TRIANGLES, 0, this.surfaces.count);
    bindProgram(this.boxProgram); boxes(this.city); boxes(this.actors);
    gl.depthMask(false); gl.depthFunc(gl.GREATER); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    setGhost(this.boxProgram, 1); boxes(this.focus); boxes(this.navigation);
    bindProgram(this.surfaceProgram); setGhost(this.surfaceProgram, 1);
    gl.bindVertexArray(this.vehicleSurfaces.vao); gl.drawArrays(gl.TRIANGLES, 0, this.vehicleSurfaces.count);
    bindProgram(this.boxProgram);
    gl.depthMask(true); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
    setGhost(this.boxProgram, 0); boxes(this.focus); boxes(this.navigation);
    bindProgram(this.surfaceProgram); gl.bindVertexArray(this.vehicleSurfaces.vao); gl.drawArrays(gl.TRIANGLES, 0, this.vehicleSurfaces.count);
    bindProgram(this.boxProgram);
    if (this.transparentActors.count > 0) {
      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      boxes(this.transparentActors);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null); return !gl.isContextLost();
  }
  destroy() {
    this.horizon?.destroy(); this.horizon = null;
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    for (const array of this.arrays) this.gl.deleteVertexArray(array);
    for (const program of this.programs) this.gl.deleteProgram(program);
    this.buffers = []; this.arrays = []; this.programs = [];
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
