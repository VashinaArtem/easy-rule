/**
 * "Double-float" arithmetic: a number is stored as an unevaluated sum hi + lo of
 * two float32 values, giving ~46 bits of mantissa on GPUs that only have
 * float32. Algorithms after Dekker (1971) and Thall (2006).
 *
 * `u_one` is a uniform equal to 1.0. Multiplying by it stops shader compilers
 * from algebraically simplifying (s - a) - b style error terms to zero.
 */
export const DF64_GLSL = /* glsl */ `
uniform float u_one;

vec2 quickTwoSum(float a, float b) {
  float s = (a + b) * u_one;
  float e = b - (s - a) * u_one;
  return vec2(s, e);
}

vec2 twoSum(float a, float b) {
  float s = (a + b) * u_one;
  float v = (s - a) * u_one;
  float e = (a - (s - v) * u_one) + (b - v);
  return vec2(s, e);
}

vec2 splitF(float a) {
  float t = (4097.0 * a) * u_one;
  float hi = t - (t - a) * u_one;
  return vec2(hi, a - hi);
}

vec2 twoProd(float a, float b) {
  float p = (a * b) * u_one;
  vec2 A = splitF(a);
  vec2 B = splitF(b);
  float err = ((A.x * B.x - p) + A.x * B.y + A.y * B.x) + A.y * B.y;
  return vec2(p, err);
}

vec2 dfAdd(vec2 a, vec2 b) {
  vec2 s = twoSum(a.x, b.x);
  vec2 t = twoSum(a.y, b.y);
  s.y += t.x;
  s = quickTwoSum(s.x, s.y);
  s.y += t.y;
  return quickTwoSum(s.x, s.y);
}

vec2 dfMul(vec2 a, vec2 b) {
  vec2 p = twoProd(a.x, b.x);
  p.y += a.x * b.y + a.y * b.x;
  return quickTwoSum(p.x, p.y);
}
`;

/* ---------- JavaScript reference: identical algorithm in emulated float32 ---------- */

const f = Math.fround;
export type DF = [number, number];

export function dfSplitDouble(x: number): DF {
  const hi = f(x);
  return [hi, f(x - hi)];
}

export function dfToNumber(a: DF): number {
  return a[0] + a[1];
}

function quickTwoSum(a: number, b: number): DF {
  const s = f(a + b);
  const e = f(b - f(s - a));
  return [s, e];
}

function twoSum(a: number, b: number): DF {
  const s = f(a + b);
  const v = f(s - a);
  const e = f(f(a - f(s - v)) + f(b - v));
  return [s, e];
}

function splitF(a: number): DF {
  const t = f(4097 * a);
  const hi = f(t - f(t - a));
  return [hi, f(a - hi)];
}

function twoProd(a: number, b: number): DF {
  const p = f(a * b);
  const [ah, al] = splitF(a);
  const [bh, bl] = splitF(b);
  const err = f(f(f(f(f(ah * bh) - p) + f(ah * bl)) + f(al * bh)) + f(al * bl));
  return [p, err];
}

export function dfAdd(a: DF, b: DF): DF {
  const s = twoSum(a[0], b[0]);
  const t = twoSum(a[1], b[1]);
  s[1] = f(s[1] + t[0]);
  const q = quickTwoSum(s[0], s[1]);
  q[1] = f(q[1] + t[1]);
  return quickTwoSum(q[0], q[1]);
}

export function dfMul(a: DF, b: DF): DF {
  const p = twoProd(a[0], b[0]);
  p[1] = f(p[1] + f(f(a[0] * b[1]) + f(a[1] * b[0])));
  return quickTwoSum(p[0], p[1]);
}
