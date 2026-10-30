import { useEffect, useRef, type RefObject } from 'react';
import { panBy, zoomAt, type PlaneView } from '../gl/view';

export interface PanZoomOptions {
  minScale: number;
  maxScale: number;
  /** Called on every view change; `interacting` is false once input settles. */
  onChange: (interacting: boolean) => void;
  /** Return true for pointer-downs that belong to something else (e.g. a handle). */
  ignore?: (e: PointerEvent) => boolean;
}

/**
 * Drag to pan, wheel or pinch to zoom, double-click to zoom ×2, arrows and +/− on
 * the focused element. The view lives in a ref so frequent updates skip React.
 */
export function usePanZoom(target: RefObject<HTMLElement | null>, view: { current: PlaneView }, options: PanZoomOptions) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let settleTimer: number | undefined;

    const changed = () => {
      opts.current.onChange(true);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => opts.current.onChange(false), 180);
    };
    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };
    const zoom = (factor: number, x: number, y: number, w: number, h: number) => {
      const { minScale, maxScale } = opts.current;
      view.current = zoomAt(view.current, factor, x, y, w, h, minScale, maxScale);
      changed();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (opts.current.ignore?.(e)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.dataset.dragging = 'true';
    };
    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const r = el.getBoundingClientRect();
      if (pointers.size === 1) {
        view.current = panBy(view.current, e.clientX - prev.x, e.clientY - prev.y, r.height);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        changed();
        return;
      }
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      const midBefore = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pointers.values()];
      const after = Math.hypot(c.x - d.x, c.y - d.y);
      const midAfter = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
      view.current = panBy(view.current, midAfter.x - midBefore.x, midAfter.y - midBefore.y, r.height);
      if (before > 0 && after > 0) {
        const { minScale, maxScale } = opts.current;
        view.current = zoomAt(view.current, before / after, midAfter.x - r.left, midAfter.y - r.top, r.width, r.height, minScale, maxScale);
      }
      changed();
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) delete el.dataset.dragging;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const p = local(e);
      zoom(Math.exp(e.deltaY * unit * 0.0015), p.x, p.y, p.w, p.h);
    };
    const onDblClick = (e: MouseEvent) => {
      if (opts.current.ignore?.(e as PointerEvent)) return;
      const p = local(e);
      zoom(e.shiftKey ? 2 : 0.5, p.x, p.y, p.w, p.h);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target !== el) return;
      const r = el.getBoundingClientRect();
      const step = r.height * 0.1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (moves[e.key]) {
        view.current = panBy(view.current, moves[e.key][0], moves[e.key][1], r.height);
        changed();
      } else if (e.key === '+' || e.key === '=') {
        zoom(0.7, r.width / 2, r.height / 2, r.width, r.height);
      } else if (e.key === '-' || e.key === '_') {
        zoom(1 / 0.7, r.width / 2, r.height / 2, r.width, r.height);
      } else return;
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(settleTimer);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDblClick);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [target, view]);
}
