// All menu / modal screens.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import {
  GENRES, THEMES, PLATFORMS, EPISODES, BUDGETS, STUDIOS, ROLES, STATS, STAT_LABEL, TIPS, CRITICS,
  COMPAT_LABEL, POINT_KEYS, POINT_LABEL, POINT_COLOR, makeTitle, type Stat, type Compat,
} from './data';
import { fmtMoney, fmtShort, fmtNum, dateOf, saveGame, clearSave, fmtFollowers, isSeleb, SELEB_TOP, type Staff, type Pending, type Show } from './state';
import { showRatingAlert, openRatingChart, openMap } from './screens3';
import { openOstPicker, openSpinoffPicker, franchiseTitle, openEquipment, openStarAgency, openFinance, ramadanInfo, singerById } from './screens4';
import { singerFee, RAMADAN_SPONSORS } from './ost';
import { locById, locCost, locUnlocked } from './locations';
import { COL, DISPLAY, ROUND, GW, GH, DH, PW, CX0, DRAG, txt, button, bubbleGfx, woodStrip, type Modal } from './ui';
import { sfx } from './audio';
import { staffTextures, HI } from './assets';
import { EVENT_TEXT5, openAchievements, openFeed, openKpi, openPlacements, openAudition, openBackup, showEnding } from './screens5';
import * as v5 from './v5';

const ROLE_COLOR: Record<string, string> = { sutradara: '#8a3ab0', penulis: '#2d6cb0', aktor: '#c0392b', aktris: '#d0508a', kameramen: '#2e8b3a' };

export function head(m: Modal, x: number, y: number, st: Staff, scale = 2) {
  // staff sprites are 2x bitmaps (~32 logical px tall at HI); old chibi scale 2 ~ 48px
  if (!m.scene.textures.exists(`st${st.id}_0`)) staffTextures(m.scene, st);
  const sc = scale >= 3 ? 1 : scale >= 2 ? 0.75 : HI;
  return m.img(x, y + 2, `st${st.id}_0`, sc).setOrigin(0.5, 1);
}

export function card(m: Modal, x: number, y: number, w: number, h: number, kind: 'paper' | 'btn' | 'sel' | 'cream' = 'paper', onTap?: () => void) {
  m.panel(x, y, w, h, kind);
  if (onTap) {
    const z = m.add(m.scene.add.zone(x, y, w, h).setOrigin(0, 0));
    z.setInteractive({ useHandCursor: true });
    z.on('pointerup', () => { if (DRAG.moved) return; sfx.click(); onTap(); });
  }
}

/** small pill badge: SELEBGRAM / SELEB TOP / ARTIS TENAR */
function badge(m: Modal, x: number, y: number, label: string, fill = 0xe0407a) {
  const t = txt(m.scene, 0, 0, label, 8, '#fff8e8', { font: ROUND, weight: '800', oy: 0.5, stroke: '#5a0a2a', strokeW: 2 });
  const w = Math.round(t.width + 10);
  const g = m.add(m.scene.add.graphics());
  g.fillStyle(0x3a0a1a, 1); g.fillRoundedRect(x - 1, y - 1, w + 2, 14, 7);
  g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, 12, 6);
  g.fillStyle(0xffffff, 0.35); g.fillRoundedRect(x + 3, y + 1, w - 6, 3, 2);
  t.setPosition(x + 5, y + 6); m.add(t);
  return w;
}
function starBadge(m: Modal, x: number, y: number, st: Staff, starFirst = false): number {
  if (starFirst && st.star) return badge(m, x, y, 'ARTIS TENAR', 0xd08a10);
  if (st.followers >= SELEB_TOP) return badge(m, x, y, 'SELEB TOP', 0xc0302a);
  if (isSeleb(st)) return badge(m, x, y, 'SELEBGRAM', 0xe0407a);
  if (st.star) return badge(m, x, y, 'ARTIS TENAR', 0xd08a10);
  return 0;
}

function statLine(st: Staff): string {
  return `Akt ${st.stats.akting}  Nsk ${st.stats.naskah}  Vis ${st.stats.visual}  Psn ${st.stats.pesona}  Stm ${st.stats.stamina}`;
}

/** shorten long (Indosiar-style) titles for one-line spots */
export function short(t: string, n: number) { return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }

// ---------------------------------------------------------------- welcome / tips
export function showWelcome(gs: GameScene) {
  const m = gs.modal({ w: 320, h: 300, title: 'SELAMAT DATANG' });
  m.build((m) => {
    m.text(18, 24, 'Halo, Bos!', 14, COL.text, { bold: true });
    m.text(18, 46, 'Kamu baru buka rumah produksi sinetron di garasi. Modalnya pas-pasan, kru-nya 4 orang, tapi mimpinya: rating 40%!\n\nBikin sinetron, kumpulkan fans, buka genre baru, dan rebut piala Sinetron Terbaik.\n\nMau dipandu langkah demi langkah sampai sinetron pertama tayang?', 11, COL.text, { wrap: 284, lineSpacing: 3 });
    m.btn(14, 244, 140, 40, 'Langsung Main', () => { gs.s.tut = -1; m.close(); }, { size: 12 }).setName('tutNo');
    m.btn(162, 244, 144, 40, 'Pandu Aku!', () => { gs.s.tut = 1; m.close(); }, { kind: 'primary', size: 13 }).setName('tutYes');
  });
}

export function showTips(gs: GameScene, page = 0) {
  const m = gs.modal({ w: 320, h: 300, title: 'CARA MAIN', closable: true });
  let p = page;
  m.build((m) => {
    m.text(20, 24, `Tips ${p + 1}/${TIPS.length}`, 10, COL.muted);
    m.panel(14, 42, 292, 180, 'paper');
    m.text(26, 54, TIPS[p], 12, COL.text, { wrap: 268, lineSpacing: 4 });
    m.btn(14, 240, 90, 34, '< Prev', () => { p = (p + TIPS.length - 1) % TIPS.length; m.rebuild(); });
    m.btn(115, 240, 90, 34, 'Tutup', () => m.close(), { kind: 'primary' });
    m.btn(216, 240, 90, 34, 'Next >', () => { p = (p + 1) % TIPS.length; m.rebuild(); });
  });
}

// ---------------------------------------------------------------- menu
export function openMenu(gs: GameScene) {
  const m = gs.modal({ w: 300, h: 450, y: 70, title: 'MENU', closable: true });
  m.build((m) => {
    const s = gs.s;
    const d = dateOf(s.absWeek);
    m.text(150, 22, `Tahun ${d.year}, Bulan ${d.month}, Minggu ${d.week}`, 10, COL.muted, { ox: 0.5 });
    const items: [string, () => void, string?][] = [
      ['Simpan Game', () => { const ok = saveGame(s); gs.toast(ok ? 'Game tersimpan!' : 'Gagal menyimpan :('); m.close(); }],
      ['Backup Save', () => { m.close(); openBackup(gs); }, 'green'],
      ['Tangga Rating', () => { m.close(); openRatingChart(gs); }],
      ['Linimasa Netizen', () => { m.close(); openFeed(gs); }],
      ['Prestasi', () => { m.close(); openAchievements(gs); }],
      ['KPI & Netizen', () => { m.close(); openKpi(gs); }],
      ['Riwayat Sinetron', () => { m.close(); openHistory(gs); }],
      ['Catatan Combo', () => { m.close(); openCombos(gs); }],
      ['Suara: ' + (sfx.muted ? 'MATI' : 'NYALA'), () => { sfx.setMuted(!sfx.muted); m.rebuild(); }],
      ['Musik: ' + (sfx.musicOn ? 'NYALA' : 'MATI'), () => { sfx.setMusic(!sfx.musicOn); m.rebuild(); }],
      ['Cara Main', () => { m.close(); showTips(gs); }],
      ['Ulang Tutorial', () => { m.close(); gs.tut?.restart(); }],
    ];
    items.forEach(([label, fn, kind], i) => m.btn(14 + (i % 2) * 138, 38 + Math.floor(i / 2) * 44, 134, 38, label, fn, { kind: (kind as 'green') ?? 'btn', size: 11 }).setName('menu_' + label.split(':')[0].toLowerCase().replace(/ /g, '_')));
    m.btn(14, 308, 272, 38, 'Tentang Game', () => { m.close(); openAbout(gs); }, { size: 11 }).setName('menu_tentang');
    m.btn(14, 354, 272, 38, 'Ke Layar Judul', () => { saveGame(s); gs.scene.start('Title'); }, { kind: 'dark', size: 12 });
    m.text(150, 412, 'Dibuat oleh KodeKecil · kodekecil.my.id', 9, COL.muted, { ox: 0.5, font: ROUND, weight: '700' }).setName('creditMenu');
    m.text(150, 428, 'Esc tutup  ·  Spasi jeda  ·  Roda mouse zoom', 8, '#a08a6a', { ox: 0.5, font: ROUND, weight: '600' });
  });
}

export function openAbout(gs: GameScene) {
  const m = gs.modal({ w: 300, h: 300, title: 'TENTANG', closable: true });
  m.build((m) => {
    m.text(150, 30, 'SINETRON STORY', 18, '#e8601a', { ox: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 3 });
    m.text(150, 56, 'Pabrik Air Mata Nasional  ·  v5', 11, COL.text, { ox: 0.5, font: ROUND, weight: '800' });
    m.text(150, 84, 'Game manajemen rumah produksi sinetron. Semua nama stasiun, artis, brand & lembaga di game ini fiktif.', 10, COL.muted, { ox: 0.5, align: 'center', wrap: 260, font: ROUND, weight: '600' });
    m.panel(20, 140, 260, 62, 'paper');
    m.text(150, 152, 'Dibuat oleh KodeKecil', 13, COL.text, { ox: 0.5, font: ROUND, weight: '800' }).setName('creditAbout');
    m.text(150, 172, 'kodekecil.my.id', 12, COL.blue, { ox: 0.5, font: ROUND, weight: '800' });
    m.btn(60, 230, 180, 44, 'Tutup', () => m.close(), { kind: 'primary', size: 13 });
  });
  return m;
}

