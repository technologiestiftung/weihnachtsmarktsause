import * as THREE from 'three';
import type { HUD } from './hud';
import type { Overview } from './overview';
import type { Player } from './player';
import { t } from './i18n';
import { labelTexture, setDistance, type Label } from './labels';
import { controls } from './settings';
import { sfx } from './sfx';
import { isTouchDevice } from './touch';
import type { World } from './world';

/**
 * The Weihnachtsmarkt-Sause: a timed sleigh run over Berlin's Christmas
 * markets, from data/games/markets.json.
 *
 * The loop: markets around the start, a beacon over each, the name of the
 * nearest, a clock, the sleigh, the snow and the night. What counts is how
 * many markets get their presents; each one puts a few seconds back on the
 * clock, and the best run from the start is chased live.
 */

/** The modes; their texts are in i18n.ts under mode.<id>.* */
export interface ModeInfo {
  id: string;
}

export const MODE_INFO: ModeInfo[] = [
  { id: 'markets' },
];

/**
 * Round lengths, seconds. Short on purpose: a casual round is about a
 * minute or two, and the fun is in going again. The texts take theirs from
 * here as {dur}.
 */
const LIMITS: Record<string, number> = {
  markets: 90,
};

/** "90 seconds", "2 minutes", in the current language. */
function duration(s: number): string {
  return s % 60 === 0 && s >= 120 ? t('dur.m', { n: s / 60 }) : t('dur.s', { n: s });
}

/** A mode's text in the current language: title, blurb, source, unit. */
export function modeText(id: string, what: string, vars: Record<string, string | number> = {}): string {
  return t(`mode.${id}.${what}`, { dur: duration(LIMITS[id] ?? 90), ...vars });
}

/** How a run went. */
export interface Result {
  won: boolean;
  title: string;
  /** Targets reached. */
  count: number;
}

export interface GameHost {
  scene: THREE.Scene;
  world: World;
  player: Player;
  hud: HUD;
  camera: THREE.PerspectiveCamera;
  setNight(n: number): void;
}

/**
 * Games run faster than free roam: targets lie hundreds of metres apart, and
 * a minute of jogging to the first one is no fun. Walking, riding and the
 * sleigh speed up by this; the car is fast enough as it is.
 */
const GAME_PACE = 1.6;

/**
 * Every game starts here: central, but not on top of a market - the
 * nearest, at the Gendarmenmarkt, is 800 m off, and four are within 1.1 km.
 * Always the same, so every run on the board had the same chance.
 */
const START_STATION = 'Friedrichstraße';

/** Where every game starts; null where this build does not cover it. */
export function startPoint(overview: Overview, world: World): [number, number] | null {
  const s = overview.stations.find((st) => st.name === START_STATION);
  return s && world.covers(s.x, s.z) ? [s.x, s.z] : null;
}

/** Every target's colour, warm gold; the pin itself is the star (public/star.png). */
const PIN_COLOUR = '#e8b23a';
/** The star of the pins and the pop-ups, from public/ like the data. */
const STAR = 'star.png';

/** The star as a picture in a line of text. */
function starImg(): HTMLImageElement {
  const img = new Image();
  img.src = STAR;
  img.className = 'star';
  img.alt = '';
  return img;
}

interface Spot {
  x: number;
  z: number;
  n: string;
  done: boolean;
  /** How close counts as there. */
  reach: number;
}

type RawPoint = [number, number, string, string, string?];

// small and fixed for the season: served with the app, not the tiles
const DATA = 'data/games/';

async function points(file: string): Promise<{ points: RawPoint[]; attribution: string }> {
  const res = await fetch(DATA + file);
  if (!res.ok) throw new Error(`data/games/${file} missing`);
  return res.json();
}

function spot(p: RawPoint, reach: number): Spot {
  return { x: p[0], z: p[1], n: p[2], done: false, reach };
}

/* --- beacons --------------------------------------------------------------- */

