/**
 * Game sounds and music, synthesised with WebAudio so nothing has to be
 * downloaded. Browsers only allow audio after a click or key, so the
 * context is created on the first one (unlockAudio).
 *
 * Two buses, music and effects, feed a master gain; the settings screen sets
 * all three and the switch that silences everything. They are kept in this
 * browser.
 */

export interface AudioSettings {
  on: boolean;
  /** 0 to 1. */
  master: number;
  music: number;
  sfx: number;
}

const KEY = 'berlin.audio';

function load(): AudioSettings {
  const s: AudioSettings = { on: true, master: 0.8, music: 0.5, sfx: 0.8 };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AudioSettings>;
    if (typeof v.on === 'boolean') s.on = v.on;
    for (const k of ['master', 'music', 'sfx'] as const) {
      const n = v[k];
      if (typeof n === 'number' && n >= 0 && n <= 1) s[k] = n;
    }
  } catch { /* storage blocked */ }
  return s;
}

export const audioSettings: AudioSettings = load();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;

/** Change and keep the settings; the sound follows at once. */
export function setAudio(change: Partial<AudioSettings>): void {
  Object.assign(audioSettings, change);
  try { localStorage.setItem(KEY, JSON.stringify(audioSettings)); } catch { /* storage blocked */ }
  applyGains();
  if (audioSettings.on && audioSettings.music > 0) music.start();
}

function applyGains(): void {
  if (!ctx || !master || !musicBus || !sfxBus) return;
  const s = audioSettings, t = ctx.currentTime;
  // a short glide, so dragging a slider does not click
  master.gain.setTargetAtTime(s.on ? s.master * 0.5 : 0, t, 0.03);
  musicBus.gain.setTargetAtTime(s.music, t, 0.03);
  sfxBus.gain.setTargetAtTime(s.sfx, t, 0.03);
}

function audio(): AudioContext | null {
  if (!audioSettings.on) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.connect(master);
      applyGains();
    }
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** On the first click or key: start the context and the music. */
export function unlockAudio(): void {
  if (audio()) music.start();
}

// nothing plays in a tab out of sight
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else if (audioSettings.on) void ctx.resume();
});

function toneAt(t: number, freq: number, dur: number, type: OscillatorType, vol: number, bus: GainNode): void {
  const a = ctx!;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.5): void {
  const a = audio();
  if (!a || !sfxBus || audioSettings.sfx === 0) return;
  toneAt(a.currentTime + start, freq, dur, type, vol, sfxBus);
}

function noiseAt(t: number, dur: number, vol: number, hp: number, bus: GainNode): void {
  const a = ctx!;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t);
}

function noise(start: number, dur: number, vol: number, hp: number): void {
  const a = audio();
  if (!a || !sfxBus || audioSettings.sfx === 0) return;
  noiseAt(a.currentTime + start, dur, vol, hp, sfxBus);
}

const NOTE = (n: number) => 440 * 2 ** ((n - 69) / 12);

