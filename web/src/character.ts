import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Procedural articulated characters: the player and Santa.
 *
 * Everything here is built from primitives and animated by driving joint
 * rotations directly. No skinned glTF: the page loads no external assets, and
 * a jointed figure at third-person distance reads perfectly well while costing
 * a few thousand triangles and no download.
 *
 * The look is soft toy rather than bare boxes: rounded blocks, capsule limbs,
 * a face, hands and sneakers, a hoodie and a backpack - the back is what the
 * chase camera sees most. Geometry and materials are shared through small
 * caches, so a second figure (Santa) costs next to nothing.
 *
 * Standing, the hips rest on whichever foot is lower, so the feet meet the
 * ground (poseIdle); Santa sits in the sleigh (poseDrive).
 */

const SKIN = 0xd8a07a;
const JACKET = 0xe0673c;

export interface Rig {
  body: THREE.Group;
  hips: THREE.Group;
  /** Everything above the waist: a lean or twist here carries the arms and head. */
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group; armR: THREE.Group;
  foreL: THREE.Group; foreR: THREE.Group;
  legL: THREE.Group; legR: THREE.Group;
  shinL: THREE.Group; shinR: THREE.Group;
  /** Ankles: a foot's rotation.x, positive tips the toes down. */
  footL: THREE.Object3D; footR: THREE.Object3D;
}

export interface Palette {
  skin?: number; top?: number; legs?: number; hair?: number; shoes?: number;
  /** A backpack in this colour; null for none. */
  pack?: number | null;
  /** The hoodie's hood, lying at the back of the neck. */
  hood?: boolean;
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, roughness = 0.8, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${JSON.stringify(extra)}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    mats.set(key, m);
  }
  return m;
}

const geos = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}

/** A block with rounded edges: the basic shape of everything here. */
function block(w: number, h: number, d: number, r: number, m: THREE.Material): THREE.Mesh {
  const rr = Math.min(r, w / 2, h / 2, d / 2) * 0.999;
  return new THREE.Mesh(geo(`b${w},${h},${d},${rr}`, () => new RoundedBoxGeometry(w, h, d, 2, rr)), m);
}

/**
 * The trunk: one rounded block, h tall, w by d at the shoulders and
 * narrowing to `waist` of that at the bottom - a single body, not a chest
 * stacked on a belly.
 */
function trunk(w: number, h: number, d: number, r: number, waist: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(geo(`t${w},${h},${d},${r},${waist}`, () => {
    const g = new RoundedBoxGeometry(w, h, d, 3, r);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const f = waist + (1 - waist) * (pos.getY(i) / h + 0.5), fz = 0.5 + 0.5 * f;
      pos.setX(i, pos.getX(i) * f);
      pos.setZ(i, pos.getZ(i) * fz);
      // the box's own smooth normals, carried through the squeeze
      n.set(nor.getX(i) / f, nor.getY(i), nor.getZ(i) / fz).normalize();
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    return g;
  }), m);
}

function ball(r: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 12, 8)), m);
}

function rig(root: THREE.Object3D): Rig {
  return root.userData.rig as Rig;
}

/** A limb that pivots from its top end, like a real joint: h long, r0 thick there and r1 at its other end. */
function limb(r0: number, r1: number, h: number, m: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  // tapering from the joint it hangs from to the next, a ball centred on
  // each: a bent knee or elbow stays round and closed, where two capsules
  // ending at the joint met in a notch
  const shaft = new THREE.Mesh(geo(`l${r0},${r1},${h}`, () => new THREE.CylinderGeometry(r0, r1, h, 12, 1, true)), m);
  shaft.position.y = -h / 2;
  const end = ball(r1, m);
  end.position.y = -h;
  pivot.add(shaft, ball(r0, m), end);
  pivot.userData.length = h;
  return pivot;
}

/** Hip joint height when standing, and the leg it stands on. */
const HIP = 0.92;
const LEG_Y = -0.02;          // the thighs hang from just below the hip pivot
const THIGH = 0.43;
const SHIN = 0.40;
/** The sole's underside below the ankle, and the heel and toe either side of it. */
const SOLE = 0.0675;
const HEEL = -0.11;
const TOE = 0.18;
/** Shoulder above the waist joint; upper arm, and elbow to the middle of the hand. */
const SHOULDER = 0.4;
const UPPER_ARM = 0.30;
const FOREARM = 0.30;

function shade(c: number, f: number): number {
  return new THREE.Color(c).multiplyScalar(f).getHex();
}

/** A sneaker hung from the ankle: a white sole and a coloured upper, toe forward (+Z). */
function sneaker(colour: number): THREE.Group {
  const g = new THREE.Group();
  const sole = block(0.13, 0.035, 0.29, 0.016, mat(0xf2f0ea, 0.6));
  sole.position.set(0, -SOLE + 0.0175, (HEEL + TOE) / 2);
  const upper = block(0.12, 0.075, 0.25, 0.035, mat(colour, 0.6));
  upper.position.set(0, -0.02, (HEEL + TOE) / 2 - 0.015);
  g.add(sole, upper);
  return g;
}

