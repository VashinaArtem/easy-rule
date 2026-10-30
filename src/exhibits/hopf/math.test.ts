import { describe, expect, it } from 'vitest';
import { basePoint, fibonacciSphere, fibreCurve, fibrePoint, hopf, linkingNumber, rotate14, stereographic, toAngles, type V3, type V4 } from './math';

const norm4 = (v: V4) => Math.hypot(...v);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe('Hopf map', () => {
  it('sends every fibre point back to its base point on S²', () => {
    for (const [eta, lambda] of [
      [0.3, 0.2],
      [Math.PI / 2, 1.7],
      [2.4, -2.9],
      [0, 0],
      [Math.PI, 1],
    ]) {
      const p = basePoint(eta, lambda);
      for (let i = 0; i < 40; i++) {
        const v = fibrePoint(eta, lambda, (2 * Math.PI * i) / 40);
        expect(norm4(v)).toBeCloseTo(1, 12);
        const h = hopf(v);
        expect(Math.hypot(h[0] - p[0], h[1] - p[1], h[2] - p[2])).toBeLessThan(1e-12);
      }
    }
  });

  it('is constant on fibres: h(e^{iα} z) = h(z)', () => {
    const z: V4 = [0.5, -0.5, 0.5, 0.5];
    const a = 1.234;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const w: V4 = [c * z[0] - s * z[1], s * z[0] + c * z[1], c * z[2] - s * z[3], s * z[2] + c * z[3]];
    const h1 = hopf(z);
    const h2 = hopf(w);
    for (let i = 0; i < 3; i++) expect(h1[i]).toBeCloseTo(h2[i], 12);
  });

  it('lands on the unit sphere', () => {
    const rng = (i: number) => Math.sin(i * 12.9898) * 43758.5453 - Math.floor(Math.sin(i * 12.9898) * 43758.5453);
    for (let i = 0; i < 50; i++) {
      const v: V4 = [rng(i) - 0.5, rng(i + 100) - 0.5, rng(i + 200) - 0.5, rng(i + 300) - 0.5];
      const n = norm4(v);
      const u = v.map((x) => x / n) as V4;
      expect(Math.hypot(...hopf(u))).toBeCloseTo(1, 12);
    }
  });

  it('round-trips base point angles', () => {
    const { eta, lambda } = toAngles(basePoint(1.1, -0.7));
    expect(eta).toBeCloseTo(1.1, 12);
    expect(lambda).toBeCloseTo(-0.7, 12);
  });
});

describe('stereographic fibres', () => {
  it('are circles in ℝ³: coplanar and equidistant from a centre', () => {
    for (const [eta, lambda] of [
      [1.0, 0.4],
      [Math.PI / 2, 2.0],
      [2.2, -1.1],
    ]) {
      const c = fibreCurve(eta, lambda, 200);
      // Circumcentre of the first, a quarter and a half-way point.
      const [P, Q, R] = [c[0], c[50], c[100]];
      const a = sub(Q, P);
      const b = sub(R, P);
      const axb: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const k = axb[0] ** 2 + axb[1] ** 2 + axb[2] ** 2;
      const aa = a[0] ** 2 + a[1] ** 2 + a[2] ** 2;
      const bb = b[0] ** 2 + b[1] ** 2 + b[2] ** 2;
      // centre = P + ((|a|²b − |b|²a) × (a × b)) / (2 |a × b|²)
      const t: V3 = [aa * b[0] - bb * a[0], aa * b[1] - bb * a[1], aa * b[2] - bb * a[2]];
      const cr: V3 = [t[1] * axb[2] - t[2] * axb[1], t[2] * axb[0] - t[0] * axb[2], t[0] * axb[1] - t[1] * axb[0]];
      const centre: V3 = [P[0] + cr[0] / (2 * k), P[1] + cr[1] / (2 * k), P[2] + cr[2] / (2 * k)];
      const radius = Math.hypot(...sub(P, centre));
      const n = Math.sqrt(k);
      for (const p of c) {
        expect(Math.hypot(...sub(p, centre))).toBeCloseTo(radius, 8);
        const d = sub(p, centre);
        expect(Math.abs((d[0] * axb[0] + d[1] * axb[1] + d[2] * axb[2]) / n)).toBeLessThan(1e-8);
      }
    }
  });

  it('turns the fibre over the north pole into the unit circle in the plane d = 0', () => {
    for (const p of fibreCurve(0, 0, 64)) {
      expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 12);
      expect(p[2]).toBeCloseTo(0, 12);
    }
  });

  it('sends the pole of projection to infinity', () => {
    const p = stereographic([0.001, 0, 0, Math.sqrt(1 - 1e-6)]);
    expect(Math.hypot(...p)).toBeGreaterThan(1e3 * 0.9);
  });
});

describe('linking of fibres', () => {
  const lk = (a: [number, number], b: [number, number], omega = 0) => linkingNumber(fibreCurve(a[0], a[1], 360, omega), fibreCurve(b[0], b[1], 360, omega));

  it('links every pair of distinct fibres exactly once, with one common sign', () => {
    const pairs: [[number, number], [number, number]][] = [
      [[Math.PI / 2, 0], [Math.PI / 2, Math.PI]],
      [[Math.PI / 2, 0], [Math.PI / 2, 1]],
      [[1.0, 0.3], [2.1, -2.0]],
      [[0.7, 1.0], [1.4, 1.2]],
    ];
    const values = pairs.map(([a, b]) => lk(a, b));
    for (const v of values) expect(Math.abs(Math.abs(v) - 1)).toBeLessThan(2e-3);
    for (const v of values) expect(Math.sign(v)).toBe(Math.sign(values[0]));
  });

  it('gives zero for two circles that are not linked', () => {
    const circle = (cx: number, n = 300): V3[] => Array.from({ length: n }, (_, i) => [cx + Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n), 0]);
    expect(Math.abs(linkingNumber(circle(0), circle(3)))).toBeLessThan(1e-9);
    // Two rings threaded like a chain link: ±1.
    const ring2: V3[] = Array.from({ length: 300 }, (_, i) => [1 + Math.cos((2 * Math.PI * i) / 300), 0, Math.sin((2 * Math.PI * i) / 300)]);
    expect(Math.abs(Math.abs(linkingNumber(circle(0), ring2)) - 1)).toBeLessThan(1e-3);
  });

  it('is unchanged by a rotation of S³ in the 1–4 plane', () => {
    const a: [number, number] = [1.0, 0.3];
    const b: [number, number] = [2.0, -1.0];
    const base = lk(a, b);
    for (const w of [0.3, 0.9]) expect(lk(a, b, w)).toBeCloseTo(base, 2);
  });

  it('keeps rotation an isometry of S³', () => {
    const v = fibrePoint(1.2, 0.5, 0.9);
    expect(norm4(rotate14(v, 1.1))).toBeCloseTo(1, 12);
  });
});

describe('Fibonacci sphere', () => {
  it('gives unit vectors spread over the whole sphere', () => {
    const pts = fibonacciSphere(200);
    for (const p of pts) expect(Math.hypot(...p)).toBeCloseTo(1, 12);
    const mean = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
    expect(Math.hypot(...mean) / pts.length).toBeLessThan(0.01);
  });
});
