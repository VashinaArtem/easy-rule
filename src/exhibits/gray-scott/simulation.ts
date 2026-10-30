import { createFullscreenTriangle, createProgram, FULLSCREEN_VS, getGL2, type Program } from '../../gl/gl';
import { INIT_FS, SHOW_FS, STEP_FS } from './shaders';

export interface StepParams {
  F: number;
  k: number;
  atlas: boolean;
  dt: number;
  stroke?: { x0: number; y0: number; x1: number; y1: number; radius: number };
}

/** Two RGBA32F textures swapped each step: (u, v) live in the red and green channels. */
export class GrayScottSim {
  readonly gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private cur = 0;
  private stepProg: Program;
  private initProg: Program;
  private showProg: Program;
  private vao: WebGLVertexArrayObject;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.gl = getGL2(canvas);
    const gl = this.gl;
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('Нужны текстуры с плавающей точкой (расширение EXT_color_buffer_float), а этот браузер или видеокарта их не поддерживает.');
    }
    this.width = width;
    this.height = height;
    this.vao = createFullscreenTriangle(gl);
    this.stepProg = createProgram(gl, FULLSCREEN_VS, STEP_FS);
    this.initProg = createProgram(gl, FULLSCREEN_VS, INIT_FS);
    this.showProg = createProgram(gl, FULLSCREEN_VS, SHOW_FS);
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Видеокарта не умеет рисовать в текстуры с плавающей точкой.');
      }
      this.tex.push(tex);
      this.fbo.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.reset();
  }

  reset() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.cur]);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.initProg.program);
    gl.uniform2i(this.initProg.u.u_size, this.width, this.height);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Clears to the uniform state u = 1, v = 0. */
  clear() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.cur]);
    gl.clearBufferfv(gl.COLOR, 0, [1, 0, 0, 1]);
  }

  step(p: StepParams) {
    const gl = this.gl;
    const next = 1 - this.cur;
    const { u } = this.stepProg;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[next]);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.stepProg.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.uniform1i(u.u_state, 0);
    gl.uniform2i(u.u_size, this.width, this.height);
    gl.uniform1f(u.u_F, p.F);
    gl.uniform1f(u.u_k, p.k);
    gl.uniform1f(u.u_dt, p.dt);
    gl.uniform1i(u.u_atlas, p.atlas ? 1 : 0);
    const s = p.stroke;
    gl.uniform4f(u.u_stroke, s?.x0 ?? 0, s?.y0 ?? 0, s?.x1 ?? 0, s?.y1 ?? 0);
    gl.uniform1f(u.u_radius, s ? s.radius : -1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.cur = next;
  }

  show() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.showProg.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.uniform1i(this.showProg.u.u_state, 0);
    gl.uniform2i(this.showProg.u.u_size, this.width, this.height);
    gl.uniform2f(this.showProg.u.u_canvas, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const gl = this.gl;
    this.tex.forEach((t) => gl.deleteTexture(t));
    this.fbo.forEach((f) => gl.deleteFramebuffer(f));
    gl.deleteProgram(this.stepProg.program);
    gl.deleteProgram(this.initProg.program);
    gl.deleteProgram(this.showProg.program);
    gl.deleteVertexArray(this.vao);
  }
}