/** Part of a sphere: theta from the top down, phi round from -X. */
function dome(r: number, phi0: number, phiLen: number, thetaLen: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(geo(`d${r},${phi0},${phiLen},${thetaLen}`, () =>
    new THREE.SphereGeometry(r, 16, 10, phi0, phiLen, 0, thetaLen)), m);
}

export function makeHuman(palette: Palette = {}): THREE.Group {
  const top = palette.top ?? JACKET;
  const skinM = mat(palette.skin ?? SKIN, 0.7);
  const topM = mat(top, 0.85);
  const topShade = mat(shade(top, 0.8), 0.85);
  const legsM = mat(palette.legs ?? 0x3a4a6b, 0.9);
  const hairM = mat(palette.hair ?? 0x2a2118, 0.9);
  const dark = mat(0x1b1d22, 0.4);
  const white = mat(0xffffff, 0.4);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = HIP;
  body.add(hips);
  const pelvis = block(0.33, 0.2, 0.21, 0.08, legsM);
  pelvis.position.y = 0.0;
  hips.add(pelvis);

  // Everything above the waist hangs from one joint, so a lean or a twist
  // carries the shoulders, arms and head along instead of shearing past them.
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  // one body from the shoulders down to the hem over the belt
  const jacket = trunk(0.4, 0.5, 0.24, 0.085, 0.84, topM);
  jacket.position.y = 0.22;
  const pocket = block(0.22, 0.09, 0.02, 0.01, topShade);
  pocket.position.set(0, 0.06, 0.107);
  torso.add(jacket, pocket);
  if (palette.hood ?? true) {
    const hood = block(0.24, 0.08, 0.1, 0.04, topShade);
    hood.position.set(0, 0.465, -0.075);
    hood.rotation.x = 0.3;
    torso.add(hood);
  }
  if (palette.pack !== null) {
    const packC = palette.pack ?? 0x2f6f62;
    const pack = block(0.27, 0.31, 0.12, 0.055, mat(packC, 0.85));
    pack.position.set(0, 0.28, -0.17);
    const flap = block(0.27, 0.08, 0.13, 0.035, mat(shade(packC, 0.75), 0.85));
    flap.position.set(0, 0.41, -0.17);
    torso.add(pack, flap);
    // straps over the shoulders and down the front
    const strapM = mat(shade(packC, 0.6), 0.85);
    for (const s of [-1, 1]) {
      const over = block(0.045, 0.025, 0.25, 0.01, strapM);
      over.position.set(s * 0.1, 0.475, -0.005);
      const front = block(0.045, 0.24, 0.02, 0.01, strapM);
      front.position.set(s * 0.1, 0.34, 0.121);
      torso.add(over, front);
    }
  }

  const neck = new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.054, 0.06, 0.09, 10)), skinM);
  neck.position.y = 0.49;
  torso.add(neck);

  // a round head: the skull a sphere, the hair a cap over its top and back
  const head = new THREE.Group();
  head.position.y = 0.515;
  torso.add(head);
  const skull = ball(0.12, skinM);
  skull.scale.set(0.95, 1.08, 1);
  skull.position.y = 0.115;
  const cap = dome(0.127, 0, Math.PI * 2, 1.15, hairM);
  const back = dome(0.127, Math.PI, Math.PI, 2.05, hairM);
  for (const h of [cap, back]) {
    h.scale.set(0.95, 1.08, 1);
    h.position.y = 0.118;
    h.position.z = -0.004;
  }
  head.add(skull, cap, back);
  // the face, sized for the skull above; the whole head a little larger than life
  const face = new THREE.Group();
  head.add(face);
  for (const s of [-1, 1]) {
    const eye = ball(0.017, dark);
    eye.scale.set(0.85, 1.2, 0.5);
    eye.position.set(s * 0.043, 0.122, 0.108);
    const glint = ball(0.005, white);
    glint.position.set(s * 0.043 + 0.005, 0.129, 0.116);
    const brow = block(0.042, 0.012, 0.014, 0.005, hairM);
    brow.position.set(s * 0.046, 0.158, 0.101);
    brow.rotation.z = -s * 0.12;
    const ear = ball(0.032, skinM);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * 0.113, 0.11, -0.005);
    face.add(eye, glint, brow, ear);
  }
  const nose = ball(0.019, skinM);
  nose.scale.set(0.9, 1, 1.1);
  nose.position.set(0, 0.098, 0.12);
  const mouth = block(0.046, 0.01, 0.01, 0.004, mat(0x8a4b3c, 0.7));
  mouth.position.set(0, 0.06, 0.106);
  face.add(nose, mouth);
  for (const o of [...head.children]) {
    o.position.multiplyScalar(1.08);
    o.scale.multiplyScalar(1.08);
  }

  // the shoulders round the body's top corners, sunk into it, so an arm
  // swings out of the body rather than off a ball beside it
  const armL = limb(0.066, 0.055, UPPER_ARM, topM);
  const armR = limb(0.066, 0.055, UPPER_ARM, topM);
  armL.position.set(-0.205, SHOULDER, 0);
  armR.position.set(0.205, SHOULDER, 0);
  for (const s of [-1, 1]) {
    const shoulder = ball(0.078, topM);
    shoulder.scale.set(1, 0.92, 1.1);
    shoulder.position.set(s * 0.188, SHOULDER + 0.008, 0);
    torso.add(shoulder);
  }
  torso.add(armL, armR);

  const foreL = limb(0.055, 0.043, 0.27, topM);
  const foreR = limb(0.055, 0.043, 0.27, topM);
  foreL.position.y = -UPPER_ARM;
  foreR.position.y = -UPPER_ARM;
  armL.add(foreL);
  armR.add(foreR);
  for (const f of [foreL, foreR]) {
    const cuff = new THREE.Mesh(geo('cuff', () => new THREE.CylinderGeometry(0.058, 0.058, 0.04, 10)), topShade);
    cuff.position.y = -0.245;
    const hand = ball(0.05, skinM);
    hand.scale.set(0.8, 1.05, 0.95);
    hand.position.y = -FOREARM;
    f.add(cuff, hand);
  }

  const legL = limb(0.094, 0.075, THIGH, legsM);
  const legR = limb(0.094, 0.075, THIGH, legsM);
  legL.position.set(-0.095, LEG_Y, 0);
  legR.position.set(0.095, LEG_Y, 0);
  hips.add(legL, legR);

  const shinL = limb(0.073, 0.048, SHIN, legsM);
  const shinR = limb(0.073, 0.048, SHIN, legsM);
  shinL.position.y = -THIGH;
  shinR.position.y = -THIGH;
  legL.add(shinL);
  legR.add(shinR);

  const footL = sneaker(palette.shoes ?? 0x2b2f3a);
  const footR = sneaker(palette.shoes ?? 0x2b2f3a);
  footL.position.y = -SHIN;
  footR.position.y = -SHIN;
  shinL.add(footL);
  shinR.add(footR);

  const r: Rig = { body, hips, torso, head, armL, armR, foreL, foreR,
                   legL, legR, shinL, shinR, footL, footR };
  root.userData.rig = r;
  return root;
}

