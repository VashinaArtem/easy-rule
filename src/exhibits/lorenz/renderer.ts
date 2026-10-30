import { createProgram, flattenColors, getGL2, hexToRgb, type Program } from '../../gl/gl';
import type { Mat4 } from '../../gl/mat4';

const TRAIL_VS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 a_pos;
uniform mat4 u_mvp;
uniform int u_head;
uniform int u_T;
uniform int u_N;
uniform vec3 u_colors[4];
out vec4 v_color;
uniform float u_alpha;
uniform bool u_two;

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  int i = min(int(floor(t)), 2);
  return mix(u_colors[i], u_colors[i + 1], t - float(i));
}

void main() {
  int slot = gl_VertexID / u_N;
  int p = gl_VertexID - slot * u_N;
  float age = float((u_head - slot + u_T) % u_T) / float(max(u_T - 1, 1));
  float t = u_N > 1 ? float(p) / float(u_N - 1) : 0.0;
  vec3 col = u_two ? (t < 0.5 ? u_colors[0] : u_colors[3]) : ramp(t);
  v_color = vec4(col, u_alpha * pow(1.0 - age, 1.6));
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}`;

const TRAIL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() { outColor = vec4(v_color.rgb * v_color.a, v_color.a); }`;

const POINT_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec3 a_pos;
uniform mat4 u_mvp;
uniform float u_size;
void main() {
  gl_Position = u_mvp * vec4(a_pos, 1.0);
  gl_PointSize = u_size;
}`;

const POINT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 u_color;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float ring = smoothstep(0.5, 0.42, r) * smoothstep(0.22, 0.3, r);
  outColor = vec4(u_color * ring, ring);
}`;

/**
 * Trails stored in a ring buffer of T time slots × N particles. Segments join
 * slot t to slot t+1 for every particle; the segment that would join the newest
 * slot to the oldest is skipped when drawing.
 */
export class LorenzRenderer {
  readonly gl: WebGL2RenderingContext;
  private trail: Program;
  private point: Program;
  private vao: WebGLVertexArrayObject;
  private pos: WebGLBuffer;
  private idx: WebGLBuffer;
  private pointVao: WebGLVertexArrayObject;
  private pointBuf: WebGLBuffer;
  private scratch = new Float32Array(0);
  N = 0;
  T = 0;
  head = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = getGL2(canvas, { antialias: true });
    const gl = this.gl;
    this.trail = createProgram(gl, TRAIL_VS, TRAIL_FS);
    this.point = createProgram(gl, POINT_VS, POINT_FS);
    this.vao = gl.createVertexArray()!;
    this.pos = gl.createBuffer()!;
    this.idx = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idx);
    gl.bindVertexArray(null);
    this.pointVao = gl.createVertexArray()!;
    this.pointBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** Allocates buffers and fills every slot with the initial state. */
  reset(state: Float64Array, N: number, T: number) {
    const gl = this.gl;
    this.N = N;
    this.T = T;
    this.head = 0;
    const all = new Float32Array(N * T * 3);
    for (let t = 0; t < T; t++) for (let i = 0; i < N * 3; i++) all[t * N * 3 + i] = state[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos);
    gl.bufferData(gl.ARRAY_BUFFER, all, gl.DYNAMIC_DRAW);
    const indices = new Uint32Array(T * N * 2);
    let k = 0;
    for (let t = 0; t < T; t++) {
      const next = (t + 1) % T;
      for (let p = 0; p < N; p++) {
        indices[k++] = t * N + p;
        indices[k++] = next * N + p;
      }
    }
    gl.bindVertexArray(this.vao);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.scratch = new Float32Array(N * 3);
  }

  /** Records the current state into the next ring slot. */
  push(state: Float64Array) {
    const gl = this.gl;
    this.head = (this.head + 1) % this.T;
    for (let i = 0; i < this.N * 3; i++) this.scratch[i] = state[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pos);
    gl.bufferSubData(gl.ARRAY_BUFFER, this.head * this.N * 3 * 4, this.scratch);
  }

  draw(mvp: Mat4, colors: string[], two: boolean, alpha: number, equilibria: number[][], background: string) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const [r, g, b] = hexToRgb(background);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const { u } = this.trail;
    gl.useProgram(this.trail.program);
    gl.uniformMatrix4fv(u.u_mvp, false, mvp);
    gl.uniform1i(u.u_head, this.head);
    gl.uniform1i(u.u_T, this.T);
    gl.uniform1i(u.u_N, this.N);
    gl.uniform3fv(u.u_colors, flattenColors(colors, 4));
    gl.uniform1f(u.u_alpha, alpha);
    gl.uniform1i(u.u_two, two ? 1 : 0);
    gl.bindVertexArray(this.vao);
    const row = this.N * 2;
    // Rows head+1 … T−1, then 0 … head−1 (row `head` joins newest to oldest).
    const tail = this.T - this.head - 1;
    if (tail > 0) gl.drawElements(gl.LINES, tail * row, gl.UNSIGNED_INT, (this.head + 1) * row * 4);
    if (this.head > 0) gl.drawElements(gl.LINES, this.head * row, gl.UNSIGNED_INT, 0);

    if (equilibria.length) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.point.program);
      gl.uniformMatrix4fv(this.point.u.u_mvp, false, mvp);
      gl.uniform1f(this.point.u.u_size, 14 * Math.min(2, window.devicePixelRatio || 1));
      gl.uniform3f(this.point.u.u_color, 0.92, 0.93, 0.96);
      gl.bindVertexArray(this.pointVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(equilibria.flat()), gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, equilibria.length);
    }
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.pos);
    gl.deleteBuffer(this.idx);
    gl.deleteBuffer(this.pointBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteVertexArray(this.pointVao);
    gl.deleteProgram(this.trail.program);
    gl.deleteProgram(this.point.program);
  }
}
