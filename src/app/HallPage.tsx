import { Link, useParams } from 'react-router';
import { exhibitsInHall, getHall, halls } from '../exhibits/registry';
import { Colophon } from './Lobby';
import { NotFound } from './NotFound';
import { WorkList } from './WorkList';
import { usePageMeta } from './usePageMeta';

export function HallPage() {
  const { hallId } = useParams();
  const hall = getHall(hallId);
  usePageMeta(hall ? `Зал ${hall.numeral}. ${hall.title}` : null, 'plaster');
  if (!hall) return <NotFound />;
  const i = halls.indexOf(hall);
  const prev = halls[i - 1];
  const next = halls[i + 1];

  return (
    <>
      <header className="hall-top">
        <Link to="/" className="hall-top__home">
          Простое правило
        </Link>
      </header>
      <main id="content" className="hall-page">
        <div className="hall-page__head">
          <p className="hall-page__numeral" aria-hidden="true">
            {hall.numeral}
          </p>
          <h1 className="hall-page__title">
            <span className="visually-hidden">Зал {hall.numeral}. </span>
            {hall.title}
          </h1>
          <p className="hall-page__lead">{hall.lead}</p>
        </div>
        <WorkList works={exhibitsInHall(hall.id)} large />
        <nav className="hall-nav" aria-label="Другие залы">
          {prev ? (
            <Link to={`/hall/${prev.id}`} rel="prev">
              <span>Предыдущий зал</span>
              {prev.numeral}. {prev.title}
            </Link>
          ) : (
            <Link to="/">
              <span>Начало</span>Фойе
            </Link>
          )}
          {next ? (
            <Link to={`/hall/${next.id}`} rel="next">
              <span>Следующий зал</span>
              {next.numeral}. {next.title}
            </Link>
          ) : null}
        </nav>
      </main>
      <Colophon />
    </>
  );
}
