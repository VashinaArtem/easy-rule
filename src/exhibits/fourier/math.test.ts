import { describe, expect, it } from 'vitest';
import { contours, dft, evalSeries, meanSquareError, normalise, resample, SAMPLES, strongest, type Pt } from './math';

const circle = (n: number): Pt[] => Array.from({ length: n }, (_, i) => [Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n)]);

describe('resample', () => {
  it('spaces samples equally along the arc length of a square', () => {
    const z = resample(contours.find((c) => c.id === 'square')!.points(), 400);
    expect(z).toHaveLength(400);
    // Perimeter 8, so consecutive samples are 0.02 apart along each side.
    for (let j = 0; j < z.length; j++) {
      const a = z[j];
      const b = z[(j + 1) % z.length];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      expect(d).toBeLessThanOrEqual(0.02 + 1e-12);
      // Every sample lies on the boundary of the square.
      expect(Math.max(Math.abs(a[0]), Math.abs(a[1]))).toBeCloseTo(1, 12);
    }
  });

  it('survives repeated points and rejects a zero-length curve', () => {
    expect(resample([[0, 0], [0, 0], [0, 0]], 16)).toEqual([]);
    const z = resample([[0, 0], [0, 0], [1, 0], [1, 0], [1, 1]], 32);
    expect(z).toHaveLength(32);
    expect(z.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('normalises into the unit square', () => {
    const z = normalise([[10, 4], [30, 4], [30, 9], [10, 9]]);
    const xs = z.map((p) => p[0]);
    const ys = z.map((p) => p[1]);
    expect(Math.max(...xs)).toBeCloseTo(1, 12);
    expect(Math.min(...xs)).toBeCloseTo(-1, 12);
    expect(Math.max(...ys)).toBeCloseTo(0.25, 12);
  });
});

describe('DFT and epicycles', () => {
  it('turns a circle into a single circle', () => {
    const c = dft(circle(64));
    const one = c.find((k) => k.n === 1)!;
    expect(one.re).toBeCloseTo(1, 12);
    expect(one.im).toBeCloseTo(0, 12);
    for (const k of c) if (k.n !== 1) expect(k.amp).toBeLessThan(1e-12);
  });

  it('reconstructs every sample from all coefficients (< 1e-9)', () => {
    const z = resample(contours.find((c) => c.id === 'heart')!.points(), SAMPLES);
    const coefs = dft(z);
    const { centre, circles } = strongest(coefs, SAMPLES);
    let worst = 0;
    for (let j = 0; j < SAMPLES; j++) {
      const [x, y] = evalSeries(centre, circles, j / SAMPLES);
      worst = Math.max(worst, Math.hypot(x - z[j][0], y - z[j][1]));
    }
    expect(worst).toBeLessThan(1e-9);
  });

  it('satisfies Parseval: truncation error equals the omitted energy', () => {
    const z = resample(contours.find((c) => c.id === 'star')!.points(), SAMPLES);
    const coefs = dft(z);
    for (const N of [3, 10, 40, 120]) {
      const { circles } = strongest(coefs, N);
      const kept = new Set(circles.map((c) => c.n));
      const omitted = coefs.filter((c) => c.n !== 0 && !kept.has(c.n)).reduce((s, c) => s + c.amp * c.amp, 0);
      expect(meanSquareError(z, coefs, N)).toBeCloseTo(omitted, 10);
    }
  });

  it('improves monotonically as circles are added', () => {
    const z = resample(contours.find((c) => c.id === 'square')!.points(), SAMPLES);
    const coefs = dft(z);
    let prev = Infinity;
    for (let N = 1; N <= 200; N += 7) {
      const e = meanSquareError(z, coefs, N);
      expect(e).toBeLessThanOrEqual(prev + 1e-15);
      prev = e;
    }
  });

  it('keeps only frequencies n ≡ 1 (mod 4) for a square (4-fold rotation symmetry)', () => {
    // z(t + 1/4) = i·z(t) forces c_n·e^{2πi n/4} = i·c_n, so c_n = 0 unless n ≡ 1 (mod 4).
    const z = resample(contours.find((c) => c.id === 'square')!.points(), SAMPLES);
    for (const c of dft(z)) {
      if ((((c.n - 1) % 4) + 4) % 4 !== 0) expect(c.amp).toBeLessThan(1e-12);
    }
    expect(dft(z).find((c) => c.n === 1)!.amp).toBeGreaterThan(0.5);
  });

  it('describes a smooth curve with few circles', () => {
    const z = normalise(resample(contours.find((c) => c.id === 'heart')!.points(), SAMPLES));
    expect(meanSquareError(z, dft(z), 12)).toBeLessThan(2e-3);
  });

  it('has the three-fold rose built only from frequencies ≡ 1 (mod 3) or similar low orders', () => {
    const z = normalise(resample(contours.find((c) => c.id === 'rose')!.points(), SAMPLES));
    const { circles } = strongest(dft(z), 6);
    // A three-petal rose is z(t) ∝ e^{−2πi t} + e^{4πi t} combinations: dominant circles have small |n|.
    for (const c of circles.slice(0, 2)) expect(Math.abs(c.n)).toBeLessThanOrEqual(4);
  });
});
