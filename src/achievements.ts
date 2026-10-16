// v5 Prestasi (achievements) + the year-10 career recap. Pure logic: checked by Sim (weekly, after releases and after
// player actions); the unlock toast + gallery live in screens5.ts.
import { GENRES, compat, THEMES } from './data';
import { dateOf, SELEB_TOP, WEEKS_PER_YEAR, type GameState } from './state';

export interface AchDef { id: string; name: string; desc: string; icon: string; check: (s: GameState) => boolean }

const great = (s: GameState) => Object.values(s.knownCombos).filter((c) => c === 'great').length;
const franchiseMax = (s: GameState) => Math.max(1, ...s.shows.map((x) => x.part || 1));

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'first_show', name: 'Tayang Perdana', desc: 'Sinetron pertama mengudara.', icon: 'tv', check: (s) => s.shows.length >= 1 },
  { id: 'rating20', name: 'Rating Meledak', desc: 'Satu sinetron tembus rating 20%.', icon: 'chart', check: (s) => s.stats5.maxRating >= 20 },
  { id: 'rank1_lokal', name: 'Raja TV Lokal', desc: 'Nomor 1 di Tangga Rating TV Lokal.', icon: 'crown', check: (s) => s.stats5.rank1.includes('lokal') },
  { id: 'rank1_nasional', name: 'Rating #1 Nasional', desc: 'Nomor 1 di Tangga Rating TV Nasional.', icon: 'crown', check: (s) => s.stats5.rank1.includes('nasional') },
  { id: 'rank1_streaming', name: 'Penguasa Streaming', desc: 'Nomor 1 di Tangga Rating Streaming.', icon: 'crown', check: (s) => s.stats5.rank1.includes('streaming') },
  { id: 'hof1', name: 'Mahakarya', desc: 'Masuk Hall of Fame (skor 32+).', icon: 'star', check: (s) => s.shows.some((x) => x.hof) },
  { id: 'hof10', name: '10 Hall of Fame', desc: '10 sinetron masuk Hall of Fame.', icon: 'star', check: (s) => s.shows.filter((x) => x.hof).length >= 10 },
  { id: 'trophy1', name: 'Piala Pertama', desc: 'Menang Anugerah Sinetron Terbaik.', icon: 'trophy', check: (s) => s.trophies >= 1 },
  { id: 'trophy5', name: 'Lemari Piala', desc: 'Kumpulkan 5 piala.', icon: 'trophy', check: (s) => s.trophies >= 5 },
  { id: 'sequel', name: 'Lanjut Season 2', desc: 'Bikin sekuel / spin-off pertama.', icon: 'film', check: (s) => s.shows.some((x) => x.part > 1) },
  { id: 'part4', name: 'Sinetron Abadi', desc: 'Satu franchise sampai bagian ke-4.', icon: 'film', check: (s) => franchiseMax(s) >= 4 },
  { id: 'ost_viral', name: 'OST Viral', desc: 'Lagu OST diputar di semua kondangan.', icon: 'note', check: (s) => s.shows.some((x) => !!x.ost?.viral) },
  { id: 'ramadan', name: 'Juara Ramadan', desc: 'Bertahan di 3 besar rating selama bulan Ramadan.', icon: 'moon', check: (s) => s.stats5.ramadanTop >= 1 },
  { id: 'eps300', name: 'Kejar Tayang', desc: 'Total 300 episode diproduksi.', icon: 'film', check: (s) => s.stats5.epsTotal >= 300 },
  { id: 'fans1m', name: 'Sejuta Fans', desc: 'Fans studio tembus 1 juta.', icon: 'heart', check: (s) => s.fans >= 1_000_000 },
  { id: 'miliar', name: 'Juragan Miliaran', desc: 'Kas studio tembus Rp 1 M.', icon: 'money', check: (s) => s.money >= 1_000_000_000 },
  { id: 'istana', name: 'Istana Sinetron', desc: 'Renovasi studio sampai level tertinggi.', icon: 'house', check: (s) => s.studio >= 5 },
  { id: 'seleb_top', name: 'Seleb Papan Atas', desc: 'Punya artis dengan 1 juta followers.', icon: 'heart', check: (s) => s.staff.some((x) => x.followers >= SELEB_TOP) },
  { id: 'all_genres', name: 'Serba Bisa', desc: 'Semua genre terbuka.', icon: 'bulb', check: (s) => GENRES.every((g) => s.unlockedGenres.includes(g.id)) },
  { id: 'combo10', name: 'Ahli Racik', desc: 'Temukan 10 combo MANTAP.', icon: 'bulb', check: (s) => great(s) >= 10 },
  { id: 'twist10', name: 'Raja Plot Twist', desc: 'Mainkan 10 kartu plot twist.', icon: 'twist', check: (s) => s.stats5.twists >= 10 },
  { id: 'goreng3', name: 'Tukang Goreng', desc: 'Goreng gosip artis 3 kali buat rating.', icon: 'mic', check: (s) => s.stats5.goreng >= 3 },
  { id: 'placement5', name: 'Iklan Terselubung', desc: 'Terima 5 product placement.', icon: 'bag', check: (s) => s.stats5.placements >= 5 },
  { id: 'kpi_warn', name: 'Disemprit KPI', desc: 'Dapat surat teguran pertama. Ups.', icon: 'kpi', check: (s) => s.stats5.kpiWarns >= 1 },
  { id: 'chem90', name: 'Chemistry Sempurna', desc: 'Temukan pasangan pemeran dengan chemistry 90+ lewat audisi.', icon: 'heart', check: (s) => s.stats5.bestChem >= 90 },
  { id: 'comeback', name: 'Bangkit dari Utang', desc: 'Pernah kas minus, lalu tembus Rp 100 jt.', icon: 'money', check: (s) => s.stats5.debtSeen > 0 && s.money >= 100_000_000 },
  { id: 'tamat', name: 'Satu Dekade', desc: 'Bertahan 10 tahun di dunia sinetron.', icon: 'trophy', check: (s) => s.absWeek >= WEEKS_PER_YEAR * 10 },
];
export function achById(id: string) { return ACHIEVEMENTS.find((a) => a.id === id); }
/** newly unlocked ids (marks them in the save) */
export function checkAchievements(s: GameState): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id] !== undefined) continue;
    let ok = false;
    try { ok = a.check(s); } catch { ok = false; }
    if (ok) { s.achievements[a.id] = s.absWeek; out.push(a.id); }
  }
  return out;
}