/** A five-pointed star's outline, point up: outer radius 1, inner `inner`. */
function starPoints(inner: number): [number, number][] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 ? inner : 1;
    return [Math.sin(a) * r, Math.cos(a) * r] as [number, number];
  });
}

let starTex: THREE.Texture | null = null;

/** The pin: the star with a soft white rim, so its gold holds against the
 *  night; its bottom is on the spot. Blank until the picture has loaded. */
function star(): THREE.Texture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext('2d')!;
    g.shadowColor = 'rgba(255,255,255,.95)';
    g.shadowBlur = 8;
    // twice: one pass of the blur alone is too faint a rim
    g.drawImage(img, 8, 8, 112, 112);
    g.drawImage(img, 8, 8, 112, 112);
    tex.needsUpdate = true;
  };
  img.src = STAR;
  return starTex = tex;
}

/** A column of light one unit tall with the star for its cross-section:
 *  just the walls, open at both ends. */
function starColumn(): THREE.BufferGeometry {
  const pts = starPoints(0.45);
  const pos: number[] = [];
  pts.forEach(([x0, z0], i) => {
    const [x1, z1] = pts[(i + 1) % pts.length];
    pos.push(x0, 0, z0, x1, 0, z1, x1, 1, z1, x0, 0, z0, x1, 1, z1, x0, 1, z0);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

const SCRATCH = new THREE.Vector3();
const COLUMN = starColumn();

/** A pin over the target and a column of light up into the sky, with the
 *  market's name above and how far it is above that. Pins keep their size on
 *  screen and show through buildings: they are the objective. */
class Beacon {
  readonly group = new THREE.Group();
  private readonly pin: THREE.Sprite;
  private readonly column: THREE.Mesh;
  private readonly dist: THREE.Sprite;
  private readonly name: THREE.Sprite;
  private readonly label: Label;
  private readonly pinHeight: number;

  constructor(colour: string, height: number, width: number, name: string) {
    this.pin = new THREE.Sprite(new THREE.SpriteMaterial({
      map: star(), depthTest: false, depthWrite: false,
      transparent: true, sizeAttenuation: false, fog: false,
    }));
    this.pin.renderOrder = 30;
    this.pin.center.set(0.5, 0);
    this.column = new THREE.Mesh(COLUMN, new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: 0.28, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }));
    this.column.scale.set(width, height, width);
    this.dist = new THREE.Sprite(new THREE.SpriteMaterial({
      depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, fog: false,
    }));
    this.dist.renderOrder = 30;
    this.label = labelTexture(name, colour, 0.8);
    this.name = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.label.tex, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false,
      fog: false,
    }));
    this.name.renderOrder = 30;
    this.group.add(this.column, this.pin, this.name, this.dist);
    this.pinHeight = Math.min(height, 6);
  }

  update(t: number, near: boolean, dist: number): void {
    const s = (near ? 0.075 : 0.05) * (dist < 30 ? 0.8 : 1);
    this.pin.scale.set(s, s, 1);
    this.pin.position.y = this.pinHeight + Math.sin(t * 2.4) * 0.4;
    // the name sits on top of the pin
    const k = s * 0.012;
    this.name.scale.set(this.label.w * k, this.label.h * k, 1);
    this.name.center.set(0.5, -s / (this.label.h * k));
    this.name.position.y = this.pin.position.y;
    // the distance stacks on top of the name
    setDistance(this.dist, dist, k);
    this.dist.center.set(0.5, -(s + this.label.h * k) / this.dist.scale.y);
    this.dist.position.y = this.pin.position.y;
    // the column fades as you arrive, so it doesn't fill the screen
    (this.column.material as THREE.MeshBasicMaterial).opacity = Math.min(0.32, dist / 160);
  }

  dispose(): void {
    (this.pin.material as THREE.Material).dispose();
    (this.column.material as THREE.Material).dispose();
    // the distance plates are shared; only this sprite's material goes
    this.dist.material.dispose();
    this.name.material.dispose();
    this.label.tex.dispose();
  }
}

