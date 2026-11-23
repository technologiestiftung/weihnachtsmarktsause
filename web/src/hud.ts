import { makeFromWorld, type XZ } from './geo';
import type { Player } from './player';
import { onLang, t } from './i18n';
import { LOW } from './quality';
import type { World } from './world';
import { Overview } from './overview';

export interface RenderInfo {
  calls: number;
  triangles: number;
}

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e as T;
}

/**
 * HUD: map, position readout and diagnostics.
 *
 * The map is of Berlin (overview.ts): the districts' outlines and the
 * Christmas markets, north up. M steps from the whole city to the country
 * round the player and closer still. Under it, the district you are over.
 */
export class HUD {
  readonly world: World;
  /** A game's nearest targets, drawn on the minimap as rings. */
  marks: { x: number; z: number; colour: string }[] = [];
  /** Every market of the game, drawn as dots until reached. */
  /** dim: closed today (games.ts), drawn fainter, as the 3D markers are. */
  markets: readonly { x: number; z: number; done: boolean; dim?: boolean }[] = [];
  private readonly area = 'Berlin';
  private readonly canvas = el<HTMLCanvasElement>('map');
  private readonly ctx = this.canvas.getContext('2d')!;
  private readonly statsEl = el('stats');
  private readonly placeEl = el('place');
  private readonly hintEl = el('hint');
  /** Metres across the map; 0 is the whole city. */
  private readonly spans = [0, 10000, 3000];
  private zoom = 0;
  readonly overview: Overview;
  /** The district, as last written under the map. */
  private where = '';
  private hintTimer = 0;
  /** Readouts are written a few times a second, and only when they change:
   *  every DOM write costs a phone a restyle. */
  private textTimer = 0;
  private readonly lastText = new Map<HTMLElement, string>();
  private mapFrame = 0;
  private readonly fromWorld: (x: number, z: number) => XZ;

  constructor(world: World) {
    this.world = world;
    this.fromWorld = makeFromWorld(world.origin);
    this.overview = new Overview(world.origin);
    this.updateLabel();
    onLang(() => this.updateLabel());
  }

  private updateLabel(): void {
    const span = this.spans[this.zoom];
    this.write(el('maplabel'), `${this.where}<span>${t('hud.zoom', { n: span ? `${span / 1000} km` : t('hud.zoomAll') })}</span>`);
  }

  /** The district under the player. */
  private locate(x: number, z: number): void {
    const d = this.overview.districtAt(x, z);
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    this.where = `<b>${esc(d?.name ?? 'Berlin')}</b>`;
    this.updateLabel();
  }

  cycleZoom(): void {
    this.zoom = (this.zoom + 1) % this.spans.length;
    this.updateLabel();
  }

  hint(text: string, seconds = 2.4): void {
    this.hintEl.textContent = text;
    this.hintEl.classList.add('on');
    this.hintTimer = seconds;
  }

  private write(e: HTMLElement, html: string): void {
    if (this.lastText.get(e) === html) return;
    this.lastText.set(e, html);
    e.innerHTML = html;
  }

  draw(player: Player, dt: number, fps: number, info: RenderInfo): void {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hintEl.classList.remove('on');
    }
    // a phone redraws the map every other frame; nobody can tell
    this.mapFrame++;
    if (!LOW || this.mapFrame % 2 === 0) this.drawMap(player);
    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.25;
    const px = player.pos.x, pz = player.pos.z;
    const [lon, lat] = this.fromWorld(px, pz);
    this.locate(px, pz);
    this.write(this.placeEl, `${this.area}<small>${lat.toFixed(5)}, ${lon.toFixed(5)}</small>`);
    // hidden on a phone and during a game
    if (document.body.classList.contains('touch') || document.body.classList.contains('gaming')) return;
    const s = this.world.stats;
    this.write(this.statsEl,
      `<b>${fps.toFixed(0)}</b> ${t('hud.fps')} · <b>${info.calls}</b> ${t('hud.draws')} · `
      + `<b>${(info.triangles / 1e6).toFixed(2)}</b> ${t('hud.tris')}`
      + `<br><b>${s.buildings}</b> ${t('hud.buildings')} · <b>${s.trees}</b> ${t('hud.trees')}`
      + ` · <b>${s.full}</b>/<b>${s.tiles}</b> ${t('hud.tiles')}`
      + `<br>x <b>${px.toFixed(0)}</b>  z <b>${pz.toFixed(0)}</b>  alt <b>${player.pos.y.toFixed(1)}</b> m`);
  }

  private drawMap(player: Player): void {
    const { ctx, overview: ov } = this;
    const size = this.canvas.width;
    const px = player.pos.x, pz = player.pos.z;
    // the whole city sits still; closer in, the map follows the player
    const [x0, z0, x1, z1] = ov.box;
    const all = this.spans[this.zoom] === 0;
    const span = all ? Math.max(x1 - x0, z1 - z0) * 1.04 : this.spans[this.zoom];
    const cx = all ? (x0 + x1) / 2 : px, cz = all ? (z0 + z1) / 2 : pz;
    const scale = size / span;
    const sx = (x: number) => size / 2 + (x - cx) * scale;
    const sz = (z: number) => size / 2 + (z - cz) * scale;

    ctx.save();
    ctx.fillStyle = '#091725';
    ctx.fillRect(0, 0, size, size);

    // districts: a faint fill, the one you are over a little brighter
    const here = ov.districtAt(px, pz);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, size / 2 - cx * scale, size / 2 - cz * scale);
    ctx.lineWidth = 1.1 / scale;
    ctx.lineJoin = 'round';
    for (const d of ov.districts) {
      ctx.fillStyle = d === here ? 'rgba(189,163,59,.12)' : 'rgba(255,255,255,.05)';
      ctx.fill(d.path);
    }
    ctx.strokeStyle = 'rgba(232,230,225,.42)';
    for (const d of ov.districts) ctx.stroke(d.path);
    ctx.restore();

    // every market still to reach, as a small gold star like the finder's
    // markers; the 3D sights and stations (sights.ts) are left off, too
    // small to read at this size
    // markets closed today in grey, as their 3D markers are
    const r = all ? 3 : 4.2;
    for (const m of this.markets) {
      if (m.done) continue;
      ctx.fillStyle = m.dim ? 'rgba(125,140,160,.75)' : '#bda33b';
      const x = sx(m.x), y = sz(m.z);
      if (x < -6 || y < -6 || x > size + 6 || y > size + 6) continue;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
      }
      ctx.closePath();
      ctx.fill();
    }

    // game targets; those off the map sit on its edge, pointing the way
    for (const m of this.marks) {
      let mx = (m.x - cx) * scale, mz = (m.z - cz) * scale;
      const edge = size / 2 - 6;
      const k = Math.max(Math.abs(mx), Math.abs(mz)) / edge;
      if (k > 1) { mx /= k; mz /= k; }
      ctx.beginPath();
      ctx.arc(size / 2 + mx, size / 2 + mz, k > 1 ? 3 : 4, 0, Math.PI * 2);
      ctx.fillStyle = m.colour;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }

    ctx.translate(sx(px), sz(pz));
    // the camera looks along (-sin yaw, -cos yaw); north (-z) is up on the map
    ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f5f8fe';
    ctx.strokeStyle = '#091725';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6.5);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-5.5, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }
}
