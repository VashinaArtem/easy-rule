import { useEffect, useMemo, useRef, useState } from 'react';
import { fitCanvas } from '../../gl/gl';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { intCodec, numberCodec, useUrlState } from '../../hooks/useUrlState';
import { ActionButton, Choice, Group, Panel, Slider, Toggle } from '../../ui/controls';
import { formatNumber } from '../escape-time/format';
import type { ArtworkProps } from '../types';
import { chords, envelopeCurve, famous } from './math';

const kCodec = numberCodec(1, 60, 2);
const nCodec = intCodec(10, 720);
const K_MAX_PLAY = 24;
const RATE = 0.35; // multiplier units per second while playing

const STOPS: [number, number, number][] = [
  [140, 155, 255],
  [233, 236, 243],
  [244, 214, 150],
  [240, 138, 36],
];
const BANDS = 14;

function bandColor(t: number): [number, number, number] {
  const s = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(s));
  const f = s - i;
  return STOPS[i].map((v, c) => Math.round(v + (STOPS[i + 1][c] - v) * f)) as [number, number, number];
}

function layout(W: number, H: number) {
  const wide = W > 1000;
  return { S: Math.min(W, H) * (wide ? 0.33 : 0.42), cx: W * (wide ? 0.54 : 0.5), cy: H / 2 };
}

export default function ModularArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [k, setK] = useUrlState('k', 2, kCodec);
  const [n, setN] = useUrlState('n', 300, nCodec);
  const [playing, setPlaying] = useState(false);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const live = useRef({ k, n, playing, showEnvelope });
  const kAnim = useRef(k);
  const lastSync = useRef(0);
  const dirty = useRef(true);

  useEffect(() => {
    live.current = { k, n, playing, showEnvelope };
    if (!playing) kAnim.current = k;
    dirty.current = true;
  }, [k, n, playing, showEnvelope]);

  useFrameLoop(canvasRef, (dt, time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resized = fitCanvas(canvas, 2);
    const lv = live.current;
    if (lv.playing && !reducedMotion) {
      kAnim.current += dt * RATE;
      if (kAnim.current > K_MAX_PLAY) kAnim.current = 2;
      dirty.current = true;
      if (time - lastSync.current > 0.08) {
        lastSync.current = time;
        setK(kAnim.current);
      }
    }
    if (!dirty.current && !resized) return;
    dirty.current = false;
    draw(canvas, lv.playing ? kAnim.current : lv.k, lv.n, lv.showEnvelope);
  });

  const nearFamous = famous.find((f) => Math.abs(f.k - k) < 0.005)?.k.toString() ?? null;
  const cusps = useMemo(() => (Number.isInteger(k) && k >= 2 ? k - 1 : null), [k]);

  return (
    <div className="art">
      <canvas
        ref={canvasRef}
        className="art-canvas"
        role="img"
        style={{ cursor: 'default' }}
        aria-label={`Таблица умножения на круге: ${n} точек, множитель ${formatNumber(k, 2)}. Хорды огибают плавную кривую.`}
      />
      <Panel
        status={
          <>
            <div>
              Хорд: <strong>{n}</strong>, множитель k = <strong>{formatNumber(k, 2)}</strong>
            </div>
            <div>
              {cusps === null
                ? 'При дробном k огибающая не замыкается за один оборот: хорды складываются в кружево.'
                : cusps === 1
                  ? 'Огибающая — кардиоида: одно остриё.'
                  : `Огибающая — эпициклоида с ${cusps} ${cusps < 5 ? 'остриями' : 'остриями'}.`}
            </div>
          </>
        }
      >
        <Group title="Знаменитые кривые">
          <Choice
            label="Множитель"
            value={nearFamous}
            onChange={(v) => {
              setPlaying(false);
              setK(Number(v));
            }}
            options={famous.map((f) => ({ value: String(f.k) as string, label: `k = ${f.k}, ${f.name.toLowerCase()}` }))}
            columns={1}
          />
        </Group>
        <Group title="Правило">
          <Slider label="Множитель k" value={k} min={1} max={60} step={0.01} onChange={(v) => { setPlaying(false); setK(v); }} format={(v) => formatNumber(v, 2)} />
          <Slider label="Число точек n" value={n} min={10} max={720} step={1} onChange={setN} />
          <div className="actions">
            <ActionButton onClick={() => setPlaying((p) => !p)} pressed={playing}>
              {playing ? 'Остановить' : 'Плавно увеличивать k'}
            </ActionButton>
          </div>
          <Toggle label="Показывать огибающую" checked={showEnvelope} onChange={setShowEnvelope} />
        </Group>
      </Panel>
    </div>
  );
}

function draw(canvas: HTMLCanvasElement, k: number, n: number, showEnvelope: boolean) {
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

  ctx.beginPath();
  ctx.arc(cx, cy, S, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(233, 236, 243, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chords, grouped into colour bands so each band is a single path.
  const all = chords(n, k);
  const alpha = Math.min(0.62, Math.max(0.1, 52 / n + 0.08));
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1;
  for (let b = 0; b < BANDS; b++) {
    const from = Math.floor((b * n) / BANDS);
    const to = Math.floor(((b + 1) * n) / BANDS);
    if (to <= from) continue;
    const [r, g, bl] = bandColor((b + 0.5) / BANDS);
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      ctx.moveTo(X(all[i].a[0]), Y(all[i].a[1]));
      ctx.lineTo(X(all[i].b[0]), Y(all[i].b[1]));
    }
    ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  if (showEnvelope && k > 1.001) {
    // The envelope closes after one turn only for integer k; otherwise show the first turn.
    const pts = envelopeCurve(k, 900);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  if (n <= 120) {
    ctx.fillStyle = '#e9ecf3';
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      ctx.beginPath();
      ctx.arc(X(Math.cos(t)), Y(Math.sin(t)), 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
