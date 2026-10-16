// v5 systems (pure logic, no Phaser): Gosip & Infotainment + boikot, Casting & audisi (traits, chemistry, rewel /
// mogok), Product placement, Feed netizen, KPI (Komisi Penyiaran fiktif) teguran meter, save migration.
// Hooked into Sim (release / weekly / twist / events). All names are fictional.
import { GENRES, ROLES, type PointKey, type Role } from './data';
import {
  rr, ri, pick, dateOf, makeStaff, fmtShort, fmtFollowers, TICKS_PER_WEEK,
  type GameState, type Staff, type Show, type Pending, type Production,
} from './state';
import { inflation } from './economy';
import type { Sim } from './sim';

const JT = 1_000_000;
const short = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
const isActor = (st: Staff) => st.role === 'aktor' || st.role === 'aktris';

// ================================================================== traits (casting)
export interface TraitDef { id: string; name: string; nameF?: string; desc: string; point?: PointKey; mult?: number; blooper?: number }
export const TRAITS: TraitDef[] = [
  { id: 'cengeng', name: 'Tukang Nangis', desc: 'Air mata keluar sendiri. Air Mata +25%.', point: 'airmata', mult: 1.25 },
  { id: 'kocak', name: 'Kocak', desc: 'Ngelucu tanpa naskah. Komedi +25%.', point: 'komedi', mult: 1.25 },
  { id: 'ekspresif', name: 'Ekspresif', desc: 'Melotot level dewa. Drama +20%.', point: 'drama', mult: 1.2 },
  { id: 'fotogenik', name: 'Fotogenik', desc: 'Kamera cinta dia. Visual +20%.', point: 'visual', mult: 1.2 },
  { id: 'disiplin', name: 'Disiplin', desc: 'Hafal naskah, datang on time. Blooper -40%.', blooper: 0.6 },
  { id: 'setia', name: 'Setia', desc: 'Susah dibajak, loyalitas awet.' },
  { id: 'rewel', name: 'Rewel', desc: 'Bagus, tapi sering minta naik gaji & ngancam mogok.' },
  { id: 'drama', name: 'Drama King', nameF: 'Drama Queen', desc: 'Magnet gosip. Kalau digoreng, rating naik lebih tinggi.' },
];
export function traitById(id: string | undefined) { return TRAITS.find((t) => t.id === id); }
export function traitName(st: Staff): string {
  const t = traitById(st.trait);
  if (!t) return '';
  return st.look.female && t.nameF ? t.nameF : t.name;
}
/** point multiplier from an actor's trait */
export function traitMult(st: Staff, key: PointKey): number {
  const t = traitById(st.trait);
  return t && t.point === key && t.mult ? t.mult : 1;
}
export function traitBlooper(st: Staff): number { return traitById(st.trait)?.blooper ?? 1; }
export function randomTrait(): string { return pick(TRAITS).id; }

// ================================================================== chemistry
function hash(a: number, b: number) { let h = (Math.min(a, b) * 73856093) ^ (Math.max(a, b) * 19349663); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; }
export function chemKey(a: number, b: number) { return `${Math.min(a, b)}|${Math.max(a, b)}`; }
/** on-screen chemistry of a lead pair (35-75 by luck of the stars, castings can find better) */
export function chemistry(s: GameState, a: number | null, b: number | null): number {
  if (a == null || b == null || a === b) return 50;
  const k = chemKey(a, b);
  if (s.chem[k] !== undefined) return s.chem[k];
  return 35 + (hash(a, b) % 41);
}
export function chemLabel(c: number): string { return c >= 85 ? 'Klop banget!' : c >= 70 ? 'Cocok' : c >= 50 ? 'Biasa' : 'Canggung'; }
/** rating multiplier from the lead pair's chemistry */
export function chemMult(c: number): number { return 1 + (c - 55) / 400; }

// ================================================================== audition (casting minigame)
export type SceneId = 'nangis' | 'marah' | 'romantis' | 'lucu';
export const SCENES: { id: SceneId; name: string; blurb: string; stat: 'akting' | 'pesona'; trait: string[] }[] = [
  { id: 'nangis', name: 'Adegan Nangis', blurb: 'Ditinggal nikah pas hujan', stat: 'akting', trait: ['cengeng', 'drama'] },
  { id: 'marah', name: 'Adegan Marah', blurb: 'Nampar sambil melotot', stat: 'akting', trait: ['ekspresif', 'drama', 'rewel'] },
  { id: 'romantis', name: 'Adegan Romantis', blurb: 'Tatap-tatapan slow motion', stat: 'pesona', trait: ['fotogenik', 'setia'] },
  { id: 'lucu', name: 'Adegan Lucu', blurb: 'Kepeleset kulit pisang', stat: 'akting', trait: ['kocak'] },
];
export interface Audition { role: Role; cands: Staff[]; scene: SceneId | null; scores: number[]; chem: number[]; week: number;
  /** v5.1: the lead the chemistry was rolled against (null = nobody yet); older saves: undefined */
  partnerId?: number | null }
