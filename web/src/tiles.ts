/* Readers for the binary formats the city's tiles come in. */

function magicOf(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf, 0, 4);
  return String.fromCharCode(b[0], b[1], b[2], b[3]);
}

/**
 * "BTT1" bare-earth terrain from the airborne laser scan, 1 m cells.
 *
 * Cell values sit at cell centres, so sampling shifts by half a cell before
 * interpolating bilinearly. Row 0 is the north edge.
 */
export class TerrainField {
  readonly minX: number;
  readonly minZ: number;
  readonly cell: number;
  readonly nx: number;
  readonly nz: number;
  readonly hmin: number;
  readonly hscale: number;
  readonly data: Uint16Array;

  constructor(buf: ArrayBuffer) {
    if (magicOf(buf) !== 'BTT1') throw new Error('bad terrain file');
    const dv = new DataView(buf);
    this.minX = dv.getFloat32(4, true);
    this.minZ = dv.getFloat32(8, true);
    this.cell = dv.getFloat32(12, true);
    this.nx = dv.getUint32(16, true);
    this.nz = dv.getUint32(20, true);
    this.hmin = dv.getFloat32(24, true);
    this.hscale = dv.getFloat32(28, true);
    this.data = new Uint16Array(buf, 32, this.nx * this.nz);
  }

  /** Height at a cell, clamped to the grid. */
  at(i: number, j: number): number {
    i = Math.min(Math.max(i, 0), this.nx - 1);
    j = Math.min(Math.max(j, 0), this.nz - 1);
    return this.hmin + this.data[j * this.nx + i] * this.hscale;
  }

  height(x: number, z: number): number {
    const fx = (x - this.minX) / this.cell - 0.5;
    const fz = (z - this.minZ) / this.cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const a = this.at(i, j), b = this.at(i + 1, j);
    const c = this.at(i, j + 1), d = this.at(i + 1, j + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
}

/** One tree from the Berlin cadastre, sizes in metres. */
export interface Tree {
  x: number;
  z: number;
  y: number;
  height: number;
  crown: number;
  trunk: number;
  form: number;         // 0 broadleaf, 1 conifer, 2 columnar
  genus: number;
}

/** "BTR1" tree list - see pipeline/trees.py. */
export function parseTrees(buf: ArrayBuffer): Tree[] {
  if (magicOf(buf) !== 'BTR1') throw new Error('bad tree file');
  const n = new DataView(buf).getUint32(4, true);
  let o = 8;
  const f32 = () => { const a = new Float32Array(buf, o, n); o += n * 4; return a; };
  const u16 = () => { const a = new Uint16Array(buf, o, n); o += n * 2; return a; };
  const u8 = () => { const a = new Uint8Array(buf, o, n); o += n; return a; };
  const xs = f32(), zs = f32(), ys = f32();
  const hs = u16(), cs = u16(), ts = u16();
  const fs = u8(), gs = u8();
  const out: Tree[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: xs[i], z: zs[i], y: ys[i], height: hs[i] / 100,
               crown: cs[i] / 100, trunk: ts[i] / 1000, form: fs[i], genus: gs[i] });
  }
  return out;
}
