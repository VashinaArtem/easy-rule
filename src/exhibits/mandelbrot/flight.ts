import type { PlaneView } from '../../gl/view';

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Animated move between two views. Zoom is interpolated in log-scale and the
 * path first zooms out, then in, so long jumps stay readable (van Wijk-style).
 */
export function flyTo(from: PlaneView, to: PlaneView, start: number): (time: number) => PlaneView | null {
  const ls0 = Math.log(from.scale);
  const ls1 = Math.log(to.scale);
  const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  const peak = Math.max(ls0, ls1, Math.log(Math.max(dist, 1e-300) * 0.8));
  const duration = Math.min(4.5, 1.2 + Math.abs(ls1 - ls0) * 0.12 + (peak - Math.min(ls0, ls1)) * 0.06);
  return (time) => {
    const t = Math.min(1, (time - start) / duration);
    if (t >= 1) return null;
    const e = ease(t);
    // Parabolic hump in log-scale through `peak`.
    const base = ls0 + (ls1 - ls0) * e;
    const hump = 4 * e * (1 - e) * Math.max(0, peak - Math.max(ls0, ls1));
    const scale = Math.exp(base + hump);
    // Move the centre in proportion to how much of the zoom has been covered, so
    // the target stays on screen while zooming in.
    const p = ls0 === ls1 ? e : Math.min(1, Math.max(0, e * 1.6));
    return { cx: from.cx + (to.cx - from.cx) * p, cy: from.cy + (to.cy - from.cy) * p, scale };
  };
}
