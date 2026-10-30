import { useId, useState, type CSSProperties, type ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  /** Optional live readout under the controls (e.g. current zoom). */
  status?: ReactNode;
}

/** Parameter panel: a column on the right on desktop, a bottom sheet on phones. */
export function Panel({ children, status }: PanelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <aside className="panel" data-open={open} aria-label="Параметры работы">
      <button type="button" className="panel__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? 'Скрыть параметры' : 'Параметры'}
      </button>
      <div className="panel__body" id={id}>
        {children}
        {status ? (
          <div className="panel__status" aria-live="polite">
            {status}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="group">
      <legend className="group__title">{title}</legend>
      {children}
    </fieldset>
  );
}

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}

export function Slider({ label, value, min, max, step, onChange, format, hint }: SliderProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="num">
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <p className="slider__hint">{hint}</p> : null}
    </div>
  );
}

interface ChoiceProps<T extends string> {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  columns?: 1 | 2;
}

export function Choice<T extends string>({ label, value, options, onChange, columns = 2 }: ChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset className="choice" data-columns={columns}>
      <legend className="visually-hidden">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="choice__item">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function ActionButton({ children, onClick, pressed }: { children: ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" className="action" onClick={onClick} aria-pressed={pressed}>
      {children}
    </button>
  );
}

export function ArtworkError({ message }: { message: string }) {
  return (
    <div className="artwork-error" role="alert">
      <p>Эта работа не может запуститься в вашем браузере.</p>
      <p className="artwork-error__detail">{message}</p>
      <p>Попробуйте свежую версию Chrome, Safari, Firefox или Edge с включённым аппаратным ускорением.</p>
    </div>
  );
}
