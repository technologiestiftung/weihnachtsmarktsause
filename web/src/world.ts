import * as THREE from 'three';
import type { Origin, XZ } from './geo';
import type { DeckHit } from './bridges';
import { setUploader } from './frames';
import { NavGrid } from './tiles';
import { t } from './i18n';
import { closeOnUpload } from './memory';
import { LOW } from './quality';
import { Tile, type GroundKind, type SharedGround } from './tile';

/** All of Berlin, served from object storage at VITE_TILE_BASE (see .env.example). */
const BERLIN = ((import.meta.env.VITE_TILE_BASE as string | undefined) ?? '')
  .replace(/\/?$/, '/');

// Streaming distances, metres from the player to the nearest edge of a tile.
// Street level is hazed out by ~1.1 km, so full detail need not reach further;
// the coarse ring is for the view from the air.
// Full detail within FULL_IN, dropped past FULL_OUT; distant tiles likewise.
// A phone holds far less (quality.ts): its fog closes in to match.
const FULL_IN = LOW ? 380 : 800;
const FULL_OUT = LOW ? 540 : 1100;
const COARSE_IN = LOW ? 1400 : 2600;
const COARSE_OUT = LOW ? 1700 : 3200;
/** How far up a surface may be and still be stepped onto, metres. */
const STEP_UP = 1.0;
/** How far in from a deck's edge you must stand, metres: a footbridge
 *  1.1 m wide still holds you - Ernststeg is 1.6 m. */
export const WALK_INSET = 0.15;
/** A spawn's ground must reach this far, metres, to count as not walled in;
 *  more than the span of a Berlin block's courtyards. */
const OPEN_REACH = 160;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** world.json: the index of the tiled build (pipeline/build_berlin.py). */
export interface Manifest {
  kind: 'tiles';
  origin: Origin;
  world: [number, number, number, number, number, number];
  centre: { x: number; z: number; lon: number; lat: number };
  groundTextures: Record<GroundKind, { color: string; normal: string }>;
  /** Sky HDRI for image-based lighting; absent in older builds. */
  environment?: { file: string; source: string };
  spawn?: { x: number; z: number; heading?: number; facing?: string };
  attribution: string[];
  /** Every finished tile, by laser-scan km "E_N". v changes whenever the
   *  tile is rebuilt, so cached copies are not reused. */
  tiles: Record<string, { dir: string; world: Manifest['world']; v?: string }>;
}

export interface Env {
  night: number;
  time: number;
}

/**
 * The world: laser-scan terrain, OSM2World buildings, cadastre trees and
 * street furniture, in tiles streamed around the player.
 *
 * All of Berlin is ~1,000 tiles of 1 km: full detail near the player, coarse
 * coarse terrain further out, nothing beyond. Queries - ground height,
 * where you may stand - are answered by whichever tile is underfoot;
 * where nothing is loaded yet, nothing is passable, so you wait at the edge
 * of a tile rather than fall through it.
 */
export class World {
  manifest!: Manifest;
  origin!: Origin;
  spawnPoint!: { x: number; z: number; heading?: number };
  /** Navigation across every loaded tile. */
  readonly nav = new WorldNav(this);
  /** How far the loaded world reaches; fog should close before this. */
  viewLimit = Infinity;
  /** Called when a tile gains or loses full detail (POIs follow these). */
  onFull: (tile: Tile) => void = () => {};
  onDropFull: (tile: Tile) => void = () => {};