export const sfx = {
  /** Sleigh bells and a chord. */
  jingle(): void {
    for (let i = 0; i < 6; i++) noise(i * 0.07, 0.12, 0.25, 6000);
    [76, 79, 83, 88].forEach((n, i) => tone(NOTE(n), 0.05 + i * 0.05, 0.5, 'sine', 0.3));
  },
  /** A clock tick; urgent for the last three seconds. */
  tick(urgent = false): void { tone(NOTE(urgent ? 91 : 84), 0, 0.08, 'square', urgent ? 0.2 : 0.12); },
  go(): void { tone(NOTE(79), 0, 0.12, 'square', 0.2); tone(NOTE(91), 0.12, 0.35, 'square', 0.2); },
  /** The combo going up: a blip that climbs a step with each multiplier. */
  combo(mult: number): void {
    const n = 72 + [0, 0, 4, 7, 11, 12][Math.min(mult, 5)];
    tone(NOTE(n), 0.04, 0.12, 'square', 0.13);
    tone(NOTE(n + 12), 0.1, 0.18, 'square', 0.1);
  },
  comboLost(): void { tone(NOTE(67), 0, 0.12, 'triangle', 0.18); tone(NOTE(60), 0.1, 0.22, 'triangle', 0.18); },
  /** A golden target: a sparkle running up. */
  gold(): void {
    for (let i = 0; i < 8; i++) tone(NOTE(84 + i * 2), i * 0.035, 0.25, 'sine', 0.22);
    noise(0, 0.4, 0.12, 7000);
  },
  medal(): void {
    [79, 84, 88].forEach((n, i) => tone(NOTE(n), i * 0.09, 0.35, 'triangle', 0.3));
  },
  /** The course record broken: a fanfare. */
  record(): void {
    [72, 72, 72, 77, 81, 84].forEach((n, i) =>
      tone(NOTE(n), [0, 0.1, 0.2, 0.32, 0.5, 0.68][i], i === 5 ? 0.6 : 0.14, 'sawtooth', 0.16));
  },
  win(): void {
    [72, 76, 79, 84, 79, 84].forEach((n, i) => tone(NOTE(n), i * 0.12, 0.3, 'triangle', 0.35));
  },
  lose(): void {
    [67, 63, 60, 55].forEach((n, i) => tone(NOTE(n), i * 0.18, 0.35, 'sawtooth', 0.18));
  },
};

/* --- music ---------------------------------------------------------------- */

/**
 * Jingle Bells' chorus (traditional), quietly on a loop: a triangle melody,
 * a sine bass on each half bar and a sleigh bell on the beat. Notes are
 * MIDI number and length in beats; 0 is a rest.
 */
const BEAT = 0.3;
const MELODY: [number, number][] = [
  [76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4],
  [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5],
  [76, 1], [74, 1], [74, 1], [76, 1], [74, 2], [79, 2],
  [76, 1], [76, 1], [76, 2], [76, 1], [76, 1], [76, 2], [76, 1], [79, 1], [72, 1.5], [74, 0.5], [76, 4],
  [77, 1], [77, 1], [77, 1.5], [77, 0.5], [77, 1], [76, 1], [76, 1], [76, 0.5], [76, 0.5],
  [79, 1], [79, 1], [77, 1], [74, 1], [72, 4],
  [0, 4],
];
/** A root per bar of four beats. */
const BASS = [48, 48, 48, 48, 53, 48, 50, 43, 48, 48, 48, 48, 53, 48, 43, 48, 48];

export const music = {
  timer: 0,
  /** When the next note is due, in context time, and which it is. */
  next: 0,
  note: 0,
  /** Beats into the loop at `next`. */
  beat: 0,

  start(): void {
    if (this.timer || !audio()) return;
    this.next = ctx!.currentTime + 0.1;
    this.note = 0;
    this.beat = 0;
    // a timer looks a second ahead and books the notes on the audio clock,
    // which keeps time even when the timer is late
    this.timer = window.setInterval(() => this.schedule(), 250);
    this.schedule();
  },

  schedule(): void {
    if (!ctx || !musicBus || ctx.state !== 'running') return;
    // back from a suspended tab: pick up from now, not with a burst
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    if (!audioSettings.on || audioSettings.music === 0) return;
    while (this.next < ctx.currentTime + 1) {
      const [n, len] = MELODY[this.note];
      const t = this.next;
      if (n) toneAt(t, NOTE(n), Math.max(0.25, len * BEAT * 0.9), 'triangle', 0.16, musicBus);
      // bass and bell on whole beats that fall inside this note
      for (let b = Math.ceil(this.beat - 1e-6); b < this.beat + len - 1e-6; b++) {
        const at = t + (b - this.beat) * BEAT;
        if (b % 2 === 0) toneAt(at, NOTE(BASS[Math.floor(b / 4)]), BEAT * 1.8, 'sine', 0.2, musicBus);
        noiseAt(at, 0.06, b % 2 ? 0.03 : 0.05, 7500, musicBus);
      }
      this.next += len * BEAT;
      this.beat += len;
      if (++this.note === MELODY.length) { this.note = 0; this.beat = 0; }
    }
  },
};
