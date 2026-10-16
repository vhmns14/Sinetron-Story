// v4: OST bareng penyanyi dangdut (fictional singers only) + Musim Ramadan calendar helpers.
import { WEEKS_PER_YEAR } from './state';

const JT = 1_000_000;

export interface SingerDef {
  id: string; name: string; style: string;
  /** genres the singer's style suits */
  fit: string[];
  /** 0-100 */
  pop: number;
  /** base fee (TV Lokal) */
  fee: number;
  unlockFans: number;
  songs: string[];
  /** shirt / accent color for the little portrait */
  col: number;
}

export const SINGERS: SingerDef[] = [
  { id: 'rara', name: 'Neng Rara Cendol', style: 'Dangdut Koplo', fit: ['komedi', 'remaja', 'romansa'], pop: 42, fee: 2.5 * JT, unlockFans: 0, col: 0xe07ab0, songs: ['Goyang Cendol', 'Abang Tukang Ojol', 'Cinta Rasa Gorengan'] },
  { id: 'romi', name: 'Bang Romi Kumis', style: 'Dangdut Melayu', fit: ['romansa', 'keluarga', 'azab'], pop: 48, fee: 3.5 * JT, unlockFans: 0, col: 0x4f7fd0, songs: ['Air Mata di Ujung Sajadah', 'Kau Tinggalkan Aku di Terminal', 'Mertua Oh Mertua'] },
  { id: 'gambus', name: 'Ustadzah Nur & Gambus Hidayah', style: 'Religi Pop', fit: ['religi', 'azab', 'keluarga'], pop: 46, fee: 3 * JT, unlockFans: 0, col: 0x58b05a, songs: ['Hidayah Sepertiga Malam', 'Tobat Sebelum Terlambat', 'Sajadah Ibu di Pojok Kamar'] },
  { id: 'lilis', name: 'Teh Lilis Getar Hati', style: 'Pop Mellow', fit: ['romansa', 'keluarga', 'remaja'], pop: 62, fee: 9 * JT, unlockFans: 5000, col: 0xd0508a, songs: ['Getar Hati Kedua', 'Senyum di Pelaminan Orang', 'Surat dari Rantau'] },
  { id: 'serabi', name: 'Duo Serabi', style: 'Koplo Kocak', fit: ['komedi', 'remaja', 'keluarga'], pop: 66, fee: 12 * JT, unlockFans: 9000, col: 0xe8c040, songs: ['Pacarku Hobi Ngutang', 'Serabi Kuah Kinca', 'Ditinggal Pas Lagi Sayang'] },
  { id: 'jaka', name: 'Jaka Rock Dangdut', style: 'Rock Dangdut', fit: ['laga', 'kolosal', 'siluman'], pop: 68, fee: 16 * JT, unlockFans: 15000, col: 0x30304a, songs: ['Elang Membelah Langit', 'Pendekar Patah Hati', 'Gitar Tua Pusaka'] },
  { id: 'suti', name: 'Mbak Suti Lengking', style: 'Dangdut Mistis', fit: ['horor', 'siluman', 'azab'], pop: 72, fee: 22 * JT, unlockFans: 25000, col: 0x6a3ab0, songs: ['Kidung Tengah Malam', 'Kuntilanak Galau', 'Bulan Merah di Pohon Beringin'] },
  { id: 'melati', name: 'Ratu Melati Syahdu', style: 'Diva Dangdut', fit: ['romansa', 'keluarga', 'religi', 'azab'], pop: 88, fee: 60 * JT, unlockFans: 120000, col: 0xc0392b, songs: ['Ratu Air Mata', 'Hatiku Remuk Kayak Rengginang', 'Cinta Nggak Pakai Kontrak'] },
  { id: 'juned', name: 'Raja Kendang Bang Juned', style: 'Koplo Legenda', fit: ['komedi', 'laga', 'remaja', 'kolosal', 'keluarga'], pop: 95, fee: 100 * JT, unlockFans: 350000, col: 0xe08a3a, songs: ['Kendang Membara', 'Goyang Satu Indonesia', 'Juragan Empang Cinta'] },
];

export const OST_PLAT_MULT: Record<string, number> = { lokal: 1, nasional: 2, streaming: 3.5 };
export function singerById(id: string | null | undefined) { return id ? SINGERS.find((x) => x.id === id) : undefined; }
export function singerFee(sg: SingerDef, platform: string): number {
  return Math.round((sg.fee * (OST_PLAT_MULT[platform] ?? 1)) / 100000) * 100000;
}
export function singerFits(sg: SingerDef, genre: string): boolean { return sg.fit.includes(genre); }

// ---------------------------------------------------------------- Musim Ramadan
/** Ramadan drifts one month earlier every game year (like the real lunar calendar): Th1 Bln 9, Th2 Bln 8, ... */
export function ramadanMonth(year: number): number {
  return ((((9 - year) % 12) + 12) % 12) + 1;
}
/** absolute week Ramadan starts in a given year */
export function ramadanStart(year: number): number {
  return (year - 1) * WEEKS_PER_YEAR + (ramadanMonth(year) - 1) * 4;
}
export function isRamadan(absWeek: number): boolean {
  const y = Math.floor(absWeek / WEEKS_PER_YEAR) + 1;
  const st = ramadanStart(y);
  return absWeek >= st && absWeek < st + 4;
}
/** weeks until the next Ramadan starts (0 while it is Ramadan) */
export function weeksToRamadan(absWeek: number): number {
  if (isRamadan(absWeek)) return 0;
  const y = Math.floor(absWeek / WEEKS_PER_YEAR) + 1;
  const st = ramadanStart(y);
  return st > absWeek ? st - absWeek : ramadanStart(y + 1) - absWeek;
}
/** genres that viewers watch more during Ramadan (others dip a bit: everyone is at tarawih) */
export const RAMADAN_GENRE: Record<string, number> = { religi: 1.3, keluarga: 1.2, azab: 1.12 };
export const RAMADAN_OTHER = 0.94;
export const RAMADAN_SLOT_GENRES = ['religi', 'keluarga', 'azab'];
/** the special "Sinetron Ramadan" slot can be booked when Ramadan is this close (or running) */
export const RAMADAN_SLOT_WINDOW = 22;
/** production takes ~10 weeks: booking later than this would miss Ramadan */
export const RAMADAN_SLOT_MIN = 6;
export const RAMADAN_SPONSORS = ['Sirup Melon Cap Kakek', 'Kurma Onta Emas', 'Biskuit Kaleng Lebaran', 'Sarung Cap Kancil Bersila'];
