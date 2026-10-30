import type { PlaneView } from '../../gl/view';

export const HOME: PlaneView = { cx: -0.68, cy: 0, scale: 1.3 };

export interface Location {
  id: string;
  name: string;
  view: PlaneView;
}

export const locations: Location[] = [
  { id: 'home', name: 'Целиком', view: HOME },
  { id: 'seahorse', name: 'Морские коньки', view: { cx: -0.7453, cy: 0.1127, scale: 0.0065 } },
  { id: 'elephant', name: 'Долина слонов', view: { cx: 0.2855, cy: 0.0107, scale: 0.0105 } },
  { id: 'minibrot', name: 'Маленькая копия', view: { cx: -1.7548776, cy: 0, scale: 0.021 } },
  { id: 'spiral', name: 'Двойная спираль', view: { cx: -0.743643887037151, cy: 0.13182590420533, scale: 1.3e-5 } },
  { id: 'deep', name: 'Глубина ×10⁹', view: { cx: -0.7436438870371587, cy: 0.131825904205312, scale: 1.2e-9 } },
];
