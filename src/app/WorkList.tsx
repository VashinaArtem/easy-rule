import { Link } from 'react-router';
import type { Exhibit } from '../exhibits/types';

/** Open works as lit windows; upcoming ones as a quiet list without links. */
export function WorkList({ works, large = false }: { works: Exhibit[]; large?: boolean }) {
  const open = works.filter((w) => w.status === 'open');
  const soon = works.filter((w) => w.status === 'soon');
  return (
    <>
      <ul className="works" data-large={large}>
        {open.map((w) => (
          <li key={w.id}>
            <Link to={`/work/${w.id}`} className="work">
              <span className="work__window">
                <img src={`/thumbs/${w.id}.jpg`} alt="" loading="lazy" width={800} height={560} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              </span>
              <span className="work__title">{w.title}</span>
              <span className="work__gist">{w.gist}</span>
              {w.status === 'open' ? (
                <span className="work__author">
                  {w.author}
                  {w.year ? `, ${w.year}` : ''}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {soon.length > 0 ? (
        <div className="soon">
          <h3 className="soon__title">В подготовке</h3>
          <ul className="soon__list">
            {soon.map((w) => (
              <li key={w.id}>
                <span className="soon__name">{w.title}</span>
                <span className="soon__gist">{w.gist}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
