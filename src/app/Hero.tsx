import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fitCanvas } from '../gl/gl';
import { planeToScreen, type PlaneView } from '../gl/view';
import { useFrameLoop } from '../hooks/useFrameLoop';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { EscapeTimeRenderer } from '../exhibits/escape-time/renderer';
import { getPalette } from '../exhibits/escape-time/palettes';
import { formatComplex } from '../exhibits/escape-time/format';

const ink = getPalette('ink');
const MAP_VIEW: PlaneView = { cx: -0.6, cy: 0, scale: 1.25 };

/** Point near the main cardioid boundary: c(θ) = r(e^{iθ}/2 − e^{2iθ}/4). */
function cardioidPoint(theta: number, r: number): [number, number] {
  return [r * (Math.cos(theta) / 2 - Math.cos(2 * theta) / 4), r * (Math.sin(theta) / 2 - Math.sin(2 * theta) / 4)];
}

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);

  const state = useRef({
    renderer: null as EscapeTimeRenderer | null,
    map: null as EscapeTimeRenderer | null,
    theta: 2.2,
    r: 1.0,
    target: { theta: 2.2, r: 1.0 },
    lastInput: -Infinity,
    drawnC: [NaN, NaN] as [number, number],
    still: 0,
  });

  useEffect(() => {
    try {
      state.current.renderer = new EscapeTimeRenderer(canvasRef.current!, 'julia');
      state.current.map = new EscapeTimeRenderer(mapRef.current!, 'mandelbrot');
    } catch {
      setFailed(true);
    }
    const s = state.current;
    return () => {
      s.renderer?.dispose();
      s.map?.dispose();
      s.renderer = s.map = null;
    };
  }, []);

  useEffect(() => {
    const el = heroRef.current!;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      const s = state.current;
      s.target.theta = Math.atan2(-y, x) + Math.PI;
      s.target.r = 0.97 + Math.min(1, Math.hypot(x, y) * 2) * 0.07;
      s.lastInput = performance.now();
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, []);

  useFrameLoop(heroRef, (dt, time) => {
    const s = state.current;
    const canvas = canvasRef.current!;
    const map = mapRef.current!;
    if (!s.renderer || !s.map) return;
    const resized = fitCanvas(canvas, 1.5);
    if (fitCanvas(map, 2) || resized) {
      s.map.draw({ view: MAP_VIEW, maxIter: 200, palette: ink, density: 1.4, interactive: false });
    }

    const idle = performance.now() - s.lastInput > 4000;
    if (idle && !reducedMotion) {
      s.target.theta += dt * 0.035;
      s.target.r = 1.0 + 0.03 * Math.sin(time * 0.21);
    }
    const k = 1 - Math.exp(-dt * 3);
    let d = s.target.theta - s.theta;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.theta += d * k;
    s.r += (s.target.r - s.r) * k;

    const c = cardioidPoint(s.theta, s.r);
    const moved = Math.hypot(c[0] - s.drawnC[0], c[1] - s.drawnC[1]) > 1e-6 || Number.isNaN(s.drawnC[0]);
    if (moved) s.still = 0;
    else s.still += dt;
    if (!moved && !resized && s.still > 0.25) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const wide = w > h * 1.15;
    const scale = wide ? 1.3 : 1.55;
    const view: PlaneView = wide ? { cx: -(w / h) * scale * 0.3, cy: 0, scale } : { cx: 0, cy: -scale * 0.18, scale };
    const pointerActive = performance.now() - s.lastInput < 400;
    s.renderer.draw({ view, c, maxIter: 260, palette: ink, density: 1.1, interactive: moved && pointerActive && !resized });
    s.drawnC = c;

    const [mx, my] = planeToScreen(MAP_VIEW, c[0], c[1], map.clientWidth, map.clientHeight);
    markerRef.current!.style.transform = `translate(${mx}px, ${my}px)`;
    readoutRef.current!.textContent = `c = ${formatComplex(c[0], c[1], 3)}`;
  });

  const touch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  return (
    <header className="hero" ref={heroRef}>
      <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" data-failed={failed} />
      <div className="hero__text">
        <p className="hero__kicker">Выставка о красоте математики</p>
        <h1 className="hero__title">Простое правило</h1>
        <p className="hero__rule">
          <span className="formula" translate="no">
            z → z² + c
          </span>
          <span className="hero__readout num" ref={readoutRef} aria-hidden="true" />
        </p>
        <p className="hero__lead">
          {touch ? 'Проведите пальцем по странице' : 'Ведите курсором по странице'}: точка c сдвигается, и узор Жюлиа меняется вместе с ней.
        </p>
        <Link to="/hall/infinity" className="hero__enter">
          Войти в первый зал
        </Link>
      </div>
      <figure className="hero__map" aria-hidden="true">
        <div className="hero__map-frame">
          <canvas ref={mapRef} />
          <span className="hero__marker" ref={markerRef} />
        </div>
        <figcaption>Где сейчас c: на границе множества Мандельброта</figcaption>
      </figure>
    </header>
  );
}
