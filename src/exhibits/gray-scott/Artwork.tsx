import { useEffect, useRef, useState } from 'react';
import { fitCanvas } from '../../gl/gl';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { boolCodec, numberCodec, useUrlState } from '../../hooks/useUrlState';
import { ActionButton, ArtworkError, Choice, Group, Panel, Slider, Toggle } from '../../ui/controls';
import type { ArtworkProps } from '../types';
import { FKMap } from './FKMap';
import { F_RANGE, K_RANGE, presets } from './math';
import { GrayScottSim } from './simulation';

const LONG_SIDE = 960;
const fCodec = numberCodec(F_RANGE[0], F_RANGE[1], 4);
const kCodec = numberCodec(K_RANGE[0], K_RANGE[1], 4);

const fmt4 = (v: number) => v.toFixed(4).replace('.', ',');

export default function GrayScottArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<GrayScottSim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [F, setF] = useUrlState('F', 0.029, fCodec);
  const [k, setK] = useUrlState('k', 0.057, kCodec);
  const [atlas, setAtlas] = useUrlState('atlas', false, boolCodec);
  const [speed, setSpeed] = useState(12);
  const [radius, setRadius] = useState(9);
  const [paused, setPaused] = useState(reducedMotion);
  const [probe, setProbe] = useState<{ F: number; k: number } | null>(null);
  const live = useRef({ F, k, atlas, speed, radius, paused });
  const pointer = useRef<{ x: number; y: number; px: number; py: number; down: boolean } | null>(null);
  const lastProbe = useRef(0);

  useEffect(() => {
    live.current = { F, k, atlas, speed, radius, paused };
  }, [F, k, atlas, speed, radius, paused]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const w = aspect >= 1 ? LONG_SIDE : Math.round(LONG_SIDE * aspect);
    const h = aspect >= 1 ? Math.round(LONG_SIDE / aspect) : LONG_SIDE;
    try {
      const s = new GrayScottSim(canvas, w, h);
      sim.current = s;
      if (reducedMotion) {
        // Show a developed pattern straight away instead of an animated growth.
        for (let i = 0; i < 2400; i++) s.step({ F: live.current.F, k: live.current.k, atlas: live.current.atlas, dt: 1 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      sim.current?.dispose();
      sim.current = null;
    };
  }, [reducedMotion]);

  /** Canvas pixel → field cell, using the same "cover" mapping as the shader. */
  const toCell = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const s = sim.current!;
    const r = canvas.getBoundingClientRect();
    let u = (clientX - r.left) / r.width;
    let v = 1 - (clientY - r.top) / r.height;
    const ca = r.width / r.height;
    const sa = s.width / s.height;
    if (ca > sa) v = (v - 0.5) * (sa / ca) + 0.5;
    else u = (u - 0.5) * (ca / sa) + 0.5;
    return { x: u * s.width, y: v * s.height, u, v };
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || error) return;
    const down = (e: globalThis.PointerEvent) => {
      if (!sim.current) return;
      el.setPointerCapture(e.pointerId);
      const c = toCell(e.clientX, e.clientY);
      pointer.current = { x: c.x, y: c.y, px: c.x, py: c.y, down: true };
    };
    const move = (e: globalThis.PointerEvent) => {
      if (!sim.current) return;
      const c = toCell(e.clientX, e.clientY);
      const p = pointer.current;
      if (p?.down) {
        p.x = c.x;
        p.y = c.y;
      }
      if (live.current.atlas) {
        const now = performance.now();
        if (now - lastProbe.current > 90) {
          lastProbe.current = now;
          const cu = Math.min(1, Math.max(0, c.u));
          const cv = Math.min(1, Math.max(0, c.v));
          setProbe({ F: F_RANGE[0] + cu * (F_RANGE[1] - F_RANGE[0]), k: K_RANGE[0] + cv * (K_RANGE[1] - K_RANGE[0]) });
        }
      }
    };
    const up = () => {
      if (pointer.current) pointer.current.down = false;
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
    // toCell only reads refs.
  }, [error]);

  useFrameLoop(canvasRef, () => {
    const s = sim.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return;
    fitCanvas(canvas, 1.5);
    const lv = live.current;
    const p = pointer.current;
    const stroke = p && (p.down || p.px !== p.x || p.py !== p.y) ? { x0: p.px, y0: p.py, x1: p.x, y1: p.y, radius: lv.radius } : undefined;
    if (p) {
      p.px = p.x;
      p.py = p.y;
    }
    const n = lv.paused ? 0 : Math.round(lv.speed);
    for (let i = 0; i < Math.max(n, stroke ? 1 : 0); i++) {
      // While paused a stroke is applied with dt = 0, so only the brush changes the field.
      s.step({ F: lv.F, k: lv.k, atlas: lv.atlas, dt: lv.paused ? 0 : 1, stroke: i === 0 ? stroke : undefined });
    }
    s.show();
  });

  const preset = presets.find((p) => Math.abs(p.F - F) < 1e-4 && Math.abs(p.k - k) < 1e-4)?.id ?? null;

  if (error) return <ArtworkError message={error} />;

  return (
    <div className="art">
      <canvas
        ref={canvasRef}
        className="art-canvas art-canvas--paint"
        role="img"
        aria-label="Реакция и диффузия: узоры, растущие по правилу Грея и Скотта. Рисуйте мышью или пальцем, чтобы добавить вещество."
      />
      <Panel
        status={
          atlas ? (
            probe ? (
              <div>
                Под курсором: F = <strong>{fmt4(probe.F)}</strong>, k = <strong>{fmt4(probe.k)}</strong>
              </div>
            ) : (
              <div>Проведите по картине, чтобы увидеть F и k в этой точке.</div>
            )
          ) : (
            <div>
              F = <strong>{fmt4(F)}</strong>, k = <strong>{fmt4(k)}</strong>
            </div>
          )
        }
      >
        <Group title="Узор">
          <Choice
            label="Известные узоры"
            value={atlas ? null : preset}
            onChange={(id) => {
              const p = presets.find((x) => x.id === id)!;
              setAtlas(false);
              setF(p.F);
              setK(p.k);
            }}
            options={presets.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Toggle label="Атлас: F слева направо, k снизу вверх" checked={atlas} onChange={setAtlas} />
        </Group>
        <Group title="Два числа правила">
          <FKMap
            F={F}
            k={k}
            onChange={(nf, nk) => {
              setAtlas(false);
              setF(nf);
              setK(nk);
            }}
          />
          <p className="slider__hint">Линия: выше неё вещество v в смеси без диффузии всегда исчезает.</p>
        </Group>
        <Group title="Кисть и время">
          <Slider label="Размер кисти" value={radius} min={3} max={40} step={1} onChange={setRadius} />
          <Slider label="Скорость" value={speed} min={1} max={30} step={1} onChange={setSpeed} format={(v) => `${v} шагов за кадр`} />
          <div className="actions">
            <ActionButton onClick={() => setPaused((p) => !p)} pressed={paused}>
              {paused ? 'Продолжить' : 'Пауза'}
            </ActionButton>
            <ActionButton onClick={() => sim.current?.reset()}>Засеять заново</ActionButton>
            <ActionButton onClick={() => sim.current?.clear()}>Очистить</ActionButton>
          </div>
        </Group>
      </Panel>
    </div>
  );
}