// ---------------------------------------------------------------- staff
export function openStaff(gs: GameScene) {
  let page = 0;
  const per = 5;
  const m = gs.modal({ w: 340, h: 500, y: 62, title: 'STAF', closable: true });
  m.build((m) => {
    const s = gs.s;
    const pages = Math.max(1, Math.ceil(s.staff.length / per));
    page = Math.min(page, pages - 1);
    m.text(14, 20, `${s.staff.length}/${gs.sim.maxStaff()} orang  -  Gaji ${fmtShort(gs.sim.monthlySalaries())}/bln`, 10, COL.muted);
    s.staff.slice(page * per, page * per + per).forEach((st, i) => {
      const y = 38 + i * 70;
      card(m, 10, y, 320, 66, 'paper', () => { m.close(); openStaffDetail(gs, st); });
      head(m, 34, y + 58, st);
      const nm = m.text(60, y + 6, st.name, 12, COL.text, { bold: true });
      const actor = st.role === 'aktor' || st.role === 'aktris';
      if (actor) starBadge(m, 66 + nm.width, y + 7, st);
      const rl = m.text(60, y + 21, `${ROLES[st.role].label}  Lv ${st.level}`, 10, ROLE_COLOR[st.role], { bold: true });
      if (actor) m.text(66 + rl.width, y + 22, `${fmtFollowers(st.followers)} followers`, 9, isSeleb(st) ? '#c0306a' : COL.muted, { bold: isSeleb(st) });
      m.text(320, y + 7, fmtShort(st.salary) + '/bln', 10, COL.muted, { ox: 1 });
      m.text(206, y + 22, 'Energi', 9, COL.muted);
      m.bar(244, y + 24, 76, 8, st.energy / 100, st.energy < 30 ? 0xe05a3a : 0x6ac46a);
      m.text(60, y + 42, statLine(st), 9, COL.text);
      if (st.strike) m.text(320, y + 42, 'MOGOK!', 10, COL.red, { ox: 1, bold: true });
      else if (actor && st.trait) m.text(320, y + 54, v5.traitName(st), 8, '#b04a1a', { ox: 1, font: ROUND, weight: '800' });
    });
    if (pages > 1) {
      m.btn(10, 392, 60, 28, '<', () => { page = (page + pages - 1) % pages; m.rebuild(); });
      m.text(170, 406, `${page + 1}/${pages}`, 11, COL.text, { ox: 0.5, oy: 0.5 });
      m.btn(270, 392, 60, 28, '>', () => { page = (page + 1) % pages; m.rebuild(); });
    }
    m.btn(10, 428, 104, 58, 'Rekrut Staf', () => { m.close(); openRecruit(gs); }, { kind: 'primary', size: 12 }).setName('tut_rekrut');
    m.btn(118, 428, 104, 58, 'Audisi\nPemeran', () => { m.close(); openAudition(gs); }, { size: 11, icon: undefined }).setName('btn_audisi');
    m.btn(226, 428, 104, 58, `Traktir Bakso\n${fmtShort(gs.sim.treatCost())}`, () => {
      const err = gs.sim.treat();
      if (err) gs.toast(err); else { gs.toast('Semua staf kenyang & segar! (Energi penuh)'); sfx.coin(); }
      m.rebuild();
    }, { kind: 'green', size: 11 });
  });
}

export function openStaffDetail(gs: GameScene, st: Staff) {
  const m = gs.modal({ w: 330, h: 480, y: 70, title: 'PROFIL', closable: true });
  m.build((m) => {
    if (!gs.s.staff.includes(st)) { m.close(); return; }
    m.panel(12, 22, 80, 96, 'paper');
    head(m, 52, 112, st, 3);
    m.text(102, 24, st.name, 14, COL.text, { bold: true });
    m.text(102, 42, `${ROLES[st.role].label}  -  Level ${st.level}`, 11, ROLE_COLOR[st.role], { bold: true });
    m.text(102, 58, `Gaji ${fmtShort(st.salary)}/bln  ·  pasaran ~${fmtShort(gs.sim.marketSalary(st))}`, 10, st.salary < gs.sim.marketSalary(st) * 0.7 ? COL.red : COL.muted);
    m.text(102, 76, 'Energi', 10);
    m.bar(150, 78, 160, 9, st.energy / 100, st.energy < 30 ? 0xe05a3a : 0x6ac46a);
    m.text(102, 94, 'EXP', 10);
    m.bar(150, 96, 160, 9, st.exp / (45 + st.level * 30), 0x6aa0e0);
    STATS.forEach((k, i) => {
      const y = 128 + i * 22;
      m.text(20, y, STAT_LABEL[k], 11, COL.text, { bold: ROLES[st.role].main.includes(k) });
      m.bar(90, y + 2, 180, 11, Math.min(1, st.stats[k] / 160), ROLES[st.role].main.includes(k) ? 0xf0a040 : 0xc8a878);
      m.text(312, y, String(st.stats[k]), 11, COL.text, { ox: 1, bold: true });
    });
    m.text(20, 244, `Latihan (${fmtShort(gs.sim.trainCost(st))}, -25 energi):`, 10, COL.muted);
    const tr: [Stat, string][] = [['akting', 'Kelas Akting'], ['naskah', 'Workshop Naskah'], ['visual', 'Kursus Kamera'], ['pesona', 'Kelas Pesona'], ['stamina', 'Senam Pagi']];
    tr.forEach(([k, label], i) => {
      const x = 14 + (i % 2) * 152, y = 262 + Math.floor(i / 2) * 38;
      m.btn(x, y, 148, 34, label, () => {
        const err = gs.sim.train(st, k);
        if (err) gs.toast(err); else { gs.toast(`${st.name}: ${STAT_LABEL[k]} naik!`); sfx.levelup(); }
        gs.refreshHud();
        m.rebuild();
      }, { size: 11, kind: ROLES[st.role].main.includes(k) ? 'sel' : 'btn' });
    });
    m.btn(166, 338, 150, 34, 'Pecat', () => confirmFire(gs, st, m), { kind: 'red', size: 11 });
    if (st.trait) { m.text(20, 338, 'Sifat: ' + v5.traitName(st), 10, '#b04a1a', { font: ROUND, weight: '800' }); m.text(20, 352, v5.traitById(st.trait)?.desc ?? '', 8, COL.muted, { wrap: 140, lineSpacing: -1, font: ROUND, weight: '600' }); }
    else if (st.strike) m.text(20, 344, 'Lagi MOGOK!', 11, COL.red, { bold: true });
    const actor = st.role === 'aktor' || st.role === 'aktris';
    m.text(20, 380, actor ? `Followers: ${fmtFollowers(st.followers)}` : `Followers: ${fmtFollowers(st.followers)} (kru)`, 11, isSeleb(st) ? '#c0306a' : COL.text, { bold: true });
    if (actor) starBadge(m, 200, 381, st);
    m.text(20, 399, 'Loyalitas', 11);
    m.bar(90, 401, 180, 11, st.loyalty / 100, st.loyalty < 40 ? 0xe05a3a : st.loyalty < 65 ? 0xf6c440 : 0x6ac46a);
    m.text(312, 399, String(Math.round(st.loyalty)), 11, COL.text, { ox: 1, bold: true });
    m.btn(14, 424, 302, 42, 'Kembali', () => { m.close(); openStaff(gs); }, { size: 12 });
  });
}

function confirmFire(gs: GameScene, st: Staff, parent: Modal) {
  const m = gs.modal({ w: 280, h: 170, title: 'PECAT?' });
  m.build((m) => {
    m.text(140, 30, `Yakin pecat ${st.name}?\nDia bakal nangis di parkiran.`, 12, COL.text, { ox: 0.5, align: 'center', wrap: 250 });
    m.btn(16, 110, 118, 40, 'Batal', () => m.close());
    m.btn(146, 110, 118, 40, 'Pecat!', () => {
      gs.sim.fire(st); gs.rebuildAfterStaffChange(); sfx.bad(); m.close(); parent.close(); gs.toast(`${st.name} dipecat.`);
    }, { kind: 'red' });
  });
}

export function openRecruit(gs: GameScene) {
  const m = gs.modal({ w: 340, h: 500, y: 62, title: 'REKRUT', closable: true });
  m.build((m) => {
    const s = gs.s;
    m.text(14, 20, `Kandidat bulan ini  (${s.staff.length}/${gs.sim.maxStaff()} staf)`, 10, COL.muted);
    s.candidates.forEach((c, i) => {
      const y = 38 + i * 88;
      card(m, 10, y, 320, 84, 'paper');
      head(m, 34, y + 60, c);
      const nm = m.text(60, y + 6, c.name, 12, COL.text, { bold: true });
      if (c.role === 'aktor' || c.role === 'aktris') starBadge(m, 66 + nm.width, y + 7, c, true);
      const rl = m.text(60, y + 21, `${ROLES[c.role].label}  Lv ${c.level}`, 10, ROLE_COLOR[c.role], { bold: true });
      if (c.role === 'aktor' || c.role === 'aktris') m.text(66 + rl.width, y + 22, `${fmtFollowers(c.followers)} followers`, 9, isSeleb(c) ? '#c0306a' : COL.muted, { bold: isSeleb(c) });
      m.text(60, y + 36, statLine(c), 9);
      m.text(60, y + 52, `Gaji ${fmtShort(c.salary)}/bln`, 10, COL.muted);
      m.text(60, y + 65, `Kontrak ${fmtShort(gs.sim.hireFee(c))}`, 10, COL.muted);
      if (c.trait) m.text(322, y + 8, v5.traitName(c), 9, '#b04a1a', { ox: 1, font: ROUND, weight: '800' });
      m.btn(236, y + 46, 86, 30, 'Rekrut', () => {
        const err = gs.sim.hire(c);
        if (err) { gs.toast(err); sfx.bad(); }
        else { gs.rebuildAfterStaffChange(); gs.toast(`${c.name} bergabung!`); sfx.levelup(); }
        m.rebuild();
      }, { kind: 'primary', size: 11 }).setName(c.role === 'kameramen' ? 'tut_hire' : 'hire' + i);
    });
    if (!s.candidates.length) m.text(170, 150, 'Belum ada kandidat.\nTunggu bulan depan.', 12, COL.muted, { ox: 0.5, align: 'center' });
    m.btn(10, 400, 320, 40, 'Cari Kandidat Lain (Rp 300 rb)', () => {
      const err = gs.sim.refreshCandidates(); if (err) gs.toast(err); gs.refreshHud(); m.rebuild();
    }).setName('tut_refresh');
    m.btn(10, 448, 320, 40, 'Kembali', () => { m.close(); openStaff(gs); });
  });
}

// ---------------------------------------------------------------- production
export function openProduction(gs: GameScene) {
  const s = gs.s;
  if (s.prod) return openProdStatus(gs);
  const m = gs.modal({ w: 300, h: 330, title: 'PRODUKSI', closable: true });
  m.build((m) => {
    const busy = gs.sim.canStart();
    m.btn(20, 30, 260, 50, 'Sinetron Baru!', () => { m.close(); newProduction(gs); }, { kind: busy ? 'disabled' : 'primary', size: 14, disabled: !!busy }).setName('tut_new');
    m.btn(20, 90, 260, 44, 'Job Sampingan', () => { m.close(); openJobs(gs); }, { disabled: !!busy, size: 12 });
    m.btn(20, 144, 260, 44, 'Riwayat Sinetron', () => { m.close(); openHistory(gs); }, { size: 12 });
    m.btn(20, 198, 260, 44, 'Catatan Combo', () => { m.close(); openCombos(gs); }, { size: 12 });
    if (busy) m.text(150, 262, busy, 11, COL.red, { ox: 0.5, align: 'center', wrap: 260 });
    else m.text(150, 262, 'Kombinasi genre & tema yang pas\nbikin rating meledak!', 10, COL.muted, { ox: 0.5, align: 'center' });
  });
}

