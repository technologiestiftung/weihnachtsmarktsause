import * as THREE from 'three';
import { num } from './i18n';

/**
 * Text plates drawn on a canvas: the names over stations and sights
 * (sights.ts) and over the game's markers, and how far those are.
 *
 * The build also has street names and places per tile (pois.json); from the
 * sleigh at night they could not be read, so they are not loaded.
 */

export interface Label { tex: THREE.CanvasTexture; w: number; h: number }

/** One canvas for measuring text, rather than a new one per label. */
let probeCanvas: CanvasRenderingContext2D | null = null;
const probe = () => (probeCanvas ??= document.createElement('canvas').getContext('2d')!);

export function labelTexture(text: string, colour: string, scale = 1, sub = ''): Label {
  const pad = 12;
  // Clan, as on the page (fonts.css); main.ts waits for it before the first label
  const font = `700 ${Math.round(30 * scale)}px Clan, sans-serif`;
  const small = `400 ${Math.round(22 * scale)}px Clan, sans-serif`;
  const p = probe();
  p.font = font;
  let tw = p.measureText(text).width;
  if (sub) {
    p.font = small;
    tw = Math.max(tw, p.measureText(sub).width);
  }
  const w = Math.ceil(tw) + pad * 2;
  const h = Math.round((sub ? 76 : 46) * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.font = font;
  g.textBaseline = 'middle';
  // dark plate keeps the text legible over whatever is underneath
  g.fillStyle = 'rgba(9,23,37,.8)';
  g.beginPath();
  const r = 8;
  g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r);
  g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.16)';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = colour;
  if (sub) {
    g.fillText(text, pad, 25 * scale);
    g.font = small;
    g.fillStyle = 'rgba(245,248,254,.75)';
    g.fillText(sub, pad, 55 * scale);
  } else {
    g.fillText(text, pad, h / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // drawn smaller than painted further off: mipmaps keep the text from shimmering
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return { tex, w, h };
}

/**
 * How far away something is, as a small plate: "40 m", "350 m", "1,2 km".
 * Rounded coarser the further it is, so the handful of plates in use are
 * drawn once and then shared.
 */
const distCache = new Map<string, Label>();
function distanceText(m: number): string {
  if (m < 1000) {
    const step = m < 100 ? 5 : 10;
    return `${Math.max(step, Math.round(m / step) * step)} m`;
  }
  return `${num(m / 1000)} km`;
}
function distanceLabel(m: number): Label {
  const text = distanceText(m);
  let l = distCache.get(text);
  if (!l) {
    l = labelTexture(text, '#e8e6e1', 0.8);
    distCache.set(text, l);
  }
  return l;
}

/** Point a distance plate at the label for m metres; `scale` is per pixel. */
export function setDistance(spr: THREE.Sprite, m: number, scale: number): void {
  const l = distanceLabel(m);
  const mat = spr.material;
  if (mat.map !== l.tex) {
    mat.map = l.tex;
    mat.needsUpdate = true;
  }
  spr.scale.set(l.w * scale, l.h * scale, 1);
}
