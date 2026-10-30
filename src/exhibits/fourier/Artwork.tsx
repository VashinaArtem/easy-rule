import { useEffect, useMemo, useRef, useState } from 'react';
import { fitCanvas } from '../../gl/gl';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { enumCodec, intCodec, useUrlState } from '../../hooks/useUrlState';
import { ActionButton, Choice, Group, Panel, Slider, Toggle } from '../../ui/controls';
import { formatNumber } from '../escape-time/format';
import type { ArtworkProps } from '../types';
import { contours, dft, evalSeries, meanSquareError, normalise, resample, SAMPLES, strongest, type Pt } from './math';

const ids = [...contours.map((c) => c.id), 'custom'] as const;
const contourCodec = enumCodec(ids);
const countCodec = intCodec(1, 256);
const PERIOD = 16; // seconds for one full turn at speed 1

function buildCurve(id: string): Pt[] {
  const c = contours.find((x) => x.id === id) ?? contours[0];
  return normalise(resample(c.points(), SAMPLES));
}

/** Figure placement: on wide screens it sits between the wall label and the panel. */
function layout(W: number, H: number) {
  const wide = W > 1000;
  return { S: Math.min(W, H) * (wide ? 0.33 : 0.36), cx: W * (wide ? 0.53 : 0.5), cy: H / 2 };
}

interface Trail {
  t: number;
  x: number;
  y: number;
}

export default function FourierArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contourId, setContourId] = useUrlState('shape', 'heart', contourCodec);
  const [count, setCount] = useUrlState('n', 30, countCodec);
  const [drawing, setDrawing] = useState(false);
  const [paused, setPaused] = useState(reducedMotion);
  const [showCircles, setShowCircles] = useState(true);
  const [showTarget, setShowTarget] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [custom, setCustom] = useState<Pt[] | null>(null);

  const curve = useMemo(() => (contourId === 'custom' && custom ? custom : buildCurve(contourId === 'custom' ? 'heart' : contourId)), [contourId, custom]);
  const coefs = useMemo(() => dft(curve), [curve]);
  const maxCount = coefs.length - 1;
  const n = Math.min(count, maxCount);
  const series = useMemo(() => strongest(coefs, n), [coefs, n]);
  const rmsPercent = useMemo(() => (Math.sqrt(meanSquareError(curve, coefs, n)) / 2) * 100, [curve, coefs, n]);

  const live = useRef({ series, curve, paused, showCircles, showTarget, speed, drawing, reducedMotion });
  const t = useRef({ t: 0, unwrapped: 0 });
  const trail = useRef<Trail[]>([]);
  const dirty = useRef(true);
  const stroke = useRef<Pt[] | null>(null);
  const approx = useRef<Pt[]>([]);

  useEffect(() => {
    live.current = { series, curve, paused, showCircles, showTarget, speed, drawing, reducedMotion };
    dirty.current = true;
  }, [series, curve, paused, showCircles, showTarget, speed, drawing, reducedMotion]);

  // A new curve or circle count invalidates the trail and the faint full path.
  useEffect(() => {
    trail.current = [];
    approx.current = Array.from({ length: 720 }, (_, i) => evalSeries(series.centre, series.circles, i / 720));
    dirty.current = true;
  }, [series]);

  useFrameLoop(canvasRef, (dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resized = fitCanvas(canvas, 2);
    const lv = live.current;
    if (!lv.paused && !lv.drawing) {
      const step = (dt * lv.speed) / PERIOD;
      t.current.t = (t.current.t + step) % 1;
      t.current.unwrapped += step;
      dirty.current = true;
    }
    if (!dirty.current && !resized) return;
    dirty.current = false;
    draw(canvas, lv, t.current, trail.current, approx.current, stroke.current);
  });

  // Drawing mode: one free-hand closed curve per stroke.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const toMath = (e: PointerEvent): Pt => {
      const r = el.getBoundingClientRect();
      const { S, cx, cy } = layout(r.width, r.height);
      return [(e.clientX - r.left - cx) / S, -(e.clientY - r.top - cy) / S];
    };
    const down = (e: PointerEvent) => {
      if (!live.current.drawing) return;
      el.setPointerCapture(e.pointerId);
      stroke.current = [toMath(e)];
      dirty.current = true;
    };
    const move = (e: PointerEvent) => {
      const s = stroke.current;
      if (!s) return;
      const p = toMath(e);
      const last = s[s.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.004) {
        s.push(p);
        dirty.current = true;
      }
    };
    const up = () => {
      const s = stroke.current;
      stroke.current = null;
      dirty.current = true;
      if (!s || s.length < 8) return;
      const r = resample(s, SAMPLES);
      if (r.length === 0) return;
      setCustom(normalise(r));
      setContourId('custom');
      setDrawing(false);
      t.current = { t: 0, unwrapped: 0 };
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [setContourId]);

  // Keep the trail in sync with the animation clock.
  useEffect(() => {
    const id = window.setInterval(() => {
      const lv = live.current;
      if (lv.paused || lv.drawing) return;
      const [x, y] = evalSeries(lv.series.centre, lv.series.circles, t.current.t);
      const tr = trail.current;
      tr.push({ t: t.current.unwrapped, x, y });
      while (tr.length && t.current.unwrapped - tr[0].t > 1) tr.shift();
    }, 1000 / 90);
    return () => window.clearInterval(id);
  }, []);

  const shapeValue = contourId === 'custom' ? null : contourId;

  return (
    <div className="art">
      <canvas
        ref={canvasRef}
        className="art-canvas"
        data-mode={drawing ? 'draw' : 'view'}
        role="img"
        aria-label={`Эпициклы Фурье: ${n} вращающихся кругов рисуют контур. ${drawing ? 'Режим рисования: проведите линию мышью или пальцем.' : ''}`}
      />
      {drawing ? <p className="art__hint">Нарисуйте замкнутую линию одним движением</p> : null}
      <Panel
        status={
          <>
            <div>
              Кругов: <strong>{n}</strong> из {maxCount}
            </div>
            <div>
              Отклонение от исходной линии: <strong>{rmsPercent < 0.01 ? '<0,01' : formatNumber(rmsPercent, rmsPercent < 1 ? 2 : 1)}</strong>% размера фигуры
            </div>
          </>
        }
      >
        <Group title="Фигура">
          <Choice label="Фигура" value={shapeValue} onChange={(id) => setContourId(id)} options={contours.map((c) => ({ value: c.id, label: c.name }))} />
          <div className="actions">
            <ActionButton onClick={() => setDrawing((d) => !d)} pressed={drawing}>
              {drawing ? 'Отмена' : 'Нарисовать свою'}
            </ActionButton>
          </div>
        </Group>
        <Group title="Круги">
          <Slider
            label="Сколько кругов"
            value={n}
            min={1}
            max={Math.min(256, maxCount)}
            step={1}
            onChange={setCount}
            hint="Берутся самые большие круги. Углы сходятся медленно: рядом с ними линия «звенит»."
          />
          <Slider label="Скорость" value={speed} min={0.25} max={4} step={0.05} onChange={setSpeed} format={(v) => `×${formatNumber(v, 2)}`} />
          <div className="actions">
            <ActionButton onClick={() => setPaused((p) => !p)} pressed={paused}>
              {paused ? 'Продолжить' : 'Пауза'}
            </ActionButton>
          </div>
          <Toggle label="Показывать круги" checked={showCircles} onChange={setShowCircles} />
          <Toggle label="Показывать исходную линию" checked={showTarget} onChange={setShowTarget} />
        </Group>
      </Panel>
    </div>
  );
}

