// Perang Rating: rival stations, their shows, and the weekly "Tangga Rating" chart.
// Pure logic (no Phaser). Rivals live per platform tier (lokal / nasional / streaming) so the
// player's show always fights shows of its own league.
import { PLATFORMS, RIVAL_TITLES } from './data';
import { rr, pick, type GameState, type Show } from './state';

export interface Rival {
  id: number; tier: string; title: string; station: string;
  base: number; u: number; rating: number; prev: number; age: number; len: number;
  hit: boolean; hist: number[]; prevRank: number;
}

/** fictional rival stations per tier (no real TV brands) */
export const STATIONS: Record<string, string[]> = {
  lokal: ['Cilok TV', 'TV Kelurahan', 'Gorengan TV', 'Kampung Vision', 'RTV Pak Lurah'],
  nasional: ['Garuda Merah TV', 'Rendang Channel', 'Ondel-Ondel TV', 'Nusantara Ceria', 'TV Kerupuk Nasional'],
  streaming: ['NontonAja+', 'Layar Rebahan', 'SinemaKu', 'Ngabuburit Play', 'BingeKu'],
};
export const RIVAL_PH = ['PH Mega Drama', 'Sinar Bulan Pictures', 'Rumah Produksi Sejuta Air Mata', 'Kilau Kencana Films', 'Cahaya Abadi Sinema'];

export const TIERS = ['lokal', 'nasional', 'streaming'];
/** outside this rank = danger zone */
export const SAFE_RANK = 3;
export const CANCEL_WEEKS = 3;
export const TOP_WEEKS = 3;
export const RIVALS_PER_TIER = 5;

export interface ChartRow { key: string; title: string; station: string; rating: number; mine: boolean; showId?: number; rank: number; prevRank: number; isNew: boolean; hit: boolean }

/** reference rating level of a tier: half from the platform, half from what this studio usually pulls there (rubber band) */
export function tierRef(s: GameState, tier: string): number {
  const pl = PLATFORMS.find((x) => x.id === tier)!;
  const yr = Math.floor(s.absWeek / 48);
  const plat = pl.maxRating * (0.5 + 0.04 * Math.min(6, yr));
  const mine = s.shows.filter((x) => x.platform === tier).slice(-4);
  if (!mine.length) return plat;
  const avg = mine.reduce((a, x) => a + x.rating, 0) / mine.length;
  return plat * 0.15 + avg * 1.0;
}

/** rating curve over a run: a small build-up, then a slow fade (same shape drives ad revenue) */
export function curve(w: number, airWeeks: number, shift = 0): number {
  const half = Math.ceil(airWeeks / 2) + shift;
  return w < half ? 1 + w * 0.04 : (1 + (half - 1) * 0.04) * 0.86 * Math.pow(0.86, w - half);
}

function freshTitle(s: GameState): string {
  const used = new Set(s.rivals.map((r) => r.title));
  for (const sh of s.shows) used.add(sh.title);
  const free = RIVAL_TITLES.filter((t) => !used.has(t));
  return pick(free.length ? free : RIVAL_TITLES);
}

export function newRival(s: GameState, tier: string, station: string, opts: { leader?: boolean; hitChance?: number; startAge?: boolean } = {}): Rival {
  const ref = tierRef(s, tier);
  const hit = Math.random() < (opts.hitChance ?? 0.1);
  const u = hit ? rr(1.1, 1.3) : opts.leader ? rr(1.0, 1.25) : rr(0.5, 1.05);
  const len = Math.round(rr(6, 16));
  const age = opts.startAge ? Math.floor(rr(0, len - 1)) : 0;
  const base = Math.round(ref * u * 10) / 10;
  const r: Rival = {
    id: s.rivalSeq++, tier, title: freshTitle(s), station, base, u, rating: 0, prev: 0, age, len, hit, hist: [], prevRank: 0,
  };
  r.rating = rivalRating(r);
  r.prev = r.rating;
  return r;
}

