import data from './data/overview.json';
import type { Origin } from './geo';

/**
 * The map of Berlin the HUD draws in its corner: the twelve districts, the
 * S-, U- and main-line stations and a few landmarks to find your way by,
 * from scripts/overview-map.ts. The file holds them in EPSG:25833 metres;
 * here they move into the world's own (x east, z south of the origin).
 */

export interface District { name: string; path: Path2D; rings: Float64Array[] }
/** S, U or SU, with an R where main-line trains stop too (OSM says so of most S-Bahn stops); R alone for main line only. */
export interface Station { x: number; z: number; name: string; kind: string }
export interface Landmark { x: number; z: number; name: string }

interface Raw {
  districts: { name: string; rings: number[][] }[];
  stations: [number, number, string, string][];
  landmarks: [number, number, string][];
}

export class Overview {
  readonly districts: District[];
  readonly stations: Station[];
  readonly landmarks: Landmark[];
  /** The city's box in world metres: minX, minZ, maxX, maxZ. */
  readonly box: [number, number, number, number];

  constructor(o: Origin) {
    const raw = data as unknown as Raw;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    this.districts = raw.districts.map((d) => {
      const path = new Path2D();
      const rings = d.rings.map((r) => {
        const xz = new Float64Array(r.length);
        for (let i = 0; i < r.length; i += 2) {
          const x = r[i] - o.e, z = o.n - r[i + 1];
          xz[i] = x;
          xz[i + 1] = z;
          if (i) path.lineTo(x, z); else path.moveTo(x, z);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
        path.closePath();
        return xz;
      });
      return { name: d.name, path, rings };
    });
    this.box = [minX, minZ, maxX, maxZ];
    this.stations = raw.stations.map(([e, n, name, kind]) => ({ x: e - o.e, z: o.n - n, name, kind }));
    this.landmarks = raw.landmarks.map(([e, n, name]) => ({ x: e - o.e, z: o.n - n, name }));
  }

  /** The district a point lies in, if any. */
  districtAt(x: number, z: number): District | null {
    for (const d of this.districts) {
      let inside = false;
      for (const r of d.rings) {
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
          if ((r[i + 1] > z) !== (r[j + 1] > z)
              && x < ((r[j] - r[i]) * (z - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) inside = !inside;
        }
      }
      if (inside) return d;
    }
    return null;
  }

  /**
   * Something close by to say where you are: a landmark within 1.2 km, else
   * a station within 1.5 km, else nothing. With its distance in metres.
   */
  nearest(x: number, z: number): { name: string; d: number } | null {
    const near = <T extends { x: number; z: number }>(list: T[]) => {
      let best: T | null = null, bd = Infinity;
      for (const p of list) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? { p: best, d: bd } : null;
    };
    const l = near(this.landmarks);
    if (l && l.d < 1200) return { name: l.p.name, d: l.d };
    const s = near(this.stations);
    if (s && s.d < 1500) return { name: stationName(s.p), d: s.d };
    return null;
  }
}

/** As the signs put it: S Ostkreuz, U Hermannplatz, S+U Alexanderplatz; a main-line station by its name. */
export function stationName(s: Station): string {
  const su = s.kind.replace('R', '');
  return su ? `${su === 'SU' ? 'S+U' : su} ${s.name}` : s.name;
}

/** S green, U blue, both or a main-line station only white. OSM gives most
 *  S-Bahn stops train=yes, so the R says little beside an S or a U. */
export function stationColour(s: Station): string {
  const su = s.kind.replace('R', '');
  if (su === 'S') return '#4fbf6a';
  if (su === 'U') return '#5b8fe0';
  return '#f2f0ea';
}
