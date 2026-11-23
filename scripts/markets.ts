/*
 * Builds web/public/data/games/markets.json, the Sause's targets, from the
 * CSV next to it: the season's data of the ODIS Weihnachtsmarktfinder
 * (based on SenWEB's list), so both show the same markets in the same
 * places. Corrections go into the CSV, not here.
 *
 *   npm run data:markets
 *
 * The CSV carries lat/lng and long descriptions; the game needs a name, a
 * place in world metres and when the market is open, so it gets
 * [x, z, name, dates, id, hours, district] per market, a fraction of the size. The id
 * is the finder's (its ?id= links to the market there); hours are the
 * season's first and last day, the times per weekday (Mo..So, '' closed),
 * days closed and days with other times, dates as YYYY-MM-DD. Markets outside Berlin (Potsdam, Bernau, ...) are
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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
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

/** 05.12.26 -> 2026-12-05 */
const isoDate = (d: string) => {
  const [dd, mm, yy] = d.trim().split('.');
  return `20${yy}-${mm}-${dd}`;
};
/** '11:00 - 22:00' -> '11:00-22:00'; '0' or blank -> '' (closed) */
const span = (v: string) => (v && v.trim() !== '0' ? v.replace(/\s*-\s*/, '-').trim() : '');
const list = (v: string) => (v && v.trim() !== '0' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);

interface Hours { f: string; t: string; w: string[]; c?: string[]; h?: Record<string, string> }

const points: [number, number, string, string, number, Hours, string][] = [];
let skipped = 0;
for (const r of rows) {
  if (r[col.ignore] === '1' || !r[col.plz_ort].endsWith('Berlin')) { skipped++; continue; }
  const [e, n] = utm33(Number(r[col.lng]), Number(r[col.lat]));
  const round = (v: number) => Math.round(v * 10) / 10;
  const hours: Hours = {
    f: isoDate(r[col.von]), t: isoDate(r[col.bis]),
    w: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => span(r[col[d]])),
  };
  const closed = list(r[col['closed-exc']]).map(isoDate);
  if (closed.length) hours.c = closed;
  const other = list(r[col['hours-exc']]).map((x) => x.split('=') as [string, string]);
  if (other.length) hours.h = Object.fromEntries(other.map(([d, v]) => [isoDate(d), span(v)]));
  points.push([round(e - ORIGIN.e), round(ORIGIN.n - n), r[col.shortname] || r[col.name],
    `${r[col.von]} – ${r[col.bis]}`, Number(r[col.id]), hours, r[col.bezirk]]);
}

writeFileSync(OUT, JSON.stringify({ attribution: `Weihnachtsmärkte ${YEAR}, SenWEB Berlin / ODIS (CC BY)`, points }));
console.log(`${points.length} markets (${skipped} outside Berlin) -> ${OUT.pathname}`);
