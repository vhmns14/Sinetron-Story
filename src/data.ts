// Static game data: genres, themes, combos, roles, names, titles.

export type PointKey = 'drama' | 'airmata' | 'komedi' | 'visual';
export type Stat = 'akting' | 'naskah' | 'visual' | 'pesona' | 'stamina';
export type Role = 'sutradara' | 'penulis' | 'aktor' | 'aktris' | 'kameramen';

export const POINT_LABEL: Record<PointKey, string> = {
  drama: 'Drama',
  airmata: 'Air Mata',
  komedi: 'Komedi',
  visual: 'Visual',
};
export const POINT_COLOR: Record<PointKey, string> = {
  drama: '#ffe066',
  airmata: '#8fd3ff',
  komedi: '#ffb3d1',
  visual: '#b6f29a',
};
export const POINT_KEYS: PointKey[] = ['drama', 'airmata', 'komedi', 'visual'];

export const STAT_LABEL: Record<Stat, string> = {
  akting: 'Akting',
  naskah: 'Naskah',
  visual: 'Visual',
  pesona: 'Pesona',
  stamina: 'Stamina',
};
export const STATS: Stat[] = ['akting', 'naskah', 'visual', 'pesona', 'stamina'];

export interface RoleDef {
  id: Role;
  label: string;
  female: boolean | null; // null = either
  base: Record<Stat, number>;
  salary: number; // monthly base, Rupiah
  main: Stat[];
}

const JT = 1_000_000;

export const ROLES: Record<Role, RoleDef> = {
  sutradara: {
    id: 'sutradara', label: 'Sutradara', female: null,
    base: { akting: 12, naskah: 18, visual: 24, pesona: 10, stamina: 18 },
    salary: 2.0 * JT, main: ['visual', 'naskah'],
  },
  penulis: {
    id: 'penulis', label: 'Penulis', female: null,
    base: { akting: 6, naskah: 28, visual: 8, pesona: 8, stamina: 14 },
    salary: 1.5 * JT, main: ['naskah'],
  },
  aktor: {
    id: 'aktor', label: 'Aktor', female: false,
    base: { akting: 24, naskah: 6, visual: 6, pesona: 20, stamina: 20 },
    salary: 1.7 * JT, main: ['akting', 'pesona'],
  },
  aktris: {
    id: 'aktris', label: 'Aktris', female: true,
    base: { akting: 24, naskah: 6, visual: 6, pesona: 22, stamina: 18 },
    salary: 1.7 * JT, main: ['akting', 'pesona'],
  },
  kameramen: {
    id: 'kameramen', label: 'Kameramen', female: null,
    base: { akting: 4, naskah: 6, visual: 28, pesona: 6, stamina: 22 },
    salary: 1.5 * JT, main: ['visual'],
  },
};
export const ROLE_LIST: Role[] = ['sutradara', 'penulis', 'aktor', 'aktris', 'kameramen'];

export interface GenreDef {
  id: string;
  name: string;
  profile: Record<'drama' | 'airmata' | 'komedi', number>; // how story points split
  weight: Record<PointKey, number>; // what critics care about
  unlockCost: number; // research points; 0 = unlocked at start
  blurb: string;
}

export const GENRES: GenreDef[] = [
  { id: 'romansa', name: 'Romansa', profile: { drama: 0.45, airmata: 0.35, komedi: 0.2 }, weight: { drama: 1.2, airmata: 1.0, komedi: 0.5, visual: 0.8 }, unlockCost: 0, blurb: 'Cinta segitiga, segiempat, segilima.' },
  { id: 'komedi', name: 'Komedi', profile: { drama: 0.2, airmata: 0.05, komedi: 0.75 }, weight: { drama: 0.5, airmata: 0.2, komedi: 1.6, visual: 0.6 }, unlockCost: 0, blurb: 'Lawakan receh bikin ngakak.' },
  { id: 'keluarga', name: 'Keluarga', profile: { drama: 0.4, airmata: 0.4, komedi: 0.2 }, weight: { drama: 1.0, airmata: 1.1, komedi: 0.6, visual: 0.6 }, unlockCost: 0, blurb: 'Mertua galak, menantu sabar.' },
  { id: 'azab', name: 'Azab', profile: { drama: 0.35, airmata: 0.5, komedi: 0.15 }, weight: { drama: 1.0, airmata: 1.3, komedi: 0.3, visual: 0.9 }, unlockCost: 0, blurb: 'Jenazah tertimpa truk molen.' },
  { id: 'religi', name: 'Religi', profile: { drama: 0.4, airmata: 0.5, komedi: 0.1 }, weight: { drama: 1.0, airmata: 1.3, komedi: 0.3, visual: 0.6 }, unlockCost: 10, blurb: 'Hidayah datang di sepertiga malam.' },
  { id: 'remaja', name: 'Remaja', profile: { drama: 0.45, airmata: 0.2, komedi: 0.35 }, weight: { drama: 1.1, airmata: 0.6, komedi: 1.0, visual: 0.9 }, unlockCost: 12, blurb: 'Geng motor & cinta SMA.' },
  { id: 'horor', name: 'Horor', profile: { drama: 0.55, airmata: 0.15, komedi: 0.3 }, weight: { drama: 1.3, airmata: 0.4, komedi: 0.6, visual: 1.2 }, unlockCost: 15, blurb: 'Kuntilanak ketawa jam 12 malam.' },
  { id: 'laga', name: 'Laga', profile: { drama: 0.6, airmata: 0.15, komedi: 0.25 }, weight: { drama: 1.2, airmata: 0.3, komedi: 0.5, visual: 1.5 }, unlockCost: 20, blurb: 'Elang terbang, pukulan seribu bayangan.' },
  { id: 'siluman', name: 'Siluman', profile: { drama: 0.5, airmata: 0.25, komedi: 0.25 }, weight: { drama: 1.1, airmata: 0.7, komedi: 0.5, visual: 1.6 }, unlockCost: 26, blurb: 'Naga terbang CGI kualitas premium.' },
  { id: 'kolosal', name: 'Kolosal', profile: { drama: 0.55, airmata: 0.3, komedi: 0.15 }, weight: { drama: 1.3, airmata: 0.8, komedi: 0.3, visual: 1.5 }, unlockCost: 34, blurb: 'Kerajaan, pusaka sakti, pendekar.' },
];

