import { describe, expect, it } from 'vitest';
import { createField, F_RANGE, K_RANGE, laplacian, nontrivialEquilibria, presets, reaction, saddleNodeK, step } from './math';

describe('Gray–Scott model', () => {
  it('has a stencil that annihilates constants and sums to zero', () => {
    const w = 7;
    const h = 5;
    const c = new Float64Array(w * h).fill(0.37);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) expect(Math.abs(laplacian(c, w, h, x, y))).toBeLessThan(1e-15);
    // Sum of ∇² over a periodic grid is zero for any field.
    const f = Float64Array.from({ length: w * h }, (_, i) => Math.sin(i * 1.7) + (i % 3));
    let total = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) total += laplacian(f, w, h, x, y);
    expect(Math.abs(total)).toBeLessThan(1e-12);
  });

  it('is exactly stationary at u = 1, v = 0', () => {
    let f = createField(16, 16);
    for (let i = 0; i < 20; i++) f = step(f, 0.0367, 0.0649);
    expect(f.u.every((x) => x === 1)).toBe(true);
    expect(f.v.every((x) => x === 0)).toBe(true);
  });

  it('conserves total u when there is no reaction and no feed', () => {
    let f = createField(20, 12);
    for (let i = 0; i < f.u.length; i++) f.u[i] = 0.5 + 0.4 * Math.sin(i * 0.9);
    const before = f.u.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 30; i++) f = step(f, 0, 0);
    expect(f.u.reduce((a, b) => a + b, 0)).toBeCloseTo(before, 9);
  });

  it('finds the non-trivial equilibria exactly when F ≥ 4(F + k)²', () => {
    for (const [F, k] of [
      [0.04, 0.055],
      [0.06, 0.05],
      [0.025, 0.05],
    ]) {
      const eq = nontrivialEquilibria(F, k);
      expect(eq.length).toBe(2);
      for (const [u, v] of eq) {
        const [du, dv] = reaction(u, v, F, k);
        expect(Math.abs(du)).toBeLessThan(1e-12);
        expect(Math.abs(dv)).toBeLessThan(1e-12);
        expect(v).toBeGreaterThan(0);
        expect(u).toBeGreaterThan(0);
        expect(u).toBeLessThanOrEqual(1);
      }
    }
    // Above the saddle-node curve there are none.
    for (const F of [0.02, 0.04, 0.08]) {
      expect(nontrivialEquilibria(F, saddleNodeK(F) + 0.002)).toHaveLength(0);
      expect(nontrivialEquilibria(F, saddleNodeK(F) - 0.002)).toHaveLength(2);
    }
  });

  it('keeps all labelled presets inside the atlas', () => {
    for (const p of presets) {
      expect(p.F).toBeGreaterThanOrEqual(F_RANGE[0]);
      expect(p.F).toBeLessThanOrEqual(F_RANGE[1]);
      expect(p.k).toBeGreaterThanOrEqual(K_RANGE[0]);
      expect(p.k).toBeLessThanOrEqual(K_RANGE[1]);
    }
  });

  it.each([
    ['mitosis', 0.01, 0.05], // settles into isolated spots: small mean, strong contrast
    ['maze', 0.1, 0.08], // fills the field with stripes
  ])('grows a %s pattern from a seed and stays within [0, 1]', (id, minMean, minSd) => {
    const { F, k } = presets.find((p) => p.id === id)!;
    let f = createField(48, 48);
    for (let y = 21; y < 27; y++) {
      for (let x = 21; x < 27; x++) {
        f.u[y * 48 + x] = 0.5;
        f.v[y * 48 + x] = 1;
      }
    }
    for (let i = 0; i < 2500; i++) f = step(f, F, k);
    const mean = f.v.reduce((a, b) => a + b, 0) / f.v.length;
    const sd = Math.sqrt(f.v.reduce((a, b) => a + (b - mean) ** 2, 0) / f.v.length);
    expect(Math.min(...f.u)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...f.u)).toBeLessThanOrEqual(1);
    expect(Math.min(...f.v)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...f.v)).toBeLessThanOrEqual(1);
    expect(mean).toBeGreaterThan(minMean); // the seed has spread, not died out
    expect(sd).toBeGreaterThan(minSd); // and is a pattern, not a uniform film
  });

  it('lets the seed die out where only the trivial state exists', () => {
    const F = 0.04;
    const k = saddleNodeK(F) + 0.01;
    let f = createField(24, 24);
    for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) f.v[y * 24 + x] = 0.6;
    for (let i = 0; i < 3000; i++) f = step(f, F, k);
    expect(Math.max(...f.v)).toBeLessThan(1e-3);
  });
});
