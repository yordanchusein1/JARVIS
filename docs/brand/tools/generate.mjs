// Regenerates the Arclight logo files in docs/brand.
// Usage (from an empty folder): npm install opentype.js @fontsource/space-grotesk
//   then: node generate.mjs path/to/docs/brand

import fs from 'node:fs';
import opentype from 'opentype.js';

const out = process.argv[2];
const font = opentype.parse(
  fs.readFileSync(
    'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff',
  ).buffer,
);

// Wordmark: ARCLIGHT with generous tracking, baseline at y=0, cap height ~ 0.7em.
function wordmarkPath(text, size, tracking) {
  let x = 0;
  const parts = [];
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    parts.push(glyph.getPath(x, 0, size).toPathData(2));
    x += (glyph.advanceWidth / font.unitsPerEm) * size + tracking;
  }
  return { d: parts.join(''), width: x - tracking };
}

const MARK = (stroke, core, a, w = 3.6, r = 3.4) => `
  <path d="M20.59 56.47A27 27 0 1 1 43.41 56.47" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>
  <path d="M21.5 45.5L32 20.5L42.5 45.5" fill="none" stroke="${a}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="37" r="${r}" fill="${core}"/>`;

// Dark backgrounds get the bright arc; light backgrounds a deeper one for contrast.
const STOPS = {
  dark: ['#B8F1FF', '#3FD0FF', '#0A8CC4'],
  light: ['#12B5F0', '#0A8CC4', '#0B6A95'],
};
const gradient = (id, tone = 'dark') =>
  `<defs><linearGradient id="${id}" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${STOPS[tone][0]}"/><stop offset="0.55" stop-color="${STOPS[tone][1]}"/><stop offset="1" stop-color="${STOPS[tone][2]}"/></linearGradient></defs>`;

const files = {};
files['mark.svg'] =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Arclight">${gradient('arc')}${MARK('url(#arc)', '#7FE3FF', 'url(#arc)')}</svg>\n`;
files['mark-on-light.svg'] =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Arclight">${gradient('arc', 'light')}${MARK('url(#arc)', '#12B5F0', 'url(#arc)')}</svg>\n`;
// Favicon: heavier strokes so the mark survives at 16px.
files['favicon.svg'] =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${gradient('arc')}<rect width="64" height="64" rx="14" fill="#04070C"/><g transform="translate(2.5 2.5) scale(0.92)">${MARK('url(#arc)', '#B8F1FF', 'url(#arc)', 6.2, 5)}</g></svg>\n`;
files['mark-mono.svg'] =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Arclight">${MARK('currentColor', 'currentColor', 'currentColor')}</svg>\n`;
// App icon: mark on the ink background, rounded square.
files['app-icon.svg'] =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Arclight">${gradient('arc')}<rect width="64" height="64" rx="14" fill="#04070C"/><g transform="translate(6 6) scale(0.8125)">${MARK('url(#arc)', '#B8F1FF', 'url(#arc)')}</g></svg>\n`;

const size = 30;
const { d, width } = wordmarkPath('ARCLIGHT', size, 4.2);
const capTop = -21; // cap height of Space Grotesk SemiBold at 30px
const markSize = 44;
const gap = 14;
const h = markSize;
const textY = h / 2 - capTop / 2; // vertically centre caps on the mark
const W = Math.ceil(markSize + gap + width + 2);
for (const [name, text, tone, core] of [
  ['logo-on-dark.svg', '#E8EEF6', 'dark', '#7FE3FF'],
  ['logo-on-light.svg', '#0A1220', 'light', '#12B5F0'],
]) {
  files[name] =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" role="img" aria-label="Arclight">${gradient('arc', tone)}<g transform="scale(${markSize / 64})">${MARK('url(#arc)', core, 'url(#arc)')}</g><path transform="translate(${markSize + gap} ${textY.toFixed(2)})" fill="${text}" d="${d}"/></svg>\n`;
}
files['wordmark.svg'] =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${capTop - 1} ${Math.ceil(width)} ${-capTop + 2}" role="img" aria-label="Arclight"><path fill="currentColor" d="${d}"/></svg>\n`;

// Report cap height so the constant above can be checked.
const bb = font.getPath('H', 0, 0, size).getBoundingBox();
console.log('cap top', bb.y1.toFixed(2), 'wordmark width', width.toFixed(1));
for (const [name, svg] of Object.entries(files)) fs.writeFileSync(`${out}/${name}`, svg);
console.log(Object.keys(files).join(', '));
