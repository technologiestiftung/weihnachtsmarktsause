/**
 * Touch controls for phones and tablets: a drag anywhere steers and climbs,
 * as the mouse does, and a few buttons press their keys - so the sleigh
 * flies the same either way.
 *
 * Shown when the primary pointer is coarse, i.e. a finger. A laptop with a
 * touch screen keeps its keyboard and mouse UI.
 */

export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

/** Radians per pixel of drag; a thumb travels less than a mouse. */
const LOOK = 2.4;

interface TouchButton {
  label: string;
  code: string;
}

export class TouchControls {
  private readonly root = document.getElementById('touch')!;

  /** look(dx, dy) turns the view by pixel deltas, the way the mouse does;
   *  buttons are pressed as key codes. */
  constructor(private readonly look: (dx: number, dy: number) => void, buttons: TouchButton[]) {
    document.body.classList.add('touch');
    this.lookArea();
    const bar = document.getElementById('touchButtons')!;
    for (const b of buttons) {
      const el = document.createElement('button');
      el.textContent = b.label;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const code = b.code;
        this.key('keydown', code);
        // a press long enough for the frame loop to see it
        const up = () => { this.key('keyup', code); el.removeEventListener('pointerup', up); };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('pointerleave', up);
      });
      bar.append(el);
    }
  }

  private key(type: 'keydown' | 'keyup', code: string): void {
    dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  }

  private lookArea(): void {
    const area = document.getElementById('touchLook')!;
    const last = new Map<number, [number, number]>();
    area.addEventListener('pointerdown', (e) => {
      area.setPointerCapture(e.pointerId);
      last.set(e.pointerId, [e.clientX, e.clientY]);
    });
    area.addEventListener('pointermove', (e) => {
      const p = last.get(e.pointerId);
      if (!p) return;
      this.look((e.clientX - p[0]) * LOOK, (e.clientY - p[1]) * LOOK);
      last.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const end = (e: PointerEvent) => last.delete(e.pointerId);
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  }

  set visible(on: boolean) {
    this.root.style.display = on ? '' : 'none';
  }
}
