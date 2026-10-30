// Visits routes at several viewports, fails on console errors, saves screenshots.
// Usage: node scripts/screenshots.mjs [baseUrl] [--only=route1,route2] [--vp=desktop,tablet,phone] [--out=dir] [--wait=ms]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : fallback;
};
const base = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:5173';
const out = opt('out', 'docs/screenshots');
const wait = Number(opt('wait', '2500'));

const allRoutes = {
  lobby: '/',
  'hall-infinity': '/hall/infinity',
  'hall-dimensions': '/hall/dimensions',
  mandelbrot: '/work/mandelbrot',
  'mandelbrot-seahorse': '/work/mandelbrot?x=-0.7453&y=0.1127&s=0.0065&palette=pearl',
  'mandelbrot-deep': '/work/mandelbrot?x=-0.7436438870371587&y=0.13182590420531198&s=1.2e-9',
  julia: '/work/julia',
  newton: '/work/newton',
  lorenz: '/work/lorenz',
  'lorenz-butterfly': '/work/lorenz?mode=butterfly',
  'lorenz-butterfly': '/work/lorenz?mode=butterfly',
  'gray-scott': '/work/gray-scott',
  'gray-scott-atlas': '/work/gray-scott?atlas=1',
  'gray-scott-coral': '/work/gray-scott?F=0.0545&k=0.062',
  fourier: '/work/fourier',
  'fourier-square': '/work/fourier?shape=square&n=9',
  modular: '/work/modular',
  'modular-nephroid': '/work/modular?k=3&n=400',
  'modular-frac': '/work/modular?k=34.37&n=500',
  'modular-nephroid': '/work/modular?k=3&n=400',
  'modular-frac': '/work/modular?k=34.37&n=500',
  hopf: '/work/hopf',
  'not-found': '/no-such-room',
};
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const only = opt('only', '');
const routes = Object.entries(allRoutes).filter(([name]) => !only || only.split(',').includes(name));
const vps = Object.entries(viewports).filter(([name]) => opt('vp', 'desktop,tablet,phone').split(',').includes(name));

await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL || undefined,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
let failures = 0;
for (const [vpName, vp] of vps) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...vp, reducedMotion: opt('motion', 'no-preference') });
  for (const [name, path] of routes) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(wait);
    const file = `${out}/${name}-${vpName}.png`;
    await page.screenshot({ path: file });
    const status = errors.length ? `FAIL (${errors.length} errors)` : 'ok';
    console.log(`${status.padEnd(16)} ${vpName.padEnd(8)} ${path}`);
    for (const e of errors) console.log('    ', e.slice(0, 300));
    if (errors.length) failures++;
    await page.close();
  }
  await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
