export type C = [number, number];

export const MAX_ROOTS = 6;
export const CONVERGED = 1e-3;

/**
 * For p(z) = Π (z − rᵢ), Newton's step is z − a·p/p′, and p′/p = Σ 1/(z − rᵢ),
 * so the step needs no polynomial coefficients at all.
 */
export function newtonStep(z: C, roots: C[], a: number): C {
  let sx = 0;
  let sy = 0;
  for (const [rx, ry] of roots) {
    const dx = z[0] - rx;
    const dy = z[1] - ry;
    const d2 = dx * dx + dy * dy;
    sx += dx / d2;
    sy -= dy / d2;
  }
  const s2 = sx * sx + sy * sy;
  // a / s
  return [z[0] - (a * sx) / s2, z[1] + (a * sy) / s2];
}

export interface NewtonResult {
  root: number; // −1 if no convergence
  n: number;
}

export function solve(z0: C, roots: C[], a: number, maxIter = 200): NewtonResult {
  let z = z0;
  for (let n = 0; n < maxIter; n++) {
    for (let i = 0; i < roots.length; i++) {
      if (Math.hypot(z[0] - roots[i][0], z[1] - roots[i][1]) < CONVERGED) return { root: i, n };
    }
    z = newtonStep(z, roots, a);
    if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) break;
  }
  return { root: -1, n: maxIter };
}

/** Evaluates p(z) = Π (z − rᵢ). */
export function evalPoly(z: C, roots: C[]): C {
  let px = 1;
  let py = 0;
  for (const [rx, ry] of roots) {
    const dx = z[0] - rx;
    const dy = z[1] - ry;
    [px, py] = [px * dx - py * dy, px * dy + py * dx];
  }
  return [px, py];
}

export function rootsOfUnity(n: number, radius = 1, phase = 0): C[] {
  return Array.from({ length: n }, (_, k) => {
    const t = phase + (2 * Math.PI * k) / n;
    return [radius * Math.cos(t), radius * Math.sin(t)] as C;
  });
}
