# Простое правило

Онлайн-выставка о красоте математики. Восемь открытых работ в четырёх залах, на русском языке. Каждая работа — живое вычисление: фракталы, дифференциальные уравнения, преобразование Фурье, расслоение Хопфа.

Сайт: локально через Vite; готов к деплою на Vercel, Netlify или GitHub Pages.

## Запуск

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/
npm run preview      # проверка production-сборки
```

## Проверки

```bash
npm test             # 63 математических теста (Vitest)
npm run typecheck
npm run lint
npm run shots        # скриншоты через Playwright + системный Chrome
                     # PW_CHANNEL=chrome npm run shots -- --only=mandelbrot --vp=desktop
```

Миниатюры для фойе: `node scripts/thumbs.mjs` (нужен запущенный `npm run dev`).

## Деплой

Сборка — статический `dist/`. SPA-роутинг уже настроен:

| Платформа | Что делает |
|-----------|------------|
| **Vercel** | `vercel.json` переписывает все пути на `index.html` |
| **Netlify** | `public/_redirects` → `/* /index.html 200` |
| **GitHub Pages** | выложите `dist/`; для подпути задайте `base` в `vite.config.ts` |

На Vercel/Netlify достаточно подключить репозиторий: build command `npm run build`, output `dist`.

## Структура

```
src/
  app/           # фойе, залы, страница работы, роутер
  exhibits/      # по одной папке на работу + registry.ts
  gl/            # WebGL2, df64, матрицы, вид плоскости
  hooks/         # кадр, URL-состояние, pan/zoom, reduced motion
  ui/            # Panel, Slider, Choice…
  styles/        # global, lobby, room
scripts/         # screenshots.mjs, thumbs.mjs
docs/            # CONCEPT, EXHIBITS, PROGRESS, screenshots/
public/thumbs/   # превью работ для списков залов
```

## Документация

- [docs/CONCEPT.md](docs/CONCEPT.md) — идея и устройство выставки
- [docs/EXHIBITS.md](docs/EXHIBITS.md) — открытые работы и математика
- [docs/PROGRESS.md](docs/PROGRESS.md) — статус, проверки, ограничения
