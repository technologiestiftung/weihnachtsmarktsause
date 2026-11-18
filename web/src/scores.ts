/**
 * Your own scores, kept in this browser.
 *
 * Every finished game is a run: mode, markets reached and whether it counts. Runs are
 * appended to one list in local storage (the newest RUN_CAP; a phone has
 * little room and a few hundred games say enough), and the best is kept
 * apart, so it survives the list being trimmed - it is what "new best" is
 * measured against.
 *
 * A run is plain data with nothing browser-specific in it, so the same record
 * goes to the shared board once the player has picked a name (ranking.ts).
 * It carries that name, so friends taking turns on one device each keep
 * their own. See README, "Scores".
 */

export interface Run {
  mode: string;
  /** Played from the start; false where the build lacks it and the game
   *  ran right where you stood. Runs from before the fixed start have none. */
  ranked?: boolean;
  /** Targets reached. */
  count: number;
  /** When it ended, ms since 1970; also what tells runs apart. */
  at: number;
  /** On the shared board already. */
  sent?: boolean;
  /** The nickname it was played under; none before one was picked. */
  name?: string;
}

const RUNS = 'berlin.runs';
const RUN_CAP = 300;

function read<T>(key: string, dflt: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? dflt : JSON.parse(v) as T;
  } catch {
    return dflt;
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode, or full */ }
}

/** Every run kept, oldest first. */
export function runs(): Run[] {
  const list = read<Run[]>(RUNS, []);
  return Array.isArray(list) ? list : [];
}

/**
 * The most targets reached from the start. The older berlin.best.*,
 * berlin.points.* and berlin.count.*.* keys belong to earlier courses and
 * are left be.
 */
export function bestCount(mode: string): number | null {
  const v = read<number | null>(`berlin.count.${mode}`, null);
  return typeof v === 'number' ? v : null;
}

/** Keep a finished run; true if it is a new best. */
export function recordRun(run: Run): boolean {
  const list = runs();
  list.push(run);
  write(RUNS, list.slice(-RUN_CAP));
  if (!run.ranked) return false;
  const best = bestCount(run.mode);
  if (best !== null && run.count <= best) return false;
  write(`berlin.count.${run.mode}`, run.count);
  return true;
}

/** The order on a high score list: more targets first. */
export function better(a: Pick<Run, 'count'>, b: Pick<Run, 'count'>): number {
  return b.count - a.count;
}

/** Games played before a name was picked are the first name's. */
export function nameRuns(name: string): void {
  const list = runs();
  if (!list.some((r) => !r.name)) return;
  for (const r of list) r.name ??= name;
  write(RUNS, list);
}

/** Note that a run has gone to the shared board. */
export function markSent(at: number): void {
  const list = runs();
  const r = list.find((x) => x.at === at);
  if (!r || r.sent) return;
  r.sent = true;
  write(RUNS, list);
}

export function isSent(at: number): boolean {
  return runs().some((r) => r.at === at && r.sent);
}

/** Runs played under a name, and those from before any name was picked. */
export function runsOf(name: string | null): Run[] {
  const key = name?.toLowerCase();
  return runs().filter((r) => !r.name || r.name.toLowerCase() === key);
}

export interface ModeStats {
  played: number;
  /** The best ranked run. */
  best: Run | null;
}

/** A mode's numbers over ranked runs for a name; see runsOf. */
export function stats(mode: string, name: string | null): ModeStats {
  const s: ModeStats = { played: 0, best: null };
  for (const r of runsOf(name)) {
    if (r.mode !== mode || !r.ranked) continue;
    s.played++;
    if (!s.best || better(r, s.best) < 0) s.best = r;
  }
  return s;
}