function openProdStatus(gs: GameScene) {
  const m = gs.modal({ w: 320, h: 400, title: 'STATUS PRODUKSI', closable: true });
  m.build((m) => {
    const p = gs.s.prod;
    if (!p) { m.close(); return; }
    const g = GENRES.find((x) => x.id === p.genre)!, t = THEMES.find((x) => x.id === p.theme)!;
    const pl = PLATFORMS.find((x) => x.id === p.platform)!;
    m.text(160, 24, short(p.title, 50), p.title.length > 28 ? 10 : 13, COL.text, { ox: 0.5, bold: true, align: 'center', wrap: 290 });
    m.text(160, 46, `${g.name} x ${t.name}  -  ${pl.name}  -  ${p.eps} episode`, 10, COL.muted, { ox: 0.5 });
    const pi = gs.sim.phaseIndex(p.phase);
    const names = ['Naskah', 'Syuting', 'Editing'];
    names.forEach((n, i) => {
      m.text(20, 70 + i * 22, n, 11, COL.text, { bold: i === pi });
      const frac = i < pi ? 1 : i > pi ? 0 : p.phaseTick / p.phaseTicks[i];
      m.bar(90, 72 + i * 22, 210, 11, frac, i < pi ? 0x6ac46a : 0xf6c440);
    });
    POINT_KEYS.forEach((k, i) => {
      const y = 146 + i * 20;
      m.text(30, y, POINT_LABEL[k], 11);
      m.text(290, y, fmtNum(p.points[k]), 12, COL.text, { ox: 1, bold: true });
      const gg = m.add(gs.add.graphics());
      gg.fillStyle(COL.out, 1); gg.fillRect(16, y + 2, 9, 9);
      gg.fillStyle(Phaser.Display.Color.HexStringToColor(POINT_COLOR[k]).color, 1); gg.fillRect(17, y + 3, 7, 7);
    });
    m.text(30, 228, 'Blooper', 11, COL.red); m.text(290, 228, String(p.bloopers), 12, COL.red, { ox: 1, bold: true });
    m.text(30, 248, 'Hype (promosi)', 11, '#b04a8a'); m.text(290, 248, fmtNum(p.hype), 12, '#b04a8a', { ox: 1, bold: true });
    const loc = locById(p.location);
    m.text(30, 268, loc ? `Lokasi: ${loc.name}` : 'Lokasi: studio sendiri', 10, loc ? COL.blue : COL.muted, { bold: !!loc });
    if (!loc && !gs.sim.canSetLocation()) m.btn(200, 263, 104, 22, 'Buka Peta', () => { m.close(); openMap(gs); }, { size: 10 });
    m.btn(16, 292, 140, 34, `Sponsor (${p.placements.length}${p.offers.length ? ` +${p.offers.length} baru` : ''})`, () => { m.close(); openPlacements(gs); }, { size: 10, kind: p.offers.length ? 'gold' : 'btn', icon: 'i_bag', iconScale: 0.6 }).setName('btn_sponsor');
    m.btn(164, 292, 140, 34, `Sensor: ${p.sensor ? 'NYALA' : 'MATI'}`, () => { p.sensor = !p.sensor; gs.toast(p.sensor ? 'Sensor mandiri: teguran KPI -65%, rating -5%.' : 'Sensor mandiri dimatikan.'); m.rebuild(); }, { size: 10, kind: p.sensor ? 'sel' : 'btn', icon: 'i_kpi', iconScale: 0.55 });
    m.btn(16, 338, 140, 44, `Traktir Bakso\n${fmtShort(gs.sim.treatCost())}`, () => {
      const err = gs.sim.treat(); if (err) gs.toast(err); else { gs.toast('Energi semua staf penuh!'); sfx.coin(); } m.rebuild();
    }, { kind: 'green', size: 10 });
    m.btn(164, 338, 140, 44, 'Lanjut Kerja', () => m.close(), { kind: 'primary', size: 12 });
  });
}

interface Draft {
  title: string; genre: string; theme: string; platform: string; eps: number; budget: string; leadM: number | null; leadF: number | null; location: string | null;
  ost: string | null; ramadan: boolean; parentId: number | null; spin: 'sekuel' | 'spinoff' | null;
}

export function newProduction(gs: GameScene) {
  const s = gs.s;
  const last = s.shows[s.shows.length - 1];
  const d: Draft = {
    title: '', genre: s.unlockedGenres.find((g) => !last || g !== last.genre) ?? s.unlockedGenres[0],
    theme: s.unlockedThemes[0], platform: s.platforms[s.platforms.length - 1], eps: 13, budget: 'standar',
    leadM: s.staff.find((x) => x.role === 'aktor')?.id ?? null, leadF: s.staff.find((x) => x.role === 'aktris')?.id ?? null,
    location: null, ost: null, ramadan: false, parentId: null, spin: null,
  };
  d.title = makeTitle(d.genre, d.theme, Math.random, { history: s.shows, used: [d.title], noSequel: true });
  let step = 0;
  const m = gs.modal({ w: 344, h: 540, y: 56, title: 'SINETRON BARU', closable: true });
  m.build((m) => {
    if (step === 0) stepConcept(gs, m, d, () => { step = 1; m.rebuild(); });
    else if (step === 1) stepPlatform(gs, m, d, () => { step = 0; m.rebuild(); }, () => { step = 2; m.rebuild(); });
    else stepCast(gs, m, d, () => { step = 1; m.rebuild(); });
  });
}

/** new random title for the draft (a sequel / spin-off title when continuing a hit) */
function retitle(gs: GameScene, d: Draft) {
  if (d.parentId != null && d.spin) { const t = franchiseTitle(gs, d.parentId, d.spin, d.theme); if (t) { d.title = t; return; } }
  d.title = makeTitle(d.genre, d.theme, Math.random, { history: gs.s.shows, used: [d.title], noSequel: true });
}

function stepConcept(gs: GameScene, m: Modal, d: Draft, next: () => void) {
  const s = gs.s;
  const par = d.parentId != null ? s.shows.find((x) => x.id === d.parentId) : undefined;
  m.text(12, 18, 'Langkah 1/3: Konsep', 10, COL.muted);
  m.panel(10, 32, 324, 46, 'paper');
  m.text(18, 38, 'Judul:', 9, COL.muted);
  m.text(18, d.title.length > 30 ? 46 : 50, d.title, d.title.length > 30 ? 10 : 12, COL.text, { bold: true, wrap: 214 });
  m.btn(236, 38, 44, 34, 'Acak', () => { retitle(gs, d); m.rebuild(); }, { size: 10 });
  m.btn(284, 38, 44, 34, 'Ketik', () => {
    try {
      const v = window.prompt('Judul sinetron:', d.title);
      if (v && v.trim()) d.title = v.trim().slice(0, 60);
    } catch { /* prompt unavailable */ }
    m.rebuild();
  }, { size: 10 });
  m.text(12, 84, 'Genre', 11, COL.text, { bold: true });
  GENRES.forEach((g, i) => {
    const x = 10 + (i % 3) * 109, y = 98 + Math.floor(i / 3) * 26;
    const un = s.unlockedGenres.includes(g.id);
    const lockedByParent = !!par && g.id !== par.genre;
    m.btn(x, y, 106, 24, un ? g.name : '???', () => {
      if (lockedByParent) { gs.toast('Lanjutan harus genre yang sama.'); return; }
      d.genre = g.id; retitle(gs, d); m.rebuild();
    }, { kind: d.genre === g.id ? 'sel' : lockedByParent && un ? 'disabled' : 'btn', disabled: !un, size: 11, icon: un ? undefined : 'i_lock' });
  });
  m.text(12, 206, 'Tema / Setting', 11, COL.text, { bold: true });
  THEMES.forEach((t, i) => {
    const x = 10 + (i % 3) * 109, y = 220 + Math.floor(i / 3) * 26;
    const un = s.unlockedThemes.includes(t.id);
    const lockedByParent = !!par && d.spin === 'sekuel' && t.id !== par.theme;
    m.btn(x, y, 106, 24, un ? t.name : '???', () => {
      if (lockedByParent) { gs.toast('Sekuel pakai tema yang sama. Pilih Spin-off buat tema baru.'); return; }
      d.theme = t.id; retitle(gs, d); m.rebuild();
    }, { kind: d.theme === t.id ? 'sel' : lockedByParent && un ? 'disabled' : 'btn', disabled: !un, size: 11, icon: un ? undefined : 'i_lock' });
  });
  const g = GENRES.find((x) => x.id === d.genre)!;
  m.panel(10, 330, 324, 130, 'paper');
  m.text(18, 337, `${g.name}: ${g.blurb}`, 10, COL.text, { wrap: 306 });
  const known = s.knownCombos[d.genre + '|' + d.theme];
  m.text(18, 368, 'Kecocokan:', 11);
  m.text(100, 368, known ? COMPAT_LABEL[known] : '???  (belum pernah dicoba)', 11, known === 'great' ? '#c0392b' : known === 'bad' ? '#6a6a74' : COL.text, { bold: true });
  const fav = POINT_KEYS.filter((k) => g.weight[k] >= 1.1).map((k) => POINT_LABEL[k]).join(', ');
  m.text(18, 388, `Penonton genre ini suka: ${fav}`, 10, COL.muted, { wrap: 306 });
  const last = s.shows[s.shows.length - 1];
  if (par) m.text(18, 404, `${d.spin === 'sekuel' ? 'Sekuel' : 'Spin-off'} dari "${short(par.title, 28)}"`, 10, '#b04a2a', { bold: true, wrap: 306 });
  else if (last && last.genre === d.genre && last.theme === d.theme) m.text(18, 404, 'Awas! Sama persis kayak sinetron terakhir. Penonton bisa bosan.', 10, COL.red, { wrap: 306 });
  else if (s.trend === d.genre) m.text(18, 404, 'Genre ini lagi TREN! Rating pemirsa +20%', 10, '#b04a2a', { bold: true, wrap: 306 });
  const nCand = gs.sim.spinoffCandidates().length;
  m.btn(18, 426, 308, 26, par ? `Lanjutan: ${d.spin === 'sekuel' ? 'Sekuel' : 'Spin-off'}  ·  ganti / batal` : nCand ? `Bikin Sekuel / Spin-off (${nCand} hit siap)` : 'Sekuel / Spin-off (butuh hit skor 30+)', () => {
    openSpinoffPicker(gs, { current: d.parentId, select: (r) => {
      if (!r) { d.parentId = null; d.spin = null; retitle(gs, d); m.rebuild(); return; }
      const p = s.shows.find((x) => x.id === r.parentId)!;
      d.parentId = p.id; d.spin = r.spin; d.genre = p.genre;
      if (r.spin === 'sekuel') d.theme = p.theme;
      else if (d.theme === p.theme) d.theme = s.unlockedThemes.find((t) => t !== p.theme) ?? d.theme;
      retitle(gs, d); m.rebuild();
    } });
  }, { size: 10, kind: par ? 'sel' : nCand ? 'btn' : 'disabled' });
  m.btn(10, 470, 110, 50, 'Batal', () => m.close(), { size: 12 });
  m.btn(130, 470, 204, 50, 'Lanjut >', next, { kind: 'primary', size: 13 }).setName('tut_next1');
}