/** the partner of an audition: the one it was rolled against while they are still in the studio */
export function auditionPartner(s: GameState, a: Audition): Staff | undefined {
  if (a.partnerId === null) return undefined;
  if (a.partnerId !== undefined) return s.staff.find((x) => x.id === a.partnerId);
  return partnerFor(s, a.role);
}
export function auditionCost(s: GameState): number {
  return Math.round((1.2 * JT + Math.min(6 * JT, s.fans * 25)) * inflation(dateOf(s.absWeek).year) / 100000) * 100000;
}
/** the current top lead of the opposite gender (the new actor's on-screen partner) */
export function partnerFor(s: GameState, role: Role): Staff | undefined {
  const want = role === 'aktor' ? 'aktris' : 'aktor';
  return s.staff.filter((x) => x.role === want).sort((a, b) => b.stats.pesona + b.followers / 20000 - (a.stats.pesona + a.followers / 20000))[0];
}
export function startAudition(sim: Sim, role: Role): string | null {
  const s = sim.s;
  const c = auditionCost(s);
  if (s.money < c) return 'Uang nggak cukup buat sewa ruang audisi.';
  sim.money(-c, 'Audisi', 'Rekrut staf');
  const used = new Set(s.staff.map((x) => x.name));
  const q = 1 + Math.min(1.6, s.fans / 60000) + (s.studio - 1) * 0.15;
  const cands: Staff[] = [];
  const traits = [...TRAITS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 3; i++) {
    const st = makeStaff(s.nextId++, role, q * rr(0.9, 1.25), used);
    st.trait = traits[i].id;
    if (st.trait === 'setia') st.loyalty = ri(75, 92);
    if (st.trait === 'rewel') { st.stats.akting = Math.round(st.stats.akting * 1.15); st.stats.pesona = Math.round(st.stats.pesona * 1.1); }
    cands.push(st);
  }
  const partner = partnerFor(s, role);
  const chem = cands.map((x) => (partner ? Math.max(30, Math.min(99, Math.round(rr(38, 92) + (x.trait === 'fotogenik' ? 6 : 0)))) : 50));
  s.audition = { role, cands, scene: null, scores: [], chem, week: s.absWeek, partnerId: partner ? partner.id : null };
  s.stats5.castings++;
  return null;
}
/** the test scene: every candidate performs, revealing a 1-5 star score (stat + trait affinity + nerves) */
export function auditionScene(s: GameState, scene: SceneId): number[] {
  const a = s.audition;
  if (!a || a.scene) return a?.scores ?? [];
  const def = SCENES.find((x) => x.id === scene)!;
  a.scene = scene;
  a.scores = a.cands.map((c) => {
    let v = c.stats[def.stat] / (20 + c.level * 7) * 2.4 + (def.trait.includes(c.trait ?? '') ? 1.6 : 0) + rr(-0.7, 0.7);
    v = Math.max(1, Math.min(5, Math.round(v)));
    return v;
  });
  // a great test scene sticks: their first scene skill grows a little
  a.cands.forEach((c, i) => { if (a.scores[i] >= 4) c.stats[def.stat] += 2; });
  return a.scores;
}
export function auditionHire(sim: Sim, idx: number): string | null {
  const s = sim.s;
  const a = s.audition;
  if (!a || !a.cands[idx]) return 'Audisinya sudah bubar.';
  if (s.staff.length >= sim.maxStaff()) return 'Studio penuh! Upgrade studio atau lepas staf dulu.';
  const c = a.cands[idx];
  const fee = sim.hireFee(c);
  if (s.money < fee) return 'Uang nggak cukup buat kontraknya.';
  sim.money(-fee, 'Kontrak', 'Rekrut staf');
  c.room = 'kantin'; c.activity = 'idle'; c.travel = 0;
  s.staff.push(c);
  // v5.1 fix: the chemistry was rolled against the lead at audition time; store it for that pair (if they are still
  // in the studio), never for whoever happens to be the top lead now
  const partner = auditionPartner(s, a);
  if (partner && partner !== c) {
    const ch = a.chem[idx];
    s.chem[chemKey(c.id, partner.id)] = ch;
    s.stats5.bestChem = Math.max(s.stats5.bestChem, ch);
  }
  s.audition = null;
  return null;
}

