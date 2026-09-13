import { HORIZON_HEIGHT, HORIZON_WIDTH } from "@/game/render/horizon";
import type { HorizonPanorama } from "./horizon-panorama";

export type HorizonFrame = ReturnType<HorizonPanorama["update"]>;

export class WebGLHorizon {
  private program: WebGLProgram;
  private textures: WebGLTexture[] = [];
  private vao: WebGLVertexArrayObject;
  private revision = -1;
  constructor(private gl: WebGL2RenderingContext) {
    const program = gl.createProgram(), vao = gl.createVertexArray();
    if (!program || !vao) throw new Error("Could not allocate horizon renderer");
    this.program = program; this.vao = vao;
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, `#version 300 es
out vec2 clip;
void main() { vec2 positions[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3)); clip=positions[gl_VertexID]; gl_Position=vec4(clip,.999,1); }`],
      [gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
in vec2 clip; out vec4 pixel;
uniform vec3 skyRight; uniform vec3 skyUp; uniform vec3 skyForward;
uniform vec2 options; uniform sampler2D previous; uniform sampler2D current;
void main() {
  if(options.x<.5) { pixel=vec4(mix(vec3(.74,.83,.85),vec3(.3,.65,.83),clamp(clip.y*.5+.5,0.,1.)),1); return; }
  vec3 ray=skyForward+skyRight*clip.x+skyUp*clip.y;
  vec2 uv=vec2(atan(ray.y,ray.x)/6.283185307+.5,.5-atan(ray.z,length(ray.xy))/3.141592654);
  pixel=mix(texture(previous,uv),texture(current,uv),options.y);
}`]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Could not allocate horizon shader");
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Horizon shader failed");
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Horizon shader link failed");
      for (let i = 0; i < 2; i++) {
        const texture = gl.createTexture();
        if (!texture) throw new Error("Could not allocate horizon texture");
        this.textures.push(texture); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    } catch (error) { this.destroy(); throw error; }
    finally { for (const shader of shaders) gl.deleteShader(shader); }
  }
  render(frame: HorizonFrame, basis: Float32Array) {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.useProgram(this.program); gl.bindVertexArray(this.vao);
    for (let i = 0; i < this.textures.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      if (this.revision !== frame.revision) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, HORIZON_WIDTH, HORIZON_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, i ? frame.current : frame.previous);
      }
      gl.uniform1i(gl.getUniformLocation(this.program, i ? "current" : "previous"), i);
    }
    this.revision = frame.revision;
    for (const [index, name] of ["skyRight", "skyUp", "skyForward"].entries()) gl.uniform3fv(gl.getUniformLocation(this.program, name), basis.subarray(index * 4, index * 4 + 3));
    gl.uniform2fv(gl.getUniformLocation(this.program, "options"), basis.subarray(12, 14));
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
  destroy() {
    this.gl.deleteProgram(this.program); this.gl.deleteVertexArray(this.vao);
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    this.textures = [];
  }
}
