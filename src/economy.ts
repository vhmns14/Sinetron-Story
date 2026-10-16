// v4 economy: running costs, salary market value, equipment (money sinks with upkeep), star contracts.
import { ROLES, type PointKey, type Stat } from './data';
import type { Staff } from './state';

const JT = 1_000_000;

/** production prices go up a little every year (inflasi) */
export function inflation(year: number): number {
  return 1 + 0.06 * Math.max(0, year - 1);
}

/** monthly salary a staff member "should" earn from stats, level and fame */
export function marketSalary(st: Staff): number {
  const def = ROLES[st.role];
  let sum = 0, baseSum = 0;
  for (const k of Object.keys(def.base) as Stat[]) { sum += st.stats[k]; baseSum += def.base[k]; }
  const actor = st.role === 'aktor' || st.role === 'aktris';
  const fame = actor && st.followers > 50000 ? 1 + 0.4 * Math.log10(st.followers / 50000) : 1;
  // v5: veterans past ~3x the base stats get pricier more slowly (the year 8-10 payroll used to outgrow any income)
  const r = sum / baseSum;
  const eff = r <= 3 ? r : 3 + (r - 3) * 0.45;
  return Math.round((def.salary * Math.pow(eff, 1.2) * fame * (st.star ? 1.6 : 1)) / 50000) * 50000;
}

// ---------------------------------------------------------------- equipment (Peralatan)
export interface EquipDef {
  id: string; name: string; blurb: string; cost: number; upkeep: number;
  needStudio: number; needFans: number;
  /** multiplier on points of these keys during production */
  pts?: Partial<Record<PointKey, number>>;
  /** only for these genres (empty = all) */
  genres?: string[];
  /** blooper fixing chance multiplier during editing */
  fix?: number;
  /** hype gain multiplier */
  hype?: number;
  /** fewer bloopers while shooting */
  blooper?: number;
}
export const EQUIPMENT: EquipDef[] = [
  { id: 'kamera', name: 'Kamera Sinema 4K', blurb: 'Gambar tajam, kritikus visual senyum. Visual +12%.', cost: 45 * JT, upkeep: 1.5 * JT, needStudio: 1, needFans: 3000, pts: { visual: 0.12 } },
  { id: 'crane', name: 'Crane & Lampu Pro', blurb: 'Shot dramatis dari atas! Drama & Visual +8%, blooper kamera berkurang.', cost: 140 * JT, upkeep: 4 * JT, needStudio: 2, needFans: 15000, pts: { drama: 0.08, visual: 0.08 }, blooper: 0.7 },
  { id: 'editing', name: 'Ruang Editing Pro', blurb: 'Komputer kenceng, blooper cepat beres (+60%).', cost: 260 * JT, upkeep: 7 * JT, needStudio: 2, needFans: 30000, fix: 1.6 },
  { id: 'medsos', name: 'Tim Medsos & Buzzer', blurb: 'Admin medsos 24 jam. Hype +40%.', cost: 450 * JT, upkeep: 15 * JT, needStudio: 3, needFans: 80000, hype: 1.4 },
  { id: 'cgi', name: 'Studio CGI Naga', blurb: 'Efek naga & elang terbang kelas premium. Visual +25% untuk Siluman, Kolosal, Laga, Horor.', cost: 900 * JT, upkeep: 25 * JT, needStudio: 3, needFans: 150000, pts: { visual: 0.25 }, genres: ['siluman', 'kolosal', 'laga', 'horor'] },
  { id: 'orkestra', name: 'Ruang Musik & Foley', blurb: 'Efek suara jeder-jeder bikin penonton merinding. Air Mata & Drama +10%.', cost: 1500 * JT, upkeep: 35 * JT, needStudio: 4, needFans: 350000, pts: { airmata: 0.1, drama: 0.1 } },
];
export function equipById(id: string) { return EQUIPMENT.find((e) => e.id === id); }

/** combined point multiplier from owned equipment */
export function equipPointMult(owned: string[], key: PointKey, genre: string): number {
  let m = 1;
  for (const id of owned) {
    const e = equipById(id);
    if (!e || !e.pts || e.pts[key] === undefined) continue;
    if (e.genres && e.genres.length && !e.genres.includes(genre)) continue;
    m *= 1 + (e.pts[key] ?? 0);
  }
  return m;
}
export function equipFactor(owned: string[], k: 'fix' | 'hype' | 'blooper'): number {
  let m = 1;
  for (const id of owned) { const e = equipById(id); if (e && e[k] !== undefined) m *= e[k]!; }
  return m;
}
export function equipUpkeep(owned: string[]): number {
  return owned.reduce((a, id) => a + (equipById(id)?.upkeep ?? 0), 0);
}

// ---------------------------------------------------------------- Kampanye Akbar (big promo)
export const CAMPAIGN_BASE: Record<string, number> = { lokal: 12 * JT, nasional: 45 * JT, streaming: 150 * JT };
export const CAMPAIGN_BOOST = 0.55;
export const CAMPAIGN_WEEKS = 4;
export const PROMO_BOOST = 0.25;
export const PROMO_WEEKS = 3;

// ---------------------------------------------------------------- star contracts (Agensi Bintang)
export const STAR_AGENCY_FANS = 40000;
/** signing fee for an exclusive star contract */
export function starSignFee(st: Staff): number {
  return Math.round((st.salary * 10 + st.followers * 90) / 1_000_000) * 1_000_000;
}
