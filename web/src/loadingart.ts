import * as THREE from 'three';
import { makeSleigh, poseSleigh } from './sleigh';

/**
 * The start menu's and the loading screen's picture: a small 3D scene -
 * falling snow, and on the menu a lighter snowfall with Santa crossing the top of the window. It draws on its
 * own transparent canvas over the screen's
 * background, behind the text; a scene with a subject places it over a
 * spacer in the text column so the two line up at any window size.
 *
 * A second WebGL context, but a small one, shared by both screens: the
 * canvas moves to whichever is up, it only draws while one is, and its
 * scene is built afresh each time and freed on hide.
 */

interface Art {
  scene: THREE.Scene;
  /** How tall the subject is, centred on the origin, and how steeply the
   *  camera looks down on it (radians); the camera backs off to fit it. */
  view: [number, number];
  update(t: number, dt: number, v: View): void;
}

/** What the window shows, in scene units at the subject's depth. */
interface View {
  /** half the width in view, so things can cross it */
  wide: number;
  /** the height at the window's middle and at its top edge: the subject sits
   *  wherever its spacer is, so the middle of the window need not be at 0 */
  mid: number;
  /** the height, at the sleigh's depth (z = -1), that shows just under the window's top edge */
  sky: number;
}

/* --- shared bits ----------------------------------------------------------- */

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A soft round dot, for flakes and glows. */
const glowTexture = () => canvasTexture(64, 64, (g) => {
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
});

/* --- Weihnachtsmarkt: snow, nothing else ----------------------------------- */

/** n flakes; size and opacity of each; how fast they fall (1 = as on the loading screen). */
function snow(N = 1400, size = 0.22, opacity = 0.95, fall = 1): Art {
  const scene = new THREE.Scene();
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, -16 + Math.random() * 20], i * 3);
    speed[i] = (0.6 + Math.random() * 0.9) * fall;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({
    map: glowTexture(), size, transparent: true, depthWrite: false, opacity,
  }));
  scene.add(flakes);
  return {
    scene, view: [0, 0],
    update(t, dt, v) {
      // the flakes fall round the middle of the window, wherever the subject is
      flakes.position.y = v.mid;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        pos[k] += Math.sin(t * 0.8 + i) * dt * 0.35 * fall;
        pos[k + 1] -= speed[i] * dt;
        if (pos[k + 1] < -9) pos[k + 1] += 18;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/* --- the start menu: a light snowfall, and Santa crossing the sky ---------- */

function sky(): Art {
  // fewer, smaller, fainter and slower flakes than the loading screen's: the
  // menu's text is on a box in front of them, and they shouldn't pull the eye
  const art = snow(500, 0.17, 0.6, 0.7);
  const scene = art.scene;
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x101018, 0.9));
  const moon = new THREE.DirectionalLight(0xbfd0ff, 1.4);
  moon.position.set(-1, 2, 2);
  scene.add(moon);

  // Santa crossing the top of the window from edge to edge, 1 s
  // in and then 5 s after each pass; with reduced motion, never
  const sleigh = makeSleigh(true);
  const len = new THREE.Box3().setFromObject(sleigh).getSize(new THREE.Vector3()).z;
  sleigh.scale.setScalar(0.7 / len);
  sleigh.rotation.order = 'YXZ'; // turned to fly +x, then pitched about its own axle
  sleigh.rotation.y = Math.PI / 2;
  sleigh.visible = false;
  scene.add(sleigh);
  let start = 1;

  return {
    scene, view: [0, 0.12],
    update(t, dt, v) {
      art.update(t, dt, v);
      // a little past the edge, for the sleigh's length
      const edge = v.wide + 1.2;
      const p = t - start;
      if (-edge + p * 1.4 > edge) start = t + 5;
      sleigh.visible = dt > 0 && t >= start;
      if (sleigh.visible) {
        sleigh.position.set(-edge + p * 1.4, v.sky + Math.sin(p * 1.3) * 0.03, -1);
        sleigh.rotation.x = -Math.cos(p * 1.3) * 0.05;
        poseSleigh(sleigh, t);
      }
    },
  };
}

const ARTS: Record<string, () => Art> = { markets: () => snow(), sky };

export class LoadingArt {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private art: Art | null = null;
  private id = '';
  private anchor: HTMLElement | null = null;
  private frame = 0;
  private t0 = 0;
  private last = 0;
  /** What was in view at the subject, from the last frame drawn. */
  private view: View = { wide: 4, mid: 0, sky: 3 };
  private readonly ray = new THREE.Raycaster();
  private readonly skyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1);
  private readonly hit = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {}

  /** host: the screen to draw behind; anchor: the spacer the subject should sit over. */
  show(id: string, host: HTMLElement, anchor: HTMLElement | null = null): void {
    // already falling there: carry on rather than start over
    if (this.art && this.id === id && this.canvas.parentElement === host) return;
    this.hide();
    host.prepend(this.canvas);
    this.id = id;
    this.anchor = anchor;
    this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.art = (ARTS[id] ?? snow)();
    anchor?.classList.toggle('none', id === 'markets');
    this.t0 = this.last = performance.now();
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      if (!this.art) return;
      const t = (now - this.t0) / 1000;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.art.update(still ? 1.2 : t, still ? 0 : dt, this.view);
      this.draw();
      if (!still) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Stop; with a host, only if it is drawing there - another screen may have taken it over. */
  hide(host?: HTMLElement): void {
    if (host && this.canvas.parentElement !== host) return;
    cancelAnimationFrame(this.frame);
    if (!this.art) return;
    this.art.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      for (const mat of [m.material].flat()) {
        if (!mat) continue;
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.art = null;
    this.renderer?.renderLists.dispose();
  }

  private draw(): void {
    const r = this.renderer!, art = this.art!;
    const w = innerWidth, h = innerHeight;
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) r.setSize(w, h, false);
    // the subject at the spacer's centre: shift the view instead of the scene
    const box = this.anchor?.getBoundingClientRect() ?? { top: 0, height: 0 };
    const cy = box.height ? box.top + box.height / 2 : h / 2;
    const cam = this.camera;
    cam.aspect = w / h;
    // back off until the subject is as tall as the spacer, whatever the window
    const [tall, down] = art.view;
    const visible = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = tall && box.height ? tall / (visible * (box.height / h)) : 8;
    // scene units per pixel at the subject; the subject's centre is at cy
    const unit = (visible * dist) / h;
    this.view.wide = (unit * w) / 2;
    this.view.mid = (cy - h / 2) * unit;
    cam.position.set(0, Math.sin(down) * dist, Math.cos(down) * dist);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(w, h, 0, h / 2 - cy, w, h);
    cam.updateProjectionMatrix();
    // where the sleigh flies: the plane it is on (z = -1), seen 7 % down the window (at least 48 px)
    const row = Math.max(48, h * 0.07);
    this.ray.setFromCamera(new THREE.Vector2(0, 1 - (2 * row) / h), cam);
    if (this.ray.ray.intersectPlane(this.skyPlane, this.hit)) this.view.sky = this.hit.y;
    r.render(art.scene, cam);
  }
}

/** The one there is, for the menu and the loading screen. */
export const art = new LoadingArt(document.getElementById('snow') as HTMLCanvasElement);