/** rivals never go above this (keeps a studio's masterpiece safe from a rubber-banded monster) */
export function rivalCap(tier: string): number {
  return (PLATFORMS.find((x) => x.id === tier)?.maxRating ?? 20) * 1.6;
}
function rivalRating(r: Rival): number {
  const c = r.age < 3 ? 0.9 + r.age * 0.05 : Math.pow(0.965, r.age - 3);
  return Math.max(0.3, Math.min(rivalCap(r.tier), Math.round(r.base * c * rr(0.92, 1.08) * 10) / 10));
}

export function makeRivals(s: GameState): Rival[] {
  s.rivals = [];
  for (const tier of TIERS) {
    STATIONS[tier].forEach((st, i) => s.rivals.push(newRival(s, tier, st, { leader: i === 0, hitChance: 0, startAge: true })));
  }
  return s.rivals;
}

/** advance rivals one week. Returns the rivals that were replaced by a big hit (for toasts) */
export function weekRivals(s: GameState): Rival[] {
  const hits: Rival[] = [];
  // replace in place so a new show never picks a title another station just took this same week
  s.rivals.forEach((r, i) => { s.rivals[i] = stepRival(s, r, hits); });
  return hits;
}

function stepRival(s: GameState, r: Rival, hits: Rival[]): Rival {
  {
    r.age++;
    if (r.age >= r.len) {
      // the show ends; the station airs something new (sometimes a monster hit)
      const leaderGone = !s.rivals.some((x) => x !== r && x.tier === r.tier && x.base >= tierRef(s, r.tier) * 0.82);
      const nr = newRival(s, r.tier, r.station, { leader: leaderGone, hitChance: 0.12 });
      nr.prevRank = 0;
      if (nr.hit) hits.push(nr);
      return nr;
    }
    r.prev = r.rating;
    // slow pull toward the tier level, so a studio that keeps improving keeps meeting tougher rivals
    const ref = tierRef(s, r.tier);
    r.base = r.base * 0.94 + ref * (r.u ?? 0.7) * 0.06;
    r.rating = rivalRating(r);
    r.hist.push(r.rating);
    if (r.hist.length > 16) r.hist.shift();
    return r;
  }
}

export function airingIn(s: GameState, tier: string): Show[] {
  return s.shows.filter((x) => x.platform === tier && x.weeksAired < x.airWeeks && !x.cancelled && x.hist.length > 0);
}

/** current chart of a tier (all rows, sorted) */
export function chart(s: GameState, tier: string): ChartRow[] {
  const rows: ChartRow[] = [];
  for (const r of s.rivals.filter((x) => x.tier === tier)) {
    rows.push({ key: 'r' + r.id, title: r.title, station: r.station, rating: r.rating, mine: false, rank: 0, prevRank: r.prevRank, isNew: r.age === 0, hit: r.hit });
  }
  for (const sh of airingIn(s, tier)) {
    const cur = sh.hist[sh.hist.length - 1];
    rows.push({ key: 's' + sh.id, title: sh.title, station: 'Studio Kita', rating: cur, mine: true, showId: sh.id, rank: 0, prevRank: sh.ranks.length > 1 ? sh.ranks[sh.ranks.length - 2] : 0, isNew: sh.ranks.length <= 1, hit: false });
  }
  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

/** after a weekly update: store each rival's rank for next week's arrows */
export function stampRivalRanks(s: GameState) {
  for (const tier of TIERS) {
    const c = chart(s, tier);
    for (const row of c) if (!row.mine) { const r = s.rivals.find((x) => 'r' + x.id === row.key); if (r) r.prevRank = row.rank; }
  }
}

/** the leading rival's rating history in a tier, aligned to a show's airing weeks */
export function leaderOf(s: GameState, tier: string): Rival | undefined {
  return s.rivals.filter((x) => x.tier === tier).sort((a, b) => b.rating - a.rating)[0];
}
