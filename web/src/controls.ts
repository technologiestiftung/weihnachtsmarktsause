import { t } from './i18n';

/**
 * How to fly, as rows of keys (or gestures) and what they do, with the
 * icons that stand in for emojis: the countdown shows the first row
 * (games.ts), and the touch buttons use the pause and camera icons.
 */

/** Drawn icons in place of emojis: the mouse, a fingertip on glass, pause,
 *  and the camera of the touch button. */
const MOUSE = `<svg class="mouse" viewBox="0 0 16 24" aria-hidden="true">
  <rect x="1" y="1" width="14" height="22" rx="7" fill="rgba(255,255,255,.1)" stroke="currentColor" stroke-width="1.5"/>
  <path d="M8 1v8M1.4 9h13.2" stroke="currentColor" stroke-width="1.2" opacity=".55"/>
  <rect x="7" y="4" width="2" height="3.4" rx="1" fill="currentColor"/>
</svg>`;

/**
 * The controls as rows of keys and what they do: the mode's own, then the
 * ones every game shares; the key `mouse` is drawn as one. A row without
 * keys is a tip on how to play. On a phone, what the thumbs do instead,
 * with the mode's tips.
 */
export function controls(id: string, touch: boolean): HTMLElement[] {
  const parse = (key: string) => t(key).split('|').map((r) => r.split('=') as [string, string]);
  const own = parse(`load.keys.${id}`);
  const rows = touch
    ? [...parse(`load.touch.${id}`), ...own.filter(([k]) => !k)]
    : [...own.filter(([k]) => k), ...parse('load.keys.common'), ...own.filter(([k]) => !k)];
  return rows.flatMap(([keys, what]) => {
    if (!keys) {
      const tip = document.createElement('span');
      tip.className = 'tip';
      tip.textContent = what;
      return [tip];
    }
    // a key per word on a keyboard; a gesture or button stays whole
    const words = touch ? [keys] : keys.split(' ');
    const meanings = what.split(', ');
    // as many keys as meanings: each key with its own - 1 on foot, 2 bike,
    // 3 scooter reads better than 1 2 3 and a list. The number keys side by
    // side in one row, others a row each.
    if (words.length > 1 && meanings.length === words.length) {
      if (words.every((w) => /^\d$/.test(w))) {
        const row = document.createElement('span');
        row.className = 'pairs';
        words.forEach((w, i) => {
          const pair = document.createElement('span');
          pair.append(key(w), meanings[i]);
          row.append(pair);
        });
        return [row];
      }
      return words.flatMap((w, i) => cells([w], meanings[i]));
    }
    return cells(words, what);
  });
}

/** A row of the table: the keys, then what they do. */
function cells(words: string[], what: string): HTMLElement[] {
  const k = document.createElement('span');
  k.className = 'k';
  k.append(...words.map(key));
  const label = document.createElement('span');
  label.textContent = what;
  return [k, label];
}

export const FINGER = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
  <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8" opacity=".5"/>
</svg>`;
export const PAUSE = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
  <rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>
</svg>`;
export const CAMERA = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
  <rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.5"/>
</svg>`;
const ICONS: Record<string, string> = { mouse: MOUSE, finger: FINGER, pause: PAUSE };

/** One key cap, or a mouse, finger or pause drawn as one. */
function key(word: string): Element {
  if (ICONS[word]) {
    const t = document.createElement('template');
    t.innerHTML = ICONS[word];
    return t.content.firstElementChild!;
  }
  const kbd = document.createElement('kbd');
  kbd.textContent = word;
  return kbd;
}
