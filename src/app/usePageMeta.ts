import { useEffect } from 'react';

const SITE = 'Простое правило';

/** Sets the document title and the browser chrome colour for the current page. */
export function usePageMeta(title: string | null, theme: 'plaster' | 'night') {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE}` : `${SITE} — выставка о красоте математики`;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#0B1024' : '#E3E6E2');
  }, [title, theme]);
}
