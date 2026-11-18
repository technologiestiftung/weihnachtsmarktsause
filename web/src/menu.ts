import { MEDALS, MODE_INFO, dailySeed, modeText, type Result } from './games';
import { lang, num, onLang, t } from './i18n';
import { playerName, setPlayerName, standing, type Board } from './ranking';
import { Scoreboard } from './scoreboard';
import { bestScore, type Run } from './scores';
import type { Settings } from './settings';
import { art } from './loadingart';

/**
 * The start menu, on black with a lit tree in falling snow: start, high scores and settings, with a
 * game's result or a challenge above them.
 *
 * A game is played on a course - a seed that picks a fair start - so that
 * scores mean something: start plays today's course, the same for
 * everyone today. That is the only choice offered - one course a day is
 * easy to understand and to compare. A course also travels as a link,
 * #play=<mode>:<seed>, to challenge someone on it.
 */

export type Choice = { id: string; seed: number | null };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function courseLink(id: string, seed: number): string {
  return `${location.origin}${location.pathname}#play=${id}:${seed}`;
}

/** A course from the URL, if the page was opened with one. */
function linkedCourse(): { id: string; seed: number } | null {
  const m = /play=([a-z]+):(\d+)/.exec(location.hash);
  if (!m || !MODE_INFO.some((i) => i.id === m[1])) return null;
  return { id: m[1], seed: Number(m[2]) };
}

export class Menu {
  private readonly boot = document.getElementById('boot')!;
  private readonly result = document.getElementById('result')!;
  private readonly credits = document.getElementById('menuCredits')!;
  private readonly finder = document.getElementById('finderBtn') as HTMLAnchorElement;
  private readonly scoreboard = new Scoreboard();
  /** The game last played, whose tab the high scores open on. */
  private lastMode: string | undefined;
  /** Where the last run stands on the shared board, once known. */
  private standing: Promise<Board> | null = null;
  open = true;

  constructor(private readonly onPick: (c: Choice) => void, private readonly settings: Settings) {
    onLang(() => { this.render(); this.redraw?.(); });
    // there is one game: start plays it on today's course
    document.getElementById('playBtn')!.addEventListener('click',
      () => this.pick({ id: MODE_INFO[0].id, seed: dailySeed() }));
    // high scores and settings open in a box over the menu
    document.getElementById('scoresBtn')!.addEventListener('click', () => this.scoreboard.show(this.lastMode));
    document.getElementById('settingsBtn')!.addEventListener('click', () => this.settings.show());
  }

  /** Clears the panel above the buttons. */
  private closePanel(): void {
    this.result.classList.remove('on');
    this.redraw = null;
  }

  /** Redraws the panel above the buttons in a new language, if it can. */
  private redraw: (() => void) | null = null;

  /** The world has loaded: show the choices. */
  ready(): void {
    this.boot.classList.add('ready');
    const linked = linkedCourse();
    if (linked) this.challenge(linked.id, linked.seed);
    this.render();
    document.getElementById('playBtn')!.focus({ preventScroll: true });
  }

  show(): void {
    this.open = true;
    this.boot.style.display = '';
    if (document.pointerLockElement) document.exitPointerLock();
    art.show('tree', this.boot, document.getElementById('bootArt'));
    this.render();
  }

  hide(): void {
    this.open = false;
    this.boot.style.display = 'none';
    this.closePanel();
    this.scoreboard.close();
    this.settings.close();
    art.hide(this.boot);
  }

  private pick(c: Choice): void {
    this.hide();
    this.onPick(c);
  }

  /** A shared course: offer it at the top. */
  private challenge(id: string, seed: number): void {
    const info = MODE_INFO.find((i) => i.id === id)!;
    this.result.replaceChildren(
      h('h3', '', t('menu.challenge', { emoji: info.emoji, title: modeText(id, 'title') })),
      h('p', '', t('menu.challengeText', { seed })),
      this.buttons([[t('menu.start'), () => this.pick({ id, seed })]]),
    );
    this.result.classList.add('on');
    this.redraw = () => this.challenge(id, seed);
  }

  /** After a game: the score, its place on the shared board, and what next. */
  showResult(id: string, seed: number | null, r: Result, newBest: boolean, run: Run): void {
    this.lastMode = id;
    this.standing = seed !== null && playerName() ? standing(run) : null;
    this.drawResult(id, seed, r, newBest, run);
    this.show();
  }

