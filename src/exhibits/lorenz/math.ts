export interface LorenzParams {
  sigma: number;
  rho: number;
  beta: number;
}

export const CLASSIC: LorenzParams = { sigma: 10, rho: 28, beta: 8 / 3 };

/** Below this ρ (for σ = 10, β = 8/3) the two off-origin equilibria are stable. */
export function hopfRho({ sigma, beta }: LorenzParams): number {
  return (sigma * (sigma + beta + 3)) / (sigma - beta - 1);
}

export function derivative(x: number, y: number, z: number, p: LorenzParams): [number, number, number] {
  return [p.sigma * (y - x), x * (p.rho - z) - y, x * y - p.beta * z];
}

/** Equilibria: the origin, and C± = (±√(β(ρ−1)), ±√(β(ρ−1)), ρ−1) when ρ > 1. */
export function fixedPoints(p: LorenzParams): [number, number, number][] {
  if (p.rho <= 1) return [[0, 0, 0]];
  const s = Math.sqrt(p.beta * (p.rho - 1));
  return [
    [0, 0, 0],
    [s, s, p.rho - 1],
    [-s, -s, p.rho - 1],
  ];
}

/**
 * Advances `count` packed xyz states in place by `steps` classical RK4 steps of
 * size dt. Written out by hand: it runs for thousands of particles per frame.
 */
export function rk4(state: Float64Array, count: number, dt: number, steps: number, p: LorenzParams) {
  const { sigma: s, rho: r, beta: b } = p;
  const h2 = dt / 2;
  const h6 = dt / 6;
  for (let i = 0; i < count; i++) {
    let x = state[i * 3];
    let y = state[i * 3 + 1];
    let z = state[i * 3 + 2];
    for (let k = 0; k < steps; k++) {
      const k1x = s * (y - x);
      const k1y = x * (r - z) - y;
      const k1z = x * y - b * z;
      let ax = x + h2 * k1x;
      let ay = y + h2 * k1y;
      let az = z + h2 * k1z;
      const k2x = s * (ay - ax);
      const k2y = ax * (r - az) - ay;
      const k2z = ax * ay - b * az;
      ax = x + h2 * k2x;
      ay = y + h2 * k2y;
      az = z + h2 * k2z;
      const k3x = s * (ay - ax);
      const k3y = ax * (r - az) - ay;
      const k3z = ax * ay - b * az;
      ax = x + dt * k3x;
      ay = y + dt * k3y;
      az = z + dt * k3z;
      const k4x = s * (ay - ax);
      const k4y = ax * (r - az) - ay;
      const k4z = ax * ay - b * az;
      x += h6 * (k1x + 2 * k2x + 2 * k3x + k4x);
      y += h6 * (k1y + 2 * k2y + 2 * k3y + k4y);
      z += h6 * (k1z + 2 * k2z + 2 * k3z + k4z);
    }
    state[i * 3] = x;
    state[i * 3 + 1] = y;
    state[i * 3 + 2] = z;
  }
}

/**
 * Largest Lyapunov exponent by the two-trajectory renormalisation method
 * (Benettin et al., 1976).
 */
export function lyapunov(p: LorenzParams, time = 200, dt = 0.005, d0 = 1e-8): number {
  const s = new Float64Array([1, 1, 1, 1 + d0, 1, 1]);
  rk4(s, 2, dt, Math.round(20 / dt), p); // settle onto the attractor
  s[3] = s[0] + d0;
  s[4] = s[1];
  s[5] = s[2];
  let sum = 0;
  const every = 20;
  const rounds = Math.round(time / dt / every);
  for (let k = 0; k < rounds; k++) {
    rk4(s, 2, dt, every, p);
    const dx = s[3] - s[0];
    const dy = s[4] - s[1];
    const dz = s[5] - s[2];
    const d = Math.hypot(dx, dy, dz);
    sum += Math.log(d / d0);
    s[3] = s[0] + (dx * d0) / d;
    s[4] = s[1] + (dy * d0) / d;
    s[5] = s[2] + (dz * d0) / d;
  }
  return sum / (rounds * every * dt);
}
