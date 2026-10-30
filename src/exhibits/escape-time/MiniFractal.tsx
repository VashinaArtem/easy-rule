import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { fitCanvas } from '../../gl/gl';
import { planeToScreen, screenToPlane, type PlaneView } from '../../gl/view';
import { EscapeTimeRenderer } from './renderer';
import type { EscapePalette } from './palettes';
import type { EscapeKind } from './shaders';

interface MiniFractalProps {
  kind: EscapeKind;
  view: PlaneView;
  palette: EscapePalette;
  c?: [number, number];
  maxIter?: number;
  /** When set, the canvas becomes a picker for a point of the plane. */
  onPick?: (c: [number, number]) => void;
  marker?: [number, number];
  label: string;
}

/** Small static fractal view; optionally a point picker with a marker. */
export function MiniFractal({ kind, view, palette, c, maxIter = 250, onPick, marker, label }: MiniFractalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EscapeTimeRenderer | null>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      rendererRef.current = new EscapeTimeRenderer(canvasRef.current!, kind);
    } catch {
      rendererRef.current = null;
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [kind]);

  const cx = c?.[0];
  const cy = c?.[1];
  const mx = marker?.[0];
  const my = marker?.[1];
  useEffect(() => {
    const canvas = canvasRef.current!;
    let raf = 0;
    const draw = () => {
      raf = 0;
      const r = rendererRef.current;
      if (!r || canvas.clientWidth === 0) return;
      fitCanvas(canvas, 2);
      r.draw({ view, c: cx === undefined ? undefined : [cx, cy!], maxIter, palette, density: 1.2, interactive: false });
      if (mx !== undefined && markerRef.current) {
        const [x, y] = planeToScreen(view, mx, my!, canvas.clientWidth, canvas.clientHeight);
        markerRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [view, cx, cy, mx, my, maxIter, palette]);

  const pick = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onPick?.(screenToPlane(view, e.clientX - r.left, e.clientY - r.top, r.width, r.height));
  };

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!onPick || !marker) return;
    const step = (view.scale / 60) * (e.shiftKey ? 5 : 1);
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!d[e.key]) return;
    e.preventDefault();
    onPick([marker[0] + d[e.key][0], marker[1] + d[e.key][1]]);
  };

  return (
    <div className="mini" data-picker={Boolean(onPick)}>
      <canvas
        ref={canvasRef}
        role={onPick ? 'slider' : 'img'}
        aria-label={label}
        tabIndex={onPick ? 0 : undefined}
        aria-valuetext={marker ? `${marker[0].toFixed(3)} ${marker[1] < 0 ? '−' : '+'} ${Math.abs(marker[1]).toFixed(3)}i` : undefined}
        onKeyDown={onKey}
        onPointerDown={
          onPick
            ? (e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                pick(e);
              }
            : undefined
        }
        onPointerMove={onPick ? (e) => dragging.current && pick(e) : undefined}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      />
      {marker ? <span className="mini__marker" ref={markerRef} aria-hidden="true" /> : null}
    </div>
  );
}
