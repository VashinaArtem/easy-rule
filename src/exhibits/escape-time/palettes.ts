export interface EscapePalette {
  id: string;
  name: string;
  /** Cyclic gradient; the first stop is the colour far from the set. */
  stops: string[];
  inside: string;
  edge: string;
  edgeAmount: number;
}

export const palettes: EscapePalette[] = [
  {
    id: 'cobalt',
    name: 'Кобальт',
    stops: ['#0b1024', '#16236e', '#2e47f5', '#a9b6ff', '#f4e6bd', '#c58d3f', '#43202a'],
    inside: '#04060d',
    edge: '#fff6dc',
    edgeAmount: 0.55,
  },
  {
    id: 'pearl',
    name: 'Перламутр',
    stops: ['#0d0f20', '#3a2e69', '#9c78c4', '#f0c9d9', '#dff3ec', '#71b5b5', '#1a3949'],
    inside: '#06060c',
    edge: '#ffffff',
    edgeAmount: 0.45,
  },
  {
    id: 'ember',
    name: 'Угли',
    stops: ['#0a0a12', '#3b0f1c', '#a3261e', '#f08a24', '#ffe3a1', '#6a5a8c', '#141329'],
    inside: '#020203',
    edge: '#ffe9c4',
    edgeAmount: 0.5,
  },
  {
    id: 'ink',
    name: 'Тушь',
    stops: ['#e3e6e2', '#d9ddd9', '#c3cad3', '#a9b3d6', '#d9ddd9'],
    inside: '#1c2024',
    edge: '#1c2024',
    edgeAmount: 0.92,
  },
];

export const paletteIds = palettes.map((p) => p.id);

export function getPalette(id: string): EscapePalette {
  return palettes.find((p) => p.id === id) ?? palettes[0];
}