/* --- effects ---------------------------------------------------------------- */

interface Particle { obj: THREE.Object3D; v: THREE.Vector3; life: number; spin: number }
interface Ring { mesh: THREE.Mesh; life: number }

/** A shock ring flat on the ground, where a target was reached. */
const RING = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
const RING_LIFE = 0.8;

/** Falling snow in a box that travels with the camera. */
class Snow {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  /** Moved on the CPU every frame, so not too many. */
  private static readonly N = 1500;
  private static readonly R = 120;

  constructor() {
    this.pos = new Float32Array(Snow.N * 3);
    for (let i = 0; i < this.pos.length; i++) this.pos[i] = (Math.random() * 2 - 1) * Snow.R;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    // a soft round flake rather than the default square
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(c), size: 0.7, transparent: true, opacity: 0.9, depthWrite: false,
    }));
    this.points.frustumCulled = false;
  }

  update(dt: number, at: THREE.Vector3): void {
    const R = Snow.R, p = this.pos;
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] -= dt * (2.2 + (i % 7) * 0.25);
      p[i] += Math.sin(p[i + 1] * 0.1 + i) * dt * 0.6;
      if (p[i + 1] < -R) p[i + 1] += 2 * R;
    }
    // flakes live in the box's own frame, so moving it is all it takes
    this.points.position.copy(at);
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

/* --- the shared game loop ---------------------------------------------------- */

const fmt = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

/*
 * The panel is redrawn every frame, but most of it changes a few times a
 * second at most. Writing it anyway made a phone restyle and relayout the
 * page every frame (scripts/games-bench.ts), so only what changed is written.
 */
const written = new WeakMap<HTMLElement, Map<string, string>>();
function changed(e: HTMLElement, key: string, value: string): boolean {
  let m = written.get(e);
  if (!m) { m = new Map(); written.set(e, m); }
  if (m.get(key) === value) return false;
  m.set(key, value);
  return true;
}
function put(e: HTMLElement, text: string, html = false): void {
  if (!changed(e, html ? 'html' : 'text', text)) return;
  if (html) e.innerHTML = text; else e.textContent = text;
}
function css(e: HTMLElement, prop: string, value: string): void {
  if (changed(e, prop, value)) e.style.setProperty(prop, value);
}

/** Fly Santa's sleigh over the Christmas markets. */
export class Game {
  readonly info: ModeInfo;
  private readonly host: GameHost;
  private spots: Spot[] = [];
  /** Targets reached. */
  private count = 0;
  private time = 0;
  private limit: number;
  state: 'countdown' | 'play' | 'over' = 'countdown';
  result: Result | null = null;
  /** The most markets reached from the start, set by main.ts, to chase while playing. */
  best: number | null = null;

  /** Seconds a target puts back on the clock, shrinking over a run. */
  private readonly timeBonus = 3;
  /** On top of GAME_PACE: the sleigh is quick already; much faster and the
   *  city cannot stream in, nor can you tell where in Berlin you are. */
  private readonly pace = 0.65;
  private readonly snow = new Snow();
  /** Beacons over the nearest markets: how many, how far out, how tall and wide. */
  private readonly beaconCount = 10;
  private readonly beaconRange = 5000;
  private readonly beaconHeight = 320;
  private readonly beaconWidth = 8;

  private beaten = false;
  private countdown = 3.4;
  private lastCount = 4;
  private lastSec = 0;
  private readonly beacons = new Map<Spot, Beacon>();
  private readonly group = new THREE.Group();
  private remount = 0;
  private bannerTimer = 0;
  private readonly particles: Particle[] = [];
  private readonly rings: Ring[] = [];
  private fov0 = 0;
  private kick = 0;
  private rushMix = 0;

  constructor(info: ModeInfo, host: GameHost) {
    this.info = info;
    this.host = host;
    this.limit = LIMITS[info.id] ?? 90;
    host.scene.add(this.group);
  }

  /** Every market, filled by load(). */
  private pool: Spot[] = [];

