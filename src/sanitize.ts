// v5.1 security: every save that enters the game (localStorage or an imported backup) goes through here first.
// - deep copy of plain JSON data only, with hard limits (depth, node count, string / array length)
// - prototype-pollution keys (__proto__, constructor, prototype) are dropped at every level
// - numbers: non-finite -> 0, clamped to +-1e15 (money / fans can be big, but never Infinity / NaN)
// - strings: control characters removed, length capped
// The game renders text on a canvas (and the DOM overlay only uses textContent / value), so names can't inject HTML;
// these checks are about not crashing / corrupting the game with a hand-edited backup.
import { ROLES, GENRES, THEMES, PLATFORMS } from './data';

/** largest backup text accepted (a 10-year save is ~150-400 KB of JSON; the base64 code is 4/3 of that) */
export const MAX_BACKUP_CHARS = 4 * 1024 * 1024;
const MAX_DEPTH = 24;
const MAX_NODES = 400_000;
const MAX_STR = 400;
const MAX_ARR = 5_000;
const MAX_NUM = 1e15;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class SaveError extends Error {}

/** deep-copy JSON-like data, dropping anything that is not plain JSON and every prototype-pollution key */
export function sanitizeJSON(v: unknown): unknown {
  const budget = { n: 0 };
  const walk = (x: unknown, depth: number): unknown => {
    if (++budget.n > MAX_NODES) throw new SaveError('too many nodes');
    if (depth > MAX_DEPTH) throw new SaveError('too deep');
    if (x === null) return null;
    switch (typeof x) {
      case 'boolean': return x;
      case 'number': return Number.isFinite(x) ? Math.max(-MAX_NUM, Math.min(MAX_NUM, x)) : 0;
      // eslint-disable-next-line no-control-regex
      case 'string': return x.slice(0, MAX_STR).replace(/[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/g, '');
      case 'object': {
        if (Array.isArray(x)) {
          if (x.length > MAX_ARR) throw new SaveError('array too long');
          return x.map((e) => walk(e, depth + 1));
        }
        const proto = Object.getPrototypeOf(x);
        if (proto !== Object.prototype && proto !== null) return null;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(x as object)) {
          if (BAD_KEYS.has(k) || k.length > 80) continue;
          const val = walk((x as Record<string, unknown>)[k], depth + 1);
          if (val !== undefined) Object.defineProperty(out, k, { value: val, enumerable: true, writable: true, configurable: true });
        }
        return out;
      }
      default: return undefined; // functions, symbols, bigint, undefined: not JSON
    }
  };
  return walk(v, 0);
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, lo: number, hi: number, def: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : def);
const str = (x: unknown, max: number, def: string) => (typeof x === 'string' ? x.slice(0, max) : def);
const GENRE_IDS = new Set(GENRES.map((g) => g.id));
const THEME_IDS = new Set(THEMES.map((t) => t.id));
const PLATFORM_IDS = new Set(PLATFORMS.map((p) => p.id));
const ROLE_IDS = new Set(Object.keys(ROLES));

/** type / range checks on the fields the game indexes tables with (a wrong id would crash a screen later).
 *  Throws SaveError for data that can't be repaired; clamps the rest in place. */
export function checkSaveShape(s: Record<string, unknown>) {
  if (!Array.isArray(s.staff) || !Array.isArray(s.shows)) throw new SaveError('staff/shows');
  s.money = num(s.money, -MAX_NUM, MAX_NUM, 0);
  s.fans = num(s.fans, 0, MAX_NUM, 0);
  s.rp = num(s.rp, 0, 1e9, 0);
  s.absWeek = Math.floor(num(s.absWeek, 0, 48 * 500, 0));
  const staffOk = (st: unknown): boolean => {
    if (!isObj(st) || typeof st.id !== 'number' || !ROLE_IDS.has(st.role as string) || !isObj(st.stats) || !isObj(st.look)) return false;
    st.id = Math.floor(num(st.id, 0, 1e9, 0));
    st.name = str(st.name, 40, 'Kru');
    st.level = Math.floor(num(st.level, 1, 99, 1));
    st.exp = num(st.exp, 0, 1e9, 0);
    st.salary = num(st.salary, 0, 1e12, 0);
    st.energy = num(st.energy, 0, 100, 100);
    for (const k of Object.keys(st.stats as object)) (st.stats as Record<string, unknown>)[k] = num((st.stats as Record<string, unknown>)[k], 0, 1e5, 1);
    const lk = st.look as Record<string, unknown>;
    for (const k of ['skin', 'hair', 'shirt', 'pants']) lk[k] = Math.floor(num(lk[k], 0, 0xffffff, 0x888888));
    lk.style = typeof lk.style === 'string' ? lk.style : 'short';
    lk.female = !!lk.female; lk.glasses = !!lk.glasses;
    return true;
  };
  if (!s.staff.every(staffOk)) throw new SaveError('staff');
  if (Array.isArray(s.candidates)) s.candidates = s.candidates.filter(staffOk);
  if (s.audition != null && !(isObj(s.audition) && ROLE_IDS.has(s.audition.role as string) && Array.isArray(s.audition.cands) && s.audition.cands.every(staffOk) && Array.isArray(s.audition.chem))) s.audition = null;
  const showLike = (sh: unknown): boolean => isObj(sh) && GENRE_IDS.has(sh.genre as string) && THEME_IDS.has(sh.theme as string) && PLATFORM_IDS.has(sh.platform as string) && typeof sh.title === 'string';
  if (!s.shows.every((sh) => showLike(sh) && typeof (sh as { id: unknown }).id === 'number')) throw new SaveError('shows');
  for (const sh of s.shows as Record<string, unknown>[]) {
    sh.title = str(sh.title, 120, 'Sinetron');
    sh.eps = Math.floor(num(sh.eps, 1, 999, 13));
    sh.airWeeks = Math.floor(num(sh.airWeeks, 0, 9999, 0));
    sh.weeksAired = Math.floor(num(sh.weeksAired, 0, 9999, 0));
    sh.rating = num(sh.rating, 0, 100, 0);
  }
  if (s.prod != null) {
    if (!showLike(s.prod) || !Array.isArray((s.prod as Record<string, unknown>).phaseTicks)) throw new SaveError('prod');
    const p = s.prod as Record<string, unknown>;
    p.title = str(p.title, 120, 'Sinetron');
    if (!['naskah', 'syuting', 'editing'].includes(p.phase as string)) throw new SaveError('prod phase');
  }
  if (Array.isArray(s.unlockedGenres)) s.unlockedGenres = s.unlockedGenres.filter((g) => GENRE_IDS.has(g as string));
  if (Array.isArray(s.unlockedThemes)) s.unlockedThemes = s.unlockedThemes.filter((t) => THEME_IDS.has(t as string));
  if (Array.isArray(s.platforms)) s.platforms = s.platforms.filter((p) => PLATFORM_IDS.has(p as string));
  if (typeof s.trend === 'string' && s.trend && !GENRE_IDS.has(s.trend)) s.trend = GENRES[0].id;
  if (Array.isArray(s.queue)) s.queue = s.queue.filter((q) => isObj(q) && typeof q.kind === 'string');
}