function stepPlatform(gs: GameScene, m: Modal, d: Draft, back: () => void, next: () => void) {
  const s = gs.s;
  m.text(12, 18, 'Langkah 2/3: Tayang & Budget', 10, COL.muted);
  m.text(12, 36, 'Platform', 11, COL.text, { bold: true });
  PLATFORMS.forEach((p, i) => {
    const un = s.platforms.includes(p.id);
    m.btn(10 + i * 109, 50, 106, 30, un ? p.name : 'Terkunci', () => { d.platform = p.id; m.rebuild(); }, { kind: d.platform === p.id ? 'sel' : 'btn', disabled: !un, size: 11 });
  });
  m.text(12, 90, 'Jumlah Episode', 11, COL.text, { bold: true });
  EPISODES.forEach((e, i) => {
    m.btn(10 + i * 109, 104, 106, 30, `${e.eps} episode`, () => { d.eps = e.eps; m.rebuild(); }, { kind: d.eps === e.eps ? 'sel' : 'btn', size: 11 });
  });
  m.text(12, 144, 'Budget Produksi', 11, COL.text, { bold: true });
  BUDGETS.forEach((b, i) => {
    m.btn(10 + i * 109, 158, 106, 30, b.name, () => { d.budget = b.id; m.rebuild(); }, { kind: d.budget === b.id ? 'sel' : 'btn', size: 11 });
  });
  const pl = PLATFORMS.find((x) => x.id === d.platform)!;
  const ep = EPISODES.find((x) => x.eps === d.eps)!;
  const bd = BUDGETS.find((x) => x.id === d.budget)!;
  const loc = locById(d.location);
  if (loc && !locUnlocked(loc, s.fans, dateOf(s.absWeek).year)) d.location = null;
  const lc = loc ? locCost(loc, d.platform, d.eps) : 0;
  const cost = gs.sim.prodCost(d.platform, d.eps, d.budget) + lc;
  const weeks = Math.round((3 + 5 + 2) * ep.factor);
  m.text(12, 196, 'Lokasi Syuting', 11, COL.text, { bold: true });
  m.btn(108, 192, 226, 24, loc ? `${loc.name} (${fmtShort(lc)})` : 'Studio sendiri (gratis)  ·  Buka Peta', () => {
    openMap(gs, { select: (id) => { d.location = id; m.rebuild(); }, current: d.location, platform: d.platform, eps: d.eps, genre: d.genre, theme: d.theme });
  }, { kind: loc ? 'sel' : 'btn', size: 10, icon: 'i_peta', iconScale: 0.55 });
  // OST
  const sg = singerById(d.ost);
  if (sg && s.fans < sg.unlockFans) d.ost = null;
  m.text(12, 226, 'OST', 11, COL.text, { bold: true });
  m.btn(108, 222, 226, 24, sg ? `${sg.name} (${fmtShort(singerFee(sg, d.platform))})` : 'Tanpa OST  ·  Pilih penyanyi', () => {
    openOstPicker(gs, { platform: d.platform, genre: d.genre, current: d.ost, select: (id) => { d.ost = id; m.rebuild(); } });
  }, { kind: sg ? 'sel' : 'btn', size: 10 });
  // Sinetron Ramadan slot
  const rErr = gs.sim.canRamadanSlot(d.genre);
  if (rErr) d.ramadan = false;
  const ri = ramadanInfo(gs);
  m.text(12, 256, 'Ramadan', 11, '#2e7a3a', { bold: true });
  const base = gs.sim.prodCost(d.platform, d.eps, d.budget);
  m.btn(108, 252, 226, 24, rErr ? (ri.weeks <= 20 ? 'Slot Ramadan: ' + rErr.replace('Slot Ramadan ', '') : ri.text) : d.ramadan ? `Slot Ramadan: sponsor +${fmtShort(gs.sim.ramadanSponsor(base))}` : `Ambil slot Sinetron Ramadan?`, () => {
    if (rErr) { gs.toast(rErr); return; }
    d.ramadan = !d.ramadan; m.rebuild();
  }, { kind: rErr ? 'disabled' : d.ramadan ? 'green' : 'btn', size: rErr ? 9 : 10 });
  const q = gs.sim.quote({ ...d });
  m.panel(10, 282, 324, 176, 'paper');
  const rows: [string, string, string?][] = [
    ['Biaya total (produksi, honor, ekstra)', fmtMoney(q.total), q.total > s.money ? COL.red : COL.text],
    ['Kas sekarang', fmtMoney(s.money)],
    ['Biaya rutin / bulan', fmtMoney(gs.sim.monthlyCosts())],
    ['Produksi  ·  tayang', `~${weeks} mg  ·  ${ep.airWeeks} mg`],
    ['Kualitas kerja', `${Math.round(bd.workMult * 100)}%`],
    ['Penonton maks', `${pl.maxRating}%-an`],
  ];
  rows.forEach(([a, b, c], i) => {
    m.text(22, 290 + i * 19, a, 11);
    m.text(322, 290 + i * 19, b, 11, c ?? COL.text, { ox: 1, bold: true });
  });
  void cost;
  const tip = d.ramadan ? `Disponsori ${RAMADAN_SPONSORS[(s.absWeek >> 2) % RAMADAN_SPONSORS.length]}! Rating ekstra kencang selama Ramadan, tapi basi setelah Lebaran.`
    : pl.id === 'lokal' ? 'TV Lokal: murah, penonton sedikit. Cocok buat pemula.' : pl.id === 'nasional' ? 'TV Nasional: penonton se-Indonesia, kritikus lebih galak.' : 'Streaming: cuan gede, tapi kritikus paling pedas.';
  m.text(22, 408, tip, 10, d.ramadan ? '#2e7a3a' : COL.muted, { wrap: 300 });
  m.btn(10, 470, 110, 50, '< Balik', back, { size: 12 });
  m.btn(130, 470, 204, 50, 'Lanjut >', next, { kind: 'primary', size: 13 }).setName('tut_next2');
}

function stepCast(gs: GameScene, m: Modal, d: Draft, back: () => void) {
  const s = gs.s;
  m.text(12, 18, 'Langkah 3/3: Pemeran Utama', 10, COL.muted);
  const males = s.staff.filter((x) => !x.look.female).sort((a, b) => (b.role === 'aktor' ? 1 : 0) - (a.role === 'aktor' ? 1 : 0));
  const females = s.staff.filter((x) => x.look.female).sort((a, b) => (b.role === 'aktris' ? 1 : 0) - (a.role === 'aktris' ? 1 : 0));
  const list = (label: string, arr: Staff[], y0: number, sel: number | null, set: (id: number | null) => void) => {
    m.text(12, y0, label, 11, COL.text, { bold: true });
    arr.slice(0, 4).forEach((st, i) => {
      const x = 10 + (i % 2) * 163, y = y0 + 14 + Math.floor(i / 2) * 50;
      card(m, x, y, 160, 46, sel === st.id ? 'sel' : 'btn', () => { set(sel === st.id ? null : st.id); m.rebuild(); });
      head(m, x + 18, y + 42, st, 1.5);
      m.text(x + 34, y + 5, st.name, 10, COL.text, { bold: true });
      m.text(x + 34, y + 18, ROLES[st.role].label + (st.trait ? ' · ' + v5.traitName(st) : '') + (st.strike ? ' · MOGOK' : ''), 9, st.strike ? COL.red : ROLE_COLOR[st.role]);
      m.text(x + 34, y + 30, `Akt ${st.stats.akting}  Psn ${st.stats.pesona}`, 9);
    });
    if (!arr.length) m.text(20, y0 + 20, '(nggak ada)', 10, COL.muted);
  };
  list('Pemeran Utama Pria', males, 34, d.leadM, (id) => { d.leadM = id; });
  list('Pemeran Utama Wanita', females, 156, d.leadF, (id) => { d.leadF = id; });
  const g = GENRES.find((x) => x.id === d.genre)!, t = THEMES.find((x) => x.id === d.theme)!;
  const loc = locById(d.location);
  const q = gs.sim.quote({ ...d });
  const cost = q.total;
  m.panel(10, 280, 324, 172, 'paper');
  m.text(172, 288, d.title, d.title.length > 30 ? 11 : 13, COL.text, { ox: 0.5, bold: true, align: 'center', wrap: 300 });
  m.text(172, 322, `${g.name} x ${t.name}`, 11, COL.blue, { ox: 0.5, bold: true });
  m.text(172, 340, `${PLATFORMS.find((x) => x.id === d.platform)!.name} - ${d.eps} episode - ${BUDGETS.find((x) => x.id === d.budget)!.name}${loc ? ' - ' + loc.short : ''}`, 10, COL.muted, { ox: 0.5 });
  m.text(172, 358, `Biaya: ${fmtMoney(cost)}`, 12, cost > s.money ? COL.red : COL.text, { ox: 0.5, bold: true });
  const parts = [`Produksi ${fmtShort(q.base + q.loc)}`, `Honor ${fmtShort(q.honor)}`];
  if (q.ost) parts.push(`OST ${fmtShort(q.ost)}`);
  if (q.sponsor) parts.push(`Sponsor -${fmtShort(q.sponsor)}`);
  m.text(172, 375, parts.join('  ·  '), 9, COL.muted, { ox: 0.5, font: ROUND, weight: '700' });
  if (d.leadM != null && d.leadF != null) {
    const ch = v5.chemistry(s, d.leadM, d.leadF);
    const pc = Math.round((v5.chemMult(ch) - 1) * 100);
    m.text(172, 390, `Chemistry pemeran utama: ${ch} (${v5.chemLabel(ch)})  ·  rating ${pc >= 0 ? '+' : ''}${pc}%`, 10, ch >= 70 ? COL.green : ch < 50 ? COL.red : COL.text, { ox: 0.5, font: ROUND, weight: '800' }).setName('chemLine');
    m.text(172, 405, 'Cari pasangan yang lebih klop lewat Audisi (menu Staf).', 9, COL.muted, { ox: 0.5 });
  } else m.text(172, 390, 'Pemeran utama dapat bonus akting saat syuting.\nPesona & followers naikin rating (honornya juga!).', 9, COL.muted, { ox: 0.5, align: 'center' });
  if (cost > s.money) m.text(172, 422, 'Uang nggak cukup! Kurangi budget/episode,\natau ambil Job Sampingan dulu.', 10, COL.red, { ox: 0.5, align: 'center' });
  m.btn(10, 470, 110, 50, '< Balik', back, { size: 12 });
  m.btn(130, 470, 204, 50, 'MULAI!', () => {
    const err = cost > s.money ? 'Uang nggak cukup!' : gs.sim.startProduction({ ...d });
    if (err) { gs.toast(err); sfx.bad(); return; }
    sfx.fanfare();
    m.close();
    gs.refreshHud();
    gs.refreshStatus(true);
  }, { kind: cost > s.money ? 'disabled' : 'primary', size: 15, font: DISPLAY, disabled: cost > s.money }).setName('tut_mulai');
}

export function openJobs(gs: GameScene) {
  const m = gs.modal({ w: 330, h: 400, title: 'JOB SAMPINGAN', closable: true });
  m.build((m) => {
    const s = gs.s;
    m.text(14, 20, 'Proyek cepat buat nambah kas & poin riset.', 10, COL.muted);
    s.jobOffers.forEach((j, i) => {
      const y = 40 + i * 92;
      card(m, 10, y, 310, 86, 'paper');
      m.text(20, y + 8, j.name, 12, COL.text, { bold: true });
      m.text(20, y + 26, `${j.weeks} minggu  -  Target kerja ${j.need}`, 10, COL.muted);
      m.text(20, y + 44, `Bayaran s/d ${fmtShort(j.pay * 1.15)}`, 11, COL.green, { bold: true });
      m.btn(216, y + 46, 96, 32, 'Ambil', () => {
        const err = gs.sim.startJob(j);
        if (err) gs.toast(err); else { gs.toast(`Job "${j.name}" dimulai!`); m.close(); gs.refreshStatus(true); }
      }, { kind: 'primary', size: 11 });
    });
    if (!s.jobOffers.length) m.text(165, 140, 'Belum ada tawaran.\nCoba lagi bulan depan.', 12, COL.muted, { ox: 0.5, align: 'center' });
  });
}

