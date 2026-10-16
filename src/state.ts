import {
  ROLES, ROLE_LIST, NAMES_F, NAMES_M, PREFIX_F, PREFIX_M, GENRES, THEMES, JOBS,
  type Role, type Stat, type PointKey, type Compat,
} from './data';
import { makeRivals, type Rival } from './rating';
import { sanitizeJSON, checkSaveShape, MAX_BACKUP_CHARS } from './sanitize';
import { migrateV5, emptyStats5, type FeedPost, type Offer, type Audition } from './v5';

export type HairStyle = 'short' | 'spiky' | 'cap' | 'bald' | 'long' | 'bob' | 'hijab' | 'bun' | 'ponytail';
export interface Look {
  skin: number; hair: number; shirt: number; pants: number;
  style: HairStyle; glasses: boolean; female: boolean;
}
export type RoomId = 'set' | 'makeup' | 'desk' | 'kantin';
export type Activity = 'idle' | 'work' | 'rest';

export interface Staff {
  id: number; name: string; role: Role; level: number; exp: number;
  stats: Record<Stat, number>; salary: number; energy: number; look: Look;
  activity: Activity; room: RoomId; travel: number;
  /** social media followers (Popularitas) */
  followers: number;
  /** 0-100: how hard a rival studio has to try to steal them */
  loyalty: number;
  /** famous freelance star hired from the pool */
  star?: boolean;
  // ---- v5 ----
  /** actor trait (casting): see TRAITS in v5.ts */
  trait?: string;
  /** weeks left on a strike (mogok): no work */
  strike?: number;
}
/** v5 actor trait ids (the definitions live in v5.ts) */
export const TRAIT_IDS = ['cengeng', 'kocak', 'ekspresif', 'fotogenik', 'disiplin', 'setia', 'rewel', 'drama'];

export type Phase = 'naskah' | 'syuting' | 'editing';
export interface Production {
  title: string; genre: string; theme: string; platform: string; eps: number; budget: string;
  leadM: number | null; leadF: number | null;
  phase: Phase; phaseTick: number; phaseTicks: number[];
  points: Record<PointKey, number>; bloopers: number; fixed: number; hype: number;
  cost: number; startWeek: number; extraEdit: number;
  /** location shoot (Peta) */
  location: string | null; locCost: number; locEvent: boolean; locAnnounced: boolean;
  // ---- v4 ----
  /** OST singer id + fee paid */
  ost: string | null; ostFee: number;
  /** booked the special "Sinetron Ramadan" slot (sponsor paid upfront) */
  ramadan: boolean; ramadanPay: number;
  /** sequel / spin-off of an earlier show */
  parentId: number | null; spin: 'sekuel' | 'spinoff' | null;
  /** lead actors' fee included in cost */
  honor: number;
  // ---- v5 ----
  /** product placement offers on the table / accepted sponsor ids / money received */
  offers: Offer[]; placements: string[]; placementPay: number;
  /** sensor mandiri: fewer KPI points, a little less rating */
  sensor: boolean;
}

export interface ShowOst { singer: string; song: string; power: number; hit: boolean; viral: boolean; total: number }

export interface Show {
  id: number; title: string; genre: string; theme: string; platform: string; eps: number;
  scores: number[]; comments: string[]; total: number; rating: number; compat: Compat;
  airWeeks: number; weeksAired: number; revenue: number; fansGained: number; rp: number;
  releaseWeek: number; hof: boolean; cost: number; points: Record<PointKey, number>; bloopers: number;
  repeatPenalty: boolean; trendBonus: boolean;
  // ---- Perang Rating (v3) ----
  /** weekly rating while airing */
  hist: number[];
  /** weekly chart position */
  ranks: number[];
  /** leading rival's rating each week (for the mini chart) */
  rivalHist: number[];
  lowStreak: number; topStreak: number; topBonuses: number; warned: boolean; cancelled: boolean;
  boost: number; boostWeeks: number; ext: number; decayShift: number;
  /** air weeks the ad money is spread over (fixed at release; extensions add weeks on top) */
  revWeeks: number;
  leads: number[]; location: string | null; locMatches: string[];
  // ---- v4 ----
  /** plot twist cards played on this show */
  twists: string[]; twistCd: number; tBoost: number; tWeeks: number;
  /** "netizen muak" rating penalty (0..MUAK_CAP) */
  muak: number;
  ost: ShowOst | null;
  ramadan: boolean;
  parentId: number | null; franchise: number; part: number; spin: 'sekuel' | 'spinoff' | null;
  /** rating bonus inherited from the franchise (shown on the rating screen) */
  fanBase: number;
  /** promo kind currently running */
  promoKind: 'promo' | 'kampanye' | null;
  // ---- v5 ----
  /** product placements in the show (count) and the leads' chemistry */
  placements: number; chem: number;
  /** gossip boost (digoreng), boikot penalty, KPI late-night slot: value + weeks left */
  gBoost: number; gWeeks: number; bPen: number; bWeeks: number; slotWeeks: number;
}

