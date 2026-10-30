/** A window onto the complex plane: centre and half-height, in plane units. */
export interface PlaneView {
  cx: number;
  cy: number;
  scale: number;
}

/** Maps a CSS pixel inside a w×h element to a plane point (y axis up). */
export function screenToPlane(view: PlaneView, px: number, py: number, w: number, h: number): [number, number] {
  const k = (2 * view.scale) / h;
  return [view.cx + (px - w / 2) * k, view.cy - (py - h / 2) * k];
}

export function planeToScreen(view: PlaneView, x: number, y: number, w: number, h: number): [number, number] {
  const k = h / (2 * view.scale);
  return [w / 2 + (x - view.cx) * k, h / 2 - (y - view.cy) * k];
}

/** Zoom by `factor` (<1 zooms in) keeping the plane point under (px, py) fixed. */
export function zoomAt(view: PlaneView, factor: number, px: number, py: number, w: number, h: number, minScale: number, maxScale: number): PlaneView {
  const scale = Math.min(maxScale, Math.max(minScale, view.scale * factor));
  const [x, y] = screenToPlane(view, px, py, w, h);
  const f = scale / view.scale;
  return { cx: x + (view.cx - x) * f, cy: y + (view.cy - y) * f, scale };
}

export function panBy(view: PlaneView, dxPx: number, dyPx: number, h: number): PlaneView {
  const k = (2 * view.scale) / h;
  return { cx: view.cx - dxPx * k, cy: view.cy + dyPx * k, scale: view.scale };
}
