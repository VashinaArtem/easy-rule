import { useEffect, useRef, useState } from 'react';
import { fitCanvas } from '../../gl/gl';
import { lookAt, multiply, orbitEye, perspective } from '../../gl/mat4';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { enumCodec, numberCodec, useUrlState } from '../../hooks/useUrlState';
import { ActionButton, ArtworkError, Choice, Group, Panel, Slider, Toggle } from '../../ui/controls';
import { formatNumber } from '../escape-time/format';
import type { ArtworkProps } from '../types';
import { CLASSIC, fixedPoints, hopfRho, rk4, type LorenzParams } from './math';
import { LorenzRenderer } from './renderer';

const N = 700; // particles
const T = 220; // trail slots
const DT = 0.005;
const CENTER = [0, 0, 24];
const COLORS = ['#3d5afe', '#8c9bff', '#f4e6bd', '#f08a24'];
const BACKGROUND = '#0b1024';

const modeCodec = enumCodec(['cloud', 'butterfly'] as const);
const sigmaCodec = numberCodec(1, 30, 2);
const rhoCodec = numberCodec(0.5, 60, 2);
const betaCodec = numberCodec(0.5, 6, 3);

function seed(mode: 'cloud' | 'butterfly'): Float64Array {
  const s = new Float64Array(N * 3);
  const rand = mulberry32(7);
  const ball = (cx: number, cy: number, cz: number, radius: number, from: number, to: number) => {
    for (let i = from; i < to; i++) {
      let x: number, y: number, z: number;
      do {
        x = rand() * 2 - 1;
        y = rand() * 2 - 1;
        z = rand() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      s[i * 3] = cx + x * radius;
      s[i * 3 + 1] = cy + y * radius;
      s[i * 3 + 2] = cz + z * radius;
    }
  };
  if (mode === 'cloud') ball(1, 1, 22, 2.5, 0, N);
  else {
    // Two tiny clouds whose centres differ by 1e-5 in x.
    ball(1, 1, 22, 2e-6, 0, N / 2);
    ball(1 + 1e-5, 1, 22, 2e-6, N / 2, N);
  }
  return s;
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 0.00001 → "1,0·10⁻⁵"; larger gaps in plain decimals. */
function formatGap(g: number): string {
  if (g >= 0.01) return formatNumber(g, 2);
  const e = Math.floor(Math.log10(g));
  const m = (g / 10 ** e).toFixed(1).replace('.', ',');
  return `${m}·10⁻${String(-e).split('').map((d) => SUP[Number(d)]).join('')}`;
}

function centroidGap(state: Float64Array): number {
  const h = N / 2;
  let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0;
  for (let i = 0; i < h; i++) {
    ax += state[i * 3];
    ay += state[i * 3 + 1];
    az += state[i * 3 + 2];
    bx += state[(i + h) * 3];
    by += state[(i + h) * 3 + 1];
    bz += state[(i + h) * 3 + 2];
  }
  return Math.hypot(ax - bx, ay - by, az - bz) / h;
}

export default function LorenzArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<LorenzRenderer | null>(null);
  const state = useRef<Float64Array>(new Float64Array(N * 3));
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useUrlState('mode', 'cloud', modeCodec);
  const [sigma, setSigma] = useUrlState('sigma', CLASSIC.sigma, sigmaCodec);
  const [rho, setRho] = useUrlState('rho', CLASSIC.rho, rhoCodec);
  const [beta, setBeta] = useUrlState('beta', CLASSIC.beta, betaCodec);
  const [speed, setSpeed] = useState(2);
  const [paused, setPaused] = useState(reducedMotion);
  const [spin, setSpin] = useState(!reducedMotion);
  const [showFixed, setShowFixed] = useState(false);
  const [gap, setGap] = useState(0);
  const params = useRef<LorenzParams>({ sigma, rho, beta });
  const cam = useRef({ yaw: 0.9, pitch: 0.28, dist: 78 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const frames = useRef(0);
  const live = useRef({ paused, spin, speed, showFixed, mode });

  useEffect(() => {
    params.current = { sigma, rho, beta };
  }, [sigma, rho, beta]);
  useEffect(() => {
    live.current = { paused, spin, speed, showFixed, mode };
  }, [paused, spin, speed, showFixed, mode]);

  useEffect(() => {
    try {
      renderer.current = new LorenzRenderer(canvasRef.current!);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);

  // (Re)start: seed the particles and pre-run so the trails are already drawn.
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    const s = seed(mode);
    state.current = s;
    r.reset(s, N, T);
    const warm = reducedMotion ? T * 3 : 0;
    for (let i = 0; i < warm; i++) {
      rk4(s, N, DT, 3, params.current);
      r.push(s);
    }
    setGap(mode === 'butterfly' ? centroidGap(s) : 0);
  }, [mode, error, reducedMotion]);

  const restart = () => {
    const r = renderer.current;
    if (!r) return;
    const s = seed(mode);
    state.current = s;
    r.reset(s, N, T);
    setGap(mode === 'butterfly' ? centroidGap(s) : 0);
  };

  useFrameLoop(canvasRef, (dt) => {
    const r = renderer.current;
    const canvas = canvasRef.current;
    if (!r || !canvas || r.N === 0) return;
    fitCanvas(canvas, 1.75);
    const lv = live.current;
    if (!lv.paused) {
      rk4(state.current, N, DT, Math.round(lv.speed), params.current);
      r.push(state.current);
      frames.current++;
      if (lv.mode === 'butterfly' && frames.current % 6 === 0) setGap(centroidGap(state.current));
    }
    if (lv.spin && !drag.current) cam.current.yaw += dt * 0.07;

    const c = cam.current;
    const eye = orbitEye(CENTER, c.dist, c.yaw, c.pitch, 'z');
    const aspect = canvas.width / canvas.height;
    const mvp = multiply(perspective(0.7, aspect, 1, 500), lookAt(eye, CENTER, [0, 0, 1]));
    const eq = lv.showFixed ? fixedPoints(params.current).slice(1) : [];
    r.draw(mvp, COLORS, lv.mode === 'butterfly', lv.mode === 'butterfly' ? 0.5 : 0.17, eq, BACKGROUND);
  });

  // Orbit camera: drag to rotate, wheel to zoom, arrows and +/− on the focused canvas.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      el.dataset.dragging = 'true';
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      cam.current.yaw -= (e.clientX - d.x) * 0.006;
      cam.current.pitch = Math.max(-1.4, Math.min(1.4, cam.current.pitch + (e.clientY - d.y) * 0.006));
      d.x = e.clientX;
      d.y = e.clientY;
    };
    const up = () => {
      drag.current = null;
      delete el.dataset.dragging;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.dist = Math.max(25, Math.min(220, cam.current.dist * Math.exp(e.deltaY * 0.0012)));
    };
    const key = (e: KeyboardEvent) => {
      const c = cam.current;
      const k: Record<string, () => void> = {
        ArrowLeft: () => (c.yaw += 0.1),
        ArrowRight: () => (c.yaw -= 0.1),
        ArrowUp: () => (c.pitch = Math.min(1.4, c.pitch + 0.08)),
        ArrowDown: () => (c.pitch = Math.max(-1.4, c.pitch - 0.08)),
        '+': () => (c.dist = Math.max(25, c.dist * 0.88)),
        '=': () => (c.dist = Math.max(25, c.dist * 0.88)),
        '-': () => (c.dist = Math.min(220, c.dist / 0.88)),
      };
      if (!k[e.key]) return;
      e.preventDefault();
      k[e.key]();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('keydown', key);
    };
  }, [error]);

  if (error) return <ArtworkError message={error} />;

  const chaotic = rho > hopfRho({ sigma, rho, beta });
  const fmt = (v: number) => formatNumber(v, 2);

  return (
    <div className="art">
      <canvas
        ref={canvasRef}
        className="art-canvas"
        tabIndex={0}
        aria-label="Аттрактор Лоренца. Стрелки поворачивают фигуру, плюс и минус меняют расстояние."
      />
      <Panel
        status={
          <>
            {mode === 'butterfly' ? (
              <div>
                Расстояние между облаками: <strong>{formatGap(gap)}</strong>
              </div>
            ) : null}
            <div>{chaotic ? 'Режим хаоса: траектории чувствительны к начальным данным.' : 'Ниже ρ ≈ 24,74 появляются устойчивые точки покоя, и точки могут осесть в них.'}</div>
          </>
        }
      >
        <Group title="Что показывать">
          <Choice
            label="Режим"
            value={mode}
            onChange={setMode}
            columns={1}
            options={[
              { value: 'cloud', label: 'Облако точек' },
              { value: 'butterfly', label: 'Две бабочки: старты различаются на 0,00001' },
            ]}
          />
        </Group>
        <Group title="Правило">
          <Slider label="σ (сигма)" value={sigma} min={1} max={30} step={0.1} onChange={setSigma} format={fmt} />
          <Slider label="ρ (ро)" value={rho} min={0.5} max={60} step={0.1} onChange={setRho} format={fmt} hint="Классическое значение — 28." />
          <Slider label="β (бета)" value={beta} min={0.5} max={6} step={0.05} onChange={setBeta} format={fmt} />
          <div className="actions">
            <ActionButton
              onClick={() => {
                setSigma(CLASSIC.sigma);
                setRho(CLASSIC.rho);
                setBeta(CLASSIC.beta);
              }}
            >
              Вернуть классические
            </ActionButton>
          </div>
        </Group>
        <Group title="Движение">
          <Slider label="Скорость" value={speed} min={1} max={8} step={1} onChange={setSpeed} />
          <div className="actions">
            <ActionButton onClick={() => setPaused((p) => !p)} pressed={paused}>
              {paused ? 'Продолжить' : 'Пауза'}
            </ActionButton>
            <ActionButton onClick={restart}>Начать заново</ActionButton>
          </div>
          <Toggle label="Медленно вращать" checked={spin} onChange={setSpin} />
          <Toggle label="Показать точки покоя" checked={showFixed} onChange={setShowFixed} />
        </Group>
      </Panel>
    </div>
  );
}