export interface JobOffer { name: string; weeks: number; pay: number; need: number }
export interface Job extends JobOffer { progress: number; ticksLeft: number }

export type Pending =
  | { kind: 'editDone' }
  | { kind: 'release'; showId: number }
  | { kind: 'event'; eventId: string; data: Record<string, number | string> }
  | { kind: 'award'; year: number; title: string | null; score: number; rival: string; rivalScore: number; won: boolean; prize: number; fans: number }
  | { kind: 'airEnd'; showId: number }
  | { kind: 'jobDone'; name: string; pay: number; rp: number }
  | { kind: 'warning'; months: number }
  | { kind: 'gameover' }
  | { kind: 'info'; title: string; text: string }
  | { kind: 'rating'; showId: number; type: 'warn' | 'cancel' | 'top'; money: number; fans: number }
  | { kind: 'ending' };

export interface Stats5 {
  twists: number; placements: number; goreng: number; gossips: number; castings: number; bestChem: number;
  kpiWarns: number; kpiFines: number; ramadanTop: number; boikots: number; debtSeen: number; maxRating: number; epsTotal: number;
  /** platform tiers where a show reached #1 */
  rank1: string[];
}

export interface GameState {
  version: number;
  money: number; fans: number; rp: number;
  absWeek: number; tick: number;
  staff: Staff[]; nextId: number;
  candidates: Staff[];
  unlockedGenres: string[]; unlockedThemes: string[]; platforms: string[]; studio: number;
  knownCombos: Record<string, Compat>;
  prod: Production | null; job: Job | null; jobOffers: JobOffer[];
  shows: Show[]; trend: string; debtWeeks: number;
  awards: { year: number; title: string | null; won: boolean }[]; trophies: number;
  queue: Pending[];
  totalRevenue: number; gameOver: boolean; tutorialSeen: boolean;
  lastEventWeek: number;
  // ---- v3 ----
  rivals: Rival[]; rivalSeq: number;
  /** discovered location combos: loc id -> genre/theme ids */
  locCombos: Record<string, string[]>;
  /** debug/test multiplier on rival ratings (1 = normal) */
  rivalMult?: number;
  // ---- v4 ----
  /** owned equipment ids (Peralatan) */
  equipment: string[];
  /** plot twist card id -> absWeeks it was played (across all shows) */
  twistLog: Record<string, number[]>;
  /** overused twist that critics will mock in the next review */
  twistMock: string | null;
  /** exclusive star contract offers (Agensi Bintang) */
  starOffers: Staff[]; starOfferWeek: number;
  /** year the special Ramadan slot was used / Ramadan announced */
  ramadanSlotYear: number; ramadanNoticeYear: number;
  /** running money stats (for the finance screen) */
  ledger: Ledger;
  // ---- v5 ----
  /** achievement id -> absWeek unlocked */
  achievements: Record<string, number>;
  stats5: Stats5;
  /** the year-10 career recap was shown */
  endingSeen: boolean;
  /** netizen timeline (newest first), post counter, last post id the player read */
  feed: FeedPost[]; feedSeq: number; feedRead: number;
  /** KPI teguran meter 0-100, stage (0 ok, 1 warned, 2 sanctioned), last sowan week */
  kpi: number; kpiStage: number; kpiSowanWeek: number; kpiLastSanction: number;
  /** netizen anger 0-100 (boikot risk) */
  boikot: number;
  /** guided tutorial step (-1 = done / skipped) */
  tut: number;
  /** lead pair chemistry found in castings: "idA|idB" -> 0-100 */
  chem: Record<string, number>;
  /** running audition (casting) */
  audition: Audition | null;
}