// ================================================================== product placement
export interface SponsorDef { id: string; name: string; cat: string; fit: string[]; line: string }
export const SPONSORS: SponsorDef[] = [
  { id: 'mi', name: 'Mi Instan "Selera Emak"', cat: 'mi instan', fit: ['keluarga', 'komedi', 'remaja'], line: 'Tokoh utama galau... langsung masak mi rebus pakai telor.' },
  { id: 'jamu', name: 'Jamu "Angin Minggat"', cat: 'obat masuk angin', fit: ['azab', 'keluarga', 'horor'], line: 'Habis dikejar kuntilanak, minum jamu dulu biar nggak masuk angin.' },
  { id: 'kopi', name: 'Kopi Sachet "Melek Terus"', cat: 'kopi sachet', fit: ['laga', 'remaja', 'kolosal'], line: 'Pendekar begadang nyeduh kopi sebelum duel.' },
  { id: 'sabun', name: 'Sabun "Wangi Tujuh Rupa"', cat: 'sabun mandi', fit: ['romansa', 'siluman'], line: 'Adegan mandi di sungai, botol sabunnya nongol 10 detik.' },
  { id: 'kecap', name: 'Kecap "Hitam Legam"', cat: 'kecap', fit: ['keluarga', 'komedi'], line: 'Mertua nyiram kecap ke nasi goreng menantu. Close up!' },
  { id: 'ojol', name: 'Ojek Online "GasPol"', cat: 'ojek online', fit: ['remaja', 'romansa', 'komedi'], line: 'Kejar-kejaran di bandara pakai ojol, jaketnya hijau terang.' },
  { id: 'bank', name: 'Bank "Duit Aman Sentosa"', cat: 'bank', fit: ['keluarga', 'religi'], line: 'Warisan direbutin, untung ditabung di bank.' },
  { id: 'sambal', name: 'Sambal "Pedas Mampus"', cat: 'sambal sachet', fit: ['laga', 'komedi', 'horor'], line: 'Tokoh jahat kepedesan, rencananya gagal total.' },
  { id: 'skincare', name: 'Skincare "Glowing Abadi"', cat: 'skincare', fit: ['romansa', 'remaja', 'siluman'], line: 'Siluman ular dandan pakai serum sebelum berubah wujud.' },
  { id: 'sirup', name: 'Sirup "Merah Delima"', cat: 'sirup', fit: ['religi', 'keluarga'], line: 'Buka puasa bareng keluarga, sirupnya disorot pelan-pelan.' },
  { id: 'batuk', name: 'Obat Batuk "Uhuk Reda"', cat: 'obat batuk', fit: ['azab', 'kolosal'], line: 'Raja batuk-batuk di singgasana, tabib bawa sirup obat batuk.' },
  { id: 'cat', name: 'Cat Tembok "Warna Warni"', cat: 'cat tembok', fit: ['komedi', 'keluarga'], line: 'Rumah mertua dicat ulang pas lagi berantem.' },
];
export function sponsorById(id: string) { return SPONSORS.find((x) => x.id === id); }
export interface Offer { id: string; pay: number }
const PL_BASE: Record<string, number> = { lokal: 1.1 * JT, nasional: 3.5 * JT, streaming: 8 * JT };
export function makeOffer(s: GameState, p: Production, exclude: string[]): Offer | null {
  const pool = SPONSORS.filter((x) => !exclude.includes(x.id));
  if (!pool.length) return null;
  const sp = pick(pool);
  const fame = 1 + Math.min(1, s.fans / 250000);
  const pay = Math.round((PL_BASE[p.platform] ?? PL_BASE.lokal) * fame * Math.pow(p.eps / 13, 0.5) * inflation(dateOf(s.absWeek).year) * rr(0.8, 1.2) / 100000) * 100000;
  return { id: sp.id, pay };
}
/** new production: 2-3 sponsors knock on the door */
export function initOffers(s: GameState, p: Production) {
  p.offers = []; p.placements = [];
  const n = ri(2, 3);
  for (let i = 0; i < n; i++) { const o = makeOffer(s, p, p.offers.map((x) => x.id)); if (o) p.offers.push(o); }
}
/** weighted placement count (sponsors that fit the genre feel natural and count half) */
export function placementWeight(p: { genre: string; placements: string[] }): number {
  return p.placements.reduce((a, id) => a + (sponsorById(id)?.fit.includes(p.genre) ? 0.5 : 1), 0);
}
/** rating penalty from too many placements (netizen protest) */
export function placementPenalty(w: number): number {
  if (w <= 2) return 0;
  return Math.min(0.3, 0.08 + 0.06 * (w - 3 > 0 ? w - 3 : 0));
}
export const PLACEMENT_SAFE = 2;
export function acceptOffer(sim: Sim, id: string): string | null {
  const p = sim.s.prod;
  if (!p) return 'Belum ada produksi.';
  if (p.phase === 'editing' && p.phaseTick > p.phaseTicks[2] * 0.6) return 'Udah final editing, nggak bisa nyelipin iklan.';
  const o = p.offers.find((x) => x.id === id);
  if (!o) return 'Tawarannya sudah lewat.';
  p.offers = p.offers.filter((x) => x !== o);
  p.placements.push(o.id);
  p.placementPay += o.pay;
  sim.money(o.pay, 'Product placement', 'Product placement', { revenue: true });
  sim.s.stats5.placements++;
  return null;
}
export function declineOffer(sim: Sim, id: string) {
  const p = sim.s.prod;
  if (p) p.offers = p.offers.filter((x) => x.id !== id);
}

// ================================================================== KPI (Komisi Penyiaran fiktif)
export const KPI_NAME = 'KPI (Komisi Penyiaran Imajiner)';
export const KPI_WARN = 40;
export const KPI_SANCTION = 70;
/** teguran points per release by genre (lebay / sadis / horor), religi calms them down */
const GENRE_KPI: Record<string, number> = { azab: 15, horor: 12, siluman: 10, laga: 9, kolosal: 6, romansa: 4, remaja: 4, komedi: 3, keluarga: 1, religi: -10 };
export function releaseKpi(p: { genre: string; points: Record<PointKey, number>; sensor?: boolean }): number {
  const tot = (p.points.drama + p.points.airmata + p.points.komedi + p.points.visual) || 1;
  const lebay = (p.points.drama + p.points.airmata) / tot; // melodrama share
  const g = GENRE_KPI[p.genre] ?? 3;
  let v = g > 0 ? g * (0.6 + lebay * 0.8) : g;
  if (p.sensor && v > 0) v *= 0.35;
  return Math.round(v * 10) / 10;
}
export function sowanCost(s: GameState): number { return Math.round(6 * JT * inflation(dateOf(s.absWeek).year) / 100000) * 100000; }
export function fineCost(s: GameState): number {
  const tier = s.platforms.includes('streaming') ? 3 : s.platforms.includes('nasional') ? 2 : 1;
  return Math.round(12 * JT * tier * inflation(dateOf(s.absWeek).year) / 1_000_000) * 1_000_000;
}
export const SOWAN_CD = 12;
export function canSowan(s: GameState): string | null {
  if (s.kpi < 5) return 'Meter teguran udah bersih, Bos.';
  if (s.absWeek - s.kpiSowanWeek < SOWAN_CD) return `Baru sowan. Coba lagi ${SOWAN_CD - (s.absWeek - s.kpiSowanWeek)} minggu lagi.`;
  return null;
}
export function sowan(sim: Sim): string | null {
  const s = sim.s;
  const e = canSowan(s);
  if (e) return e;
  const c = sowanCost(s);
  if (s.money < c) return 'Uang nggak cukup.';
  sim.money(-c, 'Sosialisasi KPI', 'Lain-lain');
  s.kpiSowanWeek = s.absWeek;
  addKpi(sim, -22);
  return null;
}
export function addKpi(sim: Sim, v: number) {
  const s = sim.s;
  const before = s.kpi;
  s.kpi = Math.max(0, Math.min(100, Math.round((s.kpi + v) * 10) / 10));
  if (s.kpi < 25 && s.kpiStage > 0) s.kpiStage = 0;
  if (before < KPI_WARN && s.kpi >= KPI_WARN && s.kpiStage === 0) {
    s.kpiStage = 1;
    s.stats5.kpiWarns++;
    sim.push({ kind: 'event', eventId: 'kpi', data: { stage: 1 } });
    post(s, 'news', `${KPI_NAME} layangkan SURAT TEGURAN ke studio kita! Katanya adegannya kebanyakan lebay & sadis.`, '#TeguranKPI');
  } else if (s.kpi >= KPI_SANCTION && s.kpiStage < 2) {
    s.kpiStage = 2;
    const sh = airingShows(sim)[0];
    // repeat offenders (another sanction within half a year) pay a fine on top of whatever they pick
    const repeat = s.absWeek - s.kpiLastSanction < 24 ? 1 : 0;
    s.kpiLastSanction = s.absWeek;
    sim.push({ kind: 'event', eventId: 'kpi', data: { stage: 2, showId: sh ? sh.id : -1, fine: Math.round(fineCost(s) * (repeat ? 1.5 : 1) / 1_000_000) * 1_000_000, repeat } });
    post(s, 'news', `BREAKING: KPI siapkan SANKSI buat sinetron kita. Jam tayang terancam digeser ke tengah malam!`, '#SanksiKPI');
  }
}
export const SLOT_WEEKS = 4;
export const SLOT_PEN = 0.3;

