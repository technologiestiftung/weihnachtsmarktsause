/*
 * Builds web/public/data/games/markets.json, the Sause's targets, from the
 * CSV next to it: the season's data of the ODIS Weihnachtsmarktfinder
 * (based on SenWEB's list), so both show the same markets in the same
 * places. Corrections go into the CSV, not here.
 *
 *   npm run data:markets
 *
 * The CSV carries lat/lng and long descriptions; the game needs a name and
 * a place in world metres, so it gets [x, z, name, dates] per market, about
 * a twentieth of the size. Markets outside Berlin (Potsdam, Bernau, ...) are
 * left out: the 3D city ends at the border. ORIGIN is the tile manifest's
 * (world.json), as in web/src/geo.ts.
 *
 * Plain Node runs it (TypeScript is stripped, Node 23.6+).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const YEAR = 2026;
const SRC = new URL(`../web/public/data/games/markets_${YEAR}.csv`, import.meta.url);
const OUT = new URL('../web/public/data/games/markets.json', import.meta.url);
const ORIGIN = { e: 389500, n: 5819500 };

/* --- WGS84 -> UTM 33N, as in scripts/overview-map.ts ------------------------- */

const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const LON0 = (15 * Math.PI) / 180;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

function utm33(lon: number, lat: number): [number, number] {
  const p = (lat * Math.PI) / 180, l = (lon * Math.PI) / 180;
  const n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  const t = Math.tan(p) ** 2;
  const c = EP2 * Math.cos(p) ** 2;
  const a = Math.cos(p) * (l - LON0);
  const m = A * ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * p
    - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * p)
    + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * p)
    - ((35 * E2 ** 3) / 3072) * Math.sin(6 * p));
  const e = K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) + 500000;
  const north = K0 * (m + n * Math.tan(p) * (a * a / 2 + ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24
    + ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  return [e, north];
}

/* --- CSV: quoted fields may hold commas, quotes ("") and line breaks --------- */

/** Comma- or, from a German spreadsheet, semicolon-separated: whichever the header uses. */
function parseCsv(text: string): string[][] {
  const sep = text.slice(0, text.indexOf('\n')).includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some(Boolean));
}

const [head, ...rows] = parseCsv(readFileSync(SRC, 'utf8').replace(/^﻿/, ''));
const col = Object.fromEntries(head.map((h, i) => [h, i]));

const points: [number, number, string, string][] = [];
let skipped = 0;
for (const r of rows) {
  if (r[col.ignore] === '1' || !/berlin$/i.test(r[col.plz_ort].trim())) { skipped++; continue; }
  const [e, n] = utm33(Number(r[col.lng]), Number(r[col.lat]));
  const round = (v: number) => Math.round(v * 10) / 10;
  points.push([round(e - ORIGIN.e), round(ORIGIN.n - n), r[col.shortname] || r[col.name], `${r[col.von]} – ${r[col.bis]}`]);
}

writeFileSync(OUT, JSON.stringify({ attribution: `Weihnachtsmärkte ${YEAR}, SenWEB Berlin / ODIS (CC BY)`, points }));
console.log(`${points.length} markets (${skipped} outside Berlin) -> ${OUT.pathname}`);
