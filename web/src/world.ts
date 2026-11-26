import * as THREE from 'three';
import type { Origin } from './geo';
import type { DeckHit } from './bridges';
import { setUploader } from './frames';
import { t } from './i18n';
import { closeOnUpload } from './memory';
import { LOW } from './quality';
import { CACHE, Tile, type GroundKind, type SharedGround } from './tile';

/** All of Berlin, served from object storage at VITE_TILE_BASE (see .env.example). */
const BERLIN = ((import.meta.env.VITE_TILE_BASE as string | undefined) ?? '')
  .replace(/\/?$/, '/');

// Streaming distances, metres from the player to the nearest edge of a tile.
// Full detail within FULL_IN, dropped past FULL_OUT; distant tiles likewise.
// The fog closes at FULL_IN (viewLimit), so a tile's buildings appear while
// still hidden in it; the coarse ring beyond is only the ground a full tile
// is built on, loaded a little ahead. A phone holds far less (quality.ts):
// its fog closes in to match.
const FULL_IN = LOW ? 380 : 800;
const FULL_OUT = LOW ? 540 : 1100;
const COARSE_IN = FULL_IN + 600;
const COARSE_OUT = COARSE_IN + 300;
/** A game starts once the full tiles this close are in; the rest streams in
 *  during the countdown. */
const START_IN = 400;
/** How far up a surface may be and still be stepped onto, metres. */
const STEP_UP = 1.0;

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
  /** How far the loaded world reaches; fog should close before this. */
  viewLimit = Infinity;
  /** Called when a tile gains or loses full detail (POIs follow these). */

  readonly tiles = new Map<string, Tile>();
  private readonly base = BERLIN;
  private shared!: SharedGround;
  private aniso = 1;
  private busy = false;
  /** The tile being raised now, and those whose next level is downloading
   *  meanwhile (Tile.prefetch), as key:level. */
  private raising: Tile | null = null;
  /** ensure() calls waiting for their turn: streaming starts nothing new
   *  meanwhile, or it would take every turn before they get one. */
  private waiting = 0;
  private prefetched = new Set<string>();
  private last: Tile | null = null;
  private readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  async init(onProgress: (msg: string) => void, renderer: THREE.WebGLRenderer): Promise<this> {
    const m = await readJson<Manifest>(BERLIN + `world.json?c=${CACHE}`);
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
    this.viewLimit = FULL_IN;
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
  async ensure(x: number, z: number): Promise<boolean> {
    const tile = this.tileOf(x, z);
    if (!tile) return false;
    this.waiting++;
    while (this.busy) await new Promise((r) => setTimeout(r, 30));
    this.waiting--;
    this.busy = true;
    this.raising = tile;
    try {
      await this.raise(tile, 'full');
    } finally {
      this.busy = false;
      this.raising = null;
    }
    return true;
  }

  /**
   * Called every frame: start the most urgent missing tile and drop far
   * ones. While one is being built, the next one's files download.
   *
   * (ax, az) is where the player will be in a few seconds. It adds to the
   * circle around (x, z), never replaces it: a tile counts by whichever of
   * the two it is nearer, so the city ahead comes in early, and turning
   * away costs at most a tile or two loaded for nothing. One tile loads at a time - building one
   * merges thousands of meshes on this thread - so the frame rate dips only
   * briefly each time.
   */
  update(x: number, z: number, ax = x, az = z): void {
    let want: { tile: Tile; level: 'coarse' | 'full'; d: number } | null = null;
    for (const tile of this.tiles.values()) {
      // wholly in the fog: kept for when it comes close, but not drawn
      tile.group.visible = tile.distance(x, z) <= this.viewLimit;
      const d = Math.min(tile.distance(x, z), tile.distance(ax, az));
      if (tile.level === 'full' && d > FULL_OUT) {
        tile.dropFull();
        this.prefetched.delete(`${tile.key}:full`);
      }
      if (tile.level !== 'none' && d > COARSE_OUT) {
        this.dispose(tile);
        continue;
      }
      const level = d <= FULL_IN ? 'full' : d <= COARSE_IN ? 'coarse' : null;
      const behind = level === 'full' ? tile.level !== 'full'
        : level === 'coarse' ? tile.level === 'none' : false;
      // the full tiles first, nearest first; then coarse
      if (level && behind && tile !== this.raising && (!want || (level === 'full' && want.level === 'coarse')
          || (level === want.level && d < want.d))) {
        want = { tile, level, d };
      }
    }
    if (want && !this.busy && !this.waiting) {
      this.busy = true;
      const { tile, level } = want;
      this.raising = tile;
      void this.raise(tile, level).catch((err) => {
        console.warn(`tile ${tile.key} failed to load, leaving it out`, err);
        this.dispose(tile);
        this.tiles.delete(tile.key);
      }).finally(() => { this.busy = false; this.raising = null; });
    } else if (want && !LOW && !this.prefetched.has(`${want.tile.key}:${want.level}`)) {
      // not on a phone: two tiles' downloads at once are a lot of memory there
      this.prefetched.add(`${want.tile.key}:${want.level}`);
      void want.tile.prefetch(want.level);
    }
  }

  /**
   * How much of the city right around (x, z) is in: the tiles within
   * START_IN, in full detail. Done when done reaches total. The rest goes on
   * streaming in after that, nearest first.
   */
  progress(x: number, z: number): { done: number; total: number } {
    let done = 0, total = 0;
    for (const tile of this.tiles.values()) {
      if (tile.distance(x, z) > Math.min(START_IN, FULL_IN)) continue;
      total++;
      if (tile.level === 'full') done++;
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
    }
  }

  private dispose(tile: Tile): void {
    if (this.last === tile) this.last = null;
    tile.dispose();
    this.prefetched.delete(`${tile.key}:coarse`);
    this.prefetched.delete(`${tile.key}:full`);
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

  /** Is a camera at this point inside something? Used to pull the third-person
   *  boom in rather than let it clip into a wall. */
  blocksCamera(x: number, y: number, z: number): boolean {
    if (y < this.height(x, z) + 0.55) return true;
    return this.tileAt(x, z)?.decks?.blocksCamera(x, y, z) ?? false;
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
