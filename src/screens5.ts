// v5 screens: Feed netizen (X-style timeline), Prestasi gallery + unlock toast, year-10 career recap, KPI meter,
// Sponsor titipan (product placement), Audisi pemeran (casting minigame), backup save, the v5 event texts.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { ROLES, type Role } from './data';
import { fmtShort, fmtMoney, fmtNum, fmtFollowers, dateOf, saveGame, type GameState, type Staff } from './state';
import { COL, DISPLAY, ROUND, BAR_Y, txt, bubbleGfx, type Modal } from './ui';
import { sfx } from './audio';
import { head, card, short, confetti } from './screens';
import * as v5 from './v5';
import { ACHIEVEMENTS, achById, careerRecap } from './achievements';
import { exportPanel, importPanel } from './backup';

const ROW = '#4a2208';
const weeksAgo = (s: GameState, w: number) => { const d = s.absWeek - w; return d <= 0 ? 'baru' : d < 4 ? `${d}mg` : d < 48 ? `${Math.floor(d / 4)}bln` : `${Math.floor(d / 48)}th`; };
const fmtCount = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'jt' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',') + 'rb' : String(n));

// ================================================================== Feed netizen
export function unreadFeed(s: GameState): number { return Math.max(0, (s.feedSeq ?? 0) - (s.feedRead ?? 0)); }

