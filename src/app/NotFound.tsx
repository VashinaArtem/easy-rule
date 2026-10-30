import { Link } from 'react-router';
import { usePageMeta } from './usePageMeta';

export function NotFound() {
  usePageMeta('Нет такого зала', 'plaster');
  return (
    <main id="content" className="not-found">
      <p className="formula not-found__rule">z → ∞</p>
      <h1>Этой страницы нет</h1>
      <p>Адрес ушёл в бесконечность. Вернитесь в фойе и выберите зал.</p>
      <Link to="/" className="text-link">
        Вернуться в фойе
      </Link>
    </main>
  );
}