// ================================================================== gosip & infotainment
export type GosipKind = 'cinlok' | 'skandal' | 'cerai' | 'viral';
export const SKANDAL_LINES = [
  'kepergok joget TikTok di nikahan mantan',
  'ketahuan beli followers bot 200 ribu',
  'ribut sama abang ojol gara-gara titik jemput',
  'ngaku-ngaku lulusan luar negeri, ternyata kursus online 2 minggu',
  'live IG sambil marah-marah ke tukang parkir',
  'kepergok makan di warteg pakai kacamata hitam & masker biar nggak dikenali',
];
export const VIRAL_LINES = [
  'nangis beneran pas adegan diputusin, videonya ditonton 8 juta kali',
  'joget di sela syuting pakai kostum siluman, jadi sound viral',
  'salah sebut nama lawan main 12 kali, cuplikannya jadi meme',
];
export function makeGosip(sim: Sim): Pending | null {
  const s = sim.s;
  const actors = s.staff.filter(isActor);
  if (!actors.length) return null;
  const weight = (x: Staff) => 1 + (x.trait === 'drama' ? 3 : 0) + (x.followers >= 30000 ? 1.5 : 0) + (x.star ? 1 : 0);
  const pickW = (arr: Staff[]) => { const t = arr.reduce((a, x) => a + weight(x), 0); let r = Math.random() * t; for (const x of arr) { r -= weight(x); if (r <= 0) return x; } return arr[0]; };
  const st = pickW(actors);
  const on = airingShows(sim);
  const sh = on.find((x) => x.leads.includes(st.id)) ?? on[0];
  const kinds: GosipKind[] = ['skandal', 'skandal', 'viral', 'cerai'];
  const partner = actors.find((x) => x.id !== st.id && x.look.female !== st.look.female);
  if (partner) kinds.push('cinlok', 'cinlok');
  const kind = pick(kinds);
  const data: Record<string, number | string> = { kind, staffId: st.id, showId: sh ? sh.id : -1 };
  if (kind === 'cinlok' && partner) data.staffId2 = partner.id;
  if (kind === 'skandal') data.line = ri(0, SKANDAL_LINES.length - 1);
  if (kind === 'viral') data.line = ri(0, VIRAL_LINES.length - 1);
  data.cost = Math.round((1.5 * JT + s.fans * 40) * inflation(dateOf(s.absWeek).year) / 100000) * 100000;
  return { kind: 'event', eventId: 'gosip', data };
}
export function airingShows(sim: Sim): Show[] { return sim.s.shows.filter((x) => sim.isAiring(x)); }
/** gossip response: 0 klarifikasi, 1 goreng buat rating, 2 diam (viral: 0 goreng, 1 biasa aja) */
export function resolveGosip(sim: Sim, d: Record<string, number | string>, choice: number): string {
  const s = sim.s;
  const st = s.staff.find((x) => x.id === d.staffId);
  const st2 = s.staff.find((x) => x.id === d.staffId2);
  const sh = s.shows.find((x) => x.id === d.showId && sim.isAiring(x));
  const kind = d.kind as GosipKind;
  if (!st) return 'Gosipnya basi, orangnya udah nggak di studio.';
  s.stats5.gossips++;
  const dq = st.trait === 'drama' ? 1.4 : 1;
  const name = st.name;
  const boost = (v: number, w: number) => { if (sh) { sh.gBoost = Math.max(sh.gWeeks > 0 ? sh.gBoost : 0, v); sh.gWeeks = Math.max(sh.gWeeks, w); } };
  if (kind === 'viral') {
    if (choice === 0) {
      sim.addFollowers(st, st.followers * 0.12 + 3000);
      s.fans += Math.round(250 + s.fans * 0.03);
      boost(0.12 * dq, 3); s.stats5.goreng++;
      post(s, 'fan', `${name} viral lagi!! Fix aku nonton ${sh ? `"${short(sh.title, 22)}"` : 'sinetronnya'} malam ini`, '#' + tagName(name));
      return `Studio ikut repost & bikin konten lanjutan. ${name} makin ngetop${sh ? `, rating "${short(sh.title, 18)}" naik 3 minggu` : ''}!`;
    }
    sim.addFollowers(st, st.followers * 0.05 + 1000);
    s.fans += Math.round(100 + s.fans * 0.01);
    return `${name} cuma bilang "makasih semuanya". Followers tetap nambah.`;
  }
  const heavy = kind === 'skandal' || kind === 'cerai';
  if (choice === 0) {
    const c = Number(d.cost);
    sim.money(-c, 'Klarifikasi', 'Lain-lain');
    s.boikot = Math.max(0, s.boikot - 12);
    st.loyalty = Math.min(100, st.loyalty + 6);
    if (st.followers >= 20000) sim.addFollowers(st, -st.followers * 0.02);
    post(s, 'news', `${name} gelar konferensi pers soal ${kind === 'cinlok' ? 'cinlok di lokasi syuting' : kind === 'cerai' ? 'isu cerai' : 'video yang beredar'}. Netizen mulai adem.`, '#Klarifikasi');
    return `Konferensi pers + air mata. Netizen adem, ${name} makin sayang studio.`;
  }
  if (choice === 1) {
    const v = (kind === 'cinlok' ? 0.18 : heavy ? 0.22 : 0.15) * dq;
    boost(v, 3);
    sim.addFollowers(st, st.followers * 0.08 + 2000);
    if (st2) sim.addFollowers(st2, st2.followers * 0.06 + 1500);
    s.fans += Math.round(150 + s.fans * 0.02);
    s.boikot = Math.min(100, s.boikot + (heavy ? 32 : 18));
    st.loyalty = Math.max(0, st.loyalty - (heavy ? 10 : 5));
    s.stats5.goreng++;
    addKpi(sim, heavy ? 5 : 3);
    post(s, 'gossip', `${kind === 'cinlok' ? `CINLOK ALERT! ${name} & ${st2?.name ?? 'lawan mainnya'} makin lengket` : `${name} ${kind === 'cerai' ? 'resmi digugat cerai' : 'makin panas'}`}... tim sinetron malah bikin teaser 😭`, '#' + tagName(name));
    post(s, 'hater', heavy ? 'Studio sengaja goreng gosip biar rating naik. Murahan!' : 'Gimmick doang ini mah, tapi tetep gue tonton sih', heavy ? '#Boikot' + tagName(sh ? sh.title : name) : undefined);
    return `Gosip digoreng! ${sh ? `Rating "${short(sh.title, 18)}" naik ${Math.round(v * 100)}% selama 3 minggu` : 'Fans nambah'}, tapi netizen mulai panas (risiko boikot).`;
  }
  // diam
  const r = Math.random();
  if (r < 0.5) { post(s, 'fan', `Udahlah, biarin ${name} hidup tenang. Fokus ke aktingnya aja`); return 'Didiemin aja. Dua minggu kemudian netizen lupa sendiri.'; }
  if (r < 0.8 || heavy) {
    s.fans = Math.max(0, Math.round(s.fans * (heavy ? 0.96 : 0.98)));
    s.boikot = Math.min(100, s.boikot + (heavy ? 16 : 8));
    if (st.followers >= 20000) sim.addFollowers(st, -st.followers * 0.04);
    post(s, 'hater', `Kok diem aja sih? Berarti bener dong gosipnya ${name}...`, '#' + tagName(name));
    return 'Studio diam, netizen makin kepo. Fans sedikit berkurang.';
  }
  s.fans += Math.round(s.fans * 0.02);
  return `Misterius! Netizen malah penasaran sama ${name}.`;
}
export function tagName(t: string) { return t.replace(/^(Bang|Mas|Kang|Pak|Om|Cak|Mbak|Teh|Bu|Neng|Kak|Ceu) /, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 18) || 'Sinetron'; }

