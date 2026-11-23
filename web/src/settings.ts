import { MODE_INFO, modeText } from './games';
import { onLang, t } from './i18n';
import { isTouchDevice } from './touch';

/**
 * The controls, in a box over the start menu or the pause screen. Language
 * and music have their own buttons in the top right corner (menu.ts).
 */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class Settings {
  private readonly root = document.getElementById('settings')!;
  open = false;

  constructor() {
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    // first, and the only one to hear keys while open: Esc closes the box
    // and must not also resume a paused game behind it
    addEventListener('keydown', (e) => {
      if (!this.open) return;
      e.stopPropagation();
      if (e.code === 'Escape') this.close();
    }, true);
    onLang(() => { if (this.open) this.render(); });
  }

  show(): void {
    this.open = true;
    this.root.classList.add('on');
    this.render();
    (this.root.querySelector('.x') as HTMLElement | null)?.focus();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('on');
    this.root.replaceChildren();
  }

  private render(): void {
    const box = h('div', 'box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const x = h('button', 'x', '✕');
    x.setAttribute('aria-label', t('board.close'));
    x.addEventListener('click', () => this.close());
    const title = h('h3', '', t('settings.controls'));
    title.id = 'settingsTitle';
    box.setAttribute('aria-labelledby', title.id);
    const body = h('div', 'tabbody');
    body.append(...this.controls());
    box.append(x, title, body);
    this.root.replaceChildren(box);
  }

  /** What the game is about, its keys (or thumbs) and how to score. */
  private controls(): HTMLElement[] {
    const id = MODE_INFO[0].id;
    const keys = h('div', 'keys');
    keys.append(...controls(id, isTouchDevice()));
    // all the text first, then the keys
    const text = h('p', '');
    text.textContent = `${modeText(id, 'blurb')} ${t('menu.note')}`;
    return [text, keys];
  }
}

const MOUSE = `<svg class="mouse" viewBox="0 0 16 24" aria-label="🖱" role="img">
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

/** One key cap, or the mouse drawn as a mouse. */
function key(word: string): Element {
  if (word === 'mouse') {
    const t = document.createElement('template');
    t.innerHTML = MOUSE;
    return t.content.firstElementChild!;
  }
  const kbd = document.createElement('kbd');
  kbd.textContent = word;
  return kbd;
}