function heart(g: Phaser.GameObjects.Graphics, x: number, y: number, col = 0xe0405a) {
  g.fillStyle(col, 1); g.fillCircle(x - 2, y - 1, 2.4); g.fillCircle(x + 2, y - 1, 2.4); g.fillTriangle(x - 4.4, y - 0.4, x + 4.4, y - 0.4, x, y + 4.2);
}
function retweet(g: Phaser.GameObjects.Graphics, x: number, y: number, col = 0x2e9a5a) {
  g.lineStyle(1.6, col, 1);
  g.strokeRect(x - 4, y - 2.5, 8, 5);
  g.fillStyle(0xf8ead0, 1); g.fillRect(x + 1, y - 4, 3, 3); g.fillRect(x - 4, y + 1, 3, 3);
  g.fillStyle(col, 1); g.fillTriangle(x + 2, y - 4.5, x + 6, y - 2.5, x + 2, y - 0.5); g.fillTriangle(x - 2, y + 0.5, x - 6, y + 2.5, x - 2, y + 4.5);
}
function avatar(m: Modal, x: number, y: number, u: number, r = 13) {
  const us = v5.USERS[u] ?? v5.USERS[0];
  const g = m.add(m.scene.add.graphics());
  g.fillStyle(0x2b1a10, 1); g.fillCircle(x, y, r + 1.5);
  g.fillStyle(us.col, 1); g.fillCircle(x, y, r);
  g.fillStyle(0xffffff, 0.25); g.fillCircle(x - r * 0.3, y - r * 0.35, r * 0.45);
  m.text(x, y + 1, us.name[0].toUpperCase(), Math.round(r * 1.05), '#ffffff', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#2b1a10', strokeW: 2 });
}

export function openFeed(gs: GameScene) {
  const s = gs.s;
  s.feedRead = s.feedSeq;
  gs.refreshBadge();
  let page = 0;
  const per = 5;
  const m = gs.modal({ w: 344, h: 566, y: 30, title: 'LINIMASA NETIZEN', closable: true });
  const wheel = (_p: unknown, _o: unknown, _dx: number, dy: number) => { if (m.closed || gs.modals[gs.modals.length - 1] !== m) return; const pages = Math.max(1, Math.ceil(s.feed.length / per)); const np = Math.max(0, Math.min(pages - 1, page + (dy > 0 ? 1 : -1))); if (np !== page) { page = np; m.rebuild(); } };
  gs.input.on('wheel', wheel);
  m.onClosed = ((orig) => () => { gs.input.off('wheel', wheel); orig?.(); })(m.onClosed);
  m.build((m) => {
    const tr = v5.trending(s);
    m.panel(10, 20, 324, 40, 'paper');
    m.text(18, 25, 'TRENDING', 9, '#c0392b', { font: DISPLAY });
    if (!tr.length) m.text(18, 39, 'Belum ada yang trending. Bikin sinetron dulu!', 10, COL.muted, { font: ROUND, weight: '700' });
    let tx = 18;
    tr.slice(0, 3).forEach((t) => {
      const lab = txt(gs, 0, 0, t.tag, 10, '#2d6cb0', { font: ROUND, weight: '800' });
      if (tx + lab.width > 326) { lab.destroy(); return; }
      lab.setPosition(tx, 38); m.add(lab);
      tx += lab.width + 10;
    });
    const pages = Math.max(1, Math.ceil(s.feed.length / per));
    page = Math.min(page, pages - 1);
    if (!s.feed.length) {
      m.text(172, 200, 'Linimasa masih sepi...\nNetizen bakal rame begitu\nsinetron kita tayang!', 12, COL.muted, { ox: 0.5, align: 'center', lineSpacing: 4 });
    }
    s.feed.slice(page * per, page * per + per).forEach((p, i) => {
      const y = 66 + i * 89;
      const us = v5.USERS[p.u] ?? v5.USERS[0];
      m.panel(10, y, 324, 85, p.kind === 'news' ? 'cream' : 'paper');
      avatar(m, 30, y + 20, p.u);
      const nm = m.text(50, y + 7, us.name, 11, ROW, { font: ROUND, weight: '800' });
      if (p.kind === 'news' || p.kind === 'gossip') {
        // verified-ish badge
        const g = m.add(gs.add.graphics()); const bx = 50 + nm.width + 7, by = y + 14;
        g.fillStyle(p.kind === 'news' ? 0x2d8ae0 : 0xe0407a, 1); g.fillCircle(bx, by, 4.5); g.lineStyle(1.4, 0xffffff, 1); g.beginPath(); g.moveTo(bx - 2, by); g.lineTo(bx - 0.5, by + 1.6); g.lineTo(bx + 2.2, by - 1.6); g.strokePath();
      }
      m.text(50, y + 22, `${us.handle}  ·  ${weeksAgo(s, p.w)}`, 9, COL.muted, { font: ROUND, weight: '600' });
      const body = p.tag && !p.t.includes(p.tag) ? `${p.t} ${p.tag}` : p.t;
      m.text(50, y + 35, body, 10, '#2b1a10', { wrap: 274, lineSpacing: 0, font: ROUND, weight: '600' });
      const g = m.add(gs.add.graphics());
      heart(g, 56, y + 76); retweet(g, 136, y + 76);
      m.text(64, y + 70, fmtCount(p.likes), 9, '#b03050', { font: ROUND, weight: '800' });
      m.text(146, y + 70, fmtCount(p.rt), 9, '#2e7a4a', { font: ROUND, weight: '800' });
    });
    m.btn(10, 514, 96, 34, '< Terbaru', () => { page = Math.max(0, page - 1); m.rebuild(); }, { size: 11, disabled: page === 0 });
    m.text(172, 531, `${page + 1}/${pages}`, 11, ROW, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
    m.btn(238, 514, 96, 34, 'Lama >', () => { page = Math.min(pages - 1, page + 1); m.rebuild(); }, { size: 11, disabled: page >= pages - 1 });
  });
  return m;
}

// ================================================================== Prestasi
const ACH_TINT: Record<string, number> = { tv: 0x9ad0ff, chart: 0xffb070, crown: 0xffe066, star: 0xfff09a, trophy: 0xffd040, film: 0xffc8a0, note: 0xff9ad8, moon: 0xb0f0a0, heart: 0xff9ab0, money: 0xb8f090, house: 0xffd8a0, bulb: 0xfff4a0, twist: 0xd0a0ff, mic: 0xffa0a0, bag: 0xffc080, kpi: 0xd0d8e0 };
export function openAchievements(gs: GameScene) {
  const s = gs.s;
  let page = 0;
  const per = 14;
  const m = gs.modal({ w: 344, h: 560, y: 34, title: 'PRESTASI', closable: true });
  m.build((m) => {
    const got = ACHIEVEMENTS.filter((a) => s.achievements[a.id] !== undefined).length;
    m.text(14, 22, `${got}/${ACHIEVEMENTS.length} prestasi terbuka`, 11, ROW, { font: ROUND, weight: '800' });
    m.bar(180, 25, 150, 9, got / ACHIEVEMENTS.length, 0xf6c440);
    const pages = Math.ceil(ACHIEVEMENTS.length / per);
    ACHIEVEMENTS.slice(page * per, page * per + per).forEach((a, i) => {
      const x = 10 + (i % 2) * 164, y = 42 + Math.floor(i / 2) * 64;
      const on = s.achievements[a.id] !== undefined;
      m.panel(x, y, 160, 60, on ? 'sel' : 'paper');
      const im = m.img(x + 18, y + 30, 'i_medal', 1);
      if (!on) im.setTint(0x6a6058).setAlpha(0.55); else im.setTint(ACH_TINT[a.icon] ?? 0xffffff);
      m.text(x + 34, y + 6, on ? a.name : a.name, 10, on ? '#7a2a08' : COL.muted, { font: ROUND, weight: '800', wrap: 122 });
      m.text(x + 34, y + 21, a.desc, 8, on ? ROW : '#9a8a70', { wrap: 122, lineSpacing: -1, font: ROUND, weight: '600' });
      if (on) m.text(x + 154, y + 48, `Th${dateOf(s.achievements[a.id]).year}`, 8, '#b04a1a', { ox: 1, font: ROUND, weight: '800' });
    });
    m.btn(10, 500, 70, 40, '<', () => { page = (page + pages - 1) % pages; m.rebuild(); }, { size: 13 });
    m.text(120, 520, `${page + 1}/${pages}`, 11, ROW, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
    m.btn(160, 500, 70, 40, '>', () => { page = (page + 1) % pages; m.rebuild(); }, { size: 13 });
    m.btn(236, 500, 98, 40, 'Rekap\nKarier', () => showEnding(gs, () => undefined, true), { kind: 'primary', size: 10 }).setName('recapBtn');
  });
  return m;
}

/** gold banner under the HUD when a prestasi unlocks (queued, never over another one) */
const achQ: string[] = [];
let achBusy = false;
export function achToast(gs: GameScene, id: string) {
  achQ.push(id);
  if (!achBusy) nextAch(gs);
}
function nextAch(gs: GameScene) {
  if (!gs.scene.isActive()) { achQ.length = 0; achBusy = false; return; }
  const id = achQ[0];
  const a = id ? achById(id) : undefined;
  if (!a) { achQ.shift(); achBusy = achQ.length > 0; if (achBusy) nextAch(gs); return; }
  achBusy = true;
  // over the HUD / under a dialog when one is up, never on top of it; else just above the bottom bar.
  // No free spot (rating show, a dialog filling a short window): hold the banner until there is one.
  const t2w = Math.max(150, a.name.length * 7.5) + 64;
  const slot = gs.modalOpen() ? gs.toastSlot(t2w, 38, 'above') : { x: gs.vcx(), y: BAR_Y - 30 };
  if (!slot || (slot.wrap && slot.wrap + 24 < t2w)) { gs.time.delayedCall(500, () => nextAch(gs)); return; }
  achQ.shift();
  sfx.levelup();
  const x = slot.x, y = slot.y;
  const c = gs.add.container(x, y).setDepth(5200).setName('toast');
  const t1 = txt(gs, 14, -7, 'PRESTASI TERBUKA!', 9, '#7a2a08', { ox: 0.5, oy: 0.5, font: DISPLAY });
  const t2 = txt(gs, 14, 8, a.name, 13, '#4a1a04', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
  const w = Math.max(t1.width, t2.width) + 64, h = 38;
  const g = gs.add.graphics();
  bubbleGfx(g, w, h, 0xffe27a, 0x7a4a08, false, 10);
  g.fillStyle(0xfff6c0, 1); g.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, 4, 2);
  const im = gs.add.image(-w / 2 + 22, 0, 'i_medal').setScale(1.1).setTint(ACH_TINT[a.icon] ?? 0xffffff);
  c.add([g, im, t1, t2]);
  c.setScale(0.3).setAlpha(0);
  gs.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  gs.tweens.add({ targets: im, angle: { from: -12, to: 12 }, duration: 300, yoyo: true, repeat: 3 });
  gs.time.delayedCall(2600, () => gs.tweens.add({ targets: c, alpha: 0, y: y - 12, duration: 260, onComplete: () => { c.destroy(); nextAch(gs); } }));
}

// ================================================================== year-10 ending / career recap
export function showEnding(gs: GameScene, done: () => void, replay = false) {
  const s = gs.s;
  const r = careerRecap(s);
  const m = gs.modal({ w: 344, h: 580, y: 30, title: replay ? 'REKAP KARIER' : 'SATU DEKADE!', kind: 'dark', closable: replay });
  if (!replay) { sfx.setMusicOverride('award'); sfx.sting('great'); }
  m.build((m) => {
    const g = m.add(gs.add.graphics());
    g.fillStyle(0x2a0a10, 1); g.fillRoundedRect(10, 18, 324, 132, 8);
    g.fillStyle(0xf6c440, 0.12); g.fillTriangle(172, 18, 92, 150, 252, 150);
    m.text(172, 28, replay ? `Sampai Tahun ${dateOf(s.absWeek).year}` : '10 TAHUN BIKIN SINETRON', 11, '#e0c8a0', { ox: 0.5, font: ROUND, weight: '800' });
    m.text(172, 48, 'Gelar kamu:', 10, '#c8b090', { ox: 0.5 });
    m.img(52, 120, 'i_bigtrophy', 1.4).setOrigin(0.5, 1);
    m.img(292, 120, 'i_bigtrophy', 1.4).setOrigin(0.5, 1);
    m.text(172, 78, r.title.toUpperCase(), r.title.length > 16 ? 15 : 19, '#f6c440', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#2b1a10', strokeW: 4 });
    m.text(172, 102, `Skor karier ${r.score}/100`, 11, '#fff6e0', { ox: 0.5, font: ROUND, weight: '800' });
    m.text(172, 122, r.blurb, 9, '#e8d8b8', { ox: 0.5, align: 'center', wrap: 220, font: ROUND, weight: '600' });
    const stats: [string, string][] = [
      ['Sinetron dibuat', String(r.shows)], ['Hall of Fame', String(r.hof)], ['Piala', String(r.trophies)],
      ['Rating tertinggi', r.peak.toFixed(1) + '%'], ['Total pendapatan', fmtShort(r.revenue)], ['Fans', fmtNum(r.fans)],
      ['Prestasi', `${r.achv}/${ACHIEVEMENTS.length}`], ['Studio', `Lv ${r.studio}`], ['Kas sekarang', fmtShort(s.money)],
    ];
    m.panel(10, 158, 324, 128, 'paper');
    stats.forEach(([a, b], i) => {
      const x = 18 + (i % 3) * 106, y = 166 + Math.floor(i / 3) * 40;
      m.text(x, y, a, 9, COL.muted, { font: ROUND, weight: '700' });
      m.text(x, y + 13, b, 13, ROW, { font: ROUND, weight: '800' });
    });
    m.panel(10, 294, 324, 150, 'cream');
    m.text(20, 300, 'KARYA TERBAIK', 10, '#c0392b', { font: DISPLAY });
    if (!r.best.length) m.text(172, 350, 'Belum ada karya... ayo bikin!', 11, COL.muted, { ox: 0.5 });
    r.best.forEach((b, i) => {
      const y = 318 + i * 40;
      m.text(22, y, `${i + 1}.`, 14, '#c0392b', { font: ROUND, weight: '800' });
      m.text(42, y, short(b.title, 34), 11, ROW, { font: ROUND, weight: '800' });
      m.text(42, y + 15, `Skor ${b.total}/40  ·  Rating ${b.rating}%  ·  Th${b.year}`, 9, COL.muted, { font: ROUND, weight: '600' });
    });
    m.text(172, 456, replay ? 'Terus bikin karya, Bos!' : 'Ceritanya belum tamat! Kamu bisa lanjut main bebas,\nkejar prestasi yang belum kebuka.', 10, '#fff0c8', { ox: 0.5, align: 'center', font: ROUND, weight: '700' });
    m.btn(62, 500, 220, 50, replay ? 'Tutup' : 'Lanjut Main Bebas', () => { if (!replay) sfx.setMusicOverride(null); m.close(); done(); }, { kind: 'primary', size: 14 }).setName('endingContinue');
  });
  if (!replay) confetti(gs, 2100, 90);
  return m;
}

// ================================================================== KPI
export function openKpi(gs: GameScene) {
  const m = gs.modal({ w: 324, h: 470, y: 60, title: 'KPI & NETIZEN', closable: true });
  m.build((m) => {
    const s = gs.s;
    m.img(28, 36, 'i_kpi', 1);
    m.text(48, 22, 'Meter Teguran KPI', 12, ROW, { font: ROUND, weight: '800' });
    m.text(48, 38, v5.KPI_NAME, 9, COL.muted, { font: ROUND, weight: '600' });
    // meter with zones
    const x = 16, y = 58, w = 292, h = 16;
    const g = m.add(gs.add.graphics());
    g.fillStyle(0x2b1a10, 1); g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 6);
    g.fillStyle(0x6ac46a, 1); g.fillRect(x, y, w * 0.4, h);
    g.fillStyle(0xf6c440, 1); g.fillRect(x + w * 0.4, y, w * 0.3, h);
    g.fillStyle(0xe0503a, 1); g.fillRect(x + w * 0.7, y, w * 0.3, h);
    g.fillStyle(0x000000, 0.35); g.fillRect(x + w * Math.min(1, s.kpi / 100), y, w * (1 - Math.min(1, s.kpi / 100)), h);
    g.fillStyle(0xffffff, 1); g.fillTriangle(x + w * s.kpi / 100 - 5, y - 7, x + w * s.kpi / 100 + 5, y - 7, x + w * s.kpi / 100, y);
    m.text(x, y + 20, 'Aman', 9, COL.green, { font: ROUND, weight: '800' });
    m.text(x + w * 0.4 + 2, y + 20, 'Teguran 40', 9, '#9a6a10', { font: ROUND, weight: '800' });
    m.text(x + w, y + 20, 'Sanksi 70', 9, COL.red, { ox: 1, font: ROUND, weight: '800' });
    m.text(162, 100, `${Math.round(s.kpi)}%  ·  ${s.kpiStage >= 2 ? 'KENA SANKSI' : s.kpiStage === 1 ? 'SUDAH DITEGUR' : s.kpi >= 25 ? 'diawasi' : 'aman'}`, 13, s.kpi >= 70 ? COL.red : s.kpi >= 40 ? '#9a6a10' : COL.green, { ox: 0.5, font: ROUND, weight: '800' });
    m.panel(10, 122, 304, 104, 'paper');
    m.text(18, 128, 'Bikin meter naik: sinetron Azab / Horor / Siluman / Laga yang lebay, kartu plot twist (apalagi beruntun), gosip digoreng.\nBikin turun: waktu, sinetron Religi, Sensor Mandiri, sowan ke KPI.', 9, ROW, { wrap: 290, lineSpacing: 1, font: ROUND, weight: '600' });
    const sc = v5.canSowan(s);
    m.btn(14, 234, 296, 40, `Sowan & Ikut Sosialisasi (${fmtShort(v5.sowanCost(s))}, -22)`, () => {
      const err = v5.sowan(gs.sim);
      if (err) { gs.toast(err); sfx.bad(); } else { gs.toast('Sowan ke KPI sambil bawa kue. Meter teguran turun!'); sfx.coin(); }
      gs.refreshHud(); m.rebuild();
    }, { size: 10, kind: sc ? 'disabled' : 'green', disabled: !!sc }).setName('sowanBtn');
    if (sc && s.kpi >= 5) m.text(162, 278, sc, 9, COL.muted, { ox: 0.5, font: ROUND, weight: '600' });
    const p = s.prod;
    m.btn(14, 292, 296, 34, p ? `Sensor Mandiri produksi ini: ${p.sensor ? 'NYALA' : 'MATI'}` : 'Sensor Mandiri (pilih saat produksi berjalan)', () => {
      if (!p) return; p.sensor = !p.sensor; gs.toast(p.sensor ? 'Sensor mandiri nyala: teguran -65%, rating -5%.' : 'Sensor mandiri dimatikan.'); m.rebuild();
    }, { size: 10, kind: p ? (p.sensor ? 'sel' : 'btn') : 'disabled', disabled: !p }).setName('sensorBtn');
    // boikot
    m.text(18, 340, 'Amarah Netizen (risiko boikot)', 11, ROW, { font: ROUND, weight: '800' });
    m.bar(18, 358, 288, 12, s.boikot / 100, s.boikot >= 55 ? 0xe0503a : s.boikot >= 35 ? 0xf6c440 : 0x6ac46a);
    m.text(162, 376, s.boikot >= 55 ? 'BAHAYA! Bisa ada #Boikot kapan saja.' : s.boikot >= 35 ? 'Netizen mulai panas. Jangan goreng gosip dulu.' : 'Netizen masih adem.', 9, s.boikot >= 55 ? COL.red : COL.muted, { ox: 0.5, font: ROUND, weight: '700' });
    m.text(162, 396, 'Klarifikasi gosip & minta maaf bikin adem.\nGoreng gosip & diam saat skandal bikin panas.', 9, COL.muted, { ox: 0.5, align: 'center', font: ROUND, weight: '600' });
    m.btn(14, 424, 296, 34, 'Lihat Linimasa Netizen', () => { m.close(); openFeed(gs); }, { size: 11 });
  });
  return m;
}

// ================================================================== Sponsor titipan (product placement)
export function openPlacements(gs: GameScene) {
  const m = gs.modal({ w: 340, h: 500, y: 62, title: 'SPONSOR TITIPAN', closable: true });
  m.build((m) => {
    const p = gs.s.prod;
    if (!p) { m.text(170, 120, 'Belum ada produksi.\nSponsor datang pas sinetron lagi dibuat.', 12, COL.muted, { ox: 0.5, align: 'center' }); return; }
    const w = v5.placementWeight({ genre: p.genre, placements: p.placements });
    m.text(14, 20, `Iklan di "${short(p.title, 26)}"`, 10, COL.muted, { font: ROUND, weight: '700' });
    m.text(14, 36, `Muatan iklan: ${w.toFixed(1)}  (aman sampai ${v5.PLACEMENT_SAFE})`, 11, w > v5.PLACEMENT_SAFE ? COL.red : COL.green, { font: ROUND, weight: '800' });
    m.bar(14, 54, 312, 9, Math.min(1, w / 5), w > v5.PLACEMENT_SAFE ? 0xe0503a : 0x6ac46a);
    m.text(14, 68, 'Sponsor yang cocok sama genre cuma dihitung setengah. Kebanyakan iklan = netizen protes, rating turun.', 9, COL.muted, { wrap: 312, font: ROUND, weight: '600' });
    let y = 98;
    m.text(14, y, 'Tawaran masuk', 11, ROW, { font: ROUND, weight: '800' }); y += 16;
    if (!p.offers.length) { m.text(170, y + 12, 'Belum ada tawaran baru.', 10, COL.muted, { ox: 0.5 }); y += 34; }
    p.offers.slice(0, 3).forEach((o) => {
      const sp = v5.sponsorById(o.id);
      if (!sp) return;
      const fit = sp.fit.includes(p.genre);
      card(m, 10, y, 320, 74, 'paper');
      m.img(30, y + 24, 'i_bag', 1);
      m.text(50, y + 6, sp.name, 11, ROW, { font: ROUND, weight: '800' });
      m.text(50, y + 21, `${sp.cat}  ·  ${fit ? 'cocok genre (½)' : 'nggak nyambung (1)'}`, 9, fit ? COL.green : '#9a6a10', { font: ROUND, weight: '700' });
      m.text(50, y + 34, `"${sp.line}"`, 8, COL.muted, { wrap: 180, font: ROUND, weight: '600' });
      m.text(322, y + 7, fmtShort(o.pay), 12, COL.green, { ox: 1, font: ROUND, weight: '800' });
      m.btn(236, y + 40, 46, 26, 'Ambil', () => { const e = v5.acceptOffer(gs.sim, o.id); if (e) { gs.toast(e); sfx.bad(); } else { sfx.coin(); gs.sim.checkAch(); } gs.refreshHud(); m.rebuild(); }, { kind: 'primary', size: 10 }).setName('placeAccept');
      m.btn(286, y + 40, 40, 26, 'Tolak', () => { v5.declineOffer(gs.sim, o.id); m.rebuild(); }, { size: 9 });
      y += 78;
    });
    y += 4;
    m.text(14, y, `Sudah tayang di naskah (${p.placements.length}) · ${fmtShort(p.placementPay)}`, 11, ROW, { font: ROUND, weight: '800' }); y += 18;
    const names = p.placements.map((id) => v5.sponsorById(id)?.name ?? id);
    m.text(14, y, names.length ? names.join('\n') : '(belum ada)', 9, COL.text, { wrap: 312, lineSpacing: 2, font: ROUND, weight: '600' });
    m.btn(10, 448, 320, 40, 'Kembali', () => m.close(), { size: 12 });
  });
  return m;
}

// ================================================================== Audisi (casting minigame)
const STAR_COL = 0xffd23a;
function stars(m: Modal, x: number, y: number, n: number, scale = 0.22) {
  for (let i = 0; i < 5; i++) {
    const im = m.add(m.scene.add.image(x + i * 12, y, 'icons', 5).setScale(scale));
    if (i >= n) im.setTint(0x6a5a4a).setAlpha(0.45); else im.setTint(STAR_COL);
  }
}
export function openAudition(gs: GameScene, roleArg?: Role) {
  const s = gs.s;
  let role: Role = roleArg ?? s.audition?.role ?? (s.staff.filter((x) => x.role === 'aktris').length < s.staff.filter((x) => x.role === 'aktor').length ? 'aktris' : 'aktor');
  let reveal = 3;
  const m = gs.modal({ w: 344, h: 566, y: 30, title: 'AUDISI PEMERAN', closable: true });
  m.build((m) => {
    const a = s.audition;
    if (!a) {
      m.text(172, 26, 'Cari bintang baru lewat audisi! Tiap kandidat\npunya sifat unik & chemistry sama lawan main.', 10, ROW, { ox: 0.5, align: 'center', font: ROUND, weight: '700' });
      (['aktor', 'aktris'] as Role[]).forEach((r, i) => m.btn(30 + i * 146, 66, 138, 34, ROLES[r].label, () => { role = r; m.rebuild(); }, { kind: role === r ? 'sel' : 'btn', size: 12 }));
      const partner = v5.partnerFor(s, role);
      m.panel(14, 110, 316, 60, 'paper');
      if (partner) { head(m, 40, 166, partner, 2); m.text(66, 120, `Lawan main: ${partner.name}`, 11, ROW, { font: ROUND, weight: '800' }); m.text(66, 138, 'Chemistry kandidat sama dia kelihatan\nsetelah uji adegan.', 9, COL.muted, { font: ROUND, weight: '600' }); }
      else m.text(172, 130, `Belum ada ${role === 'aktor' ? 'aktris' : 'aktor'} buat lawan main.\nChemistry dihitung nanti.`, 10, COL.muted, { ox: 0.5, align: 'center' });
      m.text(20, 184, 'Sifat yang mungkin muncul:', 10, ROW, { font: ROUND, weight: '800' });
      v5.TRAITS.forEach((t, i) => {
        const x = 18 + (i % 2) * 158, y = 202 + Math.floor(i / 2) * 44;
        m.text(x, y, t.nameF && role === 'aktris' ? t.nameF : t.name, 10, '#b04a1a', { font: ROUND, weight: '800' });
        m.text(x, y + 13, t.desc, 8, COL.muted, { wrap: 150, lineSpacing: -1, font: ROUND, weight: '600' });
      });
      const c = v5.auditionCost(s);
      m.text(172, 388, `Biaya sewa ruang & juri: ${fmtShort(c)}\nKontrak dibayar terpisah kalau ada yang direkrut.`, 10, COL.muted, { ox: 0.5, align: 'center', font: ROUND, weight: '600' });
      m.text(172, 424, `Staf ${s.staff.length}/${gs.sim.maxStaff()}`, 10, s.staff.length >= gs.sim.maxStaff() ? COL.red : COL.muted, { ox: 0.5, font: ROUND, weight: '700' });
      m.btn(30, 452, 284, 50, `Mulai Audisi ${ROLES[role].label}!`, () => {
        const err = v5.startAudition(gs.sim, role);
        if (err) { gs.toast(err); sfx.bad(); return; }
        sfx.fanfare(); reveal = 3; gs.refreshHud(); m.rebuild();
      }, { kind: s.money >= c ? 'primary' : 'disabled', disabled: s.money < c, size: 13 }).setName('auditionStart');
      m.btn(30, 510, 284, 34, 'Kembali', () => m.close(), { size: 11 });
      return;
    }
    const partner = v5.auditionPartner(s, a);
    m.text(14, 20, `Audisi ${ROLES[a.role].label}${partner ? `  ·  lawan main ${partner.name}` : ''}`, 10, COL.muted, { font: ROUND, weight: '700' });
    a.cands.forEach((c: Staff, i: number) => {
      const x = 10 + i * 109, y = 36;
      m.panel(x, y, 106, 262, 'paper');
      m.panel(x + 8, y + 6, 90, 70, 'cream');
      head(m, x + 53, y + 74, c, 3);
      m.text(x + 53, y + 82, short(c.name, 13), 10, ROW, { ox: 0.5, font: ROUND, weight: '800' });
      m.text(x + 53, y + 96, `Lv ${c.level}`, 9, COL.muted, { ox: 0.5, font: ROUND, weight: '700' });
      m.text(x + 53, y + 110, v5.traitName(c), 10, '#b04a1a', { ox: 0.5, font: ROUND, weight: '800' });
      m.text(x + 53, y + 124, v5.traitById(c.trait)?.desc ?? '', 8, COL.muted, { ox: 0.5, align: 'center', wrap: 96, lineSpacing: -2, font: ROUND, weight: '600' });
      m.text(x + 8, y + 166, `Akting ${c.stats.akting}`, 9, ROW, { font: ROUND, weight: '700' });
      m.text(x + 8, y + 178, `Pesona ${c.stats.pesona}`, 9, ROW, { font: ROUND, weight: '700' });
      m.text(x + 8, y + 190, `${fmtFollowers(c.followers)} followers`, 9, COL.muted, { font: ROUND, weight: '600' });
      m.text(x + 8, y + 202, `Gaji ${fmtShort(c.salary)}`, 9, COL.muted, { font: ROUND, weight: '600' });
      if (a.scene && i < reveal) {
        stars(m, x + 25, y + 222, a.scores[i]);
        m.text(x + 53, y + 236, partner ? `Chemistry ${a.chem[i]}` : 'Chemistry -', 10, a.chem[i] >= 85 ? '#c0306a' : a.chem[i] >= 70 ? COL.green : ROW, { ox: 0.5, font: ROUND, weight: '800' });
        if (partner) m.text(x + 53, y + 250, v5.chemLabel(a.chem[i]), 8, COL.muted, { ox: 0.5, font: ROUND, weight: '700' });
      } else m.text(x + 53, y + 234, a.scene ? '...' : '? ? ?', 13, '#9a8a70', { ox: 0.5, font: ROUND, weight: '800' });
      if (a.scene) m.btn(x + 4, y + 268, 98, 30, 'Rekrut', () => {
        const err = v5.auditionHire(gs.sim, i);
        if (err) { gs.toast(err); sfx.bad(); return; }
        gs.rebuildAfterStaffChange(); sfx.levelup(); gs.toast(`${c.name} resmi gabung! (${v5.traitName(c)})`); gs.sim.checkAch(); m.close();
      }, { kind: 'primary', size: 11 }).setName('auditionHire' + i);
    });
    if (!a.scene) {
      m.text(172, 312, 'Uji adegan: pilih SATU adegan buat semua kandidat', 10, ROW, { ox: 0.5, font: ROUND, weight: '800' });
      v5.SCENES.forEach((sc, i) => {
        const x = 10 + (i % 2) * 164, y = 330 + Math.floor(i / 2) * 58;
        m.btn(x, y, 160, 52, `${sc.name}\n${sc.blurb}`, () => {
          v5.auditionScene(s, sc.id);
          reveal = 0; sfx.sting('roll'); m.rebuild();
          for (let k = 1; k <= 3; k++) gs.time.delayedCall(450 * k, () => { if (m.closed) return; reveal = k; sfx.score(s.audition ? s.audition.scores[k - 1] * 2 : 6); m.rebuild(); });
        }, { size: 10 }).setName('scene_' + sc.id);
      });
    } else {
      const sc = v5.SCENES.find((x) => x.id === a.scene)!;
      m.panel(10, 342, 324, 92, 'cream');
      m.text(172, 350, `${sc.name}: "${sc.blurb}"`, 11, ROW, { ox: 0.5, font: ROUND, weight: '800' });
      const best = a.scores.indexOf(Math.max(...a.scores));
      if (reveal >= 3) m.text(172, 372, `Juri: "${a.cands[best].name} paling meyakinkan!"\nBintang = bakat adegan ini. Chemistry = rating bareng lawan main.\nSifat bawaan ngaruh terus selama dia kerja.`, 9, COL.muted, { ox: 0.5, align: 'center', wrap: 310, lineSpacing: 2, font: ROUND, weight: '600' });
    }
    m.btn(10, 510, 324, 38, 'Bubarkan Audisi', () => { s.audition = null; m.rebuild(); }, { size: 11 });
  });
  return m;
}

// ================================================================== backup (in-game)
export function openBackup(gs: GameScene) {
  const m = gs.modal({ w: 300, h: 300, title: 'BACKUP SAVE', closable: true });
  m.build((m) => {
    m.text(20, 26, 'Simpan progres ke file / kode, biar aman kalau ganti HP atau cache browser kehapus.', 10, ROW, { wrap: 260, font: ROUND, weight: '600' });
    m.btn(24, 80, 252, 44, 'Ekspor Backup', () => { saveGame(gs.s); exportPanel(gs.s); }, { kind: 'primary', size: 13 }).setName('backupExport');
    m.btn(24, 134, 252, 44, 'Impor Backup', () => {
      importPanel((st, summary) => confirmReplace(gs, summary, () => { saveGame(st); m.close(); sfx.sting('great'); gs.scene.start('Game', { state: st }); }));
    }, { kind: 'green', size: 13 }).setName('backupImport');
    m.text(150, 196, `Save sekarang: Th${dateOf(gs.s.absWeek).year}  ·  ${fmtMoney(gs.s.money)}`, 9, COL.muted, { ox: 0.5, font: ROUND, weight: '700' });
    m.text(150, 214, 'Backup versi lama otomatis di-upgrade.', 9, COL.muted, { ox: 0.5, font: ROUND, weight: '600' });
    m.btn(24, 240, 252, 38, 'Tutup', () => m.close(), { size: 12 });
  });
  return m;
}
export function confirmReplace(gs: GameScene, summary: string, ok: () => void) {
  const m = gs.modal({ w: 300, h: 230, title: 'GANTI PROGRES?' });
  m.build((m) => {
    m.text(150, 26, 'Save dari backup:', 11, ROW, { ox: 0.5, font: ROUND, weight: '800' });
    m.text(150, 46, summary, 11, COL.text, { ox: 0.5, align: 'center', wrap: 270, lineSpacing: 2, font: ROUND, weight: '700' });
    m.text(150, 110, 'Progres yang sekarang bakal DITIMPA.', 10, COL.red, { ox: 0.5, font: ROUND, weight: '800' });
    m.btn(16, 160, 128, 44, 'Batal', () => m.close(), { size: 12 });
    m.btn(156, 160, 128, 44, 'Ganti!', () => { m.close(); ok(); }, { kind: 'red', size: 12 }).setName('confirmReplace');
  });
}

// ================================================================== v5 event texts (merged into showEvent)
type EvDef = { title: string | ((d: Record<string, number | string>) => string); text: (d: Record<string, number | string>, gs: GameScene) => string; choices: (d: Record<string, number | string>, gs: GameScene) => string[] };
const nm = (gs: GameScene, id: number | string | undefined) => gs.s.staff.find((x) => x.id === id)?.name ?? 'Artis kita';
const showT = (gs: GameScene, id: number | string | undefined) => { const sh = gs.s.shows.find((x) => x.id === id); return sh ? short(sh.title, 26) : 'sinetron kita'; };
export const EVENT_TEXT5: Record<string, EvDef> = {
  gosip: {
    title: (d) => ({ cinlok: 'CINLOK!', skandal: 'SKANDAL!', cerai: 'GOSIP CERAI', viral: 'VIRAL DI TIKTOK' } as Record<string, string>)[String(d.kind)] ?? 'GOSIP!',
    text: (d, gs) => {
      const a = nm(gs, d.staffId);
      const sh = Number(d.showId) >= 0 ? `\n\nLagi tayang: "${showT(gs, d.showId)}".` : '';
      if (d.kind === 'cinlok') return `Infotainment: ${a} & ${nm(gs, d.staffId2)} kepergok makan berdua di warung pecel lele habis syuting. Cinlok nih?!${sh}`;
      if (d.kind === 'cerai') return `${a} digugat cerai! Wartawan infotainment kemah di depan rumahnya bawa tikar & termos.${sh}`;
      if (d.kind === 'viral') return `Video ${a} ${v5.VIRAL_LINES[Number(d.line)] ?? v5.VIRAL_LINES[0]}!${sh}`;
      return `${a} ${v5.SKANDAL_LINES[Number(d.line)] ?? v5.SKANDAL_LINES[0]}! Akun gosip udah posting, komennya belasan ribu.${sh}`;
    },
    choices: (d) => d.kind === 'viral' ? ['Goreng terus! (rating naik)', 'Biasa aja'] : [`Klarifikasi (${fmtShort(Number(d.cost))})`, 'Goreng buat rating! (risiko boikot)', 'Diam aja'],
  },
  boikot: {
    title: 'BOIKOT!',
    text: (d, gs) => `#Boikot${v5.tagName(gs.s.shows.find((x) => x.id === d.showId)?.title ?? 'Sinetron')} trending nomor 1! Netizen ngamuk gara-gara kontroversi studio.\n\n"${showT(gs, d.showId)}" terancam ditinggal penonton.`,
    choices: (d) => [`Minta maaf publik (${fmtShort(Number(d.cost))})`, 'Cuek aja'],
  },
  rewel: {
    title: 'ARTIS REWEL',
    text: (d, gs) => `${nm(gs, d.staffId)}: "Bos, aku kan bintang. Gaji naikin ${fmtShort(Number(d.amount))} sebulan, atau aku MOGOK!"`,
    choices: () => ['Naikin deh', 'Nggak ada!'],
  },
  mogok: {
    title: 'MOGOK SYUTING!',
    text: (d, gs) => `${nm(gs, d.staffId)} ngunci diri di ruang makeup. Tuntutannya: ${d.demand}!\n\nSyuting adegan dia berhenti total.`,
    choices: (d) => [`Turuti (${fmtShort(Number(d.cost))})`, 'Bujuk pakai martabak (untung-untungan)', 'Copot dari peran utama'],
  },
  kpi: {
    title: (d) => (Number(d.stage) === 1 ? 'SURAT TEGURAN' : 'SANKSI KPI!'),
    text: (d, gs) => Number(d.stage) === 1
      ? `${v5.KPI_NAME} kirim surat teguran: azab kelewat sadis, tangisan kepanjangan, plot twist bikin penonton jantungan.\n\nMeter teguran ${Math.round(gs.s.kpi)}%. Tembus 70% = sanksi!`
      : `Meter teguran tembus ${Math.round(gs.s.kpi)}%!${Number(d.repeat) ? ' PELANGGARAN BERULANG!' : ''} ${Number(d.showId) >= 0 ? `KPI kasih pilihan: "${showT(gs, d.showId)}" digeser ke jam 23.00 selama ${v5.SLOT_WEEKS} minggu, atau bayar denda.` : 'Studio wajib bayar denda.'}`,
    choices: (d, gs) => Number(d.stage) === 1 ? ['Siap, Pak!'] : (Number(d.showId) >= 0 && gs.s.shows.some((x) => x.id === d.showId && gs.sim.isAiring(x)) ? ['Geser jam tayang', `Bayar denda (${fmtShort(Number(d.fine))})`] : [`Bayar denda (${fmtShort(Number(d.fine))})`]),
  },
  placement: {
    title: 'PRODUCT PLACEMENT',
    text: (d, gs) => {
      const sp = v5.sponsorById(String(d.id));
      const p = gs.s.prod;
      const n = p ? p.placements.length : 0;
      return `${sp?.name ?? 'Sponsor'} (${sp?.cat ?? '-'}) mau nongol di sinetron kita. Bayar ${fmtShort(Number(d.pay))}!\nAdegan: "${sp?.line ?? ''}"\n\nIklan titipan sekarang: ${n}.`;
    },
    choices: () => ['Terima', 'Tolak'],
  },
};
