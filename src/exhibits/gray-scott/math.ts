/**
 * Gray–Scott model on a periodic grid (cell size 1, time step 1):
 *   u̇ = Dᵤ∇²u − u v² + F (1 − u)
 *   v̇ = Dᵥ∇²v + u v² − (F + k) v
 * ∇² is the 9-point stencil (centre −1, edges 0.2, corners 0.05), as in
 * Karl Sims' well-known implementation. The shader repeats exactly this step.
 */
export const DU = 1.0;
export const DV = 0.5;

export const F_RANGE: [number, number] = [0.01, 0.1];
export const K_RANGE: [number, number] = [0.045, 0.07];

export interface Field {
  w: number;
  h: number;
  u: Float64Array;
  v: Float64Array;
}

export function createField(w: number, h: number): Field {
  return { w, h, u: new Float64Array(w * h).fill(1), v: new Float64Array(w * h) };
}

export function laplacian(f: Float64Array, w: number, h: number, x: number, y: number): number {
  const xm = (x + w - 1) % w;
  const xp = (x + 1) % w;
  const ym = (y + h - 1) % h;
  const yp = (y + 1) % h;
  return (
    -f[y * w + x] +
    0.2 * (f[y * w + xm] + f[y * w + xp] + f[ym * w + x] + f[yp * w + x]) +
    0.05 * (f[ym * w + xm] + f[ym * w + xp] + f[yp * w + xm] + f[yp * w + xp])
  );
}

export function step(field: Field, F: number, k: number, dt = 1): Field {
  const { w, h, u, v } = field;
  const nu = new Float64Array(w * h);
  const nv = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const uvv = u[i] * v[i] * v[i];
      const du = DU * laplacian(u, w, h, x, y) - uvv + F * (1 - u[i]);
      const dv = DV * laplacian(v, w, h, x, y) + uvv - (F + k) * v[i];
      nu[i] = Math.min(1, Math.max(0, u[i] + dt * du));
      nv[i] = Math.min(1, Math.max(0, v[i] + dt * dv));
    }
  }
  return { w, h, u: nu, v: nv };
}

/** Reaction part only (no diffusion): returns [u̇, v̇]. */
export function reaction(u: number, v: number, F: number, k: number): [number, number] {
  const uvv = u * v * v;
  return [-uvv + F * (1 - u), uvv - (F + k) * v];
}

/**
 * Non-trivial homogeneous steady states: u v = F + k and F(1 − u) = u v², i.e.
 * (F + k) v² − F v + F (F + k) = 0. They exist iff F ≥ 4 (F + k)².
 */
export function nontrivialEquilibria(F: number, k: number): [number, number][] {
  const s = F + k;
  const disc = F * F - 4 * F * s * s;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(F + root) / (2 * s), (F - root) / (2 * s)].map((v) => [s / v, v] as [number, number]);
}

/** The saddle-node curve k = √F/2 − F: above it only u = 1, v = 0 remains. */
export function saddleNodeK(F: number): number {
  return Math.sqrt(F) / 2 - F;
}

export interface GsPreset {
  id: string;
  name: string;
  F: number;
  k: number;
}

export const presets: GsPreset[] = [
  { id: 'maze', name: 'Лабиринт', F: 0.029, k: 0.057 },
  { id: 'mitosis', name: 'Деление', F: 0.0367, k: 0.0649 },
  { id: 'solitons', name: 'Пятна', F: 0.03, k: 0.062 },
  { id: 'coral', name: 'Коралл', F: 0.0545, k: 0.062 },
  { id: 'worms', name: 'Червяки', F: 0.078, k: 0.061 },
];