/** weekly: anger fades; when it boils over an airing show gets boycotted */
export function boikotWeek(sim: Sim) {
  const s = sim.s;
  if (s.boikot > 0) s.boikot = Math.max(0, Math.round((s.boikot - 1.6) * 10) / 10);
  if (s.boikot >= BOIKOT_AT && !s.gameOver && Math.random() < 0.3) {
    const sh = airingShows(sim).filter((x) => x.bWeeks <= 0).sort((a, b) => b.rating - a.rating)[0];
    if (!sh) return;
    sim.push({ kind: 'event', eventId: 'boikot', data: { showId: sh.id, cost: Math.round((4 * JT + s.fans * 60) * inflation(dateOf(s.absWeek).year) / 100000) * 100000 } });
    s.stats5.boikots++;
    post(s, 'hater', `#Boikot${tagName(sh.title)} TRENDING! Jangan ditonton, uninstall TV kalian!!1!`, '#Boikot' + tagName(sh.title));
  }
}
export const BOIKOT_PEN = 0.25;
export const BOIKOT_AT = 55;
export function resolveBoikot(sim: Sim, d: Record<string, number | string>, choice: number): string {
  const s = sim.s;
  const sh = s.shows.find((x) => x.id === d.showId);
  if (choice === 0) {
    sim.money(-Number(d.cost), 'Minta maaf publik', 'Lain-lain');
    s.boikot = 18;
    if (sh) { sh.bWeeks = 2; sh.bPen = BOIKOT_PEN / 2; }
    post(s, 'news', `Pihak studio minta maaf terbuka. Sebagian netizen memaafkan, sebagian bikin meme.`, '#MaafNetizen');
    return 'Video permintaan maaf (pakai baju putih, latar polos). Boikot mereda, rating cuma turun sedikit 2 minggu.';
  }
  if (sh) { sh.bWeeks = 4; sh.bPen = BOIKOT_PEN; }
  s.fans = Math.max(0, Math.round(s.fans * 0.96));
  s.boikot = 35;
  return `Studio cuek. ${sh ? `"${short(sh.title, 20)}" kena boikot: rating -25% selama 4 minggu, ` : ''}fans berkurang 4%.`;
}