  readonly tiles = new Map<string, Tile>();
  private readonly base = BERLIN;
  private shared!: SharedGround;
  private aniso = 1;
  private busy = false;
  private last: Tile | null = null;
  private readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  async init(onProgress: (msg: string) => void, renderer: THREE.WebGLRenderer): Promise<this> {
    const m = await readJson<Manifest>(BERLIN + 'world.json');
    if (!m?.tiles || !Object.keys(m.tiles).length) throw new Error(`${BERLIN}world.json missing`);
    this.manifest = m;
    const man = this.manifest;
    this.origin = man.origin;
    this.spawnPoint = man.spawn ?? { x: man.centre.x, z: man.centre.z };
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    setUploader((t) => renderer.initTexture(t));

    onProgress(t('boot.textures'));
    this.shared = await this.loadShared();

    for (const [key, t] of Object.entries(man.tiles)) {
      this.tiles.set(key, new Tile(key, this.base + t.dir, t.world, null, t.v));
    }
    this.viewLimit = COARSE_IN;
    // a build still under way may not have reached the spawn yet
    const sp = this.spawnPoint;
    if (!this.covers(sp.x, sp.z)) {
      let best: Tile | null = null;
      for (const t of this.tiles.values()) {
        if (!best || t.distance(sp.x, sp.z) < best.distance(sp.x, sp.z)) best = t;
      }
      const [x0, z0, x1, z1] = best!.bounds;
      this.spawnPoint = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    }
    return this;
  }

  private async loadShared(): Promise<SharedGround> {
    const loader = new THREE.TextureLoader();
    const load = (file: string, srgb: boolean) => loader.loadAsync(this.base + file).then(async (t) => {
      // a phone (quality.ts) takes them at 512 px, flipped as three would have
      if (LOW && t.image.width > 512) {
        t.image = await createImageBitmap(t.image as HTMLImageElement,
          { resizeWidth: 512, resizeHeight: Math.round(512 * t.image.height / t.image.width),
            resizeQuality: 'medium', imageOrientation: 'flipY' });
        t.flipY = false;
        closeOnUpload(t);
      }
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = this.aniso;
      return t;
    });
    const kinds = Object.keys(this.manifest.groundTextures) as GroundKind[];
    const color = {} as Record<GroundKind, THREE.Texture>;
    const normal = {} as Record<GroundKind, THREE.Texture>;
    await Promise.all(kinds.flatMap((k) => [
      load(this.manifest.groundTextures[k].color, true).then((t) => { color[k] = t; }),
      load(this.manifest.groundTextures[k].normal, false).then((t) => { normal[k] = t; }),
    ]));
    return { color, normal };
  }

  envUrl(file: string): string { return this.base + file; }

  /* --- streaming ----------------------------------------------------------- */

  /** Load the tile at (x, z) in full before going on, e.g. to spawn there.
   *  False if no tile covers the spot. */
  async ensure(x: number, z: number, onProgress?: (msg: string) => void): Promise<boolean> {
    const tile = this.tileOf(x, z);
    if (!tile) return false;
    while (this.busy) await new Promise((r) => setTimeout(r, 30));
    this.busy = true;
    try {
      onProgress?.(t('boot.tile', { k: tile.key }));
      await this.raise(tile, 'full');
    } finally {
      this.busy = false;
    }
    return true;
  }

  /**
   * Called every frame: start the most urgent missing tile and drop far
   * ones. One tile loads at a time - building one
   * merges thousands of meshes on this thread - so the frame rate dips only
   * briefly each time.
   */
  update(x: number, z: number): void {
    let want: { tile: Tile; level: 'coarse' | 'full'; d: number } | null = null;
    for (const tile of this.tiles.values()) {
      const d = tile.distance(x, z);
      if (tile.level === 'full' && d > FULL_OUT) {
        this.onDropFull(tile);
        tile.dropFull();
      }
      if (tile.level !== 'none' && d > COARSE_OUT) {
        this.dispose(tile);
        continue;
      }
      const level = d <= FULL_IN ? 'full' : d <= COARSE_IN ? 'coarse' : null;
      const behind = level === 'full' ? tile.level !== 'full'
        : level === 'coarse' ? tile.level === 'none' : false;
      // the full tiles first, nearest first; then coarse
      if (level && behind && (!want || (level === 'full' && want.level === 'coarse')
          || (level === want.level && d < want.d))) {
        want = { tile, level, d };
      }
    }
    if (want && !this.busy) {
      this.busy = true;
      const { tile, level } = want;
      void this.raise(tile, level).catch((err) => {
        console.warn(`tile ${tile.key} failed to load, leaving it out`, err);
        this.dispose(tile);
        this.tiles.delete(tile.key);
      }).finally(() => { this.busy = false; });
    }
  }