interface Live {
  series: ReturnType<typeof strongest>;
  curve: Pt[];
  showCircles: boolean;
  showTarget: boolean;
  reducedMotion: boolean;
  paused: boolean;
}

function draw(canvas: HTMLCanvasElement, lv: Live, time: { t: number; unwrapped: number }, trail: Trail[], approx: Pt[], stroke: Pt[] | null) {
  const ctx = canvas.getContext('2d')!;
  const dpr = canvas.width / canvas.clientWidth;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1024';
  ctx.fillRect(0, 0, W, H);
  const { S, cx, cy } = layout(W, H);
  const X = (x: number) => cx + x * S;
  const Y = (y: number) => cy - y * S;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (lv.showTarget) {
    ctx.beginPath();
    lv.curve.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = 'rgba(158, 167, 189, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Full path of the current approximation.
  ctx.beginPath();
  approx.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
  ctx.closePath();
  ctx.strokeStyle = lv.paused && lv.reducedMotion ? 'rgba(244, 230, 189, 0.95)' : 'rgba(140, 155, 255, 0.28)';
  ctx.lineWidth = lv.paused && lv.reducedMotion ? 2 : 1.25;
  ctx.stroke();

  // Epicycles: chain of circles from the centre outward.
  let px = lv.series.centre[0];
  let py = lv.series.centre[1];
  for (const c of lv.series.circles) {
    const a = 2 * Math.PI * c.n * time.t;
    const nx = px + c.re * Math.cos(a) - c.im * Math.sin(a);
    const ny = py + c.re * Math.sin(a) + c.im * Math.cos(a);
    const r = c.amp * S;
    if (lv.showCircles && r > 0.6) {
      if (r > 1.5) {
        ctx.beginPath();
        ctx.arc(X(px), Y(py), r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(233, 236, 243, 0.17)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(X(px), Y(py));
      ctx.lineTo(X(nx), Y(ny));
      ctx.strokeStyle = 'rgba(233, 236, 243, 0.4)';
      ctx.stroke();
    }
    px = nx;
    py = ny;
  }

  // Trail: the last full turn of the tip, fading with age.
  const chunks = 36;
  const per = Math.ceil(trail.length / chunks);
  for (let c = 0; c < chunks; c++) {
    const from = Math.max(0, c * per - 1);
    const to = Math.min(trail.length, (c + 1) * per);
    if (to - from < 2) continue;
    ctx.beginPath();
    for (let i = from; i < to; i++) (i === from ? ctx.moveTo : ctx.lineTo).call(ctx, X(trail[i].x), Y(trail[i].y));
    ctx.strokeStyle = `rgba(244, 230, 189, ${(0.1 + 0.9 * ((c + 1) / chunks) ** 1.5).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Tip.
  ctx.beginPath();
  ctx.arc(X(px), Y(py), 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#f4e6bd';
  ctx.fill();

  if (stroke && stroke.length > 1) {
    ctx.beginPath();
    stroke.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.strokeStyle = '#8c9bff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
