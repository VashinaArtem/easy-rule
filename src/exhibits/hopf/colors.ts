const STOPS: [number, number, number][] = [
  [0.3, 0.42, 1.0],
  [0.71, 0.65, 1.0],
  [0.96, 0.84, 0.54],
  [0.94, 0.54, 0.43],
  [0.3, 0.42, 1.0],
];

/** Colour of a fibre from its base point: hue cycles with longitude, brightness with latitude. */
export function fibreColor(eta: number, lambda: number): [number, number, number] {
  const t = (((lambda / (2 * Math.PI)) % 1) + 1) % 1;
  const s = t * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(s));
  const f = s - i;
  const light = 0.7 + 0.3 * ((1 + Math.cos(eta)) / 2);
  return STOPS[i].map((v, c) => (v + (STOPS[i + 1][c] - v) * f) * light) as [number, number, number];
}

export function toCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}