export function openHistory(gs: GameScene) {
  let page = 0;
  const per = 6;
  const m = gs.modal({ w: 340, h: 500, y: 62, title: 'RIWAYAT', closable: true });
  m.build((m) => {
    const list = [...gs.s.shows].reverse();
    const pages = Math.max(1, Math.ceil(list.length / per));
    if (!list.length) m.text(170, 120, 'Belum ada sinetron.\nAyo produksi yang pertama!', 12, COL.muted, { ox: 0.5, align: 'center' });
    list.slice(page * per, page * per + per).forEach((sh, i) => {
      const y = 26 + i * 64;
      card(m, 10, y, 320, 60, sh.hof ? 'sel' : 'paper', () => { showRating(gs, sh, () => undefined, true); });
      const d = dateOf(sh.releaseWeek);
      m.text(18, y + 6, short(sh.title, 46), sh.title.length > 36 ? 9 : 11, COL.text, { bold: true });
      m.text(18, y + 24, `${GENRES.find((x) => x.id === sh.genre)!.name} x ${THEMES.find((x) => x.id === sh.theme)!.name}  -  Th${d.year}`, 9, COL.muted);
      const best = sh.ranks.length ? Math.min(...sh.ranks) : 0;
      m.text(18, y + 38, `Rating ${sh.rating}%${best ? `  -  Puncak #${best}` : ''}  -  Untung ${fmtShort(sh.revenue - sh.cost)}${sh.cancelled ? ' (distop)' : sh.weeksAired < sh.airWeeks ? ' (tayang)' : ''}`, 9, sh.revenue >= sh.cost ? COL.green : COL.red);
      m.text(322, y + 12, String(sh.total), 20, sh.hof ? '#c0392b' : COL.text, { ox: 1, font: DISPLAY });
      m.text(322, y + 38, sh.hof ? 'HoF' : '/40', 9, COL.muted, { ox: 1 });
    });
    if (pages > 1) {
      m.btn(10, 420, 70, 32, '<', () => { page = (page + pages - 1) % pages; m.rebuild(); });
      m.text(170, 436, `${page + 1}/${pages}`, 11, COL.text, { ox: 0.5, oy: 0.5 });
      m.btn(260, 420, 70, 32, '>', () => { page = (page + 1) % pages; m.rebuild(); });
    }
    m.text(170, 470, `Total pendapatan: ${fmtShort(gs.s.totalRevenue)}  -  Piala: ${gs.s.trophies}`, 10, COL.muted, { ox: 0.5 });
  });
}

export function openCombos(gs: GameScene) {
  const m = gs.modal({ w: 340, h: 500, y: 62, title: 'CATATAN COMBO', closable: true });
  m.build((m) => {
    const entries = Object.entries(gs.s.knownCombos) as [string, Compat][];
    const order: Compat[] = ['great', 'good', 'ok', 'bad'];
    entries.sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]));
    m.text(14, 20, `Kombinasi yang sudah ketahuan: ${entries.length}`, 10, COL.muted);
    if (!entries.length) m.text(170, 120, 'Masih kosong. Kombinasi\nterungkap setelah sinetron tayang.', 12, COL.muted, { ox: 0.5, align: 'center' });
    entries.slice(0, 18).forEach(([k, c], i) => {
      const [g, t] = k.split('|');
      const y = 40 + i * 23;
      m.panel(10, y, 320, 21, c === 'great' ? 'sel' : 'paper');
      m.text(20, y + 4, `${GENRES.find((x) => x.id === g)!.name} x ${THEMES.find((x) => x.id === t)!.name}`, 11);
      m.text(320, y + 4, COMPAT_LABEL[c], 11, c === 'great' ? '#c0392b' : c === 'bad' ? '#6a6a74' : COL.text, { ox: 1, bold: true });
    });
  });
}

