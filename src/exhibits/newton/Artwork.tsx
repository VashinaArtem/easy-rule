import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createFullscreenTriangle, createProgram, FULLSCREEN_VS, fitCanvas, flattenColors, getGL2, ScaledTarget, type Program } from '../../gl/gl';
import { planeToScreen, screenToPlane, type PlaneView } from '../../gl/view';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { usePanZoom } from '../../hooks/usePanZoom';
import { numberCodec, useUrlState, type Codec } from '../../hooks/useUrlState';
import { ActionButton, ArtworkError, Group, Panel, Slider } from '../../ui/controls';
import type { ArtworkProps } from '../types';
import { formatComplex, formatNumber } from '../escape-time/format';
import { MAX_ROOTS, rootsOfUnity, type C } from './math';
import { NEWTON_FS } from './shader';

const HOME: PlaneView = { cx: 0, cy: -0.1, scale: 1.3 };
const ROOT_COLORS = ['#3d5afe', '#e8b04a', '#d9576b', '#3fb59a', '#a47ae0', '#dfe4ee'];
const ROOT_NAMES = ['кобальт', 'латунь', 'краплак', 'виридоль', 'фиолет', 'кость'];

const rootsCodec: Codec<C[]> = {
  parse: (raw) => {
    const roots = raw.split(';').map((p) => p.split(',').map(Number) as C);
    const ok = roots.length >= 2 && roots.length <= MAX_ROOTS && roots.every((r) => r.length === 2 && r.every((v) => Number.isFinite(v) && Math.abs(v) < 10));
    return ok ? roots : undefined;
  },
  format: (roots) => roots.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(';'),
};
const aCodec = numberCodec(0.2, 1.95, 3);
const DEFAULT_ROOTS = rootsOfUnity(3, 1, Math.PI / 2);

