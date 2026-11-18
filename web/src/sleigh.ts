import * as THREE from 'three';
import { makeHuman, poseDrive } from './character';

/**
 * Santa's sleigh for the Christmas market run: a sledge on curled runners,
 * Santa (the usual jointed figure in red, with a beard and a hat) and two
 * pairs of reindeer in front, the leader with a red nose. Primitives only,
 * like the other characters, and modelled facing +Z.
 *
 * Standard materials, like the city's, so the sky's light reaches them, and
 * each glows a little in its own colour: the run is played at night, when
 * sun and sky are all but out, and an unlit sleigh would be a black shape.
 */

const GLOW = 0.22;

function mat(color: number, glow = GLOW, roughness = 0.6, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: color, emissiveIntensity: glow });
}

/** The same glow for a figure built with the shared character materials. */
function lightUp(root: THREE.Object3D): void {
  const done = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    const src = m.material as THREE.MeshStandardMaterial | undefined;
    if (!m.isMesh || !src?.isMeshStandardMaterial) return;
    let lit = done.get(src);
    if (!lit) {
      const c = src.clone();
      c.emissive.copy(src.color);
      c.emissiveIntensity = GLOW;
      done.set(src, lit = c);
    }
    m.material = lit;
  });
}

/** A thin bar from a to b, for reins. */
function bar(a: THREE.Vector3, b: THREE.Vector3, w: number, m: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const mesh = box(w, w, len, m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.lookAt(b);
  return mesh;
}

function box(w: number, h: number, d: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}

function reindeer(nose: boolean): THREE.Group {
  const fur = mat(0x8a5a32, 0.18, 0.9);
  const pale = mat(0xe6d2ae, 0.2, 0.9);
  const g = new THREE.Group();
  const body = box(0.5, 0.55, 1.25, fur);
  body.position.y = 1.05;
  g.add(body);
  const neck = box(0.26, 0.6, 0.28, fur);
  neck.position.set(0, 1.45, 0.62);
  neck.rotation.x = 0.5;
  g.add(neck);
  const head = box(0.28, 0.28, 0.5, fur);
  head.position.set(0, 1.78, 0.86);
  g.add(head);
  const snout = box(0.2, 0.18, 0.18, pale);
  snout.position.set(0, 1.72, 1.15);
  g.add(snout);
  if (nose) {
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0xff2020, 1.6));
    red.position.set(0, 1.74, 1.26);
    g.add(red);
  }
  const antlerMat = mat(0xf0e4c8, 0.25, 0.8);
  // a red harness with a gold bell
  const strap = box(0.54, 0.12, 0.14, mat(0xc8102e, 0.3));
  strap.position.set(0, 1.18, 0.5);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0xf2c14e, 0.45, 0.3, 0.7));
  bell.position.set(0, 1.0, 0.62);
  g.add(strap, bell);
  for (const s of [-1, 1]) {
    const a = box(0.05, 0.42, 0.05, antlerMat);
    a.position.set(0.12 * s, 2.05, 0.8);
    a.rotation.z = -0.4 * s;
    const b = box(0.05, 0.22, 0.05, antlerMat);
    b.position.set(0.24 * s, 2.15, 0.9);
    b.rotation.x = 0.7;
    g.add(a, b);
  }
  const tail = box(0.14, 0.14, 0.1, pale);
  tail.position.set(0, 1.2, -0.66);
  g.add(tail);
  // legs pivot at the hip so they can gallop
  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [[-0.18, 0.48], [0.18, 0.48], [-0.18, -0.48], [0.18, -0.48]]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.85, lz);
    const leg = box(0.11, 0.8, 0.11, fur);
    leg.position.y = -0.4;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }
  g.userData.legs = legs;
  return g;
}

