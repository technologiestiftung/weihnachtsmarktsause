import { MODE_INFO, modeText, type Result } from './games';
import { lang, onLang, t } from './i18n';
import { playerName, setPlayerName, standing, type Board } from './ranking';
import { Scoreboard } from './scoreboard';
import { bestCount, recordRun, type Run } from './scores';
import { art } from './loadingart';

/**
 * The start menu, on a purple night with a lit tree in falling snow: start and high scores, with a
 * game's result above them.
 *
 * Every game starts at the same place (games.ts, START), so runs compare
 * for the whole season: start is the only choice there is.
 */

export type Choice = { id: string };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class Menu {
  private readonly boot = document.getElementById('boot')!;
  private readonly result = document.getElementById('result')!;
  private readonly credits = document.getElementById('menuCredits')!;
  private readonly finder = document.getElementById('finderBtn') as HTMLAnchorElement;
  private readonly intro = document.getElementById('intro')!;
  private readonly scoreboard = new Scoreboard();
  /** The game last played, whose tab the high scores open on. */
  private lastMode: string | undefined;
  /** Where the last run stands on the shared board, once known. */
  private standing: Promise<Board> | null = null;
  open = true;

  constructor(private readonly onPick: (c: Choice) => void) {
    onLang(() => { this.render(); this.redraw?.(); });
    // there is one game on one course: start plays it
    document.getElementById('playBtn')!.addEventListener('click',
      () => this.pick({ id: MODE_INFO[0].id }));
    // the high scores open in a box over the menu
    document.getElementById('scoresBtn')!.addEventListener('click', () => this.scoreboard.show(this.lastMode));
  }

  /** Clears the panel above the buttons. */
  private closePanel(): void {
    this.result.classList.remove('on', 'note');
    this.redraw = null;
  }

  /** Redraws the panel above the buttons in a new language, if it can. */
  private redraw: (() => void) | null = null;

  /** The world has loaded: show the choices. */
  ready(): void {
    this.boot.classList.add('ready');
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
    art.hide(this.boot);
  }

  private pick(c: Choice): void {
    this.hide();
    this.onPick(c);
  }

  /**
   * After a game: how many markets, and a field for the nickname. The run is
   * kept - here and on the shared board - only once a name is given; then
   * the field gives way to its place on the board.
   */
  showResult(id: string, r: Result, run: Run): void {
    this.lastMode = id;
    this.standing = null;
    this.drawResult(id, r, run);
    this.show();
  }

  private drawResult(id: string, r: Result, run: Run): void {
    const best = run.ranked ? bestCount(id) : null;
    // the title was written in the language the game ended in
    const kids: HTMLElement[] = [
      h('h3', '', r.title),
      h('div', 'big', modeText(id, 'unit', { n: r.count })),
    ];
    if (!run.ranked) kids.push(h('p', '', t('menu.unranked')));
    // close enough to taste it: say how close
    else if (best !== null && best > r.count && r.count >= best * 0.7) {
      kids.push(h('p', 'short', t('menu.short', { n: best - r.count })));
    } else if (best !== null && best > r.count) {
      kids.push(h('p', '', t('menu.best', { best: modeText(id, 'unit', { n: best }) })));
    }
    if (run.ranked) kids.push(this.rankLine(id, r, run));
    this.result.replaceChildren(...kids);
    this.result.classList.add('on');
    this.result.classList.remove('note');
    this.redraw = () => this.drawResult(id, r, run);
  }

  /** The run's place among everyone on the course, once saved; until then the field for a name. */
  private rankLine(id: string, r: Result, run: Run): HTMLElement {
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
    input.value = playerName() ?? '';
    const go = h('button', '', t('board.joinBtn'));
    const msg = h('p', 'src');
    const row = h('div', 'row');
    row.append(input, go);
    form.append(h('p', '', t('board.join')), row, msg, h('p', 'src', t('board.privacy')));
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
      run.name = playerName() ?? undefined;
      recordRun(run);
      this.standing = standing(run);
      this.drawResult(id, r, run);
    });
    return form;
  }

  /** A line over the buttons: a game left before the end, or one that would not start.
   *  Unlike a result it leaves the intro in place. */
  showNote(text: () => string): void {
    this.result.replaceChildren(h('p', '', text()));
    this.result.classList.add('on', 'note');
    this.show();
    this.redraw = () => this.showNote(text);
  }

  /** The intro, the data credits (the markets first) and the finder, in this language. */
  private render(): void {
    // the round's length comes from games.ts, so the text says it as it is
    this.intro.textContent = modeText(MODE_INFO[0].id, 'intro');
    this.credits.innerHTML = t('menu.sources', { markets: modeText(MODE_INFO[0].id, 'source'), rest: t('credits') });
    // tagged as the Finder tags its link here, so Matomo there sees where visits came from
    this.finder.href = `https://weihnachtsmaerkte.odis-berlin.de/?lang=${lang}&mtm_campaign=weihnachtsmarktsause&mtm_kwd=menu`;
    this.finder.title = t('menu.finderTitle');
  }
}
