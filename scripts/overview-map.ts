/*
 * Builds web/src/data/overview.json, the HUD's map of Berlin: the
 * twelve districts' outlines, the S- and U-Bahn and main-line stations, and
 * a hand-picked list of landmarks to find your way by.
 *
 *   npm run data:overview
 *
 * Districts: ALKIS Bezirksgrenzen (Geoportal Berlin, dl-de/zero-2.0), as
 * the GeoJSON the Technologiestiftung's ODIS keeps. Stations: OpenStreetMap
 * (ODbL) via Overpass. Landmarks: a list picked by hand - the open data
 * portal has none, only the Denkmalliste's thousands of monuments - placed
 * with OpenStreetMap's Nominatim, one name a second as its policy asks. Everything is projected to EPSG:25833
 * and written as whole metres east and north, so the client places it with
 * the world's origin like everything else (web/src/geo.ts). Outlines are
 * thinned to SIMPLIFY metres - plenty for a map 190 px across.
 *
 * Plain Node runs it (TypeScript is stripped, Node 23.6+).
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const BEZIRKE = 'https://tsb-opendata.s3.eu-central-1.amazonaws.com/bezirksgrenzen/bezirksgrenzen.geojson';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// bundled with the client: small, and the same for every build of the city
const OUT = new URL('../web/src/data/overview.json', import.meta.url);
const SIMPLIFY = 25;

/**
 * Landmarks: an OSM name, and the name shown if it differs. Picked to be
 * seen from the air and known to anyone in Berlin, spread over the city.
 */
const LANDMARKS: [string, string?][] = [
  ['Brandenburger Tor'], ['Berliner Fernsehturm', 'Fernsehturm'], ['Reichstagsgebäude', 'Reichstag'],
  ['Siegessäule'], ['Berliner Dom'], ['Rotes Rathaus'], ['Kaiser-Wilhelm-Gedächtniskirche', 'Gedächtniskirche'],
  ['Schloss Charlottenburg'], ['Olympiastadion'], ['Funkturm Berlin', 'Funkturm'], ['East Side Gallery'],
  ['Oberbaumbrücke'], ['Tempelhofer Feld'], ['Zitadelle Spandau'], ['Teufelsberg'],
  ['Sowjetisches Ehrenmal Treptow'], ['Schloss Köpenick'], ['Müggelturm'], ['Gendarmenmarkt'],
  ['Checkpoint Charlie'], ['Potsdamer Platz'], ['Alexanderplatz'], ['Mauerpark'], ['Großer Müggelsee'],
  ['Tierpark Berlin'], ['Gärten der Welt'], ['Schloss Tegel'], ['Britzer Garten'], ['Grunewaldturm'],
  ['Pfaueninsel'], ['Rathaus Schöneberg'], ['Tegeler See'],
];

/* --- WGS84 -> UTM 33N, the inverse of web/src/geo.ts -------------------------- */

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
  return [Math.round(e), Math.round(north)];
}

/** Douglas-Peucker on a closed ring: two open halves, split at the point farthest from the start. */
function simplify(ring: [number, number][], tol: number): [number, number][] {
  const [x0, y0] = ring[0];
  let far = 0;
  ring.forEach(([x, y], i) => { if (Math.hypot(x - x0, y - y0) > Math.hypot(ring[far][0] - x0, ring[far][1] - y0)) far = i; });
  return [...simplifyOpen(ring.slice(0, far + 1), tol), ...simplifyOpen(ring.slice(far), tol).slice(1)];
}

function simplifyOpen(pts: [number, number][], tol: number): [number, number][] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    let far = -1, at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs(dy * (pts[k][0] - ax) - dx * (pts[k][1] - ay)) / len;
      if (d > far) { far = d; at = k; }
    }
    if (far > tol) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

type OsmElement = { tags: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } };

