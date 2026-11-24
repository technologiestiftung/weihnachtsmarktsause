import { profaneWords } from '@2toad/profanity';
import ldnoobw from 'naughty-words';

/**
 * Nicknames the board refuses, checked by the API (checkName in _db.ts).
 * The words come from two maintained lists in every language they have -
 * German, English, Turkish, Arabic, Polish, Russian and some twenty more:
 * @2toad/profanity (MIT) and LDNOOBW's naughty-words (CC BY 4.0), and on top
 * of them BLOCKED_NAMES, comma-separated, from the server's environment -
 * for what they miss, kept out of the repository.
 *
 * A name is compared as lower-case letters and digits, with accents dropped
 * (ä -> a, ß -> ss) and digits also read as letters (0 -> o, 1 -> i ...), so
 * "B1tch", "BITCH_91" and "BigBitch" are one. Words of LONG letters or more
 * match anywhere in the name; shorter ones only as a whole word of it (split
 * at spaces, - _ ., digits and capitals) or its plural, as they hide in
 * harmless names: "Kanal", "Hitchcock", "Analena", "Sussex" stay allowed.
 * ALLOWED takes back what the lists hold that is harmless here - in a
 * Christmas game above all - or hides in a harmless word.
 *
 * It catches the obvious, not the inventive; a name that gets through can
 * still be hidden on the board (players.hidden).
 */

const LONG = 6;
const ALLOWED = ['schlitten', 'glocke', 'esel', 'therapist'];

/** Lower case, accents off, ß as ss. */
function fold(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss').toLowerCase();
}

const LEET: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };
const unleet = (s: string) => s.replace(/[013457]/g, (c) => LEET[c]);
const compact = (s: string) => fold(s).replace(/[^\p{L}\p{N}]/gu, '');

const words = [
  ...[...profaneWords.values()].flat(),
  // all but Klingon
  ...Object.entries(ldnoobw).flatMap(([l, ws]) => (l === 'tlh' ? [] : ws)),
  ...(process.env.BLOCKED_NAMES ?? '').split(','),
].map(compact).filter((w) => w.length > 2);
const long = [...new Set(words.filter((w) => w.length >= LONG))];
const short = new Set(words);

/** The name's words, before and after reading digits as letters. */
function parts(name: string): string[] {
  const split = (s: string) => s.split(/[^\p{L}\p{N}]+|(?<=\p{Ll})(?=\p{Lu})|(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u);
  return [...split(name), ...split(unleet(name))].map(fold).filter(Boolean);
}

/** The name with the ALLOWED words taken out. */
const allow = (s: string) => ALLOWED.reduce((t, w) => t.replaceAll(w, ' '), s);

/** True if the board should refuse this name. */
export function blockedName(name: string): boolean {
  const whole = allow(compact(name));
  if (long.some((w) => whole.includes(w) || allow(unleet(compact(name))).includes(w))) return true;
  const plural = (w: string) => w.replace(/(e?s|e|n)$/, '');
  return parts(name).some((w) => !ALLOWED.includes(w) && (short.has(w) || (plural(w).length > 2 && short.has(plural(w)))));
}
