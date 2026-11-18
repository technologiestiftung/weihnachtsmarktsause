import * as THREE from 'three';
import { bridgeMaterial, type GroundTextures } from './materials';

/**
 * Bridge decks from pipeline/bridges.py.
 *
 * The terrain under a bridge is whatever runs beneath it - the river, the
 * tracks - so the deck is a slab of its own: a strip along the bridge at the
 * height the laser scan measured, paved like the street it carries.
 * Decks are also somewhere to stand: World asks them for the surface under
 * the player, so you can cross the Spree on foot and drive under a viaduct.
 */

export type DeckKind = 'road' | 'path' | 'rail';

interface DeckData {
  k: DeckKind;
  /** Slab thickness, metres. */
  t: number;
  /** Stations along the deck: x, z, deck height, width to the left and to
   *  the right of the line (world metres; left is (-dz, dx)). */
  p: [number, number, number, number, number][];
  /** Complete ALKIS/OSM surface; vertices are x, z, y in world metres. */
  mesh?: { v: [number, number, number][]; i: number[]; r: number[][]; rails?: number[][]; clip?: [number, number, number, number] };
  assembled?: boolean;
  name?: string;
  material?: string;
  structure?: string;
  railing?: string;
  covered?: boolean;
  axis?: [number, number];
}

type Vertex = [number, number, number]; // x, y, z
interface Section { left: Vertex; right: Vertex }
interface Surface { vertices: Vertex[]; indices: number[]; rings: number[][] }
interface Solid { ring: [number, number][]; low: number; high: number }

/** One set of mitred edges for rendering, collision and the ground mask. */
function sections(d: DeckData): Section[] {
  return d.p.map(([x, z, y, left, right], i, p) => {
    const direction = (a: typeof p[number], b: typeof p[number]) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    };
    const before = direction(p[Math.max(0, i - 1)], p[i === 0 ? 1 : i]);
    const after = direction(p[i === p.length - 1 ? i - 1 : i], p[Math.min(p.length - 1, i + 1)]);
    const length = Math.hypot(before[0] + after[0], before[1] + after[1]);
    const dx = length > 1e-6 ? (before[0] + after[0]) / length : after[0];
    const dz = length > 1e-6 ? (before[1] + after[1]) / length : after[1];
    const miter = 1 / Math.max(0.5, dx * after[0] + dz * after[1]);
    return { left: [x - dz * left * miter, y + LIFT[d.k], z + dx * left * miter],
             right: [x + dz * right * miter, y + LIFT[d.k], z - dx * right * miter] };
  });
}

/** Barycentric height on precisely the triangles used by the visible top. */
function triangleHeight(x: number, z: number, a: Vertex, b: Vertex, c: Vertex): number | null {
  const ex = b[0] - a[0], ez = b[2] - a[2], fx = c[0] - a[0], fz = c[2] - a[2];
  const det = ex * fz - ez * fx;
  if (Math.abs(det) < 1e-9) return null;
  const u = ((x - a[0]) * fz - (z - a[2]) * fx) / det;
  const v = (ex * (z - a[2]) - ez * (x - a[0])) / det;
  return u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8 ? a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]) : null;
}

function edgeDistance2(x: number, z: number, a: Vertex, b: Vertex): number {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  return (x - a[0] - f * dx) ** 2 + (z - a[2] - f * dz) ** 2;
}

/** A pier from the cadastre: its outline, from y0 up to the deck at y1. */
interface PierData { r: [number, number][]; y0: number; y1: number }
/** A canopy the cadastre has and OSM lacks: outline, roof height, thickness. */
interface RoofData { r: [number, number][]; y: number; t: number }

/** Coplanar decks side by side (a road and its separately mapped pavement)
 *  would flicker where they overlap; these lift them apart. */
const LIFT: Record<DeckKind, number> = { road: 0, rail: 0.015, path: 0.03 };
const CELL = 32;

export interface DeckHit {
  y: number;
  kind: DeckKind;
  /** Unit direction of the deck there. */
  dx: number;
  dz: number;
}

export class Decks {
  private readonly decks: DeckData[];
  private readonly surfaces: Surface[];
  private readonly piers: PierData[];
  private readonly roofs: RoofData[];
  /** Segment references (deck, station) by CELL-metre bucket. */
  private readonly buckets = new Map<string, [number, number][]>();
  private readonly borders = new Map<string, [number, Vertex, Vertex][]>();
  private readonly solids = new Map<string, Solid[]>();

