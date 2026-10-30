/**
 * Fourier epicycles. A closed curve is a periodic complex function z(t), t ∈ [0, 1).
 * Sampled at M equal-arc-length points z_j = z(j/M), the DFT gives
 *   c_n = (1/M) Σ_j z_j e^{−2πi n j / M}   and   z(t) = Σ_n c_n e^{2πi n t},
 * each term being a circle of radius |c_n| turning n times per period.
 */
export type Pt = [number, number];

export const SAMPLES = 512;

export interface Coef {
  n: number;
  re: number;
  im: number;
  amp: number;
}

/** Resamples a closed polyline into m points equally spaced along its length. */
export function resample(points: Pt[], m: number): Pt[] {
  const pts = points.length > 0 && (points[0][0] !== points[points.length - 1][0] || points[0][1] !== points[points.length - 1][1]) ? [...points, points[0]] : points.slice();
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];
  const out: Pt[] = [];
  let seg = 1;
  for (let j = 0; j < m; j++) {
    const s = (j * total) / m;
    while (seg < pts.length - 1 && cum[seg] < s) seg++;
    const len = cum[seg] - cum[seg - 1];
    const f = len > 0 ? (s - cum[seg - 1]) / len : 0;
    out.push([pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * f, pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * f]);
  }
  return out;
}

/** Centres the curve on its bounding box and scales it to fit [−1, 1]². */
export function normalise(points: Pt[]): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const s = 2 / Math.max(maxX - minX, maxY - minY, 1e-12);
  return points.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
}

/** Discrete Fourier transform; frequencies run over −M/2 … M/2 − 1. */
export function dft(z: Pt[]): Coef[] {
  const M = z.length;
  const cos = new Float64Array(M);
  const sin = new Float64Array(M);
  for (let i = 0; i < M; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / M);
    sin[i] = Math.sin((2 * Math.PI * i) / M);
  }
  const out: Coef[] = [];
  for (let k = 0; k < M; k++) {
    const n = k < M / 2 ? k : k - M;
    let re = 0;
    let im = 0;
    for (let j = 0; j < M; j++) {
      const idx = (((k * j) % M) + M) % M; // e^{−2πi kj/M} = cos − i sin
      const c = cos[idx];
      const s = -sin[idx];
      re += z[j][0] * c - z[j][1] * s;
      im += z[j][0] * s + z[j][1] * c;
    }
    re /= M;
    im /= M;
    out.push({ n, re, im, amp: Math.hypot(re, im) });
  }
  return out;
}

/** The N largest circles (by radius), biggest first; the n = 0 term is the centre. */
export function strongest(coefs: Coef[], count: number): { centre: Pt; circles: Coef[] } {
  const zero = coefs.find((c) => c.n === 0)!;
  const rest = coefs.filter((c) => c.n !== 0).sort((a, b) => b.amp - a.amp || a.n - b.n);
  return { centre: [zero.re, zero.im], circles: rest.slice(0, count) };
}

/** z(t) from a centre and a list of circles. */
export function evalSeries(centre: Pt, circles: Coef[], t: number): Pt {
  let x = centre[0];
  let y = centre[1];
  for (const c of circles) {
    const a = 2 * Math.PI * c.n * t;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    x += c.re * cs - c.im * sn;
    y += c.re * sn + c.im * cs;
  }
  return [x, y];
}

/** Mean squared distance between samples and the series with the N strongest circles. */
export function meanSquareError(z: Pt[], coefs: Coef[], count: number): number {
  const { centre, circles } = strongest(coefs, count);
  let e = 0;
  for (let j = 0; j < z.length; j++) {
    const [x, y] = evalSeries(centre, circles, j / z.length);
    e += (x - z[j][0]) ** 2 + (y - z[j][1]) ** 2;
  }
  return e / z.length;
}

/* ---------- Ready-made contours (y axis up) ---------- */

const sampleFn = (f: (t: number) => Pt, n = 600): Pt[] => Array.from({ length: n }, (_, i) => f((2 * Math.PI * i) / n));

export interface Contour {
  id: string;
  name: string;
  points: () => Pt[];
}

export const contours: Contour[] = [
  {
    id: 'heart',
    name: 'Сердце',
    points: () => sampleFn((t) => [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]),
  },
  {
    id: 'star',
    name: 'Звезда',
    points: () =>
      Array.from({ length: 5 }, (_, i) => {
        const a = Math.PI / 2 + (2 * Math.PI * ((i * 2) % 5)) / 5;
        return [Math.cos(a), Math.sin(a)] as Pt;
      }),
  },
  {
    id: 'square',
    name: 'Квадрат',
    points: () => [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  {
    id: 'lemniscate',
    name: 'Восьмёрка',
    points: () => sampleFn((t) => [Math.cos(t) / (1 + Math.sin(t) ** 2), (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)]),
  },
  {
    id: 'rose',
    name: 'Цветок',
    // Rose r = cos 3θ is closed after θ ∈ [0, π] (three petals).
    points: () => Array.from({ length: 600 }, (_, i) => {
      const t = (Math.PI * i) / 600;
      return [Math.cos(3 * t) * Math.cos(t), Math.cos(3 * t) * Math.sin(t)] as Pt;
    }),
  },
];
