import { DU, DV, F_RANGE, K_RANGE } from './math';

const f = (x: number) => x.toFixed(5);

/** One Gray–Scott step plus an optional brush stroke; mirrors `step()` in math.ts. */
export const STEP_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_state;
uniform ivec2 u_size;
uniform float u_F;
uniform float u_k;
uniform float u_dt;
uniform bool u_atlas;
uniform vec4 u_stroke;   // x0, y0, x1, y1 in cells
uniform float u_radius;  // < 0: no brush
out vec4 o;

vec2 at(ivec2 p) {
  return texelFetch(u_state, ivec2((p.x + u_size.x) % u_size.x, (p.y + u_size.y) % u_size.y), 0).xy;
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - (a + ab * t));
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 c = at(p);
  vec2 lap = -c
    + 0.2 * (at(p + ivec2(1, 0)) + at(p - ivec2(1, 0)) + at(p + ivec2(0, 1)) + at(p - ivec2(0, 1)))
    + 0.05 * (at(p + ivec2(1, 1)) + at(p + ivec2(1, -1)) + at(p + ivec2(-1, 1)) + at(p + ivec2(-1, -1)));
  float F = u_F;
  float k = u_k;
  if (u_atlas) {
    vec2 uv = (vec2(p) + 0.5) / vec2(u_size);
    F = mix(${f(F_RANGE[0])}, ${f(F_RANGE[1])}, uv.x);
    k = mix(${f(K_RANGE[0])}, ${f(K_RANGE[1])}, uv.y);
  }
  float uvv = c.x * c.y * c.y;
  vec2 d = vec2(${f(DU)} * lap.x - uvv + F * (1.0 - c.x), ${f(DV)} * lap.y + uvv - (F + k) * c.y);
  vec2 n = clamp(c + u_dt * d, 0.0, 1.0);
  if (u_radius > 0.0) {
    float w = smoothstep(u_radius, u_radius * 0.45, segDist(vec2(p) + 0.5, u_stroke.xy, u_stroke.zw));
    n.y = max(n.y, w);
    n.x = min(n.x, 1.0 - 0.5 * w);
  }
  o = vec4(n, 0.0, 1.0);
}`;

/** Fresh field: u = 1, v = 0, with a few seeds of v. */
export const INIT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform ivec2 u_size;
out vec4 o;
void main() {
  vec2 p = gl_FragCoord.xy / vec2(u_size);
  float m = float(min(u_size.x, u_size.y));
  float v = 0.0;
  float u = 1.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 centre = i == 0 ? vec2(0.5) : vec2(0.5) + (0.12 + 0.045 * fi) * vec2(cos(fi * 2.39996), sin(fi * 2.39996)) * vec2(float(u_size.y) / float(u_size.x), 1.0) * 1.6;
    float r = length((p - centre) * vec2(u_size)) / (0.012 * m * (i == 0 ? 1.3 : 1.0));
    if (r < 1.0) { v = 1.0; u = 0.5; }
  }
  o = vec4(u, v, 0.0, 1.0);
}`;

/** Draws v with a relief shading; bilinear sampling by hand since float32 is not filterable. */
export const SHOW_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_state;
uniform ivec2 u_size;
uniform vec2 u_canvas;
out vec4 o;

float vAt(ivec2 p) {
  return texelFetch(u_state, ivec2((p.x + u_size.x) % u_size.x, (p.y + u_size.y) % u_size.y), 0).y;
}

float sampleV(vec2 uv) {
  vec2 q = uv * vec2(u_size) - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 f = fract(q);
  return mix(mix(vAt(i), vAt(i + ivec2(1, 0)), f.x), mix(vAt(i + ivec2(0, 1)), vAt(i + ivec2(1, 1)), f.x), f.y);
}

vec3 ramp(float t) {
  vec3 a = vec3(0.043, 0.063, 0.141);
  vec3 b = vec3(0.114, 0.196, 0.840);
  vec3 c = vec3(0.640, 0.700, 1.000);
  vec3 d = vec3(0.965, 0.905, 0.740);
  if (t < 0.4) return mix(a, b, smoothstep(0.0, 0.4, t));
  if (t < 0.75) return mix(b, c, smoothstep(0.4, 0.75, t));
  return mix(c, d, smoothstep(0.75, 1.0, t));
}

void main() {
  float ca = u_canvas.x / u_canvas.y;
  float sa = float(u_size.x) / float(u_size.y);
  vec2 uv = gl_FragCoord.xy / u_canvas;
  // "Cover": fill the canvas, cropping whichever side of the field is in excess.
  if (ca > sa) uv.y = (uv.y - 0.5) * (sa / ca) + 0.5;
  else uv.x = (uv.x - 0.5) * (ca / sa) + 0.5;

  float v = sampleV(uv);
  vec2 e = 1.0 / vec2(u_size);
  float dx = sampleV(uv + vec2(e.x, 0.0)) - sampleV(uv - vec2(e.x, 0.0));
  float dy = sampleV(uv + vec2(0.0, e.y)) - sampleV(uv - vec2(0.0, e.y));
  float t = smoothstep(0.02, 0.42, v);
  vec3 col = ramp(t);
  float shade = clamp(dot(vec2(dx, dy), vec2(-0.7, 0.7)) * 5.0, -0.6, 0.6);
  col *= 1.0 + shade * 0.7 * smoothstep(0.0, 0.1, v);
  o = vec4(col, 1.0);
}`;