// ---------------------------------------------------------------- studio
export function openStudio(gs: GameScene) {
  const m = gs.modal({ w: 300, h: 516, y: 64, title: 'STUDIO', closable: true });
  m.build((m) => {
    const s = gs.s;
    const st = STUDIOS[s.studio - 1];
    m.text(150, 20, `${st.name} (Lv ${s.studio})  -  maks ${st.maxStaff} staf`, 10, COL.muted, { ox: 0.5 });
    const items: [string, () => void, string?][] = [
      ['Renovasi Studio', () => { m.close(); openUpgrade(gs); }, 'i_house'],
      [`Riset (Poin: ${s.rp})`, () => { m.close(); openResearch(gs); }, 'i_bulb'],
      ['Kontrak Platform', () => { m.close(); openPlatforms(gs); }, 'i_tvicon'],
      [`Peralatan (${s.equipment.length})`, () => { m.close(); openEquipment(gs); }],
      ['Agensi Bintang', () => { m.close(); openStarAgency(gs); }],
      ['Keuangan', () => { m.close(); openFinance(gs); }],
      ['Hall of Fame & Piala', () => { m.close(); openHallOfFame(gs); }, 'i_star'],
      [`Prestasi (${Object.keys(s.achievements).length})`, () => { m.close(); openAchievements(gs); }, 'i_medal'],
      [`KPI & Netizen (teguran ${Math.round(s.kpi)}%)`, () => { m.close(); openKpi(gs); }, 'i_kpi'],
    ];
    items.forEach(([label, fn, icon], i) => m.btn(20, 34 + i * 43, 260, 39, label, fn, { size: 12, icon, iconScale: icon === 'i_medal' || icon === 'i_kpi' ? 0.7 : 1 }).setName('studio_' + label.split(/[ (&]/)[0].toLowerCase()));
    m.text(150, 432, `Fans: ${fmtNum(s.fans)}\nTotal pendapatan: ${fmtShort(s.totalRevenue)}\nBiaya rutin: ${fmtShort(gs.sim.monthlyCosts())}/bln`, 11, COL.text, { ox: 0.5, align: 'center' });
  });
}

function openUpgrade(gs: GameScene) {
  const m = gs.modal({ w: 320, h: 340, title: 'RENOVASI', closable: true });
  m.build((m) => {
    const s = gs.s;
    const next = STUDIOS[s.studio];
    const cur = STUDIOS[s.studio - 1];
    m.text(160, 26, `Sekarang: ${cur.name}`, 12, COL.text, { ox: 0.5, bold: true });
    if (!next) {
      m.text(160, 80, 'Studio sudah paling megah!\nTinggal bikin mahakarya.', 12, COL.text, { ox: 0.5, align: 'center' });
      return;
    }
    m.panel(14, 50, 292, 190, 'paper');
    m.text(160, 60, `Upgrade ke ${next.name}`, 13, COL.blue, { ox: 0.5, bold: true });
    const rows: [string, string, boolean][] = [
      ['Biaya', fmtMoney(next.cost), s.money >= next.cost],
      ['Syarat fans', fmtNum(next.fans), s.fans >= next.fans],
      ['Kapasitas staf', `${cur.maxStaff} -> ${next.maxStaff}`, true],
      ['Kecepatan kerja', `+${Math.round((next.workMult / cur.workMult - 1) * 100)}%`, true],
      ['Sewa & listrik', `${fmtShort(cur.rent)} -> ${fmtShort(next.rent)}/bln`, true],
    ];
    rows.forEach(([a, b, ok], i) => {
      m.text(26, 90 + i * 24, a, 11);
      m.text(294, 90 + i * 24, b, 11, ok ? COL.green : COL.red, { ox: 1, bold: true });
    });
    m.text(160, 214, next.premium ? 'Studio premium! Gengsi naik, tagihan juga.' : 'Ruangan lebih bagus, peralatan baru!', 10, COL.muted, { ox: 0.5 });
    m.btn(40, 260, 240, 50, 'Renovasi!', () => {
      const err = gs.sim.upgradeStudio();
      if (err) { gs.toast(err); sfx.bad(); return; }
      sfx.fanfare(); m.close(); gs.buildStudio(); gs.refreshHud(); gs.toast(`Selamat! Sekarang ${next.name}!`);
    }, { kind: 'primary', size: 13 });
  });
}

function openResearch(gs: GameScene) {
  let tab: 'genre' | 'tema' = 'genre';
  const m = gs.modal({ w: 340, h: 500, y: 62, title: 'RISET', closable: true });
  m.build((m) => {
    const s = gs.s;
    m.text(14, 20, `Poin Riset: ${s.rp}`, 12, COL.text, { bold: true });
    m.btn(150, 16, 86, 24, 'Genre', () => { tab = 'genre'; m.rebuild(); }, { kind: tab === 'genre' ? 'sel' : 'btn', size: 10 });
    m.btn(240, 16, 86, 24, 'Tema', () => { tab = 'tema'; m.rebuild(); }, { kind: tab === 'tema' ? 'sel' : 'btn', size: 10 });
    const items = tab === 'genre'
      ? GENRES.map((g) => ({ id: g.id, name: g.name, cost: g.unlockCost, un: s.unlockedGenres.includes(g.id), blurb: g.blurb }))
      : THEMES.map((t) => ({ id: t.id, name: t.name, cost: t.unlockCost, un: s.unlockedThemes.includes(t.id), blurb: '' }));
    items.forEach((it, i) => {
      const x = 10 + (i % 2) * 162, y = 48 + Math.floor(i / 2) * 72;
      card(m, x, y, 158, 68, it.un ? 'cream' : 'paper');
      m.text(x + 8, y + 6, it.un ? it.name : it.name, 12, it.un ? COL.green : COL.text, { bold: true });
      if (it.un) m.text(x + 8, y + 24, 'Sudah terbuka', 10, COL.muted);
      else {
        m.text(x + 8, y + 24, `${it.cost} poin`, 10, s.rp >= it.cost ? COL.text : COL.red);
        m.btn(x + 70, y + 34, 80, 26, 'Buka', () => {
          const err = tab === 'genre' ? gs.sim.unlockGenre(it.id) : gs.sim.unlockTheme(it.id);
          if (err) { gs.toast(err); sfx.bad(); } else { gs.toast(`${it.name} terbuka!`); sfx.levelup(); }
          gs.refreshHud(); m.rebuild();
        }, { kind: s.rp >= it.cost ? 'primary' : 'disabled', disabled: s.rp < it.cost, size: 10 });
      }
    });
  });
}

function openPlatforms(gs: GameScene) {
  const m = gs.modal({ w: 330, h: 420, title: 'PLATFORM', closable: true });
  m.build((m) => {
    const s = gs.s;
    PLATFORMS.forEach((p, i) => {
      const y = 26 + i * 124;
      const un = s.platforms.includes(p.id);
      card(m, 10, y, 310, 118, un ? 'cream' : 'paper');
      m.text(20, y + 8, p.name, 13, un ? COL.green : COL.text, { bold: true });
      m.text(20, y + 28, `Penonton maks ~${p.maxRating}%  -  Iklan x${(p.adRate / PLATFORMS[0].adRate).toFixed(1)}`, 10, COL.muted);
      m.text(20, y + 44, `Biaya produksi dari ${fmtShort(gs.sim.prodCost(p.id, 13, 'standar'))}`, 10, COL.muted);
      if (un) m.text(20, y + 70, 'Kontrak aktif', 11, COL.green, { bold: true });
      else {
        m.text(20, y + 62, `Syarat: ${fmtNum(p.unlockFans)} fans${p.unlockStudio > 1 ? `, studio Lv${p.unlockStudio}` : ''}`, 10, s.fans >= p.unlockFans && s.studio >= p.unlockStudio ? COL.green : COL.red);
        m.text(20, y + 78, `Biaya kontrak: ${fmtShort(p.unlockCost)}`, 10, s.money >= p.unlockCost ? COL.text : COL.red);
        m.btn(214, y + 76, 96, 32, 'Teken!', () => {
          const err = gs.sim.unlockPlatform(p.id);
          if (err) { gs.toast(err); sfx.bad(); } else { gs.toast(`Kontrak ${p.name} diteken!`); sfx.fanfare(); }
          gs.refreshHud(); m.rebuild();
        }, { kind: 'primary', size: 11 });
      }
    });
  });
}

function openHallOfFame(gs: GameScene) {
  const m = gs.modal({ w: 330, h: 460, title: 'HALL OF FAME', closable: true });
  m.build((m) => {
    const s = gs.s;
    const hof = s.shows.filter((x) => x.hof);
    m.img(40, 50, 'i_bigtrophy', 1);
    m.text(70, 30, `Piala Sinetron Terbaik: ${s.trophies}`, 12, COL.text, { bold: true });
    m.text(70, 48, `Masuk Hall of Fame: ${hof.length}`, 11);
    m.text(14, 82, 'Hall of Fame (skor 32+):', 11, COL.text, { bold: true });
    if (!hof.length) m.text(165, 130, 'Belum ada. Skor 32+ dari 40\nbuat masuk sini!', 11, COL.muted, { ox: 0.5, align: 'center' });
    hof.slice(-8).reverse().forEach((sh, i) => {
      m.panel(10, 100 + i * 26, 310, 24, 'sel');
      m.text(18, 105 + i * 26, short(sh.title, 48), sh.title.length > 40 ? 9 : 10, COL.text, { bold: true });
      m.text(312, 104 + i * 26, String(sh.total), 12, '#c0392b', { ox: 1, font: DISPLAY });
    });
    m.text(14, 320, 'Anugerah tahunan:', 11, COL.text, { bold: true });
    s.awards.slice(-5).reverse().forEach((a, i) => {
      m.text(18, 340 + i * 18, `Th ${a.year}: ${a.won ? 'MENANG' : 'kalah'} ${a.title ? '- ' + short(a.title, 34) : '(tidak ada nominasi)'}`, 10, a.won ? COL.green : COL.muted, { wrap: 300 });
    });
  });
}

// ---------------------------------------------------------------- pending handlers
export function showPending(gs: GameScene, p: Pending, done: () => void) {
  switch (p.kind) {
    case 'editDone': return showEditDone(gs, done);
    case 'release': {
      const sh = gs.s.shows.find((x) => x.id === p.showId);
      if (!sh) return done();
      return showRating(gs, sh, done);
    }
    case 'event': return showEvent(gs, p, done);
    case 'award': return showAward(gs, p, done);
    case 'airEnd': {
      const sh = gs.s.shows.find((x) => x.id === p.showId);
      if (!sh) return done();
      const profit = sh.revenue - sh.cost;
      return info(gs, 'TAMAT', `"${sh.title}" sudah tamat tayang!\n\nPendapatan iklan: ${fmtMoney(sh.revenue)}\nBiaya produksi: ${fmtMoney(sh.cost)}\n${profit >= 0 ? 'Untung' : 'Rugi'}: ${fmtMoney(Math.abs(profit))}`, () => { if (profit > 0) sfx.coin(); done(); });
    }
    case 'jobDone': return info(gs, 'JOB SELESAI', `"${p.name}" beres!\n\nBayaran: ${fmtMoney(p.pay)}\nPoin Riset: +${p.rp}`, () => { gs.refreshStatus(true); done(); });
    case 'warning': sfx.sting('drama'); return info(gs, 'KAS MINUS!', p.months >= 4
      ? `Kas sudah minus ${p.months} bulan! Kalau 6 bulan berturut-turut (atau utangnya kebanyakan), studio BANGKRUT.\n\nAmbil job sampingan, kurangi staf, atau bikin sinetron murah yang laku!`
      : 'Waduh, kas studio minus! Gaji tetap harus dibayar, utang kena bunga.\n\nMinus 6 bulan (atau utang > 3x biaya bulanan selama 3 bulan) = bangkrut. Ambil Job Sampingan!', done, 'red');
    case 'gameover': return showGameOver(gs);
    case 'info': return info(gs, p.title, p.text, done);
    case 'rating': return showRatingAlert(gs, p, done);
    case 'ending': { showEnding(gs, done); return; }
  }
}

function info(gs: GameScene, title: string, text: string, done: () => void, kind: 'cream' | 'red' = 'cream') {
  const m = gs.modal({ w: 300, h: 260, title });
  void kind;
  m.build((m) => {
    m.text(150, 34, text, 12, COL.text, { ox: 0.5, align: 'center', wrap: 270, lineSpacing: 3 });
    m.btn(60, 200, 180, 40, 'OK', () => { m.close(); done(); }, { kind: 'primary', size: 13 });
  });
  sfx.event();
}

function showEditDone(gs: GameScene, done: () => void) {
  const m = gs.modal({ w: 310, h: 250, title: 'EDITING SELESAI' });
  sfx.event();
  m.build((m) => {
    const p = gs.s.prod!;
    m.text(155, 30, `Masih ada ${p.bloopers} blooper yang belum dibereskan!`, 12, COL.red, { ox: 0.5, align: 'center', wrap: 280, bold: true });
    m.text(155, 70, 'Blooper bikin skor kritikus turun.\nPerpanjang editing 1 minggu, atau langsung tayang?', 11, COL.text, { ox: 0.5, align: 'center', wrap: 280 });
    m.text(155, 120, `(Sudah diperpanjang ${p.extraEdit}x, maks 4x)`, 10, COL.muted, { ox: 0.5 });
    m.btn(14, 180, 136, 48, 'Edit lagi\n+1 minggu', () => { gs.sim.extendEditing(); m.close(); done(); }, { size: 11 });
    m.btn(160, 180, 136, 48, 'TAYANG!', () => { m.close(); gs.sim.release(); done(); }, { kind: 'primary', size: 14, font: DISPLAY });
  });
}

const EVENT_TEXT: Record<string, { title: string; text: (d: Record<string, number | string>, gs: GameScene) => string; choices: (d: Record<string, number | string>) => string[] }> = {
  gaji: { title: 'MINTA NAIK GAJI', text: (d, gs) => d.seleb
    ? `${staffName(gs, d.staffId)}: "Bos, followers aku udah ${fmtFollowers(gs.s.staff.find((x) => x.id === d.staffId)?.followers ?? 0)} lho. Masa gajinya masih segini? Naikin ${fmtShort(Number(d.amount))} ya!"`
    : `${staffName(gs, d.staffId)}: "Bos, gaji saya naikin ${fmtShort(Number(d.amount))} per bulan dong. Saya kan bintang!"`, choices: () => ['Naikin deh', 'Nggak!'] },
  endorse: { title: 'TAWARAN ENDORSE', text: (d, gs) => `Brand skincare ngajak ${staffName(gs, d.staffId)} endorse. Bayarannya ${fmtShort(Number(d.pay))}!\nBagi hasilnya gimana, Bos?`, choices: () => ['Bagi 50:50', 'Studio 70%', 'Buat artis semua'] },
  dibajak: { title: 'DIBAJAK!', text: (d, gs) => {
    const st = gs.s.staff.find((x) => x.id === d.staffId);
    const l = st?.loyalty ?? 0;
    const odds = l >= 75 ? 'besar' : l >= 50 ? 'lumayan' : l >= 30 ? 'tipis' : 'tipis banget';
    return `${d.ph} ngajak ${st?.name ?? 'artis kita'} pindah, gajinya 1,6x lipat!\nFollowers ${fmtFollowers(st?.followers ?? 0)}  ·  Loyalitas ${Math.round(l)}\n\nKalau diajak ngobrol, peluang dia bertahan: ${odds}.`;
  }, choices: (d) => [`Naikkan gaji (+${fmtShort(Number(d.raise))}/bln)`, `Lepas aja (dapat ${fmtShort(Number(d.fee))})`, 'Ajak ngobrol dari hati (untung-untungan)'] },
  lokasi: { title: 'DRAMA DI LOKASI', text: (d) => {
    const l = locById(String(d.loc));
    const w = l ? l.name : 'lokasi';
    if (d.kind === 'hujan') return `Hujan deres banget di ${w}! Set basah, kamera harus ditutup plastik.`;
    if (d.kind === 'nyasar') return `Bus kru nyasar gara-gara ikut GPS lewat jalan sawah. Lokasi masih jauh!`;
    return `Warga sekitar ${w} rame-rame nonton syuting. Ada yang minta foto sama artis!`;
  }, choices: (d) => d.kind === 'hujan' ? ['Neduh dulu', 'Adegan hujan!'] : d.kind === 'nyasar' ? [`Sewa ojek (${fmtShort(Number(d.cost))})`, 'Jalan kaki aja'] : ['Foto bareng!', 'Minta tenang'] },
  viral: { title: 'VIRAL!', text: (d) => `Potongan adegan sinetron kita jadi meme di medsos! #SinetronStory trending.\n\n+${fmtNum(Number(d.fans))} fans`, choices: () => ['Mantap!'] },
  skandal: { title: 'SKANDAL!', text: (d, gs) => `${staffName(gs, d.staffId)} kepergok joget TikTok di nikahan mantan. Infotainment heboh!`, choices: (d) => [`Klarifikasi (${fmtShort(Number(d.cost))})`, 'Diamkan aja'] },
  sponsor: { title: 'TAWARAN SPONSOR', text: (d) => `Brand teh botol mau product placement di sinetron kita. Bayar ${fmtShort(Number(d.pay))}!`, choices: () => ['Terima', 'Tolak'] },
  hujan: { title: 'HUJAN DERES!', text: () => 'Hujan badai, atap set syuting bocor. Gimana, Bos?', choices: () => ['Istirahat dulu', 'Adegan hujan!'] },
  rt: { title: 'PAK RT DATANG', text: () => 'Pak RT minta sumbangan buat lomba 17-an. Rp 500 rb aja katanya.', choices: () => ['Kasih', 'Pura-pura nggak ada'] },
  ide: { title: 'IDE CEMERLANG', text: (d) => `Penulis dapat ide brilian pas lagi mandi!\n\n+${d.rp} Poin Riset`, choices: () => ['Catat!'] },
  semangat: { title: 'PENCERAHAN', text: (d, gs) => `${staffName(gs, d.staffId)} habis nonton video motivator. Semangat 45!`, choices: () => ['Gas!'] },
  sahur: { title: 'SAHUR ON THE SET', text: (d) => `Jam 3 pagi, kru masih syuting sambil nahan kantuk. Warung padang depan studio masih buka!\n\nTraktir sahur bareng? (${fmtShort(Number(d.cost))})`, choices: () => ['Traktir sahur!', 'Sahur masing-masing'] },
  ngabuburit: { title: 'NGABUBURIT', text: (d) => `Menjelang buka, artis kita diajak bagi-bagi takjil di lampu merah. Kamera wartawan udah standby!\n\nModal kolak & es buah ${fmtShort(Number(d.cost))}.`, choices: () => ['Gas bagi takjil!', 'Ngabuburit di studio aja'] },
  bukber: { title: 'BUKBER SPONSOR', text: (d) => `${d.brand} ngajak buka bersama kru + iklan 1 menit di sinetron kita. Bayar ${fmtShort(Number(d.pay))}!`, choices: () => ['Terima, alhamdulillah', 'Bukber sederhana aja'] },
  bisikan: { title: 'BISIKAN NETIZEN', text: (d) => `Kata netizen: "Kapan ada sinetron ${GENRES.find((x) => x.id === d.genre)?.name} di ${THEMES.find((x) => x.id === d.theme)?.name}? Pasti meledak!"`, choices: () => ['Hmm, menarik...'] },
};
function staffName(gs: GameScene, id: number | string | undefined) { return gs.s.staff.find((x) => x.id === id)?.name ?? 'Seseorang'; }

function showEvent(gs: GameScene, p: Extract<Pending, { kind: 'event' }>, done: () => void) {
  const d4 = EVENT_TEXT[p.eventId], d5 = EVENT_TEXT5[p.eventId];
  if (!d4 && !d5) { done(); return; }
  const def = {
    title: d4 ? d4.title : typeof d5.title === 'function' ? d5.title(p.data) : d5.title,
    text: (d: Record<string, number | string>, g: GameScene) => (d4 ? d4.text(d, g) : d5.text(d, g)),
    choices: (d: Record<string, number | string>) => (d4 ? d4.choices(d) : d5.choices(d, gs)),
  };
  // the staff member this event is about may have left meanwhile (dibajak / dipecat): skip it quietly
  if (typeof p.data.staffId === 'number' && !gs.s.staff.some((x) => x.id === p.data.staffId)) { done(); return; }
  if (p.eventId === 'skandal' || p.eventId === 'hujan' || p.eventId === 'gosip' || p.eventId === 'boikot' || p.eventId === 'mogok' || p.eventId === 'kpi') sfx.sting('drama');
  else if (p.eventId === 'viral' || p.eventId === 'sponsor') sfx.sting('good');
  else sfx.event();
  let result: string | null = null;
  const three = def.choices(p.data).length >= 3;
  if (p.eventId === 'dibajak') sfx.sting('drama');
  const m = gs.modal({ w: 310, h: three ? 300 : 220, title: def.title });
  m.build((m) => {
    const st = gs.s.staff.find((x) => x.id === p.data.staffId);
    if (st) { m.panel(16, 24, 50, 60, 'paper'); head(m, 41, 80, st, 2); }
    const tx = st ? 76 : 16, tw = st ? 218 : 278;
    if (result === null) {
      m.text(tx, 26, def.text(p.data, gs), 11, COL.text, { wrap: tw, lineSpacing: 3 });
      const ch = def.choices(p.data);
      const pick = (i: number) => { const n0 = gs.s.staff.length; result = gs.sim.resolveEvent(p, i); if (gs.s.staff.length !== n0) gs.rebuildAfterStaffChange(); gs.refreshHud(); m.rebuild(); };
      if (three) ch.forEach((c, i) => m.btn(16, 140 + i * 48, 278, 42, c, () => pick(i), { kind: i === 0 ? 'primary' : i === 1 ? 'btn' : 'green', size: 11 }));
      else ch.forEach((c, i) => {
        const w = ch.length === 1 ? 200 : 136;
        const x = ch.length === 1 ? 55 : 14 + i * 146;
        m.btn(x, 158, w, 44, c, () => pick(i), { kind: i === 0 ? 'primary' : 'btn', size: 11 });
      });
    } else {
      m.text(tx, 30, result, 12, COL.text, { wrap: tw, bold: true, lineSpacing: 3 });
      m.btn(55, three ? 238 : 158, 200, 44, 'OK', () => { m.close(); done(); }, { kind: 'primary', size: 13 });
    }
  });
}

export function confetti(gs: GameScene, depth: number, n = 60) {
  const cols = [0xf6c440, 0xe04060, 0x4aa8ff, 0x6ac46a, 0xffffff, 0xe07ab0];
  const objs: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < n; i++) {
    const im = gs.add.image(Math.random() * GW, -10 - Math.random() * 200, 'px').setTint(cols[i % cols.length]).setDepth(depth).setScale(1 + Math.random());
    objs.push(im);
    gs.tweens.add({ targets: im, y: GH + 20, x: im.x + (Math.random() - 0.5) * 80, angle: 360 * (Math.random() > 0.5 ? 1 : -1), duration: 2200 + Math.random() * 1800, delay: Math.random() * 600, onComplete: () => im.destroy() });
  }
  return objs;
}

