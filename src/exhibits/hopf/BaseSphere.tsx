import { useEffect, useRef } from 'react';
import { fibreColor, toCss } from './colors';
import { basePoint, toAngles, type V3 } from './math';

interface Props {
  /** Points of S² as [η, λ] whose fibres are drawn. */
  points: [number, number][];
  /** Highlighted parallel for the "ring" scene. */
  ring: number | null;
  pending: [number, number] | null;
  north: boolean;
  disabled: boolean;
  onPick: (eta: number, lambda: number) => void;
}

const SIZE = 220;

/** The base sphere S² seen along its axis: one hemisphere at a time. Click to choose a point. */
export function BaseSphere({ points, ring, pending, north, disabled, onPick }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const c = SIZE / 2;
    const R = SIZE / 2 - 8;
    const sgn = north ? 1 : -1;
    // Seen from the south the x axis is mirrored, so the picture is a view *through* the sphere.
    const X = (p: V3) => c + sgn * p[0] * R;
    const Y = (p: V3) => c - p[1] * R;

    ctx.strokeStyle = 'rgba(233, 236, 243, 0.2)';
    ctx.lineWidth = 1;
    for (const deg of [30, 60]) {
      ctx.beginPath();
      ctx.arc(c, c, R * Math.sin((deg * Math.PI) / 180), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let m = 0; m < 6; m++) {
      const a = (m * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(c - Math.cos(a) * R, c + Math.sin(a) * R);
      ctx.lineTo(c + Math.cos(a) * R, c - Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(233, 236, 243, 0.65)';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.stroke();

    if (ring !== null) {
      // A parallel appears as a circle of radius sin η in either hemisphere view.
      const front = north ? ring <= Math.PI / 2 : ring >= Math.PI / 2;
      ctx.beginPath();
      ctx.arc(c, c, R * Math.sin(ring), 0, Math.PI * 2);
      ctx.strokeStyle = front ? 'rgba(244, 213, 138, 0.95)' : 'rgba(244, 213, 138, 0.35)';
      ctx.setLineDash(front ? [] : [3, 4]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const [eta, lambda] of points) {
      const p = basePoint(eta, lambda);
      const front = north ? p[2] >= 0 : p[2] <= 0;
      ctx.beginPath();
      ctx.arc(X(p), Y(p), front ? 3.6 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = toCss(fibreColor(eta, lambda));
      ctx.globalAlpha = front ? 1 : 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (pending) {
      const p = basePoint(pending[0], pending[1]);
      ctx.beginPath();
      ctx.arc(X(p), Y(p), 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#e9ecf3';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [points, ring, pending, north]);

  const handle = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const sgn = north ? 1 : -1;
    const x = (((e.clientX - r.left) / r.width) * SIZE - SIZE / 2) / (SIZE / 2 - 8);
    const y = -(((e.clientY - r.top) / r.height) * SIZE - SIZE / 2) / (SIZE / 2 - 8);
    const rho = Math.hypot(x, y);
    const k = rho > 1 ? 1 / rho : 1;
    const px = x * k * sgn;
    const py = y * k;
    const pz = sgn * Math.sqrt(Math.max(0, 1 - px * px - py * py));
    const { eta, lambda } = toAngles([px, py, pz]);
    onPick(eta, lambda);
  };

  return (
    <canvas
      ref={ref}
      className="basesphere"
      style={{ width: '100%', aspectRatio: '1', cursor: disabled ? 'default' : 'crosshair' }}
      data-disabled={disabled}
      onPointerDown={handle}
      role="img"
      aria-label={`Базовая сфера, вид с ${north ? 'северного' : 'южного'} полюса. ${disabled ? '' : 'Нажмите, чтобы выбрать точку.'}`}
    />
  );
}