// ================================================================== rewel / mogok
export function rewelEvent(sim: Sim): Pending | null {
  const s = sim.s;
  const actors = s.staff.filter((x) => isActor(x) && (x.trait === 'rewel' || x.star || x.followers >= 100000 || x.loyalty < 35));
  if (!actors.length) return null;
  const st = pick(actors);
  const p = s.prod;
  const lead = p && (p.leadM === st.id || p.leadF === st.id) && p.phase !== 'editing';
  if (lead) return { kind: 'event', eventId: 'mogok', data: { staffId: st.id, cost: Math.round(Math.max(2 * JT, st.salary * 0.6) / 100000) * 100000, demand: pick(['trailer ber-AC', 'naskah ditambah adegan nangis', 'nasi kotak menu rendang tiap hari', 'kamar hotel bintang lima pas syuting', 'asisten pribadi 3 orang']) } };
  return { kind: 'event', eventId: 'rewel', data: { staffId: st.id, amount: Math.max(250000, Math.round((st.salary * 0.25) / 50000) * 50000) } };
}
export function resolveRewel(sim: Sim, d: Record<string, number | string>, choice: number): string {
  const s = sim.s;
  const st = s.staff.find((x) => x.id === d.staffId);
  if (!st) return 'Eh, orangnya udah nggak ada.';
  if (choice === 0) { st.salary += Number(d.amount); st.loyalty = Math.min(100, st.loyalty + 10); return `${st.name} senyum lagi. Gajinya naik ${fmtShort(Number(d.amount))}/bln.`; }
  st.loyalty = Math.max(0, st.loyalty - 14);
  if (s.prod && Math.random() < 0.55) { st.strike = 2; post(s, 'gossip', `Kabarnya ${st.name} MOGOK syuting gara-gara gaji nggak naik. Kru bengong.`, '#' + tagName(st.name)); return `${st.name} ngambek & MOGOK 2 minggu! Nggak mau kerja sama sekali.`; }
  return `${st.name} manyun berat. Loyalitas anjlok.`;
}
export function resolveMogok(sim: Sim, d: Record<string, number | string>, choice: number): string {
  const s = sim.s;
  const st = s.staff.find((x) => x.id === d.staffId);
  if (!st) return 'Eh, orangnya udah nggak ada.';
  if (choice === 0) { sim.money(-Number(d.cost), 'Turuti artis', 'Honor pemain'); st.loyalty = Math.min(100, st.loyalty + 4); return `Permintaan dituruti. ${st.name} balik syuting sambil senyum.`; }
  if (choice === 1) {
    const chance = 0.2 + st.loyalty / 100 * 0.65;
    if (Math.random() < chance) { st.loyalty = Math.min(100, st.loyalty + 6); return `Dibujuk pakai martabak manis. ${st.name} luluh & balik syuting!`; }
    st.strike = 2; st.loyalty = Math.max(0, st.loyalty - 8);
    post(s, 'gossip', `${st.name} mogok syuting, ngurung diri di ruang makeup. Sutradara pusing.`, '#' + tagName(st.name));
    return `Gagal bujuk. ${st.name} MOGOK 2 minggu!`;
  }
  // ganti peran: drop from lead
  const p = s.prod;
  if (p) { if (p.leadM === st.id) p.leadM = null; if (p.leadF === st.id) p.leadF = null; }
  st.loyalty = Math.max(0, st.loyalty - 18);
  post(s, 'gossip', `Heboh! ${st.name} DICOPOT dari peran utama gara-gara rewel.`, '#' + tagName(st.name));
  return `${st.name} dicopot dari peran utama. Produksi lanjut tanpa dia (loyalitasnya anjlok).`;
}

