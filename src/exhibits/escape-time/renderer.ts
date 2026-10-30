import { createFullscreenTriangle, createProgram, FULLSCREEN_VS, flattenColors, getGL2, hexToRgb, ScaledTarget, type Program } from '../../gl/gl';
import { dfAdd, dfMul, dfSplitDouble, type DF } from '../../gl/df64';
import type { PlaneView } from '../../gl/view';
import { escapeShader, DF64_SELFTEST_FS, MAX_STOPS, type EscapeKind } from './shaders';
import type { EscapePalette } from './palettes';

/** Below this half-height float32 pixels start to collide; switch to df64. */
export const FLOAT_LIMIT = 4e-4;
/** Below this even df64 runs out of precision (~2⁻⁴⁶ relative). */
export const DF64_LIMIT = 4e-11;

export interface EscapeFrame {
  view: PlaneView;
  c?: [number, number];
  maxIter: number;
  palette: EscapePalette;
  density: number;
  phase?: number;
  /** Interactive frames render at reduced resolution without supersampling. */
  interactive: boolean;
}

export class EscapeTimeRenderer {
  readonly gl: WebGL2RenderingContext;
  private floatProg: Program;
  private dfProg: Program | null = null;
  private vao: WebGLVertexArrayObject;
  private target: ScaledTarget;
  readonly df64Works: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    readonly kind: EscapeKind,
  ) {
    this.gl = getGL2(canvas);
    this.vao = createFullscreenTriangle(this.gl);
    this.target = new ScaledTarget(this.gl);
    this.floatProg = createProgram(this.gl, FULLSCREEN_VS, escapeShader(kind, false));
    this.df64Works = kind === 'mandelbrot' && this.testDf64();
    if (this.df64Works) this.dfProg = createProgram(this.gl, FULLSCREEN_VS, escapeShader(kind, true));
  }

  /** Smallest half-height this device can render faithfully. */
  get minScale(): number {
    return this.df64Works ? DF64_LIMIT : FLOAT_LIMIT;
  }

  usesDf64(scale: number): boolean {
    return this.df64Works && scale < FLOAT_LIMIT;
  }

  draw(frame: EscapeFrame) {
    const { gl } = this;
    const deep = this.usesDf64(frame.view.scale);
    const prog = deep ? this.dfProg! : this.floatProg;
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const dpr = W / Math.max(1, gl.canvas instanceof HTMLCanvasElement ? gl.canvas.clientWidth : W);
    const fraction = frame.interactive ? (deep ? 0.34 : 0.5) : 1;
    const w = Math.max(1, Math.round(W * fraction));
    const h = Math.max(1, Math.round(H * fraction));
    const ss = frame.interactive || deep ? 1 : dpr < 1.5 ? 2 : 1;

    if (fraction < 1) this.target.bind(w, h);
    else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
    }

    gl.useProgram(prog.program);
    const u = prog.u;
    const { view } = frame;
    gl.uniform2f(u.u_res, w, h);
    gl.uniform2f(u.u_center, view.cx, view.cy);
    const [xh, xl] = dfSplitDouble(view.cx);
    const [yh, yl] = dfSplitDouble(view.cy);
    gl.uniform4f(u.u_centerDF, xh, xl, yh, yl);
    gl.uniform1f(u.u_scale, view.scale);
    gl.uniform1f(u.u_one, 1);
    gl.uniform2f(u.u_c, frame.c?.[0] ?? 0, frame.c?.[1] ?? 0);
    gl.uniform1i(u.u_maxIter, frame.maxIter);
    gl.uniform1i(u.u_ss, ss);
    const stops = frame.palette.stops.slice(0, MAX_STOPS);
    gl.uniform3fv(u.u_stops, flattenColors(stops, MAX_STOPS));
    gl.uniform1i(u.u_nstops, stops.length);
    gl.uniform1f(u.u_density, frame.density);
    gl.uniform1f(u.u_phase, frame.phase ?? 0);
    gl.uniform3f(u.u_inside, ...hexToRgb(frame.palette.inside));
    gl.uniform3f(u.u_edge, ...hexToRgb(frame.palette.edge));
    gl.uniform1f(u.u_edgeAmt, frame.palette.edgeAmount);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (fraction < 1) this.target.blitToCanvas();
  }

  /** Runs df64 on the GPU and compares with the float32-emulated reference. */
  private testDf64(): boolean {
    const { gl } = this;
    try {
      const prog = createProgram(gl, FULLSCREEN_VS, DF64_SELFTEST_FS);
      const a: DF = dfSplitDouble(1 / 3);
      const b: DF = dfSplitDouble(-0.7432192837491);
      const mul = dfMul(a, b);
      const add = dfAdd(a, b);
      const t = new ScaledTarget(gl);
      t.bind(1, 1);
      gl.useProgram(prog.program);
      gl.uniform1f(prog.u.u_one, 1);
      gl.uniform2f(prog.u.u_a, a[0], a[1]);
      gl.uniform2f(prog.u.u_b, b[0], b[1]);
      gl.uniform2f(prog.u.u_mul, mul[0], mul[1]);
      gl.uniform2f(prog.u.u_add, add[0], add[1]);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      t.dispose();
      gl.deleteProgram(prog.program);
      return px[0] > 200;
    } catch {
      return false;
    }
  }

  dispose() {
    const { gl } = this;
    this.target.dispose();
    gl.deleteProgram(this.floatProg.program);
    if (this.dfProg) gl.deleteProgram(this.dfProg.program);
    gl.deleteVertexArray(this.vao);
  }
}
