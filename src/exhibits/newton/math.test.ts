import { describe, expect, it } from 'vitest';
import { evalPoly, newtonStep, rootsOfUnity, solve, type C } from './math';

const cube = rootsOfUnity(3);

describe('Newton fractal', () => {
  it('builds a polynomial that vanishes at its roots', () => {
    const roots: C[] = [
      [0.3, -0.2],
      [-1, 0.5],
      [0.7, 0.9],
      [0, -1.1],
    ];
    for (const r of roots) {
      const [px, py] = evalPoly(r, roots);
      expect(Math.hypot(px, py)).toBeLessThan(1e-12);
    }
  });

  it('takes the same step as z − p(z)/p′(z) with a numerical derivative', () => {
    const roots: C[] = [
      [0.3, -0.2],
      [-1, 0.5],
      [0.7, 0.9],
    ];
    const z: C = [0.11, 0.42];
    const h = 1e-6;
    const p = evalPoly(z, roots);
    const p1 = evalPoly([z[0] + h, z[1]], roots);
    const dp: C = [(p1[0] - p[0]) / h, (p1[1] - p[1]) / h]; // holomorphic: d/dx = d/dz
    const d2 = dp[0] * dp[0] + dp[1] * dp[1];
    const ratio: C = [(p[0] * dp[0] + p[1] * dp[1]) / d2, (p[1] * dp[0] - p[0] * dp[1]) / d2];
    const step = newtonStep(z, roots, 1);
    expect(step[0]).toBeCloseTo(z[0] - ratio[0], 5);
    expect(step[1]).toBeCloseTo(z[1] - ratio[1], 5);
  });

  it('converges to the nearby root from its neighbourhood', () => {
    cube.forEach((r, i) => {
      const res = solve([r[0] + 0.05, r[1] - 0.04], cube, 1);
      expect(res.root).toBe(i);
      expect(res.n).toBeLessThan(6);
    });
  });

  it('sends the positive real axis to z = 1 for z³ − 1', () => {
    for (const x of [0.2, 0.9, 3, 50]) expect(solve([x, 0], cube, 1).root).toBe(0);
  });

  it('has basins with the 3-fold symmetry of z³ − 1', () => {
    const rot = (z: C, k: number): C => {
      const t = (2 * Math.PI * k) / 3;
      return [z[0] * Math.cos(t) - z[1] * Math.sin(t), z[0] * Math.sin(t) + z[1] * Math.cos(t)];
    };
    for (const z of [
      [-0.5, 0.3],
      [0.1, -0.9],
      [-1.3, -0.02],
    ] as C[]) {
      const base = solve(z, cube, 1).root;
      if (base < 0) continue;
      expect(solve(rot(z, 1), cube, 1).root).toBe((base + 1) % 3);
      expect(solve(rot(z, 2), cube, 1).root).toBe((base + 2) % 3);
    }
  });
});
