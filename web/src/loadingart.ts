import * as THREE from 'three';
import { makeSleigh, poseSleigh } from './sleigh';

/**
 * The start menu's and the loading screen's picture: a small 3D scene -
 * falling snow, with a lit Christmas tree on the menu. It draws on its own transparent canvas over the screen's
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
  /** wide: half the width in view at the subject, so things can cross it */
  update(t: number, dt: number, wide: number): void;
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

function snow(): Art {
  const scene = new THREE.Scene();
  const N = 1400;
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, -16 + Math.random() * 20], i * 3);
    speed[i] = 0.6 + Math.random() * 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({
    map: glowTexture(), size: 0.22, transparent: true, depthWrite: false, opacity: 0.95,
  }));
  scene.add(flakes);
  return {
    scene, view: [0, 0],
    update(t, dt) {
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        pos[k] += Math.sin(t * 0.8 + i) * dt * 0.35;
        pos[k + 1] -= speed[i] * dt;
        if (pos[k + 1] < -9) pos[k + 1] += 18;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/* --- the start menu: a lit Christmas tree in the snow ---------------------- */

function tree(): Art {
  const art = snow();
  const scene = art.scene;
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x101018, 0.9));
  const moon = new THREE.DirectionalLight(0xbfd0ff, 1.4);
  moon.position.set(-1, 2, 2);
  scene.add(moon);
  // the star's glow reaches past the tree, and the view keeps the room the
  // snow it stood on had, so the whole is ~1.3 tall with the foot 0.88 of the
  // way down - where the menu's snowfield (index.html, #ground) begins
  const root = new THREE.Group();
  root.position.y = 0.04;
  scene.add(root);
  // the fairy lights' warm spill on the needles
  const spill = new THREE.PointLight(0xffb36b, 0.6, 0, 2);
  spill.position.set(0, 0, 0.35);
  root.add(spill);

  // about one unit tall, centred on the origin: foot at -0.53, star at 0.46
  const group = new THREE.Group();
  root.add(group);
  const needles = new THREE.MeshStandardMaterial({ color: 0x1f5a32, roughness: 0.9, flatShading: true });
  for (const [r, h, y] of [[0.36, 0.34, -0.25], [0.29, 0.3, -0.08], [0.21, 0.26, 0.08], [0.13, 0.22, 0.24]]) {
    const tier = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), needles);
    tier.position.y = y;
    group.add(tier);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 1 }));
  trunk.position.y = -0.47;
  group.add(trunk);

  // the lights: a spiral round the outside, each twinkling to its own beat
  const N = 72;
  const turns = 5;
  const palette = [0xffd9a0, 0xff4a3a, 0xffb454, 0x6fa8ff].map((c) => new THREE.Color(c));
  const pos = new Float32Array(N * 3);
  const base = new Float32Array(N * 3);
  const glow = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const y = -0.4 + u * 0.73;
    const r = (0.36 * (0.35 - y)) / 0.77 + 0.015;
    const a = u * turns * Math.PI * 2;
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    palette[i % palette.length].toArray(base, i * 3);
    phase[i] = Math.random() * Math.PI * 2;
  }
  const lights = new THREE.BufferGeometry();
  lights.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lights.setAttribute('color', new THREE.BufferAttribute(glow, 3));
  const tex = glowTexture();
  const lit = (size: number) => new THREE.PointsMaterial({
    map: tex, size, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  group.add(new THREE.Points(lights, lit(0.1)), new THREE.Points(lights, lit(0.035)));

  // the star faces the camera
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.026 : 0.062;
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false }),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }));
  star.position.set(0, 0.4, 0);
  root.add(star);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xffc46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7,
  }));
  halo.scale.setScalar(0.3);
  halo.position.copy(star.position);
  root.add(halo);

  // Santa crossing the sky over the tree from edge to edge of the window, 1 s
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
    scene, view: [1.3, 0.12],
    update(t, dt, wide) {
      art.update(t, dt, wide);
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        const b = 0.35 + 0.65 * Math.sin(t * (1.3 + (i % 5) * 0.35) + phase[i]) ** 2;
        glow[k] = base[k] * b;
        glow[k + 1] = base[k + 1] * b;
        glow[k + 2] = base[k + 2] * b;
      }
      lights.attributes.color.needsUpdate = true;
      halo.material.opacity = 0.6 + 0.15 * Math.sin(t * 1.7);
      // a little past the edge, for the sleigh's length and its depth behind the tree
      const edge = wide + 1.2;
      const p = t - start;
      if (-edge + p * 1.4 > edge) start = t + 5;
      sleigh.visible = dt > 0 && t >= start;
      if (sleigh.visible) {
        sleigh.position.set(-edge + p * 1.4, 0.56 + Math.sin(p * 1.3) * 0.03, -1);
        sleigh.rotation.x = -Math.cos(p * 1.3) * 0.05;
        poseSleigh(sleigh, t);
      }
    },
  };
}

const ARTS: Record<string, () => Art> = { markets: snow, tree };

export class LoadingArt {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private art: Art | null = null;
  private id = '';
  private anchor: HTMLElement | null = null;
  private frame = 0;
  private t0 = 0;
  private last = 0;
  /** Half the width in view at the subject, from the last frame drawn. */
  private wide = 4;

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
      this.art.update(still ? 1.2 : t, still ? 0 : dt, this.wide);
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
    this.wide = (visible * dist * cam.aspect) / 2;
    cam.position.set(0, Math.sin(down) * dist, Math.cos(down) * dist);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(w, h, 0, h / 2 - cy, w, h);
    cam.updateProjectionMatrix();
    r.render(art.scene, cam);
  }
}

/** The one there is, for the menu and the loading screen. */
export const art = new LoadingArt(document.getElementById('snow') as HTMLCanvasElement);