  async load(): Promise<void> {
    const d = await points('markets.json');
    // from the air the whole city is in reach, so these are not limited to
    // the tiles loaded
    // generous: a market point can sit inside a block, under a roof
    this.pool = d.points.map((p) => spot(p, 80));
  }

  /** The start; null where this build does not cover it. */
  startAt(): [number, number] | null {
    return startPoint(this.host.hud.overview, this.host.world);
  }

  /** The targets: every market. */
  prepare(): void {
    this.spots = this.pool;
    this.host.hud.markets = this.spots;
  }

  start(): void {
    this.fov0 = this.host.camera.fov;
    el('game').classList.add('on');
    // only the first row, the mouse or the finger: the rest is in the settings
    el('countKeys').replaceChildren(...controls(this.info.id, isTouchDevice()).slice(0, 2));
    el('countKeys').classList.add('on');
    this.render();
    this.host.player.setSleigh(true);
    this.host.setNight(1);
    this.host.scene.add(this.snow.points);
  }

  /** Leave the world as the game found it. */
  stop(): void {
    this.host.scene.remove(this.snow.points);
    this.snow.points.geometry.dispose();
    const p = this.host.player;
    p.setSleigh(false);
    p.speedScale = 1;
    this.host.setNight(0);
    for (const b of this.beacons.values()) b.dispose();
    this.beacons.clear();
    for (const q of this.particles) this.group.remove(q.obj);
    for (const r of this.rings) (r.mesh.material as THREE.Material).dispose();
    this.host.scene.remove(this.group);
    const cam = this.host.camera;
    if (this.fov0) { cam.fov = this.fov0; cam.updateProjectionMatrix(); }
    el('game').classList.remove('on');
    el('count').classList.remove('on');
    el('countKeys').classList.remove('on');
    el('banner').classList.remove('on');
    css(el('rush'), 'display', 'none');
    el('pops').replaceChildren();
    this.host.hud.marks = [];
    this.host.hud.markets = [];
  }

  /** One line for the pause screen: time left and markets reached. */
  status(): string {
    return t('pause.info', { time: fmt(this.limit - this.time), n: this.text('unit', { n: this.count }) });
  }

  /** This mode's own strings. */
  private text(what: string, vars: Record<string, string | number> = {}): string {
    return modeText(this.info.id, what, vars);
  }