  /**
   * How much of what should show around (x, z) is in: each tile in range at
   * the detail its distance asks for. Done when done reaches total.
   */
  progress(x: number, z: number): { done: number; total: number } {
    let done = 0, total = 0;
    for (const tile of this.tiles.values()) {
      const d = tile.distance(x, z);
      const level = d <= FULL_IN ? 'full' : d <= COARSE_IN ? 'coarse' : null;
      if (!level) continue;
      total++;
      if (tile.level === 'full' || (level === 'coarse' && tile.level === 'coarse')) done++;
    }
    return { done, total };
  }

  private async raise(tile: Tile, level: 'coarse' | 'full'): Promise<void> {
    if (tile.level === 'none') {
      await tile.loadCoarse(this.shared, this.aniso);
      if (tile.level === 'none') return;          // dropped while loading
      this.group.add(tile.group);
    }
    if (level === 'full' && tile.level === 'coarse') {
      await tile.loadFull(this.aniso);
      this.onFull(tile);
    }
  }

  private dispose(tile: Tile): void {
    if (tile.level === 'full') this.onDropFull(tile);
    if (this.last === tile) this.last = null;
    tile.dispose();
    // a fresh one in its place, should the player come back
    if (this.tiles.get(tile.key) === tile) {
      this.tiles.set(tile.key, new Tile(tile.key, tile.base, tile.box, tile.manifest, tile.version));
    }
  }

  /* --- queries ----------------------------------------------------------- */

  /** The loaded tile under (x, z), if any. */
  tileAt(x: number, z: number): Tile | null {
    if (this.last?.contains(x, z) && this.last.level !== 'none') return this.last;
    for (const t of this.tiles.values()) {
      if (t.level !== 'none' && t.contains(x, z)) return (this.last = t);
    }
    return null;
  }

  /** The tile covering (x, z), loaded or not. */
  tileOf(x: number, z: number): Tile | null {
    const e = Math.floor((x + this.origin.e) / 1000);
    const n = Math.floor((this.origin.n - z) / 1000);
    return this.tiles.get(`${e}_${n}`) ?? null;
  }

  /** Is there any world at (x, z), loaded or not? */
  covers(x: number, z: number): boolean {
    const t = this.tileOf(x, z);
    return t !== null && t.contains(x, z);
  }

  /**
   * The height of what you stand on at (x, z). Without y that is the bare
   * earth. With y - where the player is now - it is the highest surface no
   * more than a step above y: a bridge deck when you are up on it, the street
   * when you walk underneath.
   */
  height(x: number, z: number, y?: number): number {
    const g = this.ground(x, z);
    if (y === undefined) return g;
    let best = g <= y + STEP_UP ? g : -Infinity;
    for (const d of this.tileAt(x, z)?.decks?.at(x, z) ?? []) {
      if (d.y <= y + STEP_UP && d.y > best) best = d.y;
    }
    return best === -Infinity ? g : best;
  }

  /** The deck at (x, z) within a step of height y, if there is one; with
   *  `road`, one a car may use - not a path. */
  deckAt(x: number, z: number, y: number, inset = 0): DeckHit | null {
    for (const d of this.tileAt(x, z)?.decks?.at(x, z, inset) ?? []) {
      if (Math.abs(d.y - y) <= STEP_UP) return d;
    }
    return null;
  }

