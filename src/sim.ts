// Pure game simulation (no Phaser). Drives time, production, revenue, events.
import {
  GENRES, THEMES, PLATFORMS, EPISODES, BUDGETS, STUDIOS, ROLES, POINT_KEYS, RIVAL_TITLES,
  compat, COMPAT_MULT, criticComment, CRITICS,
  type PointKey, type Stat, type Role,
} from './data';
import {
  TICKS_PER_WEEK, WEEKS_PER_YEAR, makeCandidates, makeJobOffers, rr, ri, pick, dateOf, SELEB_AT, SELEB_TOP, fmtFollowers, fmtShort, fmtNum,
  type GameState, type Staff, type Production, type Show, type RoomId, type Phase, type Pending, type JobOffer,
} from './state';
import { weekRivals, chart, stampRivalRanks, curve, airingIn, TIERS, SAFE_RANK, CANCEL_WEEKS, TOP_WEEKS, RIVAL_PH } from './rating';
import { locById, locCost, locMatches, locUnlocked } from './locations';
import {
  inflation, marketSalary, equipById, equipPointMult, equipFactor, equipUpkeep,
  CAMPAIGN_BASE, CAMPAIGN_BOOST, CAMPAIGN_WEEKS, PROMO_BOOST, PROMO_WEEKS, STAR_AGENCY_FANS, starSignFee,
} from './economy';
import { TWISTS, twistById, twistUnlocked, TWIST_COOLDOWN, TWIST_WEEKS, MUAK_CAP, NETIZEN_HAPPY, NETIZEN_MUAK } from './twists';
import {
  singerById, singerFee, singerFits, isRamadan, weeksToRamadan, RAMADAN_GENRE, RAMADAN_OTHER,
  RAMADAN_SLOT_GENRES, RAMADAN_SLOT_WINDOW, RAMADAN_SLOT_MIN, RAMADAN_SPONSORS, ramadanStart,
} from './ost';
import { makeStar } from './state';
import * as v5 from './v5';
import { checkAchievements, ENDING_WEEK } from './achievements';

export type SimEvent =
  | { type: 'work'; staffId: number; key: PointKey | 'blooper' | 'fix' | 'hype' | 'riset' | 'job'; amount: number }
  | { type: 'week' }
  | { type: 'month'; salaries: number }
  | { type: 'phase'; phase: Phase }
  | { type: 'money'; amount: number; reason: string }
  | { type: 'levelup'; staffId: number }
  | { type: 'toast'; text: string }
  | { type: 'queue' }
  | { type: 'achv'; id: string };

type Listener = (e: SimEvent) => void;

export interface ProdOptions {
  title: string; genre: string; theme: string; platform: string; eps: number; budget: string;
  leadM: number | null; leadF: number | null;
  location?: string | null;
  /** v4: OST singer id */
  ost?: string | null;
  /** v4: book the special Sinetron Ramadan slot */
  ramadan?: boolean;
  /** v4: sequel / spin-off of this show id */
  parentId?: number | null; spin?: 'sekuel' | 'spinoff' | null;
  /** v5: sensor mandiri (fewer KPI teguran points, -5% rating) */
  sensor?: boolean;
}

export interface TwistResult { id: string; eff: number; fit: boolean; muak: number; reaction: string; mocked: boolean }
export interface ProdQuote { base: number; loc: number; honor: number; ost: number; sponsor: number; total: number }

/** rating bonus from a lead's social media following */
export function starBonus(followers: number): number {
  if (followers < 20000) return 0;
  return Math.min(0.15, 0.03 + 0.06 * Math.log10(followers / 20000));
}
const RANK_AD = [1.0, 0.9, 0.8, 0.7, 0.62, 0.55];
/** franchise rating bonus by part number (2 = first sequel); too many sequels backfire */
export function franchiseBonus(part: number): number {
  if (part <= 1) return 0;
  return Math.round((0.3 * Math.pow(0.55, part - 2) - 0.06 * Math.max(0, part - 3)) * 100) / 100;
}

const PHASE_WEEKS = [3, 5, 2];

export class Sim {
  s: GameState;
  private listeners: Listener[] = [];
  constructor(s: GameState) { this.s = s; }

  on(l: Listener) { this.listeners.push(l); }
  off(l: Listener) { this.listeners = this.listeners.filter((x) => x !== l); }
  private emit(e: SimEvent) { for (const l of this.listeners) l(e); }
  /** v5: public toast (used by the v5 systems) */
  toast(text: string) { this.emit({ type: 'toast', text }); }
  /** v5: check achievements now (after player actions); emits one 'achv' event per new unlock */
  checkAch() { for (const id of checkAchievements(this.s)) this.emit({ type: 'achv', id }); }

  get blocked(): boolean { return this.s.queue.length > 0 || this.s.gameOver; }

  push(p: Pending) { this.s.queue.push(p); this.emit({ type: 'queue' }); }

  /** every money change goes through here: balance, yearly ledger (Keuangan screen), HUD popup */
  money(amount: number, reason: string, cat?: string, opts: { revenue?: boolean; quiet?: boolean } = {}) {
    if (!amount || !isFinite(amount)) return;
    const s = this.s;
    s.money += amount;
    if (opts.revenue && amount > 0) s.totalRevenue += amount;
    const L = s.ledger;
    const book = amount > 0 ? L.income : L.spend;
    const k = cat ?? reason;
    book[k] = (book[k] ?? 0) + Math.abs(amount);
    if (!opts.quiet) this.emit({ type: 'money', amount, reason });
  }
  /** Remove the head of the queue (after the UI handled it). */
  shift(): Pending | undefined { return this.s.queue.shift(); }

  studio() { return STUDIOS[this.s.studio - 1]; }
  maxStaff() { return this.studio().maxStaff; }

  // ---------------- costs ----------------
  prodCost(platform: string, eps: number, budget: string): number {
    const p = PLATFORMS.find((x) => x.id === platform)!;
    const b = BUDGETS.find((x) => x.id === budget)!;
    const inf = inflation(dateOf(this.s.absWeek).year);
    return Math.round(((p.baseCost + p.perEp * eps) * b.costMult * inf) / 100000) * 100000;
  }
  /** lead actors' fee for a production (stars cost more) */
  honorCost(leadIds: (number | null)[], eps: number): number {
    const leads = leadIds.map((id) => this.s.staff.find((x) => x.id === id)).filter((x): x is Staff => !!x);
    return Math.round((leads.reduce((a, x) => a + x.salary, 0) * 0.5 * Math.pow(eps / 13, 0.7)) / 100000) * 100000;
  }
  /** full price of a production setup (what the wizard shows) */
  quote(o: ProdOptions): ProdQuote {
    const base = this.prodCost(o.platform, o.eps, o.budget);
    const l = locById(o.location ?? null);
    const loc = l ? locCost(l, o.platform, o.eps) : 0;
    const honor = this.honorCost([o.leadM, o.leadF], o.eps);
    const sg = singerById(o.ost ?? null);
    const ost = sg ? singerFee(sg, o.platform) : 0;
    const sponsor = o.ramadan && !this.canRamadanSlot(o.genre) ? this.ramadanSponsor(base) : 0;
    return { base, loc, honor, ost, sponsor, total: base + loc + honor + ost - sponsor };
  }
  monthlySalaries(): number { return this.s.staff.reduce((a, x) => a + x.salary, 0); }
  /** sewa studio + perawatan alat per month */
  monthlyRunning(): number { return this.studio().rent + equipUpkeep(this.s.equipment); }
  monthlyCosts(): number { return this.monthlySalaries() + this.monthlyRunning(); }
  hireFee(st: Staff): number { return st.salary * 2; }
  marketSalary(st: Staff): number { return marketSalary(st); }
  trainCost(st: Staff): number { return Math.round((800000 + st.level * 400000 + st.salary * 0.3) / 50000) * 50000; }
  treatCost(): number { return 150000 * Math.max(1, this.s.staff.length); }
  genreCost(id: string): number {
    const g = GENRES.find((x) => x.id === id)!;
    return g.unlockCost;
  }

  // ---------------- production ----------------
  canStart(): string | null {
    if (this.s.prod) return 'Masih ada produksi berjalan.';
    if (this.s.job) return 'Staf sedang mengerjakan job sampingan.';
    if (this.s.staff.length === 0) return 'Belum punya staf!';
    return null;
  }

  startProduction(o: ProdOptions): string | null {
    const err = this.canStart();
    if (err) return err;
    if (!GENRES.some((g) => g.id === o.genre) || !THEMES.some((t) => t.id === o.theme)) return 'Konsepnya belum lengkap.';
    if (!this.s.platforms.includes(o.platform)) return 'Belum punya kontrak platform itu.';
    const ep = EPISODES.find((x) => x.eps === o.eps);
    if (!ep || !BUDGETS.some((b) => b.id === o.budget)) return 'Pilihan produksi nggak valid.';
    const loc = locById(o.location ?? null);
    if (loc && !this.locAvailable(loc.id)) return 'Lokasi belum kebuka.';
    const sg = singerById(o.ost ?? null);
    if (sg && this.s.fans < sg.unlockFans) return 'Penyanyinya belum mau, studio kita kurang terkenal.';
    if (o.ramadan) { const re = this.canRamadanSlot(o.genre); if (re) return re; }
    const par = o.parentId != null ? this.s.shows.find((x) => x.id === o.parentId) : undefined;
    if (o.parentId != null) { const pe = this.canSpinoff(par); if (pe) return pe; if (par!.genre !== o.genre || (o.spin === 'sekuel' && par!.theme !== o.theme)) return 'Sekuel harus genre (dan tema) yang sama.'; }
    const q = this.quote(o);
    if (this.s.money < q.total) return 'Uang nggak cukup.';
    const lc = q.loc;
    const cost = q.base + q.loc; // honor, OST fee and sponsor are added to the show's cost at release
    this.money(-(q.base + q.loc), 'Biaya produksi', 'Produksi', { quiet: false });
    if (q.loc) { s_book(this.s, 'Produksi', -q.loc); s_book(this.s, 'Lokasi syuting', q.loc); }
    if (q.honor) this.money(-q.honor, 'Honor pemain', 'Honor pemain', { quiet: true });
    if (q.ost) this.money(-q.ost, 'OST ' + sg!.name, 'OST', { quiet: true });
    if (q.sponsor) { this.money(q.sponsor, 'Sponsor Ramadan', 'Sponsor', { revenue: true }); this.s.ramadanSlotYear = this.ramadanYear(); }
    this.s.prod = {
      title: o.title, genre: o.genre, theme: o.theme, platform: o.platform, eps: o.eps, budget: o.budget,
      leadM: o.leadM, leadF: o.leadF, phase: 'naskah', phaseTick: 0,
      phaseTicks: PHASE_WEEKS.map((w) => Math.round(w * ep.factor * TICKS_PER_WEEK)),
      points: { drama: 0, airmata: 0, komedi: 0, visual: 0 }, bloopers: 0, fixed: 0, hype: 0,
      cost, startWeek: this.s.absWeek, extraEdit: 0,
      location: loc ? loc.id : null, locCost: lc, locEvent: false, locAnnounced: false,
      ost: sg ? sg.id : null, ostFee: q.ost, ramadan: !!q.sponsor, ramadanPay: q.sponsor,
      parentId: par ? par.id : null, spin: par ? (o.spin ?? 'sekuel') : null, honor: q.honor,
      offers: [], placements: [], placementPay: 0, sensor: !!o.sensor,
    };
    v5.initOffers(this.s, this.s.prod);
    // a sequel starts with the old fans already buzzing
    if (par) this.s.prod.hype += Math.min(40, par.total * 0.6 * Math.max(0.2, 1 + franchiseBonus(this.franchisePart(par) + 1)));
    this.emit({ type: 'phase', phase: 'naskah' });
    return null;
  }