export function makeSleigh(single = false): THREE.Group {
  const root = new THREE.Group();
  const red = mat(0xd4142a, 0.28, 0.45);
  const green = mat(0x1f8a4c, 0.25, 0.5);
  const gold = mat(0xf2c14e, 0.35, 0.3, 0.7);
  const wood = mat(0x7a4a26, 0.15, 0.8);

  // the sledge: a red tub with a high back, green panels and gold trim
  const tub = box(1.5, 0.7, 2.4, red);
  tub.position.y = 0.95;
  const back = box(1.5, 0.9, 0.25, red);
  back.position.set(0, 1.5, -1.1);
  const trim = box(1.56, 0.08, 2.46, gold);
  trim.position.y = 1.32;
  const backTrim = box(1.56, 0.08, 0.3, gold);
  backTrim.position.set(0, 1.97, -1.1);
  root.add(tub, back, trim, backTrim);
  for (const s of [-1, 1]) {
    const panel = box(0.02, 0.36, 1.9, green);
    panel.position.set(0.76 * s, 0.98, 0);
    const swirl = box(0.025, 0.06, 1.6, gold);
    swirl.position.set(0.765 * s, 0.98, 0);
    root.add(panel, swirl);
  }
  // a garland of lights round the rim, in four colours
  const bulbs = [0xff4d4d, 0xffd23f, 0x4fd16b, 0x4fa8ff].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const bulb = new THREE.SphereGeometry(0.045, 6, 5);
  let k = 0;
  for (const s of [-1, 1]) {
    for (let z = -1.1; z <= 1.1; z += 0.275) {
      const b = new THREE.Mesh(bulb, bulbs[k++ % 4]);
      b.position.set(0.79 * s, 1.27, z);
      root.add(b);
    }
  }

  // the driver's bench at the front, with a green cushion and a backrest
  const bench = box(1.3, 0.12, 0.55, wood);
  bench.position.set(0, 1.3, 0.3);
  const cushion = box(1.2, 0.08, 0.5, green);
  cushion.position.set(0, 1.39, 0.3);
  const rest = box(1.3, 0.45, 0.1, red);
  rest.position.set(0, 1.6, 0.0);
  const restTrim = box(1.34, 0.06, 0.13, gold);
  restTrim.position.set(0, 1.84, 0.0);
  root.add(bench, cushion, rest, restTrim);

  // a sack of presents in the back, and presents round it
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mat(0x9b6b3d, 0.18, 0.9));
  // low and to one side, so Santa shows over it from the chase camera
  sack.scale.set(0.8, 0.8, 0.75);
  sack.position.set(0.38, 1.5, -0.72);
  root.add(sack);
  const ribbon = mat(0xffd23f, 0.4);
  for (const [px, pz, size, c] of [[-0.42, -0.7, 0.38, 0x2f9f5e], [-0.38, -0.25, 0.32, 0x3a7bff],
                                     [0.45, -0.15, 0.28, 0xb04ad8], [0.1, -0.95, 0.3, 0xff7a2f]] as const) {
    const p = new THREE.Group();
    p.add(box(size, size, size, mat(c, 0.3, 0.5)));
    p.add(box(size + 0.01, size + 0.01, 0.06, ribbon), box(0.06, size + 0.01, size + 0.01, ribbon));
    p.position.set(px, 1.3 + size / 2, pz);
    p.rotation.y = 0.4 + px;
    root.add(p);
  }
  // runners, curled up at the front
  for (const s of [-1, 1]) {
    const run = box(0.08, 0.08, 3.0, gold);
    run.position.set(0.62 * s, 0.32, 0.1);
    const curl = box(0.08, 0.6, 0.08, gold);
    curl.position.set(0.62 * s, 0.58, 1.6);
    curl.rotation.x = -0.5;
    root.add(run, curl);
    for (const z of [-0.8, 0.8]) {
      const strut = box(0.06, 0.45, 0.06, gold);
      strut.position.set(0.62 * s, 0.55, z);
      root.add(strut);
    }
  }

  // Santa in the driver's seat, reins in hand
  const santa = makeHuman({ top: 0xd4142a, legs: 0xd4142a, hair: 0xf2f2f2, shoes: 0x1d1f26,
                           pack: null, hood: false });
  poseDrive(santa);
  santa.position.set(0, 0.8, 0.3);
  const head = (santa.userData.rig as { head: THREE.Group }).head;
  const white = mat(0xffffff, 0.35, 0.9);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), white);
  beard.scale.set(1, 1.2, 0.7);
  beard.position.set(0, 0.05, 0.1);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 12), red);
  hat.position.set(0, 0.42, -0.03);
  hat.rotation.x = -0.35;
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 14), white);
  brim.position.set(0, 0.26, 0);
  brim.rotation.x = Math.PI / 2;
  const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), white);
  bobble.position.set(0, 0.58, -0.1);
  head.add(beard, hat, brim, bobble);
  lightUp(santa);
  root.add(santa);
  const rein = mat(0x5a3418, 0.2, 0.9);
  const side = single ? 0.15 : 0.55;
  for (const s of [-1, 1]) {
    root.add(bar(new THREE.Vector3(0.18 * s, 1.75, 0.95), new THREE.Vector3(side * s, 1.75, 2.9), 0.03, rein));
  }

  // two pairs of reindeer on a harness pole, the leader with Rudolph's nose
  const team: THREE.Group[] = [];
  for (const [i, z] of [3.3, 5.3].entries()) {
    for (const s of single ? [0] : [-1, 1]) {
      const r = reindeer(i === 1 && s !== -1);
      r.position.set(0.55 * s, 0, z);
      root.add(r);
      team.push(r);
    }
  }
  const pole = box(0.06, 0.06, 4.6, gold);
  pole.position.set(0, 1.0, 3.4);
  root.add(pole);
  // a lantern on the front so the sleigh reads at night - glowing, not a
  // light: a new light would recompile every material in the city
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
                              new THREE.MeshBasicMaterial({ color: 0xffd28a }));
  lamp.position.set(0, 2.1, 1.25);
  const post = box(0.05, 0.75, 0.05, gold);
  post.position.set(0, 1.75, 1.25);
  root.add(lamp, post);
  root.userData.team = team;
  return root;
}

/** Gallop the reindeer; t in seconds. */
export function poseSleigh(sleigh: THREE.Object3D, t: number): void {
  const team = sleigh.userData.team as THREE.Group[];
  team.forEach((r, i) => {
    const ph = t * 9 + i * 0.7;
    const legs = r.userData.legs as THREE.Group[];
    legs[0].rotation.x = Math.sin(ph) * 0.7;
    legs[1].rotation.x = Math.sin(ph + 0.4) * 0.7;
    legs[2].rotation.x = Math.sin(ph + Math.PI) * 0.7;
    legs[3].rotation.x = Math.sin(ph + Math.PI + 0.4) * 0.7;
    r.position.y = Math.abs(Math.sin(ph)) * 0.25;
  });
}