export interface Ledger { year: number; income: Record<string, number>; spend: Record<string, number>; last?: { year: number; income: Record<string, number>; spend: Record<string, number> } }

export const SAVE_KEY = 'sinetron-story-save-v1';
export const TICKS_PER_WEEK = 8;
export const WEEKS_PER_YEAR = 48;

export function dateOf(absWeek: number) {
  return {
    year: Math.floor(absWeek / WEEKS_PER_YEAR) + 1,
    month: Math.floor((absWeek % WEEKS_PER_YEAR) / 4) + 1,
    week: (absWeek % 4) + 1,
  };
}

export const rnd = () => Math.random();
export const rr = (a: number, b: number) => a + Math.random() * (b - a);
export const ri = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
export function pick<T>(a: readonly T[]): T { return a[Math.floor(Math.random() * a.length)]; }

const SKINS = [0xf6d2a8, 0xf0c08a, 0xe2a873, 0xd09060, 0xb87a4e, 0x9a6440];
const HAIRS = [0x2a1c14, 0x1a1414, 0x4a2a18, 0x6b3e1e, 0x3a2a2a, 0x8a4a20, 0x222233];
const SHIRTS = [0xe05050, 0x4f7fd0, 0x58b05a, 0xe8c040, 0xe07ab0, 0x9a6ad0, 0xf2f2f2, 0x40b0b0, 0xe08a3a, 0x30304a];
const PANTS = [0x3a4a6a, 0x2a2a34, 0x5a4a3a, 0x6a6a7a, 0x34506a];
const HIJAB = [0xe05080, 0x60a0d0, 0xf0f0f0, 0x80c080, 0xd0a0e0, 0xe0b060, 0x403050];

export function randomLook(female: boolean, role: Role): Look {
  let style: HairStyle;
  if (female) style = pick(['long', 'bob', 'hijab', 'bun', 'ponytail', 'long'] as HairStyle[]);
  else style = pick(['short', 'spiky', 'short', 'cap', role === 'sutradara' ? 'bald' : 'short'] as HairStyle[]);
  return {
    skin: pick(SKINS),
    hair: style === 'hijab' ? pick(HIJAB) : pick(HAIRS),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    style,
    glasses: Math.random() < (role === 'sutradara' || role === 'penulis' ? 0.45 : 0.1),
    female,
  };
}

export function makeStaff(id: number, role: Role, quality: number, usedNames: Set<string>): Staff {
  const def = ROLES[role];
  const female = def.female === null ? Math.random() < 0.45 : def.female;
  let name = '';
  for (let i = 0; i < 20; i++) {
    name = (female ? pick(PREFIX_F) : pick(PREFIX_M)) + ' ' + (female ? pick(NAMES_F) : pick(NAMES_M));
    if (!usedNames.has(name)) break;
  }
  usedNames.add(name);
  const level = Math.max(1, Math.min(6, Math.floor(1 + (quality - 1) * 2.2 + Math.random() * 1.2)));
  const stats = {} as Record<Stat, number>;
  let sum = 0, baseSum = 0;
  for (const k of Object.keys(def.base) as Stat[]) {
    const v = Math.round(def.base[k] * rr(0.75, 1.3) * quality + (level - 1) * (def.main.includes(k) ? 4 : 1.5));
    stats[k] = Math.max(3, Math.min(250, v));
    sum += stats[k]; baseSum += def.base[k];
  }
  const salary = Math.round((def.salary * Math.pow(sum / baseSum, 1.15)) / 50000) * 50000;
  return {
    id, name, role, level, exp: 0, stats, salary, energy: 100,
    look: randomLook(female, role), activity: 'idle', room: 'kantin', travel: 0,
    followers: startFollowers(role, level, stats.pesona), loyalty: ri(45, 80),
    trait: role === 'aktor' || role === 'aktris' ? pick(TRAIT_IDS) : undefined, strike: 0,
  };
}

