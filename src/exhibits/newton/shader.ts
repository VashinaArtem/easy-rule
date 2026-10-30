import { MAX_ROOTS } from './math';

/** GPU version of `solve()` in math.ts, coloured by root and convergence speed. */
export const NEWTON_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_scale;
uniform vec2 u_roots[${MAX_ROOTS}];
uniform vec3 u_colors[${MAX_ROOTS}];
uniform int u_n;
uniform float u_a;
uniform int u_maxIter;
uniform int u_ss;
out vec4 outColor;

const float EPS = 1e-3;

vec3 sampleAt(vec2 z) {
  for (int n = 0; n < u_maxIter; n++) {
    for (int i = 0; i < ${MAX_ROOTS}; i++) {
      if (i >= u_n) break;
      float d = length(z - u_roots[i]);
      if (d < EPS) {
        // Fractional step from the quadratic convergence d → d², so shading is smooth.
        // d ∈ [EPS², EPS) maps to f ∈ (0, 1]: how far past the threshold the step landed.
        float f = clamp(log2(log(max(d, 1e-30)) / log(EPS)), 0.0, 1.0);
        float k = float(n) - f;
        float light = 0.12 + 0.95 * exp(-0.16 * k);
        return u_colors[i] * light;
      }
    }
    vec2 s = vec2(0.0);
    for (int i = 0; i < ${MAX_ROOTS}; i++) {
      if (i >= u_n) break;
      vec2 d = z - u_roots[i];
      s += vec2(d.x, -d.y) / dot(d, d);
    }
    z -= u_a * vec2(s.x, -s.y) / dot(s, s);
  }
  return vec3(0.02, 0.025, 0.05);
}

void main() {
  float pixel = 2.0 * u_scale / u_res.y;
  vec3 acc = vec3(0.0);
  for (int sy = 0; sy < u_ss; sy++) {
    for (int sx = 0; sx < u_ss; sx++) {
      vec2 jitter = (vec2(float(sx), float(sy)) + 0.5) / float(u_ss) - 0.5;
      acc += sampleAt(u_center + (gl_FragCoord.xy + jitter - 0.5 * u_res) * pixel);
    }
  }
  vec3 col = acc / float(u_ss * u_ss);
  outColor = vec4(pow(col, vec3(0.92)), 1.0);
}
`;
