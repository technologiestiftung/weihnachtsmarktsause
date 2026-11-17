/* WGS84 -> EPSG:25833 (ETRS89 / UTM 33N), mirroring pipeline/geo.py so the
   client can place known landmarks without another round trip. */

export interface Origin { e: number; n: number; h: number }
export type XZ = [number, number];

const A = 6378137.0;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const LON0 = (15 * Math.PI) / 180;
const FE = 500000;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

function utm33inv(e: number, n: number): XZ {
  const x = e - FE;
  const y = n;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const m = y / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const p = mu + (3 * e1 / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const sp = Math.sin(p), cp = Math.cos(p), tp = Math.tan(p);
  const c1 = EP2 * cp * cp;
  const t1 = tp * tp;
  const n1 = A / Math.sqrt(1 - E2 * sp * sp);
  const r1 = (A * (1 - E2)) / (1 - E2 * sp * sp) ** 1.5;
  const d = x / (n1 * K0);
  const d2 = d * d, d3 = d2 * d, d4 = d3 * d, d5 = d4 * d, d6 = d5 * d;
  const lat = p - ((n1 * tp) / r1) * (d2 / 2
    - ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d4) / 24
    + ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d6) / 720);
  const lon = LON0 + (d - ((1 + 2 * t1 + c1) * d3) / 6
    + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d5) / 120) / cp;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

/** World metres -> WGS84 lon/lat, for the on-screen position readout. */
export function makeFromWorld(origin: Origin): (x: number, z: number) => XZ {
  return (x, z) => utm33inv(x + origin.e, -z + origin.n);
}
