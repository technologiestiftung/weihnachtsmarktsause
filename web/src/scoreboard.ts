import { MODE_INFO, modeText } from './games';
import { onLang, t } from './i18n';
import { fetchBoard, playerName, type Board } from './ranking';

/**
 * The high scores, in a box over the start screen: the course on the shared
 * board. The nickname is given after a game (menu.ts). It tells neither how
 * many play nor when anyone played.
 */

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class Scoreboard {
  private readonly root = document.getElementById('board')!;
  private mode = MODE_INFO[0].id;
  private body = h('div', 'tabbody');
  /** Counts the tabs drawn, so a board that arrives late can tell it is stale. */
  private drawn = 0;
  open = false;

  constructor() {
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    addEventListener('keydown', (e) => {
      if (this.open && e.code === 'Escape') this.close();
    });
    onLang(() => { if (this.open) this.render(); });
  }

  /** Open, on a game's board if given. */
  show(mode?: string): void {
    if (mode && MODE_INFO.some((m) => m.id === mode)) this.mode = mode;
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
    const title = h('h3', '', t('scores.title'));
    title.id = 'boardTitle';
    box.setAttribute('aria-labelledby', title.id);

    this.body = h('div', 'tabbody');
    box.append(x, title, this.body, h('p', 'src', t('board.privacy')));
    this.root.replaceChildren(box);
    this.drawTab();
  }

  /** The course on the board. */
  private drawTab(): void {
    const mode = this.mode;
    const drawn = ++this.drawn;
    const list = h('div', 'list');
    list.append(h('p', 'dim', t('board.loading')));
    this.body.replaceChildren(h('p', 'sub', t('board.course')), list);

    fetchBoard(mode).then(
      (b) => { if (drawn === this.drawn) list.replaceChildren(...this.boardRows(mode, b)); },
      () => { if (drawn === this.drawn) list.replaceChildren(h('p', 'dim', t('board.offline'))); });
  }

  /** Each player's best: targets in the mode's own words. */
  private boardRows(mode: string, b: Board): HTMLElement[] {
    const note = b.local ? [h('p', 'dim', t('board.localNote'))] : [];
    if (!b.top.length) return [h('p', 'dim', t('board.empty')), ...note];
    const me = playerName()?.toLowerCase();
    const table = h('table', 'scores');
    const row = (e: Board['top'][number]) => {
      const tr = h('tr', e.name && e.name.toLowerCase() === me ? 'me' : '');
      tr.append(h('td', 'n', `${e.rank}.`), h('td', 'who', e.name || t('board.noName')),
                h('td', 'n', modeText(mode, 'unit', { n: e.count })));
      return tr;
    };
    table.append(...b.top.map(row));
    if (b.me && !b.top.some((e) => e.rank === b.me!.rank && e.name === b.me!.name)) {
      const gap = h('tr', 'gap');
      gap.append(h('td', '', '…'));
      table.append(gap, row(b.me));
    }
    if (b.local) return [table, ...note];
    return [table];
  }
}
