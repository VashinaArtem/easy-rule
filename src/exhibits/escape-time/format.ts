const MINUS = '−';

function fmt(x: number, digits: number) {
  return Math.abs(x).toFixed(digits).replace('.', ',');
}

/** Russian-style complex number: "−0,745 + 0,113i". */
export function formatComplex(re: number, im: number, digits = 4): string {
  const sRe = (re < 0 ? MINUS : '') + fmt(re, digits);
  return `${sRe} ${im < 0 ? MINUS : '+'} ${fmt(im, digits)}i`;
}

export function formatNumber(x: number, digits = 2): string {
  return (x < 0 ? MINUS : '') + fmt(x, digits);
}

/** Magnification relative to the initial view, e.g. "×1,2·10⁶". */
export function formatZoom(z: number): string {
  if (z < 1000) return `×${z.toFixed(z < 10 ? 1 : 0).replace('.', ',')}`;
  const e = Math.floor(Math.log10(z));
  const m = z / 10 ** e;
  const sup = String(e)
    .split('')
    .map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])
    .join('');
  return `×${m.toFixed(1).replace('.', ',')}·10${sup}`;
}
