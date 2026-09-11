import type { Box, Camera, WorldView } from "@/game/model";
import { cubeVertices, INSTANCE_BYTES, INSTANCE_FIELD_OFFSET_BYTES, packBoxes } from "@/game/render/packing";
import { packSurfaceQuads, SURFACE_VERTEX_BYTES } from "@/game/render/surfaces";
import { sphereInView } from "@/game/render/clip";
import { MAT_WINDOW, MAT_LAMP, MAT_MARKER, MAT_ROUTE, MAT_TURN } from "@/game/config";
import type { CompatibilityScene } from "./compatibility-scene";

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
  worldPosition=positionMaterial.xyz+rotate(vertex.xyz*scaleYaw.xyz);
  color=tint; material=positionMaterial.w;
  vec4 clip=matrix*vec4(worldPosition,1);
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

type Mesh = { vao: WebGLVertexArrayObject; buffer: WebGLBuffer; count: number };

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
  private key: string | null = null;

  constructor() {
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    try {
      this.boxProgram = this.program(BOX_VERTEX); this.surfaceProgram = this.program(SURFACE_VERTEX);
      this.cube = this.buffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.cube);
      gl.bufferData(gl.ARRAY_BUFFER, cubeVertices(), gl.STATIC_DRAW);
      this.city = this.boxMesh(); this.actors = this.boxMesh();
      this.transparentActors = this.boxMesh();
      this.focus = this.boxMesh(); this.navigation = this.boxMesh();
      this.surfaces = this.mesh(); gl.bindVertexArray(this.surfaces.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.surfaces.buffer);
      for (let i = 0; i < 3; i++) {
        gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, SURFACE_VERTEX_BYTES, i * 16);
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
    this.arrays.push(vao); return { vao, buffer: this.buffer(), count: 0 };
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
  private upload(mesh: Mesh, boxes: Box[], dynamic = true) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, packBoxes(boxes), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    mesh.count = boxes.length;
  }
  render(matrix: Float32Array, width: number, height: number, camera: Camera, distance: number, world: WorldView, scene: CompatibilityScene) {
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
    this.upload(this.city, world.boxes.filter(box =>
      sphereInView(matrix, box.x, box.y, box.z, Math.hypot(box.sx, box.sy, box.sz) / 2)));
    const opaqueActors = scene.actors.filter(box => (box.color[3] ?? 1) >= 0.99);
    const transparentActors = scene.actors.filter(box => (box.color[3] ?? 1) < 0.99);
    this.upload(this.actors, opaqueActors);
    this.upload(this.transparentActors, transparentActors);
    this.upload(this.focus, scene.focus); this.upload(this.navigation, scene.navigation);
    gl.viewport(0, 0, width, height); gl.clearColor(0.35, 0.7, 0.88, 1); gl.clearDepth(1);
    gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const bindProgram = (program: WebGLProgram) => {
      gl.useProgram(program); gl.uniformMatrix4fv(gl.getUniformLocation(program, "matrix"), false, matrix);
      gl.uniform2f(gl.getUniformLocation(program, "cameraXY"), camera.x, camera.y);
      gl.uniform1f(gl.getUniformLocation(program, "drawDistance"), distance); gl.uniform1i(gl.getUniformLocation(program, "ghost"), 0);
    };
    const boxes = (mesh: Mesh) => { gl.bindVertexArray(mesh.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, mesh.count); };
    bindProgram(this.surfaceProgram); gl.bindVertexArray(this.surfaces.vao); gl.drawArrays(gl.TRIANGLES, 0, this.surfaces.count);
    bindProgram(this.boxProgram); boxes(this.city); boxes(this.actors);
    gl.depthMask(false); gl.depthFunc(gl.GREATER); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(gl.getUniformLocation(this.boxProgram, "ghost"), 1); boxes(this.focus); boxes(this.navigation);
    gl.depthMask(true); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
    gl.uniform1i(gl.getUniformLocation(this.boxProgram, "ghost"), 0); boxes(this.focus); boxes(this.navigation);
    if (this.transparentActors.count > 0) {
      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      boxes(this.transparentActors);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null); return !gl.isContextLost();
  }
  destroy() {
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer);
    for (const array of this.arrays) this.gl.deleteVertexArray(array);
    for (const program of this.programs) this.gl.deleteProgram(program);
    this.buffers = []; this.arrays = []; this.programs = [];
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
