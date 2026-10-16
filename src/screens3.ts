// v3 screens: Tangga Rating (rating war), Peta (location shoots), rating alerts.
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { GENRES, THEMES, POINT_LABEL, type PointKey } from './data';
import { fmtShort, fmtNum, dateOf, type Show, type Pending } from './state';
import { COL, DISPLAY, ROUND, DRAG, txt, type Modal } from './ui';
import { mk, addTex } from './art';
import { sfx } from './audio';
import { chart, airingIn, TIERS, SAFE_RANK, CANCEL_WEEKS, TOP_WEEKS, type ChartRow } from './rating';
import { LOCATIONS, locById, locCost, locUnlocked, type LocDef } from './locations';
import { short, confetti } from './screens';
import { openTwistPicker } from './screens4';

const TIER_NAME: Record<string, string> = { lokal: 'TV Lokal', nasional: 'TV Nasional', streaming: 'Streaming' };

function comboName(id: string): string {
  return GENRES.find((g) => g.id === id)?.name ?? THEMES.find((t) => t.id === id)?.name ?? id;
}

/** small up/down/flat arrow drawn with graphics (fonts may not have the glyphs) */
function arrow(m: Modal, x: number, y: number, dir: 'up' | 'down' | 'flat') {
  const g = m.add(m.scene.add.graphics());
  if (dir === 'up') { g.fillStyle(0x1e5a1e, 1); g.fillTriangle(x - 6, y + 4, x + 6, y + 4, x, y - 5); g.fillStyle(0x4ac44a, 1); g.fillTriangle(x - 4, y + 3, x + 4, y + 3, x, y - 3); }
  else if (dir === 'down') { g.fillStyle(0x6a1a12, 1); g.fillTriangle(x - 6, y - 4, x + 6, y - 4, x, y + 5); g.fillStyle(0xe0503a, 1); g.fillTriangle(x - 4, y - 3, x + 4, y - 3, x, y + 3); }
  else { g.fillStyle(0x8a7a6a, 1); g.fillRect(x - 5, y - 1, 10, 3); }
  return g;
}

// ================================================================= Tangga Rating
export function playerTiers(gs: GameScene): string[] {
  return TIERS.filter((t) => airingIn(gs.s, t).length > 0);
}