  /** The nearest target still to do, named in the panel. */
  private next(): Spot | null {
    const { x, z } = this.host.player.pos;
    let best: Spot | null = null, bd = Infinity;
    for (const s of this.spots) {
      if (s.done) continue;
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  private banner(text: string, seconds = 2.2, withStar = false): void {
    const b = el('banner');
    b.replaceChildren(...(withStar ? [starImg(), text] : [text]));
    b.classList.add('on');
    this.bannerTimer = seconds;
  }

  /** Text that jumps up from the middle of the screen and fades. */
  private popup(text: string, cls = '', delay = 0, withStar = false): void {
    const p = document.createElement('div');
    p.className = `pop ${cls}`;
    p.replaceChildren(...(withStar ? [starImg(), text] : [text]));
    p.style.animationDelay = `${delay}s`;
    p.addEventListener('animationend', () => p.remove());
    el('pops').append(p);
  }

  /** A flash over the whole screen. */
  private flash(cls = ''): void {
    const f = el('flash');
    f.className = '';
    void f.offsetWidth;   // restart the animation
    f.className = `on ${cls}`;
  }

  /**
   * Count a target: one more market, time back on the clock, and every bit
   * of noise that makes it feel like it. (x, y, z) is where the effects go off.
   */
  private award(x: number, y: number, z: number): void {
    this.count++;
    this.popup(String(this.count), 'big', 0, true);
    const secs = Math.max(1, Math.round(this.timeBonus * Math.max(0.4, 1 - this.count * 0.04)));
    this.limit += secs;
    this.popup(t('game.time', { n: secs }), 'time', 0.16);
    const clock = el('gTime');
    clock.classList.remove('plus');
    void clock.offsetWidth;
    clock.classList.add('plus');
    this.ring(x, y, z, PIN_COLOUR);
    this.kick = 6;
    this.flash();
    this.checkRecord();
  }

  /** Passed the best run? Say so, once. */
  private checkRecord(): void {
    if (this.beaten || !this.best || this.count <= this.best) return;
    this.beaten = true;
    this.popup(t('game.record'), 'record', 0.3);
    sfx.record();
    this.flash('gold');
  }

  /** A burst of little objects flying up from (x, y, z). */
  private burst(x: number, y: number, z: number, colours: number[], n = 14, size = 0.35): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size),
                               new THREE.MeshBasicMaterial({ color: colours[i % colours.length] }));
      m.position.set(x, y, z);
      this.group.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 5;
      this.particles.push({ obj: m, v: new THREE.Vector3(Math.cos(a) * sp, 6 + Math.random() * 6, Math.sin(a) * sp),
                            life: 1.6 + Math.random(), spin: Math.random() * 8 });
    }
  }

  private ring(x: number, y: number, z: number, colour: string): void {
    const m = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: 0.9, depthWrite: false,
      side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending,
    }));
    m.position.set(x, y + 0.4, z);
    this.group.add(m);
    this.rings.push({ mesh: m, life: 0 });
  }

  /** Called every frame by main.ts. */
  update(dt: number): void {
    const p = this.host.player;
    this.time += this.state === 'play' ? dt : 0;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.4);
      const c = el('count');
      if (n !== this.lastCount) {
        this.lastCount = n;
        c.textContent = n > 0 ? String(n) : t('game.go');
        c.classList.add('on');
        if (n > 0) sfx.tick(); else sfx.go();
      }
      if (this.countdown <= 0) {
        this.state = 'play';
        c.classList.remove('on');
        el('countKeys').classList.remove('on');
      }
    } else if (this.state === 'play') {
      this.snow.update(dt, this.host.camera.position);
      p.speedScale = GAME_PACE * this.pace;
      for (const s of this.spots) {
        if (s.done) continue;
        const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z);
        if (d < s.reach && this.inReach()) this.reached(s);
      }
      // the last ten seconds count themselves down
      const sec = Math.ceil(this.limit - this.time);
      if (sec !== this.lastSec && sec <= 10 && sec > 0) sfx.tick(sec <= 3);
      this.lastSec = sec;
      if (this.time >= this.limit && this.state === 'play') this.end();
    }

    this.remount -= dt;
    if (this.remount <= 0) {
      this.remount = 0.3;
      this.mountBeacons();
    }
    const nxt = this.next();
    const now = performance.now() / 1000;
    const near = [...this.beacons]
      .map(([s, b]) => [s === nxt ? -1 : Math.hypot(s.x - p.pos.x, s.z - p.pos.z), s, b] as const)
      .sort((a, b) => a[0] - b[0]);
    // nearest first (the next target before all): a pin that would land on
    // a nearer one on screen is left out, so names don't pile up
    const taken: [number, number][] = [];
    for (const [, s, b] of near) {
      b.update(now, s === nxt, Math.hypot(s.x - p.pos.x, s.z - p.pos.z));
      const at = SCRATCH.copy(b.group.position).project(this.host.camera);
      const sx = at.x * innerWidth / 2, sy = at.y * innerHeight / 2;
      b.group.visible = at.z > 1 || !taken.some(([x, y]) => Math.abs(x - sx) < 150 && Math.abs(y - sy) < 50);
      if (b.group.visible && at.z <= 1) taken.push([sx, sy]);
    }
    this.updateParticles(dt);
    this.updateView(dt);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) el('banner').classList.remove('on');
    }
    this.render();
  }

  /** The camera kick on a hit and the widening rush of speed. */
  private updateView(dt: number): void {
    const cam = this.host.camera;
    this.kick *= Math.exp(-dt * 4);
    const rush = this.state === 'play' ? this.rush() : 0;
    this.rushMix += (rush - this.rushMix) * Math.min(1, dt * 3);
    const want = this.fov0 + this.kick + this.rushMix * 10;
    if (Math.abs(cam.fov - want) > 0.01) {
      cam.fov = want;
      cam.updateProjectionMatrix();
    }
    // a full-screen animation costs even when invisible, so it is taken out then
    const lines = el('rush');
    css(lines, 'opacity', String(Math.round(this.rushMix * 70) / 100));
    css(lines, 'display', this.rushMix > 0.01 ? 'block' : 'none');
  }

  /** Over a market counts anywhere in its column of light, up to the top. */
  private inReach(): boolean {
    const p = this.host.player;
    return p.pos.y - this.host.world.height(p.pos.x, p.pos.z) < this.beaconHeight;
  }

  /** The boost is the rush: full while flying flat out, gone while braking. */
  private rush(): number {
    const p = this.host.player;
    return Math.max(0, Math.min(1, (p.sleighSpeed / p.speedScale - 65) / 45));
  }

  private reached(s: Spot): void {
    s.done = true;
    sfx.jingle();
    const p = this.host.player;
    this.award(p.pos.x, p.pos.y, p.pos.z);
    this.burst(p.pos.x, p.pos.y, p.pos.z, [0xc8102e, 0x2f8f4e, 0x2a62c9, 0xe8b23a], 10, 0.7);
    this.banner(this.text('hit', { name: s.n }), undefined, true);
  }

  private end(): void {
    if (this.state === 'over') return;
    this.state = 'over';
    this.result = { won: this.count > 0, title: this.text(this.count >= 8 ? 'won' : 'lost'), count: this.count };
    if (this.result.won) sfx.win(); else sfx.lose();
  }

  private mountBeacons(): void {
    const { x, z } = this.host.player.pos;
    const w = this.host.world;
    const near = this.spots
      .filter((s) => !s.done)
      .map((s) => [Math.hypot(s.x - x, s.z - z), s] as const)
      .filter(([d]) => d < this.beaconRange)
      .sort((a, b) => a[0] - b[0])
      .slice(0, this.beaconCount);
    const keep = new Set(near.map(([, s]) => s));
    for (const [s, b] of [...this.beacons]) {
      if (keep.has(s)) continue;
      this.group.remove(b.group);
      b.dispose();
      this.beacons.delete(s);
    }
    for (const [, s] of near) {
      let b = this.beacons.get(s);
      if (!b) {
        b = new Beacon(PIN_COLOUR, this.beaconHeight, this.beaconWidth, s.n);
        this.beacons.set(s, b);
        this.group.add(b.group);
      }
      b.group.position.set(s.x, w.height(s.x, s.z), s.z);
    }
    this.host.hud.marks = near.map(([, s]) => ({ x: s.x, z: s.z, colour: PIN_COLOUR }));
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.v.y -= 14 * dt;
      q.obj.position.addScaledVector(q.v, dt);
      q.obj.rotation.x += q.spin * dt;
      q.obj.rotation.y += q.spin * dt * 0.7;
      if (q.life <= 0) {
        this.group.remove(q.obj);
        const m = q.obj as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      const k = r.life / RING_LIFE;
      r.mesh.scale.setScalar(1 + k * 22);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) {
        this.group.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  /** What is still to aim for: the best run so far. */
  private goalLine(): string {
    if (!this.best) return '';
    return this.beaten ? t('game.beaten') : t('game.best', { n: this.text('unit', { n: this.best }) });
  }

  private render(): void {
    const left = this.limit - this.time;
    const clock = el('gTime');
    put(clock, fmt(left));
    clock.classList.toggle('low', left < 30 && this.state === 'play');
    put(el('gPoints'), String(this.count));
    put(el('gScore'), this.text('score'));
    put(el('gGoal'), this.goalLine());
  }
}

export function makeGame(id: string, host: GameHost): Game {
  return new Game(MODE_INFO.find((m) => m.id === id)!, host);
}
