// v4 screens: Kartu Plot Twist (picker + dramatic popup), OST singer picker, Sekuel/Spin-off picker,
// Peralatan, Agensi Bintang, Keuangan. Pixel icons for the twist cards are drawn at runtime.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { GENRES, THEMES, ROLES, sequelTitle, spinoffTitle } from './data';
import { fmtShort, fmtMoney, fmtNum, fmtFollowers, dateOf, type Show, type Staff } from './state';
import { COL, DISPLAY, ROUND, GW, GH, type Modal } from './ui';
import { mk, addTex } from './art';
import { sfx } from './audio';
import { TWISTS, TW_PAL, twistById, TWIST_WEEKS, type TwistDef } from './twists';
import { SINGERS, singerFee, singerFits, singerById, ramadanMonth, type SingerDef } from './ost';
import { EQUIPMENT } from './economy';
import { franchiseBonus, type TwistResult } from './sim';
import { short, card, head } from './screens';

const genreName = (id: string) => GENRES.find((g) => g.id === id)?.name ?? id;
const themeName = (id: string) => THEMES.find((t) => t.id === id)?.name ?? id;

// ================================================================= pixel textures
/** 16x16 twist icons (`tw_<id>`) and a card-back, drawn once */
export function ensureTwistTex(scene: Phaser.Scene) {
  for (const t of TWISTS) {
    const key = 'tw_' + t.id;
    if (scene.textures.exists(key)) continue;
    const [c, ctx] = mk(16, 16);
    t.icon.forEach((row, y) => {
      for (let x = 0; x < Math.min(16, row.length); x++) {
        const ch = row[x];
        const col = TW_PAL[ch];
        if (!col) continue;
        ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
      }
    });
    addTex(scene, key, c);
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!scene.textures.exists('tw_lock')) {
    const [c, ctx] = mk(16, 16);
    const rows = ['................', '.....KKKKKK.....', '....KK....KK....', '....K......K....', '....K......K....', '...KKKKKKKKKK...', '...KYYYYYYYYK...', '...KYYYKKYYYK...', '...KYYYKKYYYK...', '...KYYYYKYYYK...', '...KYYYYYYYYK...', '...KKKKKKKKKK...'];
    rows.forEach((row, y) => { for (let x = 0; x < 16; x++) { const col = TW_PAL[row[x]]; if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } });
    addTex(scene, 'tw_lock', c);
    scene.textures.get('tw_lock').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

/** little singer portrait: face + hair + mic, tinted per singer */
function singerIcon(m: Modal, x: number, y: number, sg: SingerDef, locked = false) {
  const g = m.add(m.scene.add.graphics());
  const col = locked ? 0x9a9aa4 : sg.col;
  g.fillStyle(0x2b1a10, 1); g.fillCircle(x, y, 15);
  g.fillStyle(locked ? 0xcfc4b0 : 0xfff0c8, 1); g.fillCircle(x, y, 13.5);
  g.fillStyle(col, 1); g.fillRect(x - 9, y + 6, 18, 8);
  g.fillStyle(locked ? 0xb0a898 : 0xf0c08a, 1); g.fillCircle(x, y - 1, 7);
  g.fillStyle(locked ? 0x8a8a94 : 0x2a1c14, 1); g.fillRect(x - 7, y - 9, 14, 5); g.fillRect(x - 8, y - 6, 3, 8);
  if (!locked) { g.fillStyle(0x2b1a10, 1); g.fillRect(x - 3, y - 2, 2, 2); g.fillRect(x + 2, y - 2, 2, 2); g.fillStyle(0xd0402e, 1); g.fillRect(x - 1, y + 2, 3, 2); }
  // mic
  g.fillStyle(0x2b1a10, 1); g.fillRect(x + 7, y - 1, 5, 9); g.fillStyle(0xc8c8d0, 1); g.fillRect(x + 8, y, 3, 4); g.fillStyle(0x5a5a66, 1); g.fillRect(x + 9, y + 4, 1, 4);
  return g;
}

function stars(m: Modal, x: number, y: number, pop: number) {
  const n = Math.max(1, Math.round(pop / 20));
  const g = m.add(m.scene.add.graphics());
  for (let i = 0; i < 5; i++) {
    const cx = x + i * 9;
    g.fillStyle(0x2b1a10, 1); g.fillCircle(cx, y, 4);
    g.fillStyle(i < n ? 0xffd23a : 0xd8ccb8, 1); g.fillCircle(cx, y, 3);
  }
}

// ================================================================= Plot Twist picker
export function openTwistPicker(gs: GameScene, sh: Show, after?: () => void) {
  ensureTwistTex(gs);
  const m = gs.modal({ w: 344, h: 560, y: 34, title: 'KARTU PLOT TWIST', closable: true, onClose: after });
  m.build((m) => {
    const sim = gs.sim;
    const unlocked = sim.twistsUnlocked();
    const err = sim.canTwist(sh);
    m.text(14, 20, short(sh.title, 40), 11, COL.text, { font: ROUND, weight: '800' });
    m.text(14, 36, `${genreName(sh.genre)}  ·  twist dimainkan: ${sh.twists.length}${sh.muak > 0 ? `  ·  netizen muak -${Math.round(sh.muak * 100)}%` : ''}`, 9, sh.muak > 0 ? COL.red : COL.muted, { font: ROUND, weight: '700' });
    TWISTS.forEach((t, i) => {
      const x = 10 + (i % 2) * 163, y = 54 + Math.floor(i / 2) * 84;
      const un = unlocked.includes(t.id);
      const pv = un ? sim.twistPreview(sh, t.id) : null;
      const can = un && !err;
      card(m, x, y, 160, 80, !un ? 'paper' : pv && pv.fit ? 'sel' : 'btn', can ? () => playAndShow(gs, m, sh, t) : () => { gs.toast(un ? err! : lockText(t)); sfx.bad(); });
      m.panel(x + 6, y + 8, 40, 40, 'dark');
      m.img(x + 26, y + 28, un ? 'tw_' + t.id : 'tw_lock', 2);
      m.text(x + 52, y + 7, un ? t.name : '???', t.name.length > 16 ? 10 : 11, un ? COL.text : COL.muted, { font: ROUND, weight: '800', wrap: 104, lineSpacing: -3 });
      if (un && pv) {
        m.text(x + 52, y + 38, `+${Math.round(pv.eff * 100)}% · ${TWIST_WEEKS} mg`, 10, COL.green, { font: ROUND, weight: '800' });
        if (pv.fit) m.text(x + 8, y + 56, 'COCOK genre!', 9, '#b0402a', { font: ROUND, weight: '800' });
        if (pv.risky) m.text(x + 152, y + 56, 'Awas muak!', 9, COL.red, { ox: 1, font: ROUND, weight: '800' });
        const used = sh.twists.filter((x) => x === t.id).length + sim.twistRecent(t.id);
        if (!pv.risky && used) m.text(x + 152, y + 56, `dipakai ${used}x`, 9, COL.muted, { ox: 1, font: ROUND, weight: '700' });
      } else m.text(x + 52, y + 40, lockText(t), 9, COL.muted, { wrap: 102, lineSpacing: -1 });
    });
    const y0 = 54 + 5 * 84 + 2;
    m.text(172, y0 + 4, err ?? 'Twist cocok genre = efek lebih gede. Kebanyakan twist,\natau kartu yang sama terus, bikin netizen muak!', 9, err ? COL.red : COL.muted, { ox: 0.5, align: 'center', wrap: 320, font: ROUND, weight: '700' });
  });
  return m;
}
function lockText(t: TwistDef): string {
  const need: string[] = [];
  if (t.unlockShows > 0) need.push(`${t.unlockShows} sinetron`);
  if (t.unlockYear > 1) need.push(`Tahun ${t.unlockYear}`);
  return 'Kebuka: ' + need.join(' & ');
}

function playAndShow(gs: GameScene, picker: Modal, sh: Show, t: TwistDef) {
  const r = gs.sim.playTwist(sh, t.id);
  if (typeof r === 'string') { gs.toast(r); sfx.bad(); return; }
  picker.close();
  gs.refreshHud();
  showTwistPopup(gs, sh, t, r);
}

/** the dramatic moment: white flash, triple zoom on the card, drama sting, netizen reaction */
export function showTwistPopup(gs: GameScene, sh: Show, t: TwistDef, r: TwistResult) {
  ensureTwistTex(gs);
  sfx.stopStings();
  sfx.sting(r.mocked ? 'flop' : t.sting);
  const m = gs.modal({ w: 312, h: 372, y: 120, title: r.mocked ? 'TWIST BASI!' : 'PLOT TWIST!' });
  m.build((m) => {
    // stage: dark box with speed lines + the card art zooming in 3 times
    m.panel(16, 18, 280, 150, 'dark');
    const g = m.add(gs.add.graphics());
    const cx = 156, cy = 100;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      g.lineStyle(i % 2 ? 2 : 1, r.mocked ? 0x8a7a6a : 0xffe08a, 0.5);
      const dy = Math.sin(a) > 0 ? 64 : 76;
      const rmax = Math.min(132 / Math.max(0.001, Math.abs(Math.cos(a))), dy / Math.max(0.001, Math.abs(Math.sin(a))));
      g.lineBetween(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, cx + Math.cos(a) * rmax, cy + Math.sin(a) * rmax);
    }
    const icon = m.img(cx, cy, 'tw_' + t.id, 3);
    const zooms = [2.4, 3.2, 4.0];
    zooms.forEach((z, i) => gs.time.delayedCall(120 + i * 330, () => {
      if (m.closed) return;
      icon.setScale(z * 0.8);
      gs.tweens.add({ targets: icon, scale: z, duration: 180, ease: 'Back.easeOut' });
      gs.cameras.main.shake(90, 0.003 + i * 0.002);
      sfx.pop();
    }));
    m.text(cx, 30, t.name.toUpperCase(), t.name.length > 16 ? 13 : 16, '#ffe066', { ox: 0.5, font: DISPLAY, stroke: '#2b1a10', strokeW: 4 });
    m.text(156, 176, t.line, 11, COL.text, { ox: 0.5, align: 'center', wrap: 280, lineSpacing: 2 });
    const eff = `Rating +${Math.round(r.eff * 100)}% selama ${TWIST_WEEKS} minggu${r.fit ? '  (cocok genre!)' : ''}`;
    m.text(156, 232, eff, 12, COL.green, { ox: 0.5, font: ROUND, weight: '800', align: 'center', wrap: 290 });
    m.text(156, 256, r.reaction, 10, r.mocked ? COL.red : '#7a3a10', { ox: 0.5, align: 'center', wrap: 284, font: ROUND, weight: '700' });
    if (r.mocked) m.text(156, 284, `Netizen muak: rating sisa tayang -${Math.round(r.muak * 100)}%.\nKritikus bakal nyindir di ulasan berikutnya!`, 10, COL.red, { ox: 0.5, align: 'center', wrap: 290, font: ROUND, weight: '800' });
    m.btn(76, 318, 160, 40, r.mocked ? 'Waduh...' : 'Jeng jeng jeng!', () => { m.close(); }, { kind: 'primary', size: 12 });
  });
  // the camera flash
  const flash = gs.add.rectangle(0, 0, GW, GH, 0xffffff, 0.95).setOrigin(0, 0).setDepth(6000);
  gs.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  void sh;
  return m;
}

// ================================================================= OST picker
export interface OstPickOpts { platform: string; genre: string; current: string | null; select: (id: string | null) => void }
export function openOstPicker(gs: GameScene, o: OstPickOpts) {
  const m = gs.modal({ w: 344, h: 590, y: 22, title: 'OST SINETRON', closable: true });
  m.build((m) => {
    const s = gs.s;
    m.text(14, 20, `Lagu tema bareng penyanyi dangdut. Genre: ${genreName(o.genre)}`, 9, COL.muted, { font: ROUND, weight: '700' });
    SINGERS.forEach((sg, i) => {
      const y = 36 + i * 53;
      const un = s.fans >= sg.unlockFans;
      const fee = singerFee(sg, o.platform);
      const fit = singerFits(sg, o.genre);
      const sel = o.current === sg.id;
      card(m, 10, y, 324, 50, sel ? 'sel' : un ? 'btn' : 'paper', () => {
        if (!un) { gs.toast(`${sg.name} belum mau. Butuh ${fmtNum(sg.unlockFans)} fans.`); sfx.bad(); return; }
        o.select(sel ? null : sg.id); m.close();
      });
      singerIcon(m, 34, y + 25, sg, !un);
      m.text(56, y + 5, un ? sg.name : '??? (penyanyi misterius)', 11, un ? COL.text : COL.muted, { font: ROUND, weight: '800' });
      m.text(56, y + 21, un ? sg.style : `Butuh ${fmtNum(sg.unlockFans)} fans`, 9, un ? '#7a3a10' : COL.muted, { font: ROUND, weight: '700' });
      if (un) stars(m, 60, y + 40, sg.pop);
      if (un && fit) m.text(110, y + 33, 'COCOK!', 9, '#b0402a', { font: ROUND, weight: '800' });
      m.text(326, y + 8, un ? fmtShort(fee) : '-', 11, un ? (s.money >= fee ? COL.text : COL.red) : COL.muted, { ox: 1, font: ROUND, weight: '800' });
      if (un) m.text(326, y + 28, sel ? 'DIPILIH' : 'Pilih', 9, sel ? '#b0402a' : COL.muted, { ox: 1, font: ROUND, weight: '800' });
    });
    const y0 = 36 + SINGERS.length * 53;
    m.btn(10, y0 + 2, 120, 34, 'Tanpa OST', () => { o.select(null); m.close(); }, { size: 11 });
    m.text(140, y0 + 4, 'Lagu ngehits = Hype naik + duit RBT.\nPenyanyi cocok genre = peluang hit gede.', 9, COL.muted, { wrap: 196, font: ROUND, weight: '700' });
  });
  return m;
}

// ================================================================= Sekuel / Spin-off picker
export interface SpinPickOpts { select: (p: { parentId: number; spin: 'sekuel' | 'spinoff' } | null) => void; current: number | null }
export function openSpinoffPicker(gs: GameScene, o: SpinPickOpts) {
  const m = gs.modal({ w: 344, h: 520, y: 56, title: 'SEKUEL & SPIN-OFF', closable: true });
  m.build((m) => {
    const sim = gs.sim;
    const list = sim.spinoffCandidates().slice(0, 6);
    m.text(14, 20, 'Sinetron skor 30+ / Hall of Fame bisa dilanjutin.\nFans lamanya ikut nonton!', 10, COL.muted, { wrap: 316, font: ROUND, weight: '700' });
    if (!list.length) m.text(172, 140, 'Belum ada sinetron yang cukup laris.\nBikin yang skornya 30+ dulu ya!', 11, COL.muted, { ox: 0.5, align: 'center' });
    list.forEach((sh, i) => {
      const y = 56 + i * 66;
      const part = sim.franchisePart(sh) + 1;
      const fb = franchiseBonus(part);
      m.panel(10, y, 324, 62, o.current === sh.id ? 'sel' : 'paper');
      m.text(18, y + 5, short(sh.title, 38), 11, COL.text, { font: ROUND, weight: '800' });
      m.text(18, y + 21, `${genreName(sh.genre)} x ${themeName(sh.theme)}  ·  skor ${sh.total}${sh.hof ? ' (HoF)' : ''}`, 9, COL.muted, { font: ROUND, weight: '700' });
      m.text(18, y + 37, `Bagian ke-${part}: fans lama ${fb >= 0 ? '+' : ''}${Math.round(fb * 100)}%`, 10, fb > 0.1 ? COL.green : fb > 0 ? '#9a6a10' : COL.red, { font: ROUND, weight: '800' });
      m.btn(204, y + 6, 124, 24, 'Sekuel (sama)', () => { o.select({ parentId: sh.id, spin: 'sekuel' }); m.close(); }, { size: 10, kind: 'primary' });
      m.btn(204, y + 33, 124, 24, 'Spin-off (tema baru)', () => { o.select({ parentId: sh.id, spin: 'spinoff' }); m.close(); }, { size: 9 });
    });
    m.btn(10, 460, 324, 40, o.current != null ? 'Batal, bikin cerita baru aja' : 'Tutup', () => { if (o.current != null) o.select(null); m.close(); }, { size: 11 });
  });
  return m;
}

/** title for a sequel / spin-off draft */
export function franchiseTitle(gs: GameScene, parentId: number, spin: 'sekuel' | 'spinoff', theme: string): string {
  const par = gs.s.shows.find((x) => x.id === parentId);
  if (!par) return '';
  return spin === 'sekuel' ? sequelTitle(par, Math.random, gs.s.shows) : spinoffTitle(par, theme, Math.random, gs.s.shows);
}

// ================================================================= Peralatan
export function openEquipment(gs: GameScene) {
  const m = gs.modal({ w: 344, h: 560, y: 34, title: 'PERALATAN', closable: true });
  m.build((m) => {
    const s = gs.s, sim = gs.sim;
    m.text(14, 20, `Kas ${fmtShort(s.money)}  ·  perawatan alat ${fmtShort(sim.monthlyRunning() - sim.studio().rent)}/bln`, 10, COL.muted, { font: ROUND, weight: '700' });
    EQUIPMENT.forEach((e, i) => {
      const y = 38 + i * 82;
      const own = s.equipment.includes(e.id);
      const err = sim.canBuyEquip(e.id);
      const price = sim.equipPrice(e.id);
      m.panel(10, y, 324, 78, own ? 'cream' : 'paper');
      m.text(18, y + 6, e.name, 12, own ? COL.green : COL.text, { font: ROUND, weight: '800' });
      m.text(18, y + 23, e.blurb, 9, COL.text, { wrap: 210, lineSpacing: 0 });
      m.text(18, y + 60, `Perawatan ${fmtShort(e.upkeep)}/bln`, 9, COL.muted, { font: ROUND, weight: '700' });
      if (own) m.text(326, y + 30, 'TERPASANG', 11, COL.green, { ox: 1, font: ROUND, weight: '800' });
      else {
        m.text(326, y + 8, fmtShort(price), 12, s.money >= price ? COL.text : COL.red, { ox: 1, font: ROUND, weight: '800' });
        m.btn(236, y + 40, 90, 30, err ? 'Terkunci' : 'Beli', () => {
          const r = sim.buyEquip(e.id);
          if (r) { gs.toast(r); sfx.bad(); } else { gs.toast(`${e.name} terpasang!`); sfx.fanfare(); }
          gs.refreshHud(); m.rebuild();
        }, { kind: err ? 'disabled' : 'primary', size: 11, disabled: false });
        if (err) m.text(326, y + 24, err, 8, COL.red, { ox: 1, align: 'right', wrap: 92, font: ROUND, weight: '700' });
      }
    });
  });
  return m;
}

// ================================================================= Agensi Bintang
export function openStarAgency(gs: GameScene) {
  const m = gs.modal({ w: 340, h: 470, title: 'AGENSI BINTANG', closable: true });
  m.build((m) => {
    const s = gs.s, sim = gs.sim;
    const lock = sim.canSignStar();
    m.text(14, 20, 'Kontrak eksklusif artis papan atas. Mahal di depan,\ntapi followers jutaan langsung dongkrak rating.', 10, COL.muted, { wrap: 312, font: ROUND, weight: '700' });
    if (lock) { m.text(170, 140, lock, 12, COL.red, { ox: 0.5, align: 'center', wrap: 290, bold: true }); return; }
    if (!s.starOffers.length) { m.text(170, 140, 'Belum ada artis yang tertarik.\nAgensi nawarin lagi tiap 3 bulan.', 12, COL.muted, { ox: 0.5, align: 'center' }); return; }
    s.starOffers.forEach((st: Staff, i) => {
      const y = 56 + i * 170;
      const fee = sim.signFee(st);
      m.panel(10, y, 320, 162, 'paper');
      m.panel(18, y + 10, 50, 60, 'cream'); head(m, 43, y + 66, st, 2);
      m.text(76, y + 10, st.name, 13, COL.text, { font: ROUND, weight: '800' });
      m.text(76, y + 30, `${ROLES[st.role].label}  ·  Lv ${st.level}  ·  ${fmtFollowers(st.followers)} followers`, 10, '#b0402a', { font: ROUND, weight: '800' });
      m.text(76, y + 48, `Akt ${st.stats.akting}  Psn ${st.stats.pesona}  Stm ${st.stats.stamina}`, 10, COL.text);
      m.text(18, y + 80, `Biaya kontrak: ${fmtMoney(fee)}`, 11, s.money >= fee ? COL.text : COL.red, { bold: true });
      m.text(18, y + 98, `Gaji: ${fmtShort(st.salary)}/bln  ·  honor main ikut naik`, 10, COL.muted);
      m.btn(170, y + 118, 152, 36, 'Teken Kontrak!', () => {
        const r = sim.signStar(st);
        if (r) { gs.toast(r); sfx.bad(); return; }
        sfx.fanfare(); gs.toast(`${st.name} resmi gabung! Wartawan infotainment heboh.`);
        gs.rebuildAfterStaffChange(); m.rebuild();
      }, { kind: 'primary', size: 12 });
    });
    m.text(170, 400, `Slot staf: ${s.staff.length}/${sim.maxStaff()}`, 10, s.staff.length >= sim.maxStaff() ? COL.red : COL.muted, { ox: 0.5 });
  });
  return m;
}

// ================================================================= Keuangan
export function openFinance(gs: GameScene) {
  let tab: 'now' | 'last' = 'now';
  const m = gs.modal({ w: 340, h: 540, y: 50, title: 'KEUANGAN', closable: true });
  m.build((m) => {
    const s = gs.s, sim = gs.sim;
    const L = tab === 'now' ? { year: s.ledger.year, income: s.ledger.income, spend: s.ledger.spend } : s.ledger.last;
    m.btn(14, 16, 150, 24, `Tahun ${s.ledger.year} (jalan)`, () => { tab = 'now'; m.rebuild(); }, { kind: tab === 'now' ? 'sel' : 'btn', size: 10 });
    m.btn(176, 16, 150, 24, s.ledger.last ? `Tahun ${s.ledger.last.year}` : 'Tahun lalu', () => { if (s.ledger.last) { tab = 'last'; m.rebuild(); } }, { kind: tab === 'last' ? 'sel' : s.ledger.last ? 'btn' : 'disabled', size: 10 });
    m.panel(10, 46, 320, 62, 'cream');
    m.text(20, 52, 'Biaya rutin per bulan', 10, COL.muted, { font: ROUND, weight: '700' });
    m.text(20, 68, `Gaji ${fmtShort(sim.monthlySalaries())}  +  Sewa ${fmtShort(sim.studio().rent)}  +  Alat ${fmtShort(sim.monthlyRunning() - sim.studio().rent)}`, 10, COL.text, { font: ROUND, weight: '800' });
    m.text(20, 86, `Total ${fmtShort(sim.monthlyCosts())}/bln  ·  kas cukup ${s.money > 0 ? Math.floor(s.money / Math.max(1, sim.monthlyCosts())) : 0} bulan`, 10, s.money < sim.monthlyCosts() * 2 ? COL.red : COL.green, { font: ROUND, weight: '800' });
    if (!L) { m.text(170, 200, 'Belum ada catatan tahun lalu.', 11, COL.muted, { ox: 0.5 }); return; }
    const rows = (title: string, rec: Record<string, number>, y: number, col: string, max: number) => {
      const e = Object.entries(rec).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      const sum = e.reduce((a, [, v]) => a + v, 0);
      m.text(16, y, title, 11, COL.text, { font: ROUND, weight: '800' });
      m.text(324, y, fmtShort(sum), 11, col, { ox: 1, font: ROUND, weight: '800' });
      e.slice(0, max).forEach(([k, v], i) => {
        m.text(26, y + 18 + i * 16, k, 10, COL.text);
        m.text(324, y + 18 + i * 16, fmtShort(v), 10, col, { ox: 1, font: ROUND, weight: '700' });
      });
      if (!e.length) m.text(26, y + 18, '-', 10, COL.muted);
      return sum;
    };
    m.panel(10, 114, 320, 156, 'paper');
    const inc = rows('Pemasukan', L.income, 120, COL.green, 8);
    m.panel(10, 276, 320, 204, 'paper');
    const sp = rows('Pengeluaran', L.spend, 282, COL.red, 11);
    const net = inc - sp;
    m.text(170, 494, `${tab === 'now' ? 'Sejauh ini' : 'Hasil'} tahun ${L.year}: ${net >= 0 ? 'untung' : 'rugi'} ${fmtShort(Math.abs(net))}`, 12, net >= 0 ? COL.green : COL.red, { ox: 0.5, font: ROUND, weight: '800' });
  });
  return m;
}

// ================================================================= small helpers used by other screens
export function ramadanInfo(gs: GameScene): { now: boolean; weeks: number; month: number; text: string } {
  const now = gs.sim.isRamadan();
  const weeks = gs.sim.weeksToRamadan();
  const yr = dateOf(gs.s.absWeek + weeks).year;
  const month = ramadanMonth(yr);
  const text = now ? 'BULAN RAMADAN  ·  Religi & Keluarga naik daun!' : weeks <= 4 ? `Ramadan ${weeks} minggu lagi  ·  siapkan sinetron religi!` : `Ramadan: Bulan ${month}${yr !== dateOf(gs.s.absWeek).year ? ' tahun depan' : ''}`;
  return { now, weeks, month, text };
}
export { singerById, twistById };