export interface ThemeDef { id: string; name: string; unlockCost: number; word: string[] }

export const THEMES: ThemeDef[] = [
  { id: 'kampung', name: 'Kampung', unlockCost: 0, word: ['Kampung', 'Desa', 'Pak RT', 'Sawah'] },
  { id: 'kota', name: 'Kota', unlockCost: 0, word: ['Jakarta', 'Kota', 'Apartemen', 'Mall'] },
  { id: 'sekolah', name: 'Sekolah', unlockCost: 0, word: ['SMA', 'Sekolah', 'Kelas', 'OSIS'] },
  { id: 'pasar', name: 'Pasar', unlockCost: 6, word: ['Pasar', 'Juragan', 'Tukang Sayur', 'Lapak'] },
  { id: 'pesantren', name: 'Pesantren', unlockCost: 8, word: ['Pesantren', 'Santri', 'Pondok', 'Kyai'] },
  { id: 'kantor', name: 'Kantor', unlockCost: 8, word: ['Kantor', 'Bos', 'CEO', 'Lift'] },
  { id: 'rumahsakit', name: 'Rumah Sakit', unlockCost: 10, word: ['Rumah Sakit', 'Dokter', 'UGD', 'Suster'] },
  { id: 'kos', name: 'Kos-kosan', unlockCost: 10, word: ['Kos', 'Ibu Kos', 'Anak Kos', 'Kamar 13'] },
  { id: 'kampus', name: 'Kampus', unlockCost: 12, word: ['Kampus', 'Dosen', 'Skripsi', 'Mahasiswi'] },
  { id: 'hutan', name: 'Hutan Angker', unlockCost: 14, word: ['Hutan', 'Pohon Beringin', 'Gunung', 'Goa'] },
  { id: 'kerajaan', name: 'Kerajaan', unlockCost: 18, word: ['Kerajaan', 'Pangeran', 'Putri', 'Keraton'] },
  { id: 'laut', name: 'Pantai Selatan', unlockCost: 22, word: ['Pantai', 'Laut Selatan', 'Nelayan', 'Ombak'] },
];

export type Compat = 'great' | 'good' | 'ok' | 'bad';
export const COMPAT_LABEL: Record<Compat, string> = { great: 'MANTAP!', good: 'Cocok', ok: 'Biasa', bad: 'Aneh' };
export const COMPAT_MULT: Record<Compat, number> = { great: 1.4, good: 1.15, ok: 1.0, bad: 0.72 };