// ================================================================== year-10 ending
export const ENDING_WEEK = WEEKS_PER_YEAR * 10;
export interface Recap {
  title: string; blurb: string; score: number;
  shows: number; hof: number; trophies: number; revenue: number; fans: number; peak: number; achv: number; studio: number;
  best: { title: string; total: number; rating: number; year: number }[];
}
export const CAREER_TITLES: [number, string, string][] = [
  [85, 'Raja Sinetron', 'Namamu disebut di setiap ruang tamu se-Indonesia. Emak-emak hafal semua judulmu.'],
  [65, 'Maestro Air Mata', 'Tiap jam 7 malam, satu negara nangis bareng karena karyamu.'],
  [45, 'Juragan Rating', 'Stasiun TV rebutan ngajak kerja sama. Rating aman, dompet tebal.'],
  [28, 'Produser Kejar Tayang', 'Nggak selalu bagus, tapi selalu tayang. Itu juga prestasi!'],
  [0, 'Sutradara Kampung', 'Masih berjuang, tapi tetangga satu RT bangga sama kamu.'],
];
export function careerRecap(s: GameState): Recap {
  const hof = s.shows.filter((x) => x.hof).length;
  const peak = Math.max(0, ...s.shows.map((x) => x.rating));
  const achv = Object.keys(s.achievements).length;
  const score = Math.min(100, Math.round(hof * 4 + s.trophies * 6 + Math.min(20, Math.log10(1 + s.fans) * 3.2) + Math.min(14, peak / 3) + achv * 0.8 + (s.studio - 1) * 2));
  const [, title, blurb] = CAREER_TITLES.find(([min]) => score >= min) ?? CAREER_TITLES[CAREER_TITLES.length - 1];
  const best = [...s.shows].sort((a, b) => b.total - a.total || b.rating - a.rating).slice(0, 3).map((x) => ({ title: x.title, total: x.total, rating: x.rating, year: dateOf(x.releaseWeek).year }));
  return { title, blurb, score, shows: s.shows.length, hof, trophies: s.trophies, revenue: s.totalRevenue, fans: s.fans, peak, achv, studio: s.studio, best };
}
void compat; void THEMES;
