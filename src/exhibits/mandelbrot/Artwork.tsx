import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fitCanvas } from '../../gl/gl';
import type { PlaneView } from '../../gl/view';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { usePanZoom } from '../../hooks/usePanZoom';
import { enumCodec, numberCodec, readUrlParam, useUrlState, writeUrlParam } from '../../hooks/useUrlState';
import { ArtworkError, Choice, Group, Panel, Slider } from '../../ui/controls';
import type { ArtworkProps } from '../types';
import { autoIterations } from '../escape-time/math';
import { formatComplex, formatZoom } from '../escape-time/format';
import { MiniFractal } from '../escape-time/MiniFractal';
import { getPalette, paletteIds, palettes } from '../escape-time/palettes';
import { EscapeTimeRenderer } from '../escape-time/renderer';
import { flyTo } from './flight';
import { HOME, locations } from './locations';

const darkPalettes = palettes.filter((p) => p.id !== 'ink');
const paletteCodec = enumCodec(paletteIds);
const detailCodec = numberCodec(0.5, 4, 2);
const densityCodec = numberCodec(0.3, 3, 2);

function viewFromUrl(): PlaneView {
  const x = Number(readUrlParam('x'));
  const y = Number(readUrlParam('y'));
  const s = Number(readUrlParam('s'));
  if (readUrlParam('x') !== null && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(s) && s > 0) {
    return { cx: x, cy: y, scale: Math.min(2.5, s) };
  }
  return { ...HOME };
}

export default function MandelbrotArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EscapeTimeRenderer | null>(null);
  const view = useRef<PlaneView>(viewFromUrl());
  const dirty = useRef(true);
  const interacting = useRef(false);
  const flight = useRef<((t: number) => PlaneView | null) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useUrlState('palette', 'cobalt', paletteCodec);
  const [detail, setDetail] = useUrlState('detail', 1, detailCodec);
  const [density, setDensity] = useUrlState('rhythm', 1.2, densityCodec);
  const [deepOk, setDeepOk] = useState(true);
  // Low-frequency snapshot of the view for the panel and the Julia inset.
  const [snapshot, setSnapshot] = useState<PlaneView>(view.current);
  const [location, setLocation] = useState<string | null>(null);

  const palette = getPalette(paletteId);
  const minScale = rendererRef.current?.minScale ?? 4e-11;

  useEffect(() => {
    try {
      const r = new EscapeTimeRenderer(canvasRef.current!, 'mandelbrot');
      rendererRef.current = r;
      setDeepOk(r.df64Works);
      view.current.scale = Math.max(view.current.scale, r.minScale);
      dirty.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    dirty.current = true;
  }, [paletteId, detail, density]);

  const publishView = useCallback(() => {
    const v = view.current;
    setSnapshot({ ...v });
    writeUrlParam('x', String(v.cx));
    writeUrlParam('y', String(v.cy));
    writeUrlParam('s', v.scale.toPrecision(6));
  }, []);

  usePanZoom(canvasRef, view, {
    minScale,
    maxScale: 2.5,
    onChange: (active) => {
      flight.current = null;
      interacting.current = active;
      dirty.current = true;
      setLocation(null);
      if (!active) publishView();
    },
  });

  const throttle = useRef(0);
  useFrameLoop(canvasRef, (_dt, time) => {
    const r = rendererRef.current;
    const canvas = canvasRef.current;
    if (!r || !canvas) return;
    if (fitCanvas(canvas, 2)) dirty.current = true;
    if (flight.current) {
      const v = flight.current(time);
      if (v) view.current = v;
      else {
        flight.current = null;
        interacting.current = false;
        publishView();
      }
      dirty.current = true;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const v = view.current;
    r.draw({ view: v, maxIter: autoIterations(v.scale, detail), palette, density, interactive: interacting.current });
    if (interacting.current && time - throttle.current > 0.25) {
      throttle.current = time;
      setSnapshot({ ...v });
    }
  });

  const goTo = (id: string) => {
    const loc = locations.find((l) => l.id === id)!;
    const target = { ...loc.view, scale: Math.max(loc.view.scale, rendererRef.current?.minScale ?? 0) };
    setLocation(id);
    if (reducedMotion) {
      view.current = target;
      dirty.current = true;
      publishView();
      return;
    }
    interacting.current = true;
    flight.current = flyTo(view.current, target, performance.now() / 1000);
  };

  const zoom = HOME.scale / snapshot.scale;
  const deep = rendererRef.current?.usesDf64(snapshot.scale) ?? false;
  const atLimit = snapshot.scale <= minScale * 1.01;
  const juliaC = useMemo<[number, number]>(() => [snapshot.cx, snapshot.cy], [snapshot.cx, snapshot.cy]);

  if (error) return <ArtworkError message={error} />;

  return (
    <div className="art">
      <canvas
        ref={canvasRef}
        className="art-canvas"
        tabIndex={0}
        aria-label="Множество Мандельброта. Стрелки двигают изображение, плюс и минус меняют масштаб."
      />
      <span className="crosshair" aria-hidden="true" />
      <Panel
        status={
          <>
            <div>
              Центр: <strong>{formatComplex(snapshot.cx, snapshot.cy, Math.min(14, Math.max(4, Math.ceil(-Math.log10(snapshot.scale)) + 3)))}</strong>
            </div>
            <div>
              Увеличение: <strong>{formatZoom(zoom)}</strong>, итераций до {autoIterations(snapshot.scale, detail)}
            </div>
            <div>{deep ? 'Двойная точность (df64): глубина до ×10¹⁰' : 'Обычная точность (float32)'}</div>
            {atLimit ? <div role="status">Дальше не хватает точности вычислений.</div> : null}
            {!deepOk ? <div>Видеокарта не прошла проверку df64, поэтому глубина ограничена ×10³.</div> : null}
          </>
        }
      >
        <Group title="Куда смотреть">
          <Choice label="Места" value={location} onChange={goTo} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
        </Group>
        <Group title="Цвет">
          <Choice label="Палитра" value={paletteId} onChange={setPaletteId} columns={3} options={darkPalettes.map((p) => ({ value: p.id, label: p.name }))} />
          <Slider label="Ритм полос" value={density} min={0.3} max={3} step={0.05} onChange={setDensity} format={(v) => v.toFixed(2).replace('.', ',')} />
          <Slider
            label="Детализация"
            value={detail}
            min={0.5}
            max={4}
            step={0.25}
            onChange={setDetail}
            format={(v) => `×${v.toString().replace('.', ',')}`}
            hint="Больше итераций — точнее граница, но медленнее."
          />
        </Group>
        <Group title="Жюлиа для центра прицела">
          <MiniFractal kind="julia" view={{ cx: 0, cy: 0, scale: 1.6 }} palette={palette} c={juliaC} maxIter={300} label="Множество Жюлиа для точки в центре экрана" />
          <Link className="mini__link" to={`/work/julia?c=${snapshot.cx.toFixed(6)},${snapshot.cy.toFixed(6)}`}>
            Открыть это множество Жюлиа
          </Link>
        </Group>
      </Panel>
    </div>
  );
}