export function startFollowers(role: Role, level: number, pesona: number): number {
  const actor = role === 'aktor' || role === 'aktris';
  return Math.round((actor ? rr(150, 600) * level * (pesona / 22) : rr(40, 300) * level) / 10) * 10;
}

/** a famous freelance actor/actress: great stats, huge following, pricey and not very loyal */
export function makeStar(id: number, quality: number, usedNames: Set<string>): Staff {
  const role: Role = Math.random() < 0.5 ? 'aktor' : 'aktris';
  const st = makeStaff(id, role, quality * 1.55, usedNames);
  st.stats.pesona = Math.round(st.stats.pesona * 1.35);
  st.followers = Math.round(rr(250_000, 1_500_000) / 1000) * 1000;
  st.salary = Math.round((st.salary * 2.4) / 50000) * 50000;
  st.loyalty = ri(28, 50);
  st.star = true;
  return st;
}

export const SELEB_AT = 100_000;
export const SELEB_TOP = 1_000_000;
export function isSeleb(st: Staff): boolean { return st.followers >= SELEB_AT; }
/** 12rb, 1,2jt */
export function fmtFollowers(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',').replace(',0', '') + 'jt';
  if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
  return String(Math.round(n));
}

export function makeCandidates(s: GameState): Staff[] {
  const used = new Set(s.staff.map((x) => x.name));
  const q = 1 + Math.min(1.6, s.fans / 60000) + (s.studio - 1) * 0.15;
  const out: Staff[] = [];
  const roles = [...ROLE_LIST].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 4; i++) {
    out.push(makeStaff(s.nextId++, roles[i % roles.length], q * rr(0.85, 1.2), used));
  }
  // now and then a famous freelance star shows up (once the studio is a bit known)
  if ((s.fans >= 2500 || s.studio > 1) && Math.random() < 0.2) out[3] = makeStar(s.nextId++, q, used);
  return out;
}

/** side jobs; `scale` grows with the studio's monthly costs so a job always roughly covers the payroll (a safety net, not a money printer) */
export function makeJobOffers(scale = 1): JobOffer[] {
  const a = [...JOBS].sort(() => Math.random() - 0.5).slice(0, 3);
  const k = Math.max(1, scale);
  return a.map((j) => ({ ...j, pay: Math.round((j.pay * k) / 100000) * 100000, need: Math.round(j.need * Math.pow(k, 0.55)) }));
}

export function newGame(): GameState {
  const s: GameState = {
    version: 1, money: 45_000_000, fans: 0, rp: 6, absWeek: 0, tick: 0,
    staff: [], nextId: 1, candidates: [],
    unlockedGenres: GENRES.filter((g) => g.unlockCost === 0).map((g) => g.id),
    unlockedThemes: THEMES.filter((t) => t.unlockCost === 0).map((t) => t.id),
    platforms: ['lokal'], studio: 1, knownCombos: {},
    prod: null, job: null, jobOffers: makeJobOffers(), shows: [], trend: 'romansa', debtWeeks: 0,
    awards: [], trophies: 0, queue: [], totalRevenue: 0, gameOver: false, tutorialSeen: false,
    lastEventWeek: 0,
    rivals: [], rivalSeq: 1, locCombos: {},
    equipment: [], twistLog: {}, twistMock: null, starOffers: [], starOfferWeek: -999,
    ramadanSlotYear: 0, ramadanNoticeYear: 0, ledger: { year: 1, income: {}, spend: {} },
    achievements: {}, stats5: emptyStats5(), endingSeen: false, feed: [], feedSeq: 0, feedRead: 0,
    kpi: 0, kpiStage: 0, kpiSowanWeek: -999, kpiLastSanction: -999, boikot: 0, tut: 0, chem: {}, audition: null,
  };
  const used = new Set<string>();
  const start: Role[] = ['sutradara', 'penulis', 'aktor', 'aktris'];
  for (const r of start) s.staff.push(makeStaff(s.nextId++, r, 1, used));
  s.staff.forEach((st, i) => { st.room = (['set', 'desk', 'makeup', 'kantin'] as RoomId[])[i]; });
  s.candidates = makeCandidates(s);
  // make sure a camera operator is on offer at the start (Visual matters!)
  if (!s.candidates.some((c) => c.role === 'kameramen')) s.candidates[0] = makeStaff(s.nextId++, 'kameramen', 1, used);
  makeRivals(s);
  return s;
}

