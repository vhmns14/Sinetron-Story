// v5 wide-screen side panels (desktop / landscape only; phones never build them). Left: studio numbers, the current
// production and the crew (tap -> profile). Right: shows on air (tap -> Tangga Rating), KPI & netizen meters, the latest
// netizen posts, prestasi and the mouse / keyboard controls. With room for only one panel ('both') it shows the studio,
// the production, the shows on air and a short crew list.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { COL, ROUND, DISPLAY, txt, button, bar, drawPanel, type PanelKind } from './ui';
import { GENRES, PLATFORMS, ROLES } from './data';
import { fmtShort, fmtNum, fmtFollowers, dateOf } from './state';
import { STUDIOS } from './data';
import * as screens from './screens';
import * as screens3 from './screens3';
import * as screens5 from './screens5';
import * as v5 from './v5';
import { ACHIEVEMENTS } from './achievements';
import { sfx } from './audio';

export const SIDE_W = 236;
const ROW = '#4a2208';
const shortT = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

export class SidePanel {
  root: Phaser.GameObjects.Container;
  private sig = '';
  private page = 0;
  constructor(private gs: GameScene, public mode: 'left' | 'right' | 'both', public x: number, public y: number, public w: number, public h: number) {
    this.root = gs.add.container(0, 0).setDepth(995).setName('sidePanel_' + mode);
  }
  destroy() { this.root.destroy(); }
  refresh(force = false) {
    const gs = this.gs, s = gs.s, p = s.prod;
    const air = s.shows.filter((x) => gs.sim.isAiring(x));
    const sig = [this.mode, this.page, Math.round(s.money / 1e5), s.fans, s.rp, s.studio, s.absWeek,
      p ? [p.title, p.phase, Math.floor((p.phaseTick / p.phaseTicks[gs.sim.phaseIndex(p.phase)]) * 20), p.placements.length, p.offers.length] : s.job ? s.job.name + s.job.ticksLeft : '-',
      air.map((x) => `${x.id}:${x.weeksAired}:${x.ranks[x.ranks.length - 1] ?? 0}`).join(','),
      s.staff.map((x) => `${x.id}:${Math.round(x.energy / 10)}:${x.activity}:${x.strike ?? 0}:${x.level}`).join(','),
      Math.round(s.kpi), Math.round(s.boikot), s.feedSeq, s.feedRead, Object.keys(s.achievements).length].join('|');
    if (sig === this.sig && !force) return;
    this.sig = sig;
    this.build();
  }
  private add<T extends Phaser.GameObjects.GameObject>(o: T): T { this.root.add(o); return o; }
  private panel(x: number, y: number, w: number, h: number, kind: PanelKind = 'paper') { const g = this.gs.add.graphics(); drawPanel(g, x, y, w, h, kind); return this.add(g); }
  private t(x: number, y: number, s: string, size: number, color: string = ROW, o: Parameters<typeof txt>[6] = {}) { return this.add(txt(this.gs, x, y, s, size, color, { font: ROUND, weight: '800', ...o })); }
  private tap(x: number, y: number, w: number, h: number, fn: () => void, name?: string) {
    const z = this.add(this.gs.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
    if (name) z.setName(name);
    z.on('pointerup', () => { if (this.gs.modalOpen()) return; sfx.click(); fn(); });
    return z;
  }
  private header(x: number, y: number, label: string) { this.t(x, y, label, 10, '#b04a1a', { font: DISPLAY, weight: 'normal' }); }

  private build() {
    const gs = this.gs;
    this.root.removeAll(true);
    const { x, y, w, h } = this;
    // the panel swallows taps / drags so they never reach the studio behind it
    this.add(gs.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive());
    this.panel(x, y, w, h, 'cream');
    let cy = y + 8;
    // v5.1 short windows: fewer rows / compact blocks so nothing spills out of the panel
    const compact = h < 300;
    if (this.mode === 'left' || this.mode === 'both') {
      cy = this.studioBlock(cy, compact);
      cy = this.prodBlock(cy);
      if (this.mode === 'both') cy = this.airBlock(cy, compact ? 1 : 2);
      if (y + h - 8 - cy >= 15 + 34 + 26) this.staffBlock(cy, y + h - 8);
    } else {
      cy = this.airBlock(cy, h < 300 ? 1 : h < 400 ? 2 : 3);
      cy = this.metersBlock(cy);
      const tips = h >= 460;
      const footH = tips ? 124 : 36;
      cy = this.feedBlock(cy, y + h - footH - 4);
      this.footBlock(y + h - footH, tips);
    }
  }

  private studioBlock(cy: number, compact = false): number {
    const gs = this.gs, s = gs.s, { x, w } = this;
    this.panel(x + 8, cy, w - 16, 40, 'dark');
    const d = dateOf(s.absWeek);
    this.t(x + w / 2, cy + 13, STUDIOS[s.studio - 1].name, 12, '#fff6e0', { ox: 0.5, oy: 0.5, stroke: '#3a1c08', strokeW: 3 });
    this.t(x + w / 2, cy + 29, `Studio Lv${s.studio}  ·  Tahun ${d.year} Bulan ${d.month}`, 9, '#f6d9a8', { ox: 0.5, oy: 0.5, weight: '600' });
    cy += 46;
    if (compact) return cy;
    const stats: [string, string, string][] = [
      ['Kas', fmtShort(s.money), s.money < 0 ? COL.red : '#2e8b3a'],
      ['Fans', fmtNum(s.fans), ROW],
      ['Biaya / bln', fmtShort(gs.sim.monthlyCosts()), ROW],
      ['Poin Riset', String(s.rp), ROW],
    ];
    const sw = (w - 22) / 2;
    stats.forEach(([label, val, col], i) => {
      const sx = x + 8 + (i % 2) * (sw + 6), sy = cy + Math.floor(i / 2) * 36;
      this.panel(sx, sy, sw, 32, 'paper');
      this.t(sx + 8, sy + 3, label, 9, COL.muted, { weight: '600' });
      this.t(sx + 8, sy + 15, val, 11, col);
    });
    return cy + 76;
  }

  private prodBlock(cy: number): number {
    const gs = this.gs, s = gs.s, { x, w } = this, p = s.prod;
    this.header(x + 12, cy, 'PRODUKSI');
    cy += 15;
    this.panel(x + 8, cy, w - 16, 54, p ? 'sel' : 'paper');
    if (p) {
      const pi = gs.sim.phaseIndex(p.phase);
      this.t(x + 16, cy + 5, shortT(p.title, 30), 10);
      this.t(x + 16, cy + 19, `${GENRES.find((g) => g.id === p.genre)?.name ?? ''} · ${['Naskah', 'Syuting', 'Editing'][pi]} ${pi + 1}/3${p.placements.length ? ` · ${p.placements.length} iklan` : ''}`, 9, COL.muted, { weight: '600' });
      this.add(bar(gs, x + 16, cy + 35, w - 32, 7, (pi + p.phaseTick / p.phaseTicks[pi]) / 3, 0xf6a020));
      this.tap(x + 8, cy, w - 16, 54, () => screens.openProduction(gs), 'side_prod');
    } else if (s.job) {
      this.t(x + 16, cy + 6, 'Job: ' + shortT(s.job.name, 24), 10);
      this.add(bar(gs, x + 16, cy + 30, w - 32, 7, s.job.progress / s.job.need, 0x6ac46a));
    } else {
      this.t(x + 16, cy + 8, 'Studio lagi santai...', 10);
      this.add(button(gs, x + 16, cy + 24, w - 32, 24, 'Sinetron Baru!', () => { if (!gs.modalOpen()) screens.openProduction(gs); }, { kind: 'primary', size: 11 })).setName('side_new');
    }
    return cy + 60;
  }

  private airBlock(cy: number, max: number): number {
    const gs = this.gs, s = gs.s, { x, w } = this;
    const air = s.shows.filter((sh) => gs.sim.isAiring(sh)).slice(-max).reverse();
    this.header(x + 12, cy, 'LAGI TAYANG');
    cy += 15;
    if (!air.length) {
      this.panel(x + 8, cy, w - 16, 36, 'paper');
      this.t(x + w / 2, cy + 18, 'Belum ada yang tayang', 10, COL.muted, { ox: 0.5, oy: 0.5, weight: '700' });
      return cy + 42;
    }
    for (const sh of air) {
      const rank = sh.ranks.length ? sh.ranks[sh.ranks.length - 1] : 0;
      const cur = sh.hist.length ? sh.hist[sh.hist.length - 1] : sh.rating;
      this.panel(x + 8, cy, w - 16, 40, 'paper');
      const g = this.add(gs.add.graphics());
      const col = rank === 1 ? 0xe0402a : rank && rank <= 3 ? 0x4a9a3a : 0x8a6a4a;
      g.fillStyle(col, 1); g.fillRoundedRect(x + 14, cy + 8, 26, 24, 7);
      this.t(x + 27, cy + 20, rank ? '#' + rank : '-', 11, '#ffffff', { ox: 0.5, oy: 0.5 });
      this.t(x + 46, cy + 5, shortT(sh.title, 25), 10);
      const pl = PLATFORMS.find((p) => p.id === sh.platform)!;
      const flags = [sh.gWeeks > 0 ? 'digoreng' : '', sh.bWeeks > 0 ? 'BOIKOT' : '', sh.slotWeeks > 0 ? 'jam 23.00' : ''].filter(Boolean).join(' · ');
      this.t(x + 46, cy + 21, `${cur}%  ·  ${pl.short} ${sh.weeksAired}/${sh.airWeeks}mg${flags ? '  ·  ' + flags : ''}`, 9, flags.includes('BOIKOT') ? COL.red : COL.blue, { weight: '700' });
      this.tap(x + 8, cy, w - 16, 40, () => screens3.openRatingChart(gs, sh.platform, sh.id), 'side_air');
      cy += 44;
    }
    return cy + 2;
  }

  private metersBlock(cy: number): number {
    const gs = this.gs, s = gs.s, { x, w } = this;
    this.header(x + 12, cy, 'KPI & NETIZEN');
    cy += 15;
    this.panel(x + 8, cy, w - 16, 56, 'paper');
    this.t(x + 16, cy + 6, `Teguran KPI ${Math.round(s.kpi)}%`, 9, s.kpi >= 70 ? COL.red : s.kpi >= 40 ? '#9a6a10' : ROW);
    this.add(bar(gs, x + 120, cy + 8, w - 136, 8, s.kpi / 100, s.kpi >= 70 ? 0xe0503a : s.kpi >= 40 ? 0xf6c440 : 0x6ac46a));
    this.t(x + 16, cy + 22, `Amarah netizen ${Math.round(s.boikot)}%`, 9, s.boikot >= 55 ? COL.red : ROW);
    this.add(bar(gs, x + 120, cy + 24, w - 136, 8, s.boikot / 100, s.boikot >= 55 ? 0xe0503a : s.boikot >= 35 ? 0xf6c440 : 0x6ac46a));
    this.t(x + w / 2, cy + 41, 'tap buat detail', 9, COL.muted, { ox: 0.5, weight: '600' });
    this.tap(x + 8, cy, w - 16, 56, () => screens5.openKpi(gs), 'side_kpi');
    return cy + 62;
  }

  private feedBlock(cy: number, bottom: number): number {
    const gs = this.gs, s = gs.s, { x, w } = this;
    const unread = screens5.unreadFeed(s);
    this.header(x + 12, cy, 'NETIZEN');
    if (unread) this.t(x + w - 12, cy, `${unread} baru`, 9, '#e0402a', { ox: 1 });
    cy += 15;
    const posts = s.feed.slice(0, 6);
    if (!posts.length) {
      if (cy + 40 > bottom) return cy;
      this.panel(x + 8, cy, w - 16, 40, 'paper');
      this.t(x + w / 2, cy + 20, 'Linimasa masih sepi', 10, COL.muted, { ox: 0.5, oy: 0.5, weight: '700' });
      this.tap(x + 8, cy, w - 16, 40, () => screens5.openFeed(gs), 'side_feed');
      return cy + 46;
    }
    let py = cy;
    for (const p of posts) {
      const us = v5.USERS[p.u] ?? v5.USERS[0];
      const body = txt(gs, 0, 0, p.t, 9, '#2b1a10', { wrap: w - 50, font: ROUND, weight: '600', lineSpacing: -1 });
      const lines = Math.min(3, Math.round(body.height / 11));
      if (lines >= 3 && body.height > 34) { body.setText(shortT(p.t, 80)); }
      const hh = Math.min(body.height, 34) + 20;
      if (py + hh > bottom) { body.destroy(); break; }
      this.panel(x + 8, py, w - 16, hh, 'paper');
      const g = this.add(gs.add.graphics());
      g.fillStyle(0x2b1a10, 1); g.fillCircle(x + 22, py + 12, 8);
      g.fillStyle(us.col, 1); g.fillCircle(x + 22, py + 12, 7);
      this.t(x + 22, py + 12, us.name[0], 8, '#ffffff', { ox: 0.5, oy: 0.5 });
      this.t(x + 34, py + 3, shortT(us.handle, 22), 9, COL.muted, { weight: '700' });
      body.setPosition(x + 34, py + 15); this.add(body);
      py += hh + 3;
    }
    this.tap(x + 8, cy, w - 16, py - cy, () => screens5.openFeed(gs), 'side_feed');
    return py;
  }

  private footBlock(fy: number, showTips = true) {
    const gs = this.gs, s = gs.s, { x, w } = this;
    const got = Object.keys(s.achievements).length;
    this.add(button(gs, x + 8, fy, w - 16, 28, `Prestasi ${got}/${ACHIEVEMENTS.length}`, () => { if (!gs.modalOpen()) screens5.openAchievements(gs); }, { size: 11, icon: 'i_medal', iconScale: 0.6 })).setName('side_ach');
    if (!showTips) return;
    this.add(gs.add.rectangle(x + 12, fy + 36, w - 24, 1, 0xc09a6a).setOrigin(0, 0));
    const tips = ['Roda mouse  zoom studio', 'Seret / panah / WASD  geser', 'Spasi  jeda   ·   Esc  tutup', 'Dibuat oleh KodeKecil'];
    tips.forEach((t, i) => this.t(x + w / 2, fy + 46 + i * 14, t, 9, i === 3 ? '#b04a1a' : COL.muted, { ox: 0.5, weight: i === 3 ? '800' : '600' }));
  }

  private staffBlock(cy: number, bottom: number) {
    const gs = this.gs, s = gs.s, { x, w } = this;
    this.header(x + 12, cy, 'KRU');
    this.t(x + w - 12, cy, `${s.staff.length}/${gs.sim.maxStaff()}`, 9, COL.muted, { ox: 1 });
    cy += 15;
    const RH = 34;
    const footH = 26;
    const per = Math.max(1, Math.floor((bottom - cy - footH) / RH));
    const pages = Math.max(1, Math.ceil(s.staff.length / per));
    if (this.page >= pages) this.page = pages - 1;
    s.staff.slice(this.page * per, this.page * per + per).forEach((st, i) => {
      const ry = cy + i * RH;
      this.panel(x + 8, ry, w - 16, RH - 3, st.strike ? 'sel' : 'paper');
      if (gs.textures.exists(`st${st.id}_0`)) {
        this.add(gs.add.image(x + 24, ry + RH - 4, `st${st.id}_0`).setOrigin(0.5, 1).setScale(0.4));
      }
      this.t(x + 40, ry + 3, shortT(st.name, 17), 10);
      const actor = st.role === 'aktor' || st.role === 'aktris';
      this.t(x + 40, ry + 16, st.strike ? 'MOGOK!' : `${ROLES[st.role].label} Lv${st.level}${actor ? ' · ' + fmtFollowers(st.followers) : ''}`, 9, st.strike ? COL.red : COL.muted, { weight: '700' });
      this.add(bar(gs, x + w - 58, ry + 8, 42, 6, st.energy / 100, st.energy < 30 ? 0xe05a3a : 0x6ac46a));
      this.t(x + w - 37, ry + 17, st.activity === 'rest' ? 'istirahat' : st.activity === 'work' ? 'kerja' : 'santai', 8, COL.muted, { ox: 0.5, weight: '600' });
      this.tap(x + 8, ry, w - 16, RH - 3, () => screens.openStaffDetail(gs, st), 'side_staff');
    });
    const py = bottom - footH + 2;
    if (pages > 1) {
      this.add(button(gs, x + 10, py, 34, 22, '<', () => { this.page = Math.max(0, this.page - 1); this.refresh(true); }, { size: 11, disabled: this.page === 0 }));
      this.t(x + w / 2, py + 11, `${this.page + 1}/${pages}`, 10, ROW, { ox: 0.5, oy: 0.5 });
      this.add(button(gs, x + w - 44, py, 34, 22, '>', () => { this.page = Math.min(pages - 1, this.page + 1); this.refresh(true); }, { size: 11, disabled: this.page >= pages - 1 }));
    } else {
      this.add(button(gs, x + 10, py, w - 20, 22, 'Rekrut / Audisi', () => { if (!gs.modalOpen()) screens.openStaff(gs); }, { size: 10 }));
    }
  }
}