function showAward(gs: GameScene, p: Extract<Pending, { kind: 'award' }>, done: () => void) {
  const m = gs.modal({ w: 340, h: 480, title: `ANUGERAH TAHUN ${p.year}`, kind: 'dark' });
  let stage = 0;
  m.build((m) => {
    const g = m.add(gs.add.graphics());
    g.fillStyle(0x2a0a10, 1); g.fillRect(8, 16, 324, 300);
    g.fillStyle(0x9a1a2a, 1); for (let x = 8; x < 60; x += 8) g.fillRect(x, 16, 6, 300); for (let x = 280; x < 332; x += 8) g.fillRect(x, 16, 6, 300);
    g.fillStyle(0xf6c440, 0.12); g.fillTriangle(170, 16, 100, 316, 240, 316);
    m.text(170, 30, 'SINETRON TERBAIK', 16, '#f6c440', { ox: 0.5, font: DISPLAY, stroke: '#2b1a10', strokeW: 3 });
    m.text(170, 56, `Tahun ${p.year}`, 11, '#fff6e0', { ox: 0.5 });
    m.text(170, 84, 'Nominasi:', 11, '#e0c8a0', { ox: 0.5 });
    m.text(170, 102, `"${short(p.title ?? '(tidak ada)', 32)}"  (${p.score})`, 11, '#ffffff', { ox: 0.5, align: 'center', wrap: 260, bold: true });
    m.text(170, 124, `vs  "${short(p.rival, 32)}"  (${p.rivalScore})`, 11, '#c8b090', { ox: 0.5, align: 'center', wrap: 260 });
    if (stage >= 1) m.text(170, 160, 'Dan pemenangnya adalah...', 13, '#fff6e0', { ox: 0.5, bold: true });
    if (stage >= 2) {
      const trophy = m.img(170, 252, 'i_bigtrophy', p.won ? 2 : 1).setOrigin(0.5, 1);
      if (!p.won) trophy.setTint(0x777777);
      m.text(170, 268, short(p.won ? (p.title ?? '') : p.rival, 40), 13, p.won ? '#f6c440' : '#c8b090', { ox: 0.5, align: 'center', wrap: 280, bold: true, stroke: '#2b1a10', strokeW: 3 });
      const msg = p.won ? `MENANG!\nHadiah ${fmtShort(p.prize)} + ${fmtNum(p.fans)} fans + 5 Riset` : (p.title ? 'Yah, kalah... Tahun depan pasti bisa!' : 'Tahun ini kita nggak rilis apa-apa...');
      m.text(170, 330, msg, 13, p.won ? '#9af07a' : '#ffb0a0', { ox: 0.5, align: 'center', wrap: 300, bold: true });
      m.btn(70, 414, 200, 46, 'Lanjut', () => { sfx.setMusicOverride(null); m.close(); gs.drawTrophies(); done(); }, { kind: 'primary', size: 13 });
    }
  });
  sfx.setMusicOverride('award');
  gs.time.delayedCall(1200, () => { if (m.closed) return; stage = 1; sfx.sting('roll'); m.rebuild(); });
  gs.time.delayedCall(2600, () => {
    if (m.closed) return;
    stage = 2; m.rebuild();
    if (p.won) { sfx.sting('great'); confetti(gs, 2100); } else sfx.sting('flop');
  });
}

function showGameOver(gs: GameScene) {
  sfx.setMusicOverride('silent');
  sfx.sting('flop');
  const m = gs.modal({ w: 310, h: 340, title: 'BANGKRUT!', kind: 'cream' });
  m.build((m) => {
    const s = gs.s;
    const d = dateOf(s.absWeek);
    m.text(155, 30, 'Studio disita bank...\nKru pulang kampung naik bus malam.', 12, COL.text, { ox: 0.5, align: 'center', wrap: 280 });
    m.text(155, 100, `Bertahan sampai Tahun ${d.year} Bulan ${d.month}\nSinetron dibuat: ${s.shows.length}\nHall of Fame: ${s.shows.filter((x) => x.hof).length}\nPiala: ${s.trophies}\nFans: ${fmtNum(s.fans)}`, 12, COL.text, { ox: 0.5, align: 'center', lineSpacing: 4 });
    m.btn(55, 270, 200, 46, 'Main Lagi', () => { clearSave(); gs.scene.start('Title'); }, { kind: 'primary', size: 13 });
  });
}

// ---------------------------------------------------------------- rating screen
// speech bubble anchors over the family in the living-room bitmaps (logical coords)
const FAMILY_BUBBLES: [number, number][] = [[62, 40], [150, 30], [226, 92]];

