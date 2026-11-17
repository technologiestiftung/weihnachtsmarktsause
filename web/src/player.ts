import * as THREE from 'three';
import { WALK_INSET, type World } from './world';

// R / F tilt the view, so the mouse is optional entirely
const PITCH_RATE = 1.4;
const PITCH_MIN = -1.3;
const PITCH_MAX = 1.15;
/** Eye height standing, for the cameras outside the sleigh. */
const EYE = 1.72;

// the sleigh, metres per second and metres above the ground
const SLEIGH_CRUISE = 40;
const SLEIGH_BOOST = 110;
const SLEIGH_FLOOR = 6;
const SLEIGH_CEILING = 450;

export class Player {
  readonly world: World;
  readonly pos = new THREE.Vector3();
  yaw = 0;
  pitch = -0.16;
  heading = 0;
  camMode = 0;
  private boomDistance: number | null = null;
  lean = 0;
  /** The game's pace: scales the sleigh's speeds. */
  speedScale = 1;
  /** Santa's sleigh: always airborne, always moving forward. Off, the
   *  player stands where the game left them, behind the menu. */
  sleigh = false;
  sleighSpeed = 0;

  constructor(world: World) {
    this.world = world;
  }

  spawn(x: number, z: number): void {
    const w = this.world;
    const [fx, fz] = w.freeSpot(x, z, 200);
    this.pos.set(fx, w.height(fx, fz), fz);
  }

  /** Q and E turn left and right. */
  private turnInput(keys: Set<string>): number {
    return (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);
  }

  /** R and F tilt the view up and down, clamped to the mouse look's limits. */
  private pitchInput(keys: Set<string>, dt: number): void {
    const d = (keys.has('KeyR') ? 1 : 0) - (keys.has('KeyF') ? 1 : 0);
    if (!d) return;
    this.pitch = Math.max(PITCH_MIN,
      Math.min(PITCH_MAX, this.pitch + d * PITCH_RATE * dt));
  }

  /** Only called while a game is under way, which is to say in the sleigh. */
  update(dt: number, keys: Set<string>): void {
    this.pitchInput(keys, dt);
    this.updateSleigh(dt, keys);
  }

  /**
   * The sleigh flies like a plane: always at full boost, S holds it back,
   * A/D (or Q/E, or the mouse) bank it round and the view's pitch is its
   * climb. It skims over the ground rather than landing.
   */
  private updateSleigh(dt: number, keys: Set<string>): void {
    const want = (keys.has('KeyS') ? SLEIGH_CRUISE : SLEIGH_BOOST) * this.speedScale;
    this.sleighSpeed += (want - this.sleighSpeed) * Math.min(1, dt * 1.6);
    const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0) + this.turnInput(keys);
    this.yaw += Math.max(-1, Math.min(1, steer)) * 1.25 * dt;
    this.lean += (-steer * 0.45 - this.lean) * Math.min(1, dt * 4);
    if (keys.has('Space')) this.pitch = Math.min(0.7, this.pitch + 0.9 * dt);
    if (keys.has('ControlLeft')) this.pitch = Math.max(-0.7, this.pitch - 0.9 * dt);
    this.pitch = Math.max(-0.7, Math.min(0.7, this.pitch));
    const cp = Math.cos(this.pitch);
    const v = this.sleighSpeed * dt;
    this.pos.x += -Math.sin(this.yaw) * cp * v;
    this.pos.z += -Math.cos(this.yaw) * cp * v;
    this.pos.y += Math.sin(this.pitch) * v;
    const g = this.world.height(this.pos.x, this.pos.z);
    if (this.pos.y < g + SLEIGH_FLOOR) {
      // skim off the ground and nose up a little
      this.pos.y = g + SLEIGH_FLOOR;
      if (this.pitch < 0.05) this.pitch += (0.05 - this.pitch) * Math.min(1, dt * 3);
    }
    this.pos.y = Math.min(this.pos.y, g + SLEIGH_CEILING);
    this.heading = this.yaw;
  }

  /** Board the sleigh at a safe height, or step off it. */
  setSleigh(on: boolean): void {
    this.sleigh = on;
    if (on) {
      this.sleighSpeed = SLEIGH_CRUISE;
      this.pitch = 0.05;
      this.pos.y = Math.max(this.pos.y, this.world.height(this.pos.x, this.pos.z) + 60);
    } else {
      this.sleighSpeed = 0;
      this.lean = 0;
      this.settle(200);
    }
  }

  /**
   * Come to rest on whatever is below: a bridge deck where you are over one,
   * otherwise the nearest ground within maxR metres that leads out of the
   * block, not into a walled-in courtyard.
   */
  private settle(maxR: number): void {
    const w = this.world;
    const y = w.height(this.pos.x, this.pos.z, this.pos.y);
    if (w.deckAt(this.pos.x, this.pos.z, y, WALK_INSET)) {
      this.pos.y = y;
      return;
    }
    const [x, z] = w.freeSpot(this.pos.x, this.pos.z, maxR);
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = w.height(this.pos.x, this.pos.z);
  }

  applyCamera(cam: THREE.PerspectiveCamera, dt = 1 / 60): THREE.Vector3 {
    if (this.sleigh) {
      this.boomDistance = null;
      // a chase camera behind and above the reindeer
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      const at = new THREE.Vector3(this.pos.x - s * 6, this.pos.y + 2, this.pos.z - c * 6);
      const back = this.camMode === 1 ? 11 : 17;
      cam.position.set(this.pos.x + s * back, this.pos.y + 5.5 - Math.sin(this.pitch) * back,
                       this.pos.z + c * back);
      cam.lookAt(at);
      return at;
    }
    const head = new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);

    if (this.camMode === 2) {
      this.boomDistance = null;
      cam.position.copy(head);
      cam.rotation.set(0, 0, 0);
      cam.rotateY(this.yaw);
      cam.rotateX(this.pitch);
      return head;
    }
    // A true orbit: the camera sits on a sphere of fixed radius around the
    // player, and pitch only moves it along that sphere. The previous version
    // added a constant `lift` on top of a spherical offset, which is not a
    // sphere at all - the distance to the player swung by 137% between looking
    // up and looking down, so tilting felt like zooming. There is no separate
    // lift now; the camera sitting above the shoulder simply falls out of the
    // slightly downward resting pitch.
    const w = this.world;
    const radius = this.camMode === 0 ? 6.4 : 3.4;
    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * cp,
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * cp,
    );

    // Sweep the whole boom: testing only its endpoint lets it pass through
    // an elevated deck and emerge above it while the player stays below.
    let r = radius;
    const probe = new THREE.Vector3();
    for (let distance = 0.4; distance <= radius + 0.35; distance += 0.35) {
      const d = Math.min(distance, radius);
      probe.copy(head).addScaledVector(dir, d);
      if (w.blocksCamera(probe.x, probe.y, probe.z)) {
        r = Math.max(0.35, d - 0.3);
        break;
      }
      if (d === radius) break;
    }
    // Pull in immediately for clearance; ease back out after leaving a span.
    const previous = this.boomDistance ?? r;
    r = r <= previous ? r : previous + (r - previous) * (1 - Math.exp(-12 * dt));
    this.boomDistance = r;

    // Orientation is never set directly - it is always derived from lookAt, the
    // same way a real spring-arm camera works. Whatever the collision loop did
    // to the radius, the camera still ends up pointed exactly at the player;
    // position and orientation can never disagree, which is what setting
    // rotation from raw pitch independently of position broke last time.
    cam.position.copy(head).addScaledVector(dir, r);
    cam.lookAt(head);
    return head;
  }
}
