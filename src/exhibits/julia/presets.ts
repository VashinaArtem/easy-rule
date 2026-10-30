export interface JuliaPreset {
  id: string;
  name: string;
  c: [number, number];
  /** Whether c belongs to the Mandelbrot set, i.e. whether the Julia set is connected. */
  connected: boolean;
}

export const juliaPresets: JuliaPreset[] = [
  { id: 'rabbit', name: 'Кролик Дуади', c: [-0.1226, 0.7449], connected: true },
  { id: 'siegel', name: 'Диск Зигеля', c: [-0.390541, -0.586788], connected: true },
  { id: 'san-marco', name: 'Сан-Марко', c: [-0.75, 0], connected: true },
  { id: 'dendrite', name: 'Дендрит', c: [0, 1], connected: true },
  // Just outside M: looks connected, but is a totally disconnected dust.
  { id: 'spirals', name: 'Спирали', c: [-0.7269, 0.1889], connected: false },
  { id: 'dust', name: 'Пыль Фату', c: [-0.8, 0.2], connected: false },
];

/** Point on the main cardioid's boundary, scaled by r: r·(e^{iθ}/2 − e^{2iθ}/4). */
export function cardioid(theta: number, r = 1): [number, number] {
  return [r * (Math.cos(theta) / 2 - Math.cos(2 * theta) / 4), r * (Math.sin(theta) / 2 - Math.sin(2 * theta) / 4)];
}
