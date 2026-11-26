import * as THREE from 'three';
import { type Overview, type Station, stationName } from './overview';
import { labelTexture, type Label } from './labels';
import type { World } from './world';

/**
 * Berlin's sights and its S- and U-Bahn stations as pins in the world,
 * readable from the sleigh. They come from the overview the HUD's map is
 * drawn from (overview.ts), bundled with the client, so they stand
 * whether or not the tiles under them have loaded - unlike the places of
 * pois.ts, which arrive with each tile and are meant for street level.
 *
 * A pin is a faint column of light with a name plate on top, the plate the
 * same size on screen however far off it is. The 32 sights are all built
 * once and shown within SIGHT_RANGE; of the 242 stations only the nearest
 * few are mounted, so they cost a handful of draw calls rather than hundreds.
 */

const SIGHT_COLOUR = '#c49bff';
const S_COLOUR = '#4fbf6a';
const U_COLOUR = '#5b8fe0';
const OTHER_COLOUR = '#f2f0ea';

const SIGHT_RANGE = 3500;
const STATION_RANGE = 900;
const MAX_STATIONS = 8;
/** Per plate pixel, as a share of the screen's height, at middle distance:
 *  about half the texture's size, so the text stays sharp and small. */
const SIGHT_SCALE = 0.00065;
const STATION_SCALE = 0.0006;

const COLUMN = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true).translate(0, 0.5, 0);
/** A station's beam, metres: wide and tall enough to aim the sleigh through
 *  for a burst of speed (games.ts). */
export const STATION_BEAM = { height: 60, width: 4 };
/** A sight's beam: three seconds back on the clock, once a game (games.ts). */
export const SIGHT_BEAM = { height: 90, width: 6 };

/** A station's colour: S and S+U in the S-Bahn's green, U alone in blue, the rest white.
 *  The game's speed lines take it on in a station's boost (games.ts). */
export function colourOf(s: Station): string {
  return s.kind.includes('S') ? S_COLOUR : s.kind.includes('U') ? U_COLOUR : OTHER_COLOUR;
}

/** A symbol at the top of a beam, as the markets have their star: drawn, not an
 *  emoji, in the beam's colour over a dark rim so it reads against the sky. */
function symbol(draw: (g: CanvasRenderingContext2D) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Stroke a path twice: a dark rim, then the colour. */
function rimmed(g: CanvasRenderingContext2D, colour: string, width: number, path: () => void): void {
  for (const [style, w] of [['rgba(9,23,37,.9)', width + 8], [colour, width]] as const) {
    g.beginPath();
    path();
    g.strokeStyle = style;
    g.lineWidth = w;
    g.stroke();
  }
}

const symbols = new Map<string, THREE.Texture>();

/** A station's >>>: three chevrons, for the burst of speed through its beam. */
function chevrons(colour: string): THREE.Texture {
  const key = `>>>${colour}`;
  let t = symbols.get(key);
  if (!t) {
    t = symbol((g) => rimmed(g, colour, 12, () => {
      for (const x of [22, 52, 82]) { g.moveTo(x, 34); g.lineTo(x + 24, 64); g.lineTo(x, 94); }
    }));
    symbols.set(key, t);
  }
  return t;
}

/** A sight's clock: seconds back on the clock through its beam. */
function clock(colour: string): THREE.Texture {
  const key = `clock${colour}`;
  let t = symbols.get(key);
  if (!t) {
    t = symbol((g) => {
      rimmed(g, colour, 10, () => g.arc(64, 64, 44, 0, Math.PI * 2));
      rimmed(g, colour, 10, () => { g.moveTo(64, 64); g.lineTo(64, 36); g.moveTo(64, 64); g.lineTo(84, 74); });
    });
    symbols.set(key, t);
  }
  return t;
}

class Pin {
  readonly group = new THREE.Group();
  private readonly plate: THREE.Sprite;
  private readonly column: THREE.Mesh;
  private readonly icon: THREE.Sprite;

  constructor(readonly x: number, readonly z: number, private readonly label: Label, colour: string,
    height: number, width: number, private readonly scale: number, private readonly range: number,
    icon: THREE.Texture, private readonly iconSize: number) {
    this.column = new THREE.Mesh(COLUMN, new THREE.MeshBasicMaterial({
      color: colour, transparent: true, opacity: 0.3, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    }));
    this.column.scale.set(width, height, width);
    // over the buildings, so the way to a sight shows from anywhere
    this.plate = new THREE.Sprite(new THREE.SpriteMaterial({
      map: label.tex, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, fog: false,
    }));
    // the same order as the game's markers: whichever is nearer is drawn on top
    this.plate.renderOrder = 30;
    this.plate.center.set(0.5, 0);
    this.plate.position.y = height;
    // the symbol on top of the beam, the plate on top of the symbol
    this.icon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: icon, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false, fog: false,
    }));
    this.icon.renderOrder = 30;
    this.icon.center.set(0.5, 0);
    this.icon.position.y = height;
    this.icon.scale.set(iconSize, iconSize, 1);
    this.group.add(this.column, this.icon, this.plate);
  }

  /** Stands it on the ground, grows it as you come close and fades it out
   *  towards the edge of its range. */
  update(world: World, d: number): void {
    this.group.position.set(this.x, world.height(this.x, this.z), this.z);
    const fade = Math.min(1, (this.range - d) / (this.range * 0.2));
    const k = this.scale * (1.15 - 0.3 * Math.min(1, d / this.range));
    this.plate.scale.set(this.label.w * k, this.label.h * k, 1);
    this.plate.center.set(0.5, -this.iconSize * 0.9 / (this.label.h * k));
    this.plate.material.opacity = fade;
    this.icon.material.opacity = fade;
    (this.column.material as THREE.MeshBasicMaterial).opacity = 0.3 * fade;
  }

  dispose(): void {
    (this.column.material as THREE.Material).dispose();
    this.plate.material.dispose();
    // the symbol's texture is shared: only this sprite's material goes
    this.icon.material.dispose();
    this.label.tex.dispose();
  }
}

