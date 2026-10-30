import { DF64_GLSL } from '../../gl/df64';

export const MAX_STOPS = 8;

export type EscapeKind = 'mandelbrot' | 'julia';

/**
 * Escape-time fragment shader. Mirrors `iterate()` in math.ts: same update
 * order, same escape radius, same smooth count and distance estimate.
 */
export function escapeShader(kind: EscapeKind, df64: boolean): string {
  const julia = kind === 'julia';
  return /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform vec2 u_res;
uniform vec2 u_center;
uniform vec4 u_centerDF;
uniform float u_scale;
uniform vec2 u_c;
uniform int u_maxIter;
uniform int u_ss;
uniform vec3 u_stops[${MAX_STOPS}];
uniform int u_nstops;
uniform float u_density;
uniform float u_phase;
uniform vec3 u_inside;
uniform vec3 u_edge;
uniform float u_edgeAmt;
out vec4 outColor;

const float ESC = 65536.0;

${df64 ? DF64_GLSL : ''}

vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }

vec3 palette(float t) {
  float s = fract(t) * float(u_nstops);
  int i = int(floor(s));
  int j = i + 1 >= u_nstops ? 0 : i + 1;
  float f = smoothstep(0.0, 1.0, fract(s));
  return mix(u_stops[i], u_stops[j], f);
}

vec3 shade(bool escaped, int n, float r2, vec2 dz, float pixel) {
  if (!escaped) return u_inside;
  float logz = 0.5 * log(r2);
  float nu = max(0.0, float(n) + 2.0 - log2(logz));
  float dzLen = length(dz);
  // Distance estimate in pixels; overflowing derivatives count as "on the boundary".
  float de = (dzLen > 0.0 && dzLen < 1e30) ? sqrt(r2) * logz / dzLen / pixel : 0.0;
  vec3 col = palette(log2(nu + 1.0) * u_density * 0.5 + u_phase);
  // Points that escape almost at once fade into the background tone.
  col = mix(u_stops[0], col, smoothstep(1.5, 9.0, nu));
  float edge = 1.0 - smoothstep(0.0, 2.5, de);
  return mix(col, u_edge, edge * u_edgeAmt);
}

vec3 sampleAt(vec2 offset, float pixel) {
  float r2 = 0.0;
  bool escaped = false;
  int n = 0;
${
  df64
    ? `
  vec2 cx = dfAdd(u_centerDF.xy, vec2(offset.x, 0.0));
  vec2 cy = dfAdd(u_centerDF.zw, vec2(offset.y, 0.0));
  vec2 zx = vec2(0.0);
  vec2 zy = vec2(0.0);
  vec2 zf = vec2(0.0);
  vec2 dz = vec2(0.0);
  for (n = 0; n < u_maxIter; n++) {
    dz = 2.0 * cmul(zf, dz) + vec2(1.0, 0.0);
    vec2 x2 = dfMul(zx, zx);
    vec2 y2 = dfMul(zy, zy);
    vec2 xy = dfMul(zx, zy);
    zx = dfAdd(dfAdd(x2, -y2), cx);
    zy = dfAdd(2.0 * xy, cy);
    zf = vec2(zx.x, zy.x);
    r2 = dot(zf, zf);
    if (r2 > ESC) { escaped = true; break; }
  }`
    : `
  vec2 p = u_center + offset;
  ${julia ? 'vec2 z = p; vec2 c = u_c; vec2 dz = vec2(1.0, 0.0);' : 'vec2 z = vec2(0.0); vec2 c = p; vec2 dz = vec2(0.0);'}
  ${
    julia
      ? ''
      : `float qx = c.x - 0.25;
  float q = qx * qx + c.y * c.y;
  if (q * (q + qx) <= 0.25 * c.y * c.y || (c.x + 1.0) * (c.x + 1.0) + c.y * c.y <= 0.0625) return u_inside;`
  }
  for (n = 0; n < u_maxIter; n++) {
    dz = 2.0 * cmul(z, dz)${julia ? '' : ' + vec2(1.0, 0.0)'};
    z = cmul(z, z) + c;
    r2 = dot(z, z);
    if (r2 > ESC) { escaped = true; break; }
  }`
}
  return shade(escaped, n, r2, dz, pixel);
}

void main() {
  float pixel = 2.0 * u_scale / u_res.y;
  vec3 acc = vec3(0.0);
  for (int sy = 0; sy < u_ss; sy++) {
    for (int sx = 0; sx < u_ss; sx++) {
      vec2 jitter = (vec2(float(sx), float(sy)) + 0.5) / float(u_ss) - 0.5;
      acc += sampleAt((gl_FragCoord.xy + jitter - 0.5 * u_res) * pixel, pixel);
    }
  }
  outColor = vec4(acc / float(u_ss * u_ss), 1.0);
}
`;
}

/** Tiny program used once to check that df64 survives the GPU compiler. */
export const DF64_SELFTEST_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_a;
uniform vec2 u_b;
uniform vec2 u_mul;
uniform vec2 u_add;
out vec4 outColor;
${DF64_GLSL}
bool close(vec2 got, vec2 want) {
  return got.x == want.x && abs(got.y - want.y) <= abs(want.y) * 1e-3 + 1e-30;
}
void main() {
  bool ok = close(dfMul(u_a, u_b), u_mul) && close(dfAdd(u_a, u_b), u_add);
  outColor = ok ? vec4(1.0) : vec4(0.0, 0.0, 0.0, 1.0);
}
`;