export default function NewtonArtwork(_props: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handlesRef = useRef<HTMLDivElement>(null);
  const gl = useRef<{ gl: WebGL2RenderingContext; prog: Program; vao: WebGLVertexArrayObject; target: ScaledTarget } | null>(null);
  const view = useRef<PlaneView>({ ...HOME });
  const dirty = useRef(true);
  const interacting = useRef(false);
  const dragging = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roots, setRoots] = useUrlState<C[]>('roots', DEFAULT_ROOTS, rootsCodec);
  const [a, setA] = useUrlState('a', 1, aCodec);
  const rootsRef = useRef(roots);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    try {
      const ctx = getGL2(canvasRef.current!);
      gl.current = { gl: ctx, prog: createProgram(ctx, FULLSCREEN_VS, NEWTON_FS), vao: createFullscreenTriangle(ctx), target: new ScaledTarget(ctx) };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      const g = gl.current;
      if (g) {
        g.target.dispose();
        g.gl.deleteProgram(g.prog.program);
        g.gl.deleteVertexArray(g.vao);
      }
      gl.current = null;
    };
  }, []);

  useEffect(() => {
    rootsRef.current = roots;
    dirty.current = true;
  }, [roots, a]);

  usePanZoom(canvasRef, view, {
    minScale: 1e-4,
    maxScale: 20,
    onChange: (active) => {
      interacting.current = active;
      dirty.current = true;
    },
  });

  const placeHandles = () => {
    const box = handlesRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    rootsRef.current.forEach(([x, y], i) => {
      const el = box.children[i] as HTMLElement | undefined;
      if (!el) return;
      const [px, py] = planeToScreen(view.current, x, y, w, h);
      el.style.transform = `translate(${px}px, ${py}px)`;
    });
  };

  useFrameLoop(canvasRef, () => {
    const g = gl.current;
    const canvas = canvasRef.current;
    if (!g || !canvas) return;
    if (fitCanvas(canvas, 2)) dirty.current = true;
    if (!dirty.current) return;
    dirty.current = false;
    const ctx = g.gl;
    const W = ctx.drawingBufferWidth;
    const H = ctx.drawingBufferHeight;
    const low = interacting.current || dragging.current !== null;
    const w = low ? Math.round(W * 0.5) : W;
    const h = low ? Math.round(H * 0.5) : H;
    if (low) g.target.bind(w, h);
    else {
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
      ctx.viewport(0, 0, W, H);
    }
    const r = rootsRef.current;
    const u = g.prog.u;
    ctx.useProgram(g.prog.program);
    ctx.uniform2f(u.u_res, w, h);
    ctx.uniform2f(u.u_center, view.current.cx, view.current.cy);
    ctx.uniform1f(u.u_scale, view.current.scale);
    const flat = new Float32Array(MAX_ROOTS * 2);
    r.forEach(([x, y], i) => flat.set([x, y], i * 2));
    ctx.uniform2fv(u.u_roots, flat);
    ctx.uniform3fv(u.u_colors, flattenColors(ROOT_COLORS, MAX_ROOTS));
    ctx.uniform1i(u.u_n, r.length);
    ctx.uniform1f(u.u_a, a);
    ctx.uniform1i(u.u_maxIter, a < 0.6 ? 400 : 160);
    ctx.uniform1i(u.u_ss, low || window.devicePixelRatio >= 1.5 ? 1 : 2);
    ctx.bindVertexArray(g.vao);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
    if (low) g.target.blitToCanvas();
    placeHandles();
  });

  const updateRoot = (i: number, p: C) => {
    const next = rootsRef.current.slice();
    next[i] = p;
    rootsRef.current = next;
    dirty.current = true;
    setRoots(next);
  };

  const onHandleDown = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = i;
    setSelected(i);
  };
  const onHandleMove = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging.current !== i) return;
    const r = canvasRef.current!.getBoundingClientRect();
    updateRoot(i, screenToPlane(view.current, e.clientX - r.left, e.clientY - r.top, r.width, r.height));
  };
  const onHandleUp = () => {
    dragging.current = null;
    dirty.current = true;
  };
  const onHandleKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = view.current.scale * (e.shiftKey ? 0.1 : 0.02);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [x, y] = rootsRef.current[i];
      updateRoot(i, [x + moves[e.key][0], y + moves[e.key][1]]);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && rootsRef.current.length > 2) {
      e.preventDefault();
      removeRoot(i);
    }
  };

  const addRoot = () => {
    if (roots.length >= MAX_ROOTS) return;
    const angle = roots.length * 2.39996; // golden angle keeps new roots apart
    const next: C[] = [...roots, [0.75 * Math.cos(angle), 0.75 * Math.sin(angle)]];
    setRoots(next);
    setSelected(next.length - 1);
  };
  const removeRoot = (i = selected) => {
    if (roots.length <= 2) return;
    const next = roots.filter((_, k) => k !== i);
    setRoots(next);
    setSelected(Math.min(i, next.length - 1));
  };
  const symmetric = () => {
    setRoots(rootsOfUnity(roots.length, 1, Math.PI / 2));
    view.current = { ...HOME };
    dirty.current = true;
  };

  if (error) return <ArtworkError message={error} />;

  return (
    <div className="art">
      <canvas ref={canvasRef} className="art-canvas" tabIndex={0} aria-label="Бассейны Ньютона. Стрелки двигают изображение, плюс и минус меняют масштаб." />
      <div className="handles" ref={handlesRef}>
        {roots.map(([x, y], i) => (
          <button
            key={i}
            type="button"
            className="handle"
            data-selected={selected === i}
            style={{ '--c': ROOT_COLORS[i] } as CSSProperties}
            aria-label={`Корень ${i + 1} (${ROOT_NAMES[i]}): ${formatComplex(x, y, 2)}. Стрелки двигают, Delete удаляет.`}
            onPointerDown={onHandleDown(i)}
            onPointerMove={onHandleMove(i)}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onKeyDown={onHandleKey(i)}
            onFocus={() => setSelected(i)}
          />
        ))}
      </div>
      <Panel
        status={
          <>
            <div>
              p(z) = {roots.map((_, i) => `(z − r${'₁₂₃₄₅₆'[i]})`).join('')}
            </div>
            <div>
              Корней: <strong>{roots.length}</strong>, шаг a = <strong>{formatNumber(a, 2)}</strong>
            </div>
            <div>Тёмные точки не сошлись к корню за отведённое число шагов.</div>
          </>
        }
      >
        <Group title="Корни многочлена">
          <div className="actions">
            <ActionButton onClick={addRoot}>Добавить корень</ActionButton>
            <ActionButton onClick={() => removeRoot()}>Убрать выбранный</ActionButton>
            <ActionButton onClick={symmetric}>Расставить симметрично</ActionButton>
          </div>
        </Group>
        <Group title="Метод">
          <Slider
            label="Шаг a"
            value={a}
            min={0.2}
            max={1.95}
            step={0.01}
            onChange={setA}
            format={(v) => formatNumber(v, 2)}
            hint="a = 1 — классический метод Ньютона. Меньше — осторожные шаги и гладкие границы, больше — перелёты и новые узоры."
          />
          <div className="actions">
            <ActionButton onClick={() => setA(1)} pressed={a === 1}>
              a = 1
            </ActionButton>
          </div>
        </Group>
      </Panel>
    </div>
  );
}