  /** Bare-earth ground height in world metres. */
  private ground(x: number, z: number): number {
    const t = this.tileAt(x, z);
    if (t?.terrain) return t.groundHeight(x, z);
    // off the loaded world: hold the nearest edge's height
    let best: Tile | null = null;
    let bd = Infinity;
    for (const c of this.tiles.values()) {
      if (!c.terrain) continue;
      const d = c.distance(x, z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best?.terrain) return 0;
    const f = best.terrain;
    return best.groundHeight(Math.min(Math.max(x, f.minX), f.minX + f.nx - 1),
                             Math.min(Math.max(z, f.minZ), f.minZ + f.nz - 1));
  }

  /** The level a street running along `dir` has at (x, z): a deck going the
   *  same way carries it, one crossing over it does not. */
  streetLevel(x: number, z: number, dir: [number, number]): number {
    let best = this.ground(x, z);
    for (const d of this.tileAt(x, z)?.decks?.at(x, z) ?? []) {
      if (Math.abs(d.dx * dir[0] + d.dz * dir[1]) > 0.8 && d.y > best) best = d.y;
    }
    return best;
  }

  /** What things painted on the ground should follow, near height y. */
  surfaceHeight(x: number, z: number, y?: number): number {
    return this.height(x, z, y);
  }

  /**
   * Somewhere to stand near (x, z) that leads somewhere.
   *
   * The nearest passable cell is not enough. An address point or a game
   * start often lies inside a block, and the ground nearest to it is then a
   * Hinterhof: walkable, kept by the pipeline (it keeps every region over
   * 400 m²), and walled in on all sides. So each candidate is flood-filled
   * first, and only one whose region reaches OPEN_REACH metres away - or runs
   * off the loaded tiles, where we cannot tell - is taken. Enclosed regions
   * are ruled out whole and the search moves on outward.
   *
   * The way out has to be roomy (see roomy): a yard whose only exit is a gap
   * of a metre or two counts as walled in. Such a gap is usually a gateway
   * under the front building - open in the grid, drawn as a solid wall, and
   * too narrow to find or walk through.
   */
  freeSpot(x: number, z: number, maxR = 120): XZ {
    const first = this.nav.nearestPassable(x, z, maxR);
    if (!first) return [x, z];
    // a window of whole cells around (x, z), big enough for every search
    const W = Math.ceil(maxR + OPEN_REACH + 2);
    const side = 2 * W + 1;
    const seen = new Uint8Array(side * side);
    const cx = Math.floor(x) + 0.5, cz = Math.floor(z) + 0.5;
    const at = (i: number, j: number) => (j + W) * side + (i + W);
    let start = this.roomy(cx, cz) ? [0, 0] as [number, number]
      : this.nextCandidate(cx, cz, maxR, W, side, seen, at);
    for (let tries = 0; start && tries < 8; tries++) {
      if (this.leadsOut(start, cx, cz, W, side, seen)) {
        return start[0] === 0 && start[1] === 0 ? [x, z] : [cx + start[0], cz + start[1]];
      }
      start = this.nextCandidate(cx, cz, maxR, W, side, seen, at);
    }
    // nothing open within reach: the nearest ground is still better than a wall
    return first;
  }

  /** Flood-fill from a cell; true once it gets OPEN_REACH away or off the map. */
  private leadsOut(start: [number, number], cx: number, cz: number, W: number, side: number,
                   seen: Uint8Array): boolean {
    const [si, sj] = start;
    const queue = [si, sj];
    seen[(sj + W) * side + (si + W)] = 1;
    const reach2 = OPEN_REACH * OPEN_REACH;
    for (let q = 0; q < queue.length; q += 2) {
      const i = queue[q], j = queue[q + 1];
      if ((i - si) ** 2 + (j - sj) ** 2 >= reach2) return true;
      for (const [di, dj] of STEPS) {
        const ni = i + di, nj = j + dj;
        if (ni < -W || ni > W || nj < -W || nj > W) return true;
        const k = (nj + W) * side + (ni + W);
        if (seen[k]) continue;
        const px = cx + ni, pz = cz + nj;
        if (!this.nav.contains(px, pz)) return true;
        if (!this.roomy(px, pz)) continue;
        seen[k] = 1;
        queue.push(ni, nj);
      }
    }
    return false;
  }

  /** Passable with a cell of room all round: ground three metres across. */
  private roomy(x: number, z: number): boolean {
    const c = this.nav.cell;
    for (let dz = -c; dz <= c; dz += c) {
      for (let dx = -c; dx <= c; dx += c) {
        if (!this.nav.passable(x + dx, z + dz)) return false;
      }
    }
    return true;
  }

  /** The nearest roomy cell not yet ruled out, spiralling outward. */
  private nextCandidate(cx: number, cz: number, maxR: number, W: number, side: number,
                        seen: Uint8Array,
                        at: (i: number, j: number) => number): [number, number] | null {
    for (let r = 1; r <= maxR; r++) {
      const steps = Math.max(8, Math.round(2 * Math.PI * r));
      for (let a = 0; a < steps; a++) {
        const th = (a / steps) * Math.PI * 2;
        const i = Math.round(Math.cos(th) * r), j = Math.round(Math.sin(th) * r);
        if (Math.abs(i) > W || Math.abs(j) > W || seen[at(i, j)]) continue;
        if (this.roomy(cx + i, cz + j)) return [i, j];
      }
    }
    return null;
  }

  /** Is a camera at this point inside something? Used to pull the third-person
   *  boom in rather than let it clip into a wall. */
  blocksCamera(x: number, y: number, z: number): boolean {
    if (y < this.height(x, z) + 0.55) return true;
    if (this.tileAt(x, z)?.decks?.blocksCamera(x, y, z)) return true;
    return this.nav.has(x, z, NavGrid.BUILDING);
  }

  /* --- per frame --------------------------------------------------------- */

  setEnv({ night, time }: Env): void {
    for (const t of this.tiles.values()) {
      for (const a of t.animated) {
        if (a.uniforms.uTime) a.uniforms.uTime.value = time;
      }
      // windows warm up after dark; materials.ts litWindows picks which
      // have a light on and lights their glass
      for (const w of t.windowMats) {
        w.emissive.setRGB(1.0, 0.72, 0.42).multiplyScalar(night * 0.9);
      }
    }
  }

  get stats(): { buildings: number; trees: number; tiles: number; full: number } {
    let buildings = 0, trees = 0, tiles = 0, full = 0;
    for (const t of this.tiles.values()) {
      buildings += t.buildings;
      trees += t.trees.length;
      if (t.level !== 'none') tiles++;
      if (t.level === 'full') full++;
    }
    return { buildings, trees, tiles, full };
  }
}

/** The navigation grids of every fully loaded tile, queried as one. */
class WorldNav {
  readonly cell = 1;
  constructor(private readonly world: World) {}

  private grid(x: number, z: number): NavGrid | null {
    return this.world.tileAt(x, z)?.nav ?? null;
  }

  contains(x: number, z: number): boolean {
    return this.grid(x, z)?.contains(x, z) ?? false;
  }

  has(x: number, z: number, flag: number): boolean {
    return this.grid(x, z)?.has(x, z, flag) ?? false;
  }

  passable(x: number, z: number): boolean {
    return this.has(x, z, NavGrid.WALKABLE);
  }

  /** Nearest passable spot, spiralling outward - across tile edges too. */
  nearestPassable(x: number, z: number, maxR = 150): XZ | null {
    if (this.passable(x, z)) return [x, z];
    for (let r = this.cell; r <= maxR; r += this.cell) {
      const steps = Math.max(8, Math.round((2 * Math.PI * r) / this.cell));
      for (let a = 0; a < steps; a++) {
        const th = (a / steps) * Math.PI * 2;
        const px = x + Math.cos(th) * r;
        const pz = z + Math.sin(th) * r;
        if (this.passable(px, pz)) return [px, pz];
      }
    }
    return null;
  }
}

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    // the dev server answers a missing file with index.html
    return await res.json() as T;
  } catch {
    return null;
  }
}
