import { useEffect, useMemo, useRef, useState } from 'react';
import { Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useFrameLoop } from '../../hooks/useFrameLoop';
import { enumCodec, intCodec, numberCodec, useUrlState } from '../../hooks/useUrlState';
import { ActionButton, ArtworkError, Choice, Group, Panel, Slider, Toggle } from '../../ui/controls';
import { formatNumber } from '../escape-time/format';
import type { ArtworkProps } from '../types';
import { BaseSphere } from './BaseSphere';
import { fibreColor } from './colors';
import { CLIP_RADIUS, fibonacciSphere, fibrePoint, fibreCurve, linkingNumber, rotate14, stereographic, toAngles } from './math';

type Fibre = [number, number];
const SEG = 180;
const MAX_FIBRES = 100;
const sceneCodec = enumCodec(['ring', 'sphere', 'own'] as const);
const degCodec = numberCodec(5, 175, 1);
const countCodec = intCodec(3, 60);
const sphereCountCodec = intCodec(8, 90);
const omegaCodec = numberCodec(0, 360, 0);
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

const INITIAL_OWN: Fibre[] = [
  [Math.PI / 2, 0],
  [Math.PI / 2, Math.PI],
  [1.0, 2.2],
];

/** Writes the segments of every fibre into the preallocated buffers; returns the segment count. */
function buildSegments(fibres: Fibre[], omega: number, pos: Float32Array, col: Float32Array): number {
  let n = 0;
  const pts = new Float64Array((SEG + 1) * 4); // x, y, z, valid
  for (const [eta, lambda] of fibres) {
    const [r, g, b] = fibreColor(eta, lambda);
    for (let i = 0; i <= SEG; i++) {
      const p = stereographic(rotate14(fibrePoint(eta, lambda, (2 * Math.PI * (i % SEG)) / SEG), omega));
      const len = Math.hypot(p[0], p[1], p[2]);
      pts[i * 4] = p[0];
      pts[i * 4 + 1] = p[1];
      pts[i * 4 + 2] = p[2];
      pts[i * 4 + 3] = Number.isFinite(len) && len < CLIP_RADIUS ? 1 : 0;
    }
    for (let i = 0; i < SEG; i++) {
      if (!pts[i * 4 + 3] || !pts[(i + 1) * 4 + 3]) continue;
      for (let e = 0; e < 2; e++) {
        const j = (i + e) * 4;
        const o = n * 6 + e * 3;
        pos[o] = pts[j];
        pos[o + 1] = pts[j + 1];
        pos[o + 2] = pts[j + 2];
        // Fade towards infinity so curves that run away do not dominate.
        const fade = 1 / (1 + (Math.hypot(pts[j], pts[j + 1], pts[j + 2]) / 5) ** 2);
        col[o] = r * fade;
        col[o + 1] = g * fade;
        col[o + 2] = b * fade;
      }
      n++;
    }
  }
  return n;
}

interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  geometry: LineSegmentsGeometry;
  material: LineMaterial;
  lines: LineSegments2;
  pos: Float32Array;
  col: Float32Array;
}