  startJob(j: JobOffer): string | null {
    const err = this.canStart();
    if (err) return err;
    this.s.job = { ...j, progress: 0, ticksLeft: j.weeks * TICKS_PER_WEEK };
    this.s.jobOffers = this.s.jobOffers.filter((x) => x.name !== j.name);
    return null;
  }

  // ---------------- Peta: location shoots ----------------
  locAvailable(id: string): boolean {
    const l = locById(id);
    return !!l && locUnlocked(l, this.s.fans, dateOf(this.s.absWeek).year);
  }
  /** can the running production still pick a location? */
  canSetLocation(): string | null {
    const p = this.s.prod;
    if (!p) return null;
    if (p.location) return 'Lokasi syuting sudah dipilih.';
    if (p.phase === 'editing') return 'Syutingnya sudah beres, Bos.';
    if (p.phase === 'syuting' && p.phaseTick > p.phaseTicks[1] * 0.5) return 'Syuting sudah lewat setengah jalan.';
    return null;
  }
  setLocation(id: string): string | null {
    const p = this.s.prod;
    if (!p) return 'Belum ada produksi.';
    const err = this.canSetLocation();
    if (err) return err;
    const l = locById(id);
    if (!l || !this.locAvailable(id)) return 'Lokasi belum kebuka.';
    const c = locCost(l, p.platform, p.eps);
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, 'Lokasi ' + l.short, 'Lokasi syuting');
    p.location = l.id; p.locCost = c; p.cost += c;
    if (p.phase === 'syuting') this.announceTrip(p);
    return null;
  }
  /** staff away on a location shoot (hidden from the studio) */
  onLocation(st: Staff): boolean {
    const p = this.s.prod;
    return !!p && !!p.location && p.phase === 'syuting' && st.role !== 'penulis';
  }
  private announceTrip(p: Production) {
    if (p.locAnnounced) return;
    p.locAnnounced = true;
    const l = locById(p.location)!;
    this.emit({ type: 'toast', text: `Kru berangkat ke ${l.name}! Studio sepi dulu.` });
  }
  private locMult(p: Production, key: PointKey): number {
    const l = locById(p.location);
    if (!l) return 1;
    const m = locMatches(l, p.genre, p.theme).length;
    return (1 + (l.bonus[key] ?? 0)) * (1 + 0.12 * m);
  }

  /** where a staff member wants to be and what they're doing */
  desired(st: Staff): { room: RoomId; activity: 'work' | 'idle' } {
    const p = this.s.prod;
    if (p) {
      const r = st.role;
      const actor = r === 'aktor' || r === 'aktris';
      if (p.phase === 'naskah') {
        if (r === 'penulis' || r === 'sutradara') return { room: 'desk', activity: 'work' };
        if (actor) return { room: 'makeup', activity: 'work' };
        return { room: 'set', activity: 'work' };
      }
      if (p.phase === 'syuting') {
        if (r === 'penulis') return { room: 'desk', activity: 'work' };
        return { room: 'set', activity: 'work' };
      }
      // editing
      if (actor) return { room: 'makeup', activity: 'work' };
      return { room: 'desk', activity: 'work' };
    }
    if (this.s.job) {
      if (st.role === 'penulis') return { room: 'desk', activity: 'work' };
      if (st.role === 'aktor' || st.role === 'aktris') return { room: Math.random() < 0.5 ? 'set' : 'makeup', activity: 'work' };
      return { room: 'set', activity: 'work' };
    }
    return { room: st.room, activity: 'idle' };
  }

  // ---------------- tick ----------------
  tick() {
    if (this.blocked) return;
    const s = this.s;
    for (const st of s.staff) this.staffTick(st);

    const p = s.prod;
    if (p) {
      p.phaseTick++;
      if (p.phaseTick >= p.phaseTicks[this.phaseIndex(p.phase)]) this.advancePhase(p);
    }
    const j = s.job;
    if (j) {
      j.ticksLeft--;
      if (j.ticksLeft <= 0) this.finishJob();
    }

    s.tick++;
    if (s.tick >= TICKS_PER_WEEK) {
      s.tick = 0;
      this.weekTick();
    }
  }

  phaseIndex(ph: Phase) { return ph === 'naskah' ? 0 : ph === 'syuting' ? 1 : 2; }

  private staffTick(st: Staff) {
    // rest logic
    if (st.activity === 'rest') {
      if (st.travel > 0) { st.travel--; return; }
      st.energy = Math.min(100, st.energy + 6);
      if (st.energy >= 95) st.activity = 'idle';
      return;
    }
    if (st.strike && st.strike > 0) {
      // mogok: sulks in the canteen, no work at all
      if (st.room !== 'kantin' || st.activity !== 'idle') { st.room = 'kantin'; st.activity = 'idle'; st.travel = 3; }
      if (st.travel > 0) st.travel--;
      return;
    }
    if (st.energy < 18) {
      if (this.onLocation(st)) { st.activity = 'rest'; st.travel = 0; return; }
      st.activity = 'rest'; st.room = 'kantin'; st.travel = 3;
      return;
    }
    const d = this.desired(st);
    if (d.room !== st.room || d.activity !== st.activity) {
      // idle staff occasionally wander
      if (d.activity === 'idle' && st.activity === 'idle') {
        if (Math.random() < 0.03) { st.room = pick(['set', 'makeup', 'desk', 'kantin'] as RoomId[]); st.travel = 3; }
      } else {
        if (d.room !== st.room) st.travel = 3;
        st.room = d.room; st.activity = d.activity;
      }
    } else if (d.activity === 'idle' && Math.random() < 0.03) {
      st.room = pick(['set', 'makeup', 'desk', 'kantin'] as RoomId[]); st.travel = 3;
    }
    if (st.travel > 0) { st.travel--; return; }
    if (st.activity === 'idle') { st.energy = Math.min(100, st.energy + 0.6); return; }
    // working
    const drain = 1.5 * (50 / (30 + st.stats.stamina));
    st.energy = Math.max(0, st.energy - drain);
    if (Math.random() > 0.55) return;
    if (this.s.prod) this.prodWork(st, this.s.prod);
    else if (this.s.job) this.jobWork(st);
  }

  private mult(st: Staff): number {
    const p = this.s.prod;
    const b = p ? BUDGETS.find((x) => x.id === p.budget)!.workMult : 1;
    const eff = st.energy < 30 ? 0.65 : 1;
    return b * this.studio().workMult * eff;
  }

  private storyKey(genre: string): PointKey {
    const g = GENRES.find((x) => x.id === genre)!;
    const r = Math.random();
    if (r < g.profile.drama) return 'drama';
    if (r < g.profile.drama + g.profile.airmata) return 'airmata';
    return 'komedi';
  }

  private give(st: Staff, key: PointKey, base: number) {
    const p = this.s.prod!;
    let v = Math.max(0.5, base * 0.09 * this.mult(st) * rr(0.6, 1.4));
    if (this.onLocation(st)) v *= this.locMult(p, key);
    v *= equipPointMult(this.s.equipment, key, p.genre);
    v *= v5.traitMult(st, key);
    p.points[key] += v;
    this.emit({ type: 'work', staffId: st.id, key, amount: Math.max(1, Math.round(v)) });
    this.gainExp(st, 1);
    if (Math.random() < 0.02) {
      this.s.rp += 1;
      this.emit({ type: 'work', staffId: st.id, key: 'riset', amount: 1 });
    }
  }

  private prodWork(st: Staff, p: Production) {
    const S = st.stats;
    const r: Role = st.role;
    const isLead = st.id === p.leadM || st.id === p.leadF;
    const actor = r === 'aktor' || r === 'aktris';
    if (p.phase === 'naskah') {
      if (r === 'penulis') this.give(st, this.storyKey(p.genre), S.naskah * 1.2);
      else if (r === 'sutradara') this.give(st, Math.random() < 0.6 ? this.storyKey(p.genre) : 'visual', (S.naskah + S.visual) * 0.45);
      else if (actor) this.give(st, this.storyKey(p.genre), S.akting * 0.4 + S.naskah * 0.3);
      else this.give(st, 'visual', S.visual * 0.5);
    } else if (p.phase === 'syuting') {
      if (actor) {
        this.give(st, this.storyKey(p.genre), S.akting * (isLead ? 1.35 : 1) + S.pesona * 0.25);
        const bChance = 0.22 * Math.max(0.15, 1 - S.akting / 120) * (st.energy < 30 ? 1.6 : 1) * (0.5 + 0.5 * equipFactor(this.s.equipment, 'blooper')) * v5.traitBlooper(st);
        if (Math.random() < bChance) { p.bloopers++; this.emit({ type: 'work', staffId: st.id, key: 'blooper', amount: 1 }); }
      } else if (r === 'sutradara') {
        this.give(st, Math.random() < 0.5 ? 'visual' : this.storyKey(p.genre), (S.visual + S.akting) * 0.55);
        if (p.bloopers > 0 && Math.random() < 0.12) { p.bloopers--; p.fixed++; this.emit({ type: 'work', staffId: st.id, key: 'fix', amount: 1 }); }
      } else if (r === 'kameramen') {
        this.give(st, 'visual', S.visual * 1.1);
        if (Math.random() < 0.06 * Math.max(0.2, 1 - S.visual / 120) * equipFactor(this.s.equipment, 'blooper')) { p.bloopers++; this.emit({ type: 'work', staffId: st.id, key: 'blooper', amount: 1 }); }
      } else {
        this.give(st, this.storyKey(p.genre), S.naskah * 0.5);
      }
    } else {
      if (r === 'kameramen' || r === 'sutradara') {
        if (p.bloopers > 0 && Math.random() < (0.25 + S.visual / 300) * equipFactor(this.s.equipment, 'fix')) {
          p.bloopers--; p.fixed++;
          this.emit({ type: 'work', staffId: st.id, key: 'fix', amount: 1 });
          this.gainExp(st, 1);
        } else this.give(st, 'visual', S.visual * (r === 'kameramen' ? 0.9 : 0.6));
      } else if (actor) {
        const v = S.pesona * 0.08 * rr(0.6, 1.4) * equipFactor(this.s.equipment, 'hype');
        p.hype += v;
        this.emit({ type: 'work', staffId: st.id, key: 'hype', amount: Math.max(1, Math.round(v)) });
        this.gainExp(st, 1);
      } else {
        this.give(st, this.storyKey(p.genre), S.naskah * 0.3);
      }
    }
  }

  private jobWork(st: Staff) {
    const j = this.s.job!;
    const S = st.stats;
    const best = Math.max(S.akting, S.naskah, S.visual);
    const v = Math.max(0.5, best * 0.09 * this.studio().workMult * rr(0.6, 1.4));
    j.progress += v;
    this.emit({ type: 'work', staffId: st.id, key: 'job', amount: Math.max(1, Math.round(v)) });
    this.gainExp(st, 1);
  }

  private finishJob() {
    const j = this.s.job!;
    const ratio = Math.min(1.25, j.progress / j.need);
    const pay = Math.round((j.pay * (0.4 + 0.6 * ratio)) / 100000) * 100000;
    const rp = Math.max(1, Math.round(2 * ratio + j.weeks * 0.5));
    this.money(pay, j.name, 'Job sampingan', { revenue: true });
    this.s.rp += rp;
    this.s.fans += Math.round(50 * ratio);
    this.s.job = null;
    this.push({ kind: 'jobDone', name: j.name, pay, rp });
  }

  gainExp(st: Staff, n: number) {
    st.exp += n;
    const need = 45 + st.level * 30;
    if (st.exp >= need) {
      st.exp -= need;
      this.levelUp(st);
    }
  }
  levelUp(st: Staff) {
    st.level++;
    const def = ROLES[st.role];
    for (const k of Object.keys(st.stats) as Stat[]) {
      st.stats[k] += def.main.includes(k) ? ri(4, 7) : ri(1, 2);
    }
    st.stats.stamina += ri(1, 3);
    // pay follows the market: better & more famous staff cost more every year
    st.salary = Math.round(Math.max(st.salary * 1.04, marketSalary(st) * 0.88) / 50000) * 50000;
    this.emit({ type: 'levelup', staffId: st.id });
  }

  private advancePhase(p: Production) {
    if (p.phase === 'naskah') {
      p.phase = 'syuting'; p.phaseTick = 0; this.emit({ type: 'phase', phase: 'syuting' });
      if (p.location) { this.announceTrip(p); for (const st of this.s.staff) if (this.onLocation(st)) { st.room = 'set'; st.travel = 0; if (st.activity === 'rest') st.activity = 'idle'; } }
    } else if (p.phase === 'syuting') {
      p.phase = 'editing'; p.phaseTick = 0; this.emit({ type: 'phase', phase: 'editing' });
      const l = locById(p.location);
      if (l) {
        this.emit({ type: 'toast', text: `Kru pulang dari ${l.short}, bawa oleh-oleh!` });
        for (const st of this.s.staff) if (st.role !== 'penulis') { st.room = 'set'; st.travel = 0; }
      }
    }
    else {
      p.phaseTick = p.phaseTicks[2];
      if (p.bloopers > 0 && p.extraEdit < 4) this.push({ kind: 'editDone' });
      else this.release();
    }
  }

  /** player chose to extend editing by one week */
  extendEditing() {
    const p = this.s.prod;
    if (!p) return;
    p.extraEdit++;
    p.phaseTicks[2] += TICKS_PER_WEEK;
  }

  // ---------------- release / scoring ----------------
  difficulty(platform: string): number {
    const pl = PLATFORMS.find((x) => x.id === platform)!;
    const n = this.s.shows.length;
    const yr = dateOf(this.s.absWeek).year - 1;
    return pl.toughness * (1 + Math.min(3, n * 0.08) + Math.min(1.5, yr * 0.08));
  }

  release(): Show {
    const s = this.s;
    const p = s.prod!;
    const g = GENRES.find((x) => x.id === p.genre)!;
    const ep = EPISODES.find((x) => x.eps === p.eps)!;
    const pl = PLATFORMS.find((x) => x.id === p.platform)!;
    const cp = compat(p.genre, p.theme);
    const parent = p.parentId != null ? s.shows.find((x) => x.id === p.parentId) : undefined;
    const part = parent ? this.franchisePart(parent) + 1 : 1;
    let wsum = 0, q = 0;
    for (const k of POINT_KEYS) { q += g.weight[k] * p.points[k]; wsum += g.weight[k]; }
    q /= wsum;
    const target = 95 * ep.factor * this.difficulty(p.platform);
    let r = (q / target) * COMPAT_MULT[cp];
    const last = s.shows[s.shows.length - 1];
    let repeat = false;
    if (parent) {
      // a planned sequel isn't "boring repetition", but each extra part feels more stretched out
      if (part >= 3) r *= Math.pow(0.95, part - 2);
    } else if (last && last.genre === p.genre && last.theme === p.theme) { r *= 0.78; repeat = true; }
    else if (last && last.genre === p.genre) r *= 0.93;
    const recent = s.shows.slice(-4);
    if (!repeat && !parent && recent.some((x) => x.genre === p.genre && x.theme === p.theme)) r *= 0.9;
    const base10 = 10 * (1 - Math.exp(-1.05 * r));
    const blooperPen = Math.min(2.5, p.bloopers * 0.18);
    const tot = POINT_KEYS.reduce((a, k) => a + p.points[k], 0) || 1;
    const scores: number[] = [];
    const comments: string[] = [];
    for (const c of CRITICS) {
      const share = p.points[c.fav] / tot;
      const expShare = (g.weight[c.fav] / wsum) * 0.85 + 0.0375;
      let v = base10 - blooperPen + (share - expShare) * 6 + rr(-0.9, 0.9);
      v = Math.max(1, Math.min(10, Math.round(v)));
      scores.push(v);
    }
    scores.forEach((v, i) => comments.push(criticComment(v, Math.random, comments, CRITICS[i].fav)));
    // critics remember the plot twist the studio overused last time
    let mocked: string | null = null;
    if (s.twistMock) {
      const tw = twistById(s.twistMock);
      if (tw) {
        const i = Math.floor(Math.random() * CRITICS.length);
        comments[i] = tw.mock;
        scores[i] = Math.max(1, scores[i] - 1);
        mocked = tw.id;
      }
      s.twistMock = null;
    }
    if (part >= 4) { const i = 0; comments[i] = part >= 5 ? 'Sekuel ke-' + part + '? Udahan dong...' : 'Sekuelnya dipanjang-panjangin'; }
    // v5: chemistry, product placement overload, sensor mandiri, KPI points
    const v5r = v5.releaseMult(s, p);
    if (v5r.plPen > 0) {
      const i = CRITICS.length - 1;
      comments[i] = pick(['Ini sinetron atau katalog iklan?', 'Iklannya lebih banyak dari dialognya', 'Tiap adegan ada produk nongol, pusing']);
      scores[i] = Math.max(1, scores[i] - 1);
    }
    const total = scores.reduce((a, b) => a + b, 0);

    // OST: how big the song gets
    const sg = singerById(p.ost);
    let ost: Show['ost'] = null;
    if (sg) {
      const fit = singerFits(sg, p.genre);
      const power = Math.round((sg.pop / 100) * (fit ? 1.3 : 0.75) * (0.55 + (total / 40) * 0.65) * rr(0.7, 1.3) * 100) / 100;
      const hit = power >= 0.72;
      const viral = power >= 1.0;
      ost = { singer: sg.id, song: pick(sg.songs), power, hit, viral, total: 0 };
    }

    // audience rating
    const fanFactor = 0.55 + 0.45 * Math.min(1, s.fans / pl.fanRef);
    const leads = [p.leadM, p.leadF].map((id) => s.staff.find((x) => x.id === id)).filter((x): x is Staff => !!x);
    const leadBonus = leads.reduce((a, x) => a + x.stats.pesona, 0) / 600;
    const stars = Math.min(0.2, leads.reduce((a, x) => a + starBonus(x.followers), 0));
    const hypeBonus = Math.min(0.3, p.hype / (target * 0.6));
    const ostBonus = ost ? Math.min(0.15, 0.03 + ost.power * 0.08) : 0;
    const fanBase = parent ? franchiseBonus(part) * Math.min(1, parent.total / 32) : 0;
    const trend = s.trend === p.genre;
    let rating = pl.maxRating * Math.pow(total / 40, 1.4) * fanFactor * Math.max(0.5, 1 + leadBonus + hypeBonus + stars + ostBonus + fanBase + (trend ? 0.2 : 0)) * rr(0.95, 1.05) * v5r.mult;
    rating = Math.max(0.4, Math.min(60, rating));
    rating = Math.round(rating * 10) / 10;
    const fansGained = Math.round(rating * pl.fanGain * (total / 24) * (p.eps / 13) ** 0.5);
    const rp = Math.round(total / 3 + (cp === 'great' ? 4 : cp === 'good' ? 2 : 0) + p.eps / 13);
    const show: Show = {
      id: s.nextId++, title: p.title, genre: p.genre, theme: p.theme, platform: p.platform, eps: p.eps,
      scores, comments, total, rating, compat: cp, airWeeks: ep.airWeeks, weeksAired: 0, revenue: 0,
      fansGained, rp, releaseWeek: s.absWeek, hof: total >= 32, cost: p.cost + p.honor + p.ostFee - p.ramadanPay,
      points: { ...p.points }, bloopers: p.bloopers, repeatPenalty: repeat, trendBonus: trend,
      hist: [], ranks: [], rivalHist: [], lowStreak: 0, topStreak: 0, topBonuses: 0, warned: false, cancelled: false,
      boost: 0, boostWeeks: 0, ext: 0, decayShift: 0, revWeeks: ep.airWeeks,
      leads: leads.map((x) => x.id), location: p.location, locMatches: [],
      twists: [], twistCd: 0, tBoost: 0, tWeeks: 0, muak: 0, ost, ramadan: p.ramadan,
      parentId: parent ? parent.id : null, franchise: parent ? parent.franchise ?? parent.id : 0, part, spin: parent ? p.spin : null,
      fanBase, promoKind: null,
      placements: p.placements.length, chem: v5r.chem, gBoost: 0, gWeeks: 0, bPen: 0, bWeeks: 0, slotWeeks: 0,
    };
    if (!parent) show.franchise = show.id;
    void mocked;
    const loc = locById(p.location);
    if (loc) {
      show.locMatches = locMatches(loc, p.genre, p.theme);
      const known = s.locCombos[loc.id] ?? (s.locCombos[loc.id] = []);
      for (const c of show.locMatches) if (!known.includes(c)) known.push(c);
    }
    s.shows.push(show);
    s.fans += fansGained;
    s.rp += rp;
    s.knownCombos[p.genre + '|' + p.theme] = cp;
    // exp for everyone
    for (const st of s.staff) this.gainExp(st, Math.round(total * 1.0));
    // actors get followers (leads most), which can turn them into selebgram
    for (const st of s.staff) {
      const actor = st.role === 'aktor' || st.role === 'aktris';
      const lead = show.leads.includes(st.id);
      const g = lead ? fansGained * rr(0.7, 1.1) * (0.6 + st.stats.pesona / 60) * (total >= 30 ? 1.5 : 1) : fansGained * (actor ? 0.15 : 0.03);
      this.addFollowers(st, g);
      if (lead) st.loyalty = Math.max(0, Math.min(100, st.loyalty + (total >= 28 ? 4 : total < 16 ? -3 : 1)));
    }
    s.prod = null;
    this.push({ kind: 'release', showId: show.id });
    // v5 bookkeeping: stats, netizen timeline, KPI teguran points
    s.stats5.maxRating = Math.max(s.stats5.maxRating, rating);
    s.stats5.epsTotal += show.eps;
    v5.feedRelease(s, show);
    if (v5r.kpi) v5.addKpi(this, v5r.kpi);
    if (ost && ost.viral && sg) {
      const extra = Math.round(fansGained * 0.25 + 200);
      s.fans += extra;
      for (const st of leads) this.addFollowers(st, extra * 2);
      v5.post(s, 'fan', `Lagu "${ost.song}" diputer di kondangan, angkot, sampe pos ronda. Earworm parah!`, '#' + v5.tagName(ost.song));
      this.push({ kind: 'info', title: 'OST VIRAL!', text: `"${ost.song}" - ${sg.name}\n\nLagu OST "${short(show.title, 26)}" diputar di mana-mana: hajatan, angkot, sampai kondangan!\n\n+${extra.toLocaleString('id-ID')} fans, pemasukan RBT & streaming ngalir terus.` });
    }
    return show;
  }

  /** how many parts a show's franchise already has (1 = no sequels yet) */
  franchisePart(sh: Show): number {
    const root = sh.franchise || sh.id;
    return Math.max(1, ...this.s.shows.filter((x) => (x.franchise || x.id) === root).map((x) => x.part || 1));
  }
  /** shows good enough to get a sequel or spin-off */
  spinoffCandidates(): Show[] {
    return this.s.shows.filter((x) => !this.canSpinoff(x)).sort((a, b) => b.total - a.total);
  }
  canSpinoff(sh: Show | undefined): string | null {
    if (!sh) return 'Sinetronnya nggak ketemu.';
    if (!(sh.hof || sh.total >= 30)) return 'Cuma sinetron skor 30+ / Hall of Fame yang bisa dibikin sekuel.';
    if (!this.s.unlockedGenres.includes(sh.genre)) return 'Genrenya belum terbuka.';
    const root = sh.franchise || sh.id;
    const latest = this.s.shows.filter((x) => (x.franchise || x.id) === root).sort((a, b) => (b.part || 1) - (a.part || 1))[0];
    if (latest && latest.id !== sh.id) return 'Bikin lanjutan dari bagian terbarunya aja.';
    if (this.isAiring(sh)) return 'Tunggu tamat dulu, baru bikin lanjutannya.';
    return null;
  }

  /** ad money for one week at a given weekly rating and chart rank */
  revenueAt(sh: Show, rating: number, rank: number): number {
    const pl = PLATFORMS.find((x) => x.id === sh.platform)!;
    const rf = RANK_AD[Math.min(RANK_AD.length - 1, Math.max(0, rank - 1))];
    // v5: ad rates grow a little every year (advertisers pay more as the market grows), so the late game doesn't
    // starve while salaries and production costs keep inflating
    const adInf = 1 + 0.045 * Math.max(0, dateOf(this.s.absWeek).year - 1);
    return Math.round((rating * pl.adRate * rf * adInf * (sh.eps / 13) ** 0.55) / sh.revWeeks / 10000) * 10000;
  }
  /** Ramadan viewing habits for a show (1 = no effect) */
  ramadanMult(sh: Show, absWeek = this.s.absWeek): number {
    if (isRamadan(absWeek)) return sh.ramadan ? 1.45 : RAMADAN_GENRE[sh.genre] ?? RAMADAN_OTHER;
    if (!sh.ramadan) return 1;
    // the Ramadan special: a little buzz while waiting for Ramadan, stale after Lebaran
    const target = ramadanStart(dateOf(sh.releaseWeek + weeksToRamadan(sh.releaseWeek)).year);
    return absWeek < target ? 1.08 : 0.88;
  }
  /** expected rating of a show in its coming week (no randomness) */
  expectedRating(sh: Show, week = this.s.absWeek + 1): number {
    return sh.rating * curve(sh.weeksAired, sh.revWeeks, sh.decayShift)
      * (1 + (sh.boostWeeks > 0 ? sh.boost : 0))
      * (1 + (sh.tWeeks > 0 ? sh.tBoost : 0))
      * (1 - Math.min(MUAK_CAP, sh.muak || 0))
      * this.ramadanMult(sh, week)
      * v5.airMult(sh);
  }
  /** this week's ad money estimate for the HUD */
  weeklyRevenue(sh: Show): number {
    const rank = sh.ranks.length ? sh.ranks[sh.ranks.length - 1] : 2;
    return this.revenueAt(sh, this.expectedRating(sh), rank);
  }
  currentRank(sh: Show): number { return sh.ranks.length ? sh.ranks[sh.ranks.length - 1] : 0; }
  isAiring(sh: Show): boolean { return sh.weeksAired < sh.airWeeks && !sh.cancelled; }

  // ---------------- Perang Rating: player actions ----------------
  promoCost(sh: Show): number {
    const base = { lokal: 1_000_000, nasional: 3_000_000, streaming: 8_000_000 }[sh.platform] ?? 1_000_000;
    return Math.round(Math.max(base, this.weeklyRevenue(sh) * 0.8) / 100000) * 100000;
  }
  canPromo(sh: Show): string | null {
    if (!this.isAiring(sh)) return 'Sinetronnya sudah nggak tayang.';
    if (sh.boostWeeks > 0) return `${sh.promoKind === 'kampanye' ? 'Kampanye' : 'Promo'} masih jalan (${sh.boostWeeks} minggu lagi).`;
    if (sh.airWeeks - sh.weeksAired < 2) return 'Udah mau tamat, sayang duitnya.';
    return null;
  }
  promo(sh: Show): string | null {
    const err = this.canPromo(sh);
    if (err) return err;
    const c = this.promoCost(sh);
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, 'Promo', 'Promo & kampanye');
    sh.boost = PROMO_BOOST; sh.boostWeeks = PROMO_WEEKS; sh.promoKind = 'promo';
    this.s.fans += Math.round(sh.rating * 20);
    return null;
  }
  /** Kampanye Akbar: billboard, artis keliling mal, iklan di semua TV. Big money sink, big boost. */
  campaignCost(sh: Show): number {
    const base = CAMPAIGN_BASE[sh.platform] ?? CAMPAIGN_BASE.lokal;
    return Math.round(Math.max(base * inflation(dateOf(this.s.absWeek).year), this.weeklyRevenue(sh) * 2.6) / 1_000_000) * 1_000_000;
  }
  canCampaign(sh: Show): string | null {
    const e = this.canPromo(sh);
    if (e) return e;
    if (sh.airWeeks - sh.weeksAired < CAMPAIGN_WEEKS) return 'Sisa tayangnya kependekan buat kampanye akbar.';
    if (this.s.studio < 2) return 'Butuh studio Lv2 buat kampanye akbar.';
    return null;
  }
  campaign(sh: Show): string | null {
    const err = this.canCampaign(sh);
    if (err) return err;
    const c = this.campaignCost(sh);
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, 'Kampanye Akbar', 'Promo & kampanye');
    sh.boost = CAMPAIGN_BOOST; sh.boostWeeks = CAMPAIGN_WEEKS; sh.promoKind = 'kampanye';
    const pl = PLATFORMS.find((x) => x.id === sh.platform)!;
    const fans = Math.round(sh.rating * pl.fanGain * 0.25);
    this.s.fans += fans;
    for (const id of sh.leads) { const st = this.s.staff.find((x) => x.id === id); if (st) this.addFollowers(st, fans * 1.5); }
    return null;
  }
  extendCost(sh: Show): number {
    return Math.round(Math.max(sh.cost * 0.5, this.weeklyRevenue(sh) * 3.8) / 100000) * 100000;
  }
  canExtend(sh: Show): string | null {
    if (!this.isAiring(sh)) return 'Sinetronnya sudah nggak tayang.';
    if (this.currentRank(sh) !== 1) return 'Cuma bisa kalau lagi #1 di Tangga Rating.';
    if (sh.ext >= 2) return 'Sudah diperpanjang 2x. Penonton bisa eneg.';
    return null;
  }
  extend(sh: Show): string | null {
    const err = this.canExtend(sh);
    if (err) return err;
    const c = this.extendCost(sh);
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, 'Tambah episode', 'Produksi');
    sh.ext++; sh.airWeeks += 4; sh.eps += 8; sh.decayShift += 2; sh.cost += c;
    return null;
  }

  // ---------------- v4: Kartu Plot Twist ----------------
  twistsUnlocked(): string[] {
    const y = dateOf(this.s.absWeek).year;
    return TWISTS.filter((t) => twistUnlocked(t, this.s.shows.length, y)).map((t) => t.id);
  }
  /** times a card was used in the last year (all shows) */
  twistRecent(id: string): number {
    return (this.s.twistLog[id] ?? []).filter((w) => this.s.absWeek - w < WEEKS_PER_YEAR).length;
  }
  canTwist(sh: Show, id?: string): string | null {
    if (!this.isAiring(sh)) return 'Sinetronnya sudah nggak tayang.';
    if (sh.hist.length === 0) return 'Tunggu tayang minggu pertama dulu.';
    if (sh.airWeeks - sh.weeksAired < 2) return 'Udah mau tamat, twist-nya nggak bakal kerasa.';
    if (sh.twistCd > 0) return `Penulis lagi nyusun twist berikutnya (${sh.twistCd} minggu lagi).`;
    if (id) {
      const t = twistById(id);
      if (!t || !this.twistsUnlocked().includes(id)) return 'Kartu ini belum kebuka.';
    }
    return null;
  }
  /** preview of how a card would land (for the card picker) */
  twistPreview(sh: Show, id: string): { eff: number; fit: boolean; risky: boolean } {
    const t = twistById(id)!;
    const fit = t.fit.includes(sh.genre);
    const n = sh.twists.length;
    const again = sh.twists.includes(id);
    const rec = this.twistRecent(id);
    const eff = t.boost * (fit ? 1.6 : 1) * Math.pow(0.75, n) * (again ? 0.4 : 1) * (rec >= 2 ? 0.6 : rec === 1 ? 0.85 : 1);
    return { eff, fit, risky: n >= 2 || again || rec >= 2 };
  }
  playTwist(sh: Show, id: string): TwistResult | string {
    const err = this.canTwist(sh, id);
    if (err) return err;
    const t = twistById(id)!;
    const pv = this.twistPreview(sh, id);
    const n = sh.twists.length;
    const again = sh.twists.includes(id);
    const rec = this.twistRecent(id);
    let muak = 0;
    if (n >= 2) muak += 0.04 + 0.03 * (n - 2);
    if (again) muak += 0.05;
    if (rec >= 2) muak += 0.03 * (rec - 1);
    muak = Math.round(muak * 100) / 100;
    const eff = Math.round(pv.eff * 100) / 100;
    sh.twists.push(id);
    sh.tBoost = eff; sh.tWeeks = TWIST_WEEKS; sh.twistCd = TWIST_COOLDOWN;
    sh.muak = Math.min(MUAK_CAP, Math.round(((sh.muak || 0) + muak) * 100) / 100);
    (this.s.twistLog[id] ??= []).push(this.s.absWeek);
    this.s.twistLog[id] = this.s.twistLog[id].filter((w) => this.s.absWeek - w < WEEKS_PER_YEAR * 2);
    const mocked = muak > 0;
    if (mocked) this.s.twistMock = id;
    else this.s.fans += Math.round(sh.rating * 8 * (pv.fit ? 1.5 : 1));
    const reaction = mocked ? pick(NETIZEN_MUAK) : pick(NETIZEN_HAPPY);
    // v5: KPI dislikes lebay twists, netizen react on the timeline
    this.s.stats5.twists++;
    v5.feedTwist(this.s, sh, t.name, mocked);
    v5.addKpi(this, 4 + Math.max(0, n - 1) * 2.5 + (['azab', 'siluman', 'hidup', 'ketabrak'].includes(id) ? 3 : 0));
    this.checkAch();
    return { id, eff, fit: pv.fit, muak, reaction, mocked };
  }

  // ---------------- v4: Musim Ramadan ----------------
  isRamadan(): boolean { return isRamadan(this.s.absWeek); }
  weeksToRamadan(): number { return weeksToRamadan(this.s.absWeek); }
  ramadanSponsor(base: number): number { return Math.round((base * 0.35 + 2_000_000) / 100000) * 100000; }
  /** null = the special Sinetron Ramadan slot can be booked for this genre now */
  canRamadanSlot(genre: string): string | null {
    if (!RAMADAN_SLOT_GENRES.includes(genre)) return 'Slot Ramadan cuma buat Religi, Keluarga, atau Azab.';
    const w = this.weeksToRamadan();
    if (this.isRamadan()) return 'Ramadan udah jalan, kelewatan. Siapkan buat tahun depan!';
    if (w > RAMADAN_SLOT_WINDOW) return `Ramadan masih ${Math.ceil(w / 4)} bulan lagi.`;
    if (w < RAMADAN_SLOT_MIN) return 'Mepet banget, sinetronnya nggak keburu jadi.';
    if (this.s.ramadanSlotYear === this.ramadanYear()) return 'Slot Ramadan tahun ini sudah dipakai.';
    return null;
  }
  /** game year of the current / next Ramadan */
  ramadanYear(): number { return dateOf(this.s.absWeek + this.weeksToRamadan()).year; }

  // ---------------- v4: Agensi Bintang & Peralatan ----------------
  refreshStarOffers() {
    const s = this.s;
    const used = new Set(s.staff.map((x) => x.name));
    const q = 1.3 + Math.min(1.8, s.fans / 400000) + (s.studio - 1) * 0.12;
    s.starOffers = [0, 1].map(() => {
      const st = makeStar(s.nextId++, q, used);
      st.followers = Math.round(st.followers * (1.4 + Math.min(2, s.fans / 800000)) / 1000) * 1000;
      st.salary = Math.round(Math.max(st.salary, marketSalary(st)) / 50000) * 50000;
      st.loyalty = 75; // exclusive contract
      return st;
    });
    s.starOfferWeek = s.absWeek;
  }
  canSignStar(): string | null {
    if (this.s.fans < STAR_AGENCY_FANS) return `Agensi baru mau ngobrol kalau fans kita ${STAR_AGENCY_FANS.toLocaleString('id-ID')}.`;
    return null;
  }
  signFee(st: Staff): number { return starSignFee(st); }
  signStar(st: Staff): string | null {
    const s = this.s;
    const e = this.canSignStar();
    if (e) return e;
    if (!s.starOffers.includes(st)) return 'Tawarannya sudah lewat.';
    if (s.staff.length >= this.maxStaff()) return 'Studio penuh! Upgrade studio atau lepas staf dulu.';
    const fee = starSignFee(st);
    if (s.money < fee) return 'Uang nggak cukup.';
    this.money(-fee, 'Kontrak eksklusif', 'Kontrak bintang');
    st.room = 'kantin'; st.activity = 'idle'; st.travel = 0;
    s.staff.push(st);
    s.starOffers = s.starOffers.filter((x) => x !== st);
    return null;
  }
  canBuyEquip(id: string): string | null {
    const e = equipById(id);
    if (!e) return 'Barangnya nggak ada.';
    if (this.s.equipment.includes(id)) return 'Sudah punya.';
    if (this.s.studio < e.needStudio) return `Butuh studio Lv${e.needStudio}.`;
    if (this.s.fans < e.needFans) return `Butuh ${e.needFans.toLocaleString('id-ID')} fans.`;
    return null;
  }
  buyEquip(id: string): string | null {
    const err = this.canBuyEquip(id);
    if (err) return err;
    const e = equipById(id)!;
    const c = Math.round(e.cost * inflation(dateOf(this.s.absWeek).year) / 1_000_000) * 1_000_000;
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, e.name, 'Peralatan');
    this.s.equipment.push(id);
    return null;
  }
  equipPrice(id: string): number { const e = equipById(id); return e ? Math.round(e.cost * inflation(dateOf(this.s.absWeek).year) / 1_000_000) * 1_000_000 : 0; }

  addFollowers(st: Staff, n: number) {
    const before = st.followers;
    st.followers = Math.max(0, Math.round(st.followers + n));
    const actor = st.role === 'aktor' || st.role === 'aktris';
    if (!actor || !this.s.staff.includes(st)) return;
    const crossed = (t: number) => before < t && st.followers >= t;
    if (crossed(SELEB_AT) || crossed(SELEB_TOP)) {
      this.emit({ type: 'toast', text: `${st.name} sekarang ${st.followers >= SELEB_TOP ? 'SELEB PAPAN ATAS' : 'SELEBGRAM'}! (${fmtFollowers(st.followers)} followers)` });
      // fame goes to their head: a raise request follows
      this.push({ kind: 'event', eventId: 'gaji', data: { staffId: st.id, amount: Math.round((st.salary * 0.3) / 50000) * 50000, seleb: 1 } });
    }
  }

  // ---------------- Perang Rating: weekly chart ----------------
  private ratingWeek(): number {
    const s = this.s;
    stampRivalRanks(s); // last week's positions -> arrows on this week's chart
    const hits = weekRivals(s);
    const mult = s.rivalMult ?? 1;
    if (mult !== 1) for (const r of s.rivals) r.rating = Math.max(0.1, Math.round(r.rating * mult * 10) / 10);
    const airing = s.shows.filter((x) => this.isAiring(x));
    for (const r of hits) {
      if (airing.some((x) => x.platform === r.tier)) this.emit({ type: 'toast', text: `Saingan baru! "${r.title}" (${r.station}) langsung meledak.` });
    }
    // this week's rating of each airing show
    for (const sh of airing) {
      let r = this.expectedRating(sh, s.absWeek) * rr(0.93, 1.07);
      r = Math.max(0.2, Math.round(r * 10) / 10);
      sh.hist.push(r);
      if (sh.boostWeeks > 0) { sh.boostWeeks--; if (sh.boostWeeks === 0) { sh.boost = 0; sh.promoKind = null; } }
      if (sh.tWeeks > 0) { sh.tWeeks--; if (sh.tWeeks === 0) sh.tBoost = 0; }
      if (sh.twistCd > 0) sh.twistCd--;
      v5.airTick(sh);
    }
    let income = 0;
    for (const tier of TIERS) {
      const mine = airingIn(s, tier).filter((x) => airing.includes(x));
      if (!mine.length) continue;
      const c = chart(s, tier);
      const lead = c.find((x) => !x.mine);
      for (const sh of mine) {
        const row = c.find((x) => x.showId === sh.id)!;
        const prev = sh.ranks.length ? sh.ranks[sh.ranks.length - 1] : 0;
        sh.ranks.push(row.rank);
        if (row.rank === 1 && !s.stats5.rank1.includes(tier)) s.stats5.rank1.push(tier);
        if (row.rank <= 3 && this.isRamadan() && dateOf(s.absWeek).week === 4) s.stats5.ramadanTop++;
        sh.rivalHist.push(lead ? lead.rating : 0);
        const r = sh.hist[sh.hist.length - 1];
        const v = this.revenueAt(sh, r, row.rank);
        sh.revenue += v; income += v;
        const pl = PLATFORMS.find((x) => x.id === sh.platform)!;
        s.fans += Math.round(r * pl.fanGain * 0.04);
        for (const id of sh.leads) { const st = s.staff.find((x) => x.id === id); if (st) this.addFollowers(st, r * pl.fanGain * 0.05); }
        if (prev && prev !== row.rank) {
          const t = short(sh.title, 22);
          this.emit({ type: 'toast', text: row.rank < prev ? `"${t}" naik ke #${row.rank} Tangga Rating!` : `"${t}" turun ke #${row.rank}...` });
        }
        this.rankRules(sh, row.rank, v, lead ? lead.rating : 0);
      }
    }
    return income;
  }

  private rankRules(sh: Show, rank: number, weekMoney: number, leader: number) {
    const s = this.s;
    const w = sh.weeksAired; // weeks aired before this one
    const left = sh.airWeeks - w - 1;
    // stations only lose patience early in a run, with a clear gap to the leader; Hall of Fame shows are untouchable
    const cur = sh.hist[sh.hist.length - 1];
    const counts = w < Math.ceil(sh.revWeeks * 0.75) && left >= 2 && !sh.hof && cur < leader * 0.9;
    if (rank > SAFE_RANK && counts) sh.lowStreak++;
    else if (rank <= SAFE_RANK) { sh.lowStreak = 0; sh.warned = false; }
    const idx = s.shows.indexOf(sh);
    const rookie = idx < 2; // the first two shows get some patience
    if (sh.lowStreak >= CANCEL_WEEKS && !rookie) {
      sh.cancelled = true;
      sh.airWeeks = w + 1;
      const lost = Math.round(s.fans * 0.03);
      s.fans = Math.max(0, s.fans - lost);
      for (const id of sh.leads) { const st = s.staff.find((x) => x.id === id); if (st) st.loyalty = Math.max(0, st.loyalty - 6); }
      this.push({ kind: 'rating', showId: sh.id, type: 'cancel', money: 0, fans: lost });
      v5.post(s, 'news', `"${short(sh.title, 24)}" resmi DISTOP stasiun TV. Rating-nya jeblok terus.`, '#' + v5.tagName(sh.title));
      return;
    }
    if (sh.lowStreak === CANCEL_WEEKS - 1 && !sh.warned) {
      sh.warned = true;
      this.push({ kind: 'rating', showId: sh.id, type: 'warn', money: 0, fans: 0 });
      if (rookie) sh.lowStreak = 0; // rookie: a warning, no axe
    }
    if (rank === 1) {
      sh.topStreak++;
      if (sh.topStreak % TOP_WEEKS === 0 && sh.topBonuses < 2) {
        sh.topBonuses++;
        const pl = PLATFORMS.find((x) => x.id === sh.platform)!;
        const money = Math.round((weekMoney * (sh.topBonuses === 1 ? 0.7 : 0.35)) / 100000) * 100000;
        const fans = Math.round(sh.hist[sh.hist.length - 1] * pl.fanGain * (sh.topBonuses === 1 ? 0.35 : 0.2) + s.fans * 0.004);
        this.money(money, 'Bonus stasiun', 'Bonus stasiun', { revenue: true, quiet: true }); s.fans += fans;
        for (const id of sh.leads) { const st = s.staff.find((x) => x.id === id); if (st) { this.addFollowers(st, fans * 0.8); st.loyalty = Math.min(100, st.loyalty + 3); } }
        this.push({ kind: 'rating', showId: sh.id, type: 'top', money, fans });
        v5.post(s, 'news', `"${short(sh.title, 24)}" bertahan di PUNCAK Tangga Rating ${TOP_WEEKS * sh.topBonuses} minggu! Stasiun kasih bonus.`, '#' + v5.tagName(sh.title));
      }
    } else sh.topStreak = 0;
  }

  // ---------------- debug hooks (tests) ----------------
  debugRivals(mult: number) { this.s.rivalMult = mult; }
  debugFollowers(staffId: number, n: number) { const st = this.s.staff.find((x) => x.id === staffId); if (st) st.followers = n; }
  dibajakEvent(st: Staff): Pending {
    return { kind: 'event', eventId: 'dibajak', data: { staffId: st.id, raise: Math.round((st.salary * 0.5) / 50000) * 50000, fee: Math.round((st.salary * 3) / 100000) * 100000, ph: pick(RIVAL_PH) } };
  }

  // ---------------- weekly ----------------
  private weekTick() {
    const s = this.s;
    s.absWeek++;
    // airing revenue + the weekly rating war
    const wasAiring = s.shows.filter((x) => this.isAiring(x));
    const income = this.ratingWeek();
    for (const sh of wasAiring) {
      sh.weeksAired++;
      if (sh.weeksAired >= sh.airWeeks && !sh.cancelled) this.push({ kind: 'airEnd', showId: sh.id });
    }
    if (income > 0) this.money(income, 'Iklan', 'Iklan', { revenue: true });
    // OST royalties (RBT & streaming) while the show airs, plus a tail after a hit
    let rbt = 0;
    for (const sh of s.shows) {
      if (!sh.ost) continue;
      const sg = singerById(sh.ost.singer);
      if (!sg) continue;
      const since = s.absWeek - sh.releaseWeek;
      const tail = sh.ost.hit ? sh.revWeeks + (sh.ost.viral ? 10 : 4) : sh.revWeeks;
      if (since > tail || (sh.cancelled && since > sh.weeksAired + 2)) continue;
      const fee = singerFee(sg, sh.platform);
      const total = fee * sh.ost.power * (sh.ost.viral ? 2.1 : sh.ost.hit ? 1.35 : 0.45);
      const v = Math.round(total / tail / 10000) * 10000;
      if (v > 0) { rbt += v; sh.ost.total += v; sh.revenue += v; }
    }
    if (rbt > 0) this.money(rbt, 'RBT & streaming OST', 'OST (RBT)', { revenue: true, quiet: true });
    const d = dateOf(s.absWeek);
    // year rollover of the finance ledger
    if (s.ledger.year !== d.year) s.ledger = { year: d.year, income: {}, spend: {}, last: { year: s.ledger.year, income: s.ledger.income, spend: s.ledger.spend } };
    // Ramadan is coming: one heads-up a month before, and a toast when it starts
    const wr = this.weeksToRamadan();
    if (wr === 4 && s.ramadanNoticeYear !== this.ramadanYear()) {
      s.ramadanNoticeYear = this.ramadanYear();
      this.emit({ type: 'toast', text: `Bulan depan Ramadan! Sinetron Religi & Keluarga bakal laris. Slot Sinetron Ramadan kebuka.` });
    }
    if (wr === 0 && d.week === 1) this.emit({ type: 'toast', text: 'Marhaban ya Ramadan! Penonton sahur & ngabuburit depan TV.' });
    // month start: salaries + running costs
    if (d.week === 1) {
      const sal = this.monthlySalaries();
      const run = this.monthlyRunning();
      this.money(-sal, 'Gaji', 'Gaji staf');
      this.money(-run, 'Sewa & listrik', 'Sewa & perawatan', { quiet: true });
      // v5: living on debt costs money (bank interest on a negative balance)
      if (s.money < 0) this.money(-Math.round((Math.abs(s.money) * 0.07 + 2_000_000) / 100000) * 100000, 'Bunga utang', 'Bunga utang', { quiet: true });
      this.emit({ type: 'month', salaries: sal });
      s.candidates = makeCandidates(s);
      // underpaid stars sulk (and become easier to poach)
      for (const st of s.staff) if (st.salary < marketSalary(st) * 0.7) st.loyalty = Math.max(0, st.loyalty - 3);
      if (s.absWeek - s.starOfferWeek >= 12 && s.fans >= STAR_AGENCY_FANS * 0.6) this.refreshStarOffers();
      for (const st of s.staff) st.loyalty = Math.round(st.loyalty + (60 - st.loyalty) * 0.08);
      // rival studios sniff around popular stars
      const prey = s.staff.filter((x) => (x.role === 'aktor' || x.role === 'aktris') && (x.followers >= 50000 || x.star));
      if (prey.length && s.absWeek - s.lastEventWeek >= 3) {
        const st = pick(prey);
        if (Math.random() < 0.07 + (60 - st.loyalty) * 0.004) { s.lastEventWeek = s.absWeek; this.push(this.dibajakEvent(st)); }
      }
      if (s.jobOffers.length < 3 || Math.random() < 0.5) s.jobOffers = makeJobOffers(this.monthlyCosts() / 9_000_000);
      if (d.month % 3 === 1) {
        const un = s.unlockedGenres;
        s.trend = Math.random() < 0.6 ? pick(un) : pick(GENRES).id;
        this.emit({ type: 'toast', text: 'Lagi tren: ' + GENRES.find((x) => x.id === s.trend)!.name + '!' });
      }
    }
    // year end award (first week of new year) - before the debt check so the prize counts
    if (s.absWeek % WEEKS_PER_YEAR === 0) this.award(d.year - 1);
    if (d.week === 1) {
      // bankruptcy check
      if (s.money < 0) {
        s.debtWeeks += 4;
        const months = Math.round(s.debtWeeks / 4);
        // v5: the bank also seizes the studio when the debt gets too deep for too long (3+ months, > 3x monthly costs)
        if (months >= 6 || (months >= 3 && -s.money > this.monthlyCosts() * 3)) { s.gameOver = true; this.push({ kind: 'gameover' }); }
        else if (months === 1 || months >= 4 || -s.money > this.monthlyCosts() * 2) this.push({ kind: 'warning', months });
      } else s.debtWeeks = 0;
    }
    // location shoot mishaps (at most one per production)
    const pr = s.prod;
    if (pr && pr.location && pr.phase === 'syuting' && !pr.locEvent && !s.gameOver && Math.random() < 0.3) {
      pr.locEvent = true;
      s.lastEventWeek = s.absWeek; // no second popup the same week
      this.push({ kind: 'event', eventId: 'lokasi', data: { kind: pick(['hujan', 'nyasar', 'warga', 'hujan', 'nyasar']), loc: pr.location, cost: Math.round((400_000 + pr.locCost * 0.15) / 100000) * 100000 } });
    }
    // v5: infotainment never sleeps - a gossip about one of our actors now and then (on top of the random events)
    if (!s.gameOver && s.shows.length > 0 && s.queue.length === 0 && Math.random() < 0.035 + 0.02 * s.staff.filter((x) => x.trait === 'drama').length) { const g = v5.makeGosip(this); if (g) { this.push(g); s.lastEventWeek = s.absWeek; } }
    // random events
    if (!s.gameOver && s.absWeek - s.lastEventWeek >= (this.isRamadan() ? 2 : 5) && Math.random() < (this.isRamadan() ? 0.45 : 0.13)) this.randomEvent();
    // v5: strikes end, netizen anger fades / boils over, KPI meter slowly cools, timeline chatter, ending, achievements
    for (const st of s.staff) if (st.strike && st.strike > 0) { st.strike--; if (st.strike === 0) this.emit({ type: 'toast', text: `${st.name} udah baikan, balik kerja lagi.` }); }
    if (!s.gameOver) {
      v5.boikotWeek(this);
      if (s.kpi > 0) s.kpi = Math.max(0, Math.round((s.kpi - 0.8) * 10) / 10);
      if (s.kpi < 25 && s.kpiStage > 0) s.kpiStage = 0;
      v5.feedWeekly(this);
      if (s.money < 0) s.stats5.debtSeen++;
      if (s.absWeek >= ENDING_WEEK && !s.endingSeen) { s.endingSeen = true; this.push({ kind: 'ending' }); }
    }
    this.checkAch();
    this.emit({ type: 'week' });
  }

  private award(year: number) {
    const s = this.s;
    const mine = s.shows.filter((x) => dateOf(x.releaseWeek).year === year);
    const best = mine.sort((a, b) => b.total - a.total)[0];
    const rivalScore = Math.min(38, Math.round(21 + year * 2.5 + rr(-2, 3)));
    const won = !!best && best.total >= rivalScore;
    const prize = won ? 10_000_000 * year : 0;
    const fans = won ? 3000 * year : 0;
    if (won) { this.money(prize, 'Hadiah piala', 'Hadiah & bonus', { quiet: true }); s.fans += fans; s.trophies++; s.rp += 5; v5.post(s, 'news', `SELAMAT! "${short(best!.title, 26)}" menang Sinetron Terbaik Tahun ${year}!`, '#AnugerahSinetron'); }
    s.awards.push({ year, title: best ? best.title : null, won });
    this.push({ kind: 'award', year, title: best ? best.title : null, score: best ? best.total : 0, rival: pick(RIVAL_TITLES), rivalScore, won, prize, fans });
  }

  // ---------------- random events ----------------
  private randomEvent() {
    const s = this.s;
    const opts: Pending[] = [];
    const st = s.staff.length ? pick(s.staff) : null;
    const selebs = s.staff.filter((x) => (x.role === 'aktor' || x.role === 'aktris') && x.followers >= 30000);
    // popular stars ask for raises (and get into trouble) more often
    const demander = selebs.length && Math.random() < 0.6 ? pick(selebs) : st;
    if (demander) opts.push({ kind: 'event', eventId: 'gaji', data: { staffId: demander.id, amount: Math.round((demander.salary * (selebs.includes(demander) ? 0.3 : 0.2)) / 50000) * 50000 } });
    if (s.fans > 200 || s.shows.length > 0) opts.push({ kind: 'event', eventId: 'viral', data: { fans: Math.round(300 + s.fans * 0.08) } });
    // v5: gossip & infotainment (replaces the old one-off scandal) + rewel / mogok stars
    if (s.shows.length > 0) { const g = v5.makeGosip(this); if (g) opts.push(g, g); }
    { const r = v5.rewelEvent(this); if (r) opts.push(r); }
    if (selebs.length) {
      const e = selebs.sort((a, b) => b.followers - a.followers)[0];
      opts.push({ kind: 'event', eventId: 'endorse', data: { staffId: e.id, pay: Math.round(Math.min(60_000_000, 1_000_000 + e.followers * 25) / 100000) * 100000 } });
      const prey = pick(selebs);
      if (prey.followers >= 50000 || prey.star) { opts.push(this.dibajakEvent(prey)); if (prey.loyalty < 50) opts.push(this.dibajakEvent(prey)); }
    }
    if (s.prod && s.prod.phase !== 'editing') { const o = v5.makeOffer(s, s.prod, [...s.prod.placements, ...s.prod.offers.map((x) => x.id)]); if (o) opts.push({ kind: 'event', eventId: 'placement', data: { id: o.id, pay: o.pay } }); }
    if (s.prod && s.prod.phase === 'syuting') opts.push({ kind: 'event', eventId: 'hujan', data: {} });
    opts.push({ kind: 'event', eventId: 'rt', data: { cost: 500_000 } });
    opts.push({ kind: 'event', eventId: 'ide', data: { rp: ri(2, 4) } });
    if (st) opts.push({ kind: 'event', eventId: 'semangat', data: { staffId: st.id } });
    const unknown = this.hintCombo();
    if (unknown) opts.push({ kind: 'event', eventId: 'bisikan', data: unknown });
    if (this.isRamadan()) {
      // sahur-time & ngabuburit events dominate the month
      const sahur: Pending = { kind: 'event', eventId: 'sahur', data: { cost: Math.round((80_000 * Math.max(4, s.staff.length)) / 10000) * 10000 } };
      opts.push(sahur, sahur, sahur);
      opts.push({ kind: 'event', eventId: 'ngabuburit', data: { cost: 1_000_000, fans: Math.round(150 + s.fans * 0.015) } });
      opts.push({ kind: 'event', eventId: 'bukber', data: { pay: Math.round((2_000_000 + s.fans * 40) / 100000) * 100000, brand: pick(RAMADAN_SPONSORS) } });
    }
    s.lastEventWeek = s.absWeek;
    this.push(pick(opts));
  }

  hintCombo(): { genre: string; theme: string } | null {
    const s = this.s;
    const cands: { genre: string; theme: string }[] = [];
    for (const g of GENRES) for (const t of THEMES) {
      if (compat(g.id, t.id) === 'great' && !s.knownCombos[g.id + '|' + t.id]) cands.push({ genre: g.id, theme: t.id });
    }
    return cands.length ? pick(cands) : null;
  }

  /** Apply an event choice. Returns result text. */
  resolveEvent(ev: { eventId: string; data: Record<string, number | string> }, choice: number): string {
    const s = this.s;
    const d = ev.data;
    const st = typeof d.staffId === 'number' ? s.staff.find((x) => x.id === d.staffId) : undefined;
    switch (ev.eventId) {
      case 'gaji':
        if (!st) return 'Eh, orangnya udah nggak ada.';
        if (choice === 0) { st.salary += Number(d.amount); st.energy = 100; st.loyalty = Math.min(100, st.loyalty + 8); for (const k of ROLES[st.role].main) st.stats[k] += 2; return `${st.name} senang banget! Semangat kerja naik.`; }
        st.energy = Math.max(0, st.energy - 50); st.loyalty = Math.max(0, st.loyalty - 10); return `${st.name} cemberut... energi & loyalitasnya anjlok.`;
      case 'viral': {
        s.fans += Number(d.fans);
        const on = s.shows.filter((x) => this.isAiring(x)).pop();
        if (on) {
          on.boost = Math.max(on.boostWeeks > 0 ? on.boost : 0, 0.2); on.boostWeeks = Math.max(on.boostWeeks, 2); on.promoKind = on.promoKind ?? 'promo';
          for (const id of on.leads) { const x = s.staff.find((y) => y.id === id); if (x) this.addFollowers(x, Number(d.fans) * 2); }
          return `Fans bertambah ${d.fans}! Rating "${short(on.title, 20)}" ikut kedongkrak 2 minggu.`;
        }
        return `Fans bertambah ${d.fans}!`;
      }
      case 'endorse': {
        if (!st) return 'Brand-nya batal. Yah.';
        const pay = Number(d.pay);
        const take = choice === 0 ? 0.5 : choice === 1 ? 0.7 : 0;
        const got = Math.round((pay * take) / 100000) * 100000;
        if (got > 0) this.money(got, 'Endorse', 'Endorse', { revenue: true });
        if (choice === 0) { st.loyalty = Math.min(100, st.loyalty + 5); return `Adil! Studio dapat ${fmtShort(got)}, ${st.name} senyum lebar.`; }
        if (choice === 1) { st.loyalty = Math.max(0, st.loyalty - 12); return `Studio dapat ${fmtShort(got)}. ${st.name} agak manyun... loyalitas turun.`; }
        st.loyalty = Math.min(100, st.loyalty + 15); this.addFollowers(st, st.followers * 0.05);
        return `${st.name} terharu! "Bos terbaik sedunia!" Loyalitas naik banyak.`;
      }
      case 'dibajak': {
        if (!st) return 'Eh, orangnya udah nggak ada.';
        if (choice === 0) {
          st.salary += Number(d.raise); st.loyalty = Math.min(100, st.loyalty + 20);
          return `${st.name} bertahan! "Makasih Bos, aku nggak ke mana-mana."`;
        }
        if (choice === 1) {
          const fee = Number(d.fee);
          this.money(fee, 'Kompensasi', 'Kompensasi transfer');
          this.fire(st);
          return `${st.name} pamit ke ${d.ph}. Studio dapat kompensasi ${fmtShort(fee)}.`;
        }
        const chance = 0.15 + (st.loyalty / 100) * 0.7;
        if (Math.random() < chance) { st.loyalty = Math.min(100, st.loyalty + 10); return `Ngobrol dari hati berhasil! ${st.name} nolak tawaran ${d.ph}.`; }
        const lost = Math.round(s.fans * 0.02);
        s.fans = Math.max(0, s.fans - lost);
        this.fire(st);
        return `Gagal... ${st.name} tetap pindah ke ${d.ph}. Netizen heboh, fans berkurang ${lost}.`;
      }
      case 'lokasi': {
        const l = locById(String(d.loc));
        const p = s.prod;
        const where = l ? l.short : 'lokasi';
        if (d.kind === 'hujan') {
          if (choice === 0) { if (p) p.phaseTicks[1] += Math.round(TICKS_PER_WEEK * 0.5); for (const x of s.staff) x.energy = Math.min(100, x.energy + 25); return `Kru neduh di warung sambil ngopi. Syuting mundur beberapa hari.`; }
          if (p) { p.points.drama += 5; p.points.airmata += 4; p.bloopers += 2; }
          return `Adegan hujan-hujanan di ${where}! Dramatis, tapi ada blooper kepeleset.`;
        }
        if (d.kind === 'nyasar') {
          if (choice === 0) { this.money(-Number(d.cost), 'Ojek', 'Lain-lain'); return 'Ojek pangkalan datang menyelamatkan. Aman!'; }
          for (const x of s.staff) if (this.onLocation(x)) x.energy = Math.max(0, x.energy - 30);
          return 'Kru jalan kaki 5 km... capek parah, energi anjlok.';
        }
        // warga
        if (choice === 0) { if (p) p.hype += 6; s.fans += 150; return `Warga ${where} heboh foto bareng. Hype naik!`; }
        if (p) p.points.visual += 3;
        return 'Syuting lanjut dengan tenang. Gambar makin rapi.';
      }
      case 'skandal':
        if (st && st.followers >= 30000) this.addFollowers(st, st.followers * (choice === 0 ? -0.02 : rr(-0.1, 0.15)));
        if (choice === 0) { this.money(-Number(d.cost), 'Klarifikasi', 'Lain-lain'); s.fans += Math.round(s.fans * 0.02); return 'Konferensi pers sukses, netizen luluh!'; }
        if (Math.random() < 0.4) { s.fans += Math.round(s.fans * 0.06) + 100; return 'Plot twist! Skandalnya malah bikin makin terkenal.'; }
        s.fans = Math.max(0, Math.round(s.fans * 0.9)); return 'Netizen ngamuk... fans berkurang 10%.';
      case 'sponsor':
        if (choice === 0) {
          this.money(Number(d.pay), 'Sponsor', 'Sponsor', { revenue: true });
          if (s.prod) { s.prod.points.komedi += 4; s.prod.points.drama = Math.max(0, s.prod.points.drama - 3); }
          return 'Adegan minum teh botol 30 detik masuk naskah. Lumayan!';
        }
        return 'Idealisme terjaga. Penonton menghargai.';
      case 'hujan':
        if (s.prod) s.prod.phaseTicks[1] += TICKS_PER_WEEK;
        if (choice === 0) { for (const x of s.staff) x.energy = Math.min(100, x.energy + 30); return 'Semua ngopi dan istirahat. Syuting mundur seminggu.'; }
        if (s.prod) { s.prod.points.airmata += 6; s.prod.points.drama += 4; }
        return 'Syuting adegan hujan-hujanan! Dramatis banget.';
      case 'rt':
        if (choice === 0) { this.money(-Number(d.cost), 'Sumbangan', 'Lain-lain'); s.fans += 80; return 'Warga senang, nama studio harum.'; }
        return 'Pak RT manyun. Ya sudahlah.';
      case 'ide':
        s.rp += Number(d.rp); return `+${d.rp} Poin Riset!`;
      case 'semangat':
        if (st) { st.energy = 100; this.gainExp(st, 30); return `${st.name} dapat pencerahan! EXP naik.`; }
        return 'Mantap.';
      case 'bisikan':
        s.knownCombos[String(d.genre) + '|' + String(d.theme)] = 'great';
        return 'Dicatat di Catatan Combo!';
      case 'sahur':
        if (choice === 0) {
          this.money(-Number(d.cost), 'Sahur bareng', 'Lain-lain');
          for (const x of s.staff) { x.energy = Math.min(100, x.energy + 25); x.loyalty = Math.min(100, x.loyalty + 3); }
          return 'Nasi padang jam 3 pagi! Kru kenyang, semangat, dan makin sayang studio.';
        }
        for (const x of s.staff) x.energy = Math.max(0, x.energy - 12);
        return 'Kru sahur mi instan seadanya... agak lemes siangnya.';
      case 'ngabuburit': {
        const on = s.shows.filter((x) => this.isAiring(x)).pop();
        if (choice === 0) {
          this.money(-Number(d.cost), 'Bagi takjil', 'Lain-lain');
          s.fans += Number(d.fans);
          if (on) { on.boost = Math.max(on.boostWeeks > 0 ? on.boost : 0, 0.12); on.boostWeeks = Math.max(on.boostWeeks, 1); on.promoKind = on.promoKind ?? 'promo'; }
          return `Artis bagi takjil di lampu merah, viral! +${fmtNum(Number(d.fans))} fans.`;
        }
        return 'Kru ngabuburit main petasan di parkiran. Dimarahin satpam.';
      }
      // ---- v5 ----
      case 'gosip': return v5.resolveGosip(this, d, choice);
      case 'boikot': return v5.resolveBoikot(this, d, choice);
      case 'rewel': return v5.resolveRewel(this, d, choice);
      case 'mogok': return v5.resolveMogok(this, d, choice);
      case 'kpi': return v5.resolveKpi(this, d, choice);
      case 'placement': {
        const p = s.prod;
        if (!p) return 'Produksinya sudah beres, sponsornya pamit.';
        if (choice === 0) {
          p.offers.push({ id: String(d.id), pay: Number(d.pay) });
          const err = v5.acceptOffer(this, String(d.id));
          if (err) return err;
          const sp = v5.sponsorById(String(d.id));
          const w = v5.placementWeight({ genre: p.genre, placements: p.placements });
          return `${sp?.name ?? 'Sponsor'} masuk naskah: "${sp?.line ?? ''}"${w > v5.PLACEMENT_SAFE ? '\n\nAwas, netizen mulai protes kebanyakan iklan!' : ''}`;
        }
        return 'Ditolak halus. Idealisme terjaga!';
      }
      case 'bukber':
        if (choice === 0) {
          this.money(Number(d.pay), 'Sponsor bukber', 'Sponsor', { revenue: true });
          if (s.prod) s.prod.hype += 4;
          return `${d.brand} bayar buka bersama + iklan 1 menit. Kolak gratis!`;
        }
        return 'Bukber sederhana aja, gorengan dan es teh. Tetap hangat.';
    }
    return 'OK';
  }

  // ---------------- management actions ----------------
  hire(c: Staff): string | null {
    const s = this.s;
    if (s.staff.length >= this.maxStaff()) return 'Studio penuh! Upgrade studio dulu.';
    if (!s.candidates.includes(c) || s.staff.some((x) => x.id === c.id)) return 'Kandidatnya sudah nggak tersedia.';
    const fee = this.hireFee(c);
    if (s.money < fee) return 'Uang nggak cukup.';
    this.money(-fee, 'Kontrak', 'Rekrut staf');
    c.room = 'kantin'; c.activity = 'idle'; c.travel = 0;
    s.staff.push(c);
    s.candidates = s.candidates.filter((x) => x.id !== c.id);
    return null;
  }
  fire(st: Staff) {
    const s = this.s;
    s.staff = s.staff.filter((x) => x.id !== st.id);
    if (s.prod) { if (s.prod.leadM === st.id) s.prod.leadM = null; if (s.prod.leadF === st.id) s.prod.leadF = null; }
  }
  train(st: Staff, stat: Stat): string | null {
    const cost = this.trainCost(st);
    if (this.onLocation(st)) return st.name + ' lagi di lokasi syuting.';
    if (!this.s.staff.includes(st)) return 'Orangnya sudah nggak di studio.';
    if (this.s.money < cost) return 'Uang nggak cukup.';
    if (st.energy < 25) return st.name + ' terlalu capek.';
    this.money(-cost, 'Pelatihan', 'Pelatihan & traktir');
    const gain = ri(4, 7) + (ROLES[st.role].main.includes(stat) ? 2 : 0);
    st.stats[stat] += gain;
    st.energy = Math.max(0, st.energy - 25);
    this.gainExp(st, 15);
    return null;
  }
  treat(): string | null {
    const c = this.treatCost();
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, 'Traktir bakso', 'Pelatihan & traktir');
    for (const st of this.s.staff) { st.energy = 100; if (st.activity === 'rest') st.activity = 'idle'; }
    return null;
  }
  unlockGenre(id: string): string | null {
    const g = GENRES.find((x) => x.id === id)!;
    if (this.s.unlockedGenres.includes(id)) return 'Sudah terbuka.';
    if (this.s.rp < g.unlockCost) return 'Poin Riset kurang.';
    this.s.rp -= g.unlockCost; this.s.unlockedGenres.push(id); return null;
  }
  unlockTheme(id: string): string | null {
    const t = THEMES.find((x) => x.id === id)!;
    if (this.s.unlockedThemes.includes(id)) return 'Sudah terbuka.';
    if (this.s.rp < t.unlockCost) return 'Poin Riset kurang.';
    this.s.rp -= t.unlockCost; this.s.unlockedThemes.push(id); return null;
  }
  unlockPlatform(id: string): string | null {
    const p = PLATFORMS.find((x) => x.id === id)!;
    const s = this.s;
    if (s.platforms.includes(id)) return 'Sudah punya kontrak.';
    if (s.fans < p.unlockFans) return `Butuh ${p.unlockFans.toLocaleString('id-ID')} fans.`;
    if (s.studio < p.unlockStudio) return `Butuh studio level ${p.unlockStudio}.`;
    if (s.money < p.unlockCost) return 'Uang nggak cukup.';
    this.money(-p.unlockCost, 'Kontrak ' + p.name, 'Kontrak platform'); s.platforms.push(id);
    return null;
  }
  upgradeStudio(): string | null {
    const s = this.s;
    const next = STUDIOS[s.studio];
    if (!next) return 'Studio sudah paling megah!';
    if (s.prod || s.job) return 'Tunggu produksi/job selesai dulu.';
    if (s.fans < next.fans) return `Butuh ${next.fans.toLocaleString('id-ID')} fans.`;
    if (s.money < next.cost) return 'Uang nggak cukup.';
    this.money(-next.cost, 'Renovasi', 'Renovasi studio'); s.studio = next.level;
    return null;
  }
  refreshCandidates(): string | null {
    const c = 300000;
    if (this.s.money < c) return 'Uang nggak cukup.';
    this.money(-c, 'Cari bakat', 'Rekrut staf');
    this.s.candidates = makeCandidates(this.s);
    return null;
  }
}

/** move an amount between spend categories of the ledger (no money change) */
function s_book(s: GameState, cat: string, amount: number) { s.ledger.spend[cat] = Math.max(0, (s.ledger.spend[cat] ?? 0) + amount); }

function short(t: string, n: number) { return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
