// Renders each exhibit at 800×560 without its UI and saves public/thumbs/<id>.jpg, plus public/og.jpg.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://localhost:5173';
const views = {
  mandelbrot: ['/work/mandelbrot?x=-0.7436438870371587&y=0.13182590420531198&s=1.2e-9', 3500],
  julia: ['/work/julia?c=-0.7269,0.1889&palette=pearl', 2500],
  newton: ['/work/newton', 2500],
  lorenz: ['/work/lorenz', 14000],
  'gray-scott': ['/work/gray-scott?F=0.0545&k=0.062', 14000],
  fourier: ['/work/fourier?shape=heart&n=40', 5000],
  modular: ['/work/modular?k=2&n=300', 2500],
  hopf: ['/work/hopf', 3000],
};
await mkdir('public/thumbs', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 560 } });
await page.addInitScript(() => {
  /* eslint-disable no-undef -- runs in the browser page */
  const style = document.createElement('style');
  style.textContent = '.label,.panel,.room__bar,.crosshair,.skip-link{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  /* eslint-enable no-undef */
});
for (const [id, [path, wait]] of Object.entries(views)) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `public/thumbs/${id}.jpg`, type: 'jpeg', quality: 84 });
  console.log('thumb', id);
}
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(base + '/', { waitUntil: 'networkidle' });
await og.waitForTimeout(3000);
await og.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 86 });
console.log('og');
await browser.close();