  constructor(data: { decks: DeckData[]; piers?: PierData[]; roofs?: RoofData[] }) {
    this.piers = data.piers ?? [];
    this.roofs = data.roofs ?? [];
    // older files give one half width for both sides
    this.decks = data.decks.map((d) => ({
      ...d, p: d.p.map((q) => (q.length >= 5 ? q : [q[0], q[1], q[2], q[3], q[3]]) as DeckData['p'][number])
        .filter((q, i, p) => q.every(Number.isFinite) && (i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > 1e-5)),
    })).filter((d) => d.p.length >= 2);
    this.surfaces = this.decks.map((d) => {
      if (d.mesh) return { vertices: d.mesh.v.map(([x, z, y]) => [x, y + LIFT[d.k], z] as Vertex), indices: d.mesh.i, rings: d.mesh.r };
      const es = sections(d), vertices = es.flatMap((s) => [s.left, s.right]);
      const indices: number[] = [];
      for (let i = 0; i + 1 < es.length; i++) {
        const k = i * 2;
        indices.push(k, k + 2, k + 3, k, k + 3, k + 1);
      }
      return { vertices, indices, rings: [es.map((_, i) => i * 2).concat(es.map((_, i) => i * 2 + 1).reverse())] };
    });
    this.decks.forEach((d, di) => {
      const surface = this.surfaces[di];
      for (let i = 0; i + 2 < surface.indices.length; i += 3) {
        const pts = surface.indices.slice(i, i + 3).map((j) => surface.vertices[j]);
        const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
        const z0 = Math.min(...pts.map((p) => p[2])), z1 = Math.max(...pts.map((p) => p[2]));
        for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
          for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
            const key = `${cx},${cz}`;
            let list = this.buckets.get(key);
            if (!list) this.buckets.set(key, list = []);
              list.push([di, i]);
          }
        }
      }
    });
    // edges once every deck is in the buckets: a seam with another needs both
    this.decks.forEach((d, di) => {
      const surface = this.surfaces[di];
      for (const ring of surface.rings) {
        for (let i = 0; i < ring.length; i++) {
          const a = surface.vertices[ring[i]], b = surface.vertices[ring[(i + 1) % ring.length]];
          if (this.cutEdge(d, a, b)) continue;
          const edgeLength = Math.hypot(b[0] - a[0], b[2] - a[2]);
          if (!d.mesh) {
            const last = surface.vertices.length - 1;
            const pair = [ring[i], ring[(i + 1) % ring.length]].sort((a, b) => a - b);
            if ((pair[0] === 0 && pair[1] === 1) || (pair[0] === last - 1 && pair[1] === last)) continue;
          } else if (d.axis && edgeLength > 0 && Math.abs((b[0] - a[0]) * d.axis[0] + (b[2] - a[2]) * d.axis[1]) / edgeLength < 0.55) {
            continue; // a landing, not a guardrail: do not inset it into a gap
          }
          if (this.seam(di, a, b)) continue;
          for (let x = Math.floor((Math.min(a[0], b[0]) - 1) / CELL); x <= Math.floor((Math.max(a[0], b[0]) + 1) / CELL); x++) {
            for (let z = Math.floor((Math.min(a[2], b[2]) - 1) / CELL); z <= Math.floor((Math.max(a[2], b[2]) + 1) / CELL); z++) {
              const key = `${x},${z}`;
              let list = this.borders.get(key);
              if (!list) this.borders.set(key, list = []);
              list.push([di, a, b]);
            }
          }
        }
      }
    });
    for (const solid of [...this.piers.map((p) => ({ ring: p.r, low: p.y0, high: p.y1 })),
      ...this.roofs.map((r) => ({ ring: r.r, low: r.y - r.t, high: r.y }))]) {
      if (solid.ring.length < 3) continue;
      const xs = solid.ring.map((p) => p[0]), zs = solid.ring.map((p) => p[1]);
      for (let x = Math.floor((Math.min(...xs) - 0.15) / CELL); x <= Math.floor((Math.max(...xs) + 0.15) / CELL); x++) {
        for (let z = Math.floor((Math.min(...zs) - 0.15) / CELL); z <= Math.floor((Math.max(...zs) + 0.15) / CELL); z++) {
          const key = `${x},${z}`;
          let list = this.solids.get(key);
          if (!list) this.solids.set(key, list = []);
          list.push(solid);
        }
      }
    }
  }

  private cutEdge(d: DeckData, a: Vertex, b: Vertex): boolean {
    const clip = d.mesh?.clip;
    return !!clip && ((Math.abs(a[0] - clip[0]) < 0.002 && Math.abs(b[0] - clip[0]) < 0.002)
      || (Math.abs(a[0] - clip[2]) < 0.002 && Math.abs(b[0] - clip[2]) < 0.002)
      || (Math.abs(a[2] - clip[1]) < 0.002 && Math.abs(b[2] - clip[1]) < 0.002)
      || (Math.abs(a[2] - clip[3]) < 0.002 && Math.abs(b[2] - clip[3]) < 0.002));
  }

  /**
   * Does another deck of the same kind carry on past this edge, at its
   * level? Then it is a seam between two pieces of one road - Lutherbrücke's
   * approach is four - not a drop, and no reason to keep off it: inset from
   * every piece's own edges, a car found no lane through their overlap.
   */
  private seam(di: number, a: Vertex, b: Vertex): boolean {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) return false;
    const nx = -dz / l * 0.3, nz = dx / l * 0.3;
    const kind = this.decks[di].k;
    // at (x, z) within `near` of height y: this deck (self), or another of its kind
    const on = (x: number, z: number, self: boolean, y: number, near = 0.3) => {
      for (const [dj, i] of this.buckets.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
        if ((dj === di) !== self || this.decks[dj].k !== kind) continue;
        const s = this.surfaces[dj];
        const h = triangleHeight(x, z, s.vertices[s.indices[i]], s.vertices[s.indices[i + 1]], s.vertices[s.indices[i + 2]]);
        if (h !== null && Math.abs(h - y) < near) return true;
      }
      return false;
    };
    return [0.2, 0.5, 0.8].every((t) => {
      const x = a[0] + dx * t, z = a[2] + dz * t, y = a[1] + (b[1] - a[1]) * t;
      // a deck folded over itself, both carriageways in one piece: an edge
      // across its turn can lie a step off the surface on either side
      if (on(x + nx, z + nz, true, y, 1.0) && on(x - nx, z - nz, true, y, 1.0)) return true;
      const plus = on(x + nx, z + nz, true, y);
      return plus ? on(x - nx, z - nz, false, y) : on(x + nx, z + nz, false, y);
    });
  }

  /** Every deck over (x, z), at least `inset` metres in from its edges. */
  at(x: number, z: number, inset = 0): DeckHit[] {
    const out: DeckHit[] = [];
    const seen = new Set<number>();
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    const blocked = new Set<number>();
    if (inset > 0) for (const [di, a, b] of this.borders.get(key) ?? []) {
      if (edgeDistance2(x, z, a, b) < inset * inset) blocked.add(di);
    }
    for (const [di, i] of this.buckets.get(key) ?? []) {
      if (seen.has(di)) continue;
      if (blocked.has(di)) continue;
      const d = this.decks[di];
      const s = this.surfaces[di];
      const y = triangleHeight(x, z, s.vertices[s.indices[i]], s.vertices[s.indices[i + 1]], s.vertices[s.indices[i + 2]]);
      if (y === null) continue;
      const segment = d.mesh ? 0 : Math.floor(i / 6);
      const [ax, az] = d.p[segment];
      const [bx, bz] = d.p[segment + 1];
      const ex = bx - ax, ez = bz - az;
      const l = Math.hypot(ex, ez);
      out.push({ y, kind: d.k, dx: d.axis?.[0] ?? ex / l, dz: d.axis?.[1] ?? ez / l });
      seen.add(di);
    }
    return out;
  }

  /** Slabs, piers and canopies are volumes; space beneath them stays open. */
  blocksCamera(x: number, y: number, z: number): boolean {
    const skin = 0.15;
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    for (const [di, i] of this.buckets.get(key) ?? []) {
      const s = this.surfaces[di];
      const top = triangleHeight(x, z, s.vertices[s.indices[i]], s.vertices[s.indices[i + 1]], s.vertices[s.indices[i + 2]]);
      if (top !== null && y >= top - this.decks[di].t - skin && y <= top + skin) return true;
    }
    for (const solid of this.solids.get(key) ?? []) {
      if (y < solid.low - skin || y > solid.high + skin) continue;
      const ring = solid.ring;
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        if ((x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2 < skin * skin) return true;
        if ((a[1] > z) !== (b[1] > z) && x < a[0] + (z - a[1]) * dx / dz) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  /**
   * One mesh for all decks of a tile, positioned relative to (ox, oz): top,
   * underside, both sides and the two ends of each slab.
   */
  mesh(ox: number, oz: number, ground?: GroundTextures): THREE.Mesh {
    const pos: number[] = [];
    const idx: number[] = [];
    const colors: number[] = [], types: number[] = [];
    let tint = new THREE.Color(0x969184), type = 0;
    const vertex = (p: number[]) => {
      pos.push(...p);
      colors.push(tint.r, tint.g, tint.b);
      types.push(type);
    };
    const quad = (a: number[], b: number[], c: number[], d: number[]) => {
      const k = pos.length / 3;
      for (const p of [a, b, c, d]) vertex(p);
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };
    for (const [di, d] of this.decks.entries()) {
      const local = ([x, y, z]: Vertex) => [x - ox, y, z - oz];
      const s = this.surfaces[di];
      tint = new THREE.Color(0xffffff);
      type = d.k === 'road' ? 1 : d.k === 'path' ? 2 : 3;
      const start = pos.length / 3;
      for (const p of s.vertices) vertex(local(p));
      idx.push(...s.indices.map((i) => start + i));
      tint = new THREE.Color(d.material === 'brick' ? 0x8e6850 : d.material === 'steel' || d.k === 'rail' ? 0x64716f : 0x969184);
      type = d.material === 'steel' || d.k === 'rail' ? 4 : 0;
      const down = (p: number[]) => [p[0], p[1] - d.t, p[2]];
      const bottom = pos.length / 3;
      for (const p of s.vertices) vertex(down(local(p)));
      for (let i = 0; i < s.indices.length; i += 3) idx.push(bottom + s.indices[i], bottom + s.indices[i + 2], bottom + s.indices[i + 1]);
      for (const ring of s.rings) {
        // The outer ring is wound clockwise in x/z; holes counterclockwise.
        // Orient by the triangle interior rather than trusting source winding.
        for (let i = 0; i < ring.length; i++) {
          const a = s.vertices[ring[i]], b = s.vertices[ring[(i + 1) % ring.length]];
          if (this.cutEdge(d, a, b)) continue;
          const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
          if (length < 1e-6) continue;
          const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
          const nx = -(b[2] - a[2]) / length, nz = (b[0] - a[0]) / length;
          const insideLeft = this.at(mx + nx * 0.02, mz + nz * 0.02).some((h) => Math.abs(h.y - (a[1] + b[1]) / 2) < 0.1);
          const l = local(a), r = local(b);
          if (insideLeft) quad(l, r, down(r), down(l));
          else quad(r, l, down(l), down(r));
        }
      }
      // railings were modelled too: posts and three rails each, 12 triangles a
      // beam - more than the rest of a city's bridges together, and invisible
      // from the sleigh at night
    }
    // piers and canopy roofs: outlines raised into prisms, top and bottom
    // triangulated, sides as quads
    const prism = (ring: [number, number][], y0: number, y1: number, roof = false) => {
      tint = new THREE.Color(0x969184); type = 0;
      let r = ring.map(([x, z]) => new THREE.Vector2(x - ox, z - oz));
      // some outlines come closed, first point repeated; triangulateShape
      // drops that point from r itself, and the sides below would run past it
      if (r.length > 1 && r[0].equals(r[r.length - 1])) r.pop();
      if (r.length < 3) return;
      // wound so that the top faces up: clockwise in x/z seen from above
      if (THREE.ShapeUtils.isClockWise(r)) r = r.reverse();
      const k = pos.length / 3;
      if (roof) { tint = new THREE.Color(0xffffff); type = 3; }
      for (const p of r) vertex([p.x, y1, p.y]);
      tint = new THREE.Color(0x969184); type = 0;
      for (const p of r) vertex([p.x, y0, p.y]);
      const n = r.length;
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(r, [])) {
        idx.push(k + a, k + c, k + b);              // top
        idx.push(k + n + a, k + n + b, k + n + c);  // bottom
      }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        quad([r[i].x, y1, r[i].y], [r[j].x, y1, r[j].y], [r[j].x, y0, r[j].y], [r[i].x, y0, r[i].y]);
      }
    };
    for (const p of this.piers) prism(p.r, p.y0, p.y1);
    for (const f of this.roofs) prism(f.r, f.y - f.t, f.y, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('surfaceType', new THREE.Float32BufferAttribute(types, 1));
    geo.setIndex(idx);
    // flat shading per face: a slab's edges are hard
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    geo.dispose();
    const mat = bridgeMaterial(ground);
    const mesh = new THREE.Mesh(flat, mat);
    mesh.name = 'bridges';
    return mesh;
  }
}