export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    let st: GameState | null = null;
    try { st = raw.length <= MAX_BACKUP_CHARS ? normalizeSave(JSON.parse(raw)) : null; } catch { st = null; }
    // an unreadable save is kept aside (never silently overwritten by the next autosave)
    if (!st) { try { localStorage.setItem(SAVE_KEY + '-rusak', raw); } catch { /* quota */ } }
    return st;
  } catch {
    return null;
  }
}

/** validate + migrate a parsed save object (localStorage or an imported backup). null = not a usable save */
export function normalizeSave(obj: unknown): GameState | null {
  // v5.1: plain-JSON deep copy without prototype-pollution keys, clamped numbers / strings, then a shape check
  let clean: unknown;
  try { clean = sanitizeJSON(obj); } catch { return null; }
  const s = clean as GameState;
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.version !== 1 || !Array.isArray(s.staff) || !Array.isArray(s.shows)) return null;
  if (typeof s.money !== 'number' || typeof s.absWeek !== 'number' || !isFinite(s.absWeek) || s.absWeek < 0) return null;
  if (!s.staff.every((x) => x && typeof x.id === 'number' && typeof x.role === 'string' && x.stats && x.look)) return null;
  try { checkSaveShape(s as unknown as Record<string, unknown>); } catch { return null; }
  // forward-compat defaults
  s.queue = Array.isArray(s.queue) ? s.queue : [];
  s.knownCombos = s.knownCombos ?? {};
  s.jobOffers = s.jobOffers ?? makeJobOffers();
  s.lastEventWeek = s.lastEventWeek ?? 0;
  s.candidates = Array.isArray(s.candidates) ? s.candidates : [];
  s.unlockedGenres = Array.isArray(s.unlockedGenres) ? s.unlockedGenres : GENRES.filter((g) => g.unlockCost === 0).map((g) => g.id);
  s.unlockedThemes = Array.isArray(s.unlockedThemes) ? s.unlockedThemes : THEMES.filter((t) => t.unlockCost === 0).map((t) => t.id);
  s.platforms = Array.isArray(s.platforms) && s.platforms.length ? s.platforms : ['lokal'];
  s.awards = Array.isArray(s.awards) ? s.awards : [];
  s.studio = Math.max(1, Math.min(5, Math.round(Number(s.studio) || 1)));
  s.nextId = Math.max(Number(s.nextId) || 1, ...s.staff.map((x) => x.id + 1), ...s.shows.map((x) => x.id + 1));
  migrateV3(s);
  migrateV4(s);
  migrateV5(s);
  return s;
}