/** A query, tried on the main server and a mirror, a few times: both are busy. */
async function overpass(q: string): Promise<{ elements: OsmElement[] }> {
  for (let i = 0; i < 6; i++) {
    // Overpass turns away requests that do not say who they are
    try {
      const res = await fetch(OVERPASS[i % OVERPASS.length], { method: 'POST', body: new URLSearchParams({ data: q }),
                                                                headers: { 'User-Agent': 'weihnachtsmarktsause/overview-map' },
                                                                signal: AbortSignal.timeout(90_000) });
      if (res.ok) return await res.json();
      console.warn(`Overpass ${res.status}, trying again`);
    } catch (err) {
      console.warn(`Overpass: ${(err as Error).message}, trying again`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Overpass unreachable');
}

const AREA = 'area["name"="Berlin"]["admin_level"="4"]->.b;';

/* --- districts ----------------------------------------------------------------- */

const geo = await (await fetch(BEZIRKE)).json() as {
  features: { properties: { Gemeinde_name: string }; geometry: { coordinates: number[][][][] } }[];
};
const districts = geo.features.map((f) => ({
  name: f.properties.Gemeinde_name,
  // outer rings only; the few slivers Pankow has are too small to see
  rings: f.geometry.coordinates
    .map((poly) => simplify(poly[0].map(([lon, lat]) => utm33(lon, lat)), SIMPLIFY))
    .filter((r) => r.length > 8)
    .map((r) => r.flat()),
}));

/* --- stations ------------------------------------------------------------------ */

console.log('stations');
const st = await overpass(`[out:json][timeout:90];${AREA}
  nwr["railway"="station"](area.b);out center tags;`);
const byName = new Map<string, { name: string; e: number; n: number; s: boolean; u: boolean; r: boolean }>();
for (const el of st.elements) {
  const tg = el.tags, at = el.center ?? el;
  if (!tg.name || at.lat === undefined) continue;
  const u = tg.station === 'subway' || tg.subway === 'yes';
  const s = tg.station === 'light_rail' || tg.light_rail === 'yes';
  const r = tg.station === 'train' || tg.train === 'yes' || !tg.station && !u && !s;
  // museum lines and the like
  if (tg.usage === 'tourism' || ['monorail', 'funicular', 'miniature'].includes(tg.station)) continue;
  // "S+U Alexanderplatz" and "S Alexanderplatz" are one stop on the map
  // and so are "Berlin Hauptbahnhof", "Berlin Hauptbahnhof (tief)" and "... Tunnel (S-Bahn)"
  const name = tg.name.replace(/^(S\+U|S|U)\s+/, '').replace(/^Berlin[- ]/, '')
    .replace(/\s*(Tunnel)?\s*\([^)]*\)$/, '');
  const [e, n] = utm33(at.lon!, at.lat!);
  const old = byName.get(name);
  if (old && Math.hypot(old.e - e, old.n - n) < 600) {
    old.s ||= s; old.u ||= u; old.r ||= r;
  } else {
    byName.set(old ? `${name}#${e}` : name, { name, e, n, s, u, r });
  }
}
const stations = [...byName.values()]
  .filter((x) => x.s || x.u || x.r)
  // S, U, SU, with R where main-line trains stop too
  .map((x) => [x.e, x.n, x.name, (x.s ? 'S' : '') + (x.u ? 'U' : '') + (x.r ? 'R' : '')]);

/* --- landmarks ----------------------------------------------------------------- */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const landmarks: [number, number, string][] = [];
for (const [osm, shown] of LANDMARKS) {
  const q = new URLSearchParams({ q: osm, format: 'jsonv2', limit: '1', bounded: '1',
                                  viewbox: '13.08,52.68,13.77,52.33' });
  const res = await fetch(`${NOMINATIM}?${q}`, { headers: { 'User-Agent': 'weihnachtsmarktsause/overview-map' } });
  const [hit] = res.ok ? await res.json() as { lat: string; lon: string; display_name: string }[] : [];
  if (hit) {
    landmarks.push([...utm33(Number(hit.lon), Number(hit.lat)), shown ?? osm]);
    console.log(`${osm}: ${hit.display_name.split(',').slice(0, 3).join(',')}`);
  } else {
    console.warn(`landmark not found: ${osm}`);
  }
  await new Promise((r) => setTimeout(r, 1100));
}

mkdirSync(new URL('.', OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  attribution: 'Bezirksgrenzen: Geoportal Berlin (dl-de/zero-2.0) · Bahnhöfe, Orte: © OpenStreetMap-Mitwirkende (ODbL)',
  districts, stations, landmarks,
}));
console.log(`${districts.length} districts, ${stations.length} stations, ${landmarks.length} landmarks -> ${OUT.pathname}`);