export class SightLayer {
  readonly group = new THREE.Group();
  private readonly sights: Pin[];
  private readonly mounted = new Map<Station, Pin>();
  /** Stations are picked again a few times a second, not every frame. */
  private pickTimer = 0;

  constructor(scene: THREE.Scene, private readonly world: World, private readonly overview: Overview) {
    scene.add(this.group);
    this.sights = overview.landmarks.map((l) =>
      new Pin(l.x, l.z, labelTexture(`★ ${l.name}`, SIGHT_COLOUR, 1.1), SIGHT_COLOUR, SIGHT_BEAM.height, SIGHT_BEAM.width, SIGHT_SCALE, SIGHT_RANGE,
        clock(SIGHT_COLOUR), 0.045));
  }

  get visible(): boolean { return this.group.visible; }
  set visible(on: boolean) { this.group.visible = on; }

  update(x: number, z: number, dt: number): void {
    if (!this.group.visible) return;
    for (const p of this.sights) {
      const d = Math.hypot(p.x - x, p.z - z);
      const on = d < SIGHT_RANGE;
      if (on && !p.group.parent) this.group.add(p.group);
      else if (!on && p.group.parent) this.group.remove(p.group);
      if (on) p.update(this.world, d);
    }

    this.pickTimer -= dt;
    if (this.pickTimer <= 0) {
      this.pickTimer = 0.5;
      this.pickStations(x, z);
    }
    for (const p of this.mounted.values()) p.update(this.world, Math.hypot(p.x - x, p.z - z));
  }

  private pickStations(x: number, z: number): void {
    const near = this.overview.stations
      .map((s) => [Math.hypot(s.x - x, s.z - z), s] as const)
      .filter(([d]) => d < STATION_RANGE)
      .sort((a, b) => a[0] - b[0])
      .slice(0, MAX_STATIONS);
    const keep = new Set(near.map(([, s]) => s));
    for (const [s, p] of [...this.mounted]) {
      if (keep.has(s)) continue;
      this.group.remove(p.group);
      p.dispose();
      this.mounted.delete(s);
    }
    for (const [, s] of near) {
      if (this.mounted.has(s)) continue;
      const colour = colourOf(s);
      const p = new Pin(s.x, s.z, labelTexture(stationName(s), colour, 0.9), colour, STATION_BEAM.height, STATION_BEAM.width,
        STATION_SCALE, STATION_RANGE, chevrons(colour), 0.035);
      this.mounted.set(s, p);
      this.group.add(p.group);
    }
  }
}