// Hidden combo table: genre -> theme -> compat (missing = ok)
const C: Record<string, Partial<Record<string, Compat>>> = {
  romansa: { sekolah: 'great', kampus: 'great', kantor: 'good', kota: 'good', rumahsakit: 'good', pesantren: 'ok', hutan: 'bad', pasar: 'ok' },
  komedi: { kos: 'great', pasar: 'great', kampung: 'good', kantor: 'good', sekolah: 'good', rumahsakit: 'bad', kerajaan: 'ok', hutan: 'ok' },
  keluarga: { kampung: 'great', kota: 'good', pasar: 'good', rumahsakit: 'good', hutan: 'bad', kampus: 'ok' },
  azab: { pesantren: 'great', kampung: 'great', pasar: 'good', kota: 'good', kantor: 'good', sekolah: 'bad', kampus: 'bad' },
  religi: { pesantren: 'great', kampung: 'good', rumahsakit: 'good', kampus: 'good', hutan: 'bad', laut: 'bad', kos: 'ok' },
  remaja: { sekolah: 'great', kampus: 'good', kota: 'good', kos: 'good', pesantren: 'ok', kerajaan: 'bad', rumahsakit: 'bad' },
  horor: { hutan: 'great', kos: 'great', rumahsakit: 'good', sekolah: 'good', laut: 'good', pasar: 'bad', kantor: 'ok' },
  laga: { kerajaan: 'good', hutan: 'good', kota: 'good', pasar: 'ok', sekolah: 'ok', rumahsakit: 'bad', kos: 'bad' },
  siluman: { laut: 'great', hutan: 'great', kerajaan: 'good', kampung: 'good', kantor: 'bad', kampus: 'bad' },
  kolosal: { kerajaan: 'great', laut: 'good', hutan: 'good', kampung: 'ok', kota: 'bad', kantor: 'bad', kos: 'bad' },
};
export function compat(genre: string, theme: string): Compat {
  return C[genre]?.[theme] ?? 'ok';
}

export interface PlatformDef {
  id: string; name: string; short: string;
  baseCost: number; perEp: number; adRate: number; maxRating: number; fanRef: number; fanGain: number;
  toughness: number; unlockFans: number; unlockCost: number; unlockStudio: number;
}
export const PLATFORMS: PlatformDef[] = [
  { id: 'lokal', name: 'TV Lokal', short: 'Lokal', baseCost: 4 * JT, perEp: 0.35 * JT, adRate: 6.5 * JT, maxRating: 18, fanRef: 3000, fanGain: 140, toughness: 1.0, unlockFans: 0, unlockCost: 0, unlockStudio: 1 },
  { id: 'nasional', name: 'TV Nasional', short: 'Nasional', baseCost: 12 * JT, perEp: 1.0 * JT, adRate: 8.0 * JT, maxRating: 32, fanRef: 25000, fanGain: 420, toughness: 1.15, unlockFans: 6000, unlockCost: 25 * JT, unlockStudio: 1 },
  { id: 'streaming', name: 'Streaming', short: 'Stream', baseCost: 35 * JT, perEp: 2.2 * JT, adRate: 11 * JT, maxRating: 45, fanRef: 120000, fanGain: 1000, toughness: 1.45, unlockFans: 60000, unlockCost: 100 * JT, unlockStudio: 2 },
];

export interface EpisodeOpt { eps: number; factor: number; airWeeks: number }
export const EPISODES: EpisodeOpt[] = [
  { eps: 13, factor: 1.0, airWeeks: 6 },
  { eps: 26, factor: 1.5, airWeeks: 10 },
  { eps: 52, factor: 2.2, airWeeks: 16 },
];

export interface BudgetOpt { id: string; name: string; costMult: number; workMult: number }
export const BUDGETS: BudgetOpt[] = [
  { id: 'hemat', name: 'Hemat', costMult: 0.7, workMult: 0.85 },
  { id: 'standar', name: 'Standar', costMult: 1.0, workMult: 1.0 },
  { id: 'mewah', name: 'Mewah', costMult: 1.6, workMult: 1.22 },
];

export interface StudioDef { level: number; name: string; maxStaff: number; cost: number; fans: number; workMult: number; rent: number; premium?: boolean }
// rent = monthly "sewa, listrik & perawatan alat" (v4 economy)
export const STUDIOS: StudioDef[] = [
  { level: 1, name: 'Studio Garasi', maxStaff: 5, cost: 0, fans: 0, workMult: 1.0, rent: 1 * JT },
  { level: 2, name: 'Studio Ruko', maxStaff: 7, cost: 70 * JT, fans: 12000, workMult: 1.1, rent: 5 * JT },
  { level: 3, name: 'Studio Megah', maxStaff: 9, cost: 220 * JT, fans: 60000, workMult: 1.22, rent: 14 * JT },
  { level: 4, name: 'Studio Bintang', maxStaff: 10, cost: 1000 * JT, fans: 300000, workMult: 1.34, rent: 40 * JT, premium: true },
  { level: 5, name: 'Istana Sinetron', maxStaff: 11, cost: 2600 * JT, fans: 900000, workMult: 1.48, rent: 90 * JT, premium: true },
];

