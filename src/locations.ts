// Peta: location shoots. Each spot boosts some points during Syuting and has hidden genre/theme combos.
import type { PointKey } from './data';

export interface LocDef {
  id: string; name: string; short: string;
  /** pin position on the map bitmap grid (1 grid px = 2 logical px) */
  gx: number; gy: number;
  cost: number; // base cost (TV Lokal, 13 eps)
  bonus: Partial<Record<PointKey, number>>; // extra share during syuting
  combos: string[]; // genre or theme ids that click with this place
  hint: string; // vague clue shown before a combo is discovered
  unlockFans: number; unlockYear: number;
  blurb: string;
  /** v4: shoot abroad (pin sits in the "Luar Negeri" inset of the map) */
  abroad?: boolean;
}

const JT = 1_000_000;

export const LOCATIONS: LocDef[] = [
  { id: 'kotatua', name: 'Jakarta Kota Tua', short: 'Kota Tua', gx: 69, gy: 86, cost: 2.5 * JT, bonus: { visual: 0.25, drama: 0.15 }, combos: ['laga', 'kota', 'kantor'], hint: 'Gedung tua & jalanan ramai... pas buat kejar-kejaran dan cerita orang kota.', unlockFans: 0, unlockYear: 1, blurb: 'Gedung kolonial, sepeda ontel warna-warni.' },
  { id: 'pasar', name: 'Pasar Tradisional', short: 'Pasar', gx: 118, gy: 90, cost: 1.5 * JT, bonus: { komedi: 0.3 }, combos: ['komedi', 'pasar', 'azab'], hint: 'Rame, becek, banyak emak-emak nawar. Lucu, tapi juga bisa jadi tempat "balasan".', unlockFans: 0, unlockYear: 1, blurb: 'Tukang sayur siap jadi figuran gratis.' },
  { id: 'pesantren', name: 'Pesantren Desa', short: 'Pesantren', gx: 90, gy: 88, cost: 2 * JT, bonus: { airmata: 0.25, drama: 0.1 }, combos: ['religi', 'pesantren', 'azab'], hint: 'Suasana khusyuk, santri mengaji tiap subuh. Cerita hidayah pasti makin terasa.', unlockFans: 1500, unlockYear: 1, blurb: 'Pak Kyai ramah, asal syuting sopan.' },
  { id: 'puncak', name: 'Puncak', short: 'Puncak', gx: 79, gy: 94, cost: 3 * JT, bonus: { airmata: 0.2, visual: 0.2 }, combos: ['romansa', 'keluarga', 'horor'], hint: 'Kabut, kebun teh, vila sewaan... romantis siang, merinding malam.', unlockFans: 3000, unlockYear: 1, blurb: 'Kebun teh, jagung bakar, vila sewaan.' },
  { id: 'jogja', name: 'Keraton Jogja', short: 'Keraton', gx: 98, gy: 97, cost: 6 * JT, bonus: { visual: 0.3, drama: 0.15 }, combos: ['kolosal', 'kerajaan', 'laga'], hint: 'Istana, abdi dalem, pusaka... cocok buat cerita zaman kerajaan.', unlockFans: 10000, unlockYear: 2, blurb: 'Megah dan sakral. Wajib izin dulu!' },
  { id: 'pantai', name: 'Pantai Selatan', short: 'Pantai Sel.', gx: 107, gy: 104, cost: 6 * JT, bonus: { drama: 0.25, visual: 0.2 }, combos: ['horor', 'siluman', 'laut'], hint: 'Ombak ganas dan legenda Nyi Roro... jangan pakai baju hijau!', unlockFans: 18000, unlockYear: 2, blurb: 'Ombaknya ganas, legendanya lebih ganas.' },
  { id: 'bali', name: 'Bali', short: 'Bali', gx: 141, gy: 97, cost: 10 * JT, bonus: { visual: 0.3, airmata: 0.15 }, combos: ['romansa', 'remaja', 'laut'], hint: 'Sunset, pantai, turis... latar terbaik buat kisah cinta anak muda.', unlockFans: 35000, unlockYear: 3, blurb: 'Sunset di pantai. Mahal, tapi cakep.' },
  { id: 'kalimantan', name: 'Hutan Kalimantan', short: 'Kalimantan', gx: 104, gy: 34, cost: 9 * JT, bonus: { visual: 0.2, drama: 0.25 }, combos: ['laga', 'horor', 'hutan'], hint: 'Rimba lebat, sungai lebar. Cocok buat petualangan... atau yang angker.', unlockFans: 50000, unlockYear: 3, blurb: 'Rimba lebat, nyamuknya juga lebat.' },
  { id: 'toba', name: 'Danau Toba', short: 'Toba', gx: 24, gy: 30, cost: 12 * JT, bonus: { airmata: 0.25, visual: 0.25 }, combos: ['keluarga', 'siluman', 'kampung'], hint: 'Danau raksasa penuh legenda. Kisah keluarga & makhluk gaib cocok di sini.', unlockFans: 80000, unlockYear: 4, blurb: 'Danau terbesar se-Asia Tenggara, horas!' },
  // v4 late-game money sinks: shooting abroad
  { id: 'seoul', name: 'Seoul, Korea', short: 'Seoul', gx: 12, gy: 114, cost: 45 * JT, bonus: { visual: 0.35, airmata: 0.2 }, combos: ['romansa', 'remaja', 'kampus'], hint: 'Salju, kafe, oppa-oppa... penonton remaja pasti histeris.', unlockFans: 300000, unlockYear: 4, blurb: 'Drama ala Korea, rasa sinetron.', abroad: true },
  { id: 'istanbul', name: 'Istanbul, Turki', short: 'Istanbul', gx: 27, gy: 114, cost: 50 * JT, bonus: { airmata: 0.3, visual: 0.25 }, combos: ['religi', 'kerajaan', 'romansa'], hint: 'Masjid megah, istana tua, bazar rempah. Kisah cinta & hidayah makin syahdu.', unlockFans: 450000, unlockYear: 4, blurb: 'Kisah cinta di negeri dua benua.', abroad: true },
  { id: 'paris', name: 'Paris, Prancis', short: 'Paris', gx: 42, gy: 114, cost: 70 * JT, bonus: { visual: 0.4, drama: 0.2 }, combos: ['romansa', 'kantor', 'kota'], hint: 'Menara Eiffel & jalanan romantis... CEO dingin pasti luluh di sini.', unlockFans: 700000, unlockYear: 5, blurb: '"Cinta di Paris", klasik tapi laku.', abroad: true },
];

export const LOC_PLAT_MULT: Record<string, number> = { lokal: 1, nasional: 1.8, streaming: 3 };

export function locById(id: string | null | undefined): LocDef | undefined {
  return id ? LOCATIONS.find((x) => x.id === id) : undefined;
}

export function locUnlocked(l: LocDef, fans: number, year: number): boolean {
  return fans >= l.unlockFans || (l.unlockYear > 1 && year >= l.unlockYear + 1);
}

export function locCost(l: LocDef, platform: string, eps: number): number {
  return Math.round((l.cost * (LOC_PLAT_MULT[platform] ?? 1) * Math.sqrt(eps / 13)) / 100000) * 100000;
}

/** combo matches of a location with a genre + theme (0, 1 or 2) */
export function locMatches(l: LocDef, genre: string, theme: string): string[] {
  return l.combos.filter((c) => c === genre || c === theme);
}
