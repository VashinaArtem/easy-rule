import { describe, expect, it } from 'vitest';
import { chords, envelope, envelopeCurve, targetIndex } from './math';

describe('times-table circle', () => {
  it('draws n chords, one per point', () => {
    for (const n of [2, 50, 360]) expect(chords(n, 2.5)).toHaveLength(n);
  });

  it('joins vertex i to vertex (k·i mod n) for integer k', () => {
    const n = 97;
    for (const k of [2, 3, 7, 33]) {
      const cs = chords(n, k);
      for (let i = 0; i < n; i++) {
        const j = targetIndex(i, k, n);
        const t = (2 * Math.PI * j) / n;
        expect(cs[i].b[0]).toBeCloseTo(Math.cos(t), 10);
        expect(cs[i].b[1]).toBeCloseTo(Math.sin(t), 10);
      }
    }
  });

  it('maps k = 1 to degenerate chords and k = n to a fan from vertex 0', () => {
    for (const c of chords(30, 1)) expect(Math.hypot(c.a[0] - c.b[0], c.a[1] - c.b[1])).toBeLessThan(1e-12);
    for (const c of chords(30, 30)) expect(Math.hypot(c.b[0] - 1, c.b[1])).toBeLessThan(1e-9);
  });
});

describe('envelope of the chords', () => {
  const lineResidual = (k: number, theta: number) => {
    const [x, y] = envelope(k, theta);
    const a = theta;
    const b = k * theta;
    // The point must lie on the chord line x cos((a+b)/2) + y sin((a+b)/2) = cos((a−b)/2).
    return x * Math.cos((a + b) / 2) + y * Math.sin((a + b) / 2) - Math.cos((a - b) / 2);
  };

  it('lies on every chord (including fractional k)', () => {
    for (const k of [2, 3, 4.5, 2.37, 7]) {
      for (let i = 1; i < 200; i++) expect(Math.abs(lineResidual(k, (2 * Math.PI * i) / 200))).toBeLessThan(1e-12);
    }
  });

  it('is tangent to the chord: the envelope condition holds', () => {
    // Tangent direction of the envelope is parallel to the chord direction.
    for (const k of [2, 3, 5.5]) {
      for (let i = 1; i < 60; i++) {
        const t = (2 * Math.PI * i) / 61 + 0.01;
        const h = 1e-6;
        const p = envelope(k, t - h);
        const q = envelope(k, t + h);
        const tx = q[0] - p[0];
        const ty = q[1] - p[1];
        const cx = Math.cos(k * t) - Math.cos(t);
        const cy = Math.sin(k * t) - Math.sin(t);
        const cross = (tx * cy - ty * cx) / (Math.hypot(tx, ty) * Math.hypot(cx, cy));
        expect(Math.abs(cross)).toBeLessThan(1e-4);
      }
    }
  });

  it('is the cardioid r = (2/3)(1 + cos φ) around its cusp (−1/3, 0) for k = 2', () => {
    // It touches the unit circle at (1, 0); the cusp lies at distance 4/3 on the other side.
    for (const [x, y] of envelopeCurve(2, 400)) {
      const px = x + 1 / 3;
      const r = Math.hypot(px, y);
      if (r < 1e-9) continue; // the cusp itself has no direction
      const phi = Math.atan2(y, px);
      expect(r).toBeCloseTo((2 / 3) * (1 + Math.cos(phi)), 9);
    }
  });

  it('has k − 1 cusps for integer k', () => {
    for (const k of [2, 3, 4, 5, 6]) {
      const N = 20000;
      const pts = envelopeCurve(k, N);
      const speed = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
      const max = Math.max(...speed);
      let cusps = 0;
      for (let i = 0; i < N; i++) {
        const p = speed[(i + N - 1) % N];
        const c = speed[i];
        const n = speed[(i + 1) % N];
        if (c < p && c <= n && c < 0.02 * max) cusps++;
      }
      expect(cusps).toBe(k - 1);
    }
  });
});