export const NAMES_M = ['Dedi', 'Bambang', 'Joko', 'Andi', 'Rizky', 'Agus', 'Fajar', 'Bayu', 'Tono', 'Reza', 'Udin', 'Eko', 'Yanto', 'Gilang', 'Asep', 'Ucok', 'Bagas', 'Dimas', 'Hendra', 'Slamet', 'Romi', 'Jajang', 'Doni', 'Teguh'];
export const NAMES_F = ['Siti', 'Rina', 'Ayu', 'Putri', 'Dewi', 'Mega', 'Intan', 'Citra', 'Sari', 'Lestari', 'Wulan', 'Nadia', 'Melati', 'Bunga', 'Tika', 'Nining', 'Ratna', 'Yuyun', 'Anisa', 'Dinda', 'Euis', 'Fitri', 'Lilis', 'Maya'];
export const PREFIX_M = ['Bang', 'Mas', 'Kang', 'Pak', 'Om', 'Cak'];
export const PREFIX_F = ['Mbak', 'Teh', 'Bu', 'Neng', 'Kak', 'Ceu'];

// Title generator, rival titles and critic lines live in ./titles.ts
export { makeTitle, RIVAL_TITLES, sequelTitle, spinoffTitle, franchiseBase } from './titles';

export const CRITICS = [
  { name: 'ADI', fav: 'drama' as PointKey, look: { skin: 0xf0c08a, hair: 0x2a1c14, shirt: 0x3d5a9e, glasses: true, female: false, style: 'short' as const }, bg: '#7fbf7f' },
  { name: 'BU MAR', fav: 'airmata' as PointKey, look: { skin: 0xf2c79a, hair: 0xd8d8d8, shirt: 0x8a5ab0, glasses: true, female: true, style: 'bun' as const }, bg: '#e09a9a' },
  { name: 'RUDI', fav: 'komedi' as PointKey, look: { skin: 0xd9a066, hair: 0x2a1c14, shirt: 0x6b7d3a, glasses: false, female: false, style: 'cap' as const }, bg: '#8ab8d8' },
  { name: 'SANTI', fav: 'visual' as PointKey, look: { skin: 0xf6cfa5, hair: 0x4a2a18, shirt: 0x2f2f3a, glasses: false, female: true, style: 'long' as const }, bg: '#b89ad8' },
];

export { criticComment } from './titles';

export const TIPS = [
  'Tekan PRODUKSI untuk bikin sinetron. Pilih genre + tema. Ada kombinasi rahasia yang bikin rating meledak!',
  'Staf bekerja otomatis. Penulis = Naskah, Aktor/Aktris = Drama & Air Mata, Kameramen = Visual, Sutradara = semuanya.',
  'Energi staf berkurang saat kerja. Kalau capek mereka makan bakso di Kantin. Bisa juga "Traktir Bakso" biar semua segar.',
  'Blooper muncul saat syuting. Kameramen & Sutradara membereskannya saat Editing. Blooper tersisa bikin skor turun.',
  'Kritikus memberi nilai 1-10. Total 32+ masuk HALL OF FAME!',
  'Kumpulkan Poin Riset untuk membuka genre & tema baru (menu Studio > Riset).',
  'Fans banyak = bisa tayang di TV Nasional dan Streaming. Uangnya jauh lebih besar!',
  'Lagi kosong? Ambil Job Sampingan (iklan, video klip) buat nambah kas.',
  'Jangan bikin genre+tema yang sama terus. Penonton gampang bosan!',
  'Kalau kas minus terlalu lama, studio bangkrut. Hati-hati gaji bulanan!',
  'Tiap bulan ada gaji + sewa studio + perawatan alat. Cek menu Studio > Keuangan biar nggak kaget.',
  'Lagi tayang tapi rating lesu? Mainkan Kartu Plot Twist di Tangga Rating. Jangan kebanyakan, netizen bisa muak!',
  'Ramadan pindah satu bulan lebih awal tiap tahun. Religi & Keluarga laris, dan ada slot Sinetron Ramadan bersponsor.',
  'OST bareng penyanyi dangdut bisa ngehits: hype naik dan duit RBT ngalir. Pilih penyanyi yang cocok genre!',
  'Sinetron skor 30+ bisa dibikin Sekuel atau Spin-off. Fans lama ikut nonton, tapi jangan kebanyakan bagian.',
  'Udah kaya? Belanja Peralatan, renovasi ke Studio Bintang, teken artis papan atas, atau Kampanye Akbar!',
];

export const JOBS = [
  { name: 'Iklan Sabun Colek', weeks: 2, pay: 5 * JT, need: 60 },
  { name: 'Video Klip Dangdut', weeks: 3, pay: 8 * JT, need: 90 },
  { name: 'Iklan Obat Masuk Angin', weeks: 2, pay: 6 * JT, need: 70 },
  { name: 'FTV Siang Bolong', weeks: 4, pay: 12 * JT, need: 140 },
  { name: 'Company Profile Pabrik Kerupuk', weeks: 3, pay: 9 * JT, need: 100 },
  { name: 'Prewedding Juragan Sapi', weeks: 2, pay: 7 * JT, need: 75 },
  { name: 'Iklan Mie Instan', weeks: 3, pay: 10 * JT, need: 110 },
];