export function openRatingChart(gs: GameScene, tierArg?: string, showArg?: number) {
  const s = gs.s;
  let tier = tierArg ?? playerTiers(gs).slice(-1)[0] ?? s.shows[s.shows.length - 1]?.platform ?? 'lokal';
  let selId = showArg ?? null;
  const m = gs.modal({ w: 344, h: 520, y: 50, title: 'TANGGA RATING', closable: true });
  m.build((m) => {
    const d = dateOf(s.absWeek);
    const tiers = playerTiers(gs);
    m.text(14, 20, `Th ${d.year} Bln ${d.month} Mg ${d.week}  ·  ${TIER_NAME[tier]}`, 10, COL.muted, { font: ROUND, weight: '600' });
    if (tiers.length > 1) {
      tiers.forEach((t, i) => m.btn(344 - 14 - (tiers.length - i) * 74, 16, 70, 20, TIER_NAME[t], () => { tier = t; selId = null; m.rebuild(); }, { kind: t === tier ? 'sel' : 'btn', size: 9 }));
    }
    const rows = chart(s, tier);
    const mine = rows.filter((r) => r.mine);
    if (selId === null || !mine.some((r) => r.showId === selId)) selId = mine.length ? mine[mine.length - 1].showId! : null;
    const show: Show | undefined = s.shows.find((x) => x.id === selId);
    // top 5 (+ our show if it sits lower)
    const vis: ChartRow[] = rows.slice(0, 5);
    for (const r of mine) if (!vis.includes(r)) vis.push(r);
    vis.forEach((r, i) => {
      const y = 40 + i * 35;
      m.panel(10, y, 324, 32, r.mine ? (r.showId === selId ? 'sel' : 'cream') : 'paper');
      if (r.mine) {
        const z = m.add(gs.add.zone(10, y, 324, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
        z.on('pointerup', () => { if (DRAG.moved) return; selId = r.showId!; sfx.click(); m.rebuild(); });
      }
      m.text(30, y + 16, '#' + r.rank, r.rank <= 3 ? 16 : 14, r.rank === 1 ? '#c0392b' : COL.text, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
      if (r.isNew) m.text(56, y + 16, 'BARU', 8, '#b04a8a', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
      else arrow(m, 56, y + 16, r.prevRank === 0 || r.prevRank === r.rank ? 'flat' : r.rank < r.prevRank ? 'up' : 'down');
      m.text(72, y + 3, short(r.title, 30), 11, COL.text, { font: ROUND, weight: '800' });
      const sub = r.mine ? 'Studio Kita' : r.station + (r.hit ? '  ·  lagi meledak!' : '');
      m.text(72, y + 17, sub, 9, r.mine ? '#b0402a' : COL.muted, { font: ROUND, weight: r.mine ? '800' : '600' });
      m.text(324, y + 16, r.rating.toFixed(1) + '%', 13, r.mine ? '#c0392b' : COL.text, { ox: 1, oy: 0.5, font: ROUND, weight: '800' });
      if (r.rank === SAFE_RANK && i < vis.length - 1 && vis[i + 1].rank === SAFE_RANK + 1) {
        const g = m.add(gs.add.graphics());
        g.fillStyle(0xc0392b, 0.7);
        for (let x = 14; x < 330; x += 8) g.fillRect(x, y + 33, 4, 1);
      }
    });
    const cy = 40 + vis.length * 35 + 6;
    // mini chart
    m.panel(10, cy, 324, 118, 'paper');
    if (show && show.hist.length) {
      m.text(18, cy + 6, short(show.title, 34), 10, COL.text, { font: ROUND, weight: '800' });
      drawChart(m, 18, cy + 24, 306, 74, show);
    } else {
      m.text(172, cy + 52, 'Belum ada sinetron kita yang tayang\ndi ' + TIER_NAME[tier] + '.', 11, COL.muted, { ox: 0.5, align: 'center' });
    }
    // status + actions
    const sy = cy + 126;
    if (show) {
      const rank = gs.sim.currentRank(show);
      let msg = `Minggu ${show.weeksAired}/${show.airWeeks}  ·  posisi #${rank}`;
      let col = COL.text;
      if (show.lowStreak > 0) { msg = `Bahaya! ${show.lowStreak} minggu di luar ${SAFE_RANK} besar. ${CANCEL_WEEKS} minggu = bisa distop!`; col = COL.red; }
      else if (rank === 1) { msg = show.topStreak >= TOP_WEEKS ? `Raja rating! #1 ${show.topStreak} minggu beruntun.` : `#1 ${show.topStreak} minggu. ${TOP_WEEKS - show.topStreak} minggu lagi dapat bonus stasiun!`; col = COL.green; }
      else if (rank <= SAFE_RANK) msg += '  ·  zona aman';
      if (show.boostWeeks > 0) msg += `\n${show.promoKind === 'kampanye' ? 'Kampanye Akbar' : 'Promo'} aktif: +${Math.round(show.boost * 100)}% (${show.boostWeeks} mg lagi)`;
      if (show.tWeeks > 0) msg += `${show.boostWeeks > 0 ? '  ·  ' : '\n'}Twist +${Math.round(show.tBoost * 100)}% (${show.tWeeks} mg)`;
      if (show.muak > 0) msg += `${show.boostWeeks > 0 || show.tWeeks > 0 ? '  ·  ' : '\n'}Netizen muak -${Math.round(show.muak * 100)}%`;
      m.text(172, sy, msg, 10, col, { ox: 0.5, align: 'center', wrap: 316, font: ROUND, weight: '800' });
      const pe = gs.sim.canPromo(show), ce = gs.sim.canCampaign(show), te = gs.sim.canTwist(show), ee = gs.sim.canExtend(show);
      const act = (err: string | null, fn: () => string | null, ok: string, snd: () => void) => () => {
        if (err) { gs.toast(err); sfx.bad(); return; }
        const e = fn();
        if (e) { gs.toast(e); sfx.bad(); } else { gs.toast(ok); snd(); }
        gs.refreshHud(); m.rebuild();
      };
      const by = sy + 40;
      m.btn(10, by, 160, 38, `Promo +25%\n${fmtShort(gs.sim.promoCost(show))}`, act(pe, () => gs.sim.promo(show), 'Iklan promo tayang di mana-mana! Rating naik 3 minggu.', () => sfx.coin()), { kind: pe ? 'disabled' : 'primary', size: 10 });
      m.btn(174, by, 160, 38, `Kampanye Akbar +55%\n${ce && ce.includes('Lv2') ? 'butuh studio Lv2' : fmtShort(gs.sim.campaignCost(show))}`, act(ce, () => gs.sim.campaign(show), 'Baliho di mana-mana, artis keliling mal! Rating ngebut 4 minggu.', () => sfx.fanfare()), { kind: ce ? 'disabled' : 'primary', size: 10 });
      m.btn(10, by + 42, 160, 38, `Kartu Plot Twist\n${te ? (show.twistCd > 0 ? `tunggu ${show.twistCd} mg` : 'belum bisa') : 'pilih kartu!'}`, () => {
        if (te) { gs.toast(te); sfx.bad(); return; }
        m.close(); openTwistPicker(gs, show);
      }, { kind: te ? 'disabled' : 'green', size: 10 });
      m.btn(174, by + 42, 160, 38, `Tambah Episode\n${ee ? 'khusus #1' : fmtShort(gs.sim.extendCost(show))}`, act(ee, () => gs.sim.extend(show), `"${short(show.title, 20)}" diperpanjang 8 episode!`, () => sfx.fanfare()), { kind: ee ? 'disabled' : 'green', size: 10 });
    }
  });
  return m;
}

function drawChart(m: Modal, x: number, y: number, w: number, h: number, sh: Show) {
  const g = m.add(m.scene.add.graphics());
  const mine = sh.hist, riv = sh.rivalHist;
  const n = Math.max(2, sh.airWeeks, mine.length);
  const max = Math.max(1, ...mine, ...riv) * 1.15;
  g.fillStyle(0xfffaf0, 1); g.fillRect(x, y, w, h);
  g.lineStyle(1, 0xe8d4a8, 1);
  for (let i = 1; i < 4; i++) g.lineBetween(x, y + (h * i) / 4, x + w, y + (h * i) / 4);
  g.lineStyle(1.5, 0x9a5a2a, 1); g.strokeRect(x, y, w, h);
  const px = (i: number) => x + 6 + (i / (n - 1)) * (w - 12);
  const py = (v: number) => y + h - 4 - (v / max) * (h - 10);
  const line = (vals: number[], col: number, width: number, dots: boolean) => {
    if (!vals.length) return;
    g.lineStyle(width, col, 1);
    g.beginPath(); g.moveTo(px(0), py(vals[0]));
    for (let i = 1; i < vals.length; i++) g.lineTo(px(i), py(vals[i]));
    g.strokePath();
    if (dots) for (let i = 0; i < vals.length; i++) { g.fillStyle(0x2b1a10, 1); g.fillCircle(px(i), py(vals[i]), 3); g.fillStyle(col, 1); g.fillCircle(px(i), py(vals[i]), 2); }
  };
  line(riv, 0x7a8aa8, 2, false);
  line(mine, 0xe0662a, 2.5, true);
  // rank labels on our dots
  sh.ranks.forEach((r, i) => { if (i % Math.ceil(sh.ranks.length / 8) === 0 || i === sh.ranks.length - 1) m.text(px(i), py(mine[i]) - 5, '#' + r, 8, r <= SAFE_RANK ? '#2e7a2e' : COL.red, { ox: 0.5, oy: 1, font: ROUND, weight: '800' }); });
  m.text(x, y + h + 3, 'Kita', 9, '#e0662a', { font: ROUND, weight: '800' });
  m.text(x + 30, y + h + 3, 'Saingan teratas', 9, '#5a6a88', { font: ROUND, weight: '800' });
  m.text(x + w, y + h + 3, `${mine.length}/${sh.airWeeks} minggu`, 9, COL.muted, { ox: 1, font: ROUND, weight: '600' });
}

/** warn / cancel / #1 popups */
export function showRatingAlert(gs: GameScene, p: Extract<Pending, { kind: 'rating' }>, done: () => void) {
  const sh = gs.s.shows.find((x) => x.id === p.showId);
  if (!sh) { done(); return; }
  const t = short(sh.title, 34);
  if (p.type === 'cancel') {
    sfx.setMusicOverride('silent');
    sfx.sting('drama');
    gs.time.delayedCall(1300, () => sfx.sting('flop'));
    const m = gs.modal({ w: 310, h: 300, title: 'DISTOP STASIUN TV!' });
    m.build((m) => {
      m.text(155, 30, `"${t}"`, 13, COL.text, { ox: 0.5, align: 'center', wrap: 280, bold: true });
      // red stamp
      const c = m.add(gs.add.container(155, 104).setAngle(-8));
      const g = gs.add.graphics();
      g.fillStyle(0x7a1408, 1); g.fillRoundedRect(-80, -20, 160, 40, 9);
      g.fillStyle(0xd0402e, 1); g.fillRoundedRect(-77, -17, 154, 34, 8);
      g.lineStyle(2, 0xfff0c0, 1); g.strokeRoundedRect(-72, -12, 144, 24, 6);
      c.add([g, txt(gs, 0, 0, 'DISTOP!', 20, '#fff8e8', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#5a1a0a', strokeW: 3 })]);
      c.setScale(2.4).setAlpha(0);
      gs.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Quad.easeIn', onComplete: () => gs.cameras.main.shake(160, 0.005) });
      m.text(155, 140, `Ratingnya jeblok ${CANCEL_WEEKS} minggu berturut-turut.\nStasiun cabut dari jadwal tayang,\niklan berhenti hari ini juga.`, 11, COL.text, { ox: 0.5, align: 'center', wrap: 280, lineSpacing: 2 });
      m.text(155, 200, `Fans kecewa: -${fmtNum(p.fans)}`, 12, COL.red, { ox: 0.5, bold: true });
      m.btn(55, 240, 200, 42, 'Huhu... OK', () => { sfx.setMusicOverride(null); m.close(); done(); }, { kind: 'primary', size: 13 });
    });
    return;
  }
  if (p.type === 'warn') {
    sfx.sting('drama');
    const rookie = gs.s.shows.indexOf(sh) < 2;
    const m = gs.modal({ w: 310, h: 270, title: 'STASIUN TV GELISAH' });
    m.build((m) => {
      m.text(155, 26, `"${t}"`, 12, COL.text, { ox: 0.5, align: 'center', wrap: 280, bold: true });
      m.text(155, 62, rookie
        ? `Udah ${CANCEL_WEEKS - 1} minggu di luar ${SAFE_RANK} besar Tangga Rating.\nKarena kita masih pendatang baru, stasiun kasih kesempatan. Tapi jangan diulang ya!`
        : `Udah ${CANCEL_WEEKS - 1} minggu di luar ${SAFE_RANK} besar Tangga Rating.\nKalau minggu depan masih jeblok, sinetron ini bakal DISTOP!`, 11, COL.text, { ox: 0.5, align: 'center', wrap: 280, lineSpacing: 2 });
      const pe = gs.sim.canPromo(sh);
      m.text(155, 130, pe ? '' : `Promo bisa dongkrak rating 25% selama 3 minggu.`, 10, COL.muted, { ox: 0.5, align: 'center', wrap: 280 });
      m.btn(14, 160, 136, 44, `Promo!\n${fmtShort(gs.sim.promoCost(sh))}`, () => {
        const err = gs.sim.promo(sh);
        if (err) { gs.toast(err); sfx.bad(); return; }
        gs.toast('Promo jalan! Semoga penonton balik lagi.'); sfx.coin(); gs.refreshHud(); m.close(); done();
      }, { kind: pe ? 'disabled' : 'primary', disabled: !!pe, size: 11 });
      m.btn(160, 160, 136, 44, 'Lihat Tangga\nRating', () => { m.close(); done(); openRatingChart(gs, sh.platform, sh.id); }, { size: 11 });
      m.btn(55, 212, 200, 40, 'Biarin dulu', () => { m.close(); done(); }, { size: 12 });
    });
    return;
  }
  // #1 bonus
  sfx.fanfare();
  gs.time.delayedCall(400, () => sfx.sting('great'));
  confetti(gs, 2100, 70);
  const m = gs.modal({ w: 310, h: 300, title: 'PUNCAK RATING!' });
  m.build((m) => {
    m.img(155, 92, 'i_bigtrophy', 1.6).setOrigin(0.5, 1);
    m.text(155, 100, `"${t}"`, 12, COL.text, { ox: 0.5, align: 'center', wrap: 280, bold: true });
    m.text(155, 134, `Nangkring di #1 Tangga Rating ${sh.topStreak} minggu beruntun!\nStasiun kasih bonus:`, 11, COL.text, { ox: 0.5, align: 'center', wrap: 280 });
    m.text(155, 172, `+${fmtShort(p.money)}   +${fmtNum(p.fans)} fans`, 14, COL.green, { ox: 0.5, font: ROUND, weight: '800' });
    const ee = gs.sim.canExtend(sh);
    if (!ee) {
      m.btn(14, 236, 136, 46, `Tambah Episode\n${fmtShort(gs.sim.extendCost(sh))}`, () => {
        const err = gs.sim.extend(sh);
        if (err) { gs.toast(err); sfx.bad(); return; }
        gs.toast(`Diperpanjang 8 episode! Gas terus.`); gs.refreshHud(); m.close(); done();
      }, { kind: 'green', size: 11 });
      m.btn(160, 236, 136, 46, 'Mantap!', () => { m.close(); done(); }, { kind: 'primary', size: 13 });
      m.text(155, 204, 'Mau diperpanjang selagi panas?', 10, COL.muted, { ox: 0.5 });
    } else m.btn(55, 236, 200, 46, 'Mantap!', () => { m.close(); done(); }, { kind: 'primary', size: 13 });
  });
}

// ================================================================= Peta
const MAP_W = 162, MAP_H = 125;
type Poly = [number, number][];
const ISLANDS: Poly[] = [
  // Sumatra
  [[4, 10], [12, 6], [20, 12], [30, 22], [40, 34], [50, 46], [58, 58], [64, 68], [66, 78], [60, 82], [52, 78], [44, 68], [34, 56], [24, 42], [14, 28], [6, 18]],
  // Jawa
  [[62, 84], [72, 82], [86, 84], [100, 85], [114, 86], [126, 88], [134, 91], [132, 98], [120, 100], [108, 102], [96, 101], [84, 99], [72, 97], [64, 93]],
  // Madura
  [[116, 82], [127, 82], [128, 85], [117, 86]],
  // Bali, Lombok, Sumbawa
  [[136, 93], [143, 92], [146, 95], [144, 99], [138, 99]],
  [[149, 94], [154, 93], [155, 98], [150, 99]],
  [[158, 94], [163, 93], [163, 99], [158, 99]],
  // Kalimantan
  [[70, 14], [84, 6], [100, 2], [118, 4], [130, 14], [134, 26], [130, 42], [120, 54], [106, 62], [92, 62], [80, 54], [72, 40], [68, 26]],
  // Sulawesi
  [[142, 12], [156, 8], [160, 12], [150, 16], [148, 24], [160, 26], [163, 32], [152, 34], [150, 44], [154, 56], [148, 62], [142, 50], [140, 36], [138, 24]],
  // Bangka, Belitung, Nias
  [[58, 50], [65, 48], [67, 54], [61, 56]],
  [[74, 56], [80, 55], [81, 61], [74, 61]],
  [[8, 36], [11, 35], [12, 41], [9, 42]],
];

function inPoly(x: number, y: number, p: Poly): boolean {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const hash = (x: number, y: number) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };

export function ensureMapTex(scene: Phaser.Scene) {
  if (scene.textures.exists('peta_map')) return;
  const [c, ctx] = mk(MAP_W, MAP_H);
  const land = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const jx = x + 0.5 + (hash(x, y) - 0.5) * 1.6, jy = y + 0.5 + (hash(y, x) - 0.5) * 1.6;
    if (ISLANDS.some((p) => inPoly(jx, jy, p))) land[y * MAP_W + x] = 1;
  }
  // distance to coast (both sides), 4-neighbour BFS
  const dist = new Int16Array(MAP_W * MAP_H).fill(99);
  const q: number[] = [];
  for (let i = 0; i < land.length; i++) {
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H && land[ny * MAP_W + nx] !== land[i]; });
    if (nb) { dist[i] = 0; q.push(i); }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const j = ny * MAP_W + nx; if (land[j] === land[i] && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
    }
  }
  const img = ctx.createImageData(MAP_W, MAP_H);
  const put = (i: number, col: number) => { img.data[i * 4] = (col >> 16) & 255; img.data[i * 4 + 1] = (col >> 8) & 255; img.data[i * 4 + 2] = col & 255; img.data[i * 4 + 3] = 255; };
  for (let i = 0; i < land.length; i++) {
    const x = i % MAP_W, y = (i / MAP_W) | 0, d = dist[i], r = hash(x * 3, y * 7);
    if (land[i]) {
      let col = d === 0 ? 0xf2d890 : d <= 2 ? 0x7cc050 : d <= 5 ? 0x62a842 : 0x4e9436;
      if (d > 4 && r > 0.93) col = 0x8a6a3a; // hills
      else if (d > 3 && r > 0.86) col = 0x3a7a2a; // trees
      put(i, col);
    } else {
      let col = d === 0 ? 0x2b1a10 : d <= 2 ? 0x6cc0ec : d <= 6 ? 0x52a8e0 : 0x4596d4;
      if (d > 2 && ((x + y * 3) % 11 === 0) && (y % 4 === 1) && r > 0.4) col = 0xa8dcf8; // little waves
      put(i, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  // Danau Toba
  ctx.fillStyle = '#2b1a10'; ctx.fillRect(21, 28, 6, 4);
  ctx.fillStyle = '#5ab0e8'; ctx.fillRect(22, 29, 4, 2);
  addTex(scene, 'peta_map', c);
  scene.textures.get('peta_map').setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export interface MapOpts { select?: (id: string | null) => void; current?: string | null; platform?: string; eps?: number; genre?: string; theme?: string }

export function openMap(gs: GameScene, o: MapOpts = {}) {
  ensureMapTex(gs);
  const s = gs.s;
  const yr = () => dateOf(s.absWeek).year;
  const prod = s.prod;
  const ctxPlat = o.platform ?? prod?.platform ?? s.platforms[s.platforms.length - 1];
  const ctxEps = o.eps ?? prod?.eps ?? 13;
  let sel: LocDef = locById(o.current ?? prod?.location ?? null) ?? LOCATIONS[0];
  const m = gs.modal({ w: 344, h: 596, y: 18, title: 'PETA LOKASI', closable: true });
  const MX = 10, MY = 22;
  m.build((m) => {
    m.panel(MX - 3, MY - 3, MAP_W * 2 + 6, MAP_H * 2 + 6, 'dark');
    m.img(MX, MY, 'peta_map', 2).setOrigin(0, 0);
    m.text(MX + MAP_W * 2 - 6, MY + MAP_H * 2 - 14, 'INDONESIA', 9, '#fff8e8', { ox: 1, font: DISPLAY, stroke: '#2b1a10', strokeW: 2 });
    // "Luar Negeri" inset (bottom-left ocean) for shoots abroad
    {
      const ix = MX + 2, iy = MY + 100 * 2, iw = 106, ih = 46;
      const g = m.add(gs.add.graphics());
      g.fillStyle(0x2b1a10, 1); g.fillRoundedRect(ix - 1, iy - 1, iw + 2, ih + 2, 6);
      g.fillStyle(0x3a6ea8, 1); g.fillRoundedRect(ix, iy, iw, ih, 5);
      g.lineStyle(1, 0xa8dcf8, 0.6); g.strokeRoundedRect(ix + 2, iy + 2, iw - 4, ih - 4, 4);
      // little plane
      g.fillStyle(0xfff8e8, 1); g.fillRect(ix + iw - 18, iy + 7, 12, 2); g.fillTriangle(ix + iw - 14, iy + 8, ix + iw - 10, iy + 3, ix + iw - 9, iy + 8); g.fillTriangle(ix + iw - 14, iy + 8, ix + iw - 10, iy + 13, ix + iw - 9, iy + 8);
      m.text(ix + 5, iy + 3, 'LUAR NEGERI', 8, '#fff8e8', { font: DISPLAY, stroke: '#2b1a10', strokeW: 2 });
    }
    const chosen = o.current ?? prod?.location ?? null;
    for (const l of LOCATIONS) {
      const un = locUnlocked(l, s.fans, yr());
      const x = MX + l.gx * 2, y = MY + l.gy * 2;
      const g = m.add(gs.add.graphics());
      const isSel = l === sel;
      const col = !un ? 0x8a8a94 : l.id === chosen ? 0xf6c440 : (s.locCombos[l.id]?.length ? 0xe0662a : 0xd0402e);
      g.fillStyle(0x000000, 0.3); g.fillEllipse(x, y + 1, 10, 4);
      g.fillStyle(0x2b1a10, 1); g.fillCircle(x, y - 9, isSel ? 7 : 6); g.fillTriangle(x - 4, y - 6, x + 4, y - 6, x, y + 1);
      g.fillStyle(col, 1); g.fillCircle(x, y - 9, isSel ? 5.5 : 4.5); g.fillTriangle(x - 2.5, y - 6, x + 2.5, y - 6, x, y - 1);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(x - 1.5, y - 10.5, 1.5);
      if (!un) { g.fillStyle(0x2b1a10, 1); g.fillRect(x - 2, y - 10, 4, 3); }
      if (isSel) { gs.tweens.add({ targets: g, y: -3, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); g.once('destroy', () => gs.tweens.killTweensOf(g)); }
      const z = m.add(gs.add.zone(x - 11, y - 20, 22, 24).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
      z.on('pointerup', () => { if (DRAG.moved) return; sel = l; sfx.click(); m.rebuild(); });
    }
    // label of the selected pin
    {
      const x = MX + sel.gx * 2, y = MY + sel.gy * 2;
      const lab = txt(gs, 0, 0, sel.name, 10, '#3a1e08', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
      const w = lab.width + 12, h = 15;
      const lx = Math.max(MX + w / 2 + 2, Math.min(MX + MAP_W * 2 - w / 2 - 2, x));
      let ly = sel.abroad ? y + 12 : y - 30;
      if (ly < MY + 10) ly = y + 12;
      const g = m.add(gs.add.graphics());
      g.fillStyle(0x3a1e08, 1); g.fillRoundedRect(lx - w / 2 - 1.5, ly - h / 2 - 1.5, w + 3, h + 3, 7);
      g.fillStyle(0xffffff, 1); g.fillRoundedRect(lx - w / 2, ly - h / 2, w, h, 6);
      lab.setPosition(lx, ly); m.add(lab);
    }
    // location chips
    LOCATIONS.forEach((l, i) => {
      const un = locUnlocked(l, s.fans, yr());
      const x = 10 + (i % 3) * 109, y = MY + MAP_H * 2 + 8 + Math.floor(i / 3) * 24;
      m.btn(x, y, 106, 23, un ? l.short : '???', () => { sel = l; m.rebuild(); }, { kind: l === sel ? 'sel' : 'btn', size: 10, icon: un ? undefined : 'i_lock' });
    });
    // details
    const dy = MY + MAP_H * 2 + 8 + Math.ceil(LOCATIONS.length / 3) * 24 + 2;
    m.panel(10, dy, 324, 148, 'paper');
    const un = locUnlocked(sel, s.fans, yr());
    const cost = locCost(sel, ctxPlat, ctxEps);
    m.text(18, dy + 7, sel.name, 13, COL.text, { font: ROUND, weight: '800' });
    m.text(326, dy + 8, fmtShort(cost), 12, s.money >= cost ? COL.green : COL.red, { ox: 1, font: ROUND, weight: '800' });
    m.text(18, dy + 26, sel.blurb, 10, COL.muted, { wrap: 300 });
    const bonus = (Object.keys(sel.bonus) as PointKey[]).map((k) => `${POINT_LABEL[k]} +${Math.round((sel.bonus[k] ?? 0) * 100)}%`).join(', ');
    m.text(18, dy + 42, `Bonus syuting: ${bonus}`, 10, COL.text, { bold: true });
    const found = s.locCombos[sel.id] ?? [];
    m.text(18, dy + 59, 'Combo:', 10, COL.text, { bold: true });
    let cx = 62;
    for (const c of sel.combos) {
      const known = found.includes(c);
      const label = known ? comboName(c) : '???';
      const t = txt(gs, 0, 0, label, 9, known ? '#7a2a08' : '#8a7a6a', { font: ROUND, weight: '800', oy: 0.5 });
      const w = t.width + 10;
      const g = m.add(gs.add.graphics());
      g.fillStyle(known ? 0xffd27a : 0xe8dcc0, 1); g.fillRoundedRect(cx, dy + 58, w, 14, 6);
      g.lineStyle(1, known ? 0xb0402a : 0xb8a888, 1); g.strokeRoundedRect(cx, dy + 58, w, 14, 6);
      t.setPosition(cx + 5, dy + 65); m.add(t);
      cx += w + 4;
    }
    m.text(18, dy + 78, found.length < sel.combos.length ? `Bisikan kru: "${sel.hint}"` : 'Semua combo lokasi ini sudah ketahuan!', 9, '#6a4a2a', { wrap: 306, lineSpacing: 1 });
    if (!un) {
      const req = sel.unlockYear > 1 ? `${fmtNum(sel.unlockFans)} fans atau mulai Tahun ${sel.unlockYear + 1}` : `${fmtNum(sel.unlockFans)} fans`;
      m.text(18, dy + 126, `Terkunci: butuh ${req}`, 10, COL.red, { bold: true });
    } else m.text(18, dy + 126, 'Risiko: hujan deras, kru nyasar, warga kepo', 9, COL.muted);
    // actions
    const by = dy + 156;
    if (o.select) {
      m.btn(10, by, 104, 40, 'Tanpa Lokasi', () => { o.select!(null); m.close(); }, { size: 11 });
      m.btn(122, by, 212, 40, un ? `Pilih ${sel.short} (${fmtShort(cost)})` : 'Masih terkunci', () => { o.select!(sel.id); m.close(); }, { kind: un ? 'primary' : 'disabled', disabled: !un, size: 11 });
    } else if (prod && !prod.location) {
      const err = gs.sim.canSetLocation();
      m.btn(10, by, 324, 40, err ?? (un ? `Syuting di ${sel.short}! (${fmtShort(cost)})` : 'Masih terkunci'), () => {
        const e = gs.sim.setLocation(sel.id);
        if (e) { gs.toast(e); sfx.bad(); return; }
        sfx.fanfare(); gs.toast(`Oke! Syuting "${short(prod.title, 18)}" pindah ke ${sel.name}.`); gs.refreshHud(); m.close();
      }, { kind: err || !un ? 'disabled' : 'primary', disabled: !!err || !un, size: 12 });
    } else if (prod && prod.location) {
      const l = locById(prod.location)!;
      m.text(172, by + 12, prod.phase === 'syuting' ? `Kru lagi syuting di ${l.name}!` : prod.phase === 'naskah' ? `Syuting nanti di ${l.name}.` : `Syuting di ${l.name} sudah beres.`, 12, COL.blue, { ox: 0.5, font: ROUND, weight: '800' });
    } else {
      m.text(172, by + 12, 'Pilih lokasi waktu bikin Sinetron Baru (Langkah 2).', 10, COL.muted, { ox: 0.5, align: 'center', wrap: 316 });
    }
  });
  return m;
}