export function showRating(gs: GameScene, sh: Show, done: () => void, replay = false) {
  const D = 2600;
  const root = gs.add.container(CX0, 0).setDepth(D);
  const m = gs.modal({ noPanel: true, dim: 0.92 });
  m.root.add(root);
  // v5.1 short windows: the show is drawn at the design height and scrolls; glide down to the critics after the
  // living-room intro (unless the player already scrolled)
  if (m.maxScroll > 0) gs.time.delayedCall(1300, () => {
    if (m.closed || m.scroll > 0) return;
    gs.tweens.addCounter({ from: 0, to: m.maxScroll, duration: 700, ease: 'Sine.easeInOut', onUpdate: (tw) => { if (!m.closed) m.setScroll(tw.getValue() ?? 0); } });
  });
  const total = sh.total;
  sfx.setMusicOverride('silent');
  let jingled = false;
  const jingle = () => { if (jingled) return; jingled = true; sfx.stopStings(); sfx.sting(total >= 30 ? 'great' : total < 18 ? 'flop' : 'good'); };
  const mood = total >= 30 ? (sh.genre === 'komedi' || sh.genre === 'remaja' ? 'laugh' : sh.genre === 'horor' || sh.genre === 'siluman' || sh.genre === 'laga' ? 'shock' : 'cry') : total >= 20 ? 'normal' : 'bored';
  // backdrop: wood frame + the family living room watching the premiere
  const bg = gs.add.graphics();
  // drawn at the design height; on short windows the dialog scrolls (Modal)
  woodStrip(bg, 0, 0, PW, DH);
  bg.fillStyle(0xf8ecd0, 1); bg.fillRoundedRect(6, 276, PW - 12, DH - 282, 10);
  bg.fillStyle(0xe8d4a8, 1); bg.fillRoundedRect(6, DH - 72, PW - 12, 66, { tl: 0, tr: 0, bl: 10, br: 10 });
  root.add(bg);
  const room = gs.add.image(0, 0, 'living_' + mood).setOrigin(0, 0).setScale(HI);
  root.add(room);
  const fr = gs.add.graphics();
  fr.fillStyle(0x3a200c, 1); fr.fillRect(0, 266, PW, 3);
  fr.fillStyle(0x6a3a18, 1); fr.fillRect(0, 269, PW, 4);
  root.add(fr);
  // flickering TV light on the family
  const tvl = gs.add.image(150, 150, 'glow').setScale(4.5, 5).setBlendMode(Phaser.BlendModes.ADD).setTint(mood === 'shock' || mood === 'bored' ? 0x8ab0ff : 0xfff0c0).setAlpha(0.12);
  root.add(tvl);
  gs.tweens.add({ targets: tvl, alpha: { from: 0.06, to: 0.2 }, duration: 140, yoyo: true, repeat: -1, repeatDelay: 380 });
  // floating hearts / marks
  if (mood !== 'normal') {
    for (let i = 0; i < 6; i++) {
      const isHeart = mood === 'cry' || mood === 'laugh';
      const o = isHeart ? gs.add.image(40 + i * 40, 150, 'icons', 7).setScale(0.18 + (i % 3) * 0.04)
        : gs.add.text(40 + i * 40, 150, mood === 'bored' ? 'z' : '!', { fontFamily: ROUND, fontStyle: '800', fontSize: '16px', color: mood === 'bored' ? '#c8d0e0' : '#ffd23a', stroke: '#3a1e08', strokeThickness: 3, resolution: 2 }).setOrigin(0.5);
      o.setAlpha(0);
      root.add(o);
      gs.tweens.add({ targets: o, y: { from: 170 + (i % 2) * 30, to: 60 + (i % 3) * 15 }, alpha: { from: 0.95, to: 0 }, duration: 2200 + i * 170, delay: 300 + i * 360, repeat: -1, repeatDelay: 400 });
    }
  }
  const shouts: Record<string, string[]> = {
    cry: ['HUHU!', 'YA ALLAH!', 'HIKS...', 'KASIHAN!'], laugh: ['WKWKWK', 'NGAKAK!', 'HAHAHA', 'KOCAK!'],
    shock: ['ASTAGA!', 'HAH?!', 'SERAM!', 'WADUH!'], normal: ['Hmm...', 'Lumayan', 'Oh...', 'Eh?'], bored: ['Zzz...', 'Ganti!', 'Hoaam', 'Bosen'],
  };
  const shoutCol: Record<string, string> = { cry: '#d0302a', laugh: '#d0602a', shock: '#7a2ab0', normal: '#4a2208', bored: '#6a6a7a' };
  const sb = shouts[mood];
  FAMILY_BUBBLES.forEach(([x, y], i) => {
    const c = gs.add.container(x, y);
    const big = mood === 'normal' || mood === 'bored' ? 12 : 15;
    const t = txt(gs, 0, 0, sb[i], big, shoutCol[mood], { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
    const g = gs.add.graphics(); bubbleGfx(g, Math.round(t.width + 16), Math.round(t.height + 2), 0xffffff, 0x3a1e08, true, 10);
    c.add([g, t]); c.setScale(0).setAngle(i === 1 ? 4 : -4); root.add(c);
    gs.tweens.add({ targets: c, scale: 1, delay: 300 + i * 350, duration: 220, ease: 'Back.easeOut' });
    gs.tweens.add({ targets: c, y: y - 3, delay: 600 + i * 350, duration: 500 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
  // title ribbon
  const ttl = sh.title.length > 30 ? sh.title.slice(0, 29) + '…' : sh.title;
  const rg = gs.add.graphics();
  rg.fillStyle(0x5a1408, 1); rg.fillRoundedRect(16, 279, PW - 32, 22, 8);
  rg.fillStyle(0xc8402a, 1); rg.fillRoundedRect(18, 280, PW - 36, 19, 7);
  rg.fillStyle(0xe8704a, 1); rg.fillRoundedRect(22, 282, PW - 44, 5, 3);
  root.add(rg);
  root.add(txt(gs, PW / 2, 290, 'ULASAN: ' + ttl.toUpperCase(), 11, '#fff8e8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#5a1408', strokeW: 3 }));
  // critics
  const reveal: (() => void)[] = [];
  CRITICS.forEach((c, i) => {
    const x = 12 + i * 85, y = 305, w = 81, h = 138;
    const g = gs.add.graphics();
    g.fillStyle(0x000000, 0.18); g.fillRoundedRect(x + 1, y + 2, w, h, 8);
    g.fillStyle(0x7a4a22, 1); g.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 9);
    g.fillStyle(0xfffaf0, 1); g.fillRoundedRect(x + 1, y + 1, w - 2, h - 2, 7);
    g.fillStyle(0x3a200c, 1); g.fillRect(x + 9, y + 5, 63, 63);
    root.add(g);
    root.add(gs.add.image(x + 10, y + 6, 'critics', i).setOrigin(0, 0).setScale(HI).setCrop(1, 1, 120, 120));
    const ng = gs.add.graphics(); ng.fillStyle(Phaser.Display.Color.HexStringToColor(c.bg).color, 1); ng.fillRoundedRect(x + 14, y + 61, w - 28, 15, 6); ng.lineStyle(1.5, 0x3a200c, 1); ng.strokeRoundedRect(x + 14, y + 61, w - 28, 15, 6);
    root.add(ng);
    root.add(txt(gs, x + w / 2, y + 68, c.name, 11, '#2b1a10', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }));
    const com = txt(gs, x + w / 2, y + 80, sh.comments[i] ?? '', 9, COL.text, { ox: 0.5, align: 'center', wrap: 74, bold: true, lineSpacing: 0 }).setAlpha(0);
    const sc = txt(gs, x + w / 2, y + 120, String(sh.scores[i]), 30, '#ffd23a', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#4a2208', strokeW: 6 }).setScale(0);
    const grad = sc.context.createLinearGradient(0, 0, 0, sc.height);
    grad.addColorStop(0.2, '#fff2a0'); grad.addColorStop(0.55, '#ffc82a'); grad.addColorStop(0.9, '#e8801a');
    sc.setFill(grad);
    root.add([com, sc]);
    reveal.push(() => { com.setAlpha(1); gs.tweens.add({ targets: sc, scale: 1, duration: 260, ease: 'Back.easeOut' }); sfx.score(sh.scores[i]); });
  });
  // rating banner
  const ry = 446;
  const rib = gs.add.image(196, ry, 'banner').setOrigin(0.5, 0).setScale(0.4);
  root.add(rib);
  const ribT = txt(gs, 196, ry + 16, 'RATING PEMIRSA', 13, '#5a2a08', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#fff4c0', strokeW: 3 });
  root.add(ribT);
  const ratingT = txt(gs, 196, ry + 43, '0.0%', 32, '#e8501a', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#4a1e0a', strokeW: 6 });
  root.add(ratingT);
  const ratingCont: Phaser.GameObjects.Components.Alpha[] = [rib, ratingT, ribT];
  ratingCont.forEach((o) => o.setAlpha(0));
  // combo rosette
  let badge: Phaser.GameObjects.Container | null = null;
  if (sh.compat === 'great' || sh.compat === 'good') {
    badge = gs.add.container(40, ry + 46).setScale(0);
    const ros = gs.add.image(0, 0, sh.compat === 'great' ? 'rosette_gold' : 'rosette_silver').setScale(0.44);
    const g = GENRES.find((x) => x.id === sh.genre)!, t = THEMES.find((x) => x.id === sh.theme)!;
    const bt = txt(gs, 0, -11, `${g.name.toUpperCase()}\nx ${t.name.toUpperCase()}\n${sh.compat === 'great' ? 'COMBO!' : 'COCOK!'}`, 7, '#7a2a08', { ox: 0.5, oy: 0.5, align: 'center', font: ROUND, weight: '800', lineSpacing: -3, wrap: 40 });
    badge.add([ros, bt]);
    root.add(badge);
  }
  // HoF stamp
  let stamp: Phaser.GameObjects.Container | null = null;
  if (sh.hof) {
    stamp = gs.add.container(300, 452).setAngle(-12).setAlpha(0).setScale(3);
    const g = gs.add.graphics();
    g.fillStyle(0x7a1408, 1); g.fillRoundedRect(-58, -14, 116, 28, 8);
    g.fillStyle(0xd0402e, 1); g.fillRoundedRect(-56, -12, 112, 24, 7);
    g.lineStyle(1.5, 0xfff0c0, 1); g.strokeRoundedRect(-53, -9, 106, 18, 5);
    stamp.add([g, txt(gs, 0, 0, 'HALL OF FAME!', 12, '#fff8e8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#5a1a0a', strokeW: 3 })]);
    root.add(stamp);
  }
  // summary + button
  const notes: string[] = [];
  notes.push(`Total ${total}/40   +${fmtNum(sh.fansGained)} fans   +${sh.rp} Riset`);
  const extra: string[] = [];
  if (sh.trendBonus) extra.push('Lagi tren! Rating +20%');
  if (sh.repeatPenalty) extra.push('Penonton bosan (sama kayak sebelumnya)');
  if (sh.bloopers > 3) extra.push(`${sh.bloopers} blooper bikin kritikus kesel`);
  if (sh.compat === 'bad') extra.push('Kombinasi genre & tema-nya aneh...');
  const sl = locById(sh.location);
  if (sl) extra.push(sh.locMatches.length ? `Syuting di ${sl.short}: COMBO LOKASI!` : `Syuting di ${sl.short}`);
  if (sh.part > 1) extra.push(sh.fanBase > 0.05 ? `Bagian ke-${sh.part}: fans lama ikut nonton!` : sh.fanBase < 0 ? `Bagian ke-${sh.part}: penonton mulai jenuh...` : `Bagian ke-${sh.part}`);
  if (sh.ost) { const sg = singerById(sh.ost.singer); if (sg) extra.push(sh.ost.viral ? `OST "${short(sh.ost.song, 18)}" VIRAL!` : sh.ost.hit ? `OST ${sg.name} ngehits!` : `OST ${sg.name} kurang nendang`); }
  if (sh.ramadan) extra.push('Slot Sinetron Ramadan');
  // keep it to two notes so the summary never runs into the button (v4 notes first: they're the newest news)
  const v4n = extra.filter((x) => /^Bagian|^OST|^Slot Ramadan/.test(x));
  const shown = [...v4n, ...extra.filter((x) => !v4n.includes(x))].slice(0, 2);
  const sum = txt(gs, PW / 2, 554, notes.join('\n') + (shown.length ? '\n' + shown.join('  -  ') : ''), 10, COL.text, { ox: 0.5, oy: 0.5, align: 'center', wrap: 330, font: ROUND, weight: '800', lineSpacing: -2 }).setAlpha(0);
  root.add(sum);
  let finished = false;
  const btn = button(gs, 80, 580, 200, 44, replay ? 'Tutup' : 'Lanjut', () => { sfx.setMusicOverride(null); m.close(); done(); }, { kind: 'primary', size: 13 });
  btn.setVisible(false).setName('ratingNext');
  root.add(btn);
  const timers: Phaser.Time.TimerEvent[] = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    for (const t of timers) t.remove(false);
    reveal.forEach((r) => r());
    ratingCont.forEach((o) => o.setAlpha(1));
    ratingT.setText(sh.rating.toFixed(1) + '%');
    if (badge) badge.setScale(1);
    if (stamp) stamp.setAlpha(1).setScale(1);
    sum.setAlpha(1);
    btn.setVisible(true);
    jingle();
  };
  // sequence
  reveal.forEach((r, i) => timers.push(gs.time.delayedCall(900 + i * 650, r)));
  const t0 = 900 + 4 * 650 + 200;
  timers.push(gs.time.delayedCall(t0, () => {
    ratingCont.forEach((o) => o.setAlpha(1));
    rib.setScale(0.1); gs.tweens.add({ targets: rib, scale: 0.4, duration: 260, ease: 'Back.easeOut' });
    const ctr = { v: 0 };
    // (guarded: the player can close the show while the counter still runs)
    gs.tweens.add({ targets: ctr, v: sh.rating, duration: 1200, ease: 'Cubic.easeOut', onUpdate: () => { if (ratingT.active) ratingT.setText(ctr.v.toFixed(1) + '%'); }, onComplete: () => { if (ratingT.active) ratingT.setText(sh.rating.toFixed(1) + '%'); } });
    sfx.sting('roll');
  }));
  timers.push(gs.time.delayedCall(t0 + 1400, () => {
    if (badge) { gs.tweens.add({ targets: badge, scale: 1, duration: 300, ease: 'Back.easeOut' }); }
    jingle();
    if (total >= 30 && !replay) confetti(gs, D + 50, total >= 32 ? 90 : 50);
  }));
  timers.push(gs.time.delayedCall(t0 + 1900, () => {
    if (stamp) { gs.tweens.add({ targets: stamp, alpha: 1, scale: 1, duration: 260, ease: 'Quad.easeIn' }); gs.cameras.main.shake(150, 0.004); }
  }));
  timers.push(gs.time.delayedCall(t0 + 2300, finish));
  // closed early (skip, resize, tests): stop the pending reveal steps so nothing touches destroyed objects
  const prevClosed = m.onClosed;
  m.onClosed = () => { finished = true; for (const t of timers) t.remove(false); prevClosed?.(); };
  // tap to skip
  const skip = gs.add.zone(0, 0, PW, 570).setOrigin(0, 0).setInteractive();
  skip.on('pointerup', () => { if (!finished && !DRAG.moved) finish(); });
  root.addAt(skip, 1);
}