/** Reset every joint; each pose function starts from a known state. */
function rest(r: Rig): void {
  for (const k of ['armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'] as const) {
    r[k].rotation.set(0, 0, 0);
  }
  r.hips.rotation.set(0, 0, 0);
  r.hips.position.set(0, HIP, 0);
  r.torso.rotation.set(0, 0, 0);
  r.head.rotation.set(0, 0, 0);
}

/**
 * How far below the hip joint a leg reaches with these joint angles: the
 * lower of heel and toe. Rotations are about X, positive swinging back.
 */
function reach(thigh: number, knee: number, ankle: number): number {
  const ay = -THIGH * Math.cos(thigh) - SHIN * Math.cos(thigh + knee);
  const f = thigh + knee + ankle;
  const c = Math.cos(f), s = Math.sin(f);
  return -Math.min(ay - SOLE * c - HEEL * s, ay - SOLE * c - TOE * s);
}

/** Stand the hips on whichever foot is lower, so the feet meet the ground. */
function plant(r: Rig, lift = 0): void {
  const down = Math.max(reach(r.legL.rotation.x, r.shinL.rotation.x, r.footL.rotation.x),
                        reach(r.legR.rotation.x, r.shinR.rotation.x, r.footR.rotation.x));
  r.hips.position.y = down - LEG_Y + lift;
}

export function poseIdle(root: THREE.Object3D, t: number): void {
  const r = rig(root);
  rest(r);
  const breathe = Math.sin(t * 1.6);
  r.torso.rotation.x = 0.02 + breathe * 0.012;
  r.armL.rotation.x = 0.04 - breathe * 0.01;
  r.armR.rotation.x = 0.04 - breathe * 0.01;
  r.armL.rotation.z = -0.1;
  r.armR.rotation.z = 0.1;
  r.foreL.rotation.x = -0.18;
  r.foreR.rotation.x = -0.18;
  // weight a little on one leg
  r.hips.rotation.z = 0.03;
  r.legL.rotation.z = -0.03;
  r.legR.rotation.z = -0.03;
  r.legR.rotation.x = -0.04;
  r.shinR.rotation.x = 0.08;
  r.footR.rotation.x = -0.04;
  r.head.rotation.y = Math.sin(t * 0.4) * 0.22;
  r.head.rotation.x = Math.sin(t * 0.27) * 0.04;
  plant(r);
}

/** Seated, hands forward on a wheel. */
export function poseDrive(root: THREE.Object3D): void {
  const r = rig(root);
  rest(r);
  r.hips.position.y = 0.62;
  r.legL.rotation.x = -1.45;
  r.legR.rotation.x = -1.45;
  r.shinL.rotation.x = 1.35;
  r.shinR.rotation.x = 1.35;
  r.footL.rotation.x = 0.1;
  r.footR.rotation.x = 0.1;
  r.torso.rotation.x = -0.1;
  r.armL.rotation.x = -1.05;
  r.armR.rotation.x = -1.05;
  r.armL.rotation.z = 0.22;
  r.armR.rotation.z = -0.22;
  r.foreL.rotation.x = -0.45;
  r.foreR.rotation.x = -0.45;
}