  private drawResult(id: string, seed: number | null, r: Result, newBest: boolean, run: Run): void {
    const info = MODE_INFO.find((i) => i.id === id)!;
    const best = seed === null ? null : bestScore(id, seed);
    const shown = num(best ?? 0, 0);
    const course = seed === null ? t('menu.unranked')
      : seed === dailySeed() ? t('menu.today', { best: shown }) : t('menu.course', { seed, best: shown });
    // the result's own lines were written in the language it ended in
    const kids: HTMLElement[] = [
      h('h3', '', `${r.medal ? MEDALS[r.medal - 1] : info.emoji} ${r.title}`),
      h('div', 'big', t('game.points', { n: num(r.score, 0) })),
      h('p', '', newBest ? t('menu.newBest', { course }) : course),
    ];
    // close enough to taste it: say how close
    if (!newBest && best !== null && best > r.score && r.score >= best * 0.7) {
      kids.push(h('p', 'short', t('menu.short', { n: num(best - r.score, 0) })));
    }
    if (seed !== null) kids.push(this.rankLine(id, seed, r, newBest, run));
    kids.push(
      ...r.lines.slice(0, -1).map((l) => h('p', '', l)),
      h('p', '', [t('menu.stats', { c: r.combo }), r.golds ? t('menu.golds', { g: r.golds }) : '']
        .filter(Boolean).join(' · ')),
      h('p', 'src', t('menu.data', { src: r.lines[r.lines.length - 1] })),
    );
    const btns: [string, () => void, boolean?][] = [
      [t('menu.again'), () => this.pick({ id, seed })],
    ];
    if (seed !== null) {
      btns.push([t('menu.share'), () => {
        const url = courseLink(id, seed);
        void navigator.clipboard?.writeText(url).then(
          () => { share.textContent = t('menu.copied'); },
          () => { share.textContent = url; });
      }, true]);
    }
    const row = this.buttons(btns);
    const share = row.lastElementChild as HTMLButtonElement;
    kids.push(row);
    this.result.replaceChildren(...kids);
    this.result.classList.add('on');
    this.redraw = () => this.drawResult(id, seed, r, newBest, run);
  }

  /** The run's place among everyone on the course; without a name, a field to join. */
  private rankLine(id: string, seed: number, r: Result, newBest: boolean, run: Run): HTMLElement {
    if (this.standing) {
      const p = h('p', 'rank', '…');
      this.standing.then(
        (b) => {
          p.textContent = b.me ? t(b.local ? 'board.localRank' : 'board.rank', { rank: b.me.rank, n: b.players }) : '';
        },
        (e) => { p.textContent = t((e as Error).message === '409' ? 'board.taken' : 'board.offline'); p.className = 'src'; });
      return p;
    }
    const form = h('form', 'join');
    const input = h('input', '');
    input.type = 'text';
    input.maxLength = 20;
    input.setAttribute('autocomplete', 'nickname');
    input.spellcheck = false;
    input.placeholder = t('board.namePh');
    const go = h('button', '', t('board.joinBtn'));
    const msg = h('p', 'src');
    const row = h('div', 'row');
    row.append(input, go);
    form.append(h('p', '', t('board.join')), row, msg);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      go.disabled = true;
      msg.textContent = '…';
      const res = await setPlayerName(input.value);
      go.disabled = false;
      if (res !== 'ok' && res !== 'local') {
        msg.textContent = t(`board.${res}`);
        return;
      }
      this.standing = standing(run);
      this.drawResult(id, seed, r, newBest, run);
    });
    return form;
  }

  /** A line over the buttons: a game left before the end, or one that would not start. */
  showNote(text: () => string): void {
    this.result.replaceChildren(h('p', '', text()));
    this.result.classList.add('on');
    this.show();
    this.redraw = () => this.showNote(text);
  }

  private buttons(list: [string, () => void, boolean?][]): HTMLElement {
    const row = h('div', 'rb');
    for (const [label, fn, alt] of list) {
      const b = h('button', alt ? 'alt' : '', label);
      b.addEventListener('click', fn);
      row.append(b);
    }
    return row;
  }

  /** The data credits, the markets first, and the finder in this language. */
  private render(): void {
    this.credits.innerHTML = t('menu.sources', { markets: modeText(MODE_INFO[0].id, 'source'), rest: t('credits') });
    this.finder.href = `https://weihnachtsmaerkte.odis-berlin.de/?lang=${lang}`;
  }
}
