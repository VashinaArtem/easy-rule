import { Component, lazy, Suspense, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { getHall, getOpenExhibit, neighbours } from '../exhibits/registry';
import type { ArtworkProps, OpenExhibit } from '../exhibits/types';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ArtworkError } from '../ui/controls';
import { NotFound } from './NotFound';
import { usePageMeta } from './usePageMeta';

const lazyCache = new Map<string, LazyExoticComponent<ComponentType<ArtworkProps>>>();
function artworkFor(exhibit: OpenExhibit) {
  let c = lazyCache.get(exhibit.id);
  if (!c) {
    c = lazy(exhibit.load);
    lazyCache.set(exhibit.id, c);
  }
  return c;
}

class ArtworkBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    return this.state.error ? <ArtworkError message={this.state.error} /> : this.props.children;
  }
}

export function ExhibitPage() {
  const { workId } = useParams();
  const exhibit = getOpenExhibit(workId);
  if (!exhibit) return <NotFound />;
  return <Room key={exhibit.id} exhibit={exhibit} />;
}

function Room({ exhibit }: { exhibit: OpenExhibit }) {
  usePageMeta(exhibit.title, 'night');
  const reducedMotion = useReducedMotion();
  const hall = getHall(exhibit.hall)!;
  const { prev, next } = neighbours(exhibit.id);
  const Artwork = artworkFor(exhibit);

  return (
    <div className="room">
      <header className="room__bar">
        <nav aria-label="Где вы" className="room__where">
          <Link to="/" className="room__home">
            Простое правило
          </Link>
          <Link to={`/hall/${hall.id}`} className="room__hall">
            Зал {hall.numeral}. {hall.title}
          </Link>
        </nav>
        <nav aria-label="Маршрут по выставке" className="room__route">
          {prev ? (
            <Link to={`/work/${prev.id}`} className="room__step" rel="prev">
              <span className="room__step-dir">Назад</span>
              <span className="room__step-title">{prev.title}</span>
            </Link>
          ) : null}
          {next ? (
            <Link to={`/work/${next.id}`} className="room__step" rel="next">
              <span className="room__step-dir">Дальше</span>
              <span className="room__step-title">{next.title}</span>
            </Link>
          ) : (
            <Link to="/" className="room__step" rel="next">
              <span className="room__step-dir">В фойе</span>
              <span className="room__step-title">Конец маршрута</span>
            </Link>
          )}
        </nav>
      </header>

      <main id="content" className="room__stage">
        <ArtworkBoundary>
          <Suspense fallback={<p className="room__loading">Работа загружается…</p>}>
            <Artwork reducedMotion={reducedMotion} />
          </Suspense>
        </ArtworkBoundary>
      </main>

      <WallLabel exhibit={exhibit} />
    </div>
  );
}

/** Turns `e^{2πit}` into e<sup>2πit</sup>; everything else is plain text. */
function renderRule(rule: string): ReactNode[] {
  return rule.split(/\^\{([^}]*)\}/).map((part, i) => (i % 2 ? <sup key={i}>{part}</sup> : part));
}

function WallLabel({ exhibit }: { exhibit: OpenExhibit }) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 1100px) and (min-height: 760px)').matches);
  return (
    <section className="label" data-open={open} aria-labelledby="label-title">
      <div className="label__head">
        <h1 id="label-title" className="label__title">
          {exhibit.title}
        </h1>
        <p className="label__author">
          {exhibit.author}
          {exhibit.year ? `, ${exhibit.year}` : ''}
        </p>
        <p className="label__rule formula" translate="no">
          {renderRule(exhibit.rule)}
        </p>
      </div>
      <div className="label__body" id="label-body" hidden={!open}>
        {exhibit.note.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        <p className="label__howto">{exhibit.howTo}</p>
      </div>
      <button type="button" className="label__toggle" aria-expanded={open} aria-controls="label-body" onClick={() => setOpen((o) => !o)}>
        {open ? 'Свернуть' : 'Об этой работе'}
      </button>
    </section>
  );
}