export default function HopfArtwork({ reducedMotion }: ArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useUrlState('scene', 'ring', sceneCodec);
  const [ringDeg, setRingDeg] = useUrlState('eta', 65, degCodec);
  const [ringCount, setRingCount] = useUrlState('count', 28, countCodec);
  const [sphereCount, setSphereCount] = useUrlState('points', 40, sphereCountCodec);
  const [omegaDeg, setOmegaDeg] = useUrlState('w', 0, omegaCodec);
  const [own, setOwn] = useState<Fibre[]>(INITIAL_OWN);
  const [pending, setPending] = useState<Fibre>([1.2, 0.8]);
  const [north, setNorth] = useState(true);
  const [turn, setTurn] = useState(!reducedMotion);
  const [animate4d, setAnimate4d] = useState(false);

  const fibres = useMemo<Fibre[]>(() => {
    if (scene === 'ring') return Array.from({ length: ringCount }, (_, j) => [rad(ringDeg), (2 * Math.PI * j) / ringCount] as Fibre);
    if (scene === 'sphere') return fibonacciSphere(sphereCount).map((p) => {
      const a = toAngles(p);
      return [a.eta, a.lambda] as Fibre;
    });
    return own;
  }, [scene, ringDeg, ringCount, sphereCount, own]);

  const live = useRef({ fibres, omega: rad(omegaDeg), animate4d });
  const dirty = useRef(true);
  useEffect(() => {
    live.current.fibres = fibres;
    live.current.animate4d = animate4d;
    if (!animate4d) live.current.omega = rad(omegaDeg);
    dirty.current = true;
  }, [fibres, omegaDeg, animate4d]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    try {
      const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(new Color('#0b1024'), 1);
      const camera = new PerspectiveCamera(42, 1, 0.1, 100);
      camera.up.set(0, 0, 1);
      camera.position.set(3.4, -4.6, 2.6);
      const sceneObj = new Scene();
      const pos = new Float32Array(MAX_FIBRES * SEG * 6);
      const col = new Float32Array(MAX_FIBRES * SEG * 6);
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(pos);
      geometry.setColors(col);
      geometry.instanceCount = 0;
      const material = new LineMaterial({ linewidth: 2.4, vertexColors: true, transparent: true, opacity: 0.96 });
      const lines = new LineSegments2(geometry, material);
      lines.frustumCulled = false;
      sceneObj.add(lines);
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 1.5;
      controls.maxDistance = 16;
      controls.autoRotateSpeed = 0.9;
      stage.current = { renderer, scene: sceneObj, camera, controls, geometry, material, lines, pos, col };
      dirty.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      const s = stage.current;
      if (!s) return;
      s.controls.dispose();
      s.geometry.dispose();
      s.material.dispose();
      s.renderer.dispose();
      stage.current = null;
    };
  }, []);

  useEffect(() => {
    const s = stage.current;
    if (s) s.controls.autoRotate = turn && !reducedMotion;
  }, [turn, reducedMotion, error]);

  // Keyboard: arrows turn the view around the vertical axis, plus and minus dolly.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || error) return;
    const onKey = (e: KeyboardEvent) => {
      const s = stage.current;
      if (!s) return;
      const cam = s.camera.position;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') cam.applyAxisAngle(new Vector3(0, 0, 1), e.key === 'ArrowLeft' ? 0.1 : -0.1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const axis = new Vector3(cam.y, -cam.x, 0).normalize();
        const next = cam.clone().applyAxisAngle(axis, e.key === 'ArrowUp' ? 0.08 : -0.08);
        if (Math.abs(next.z / next.length()) < 0.97) cam.copy(next);
      } else if (e.key === '+' || e.key === '=') cam.multiplyScalar(0.9);
      else if (e.key === '-') cam.multiplyScalar(1 / 0.9);
      else return;
      e.preventDefault();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [error]);

  useFrameLoop(canvasRef, (dt) => {
    const s = stage.current;
    const canvas = canvasRef.current;
    if (!s || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * s.renderer.getPixelRatio()) || canvas.height !== Math.round(h * s.renderer.getPixelRatio())) {
      s.renderer.setSize(w, h, false);
      s.camera.aspect = w / h;
      // On wide screens move the figure right, out from under the wall label.
      if (w > 1000) s.camera.setViewOffset(w, h, -w * 0.07, 0, w, h);
      else s.camera.clearViewOffset();
      s.camera.updateProjectionMatrix();
    }
    const lv = live.current;
    if (lv.animate4d && !reducedMotion) {
      lv.omega = (lv.omega + dt * 0.22) % (2 * Math.PI);
      dirty.current = true;
    }
    if (dirty.current) {
      dirty.current = false;
      const count = buildSegments(lv.fibres.slice(0, MAX_FIBRES), lv.omega, s.pos, s.col);
      const start = s.geometry.attributes.instanceStart as unknown as { data: { needsUpdate: boolean } };
      const color = s.geometry.attributes.instanceColorStart as unknown as { data: { needsUpdate: boolean } };
      start.data.needsUpdate = true;
      color.data.needsUpdate = true;
      s.geometry.instanceCount = count;
    }
    s.controls.update(dt);
    s.renderer.render(s.scene, s.camera);
  });

  const linking = useMemo(() => {
    const [a, b] = fibres;
    if (!a || !b || a[0] > 3 || b[0] > 3) return null;
    return Math.abs(linkingNumber(fibreCurve(a[0], a[1], 140), fibreCurve(b[0], b[1], 140)));
  }, [fibres]);

  const pick = (eta: number, lambda: number) => {
    if (scene === 'ring') setRingDeg(Math.min(175, Math.max(5, deg(eta))));
    else if (scene === 'own') {
      setPending([eta, lambda]);
      setOwn((list) => (list.length >= 40 ? list : [...list, [eta, lambda]]));
    }
  };

  const shownPoints = useMemo(() => fibres.slice(0, 120), [fibres]);

  if (error) return <ArtworkError message={error} />;

  return (
    <div className="art">
      <canvas
        ref={canvasRef}
        className="art-canvas"
        tabIndex={0}
        aria-label="Расслоение Хопфа: окружности в трёхмерном пространстве, каждая из которых сцеплена с остальными. Стрелки поворачивают вид, плюс и минус приближают."
      />
      <Panel
        status={
          <>
            <div>
              Окружностей: <strong>{fibres.length}</strong>
            </div>
            {linking !== null ? (
              <div>
                Число зацепления первых двух, посчитанное по интегралу Гаусса: <strong>{formatNumber(linking, 2)}</strong>
              </div>
            ) : null}
          </>
        }
      >
        <Group title="Что показывать">
          <Choice
            label="Набор окружностей"
            value={scene}
            onChange={setScene}
            columns={1}
            options={[
              { value: 'ring', label: 'Параллель: получается тор' },
              { value: 'sphere', label: 'Вся сфера' },
              { value: 'own', label: 'Мои точки' },
            ]}
          />
        </Group>
        <Group title="Точки на сфере">
          <BaseSphere
            points={shownPoints}
            ring={scene === 'ring' ? rad(ringDeg) : null}
            pending={scene === 'own' ? pending : null}
            north={north}
            disabled={scene === 'sphere'}
            onPick={pick}
          />
          <div className="actions">
            <ActionButton onClick={() => setNorth((n) => !n)}>{north ? 'Показать южное полушарие' : 'Показать северное полушарие'}</ActionButton>
          </div>
          {scene === 'ring' ? (
            <>
              <Slider label="Угол от северного полюса" value={ringDeg} min={5} max={175} step={1} onChange={setRingDeg} format={(v) => `${v}°`} />
              <Slider label="Окружностей на параллели" value={ringCount} min={3} max={60} step={1} onChange={setRingCount} />
            </>
          ) : null}
          {scene === 'sphere' ? <Slider label="Точек на сфере" value={sphereCount} min={8} max={90} step={1} onChange={setSphereCount} /> : null}
          {scene === 'own' ? (
            <>
              <Slider label="Угол от северного полюса" value={deg(pending[0])} min={5} max={175} step={1} onChange={(v) => setPending([rad(v), pending[1]])} format={(v) => `${Math.round(v)}°`} />
              <Slider label="Долгота" value={((deg(pending[1]) + 540) % 360) - 180} min={-180} max={180} step={1} onChange={(v) => setPending([pending[0], rad(v)])} format={(v) => `${Math.round(v)}°`} />
              <div className="actions">
                <ActionButton onClick={() => setOwn((l) => (l.length >= 40 ? l : [...l, pending]))}>Добавить окружность</ActionButton>
                <ActionButton onClick={() => setOwn([])}>Убрать все</ActionButton>
              </div>
              {own.length === 0 ? <p className="slider__hint">Нажмите на сферу или кнопку «Добавить окружность».</p> : null}
            </>
          ) : null}
        </Group>
        <Group title="Вид">
          <Slider label="Поворот в четвёртом измерении" value={omegaDeg} min={0} max={360} step={1} onChange={(v) => { setAnimate4d(false); setOmegaDeg(v); }} format={(v) => `${v}°`} hint="Вращает 3-сферу в плоскости x₁x₄. Окружности меняют форму, но остаются сцепленными." />
          <Toggle label="Анимировать поворот" checked={animate4d} onChange={setAnimate4d} />
          <Toggle label="Вращать камеру" checked={turn} onChange={setTurn} />
        </Group>
      </Panel>
    </div>
  );
}
