import { describe, expect, it } from 'vitest';
import { autoIterations, distanceEstimate, inMainBodies, julia, mandelbrot, smoothIteration } from './math';
import { dfAdd, dfMul, dfSplitDouble, dfToNumber } from '../../gl/df64';

describe('Mandelbrot iteration', () => {
  it('keeps known members bounded', () => {
    for (const [x, y] of [
      [0, 0],
      [-1, 0],
      [-2, 0], // boundary point: orbit 0, −2, 2, 2, … stays bounded
      [0.25, 0], // cusp of the cardioid
      [0, 1], // orbit 0, i, −1+i, −i, −1+i, … (pre-periodic)
      [-0.1225, 0.7448], // inside the period-3 "rabbit" bulb
    ]) {
      expect(mandelbrot(x, y, 2000).escaped, `${x}+${y}i`).toBe(false);
    }
  });

  it('lets outside points escape', () => {
    for (const [x, y] of [
      [1, 0],
      [0.5, 0],
      [0.26, 0],
      [-2.01, 0],
      [0, 1.1],
    ]) {
      expect(mandelbrot(x, y, 2000).escaped, `${x}+${y}i`).toBe(true);
    }
  });

  it('agrees with the closed-form cardioid and period-2 bulb tests', () => {
    let checked = 0;
    for (let i = 0; i < 4000; i++) {
      const x = -2 + ((i * 0.618034) % 1) * 2.5;
      const y = -1.2 + ((i * 0.414214) % 1) * 2.4;
      if (inMainBodies(x, y)) {
        expect(mandelbrot(x, y, 3000).escaped).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('is symmetric under complex conjugation', () => {
    for (const [x, y] of [
      [-0.75, 0.1],
      [0.3, 0.5],
      [-1.4, 0.02],
    ]) {
      const a = mandelbrot(x, y, 500);
      const b = mandelbrot(x, -y, 500);
      expect(a.n).toBe(b.n);
    }
  });
});

describe('smooth colouring and distance estimate', () => {
  it('is continuous across iteration bands', () => {
    // Find points where the integer escape count changes and check that ν
    // agrees on both sides of the jump.
    const at = (t: number) => mandelbrot(-2.2 + 1.5 * t, 1.1 - 0.95 * t, 1000);
    let boundaries = 0;
    for (let i = 0; i < 300; i++) {
      let a = i / 300;
      let b = (i + 1) / 300;
      const oa = at(a);
      const ob = at(b);
      if (!oa.escaped || !ob.escaped || oa.n === ob.n) continue;
      for (let k = 0; k < 50; k++) {
        const m = (a + b) / 2;
        if (at(m).n === oa.n) a = m;
        else b = m;
      }
      expect(Math.abs(smoothIteration(at(a)) - smoothIteration(at(b)))).toBeLessThan(2e-3);
      boundaries++;
    }
    expect(boundaries).toBeGreaterThan(3);
  });

  it('agrees with the Koebe bounds on the true distance', () => {
    // Left of −2 the nearest point of M is exactly −2 (M lies in |c| ≤ 2).
    for (const x of [-2.02, -2.1, -2.5, -3]) {
      const est = distanceEstimate(mandelbrot(x, 0, 5000));
      const truth = -2 - x;
      // For small Green's potential, est/2 ≲ dist ≲ 2·est.
      expect(truth).toBeGreaterThan(est * 0.45);
      expect(truth).toBeLessThan(est * 2.05);
    }
  });

  it('increases the iteration budget with depth', () => {
    expect(autoIterations(1e-6, 1)).toBeGreaterThan(autoIterations(1e-2, 1));
    expect(autoIterations(1e-12, 4)).toBeLessThanOrEqual(8000);
  });
});

describe('Julia iteration', () => {
  it('for c = 0 is the unit circle', () => {
    expect(julia(0.99, 0, 0, 0, 3000).escaped).toBe(false);
    expect(julia(0, -0.7, 0, 0, 3000).escaped).toBe(false);
    expect(julia(1.01, 0, 0, 0, 3000).escaped).toBe(true);
    expect(julia(0.8, 0.8, 0, 0, 3000).escaped).toBe(true); // |z| ≈ 1.13
  });

  it('is symmetric under z → −z', () => {
    const c: [number, number] = [-0.8, 0.156];
    for (const [x, y] of [
      [0.3, 0.2],
      [-0.9, 0.05],
    ]) {
      expect(julia(x, y, ...c, 800).n).toBe(julia(-x, -y, ...c, 800).n);
    }
  });
});

describe('df64 arithmetic (float32 emulation of the shader code)', () => {
  const rel = (got: number, want: number) => Math.abs(got - want) / Math.abs(want);

  it('represents doubles to ~46 bits', () => {
    for (const x of [Math.PI, -0.743643887037158, 1 / 3, 1e-7 + 0.1318259042053]) {
      expect(rel(dfToNumber(dfSplitDouble(x)), x)).toBeLessThan(2 ** -45);
    }
  });

  it('adds and multiplies far beyond float32 precision', () => {
    const cases = [
      [Math.PI, Math.E],
      [-0.743643887037158, 0.131825904205312],
      [1 / 3, -0.7432192837491],
      [1.000000123456789, 0.999999876543211],
    ];
    for (const [a, b] of cases) {
      const A = dfSplitDouble(a);
      const B = dfSplitDouble(b);
      // Reference: exact double arithmetic on the df64 inputs themselves.
      const exactA = dfToNumber(A);
      const exactB = dfToNumber(B);
      expect(rel(dfToNumber(dfMul(A, B)), exactA * exactB)).toBeLessThan(2 ** -44);
      expect(rel(dfToNumber(dfAdd(A, B)), exactA + exactB)).toBeLessThan(2 ** -44);
    }
  });

  it('resolves neighbouring pixels at 1e-9 zoom where float32 cannot', () => {
    const cx = -0.743643887037158;
    const pixel = 1.2e-9 / 450;
    const a = dfAdd(dfSplitDouble(cx), [Math.fround(pixel), 0]);
    const b = dfAdd(dfSplitDouble(cx), [Math.fround(2 * pixel), 0]);
    expect(Math.abs(dfToNumber(b) - dfToNumber(a) - pixel) / pixel).toBeLessThan(0.05);
    expect(Math.fround(cx + pixel)).toBe(Math.fround(cx + 2 * pixel));
  });
});
