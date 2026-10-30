import { Link } from 'react-router';
import { exhibitsInHall, halls, openExhibits } from '../exhibits/registry';
import { Hero } from './Hero';
import { WorkList } from './WorkList';
import { usePageMeta } from './usePageMeta';

export function Lobby() {
  usePageMeta(null, 'plaster');
  return (
    <>
      <Hero />
      <main id="content" className="lobby">
        <section className="statement" aria-labelledby="statement-title">
          <h2 id="statement-title" className="visually-hidden">
            О выставке
          </h2>
          <p className="statement__lead">
            Каждая работа здесь — одно короткое правило. Повторите его тысячу раз, и из него вырастет бесконечная граница, непредсказуемая траектория или
            сцепленные кольца из четвёртого измерения.
          </p>
          <p className="statement__text">
            Изображения не нарисованы заранее: ваш браузер вычисляет их прямо сейчас по настоящим формулам. Поэтому их можно трогать: приближать,
            поворачивать, менять числа в правиле и смотреть, что из этого выйдет. Знать математику не нужно, достаточно любопытства.
          </p>
        </section>

        <section className="route" aria-labelledby="route-title">
          <h2 id="route-title" className="route__title">
            Маршрут
          </h2>
          <p className="route__meta">
            Четыре зала, {openExhibits.length} {plural(openExhibits.length, ['работа', 'работы', 'работ'])} открыто
          </p>
          <ol className="halls">
            {halls.map((hall) => (
              <li key={hall.id} className="hall-row">
                <div className="hall-row__head">
                  <span className="hall-row__numeral" aria-hidden="true">
                    {hall.numeral}
                  </span>
                  <h3 className="hall-row__title">
                    <Link to={`/hall/${hall.id}`}>
                      <span className="visually-hidden">Зал {hall.numeral}. </span>
                      {hall.title}
                    </Link>
                  </h3>
                  <p className="hall-row__lead">{hall.lead}</p>
                </div>
                <WorkList works={exhibitsInHall(hall.id)} />
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Colophon />
    </>
  );
}

export function Colophon() {
  return (
    <footer className="colophon">
      <div className="colophon__inner">
        <p className="colophon__name">Простое правило</p>
        <p>
          Онлайн-выставка о красоте математики. Все изображения вычисляются в браузере через WebGL2 по описанным на этикетках формулам; приближения и
          ограничения точности указаны в документации проекта.
        </p>
        <p>Шрифты: Literata (TypeTogether) и Golos Text (Paratype).</p>
      </div>
    </footer>
  );
}

function plural(n: number, forms: [string, string, string]) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}
