import './fonts.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { World } from './world';
import { Player } from './player';
import { HUD } from './hud';
import { SightLayer } from './sights';
import { skyMaterial } from './materials';
import { FOG_DAY, FOG_NIGHT, SUN_DIR, installAtmosphere } from './atmosphere';
import { makeGame, startPoint, type Game } from './games';
import { GameLoader } from './loading';
import { bestCount } from './scores';
import { Menu, type Choice } from './menu';
import { applyStatic, onLang, t } from './i18n';
import { Settings } from './settings';
import { art } from './loadingart';
import { unlockAudio } from './sfx';
import { TouchControls, isTouchDevice } from './touch';
import { makeSleigh, poseSleigh } from './sleigh';
import { LOW } from './quality';
import { makeHuman, poseIdle } from './character';


const boot = document.getElementById('boot')!;
const bootMsg = document.getElementById('bootmsg')!;
const bar = document.querySelector<HTMLElement>('#bar div')!;

applyStatic();
// the tree and the snow from the start, while the city loads behind the black
art.show('tree', boot, document.getElementById('bootArt'));
// browsers allow sound only after a click or key
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

const say = (m: string, pct?: number) => {
  bootMsg.textContent = m;
  if (pct !== undefined) bar.style.width = `${Math.round(pct * 100)}%`;
};
// A failed load is for the console, not the player: the menu stays as it is,
// and start says on the loading screen to come back later.
let worldFailed = false;
const fail = (err: unknown) => {
  if (worldLoaded) return;
  console.error('the world failed to load:', err);
  worldFailed = true;
  if (waiting) loader.stuck(t('load.later'));
};
window.addEventListener('error', (e) => fail(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

/* --- menu ---------------------------------------------------------------- */

// The menu needs nothing of the city, so it opens at once. Start pressed
// while the world still loads waits for it on the loading screen.
let worldLoaded = false;
/** Start, pressed before the world was there. */
let waiting: Choice | null = null;
const settings = new Settings();
const loader = new GameLoader();
const menu = new Menu((c) => {
  if (worldLoaded) return void choose(c);
  waiting = c;
  loader.show(c.id);
  if (worldFailed) loader.stuck(t('load.later'));
}, settings);
// backing out of that wait needs no step to finish: straight back to the menu
loader.onCancel = () => {
  if (!waiting) return;
  waiting = null;
  loader.hide();
  menu.show();
};
menu.ready();

/* --- renderer ------------------------------------------------------------ */

// A phone (quality.ts) draws at 1.5x without multisampling: a 3x screen at
// 2x with 4x MSAA is ~60 MB of framebuffer before anything is drawn, and
// the extra sharpness barely shows on a screen that small.
installAtmosphere();
const renderer = new THREE.WebGLRenderer({
  antialias: !LOW,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
// Everything in the city is a standard PBR material now, so three does the
// tone mapping and colour conversion - the sky and the haze included.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.25, 6000);

const fog = new THREE.Fog(FOG_DAY.getHex(), 260, 1100);
const background = FOG_DAY.clone();
const FOG_SCRATCH = new THREE.Color();
const SUN_NIGHT = new THREE.Color(0x8aa0d0);
scene.fog = fog;
scene.background = background;

const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 16), skyMaterial());
sky.frustumCulled = false;
scene.add(sky);

const sunDir = SUN_DIR;

// A neutral studio environment for reflections and fill. Without one, every
// metallic or glossy surface OSM2World's materials declare - window glass
// above all - renders as flat black.
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

// The sun, faded to moonlight in a game. No shadows: the game is at night,
// and they were the most expensive thing in the frame.
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfdcf0, 0x4a4840, 0.8);
scene.add(hemi);
// how much of the fill comes from the hemisphere light; the sky HDRI, once
// loaded, takes most of it over
let hemiDay = 0.8;
let envDay = 0.7;

/* --- world --------------------------------------------------------------- */

say(t('boot.manifest'), 0.1);
const world = new World(scene);
await world.init((m) => say(m, 0.5), renderer);

// Image-based lighting from a real (overcast) sky instead of the studio room.
if (world.manifest.environment) {
  say(t('boot.sky'), 0.55);
  try {
    const hdr = await new RGBELoader().loadAsync(world.envUrl(world.manifest.environment.file));
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    hdr.dispose();
    envDay = 0.6;
    hemiDay = 0.35;
  } catch (err) {
    console.warn('sky lighting unavailable, keeping the studio environment', err);
  }
}

const player = new Player(world);
const hud = new HUD(world);
const sights = new SightLayer(scene, world, hud.overview);

// Wait behind the menu where every game starts: the tiles it needs stream
// in while the start page is read, so start has little left to load. The
// menu itself needs none of them.
const [sx, sz] = startPoint(hud.overview, world) ?? [world.spawnPoint.x, world.spawnPoint.z];
player.pos.set(sx, 0, sz);
player.yaw = Math.PI * 0.25;
const touchDevice = isTouchDevice();
if (touchDevice) {
  // a phone has no room for the full credits; the licences still show
  document.getElementById('credits')!.dataset.i18n = 'credits.short';
  applyStatic();
}

say(t('boot.ready'), 1);

/* --- input --------------------------------------------------------------- */

// declared before the listeners below: they can fire while the world is
// still streaming behind the top-level await
let night = 0;
const keys = new Set<string>();
let pointerLocked = false;

/* --- the game ------------------------------------------------------------ */

let game: Game | null = null;
/** Started where it should: on the board. */
let gameRanked = false;
let gameChoice: Choice | null = null;
let starting = false;
/** A game on hold: the clock, the rules and the player all wait. */
let paused = false;
let pausedAt = 0;

async function choose(c: Choice): Promise<void> {
  keys.clear();
  if (starting) return;
  starting = true;
  // the course and its tiles take a moment; the city behind it stays
  // covered until the game takes over
  loader.show(c.id);
  try {
    const g = makeGame(c.id, { scene, world, player, hud, camera, setNight: (n) => { night = n; } });
    // Esc on the loading screen: give up after whatever step is under way
    const backOut = () => {
      if (!loader.cancelled) return false;
      g.stop();
      menu.show();
      return true;
    };
    await g.load();
    if (backOut()) return;
    // without the start in this build there is no fair start: unranked, where you are
    const at = g.startAt();
    if (at) {
      await world.ensure(at[0], at[1]);
      if (backOut()) return;
      player.spawn(at[0], at[1]);
    }
    g.prepare();
    await cityAround();
    // again, now the whole neighbourhood is in: with only the one tile, the
    // free spot next to it can sit on ground that had no height yet
    if (at) player.spawn(at[0], at[1]);
    if (backOut()) return;
    // after a quick load the click on start still counts as the gesture
    // pointer lock needs; after a long one, a click on the city takes the mouse
    if (!touchDevice) lockPointer();
    // the run to beat, chased live
    if (at) g.best = bestCount(c.id);
    document.body.classList.add('gaming');
    game = g;
    gameRanked = !!at;
    gameChoice = c;
    g.start();
    hud.hint(at ? '' : t('hint.noFair'), at ? 0.01 : 5);
    if (!touchDevice) {
      setTimeout(() => { if (game === g && !pointerLocked) hud.hint(t('hint.clickToSteer'), 5); }, 500);
    }
  } catch (err) {
    // back to the menu: outside a game there is nothing to do
    menu.showNote(() => t('hint.cantStart', { e: (err as Error).message }));
  } finally {
    starting = false;
    loader.hide();
  }
}

/** Hold the loading screen until the city right around the player has
 *  streamed in (World.progress) - or 30 s have passed, should a tile never
 *  arrive. */
async function cityAround(): Promise<void> {
  const until = performance.now() + 30_000;
  for (;;) {
    const { done, total } = world.progress(player.pos.x, player.pos.z);
    loader.progress(total ? done / total : 1);
    if (done >= total || performance.now() > until || loader.cancelled) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Take the running game down; returns it for the result. */
function stopGame(): Game | null {
  const g = game;
  if (!g) return null;
  game = null;
  setPaused(false);
  g.stop();
  document.body.classList.remove('gaming');
  keys.clear();
  return g;
}

function endGame(abandoned: boolean): void {
  const g = stopGame();
  if (!g) return;
  if (abandoned || !g.result) {
    menu.showNote(() => t('menu.abandoned'));
    return;
  }
  // kept only once a nickname is given, on the result screen (menu.ts)
  menu.showResult(g.info.id, g.result, { mode: g.info.id, ranked: gameRanked, count: g.result.count, at: Date.now() });
}

/* --- pause ---------------------------------------------------------------- */

const pauseEl = document.getElementById('pause')!;

function setPaused(on: boolean): void {
  if (on === paused) return;
  paused = on;
  pauseEl.classList.toggle('on', on);
  // the speed lines are the game's; they stop with it
  document.body.classList.toggle('paused', on);
  keys.clear();
  if (on) {
    pausedAt = performance.now();
    pauseInfo();
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    settings.close();
  }
}

const pauseInfo = () => { document.getElementById('pauseInfo')!.textContent = game?.status() ?? ''; };
// the language can change in the settings, over the pause screen
onLang(() => { if (paused) pauseInfo(); });

/** Pause a running game; Esc, P, the touch ⏸, the tab going out of sight. */
function pause(): void {
  if (game && game.state !== 'over' && !menu.open) setPaused(true);
}

function resume(): void {
  setPaused(false);
  if (!touchDevice) lockPointer();
}

document.getElementById('pauseResume')!.addEventListener('click', resume);
document.getElementById('pauseSettings')!.addEventListener('click', () => settings.show());
document.getElementById('pauseExit')!.addEventListener('click', () => endGame(true));
document.getElementById('pauseRestart')!.addEventListener('click', () => {
  const c = gameChoice;
  stopGame();
  if (c) void choose(c);
});
// a call, the app switcher, another tab: nobody plays on unseen
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// a name field in the menu
const typing = () => document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text';

addEventListener('keydown', (e) => {
  if (typing()) {
    // let the text field have the keyboard to itself
    if (e.code === 'Escape') { (document.activeElement as HTMLElement).blur(); }
    return;
  }
  // nothing to do while a game loads behind its screen
  if (starting) return;
  if (e.code === 'Space') e.preventDefault();
  if (keys.has(e.code)) return;
  if (game && e.code === 'Escape') {
    // leaving pointer lock with Esc pauses already; the same Esc arriving
    // a moment later must not resume
    if (!paused) pause();
    else if (performance.now() - pausedAt > 300) resume();
    return;
  }
  if (menu.open || paused) return;
  keys.add(e.code);
  switch (e.code) {
    case 'KeyC':
      player.camMode = (player.camMode + 1) % 3;
      hud.hint(t(`hint.cam${player.camMode}`));
      break;
    // the names over stations and sights
    case 'KeyT': {
      const on = !sights.visible;
      sights.visible = on;
      hud.hint(t(on ? 'hint.labelsOn' : 'hint.labelsOff'));
      break;
    }
    case 'KeyM':
      hud.cycleZoom();
      break;
    default:
      break;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/** Capture the mouse; refused in some contexts (headless, iframes), which is fine. */
function lockPointer(): void {
  try {
    void (renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {});
  } catch { /* keyboard still works */ }
}
renderer.domElement.addEventListener('click', () => {
  if (!pointerLocked) lockPointer();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  // Esc releases the mouse before the page ever sees the key
  if (!pointerLocked && game?.state === 'play') pause();
});
/** Turn the view by pixel deltas: the mouse, or a finger dragging. */
function look(dx: number, dy: number): void {
  player.yaw -= dx * 0.0022;
  player.pitch -= dy * 0.0019;
  player.pitch = Math.max(-1.3, Math.min(1.15, player.pitch));
}
addEventListener('mousemove', (e) => {
  if (pointerLocked) look(e.movementX, e.movementY);
});

const touch = touchDevice ? new TouchControls(look, [
  { label: '⏸', code: 'Escape' },
  { label: '🎥', code: 'KeyC' },
]) : null;
let touchShown = true;

/**
 * Keep the drawing buffer matched to the window.
 *
 * A plain resize listener is not enough: if the page loads while the tab or
 * container has no layout yet, innerWidth/innerHeight are 0, the canvas is
 * sized 0x0, and no resize event ever follows - the game then renders nothing,
 * forever, at a perfectly healthy frame rate. So the size is also reconciled
 * from the render loop, which costs a comparison per frame and cannot get
 * stuck.
 */
let viewW = 0;
let viewH = 0;
function fitToWindow(): void {
  const w = Math.max(1, innerWidth);
  const h = Math.max(1, innerHeight);
  if (w === viewW && h === viewH) return;
  viewW = w;
  viewH = h;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
}
addEventListener('resize', fitToWindow);
fitToWindow();

worldLoaded = true;
if (waiting) {
  const c = waiting;
  waiting = null;
  void choose(c);
}
void boot;

/* --- avatar and sleigh --------------------------------------------------- */

// Built from primitives and posed by joint rotation, so nothing has to be
// downloaded and they stay readable at third-person distance. See
// character.ts and sleigh.ts.
const avatar = makeHuman();
// lit by the same sun and sky as the city
scene.add(avatar);

const sleigh = makeSleigh();
sleigh.visible = false;
sleigh.rotation.order = 'YXZ';
scene.add(sleigh);

/* --- frame loop ---------------------------------------------------------- */

let nightMix = 0;
let last = performance.now();
let fps = 60;
let acc = 0;

/** Seconds ahead the city streams in, and at most how far, metres. */
const LOOK_AHEAD = 5;
const LOOK_AHEAD_MAX = LOW ? 400 : 600;
/** x and z, as a 2D vector. */
const lastPos = new THREE.Vector2();
const vel = new THREE.Vector2();
const prevVel = new THREE.Vector2();

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  fps += ((1 / Math.max(dt, 1e-4)) - fps) * 0.08;
  acc += dt;

  // stream towards where the sleigh will be in a few seconds as well
  if (dt > 0) {
    vel.set((player.pos.x - lastPos.x) / dt, (player.pos.z - lastPos.y) / dt)
      .lerp(prevVel, 0.9);
    prevVel.copy(vel);
  }
  lastPos.set(player.pos.x, player.pos.z);
  const ahead = Math.min(LOOK_AHEAD * vel.length(), LOOK_AHEAD_MAX) / Math.max(vel.length(), 1e-6);
  world.update(player.pos.x, player.pos.z, player.pos.x + vel.x * ahead, player.pos.z + vel.y * ahead);
  // the menu pauses play, and nobody moves before the countdown says go
  const held = menu.open || paused || starting;
  if (!held && game?.state !== 'countdown') player.update(dt, keys);
  if (touch && touchShown === held) {
    touchShown = !held;
    touch.visible = touchShown;
  }
  // the menu is opaque: keep the tiles coming in behind it, but draw nothing
  if (menu.open) return;
  if (game && !held) {
    game.update(dt);
    if (game.state === 'over') endGame(false);
  }
  sights.update(player.pos.x, player.pos.z, dt);
  const head = player.applyCamera(camera, dt);

  // --- character, sleigh and pose --------------------------------------
  const firstPerson = player.camMode === 2 || camera.position.distanceTo(head) < 0.8;
  const show = !firstPerson && !player.sleigh;
  avatar.visible = show;
  sleigh.visible = player.sleigh;
  if (player.sleigh) {
    sleigh.position.copy(player.pos);
    sleigh.rotation.set(-player.pitch * 0.6, player.yaw + Math.PI, player.lean);
    poseSleigh(sleigh, acc);
  }

  // modelled facing +Z; travel is along -Z, hence the half turn
  avatar.position.copy(player.pos);
  avatar.rotation.set(0, player.heading + Math.PI, 0);
  // outside the sleigh the player only ever stands, behind the menu
  if (show) poseIdle(avatar, acc);

  nightMix += (night - nightMix) * Math.min(1, dt * 2.5);
  // scratch colours, not new ones: a phone's garbage collector stutters
  const fogColor = FOG_SCRATCH.lerpColors(FOG_DAY, FOG_NIGHT, nightMix);
  // The night haze closes where full detail ends (World.viewLimit), so
  // buildings never appear in plain view - they stream in behind it.
  const far = world.viewLimit;
  const near = far * 0.45;
  fog.color.copy(fogColor);
  fog.near = near;
  fog.far = far;
  background.copy(fogColor);
  sky.position.copy(camera.position);
  sky.material.uniforms.uFog.value.copy(fogColor);

  world.setEnv({ night: nightMix, time: acc });

  // sun and sky light fade together; the sun follows the player, as only
  // its direction counts
  sun.intensity = 2.6 * (1 - nightMix) + 0.08;
  sun.color.setHex(0xfff1dc).lerp(SUN_NIGHT, nightMix);
  hemi.intensity = hemiDay * (1 - nightMix) + 0.12;
  scene.environmentIntensity = envDay * (1 - nightMix) + 0.1 * nightMix;
  renderer.toneMappingExposure = 1.0 - nightMix * 0.25;
  const { x: fx, z: fz } = player.pos;
  sun.target.position.set(fx, 0, fz);
  sun.position.set(fx + sunDir.x * 400, sunDir.y * 400, fz + sunDir.z * 400);

  fitToWindow();
  renderer.render(scene, camera);
  hud.draw(player, dt, fps, renderer.info.render);
  void head;
}
requestAnimationFrame(frame);

// expose for quick console poking during development
(window as unknown as { __berlin: object }).__berlin =
  { world, player, camera, renderer, scene, hud, menu, game: () => game };
