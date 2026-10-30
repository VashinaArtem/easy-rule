/**
 * Hopf fibration S³ → S². A point of S³ ⊂ ℂ² is (z₁, z₂) with |z₁|² + |z₂|² = 1 and
 *   h(z₁, z₂) = (2 z₁ z̄₂ ∈ ℂ,  |z₁|² − |z₂|²) ∈ ℂ × ℝ ⊃ S².
 * The fibre over a point is a great circle {(e^{iα} z₁, e^{iα} z₂)}. We draw fibres in ℝ³
 * through stereographic projection from the point (0, 0, 0, 1) of S³, which maps circles
 * to circles (or to lines, for circles through the pole).
 */
export type V3 = [number, number, number];
export type V4 = [number, number, number, number];

/** Base point on S² given by colatitude η ∈ [0, π] and longitude λ. */
export function basePoint(eta: number, lambda: number): V3 {
  return [Math.sin(eta) * Math.cos(lambda), Math.sin(eta) * Math.sin(lambda), Math.cos(eta)];
}

export function toAngles(p: V3): { eta: number; lambda: number } {
  return { eta: Math.acos(Math.max(-1, Math.min(1, p[2]))), lambda: Math.atan2(p[1], p[0]) };
}

/** The Hopf map h(z₁, z₂) for a point (Re z₁, Im z₁, Re z₂, Im z₂) of S³. */
export function hopf(v: V4): V3 {
  const [a, b, c, d] = v;
  // 2 z₁ z̄₂ = 2 (a + ib)(c − id)
  return [2 * (a * c + b * d), 2 * (b * c - a * d), a * a + b * b - c * c - d * d];
}

/**
 * Point of the fibre over `p` at parameter t. With p = (sin η cos λ, sin η sin λ, cos η):
 * z₁ = cos(η/2) e^{it},  z₂ = sin(η/2) e^{i(t − λ)}, so that 2 z₁ z̄₂ = sin η e^{iλ}.
 */
export function fibrePoint(eta: number, lambda: number, t: number): V4 {
  const c = Math.cos(eta / 2);
  const s = Math.sin(eta / 2);
  return [c * Math.cos(t), c * Math.sin(t), s * Math.cos(t - lambda), s * Math.sin(t - lambda)];
}

/** Rotation of ℝ⁴ in the (x₁, x₄) plane by ω; an isometry of S³ that moves the projection pole. */
export function rotate14(v: V4, omega: number): V4 {
  const c = Math.cos(omega);
  const s = Math.sin(omega);
  return [c * v[0] - s * v[3], v[1], v[2], s * v[0] + c * v[3]];
}

/** Stereographic projection from (0, 0, 0, 1): (a, b, c, d) ↦ (a, b, c) / (1 − d). */
export function stereographic(v: V4): V3 {
  const k = 1 / (1 - v[3]);
  return [v[0] * k, v[1] * k, v[2] * k];
}

/** n nearly equally spaced points on S² (Fibonacci lattice). */
export function fibonacciSphere(n: number): V3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const z = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(golden * i), r * Math.sin(golden * i), z] as V3;
  });
}

/**
 * Gauss linking integral Lk = (1/4π) ∮∮ (r₁ − r₂)·(dr₁ × dr₂) / |r₁ − r₂|³ for two closed
 * polygons, evaluated by the midpoint rule on their edges.
 */
export function linkingNumber(A: V3[], B: V3[]): number {
  let sum = 0;
  for (let i = 0; i < A.length; i++) {
    const a0 = A[i];
    const a1 = A[(i + 1) % A.length];
    const da = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
    const am = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2, (a0[2] + a1[2]) / 2];
    for (let j = 0; j < B.length; j++) {
      const b0 = B[j];
      const b1 = B[(j + 1) % B.length];
      const db = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
      const r = [am[0] - (b0[0] + b1[0]) / 2, am[1] - (b0[1] + b1[1]) / 2, am[2] - (b0[2] + b1[2]) / 2];
      const cx = da[1] * db[2] - da[2] * db[1];
      const cy = da[2] * db[0] - da[0] * db[2];
      const cz = da[0] * db[1] - da[1] * db[0];
      const d = Math.hypot(r[0], r[1], r[2]);
      sum += (r[0] * cx + r[1] * cy + r[2] * cz) / (d * d * d);
    }
  }
  return sum / (4 * Math.PI);
}

/** A closed fibre as a polygon in ℝ³ (after an optional 4D rotation). */
export function fibreCurve(eta: number, lambda: number, segments: number, omega = 0): V3[] {
  return Array.from({ length: segments }, (_, i) => stereographic(rotate14(fibrePoint(eta, lambda, (2 * Math.PI * i) / segments), omega)));
}

/** Points with |p| beyond this are dropped: they belong to curves running off to infinity. */
export const CLIP_RADIUS = 6;
