import { describe, expect, it } from 'vitest';
import { mandelbrot } from '../escape-time/math';
import { cardioid, juliaPresets } from './presets';

describe('Julia presets', () => {
  it('are labelled connected exactly when c lies in the Mandelbrot set', () => {
    for (const p of juliaPresets) {
      expect(!mandelbrot(p.c[0], p.c[1], 5000).escaped, p.name).toBe(p.connected);
    }
  });

  it('walk along the boundary of the main cardioid', () => {
    for (let i = 0; i < 64; i++) {
      const [x, y] = cardioid((i / 64) * 2 * Math.PI);
      // Boundary of the cardioid: the fixed point has multiplier |2z| = 1, z = e^{iθ}/2.
      const x4 = x - 0.25;
      const q = x4 * x4 + y * y;
      expect(q * (q + x4)).toBeCloseTo(0.25 * y * y, 10);
    }
  });
});