// ================================================================== feed netizen
export type FeedKind = 'fan' | 'hater' | 'news' | 'gossip' | 'critic' | 'random';
export interface FeedPost { id: number; w: number; u: number; t: string; likes: number; rt: number; tag?: string; kind: FeedKind }
export const USERS: { name: string; handle: string; col: number; kind: FeedKind[] }[] = [
  { name: 'Emak Rempong', handle: '@emakrempong', col: 0xe0508a, kind: ['fan', 'random'] },
  { name: 'Bocah Sinetron', handle: '@bocahsinetron', col: 0x4a90e0, kind: ['fan', 'random'] },
  { name: 'Tante Gosip', handle: '@tantegosip_', col: 0xd0602a, kind: ['gossip'] },
  { name: 'Kang Kritik', handle: '@kangkritik', col: 0x6a6a7a, kind: ['critic', 'hater'] },
  { name: 'Ukhti Baper', handle: '@ukhtibaper', col: 0x2e8b6a, kind: ['fan'] },
  { name: 'Mas Garing', handle: '@masgaring', col: 0xb08a2a, kind: ['random', 'hater'] },
  { name: 'Netijen Maha Benar', handle: '@netijenbenar', col: 0xc0392b, kind: ['hater'] },
  { name: 'Fanbase Azab Garis Keras', handle: '@azabfanbase', col: 0x7a3ab0, kind: ['fan'] },
  { name: 'Info Sinetron', handle: '@infosinetron', col: 0x2d6cb0, kind: ['news'] },
  { name: 'Lambe Nyinyir', handle: '@lambenyinyir', col: 0x1a1a2a, kind: ['gossip'] },
  { name: 'Bapak-Bapak Pos Ronda', handle: '@posronda', col: 0x5a7a3a, kind: ['random', 'critic'] },
  { name: 'Dedek Gemes', handle: '@dedekgemes', col: 0xf08ab0, kind: ['fan'] },
  { name: 'Pakar Rating', handle: '@pakarrating', col: 0x3a8a9a, kind: ['news', 'critic'] },
  { name: 'Rakyat Jelata', handle: '@rakyatjelata', col: 0x8a5a2a, kind: ['random', 'hater'] },
];
export function post(s: GameState, kind: FeedKind, text: string, tag?: string) {
  // the same line twice in a row looks like a bot farm: skip repeats among the recent posts
  if (s.feed.slice(0, 12).some((p) => p.t === text)) return;
  const pool = USERS.map((u, i) => ({ u, i })).filter((x) => x.u.kind.includes(kind));
  const u = (pool.length ? pick(pool) : { i: 0 }).i;
  const fame = 1 + Math.log10(1 + s.fans / 1000);
  const likes = Math.round(rr(5, 60) * fame * fame * (kind === 'gossip' || kind === 'news' ? 2.2 : 1));
  s.feed.unshift({ id: ++s.feedSeq, w: s.absWeek, u, t: text, likes, rt: Math.round(likes * rr(0.05, 0.4)), tag, kind });
  if (s.feed.length > 60) s.feed.length = 60;
}
export function trending(s: GameState): { tag: string; n: number }[] {
  const m = new Map<string, number>();
  for (const p of s.feed) if (p.tag && s.absWeek - p.w <= 8) m.set(p.tag, (m.get(p.tag) ?? 0) + 1 + p.likes / 5000);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag, n]) => ({ tag, n: Math.round(n) }));
}
const FAN_GOOD = ['Fix ini sinetron terbaik tahun ini, nangis sampe bantal basah', 'Emak gue sampe nggak masak gara-gara nonton {t}', 'Episode kemarin bikin merinding, sutradaranya jenius', '{t} wajib ditonton, NO DEBAT', 'Udah jam 7, waktunya {t}! Remote jangan direbut adek'];
const FAN_MEH = ['{t} lumayan sih, buat temen makan malem', 'Ceritanya biasa aja, tapi pemerannya cakep', 'Nonton {t} sambil scroll HP, masih ngikutin kok'];
const HATE = ['{t} ceritanya muter-muter kayak tukang parkir nyari celah', 'Episode 1 sampe sekarang konfliknya itu-itu aja', 'Zoom in ke muka kaget 3x lagi... capek mata gue', 'Kok bisa ya {t} tayang, mending nonton iklan', 'Mertuanya galak banget, gue yang emosi pengen lempar sandal'];
const RANDOM = ['Sinetron sekarang judulnya panjang banget kayak kereta api', 'Kenapa ya tiap tokoh kaget harus ada efek petir', 'Dulu nonton sinetron rebutan remote, sekarang rebutan wifi', 'Nunggu {t} sambil makan gorengan, nikmat mana lagi yang kau dustakan'];
const fill = (t: string, title: string) => t.replace(/\{t\}/g, `"${short(title, 24)}"`);
export function feedRelease(s: GameState, sh: Show) {
  const tag = '#' + tagName(sh.title);
  if (sh.total >= 30) { post(s, 'fan', fill(pick(FAN_GOOD), sh.title), tag); post(s, 'critic', `Skor ${sh.total}/40. Ini baru namanya sinetron berkualitas!`, tag); }
  else if (sh.total >= 20) { post(s, 'fan', fill(pick(FAN_MEH), sh.title), tag); }
  else { post(s, 'hater', fill(pick(HATE), sh.title), tag); post(s, 'critic', `Skor ${sh.total}/40. Penulisnya lagi sakit gigi kayaknya.`); }
  if (sh.placements >= 3) post(s, 'hater', `Ini sinetron apa katalog iklan? ${sh.placements} produk nongol di satu episode!`, '#SinetronIklan');
  if (sh.chem >= 85) post(s, 'fan', `Chemistry pemeran utamanya dapet banget!! Kapal ini HARUS berlayar`, '#ShipperGarisKeras');
}
export function feedWeekly(sim: Sim) {
  const s = sim.s;
  for (const sh of airingShows(sim)) {
    if (Math.random() > 0.3) continue;
    const r = sh.ranks.length ? sh.ranks[sh.ranks.length - 1] : 3;
    const tag = '#' + tagName(sh.title);
    if (r === 1) post(s, 'fan', fill(pick(['{t} nomor 1 lagi! Rating-nya ngalahin semua', 'Satu Indonesia nonton {t}, warung kopi sepi', ...FAN_GOOD]), sh.title), tag);
    else if (r <= 3) post(s, Math.random() < 0.6 ? 'fan' : 'random', fill(pick([...FAN_MEH, ...RANDOM]), sh.title), Math.random() < 0.5 ? tag : undefined);
    else post(s, 'hater', fill(pick(HATE), sh.title), Math.random() < 0.4 ? tag : undefined);
  }
  if (Math.random() < 0.12) post(s, 'random', fill(pick(RANDOM), s.shows.length ? s.shows[s.shows.length - 1].title : 'sinetron'));
}
export const TWIST_FEED_HAPPY = ['PLOT TWIST {k}?! Gue teriak sampe tetangga ngetok pintu', 'Nggak nyangka sama sekali! {t} gila sih', 'Grup WA keluarga langsung rame bahas twist {t}'];
export const TWIST_FEED_MUAK = ['{k} LAGI? Penulisnya kehabisan ide ya', 'Twist-nya bisa ditebak dari episode 1, basi', 'Udahlah, tamatin aja {t}'];
export function feedTwist(s: GameState, sh: Show, cardName: string, mocked: boolean) {
  const t = pick(mocked ? TWIST_FEED_MUAK : TWIST_FEED_HAPPY).replace(/\{k\}/g, cardName.toUpperCase());
  post(s, mocked ? 'hater' : 'fan', fill(t, sh.title), '#' + tagName(sh.title));
}

