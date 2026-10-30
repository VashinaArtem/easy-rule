import { describe, expect, it } from 'vitest';
import { CLASSIC, derivative, fixedPoints, hopfRho, lyapunov, rk4 } from './math';

describe('Lorenz system', () => {
  it('has derivative zero at its equilibria', () => {
    for (const p of [CLASSIC, { ...CLASSIC, rho: 15 }, { ...CLASSIC, rho: 0.5 }]) {
      for (const [x, y, z] of fixedPoints(p)) {
        for (const v of derivative(x, y, z, p)) expect(Math.abs(v)).toBeLessThan(1e-12);
      }
    }
  });

  it('keeps RK4 at its equilibria', () => {
    const [, c] = fixedPoints(CLASSIC);
    const s = new Float64Array(c);
    rk4(s, 1, 0.01, 200, CLASSIC);
    expect(Math.hypot(s[0] - c[0], s[1] - c[1], s[2] - c[2])).toBeLessThan(1e-9);
  });

  it('integrates with fourth-order accuracy', () => {
    const run = (dt: number) => {
      const s = new Float64Array([1, 2, 20]);
      rk4(s, 1, dt, Math.round(0.5 / dt), CLASSIC);
      return s;
    };
    const ref = run(0.0001);
    const err = (dt: number) => {
      const s = run(dt);
      return Math.hypot(s[0] - ref[0], s[1] - ref[1], s[2] - ref[2]);
    };
    const ratio = err(0.004) / err(0.002);
    expect(ratio).toBeGreaterThan(12);
    expect(ratio).toBeLessThan(20);
  });

  it('stays inside the known bounding region on the attractor', () => {
    const s = new Float64Array([0.1, 0, 0]);
    for (let i = 0; i < 4000; i++) {
      rk4(s, 1, 0.005, 2, CLASSIC);
      if (i > 200) {
        expect(Math.abs(s[0])).toBeLessThan(25);
        expect(Math.abs(s[1])).toBeLessThan(30);
        expect(s[2]).toBeGreaterThan(0);
        expect(s[2]).toBeLessThan(55);
      }
    }
  });

  it('has a positive Lyapunov exponent near 0.906 for the classic parameters', () => {
    const l = lyapunov(CLASSIC, 300);
    expect(l).toBeGreaterThan(0.8);
    expect(l).toBeLessThan(1.0);
  });

  it('separates two starts 1e-5 apart to the size of the attractor', () => {
    const s = new Float64Array([1, 1, 1, 1 + 1e-5, 1, 1]);
    let maxD = 0;
    for (let i = 0; i < 4000; i++) {
      rk4(s, 2, 0.005, 2, CLASSIC);
      maxD = Math.max(maxD, Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]));
    }
    expect(maxD).toBeGreaterThan(10);
  });

  it('settles to C± below the Hopf value of ρ and to the origin for ρ < 1', () => {
    expect(hopfRho(CLASSIC)).toBeCloseTo(24.7368, 3);
    const p = { ...CLASSIC, rho: 15 };
    const s = new Float64Array([1, 1, 1]);
    rk4(s, 1, 0.005, 20000, p);
    const [, a, b] = fixedPoints(p);
    const d = Math.min(Math.hypot(s[0] - a[0], s[1] - a[1], s[2] - a[2]), Math.hypot(s[0] - b[0], s[1] - b[1], s[2] - b[2]));
    expect(d).toBeLessThan(1e-3);

    const q = new Float64Array([3, -2, 5]);
    rk4(q, 1, 0.005, 20000, { ...CLASSIC, rho: 0.5 });
    expect(Math.hypot(q[0], q[1], q[2])).toBeLessThan(1e-3);
  });
});
