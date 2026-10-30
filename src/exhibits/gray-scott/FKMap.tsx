import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { F_RANGE, K_RANGE, presets, saddleNodeK } from './math';

const W = 100;
const H = 72;

const fx = (F: number) => ((F - F_RANGE[0]) / (F_RANGE[1] - F_RANGE[0])) * W;
const ky = (k: number) => H - ((k - K_RANGE[0]) / (K_RANGE[1] - K_RANGE[0])) * H;

const curve = Array.from({ length: 60 }, (_, i) => {
  const F = F_RANGE[0] + ((F_RANGE[1] - F_RANGE[0]) * i) / 59;
  return `${fx(F).toFixed(2)},${ky(saddleNodeK(F)).toFixed(2)}`;
}).join(' ');

interface Props {
  F: number;
  k: number;
  onChange: (F: number, k: number) => void;
}

/** A plane of the two rule parameters: drag the point to move through all patterns. */
export function FKMap({ F, k, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const down = useRef(false);

  const pick = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onChange(F_RANGE[0] + x * (F_RANGE[1] - F_RANGE[0]), K_RANGE[0] + (1 - y) * (K_RANGE[1] - K_RANGE[0]));
  };

  const onKey = (e: KeyboardEvent) => {
    const dF = (F_RANGE[1] - F_RANGE[0]) / 90 * (e.shiftKey ? 5 : 1);
    const dk = (K_RANGE[1] - K_RANGE[0]) / 50 * (e.shiftKey ? 5 : 1);
    const d: Record<string, [number, number]> = { ArrowLeft: [-dF, 0], ArrowRight: [dF, 0], ArrowUp: [0, dk], ArrowDown: [0, -dk] };
    if (!d[e.key]) return;
    e.preventDefault();
    onChange(Math.min(F_RANGE[1], Math.max(F_RANGE[0], F + d[e.key][0])), Math.min(K_RANGE[1], Math.max(K_RANGE[0], k + d[e.key][1])));
  };

  return (
    <div
      ref={ref}
      className="fkmap"
      role="slider"
      tabIndex={0}
      aria-label="Карта параметров F и k"
      aria-valuetext={`F = ${F.toFixed(4)}, k = ${k.toFixed(4)}`}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        down.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => down.current && pick(e)}
      onPointerUp={() => (down.current = false)}
      onPointerCancel={() => (down.current = false)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <polyline points={curve} className="fkmap__curve" vectorEffect="non-scaling-stroke" />
        {presets.map((p) => (
          <circle key={p.id} cx={fx(p.F)} cy={ky(p.k)} r={1} className="fkmap__preset" />
        ))}
      </svg>
      <span className="fkmap__point" style={{ left: `${(fx(F) / W) * 100}%`, top: `${(ky(k) / H) * 100}%` }} aria-hidden="true" />
      <span className="fkmap__axis fkmap__axis--x" aria-hidden="true">
        F →
      </span>
      <span className="fkmap__axis fkmap__axis--y" aria-hidden="true">
        k ↑
      </span>
    </div>
  );
}
