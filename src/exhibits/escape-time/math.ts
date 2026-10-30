/**
 * CPU reference for the escape-time iteration z → z² + c. The shaders implement
 * exactly this; tests run against it.
 */

/** Escape radius R = 256 (R² = 65536). A large R makes smooth colouring accurate. */
export const ESCAPE_R2 = 65536;

export interface Orbit {
  escaped: boolean;
  /** Number of completed iterations before escape (or maxIter). */
  n: number;
  zx: number;
  zy: number;
  /** Derivative of z_n with respect to c (Mandelbrot) or z₀ (Julia). */
  dzx: number;
  dzy: number;
}

export function iterate(z0x: number, z0y: number, cx: number, cy: number, maxIter: number, julia: boolean): Orbit {
  let zx = z0x;
  let zy = z0y;
  let dzx = julia ? 1 : 0;
  let dzy = 0;
  for (let n = 0; n < maxIter; n++) {
    const ndx = 2 * (zx * dzx - zy * dzy) + (julia ? 0 : 1);
    const ndy = 2 * (zx * dzy + zy * dzx);
    dzx = ndx;
    dzy = ndy;
    const x = zx * zx - zy * zy + cx;
    zy = 2 * zx * zy + cy;
    zx = x;
    if (zx * zx + zy * zy > ESCAPE_R2) return { escaped: true, n, zx, zy, dzx, dzy };
  }
  return { escaped: false, n: maxIter, zx, zy, dzx, dzy };
}

export const mandelbrot = (cx: number, cy: number, maxIter: number) => iterate(0, 0, cx, cy, maxIter, false);
export const julia = (zx: number, zy: number, cx: number, cy: number, maxIter: number) => iterate(zx, zy, cx, cy, maxIter, true);

/**
 * Continuous ("smooth") iteration count ν = n + 2 − log₂ ln|z|. It is continuous
 * across band boundaries because |z_{n+1}| ≈ |z_n|² once |z| is large.
 */
export function smoothIteration(o: Orbit): number {
  const logz = 0.5 * Math.log(o.zx * o.zx + o.zy * o.zy);
  return Math.max(0, o.n + 2 - Math.log2(logz));
}

/** Exterior distance estimate |z| ln|z| / |z′| (lower bound up to a factor ~2). */
export function distanceEstimate(o: Orbit): number {
  const r = Math.hypot(o.zx, o.zy);
  return (r * Math.log(r)) / Math.hypot(o.dzx, o.dzy);
}

/** Main cardioid and period-2 bulb: points inside never escape. */
export function inMainBodies(cx: number, cy: number): boolean {
  const x = cx - 0.25;
  const q = x * x + cy * cy;
  if (q * (q + x) <= 0.25 * cy * cy) return true;
  return (cx + 1) * (cx + 1) + cy * cy <= 1 / 16;
}

/** More iterations are needed the deeper the view; `detail` multiplies the budget. */
export function autoIterations(scale: number, detail: number): number {
  const depth = Math.max(0, Math.log10(1.5 / scale));
  return Math.round(Math.min(8000, (180 + depth * 220 + depth * depth * 25) * detail));
}
