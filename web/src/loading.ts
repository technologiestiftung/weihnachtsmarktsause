import { t } from './i18n';
import { art } from './loadingart';

/**
 * The screen between picking a game and its countdown. It covers the city
 * while the course is set up and the tiles around the start stream in, so
 * nobody sees free roam flash by or a half-built street at "go". Each game
 * has its own colours and a small 3D scene in the game's look
 * (loadingart.ts): snow for the markets. Only a bar and a few lines to
 * read while it fills; the controls come with the countdown (games.ts).
 */

interface Theme {
  /** Background: top glow, then the base it fades into. */
  glow: string;
  base: string;
  accent: string;
}

const THEMES: Record<string, Theme> = {
  markets: { glow: '#27406e', base: '#070b18', accent: '#3fbf6f' },
};

export class GameLoader {
  private readonly el = document.getElementById('gameLoading')!;
  private readonly anchor = document.getElementById('glArt')!;
  private readonly bar = document.getElementById('glBar')!;
  private readonly line = document.getElementById('glLine')!;
  private readonly back = document.getElementById('glBack')!;
  private shown = 0;
  private timer = 0;
  /** The player backed out: whoever is loading should stop at its next step. */
  cancelled = false;
  /** Told at once when the player backs out. */
  onCancel: (() => void) | null = null;

  constructor() {
    this.back.addEventListener('click', () => this.cancel());
    // before main.ts's own keys, which do nothing while a game loads
    addEventListener('keydown', (e) => {
      if (this.el.classList.contains('on') && e.code === 'Escape') this.cancel();
    }, true);
  }

  /** Back to the menu, now or as soon as the current step is done. */
  private cancel(): void {
    this.cancelled = true;
    this.onCancel?.();
  }

  show(id: string): void {
    this.cancelled = false;
    const th = THEMES[id] ?? THEMES.markets;
    const s = this.el.style;
    s.setProperty('--gl-glow', th.glow);
    s.setProperty('--gl-base', th.base);
    s.setProperty('--gl-accent', th.accent);
    this.back.textContent = t('load.back');

    const lines = t(`load.${id}`).split('|');
    let n = Math.floor(Math.random() * lines.length);
    const next = () => {
      this.line.classList.remove('in');
      void this.line.offsetWidth;                 // restart the fade
      this.line.textContent = lines[n++ % lines.length];
      this.line.classList.add('in');
    };
    next();
    clearInterval(this.timer);
    this.timer = window.setInterval(next, 1800);

    this.shown = 0;
    this.bar.style.width = '0%';
    this.el.classList.add('on');
    // after the screen is laid out: the scene places itself over the spacer
    art.show(id, this.el, this.anchor);
  }

  /** Nothing is coming: one line in place of the rotating ones, and only the way back. */
  stuck(text: string): void {
    clearInterval(this.timer);
    this.line.textContent = text;
    this.line.classList.add('in');
    this.bar.style.width = '0%';
  }

  /** 0 to 1; never goes back, even when more to load turns up. */
  progress(f: number): void {
    this.shown = Math.max(this.shown, Math.min(1, f));
    this.bar.style.width = `${(4 + this.shown * 96).toFixed(1)}%`;
  }

  hide(): void {
    clearInterval(this.timer);
    this.el.classList.remove('on');
    art.hide(this.el);
  }
}
