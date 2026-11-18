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

function colourOf(s: Station): string {
  const su = s.kind.replace('R', '');
  return su === 'S' ? S_COLOUR : su === 'U' ? U_COLOUR : OTHER_COLOUR;
}

class Pin {
  readonly group = new THREE.Group();
  private readonly plate: THREE.Sprite;
  private readonly column: THREE.Mesh;

  constructor(readonly x: number, readonly z: number, private readonly label: Label, colour: string,
    height: number, width: number, private readonly scale: number, private readonly range: number) {
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
    this.group.add(this.column, this.plate);
  }

  /** Stands it on the ground, grows it as you come close and fades it out
   *  towards the edge of its range. */
  update(world: World, d: number): void {
    this.group.position.set(this.x, world.height(this.x, this.z), this.z);
    const fade = Math.min(1, (this.range - d) / (this.range * 0.2));
    const k = this.scale * (1.15 - 0.3 * Math.min(1, d / this.range));
    this.plate.scale.set(this.label.w * k, this.label.h * k, 1);
    this.plate.material.opacity = fade;
    (this.column.material as THREE.MeshBasicMaterial).opacity = 0.3 * fade;
  }

  dispose(): void {
    (this.column.material as THREE.Material).dispose();
    this.plate.material.dispose();
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
      new Pin(l.x, l.z, labelTexture(`★ ${l.name}`, SIGHT_COLOUR, 1.1), SIGHT_COLOUR, 90, 3, SIGHT_SCALE, SIGHT_RANGE));
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
      const p = new Pin(s.x, s.z, labelTexture(stationName(s), colour, 0.9), colour, 35, 1.2,
        STATION_SCALE, STATION_RANGE);
      this.mounted.set(s, p);
      this.group.add(p.group);
    }
  }
}
