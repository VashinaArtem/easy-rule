import { useEffect, useMemo, useRef, useState } from 'react';
import { fitCanvas } from '../../gl/gl';
import type { PlaneView } from '../../gl/view';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { usePanZoom } from '../../hooks/usePanZoom';
import { enumCodec, numberCodec, useUrlState, type Codec } from '../../hooks/useUrlState';
import { ArtworkError, Choice, Group, Panel, Slider, Toggle } from '../../ui/controls';
import type { ArtworkProps } from '../types';
import { autoIterations, mandelbrot } from '../escape-time/math';
import { formatComplex, formatZoom } from '../escape-time/format';
import { MiniFractal } from '../escape-time/MiniFractal';
import { getPalette, paletteIds, palettes } from '../escape-time/palettes';
import { EscapeTimeRenderer, FLOAT_LIMIT } from '../escape-time/renderer';
import { cardioid, juliaPresets } from './presets';

const HOME: PlaneView = { cx: 0, cy: 0, scale: 1.35 };
const MAP: PlaneView = { cx: -0.6, cy: 0, scale: 1.25 };
const darkPalettes = palettes.filter((p) => p.id !== 'ink');

const complexCodec: Codec<[number, number]> = {
  parse: (raw) => {
    const [a, b] = raw.split(',').map(Number);
    return Number.isFinite(a) && Number.isFinite(b) && Math.hypot(a, b) < 3 ? [a, b] : undefined;
  },
  format: ([a, b]) => `${a.toFixed(6)},${b.toFixed(6)}`,
};
const paletteCodec = enumCodec(paletteIds);
const detailCodec = numberCodec(0.5, 4, 2);
const DEFAULT_C: [number, number] = [-0.7269, 0.1889];

export default function JuliaArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EscapeTimeRenderer | null>(null);
  const view = useRef<PlaneView>({ ...HOME });
  const dirty = useRef(true);
  const interacting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [c, setC] = useUrlState<[number, number]>('c', DEFAULT_C, complexCodec);
  const [paletteId, setPaletteId] = useUrlState('palette', 'pearl', paletteCodec);
  const [detail, setDetail] = useUrlState('detail', 1, detailCodec);
  const [walking, setWalking] = useState(false);
  const [zoom, setZoom] = useState(1);
  const walk = useRef({ theta: 0, lastSync: 0 });
  const cRef = useRef(c);
  const palette = getPalette(paletteId);

  useEffect(() => {
    try {
      rendererRef.current = new EscapeTimeRenderer(canvasRef.current!, 'julia');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    cRef.current = c;
    dirty.current = true;
  }, [c, paletteId, detail]);

  usePanZoom(canvasRef, view, {
    minScale: FLOAT_LIMIT,
    maxScale: 3,
    onChange: (active) => {
      interacting.current = active;
      dirty.current = true;
      if (!active) setZoom(HOME.scale / view.current.scale);
    },
  });

  const startWalk = (on: boolean) => {
    if (on) {
      // Start the walk from the cardioid angle closest to the current c.
      const [x, y] = cRef.current;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < 360; i++) {
        const t = (i / 360) * Math.PI * 2;
        const [px, py] = cardioid(t);
        const d = Math.hypot(px - x, py - y);
        if (d < bestD) [best, bestD] = [t, d];
      }
      walk.current.theta = best;
    }
    setWalking(on);
  };

  useFrameLoop(canvasRef, (dt, time) => {
    const r = rendererRef.current;
    const canvas = canvasRef.current;
    if (!r || !canvas) return;
    if (fitCanvas(canvas, 2)) dirty.current = true;
    if (walking) {
      walk.current.theta += dt * 0.12;
      cRef.current = cardioid(walk.current.theta, 1.0);
      dirty.current = true;
      if (time - walk.current.lastSync > 0.2) {
        walk.current.lastSync = time;
        setC(cRef.current);
      }
    }
    if (!dirty.current) return;
    dirty.current = false;
    const v = view.current;
    r.draw({ view: v, c: cRef.current, maxIter: autoIterations(v.scale, detail), palette, density: 1.2, interactive: interacting.current || walking });
  });

  const connected = useMemo(() => !mandelbrot(c[0], c[1], 2000).escaped, [c]);
  const preset = juliaPresets.find((p) => Math.abs(p.c[0] - c[0]) < 1e-6 && Math.abs(p.c[1] - c[1]) < 1e-6)?.id ?? null;

  const pick = (next: [number, number]) => {
    setWalking(false);
    setC(next);
  };

  if (error) return <ArtworkError message={error} />;

  return (
    <div className="art">
      <canvas ref={canvasRef} className="art-canvas" tabIndex={0} aria-label={`Множество Жюлиа для c = ${formatComplex(c[0], c[1], 3)}. Стрелки двигают изображение, плюс и минус меняют масштаб.`} />
      <Panel
        status={
          <>
            <div>
              c = <strong>{formatComplex(c[0], c[1], 4)}</strong>
            </div>
            <div>
              {connected ? 'c внутри множества Мандельброта: узор связный.' : 'c снаружи множества Мандельброта: узор рассыпается в пыль.'}
            </div>
            <div>Увеличение: {formatZoom(zoom)}</div>
          </>
        }
      >
        <Group title="Выберите c на карте">
          <MiniFractal kind="mandelbrot" view={MAP} palette={palette} label="Карта множества Мандельброта: выбор точки c. Стрелки сдвигают точку." onPick={pick} marker={c} />
          <Toggle label={reducedMotion ? 'Обход по границе (анимация)' : 'Обход по границе'} checked={walking} onChange={startWalk} />
        </Group>
        <Group title="Известные узоры">
          <Choice label="Известные узоры" value={preset} onChange={(id) => pick(juliaPresets.find((p) => p.id === id)!.c)} options={juliaPresets.map((p) => ({ value: p.id, label: p.name }))} />
        </Group>
        <Group title="Цвет">
          <Choice label="Палитра" value={paletteId} onChange={setPaletteId} columns={3} options={darkPalettes.map((p) => ({ value: p.id, label: p.name }))} />
          <Slider label="Детализация" value={detail} min={0.5} max={4} step={0.25} onChange={setDetail} format={(v) => `×${v.toString().replace('.', ',')}`} />
        </Group>
      </Panel>
    </div>
  );
}