// ================================================================== hooks
/** release(): rating multiplier from v5 systems + bookkeeping; returns the multiplier */
export function releaseMult(s: GameState, p: Production): { mult: number; chem: number; plW: number; plPen: number; kpi: number } {
  const chem = chemistry(s, p.leadM, p.leadF);
  const plW = placementWeight({ genre: p.genre, placements: p.placements });
  const plPen = placementPenalty(plW);
  const kpi = releaseKpi({ genre: p.genre, points: p.points, sensor: p.sensor });
  const mult = (p.leadM != null && p.leadF != null ? chemMult(chem) : 1) * (1 - plPen) * (p.sensor ? 0.95 : 1);
  return { mult, chem, plW, plPen, kpi };
}
/** expected-rating multiplier while airing (gossip boost, boikot, late-night slot) */
export function airMult(sh: Show): number {
  return (1 + (sh.gWeeks > 0 ? sh.gBoost : 0)) * (1 - (sh.bWeeks > 0 ? sh.bPen : 0)) * (1 - (sh.slotWeeks > 0 ? SLOT_PEN : 0));
}
export function airTick(sh: Show) {
  if (sh.gWeeks > 0) { sh.gWeeks--; if (sh.gWeeks === 0) sh.gBoost = 0; }
  if (sh.bWeeks > 0) { sh.bWeeks--; if (sh.bWeeks === 0) sh.bPen = 0; }
  if (sh.slotWeeks > 0) sh.slotWeeks--;
}
export function resolveKpi(sim: Sim, d: Record<string, number | string>, choice: number): string {
  const s = sim.s;
  if (Number(d.stage) === 1) return 'Dicatat, Pak. Kurangi adegan sadis, azab ekstrem & twist lebay. (Bisa sowan / sensor mandiri buat nurunin meter.)';
  const sh = s.shows.find((x) => x.id === d.showId && sim.isAiring(x));
  if (choice === 0 && sh) {
    sh.slotWeeks = SLOT_WEEKS;
    if (Number(d.repeat)) { const f = Math.round(Number(d.fine) * 0.5 / 1_000_000) * 1_000_000; sim.money(-f, 'Denda KPI', 'Denda KPI'); s.stats5.kpiFines++; }
    s.kpi = 45; s.kpiStage = 1;
    post(s, 'news', `"${short(sh.title, 24)}" resmi digeser ke jam 23.00 oleh KPI. Emak-emak protes udah ngantuk.`, '#JamTayang');
    return `"${short(sh.title, 20)}" digeser ke jam 23.00 selama ${SLOT_WEEKS} minggu (rating -${Math.round(SLOT_PEN * 100)}%).${Number(d.repeat) ? ` Pelanggaran berulang: tetap kena denda ${fmtShort(Math.round(Number(d.fine) * 0.5 / 1_000_000) * 1_000_000)}.` : ''} Meter teguran turun.`;
  }
  const fine = Number(d.fine);
  sim.money(-fine, 'Denda KPI', 'Denda KPI');
  s.stats5.kpiFines++;
  s.kpi = 40; s.kpiStage = 1;
  return `Bayar denda ${fmtShort(fine)}. Jam tayang aman, meter teguran turun.`;
}

// ================================================================== migration
export function emptyStats5(): GameState['stats5'] {
  return { twists: 0, placements: 0, goreng: 0, gossips: 0, castings: 0, bestChem: 0, kpiWarns: 0, kpiFines: 0, ramadanTop: 0, boikots: 0, debtSeen: 0, maxRating: 0, epsTotal: 0, rank1: [] };
}
/** fill in v5 fields for older saves (and validate them so a hand-edited backup can't crash the game) */
export function migrateV5(s: GameState) {
  const exp = s as Partial<GameState>;
  s.achievements = exp.achievements && typeof exp.achievements === 'object' ? exp.achievements : {};
  const st5 = emptyStats5();
  const old = (exp.stats5 && typeof exp.stats5 === 'object' ? exp.stats5 : {}) as Partial<GameState['stats5']>;
  for (const k of Object.keys(st5) as (keyof GameState['stats5'])[]) {
    const v = old[k];
    if (k === 'rank1') (st5.rank1 = Array.isArray(v) ? (v as string[]).filter((x) => typeof x === 'string') : []);
    else if (typeof v === 'number' && isFinite(v)) (st5 as unknown as Record<string, number>)[k] = v;
  }
  s.stats5 = st5;
  if (!exp.stats5) {
    // derive what we can from an old save's history
    st5.maxRating = Math.max(0, ...s.shows.map((x) => x.rating));
    st5.epsTotal = s.shows.reduce((a, x) => a + x.eps, 0);
  }
  s.endingSeen = !!exp.endingSeen;
  s.feed = Array.isArray(exp.feed) ? exp.feed.filter((p) => p && typeof p.t === 'string') : [];
  s.feedSeq = typeof exp.feedSeq === 'number' ? exp.feedSeq : s.feed.length;
  s.feedRead = typeof exp.feedRead === 'number' ? exp.feedRead : s.feedSeq;
  s.kpi = typeof exp.kpi === 'number' && isFinite(exp.kpi) ? Math.max(0, Math.min(100, exp.kpi)) : 0;
  s.kpiStage = typeof exp.kpiStage === 'number' ? exp.kpiStage : 0;
  s.kpiSowanWeek = typeof exp.kpiSowanWeek === 'number' ? exp.kpiSowanWeek : -999;
  s.kpiLastSanction = typeof exp.kpiLastSanction === 'number' ? exp.kpiLastSanction : -999;
  s.boikot = typeof exp.boikot === 'number' && isFinite(exp.boikot) ? Math.max(0, Math.min(100, exp.boikot)) : 0;
  // an old save that already played past the start never sees the first-run tutorial
  if (typeof exp.tut !== 'number') s.tut = s.tutorialSeen || s.shows.length > 0 || !!s.prod ? -1 : 0;
  s.chem = exp.chem && typeof exp.chem === 'object' ? exp.chem : {};
  s.audition = exp.audition && Array.isArray(exp.audition.cands) ? exp.audition : null;
  const fixStaff = (st: Staff) => {
    if (isActor(st) && !traitById(st.trait)) st.trait = TRAITS[st.id % TRAITS.length].id;
    if (typeof st.strike !== 'number') st.strike = 0;
  };
  s.staff.forEach(fixStaff);
  (s.candidates ?? []).forEach(fixStaff);
  (s.starOffers ?? []).forEach(fixStaff);
  if (s.audition) s.audition.cands.forEach(fixStaff);
  for (const sh of s.shows) {
    sh.placements = typeof sh.placements === 'number' ? sh.placements : 0;
    sh.chem = typeof sh.chem === 'number' ? sh.chem : 50;
    sh.gBoost = sh.gBoost ?? 0; sh.gWeeks = sh.gWeeks ?? 0;
    sh.bPen = sh.bPen ?? 0; sh.bWeeks = sh.bWeeks ?? 0;
    sh.slotWeeks = sh.slotWeeks ?? 0;
  }
  if (s.prod) {
    const p = s.prod;
    p.offers = Array.isArray(p.offers) ? p.offers : [];
    p.placements = Array.isArray(p.placements) ? p.placements : [];
    p.placementPay = p.placementPay ?? 0;
    p.sensor = !!p.sensor;
  }
}
void GENRES; void ROLES; void TICKS_PER_WEEK; void fmtFollowers;
