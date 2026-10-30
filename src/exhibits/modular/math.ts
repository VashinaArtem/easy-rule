/**
 * Times-table circle. Put n points at angles θᵢ = 2πi/n and join each to the point
 * at angle k·θᵢ. For integer k the target is the vertex number (k·i mod n).
 * The chords have a smooth envelope: an epicycloid with k − 1 cusps
 * (cardioid k = 2, nephroid k = 3, …).
 */
export type Pt = [number, number];

export interface Chord {
  a: Pt;
  b: Pt;
}

export function chords(n: number, k: number): Chord[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return { a: [Math.cos(t), Math.sin(t)], b: [Math.cos(k * t), Math.sin(k * t)] } as Chord;
  });
}

/** Index of the vertex that vertex i connects to, for integer k. */
export function targetIndex(i: number, k: number, n: number): number {
  return (((k * i) % n) + n) % n;
}

/**
 * Envelope of the family of chords [e^{iθ}, e^{ikθ}]. A chord between angles a and b
 * is the line x cos((a+b)/2) + y sin((a+b)/2) = cos((a−b)/2); with a = θ, b = kθ
 * this is x cos mθ + y sin mθ = cos dθ, where m = (k+1)/2 and d = (k−1)/2.
 * Differentiating in θ and solving the two equations gives the envelope point.
 */
export function envelope(k: number, theta: number): Pt {
  const m = (k + 1) / 2;
  const d = (k - 1) / 2;
  const A = Math.cos(d * theta);
  const B = (d / m) * Math.sin(d * theta);
  return [A * Math.cos(m * theta) + B * Math.sin(m * theta), A * Math.sin(m * theta) - B * Math.cos(m * theta)];
}

/** Samples the envelope over one full period of θ ∈ [0, 2π) (closed for integer k ≥ 2). */
export function envelopeCurve(k: number, samples = 720): Pt[] {
  return Array.from({ length: samples + 1 }, (_, i) => envelope(k, (2 * Math.PI * i) / samples));
}

export const famous: { k: number; name: string }[] = [
  { k: 2, name: 'Кардиоида' },
  { k: 3, name: 'Нефроида' },
  { k: 4, name: 'Три острия' },
  { k: 5, name: 'Четыре острия' },
  { k: 7, name: 'Шесть остриев' },
];