/** fill in Perang Rating / Peta / Selebgram fields for saves made before v3 */
export function migrateV3(s: GameState) {
  s.locCombos = s.locCombos ?? {};
  s.rivalSeq = s.rivalSeq ?? 1;
  const fixStaff = (st: Staff) => {
    if (typeof st.followers !== 'number' || !isFinite(st.followers)) st.followers = startFollowers(st.role, st.level, st.stats.pesona);
    if (typeof st.loyalty !== 'number' || !isFinite(st.loyalty)) st.loyalty = 60;
  };
  s.staff.forEach(fixStaff);
  (s.candidates ?? []).forEach(fixStaff);
  for (const sh of s.shows) {
    sh.hist = sh.hist ?? [];
    sh.ranks = sh.ranks ?? [];
    sh.rivalHist = sh.rivalHist ?? [];
    sh.lowStreak = sh.lowStreak ?? 0; sh.topStreak = sh.topStreak ?? 0; sh.topBonuses = sh.topBonuses ?? 0;
    sh.warned = sh.warned ?? false; sh.cancelled = sh.cancelled ?? false;
    sh.boost = sh.boost ?? 0; sh.boostWeeks = sh.boostWeeks ?? 0; sh.ext = sh.ext ?? 0; sh.decayShift = sh.decayShift ?? 0;
    sh.revWeeks = sh.revWeeks ?? sh.airWeeks;
    sh.leads = sh.leads ?? []; sh.location = sh.location ?? null; sh.locMatches = sh.locMatches ?? [];
    // a show already airing in an old save starts its chart history now
    if (sh.weeksAired < sh.airWeeks && sh.hist.length === 0) sh.hist.push(sh.rating);
  }
  if (s.prod) {
    const p = s.prod;
    p.location = p.location ?? null; p.locCost = p.locCost ?? 0; p.locEvent = p.locEvent ?? false; p.locAnnounced = p.locAnnounced ?? false;
  }
  if (!Array.isArray(s.rivals) || s.rivals.length === 0) makeRivals(s);
}

/** fill in v4 fields (economy, plot twists, OST, Ramadan, spin-offs) for older saves */
export function migrateV4(s: GameState) {
  s.equipment = Array.isArray(s.equipment) ? s.equipment : [];
  s.twistLog = s.twistLog && typeof s.twistLog === 'object' ? s.twistLog : {};
  s.twistMock = s.twistMock ?? null;
  s.starOffers = Array.isArray(s.starOffers) ? s.starOffers : [];
  s.starOfferWeek = typeof s.starOfferWeek === 'number' ? s.starOfferWeek : -999;
  s.ramadanSlotYear = s.ramadanSlotYear ?? 0;
  s.ramadanNoticeYear = s.ramadanNoticeYear ?? 0;
  if (!s.ledger || typeof s.ledger !== 'object') s.ledger = { year: dateOf(s.absWeek).year, income: {}, spend: {} };
  s.ledger.income = s.ledger.income ?? {}; s.ledger.spend = s.ledger.spend ?? {};
  for (const st of s.starOffers) { if (typeof st.followers !== 'number') st.followers = 0; if (typeof st.loyalty !== 'number') st.loyalty = 60; }
  for (const sh of s.shows) {
    sh.twists = Array.isArray(sh.twists) ? sh.twists : [];
    sh.twistCd = sh.twistCd ?? 0; sh.tBoost = sh.tBoost ?? 0; sh.tWeeks = sh.tWeeks ?? 0;
    sh.muak = sh.muak ?? 0;
    sh.ost = sh.ost ?? null;
    sh.ramadan = sh.ramadan ?? false;
    sh.parentId = sh.parentId ?? null; sh.franchise = sh.franchise ?? sh.id; sh.part = sh.part ?? 1; sh.spin = sh.spin ?? null;
    sh.fanBase = sh.fanBase ?? 0;
    sh.promoKind = sh.promoKind ?? (sh.boostWeeks > 0 ? 'promo' : null);
    if (!isFinite(sh.revenue)) sh.revenue = 0;
  }
  if (s.prod) {
    const p = s.prod;
    p.ost = p.ost ?? null; p.ostFee = p.ostFee ?? 0;
    p.ramadan = p.ramadan ?? false; p.ramadanPay = p.ramadanPay ?? 0;
    p.parentId = p.parentId ?? null; p.spin = p.spin ?? null; p.honor = p.honor ?? 0;
  }
  if (!isFinite(s.money)) s.money = 0;
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function fmtMoney(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-Rp ' : 'Rp ') + s;
}
export function fmtShort(n: number): string {
  const a = Math.abs(n), sg = n < 0 ? '-' : '';
  if (a >= 1e9) return sg + 'Rp ' + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
  if (a >= 1e6) return sg + 'Rp ' + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.', ',') + ' jt';
  if (a >= 1e3) return sg + 'Rp ' + Math.round(a / 1e3) + ' rb';
  return sg + 'Rp ' + Math.round(a);
}
export function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
