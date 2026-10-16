// Soak test (v5): a bot plays N in-game years inside the real page (rendering between chunks) with all v5 systems on:
// gosip / boikot, casting auditions + rewel / mogok, product placement, KPI, achievements, the year-10 ending, the
// netizen feed and (on wide viewports) the side panels. Every few chunks it opens a v5 screen to exercise rendering.
// usage: node tools/soak.mjs [years=10] [mode=smart|dumb|casual] [label] [WxH=390x780] [dist]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';

const YEARS = Number(process.argv[2] ?? 10);
const MODE = process.argv[3] ?? 'casual';
const LABEL = process.argv[4] ?? MODE;
const [VW, VH] = (process.argv[5] ?? '390x780').split('x').map(Number);
const ROOT = path.resolve(process.argv[6] ?? 'dist');
const SHOTS = path.resolve('../shots/soak');
fs.mkdirSync(SHOTS, { recursive: true });
const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + ' ' + e.stack));
await page.goto(`http://localhost:${port}/`);
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'));
await page.waitForTimeout(500);
await page.evaluate(() => { localStorage.clear(); const t = window.__game.scene.getScene('Title'); const s = window.__newGameForTests(); s.tut = -1; t.scene.start('Game', { state: s }); });
await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron);
await page.waitForTimeout(800);
const shot = async (n) => { await page.screenshot({ path: path.join(SHOTS, `${LABEL}-${n}.png`) }); };

await page.evaluate(`
window.__stats = { mode: ${JSON.stringify(MODE)}, gossips: 0, goreng: 0, boikots: 0, kpi1: 0, kpi2: 0, sowan: 0, placements: 0, castings: 0, mogok: 0, rewel: 0, ending: 0, cancels: 0, tops: 0, promos: 0, debt: 0 };
window.__bot = function (ticks) {
  const { sim, scene, v5 } = window.__sinetron;
  const S = window.__stats, M = S.mode, smart = M === 'smart', dumb = M === 'dumb';
  const s = sim.s;
  const R = (n) => Math.floor(Math.random() * n);
  const great = [['azab','pesantren'],['romansa','sekolah'],['komedi','kos'],['horor','hutan'],['religi','pesantren'],['keluarga','kampung'],['siluman','laut'],['kolosal','kerajaan'],['remaja','sekolah'],['komedi','pasar']];
  for (let i = 0; i < ticks; i++) {
    while (s.queue.length) {
      const p = s.queue[0];
      sim.shift();
      if (p.kind === 'event') {
        let n = p.eventId === 'dibajak' || p.eventId === 'endorse' ? 3 : 2, c;
        const id = p.eventId, d = p.data;
        if (id === 'gosip') { S.gossips++; n = d.kind === 'viral' ? 2 : 3; c = d.kind === 'viral' ? 0 : smart ? (s.boikot >= 30 ? 0 : 1) : dumb ? 1 : R(3); if (c === 1 && d.kind !== 'viral') S.goreng++; }
        else if (id === 'boikot') { S.boikots++; c = smart ? 0 : dumb ? 1 : R(2); }
        else if (id === 'rewel') { S.rewel++; c = smart ? 1 : R(2); }
        else if (id === 'mogok') { S.mogok++; c = smart ? 0 : R(3); }
        else if (id === 'kpi') { if (Number(d.stage) === 1) { S.kpi1++; c = 0; } else { S.kpi2++; c = smart ? 1 : dumb ? 0 : R(2); } }
        else if (id === 'placement') { const w = s.prod ? v5.placementWeight({ genre: s.prod.genre, placements: s.prod.placements }) : 9; c = smart ? (w < v5.PLACEMENT_SAFE - 0.4 ? 0 : 1) : dumb ? 0 : R(2); if (c === 0) S.placements++; }
        else c = R(n);
        const n0 = s.staff.length;
        sim.resolveEvent(p, c);
        if (s.staff.length !== n0) scene.rebuildAfterStaffChange();
      }
      if (p.kind === 'achv') scene.onSim ? 0 : 0;
      if (p.kind === 'ending') { S.ending++; window.__endingDue = true; }
      if (p.kind === 'warning') S.debt++;
      if (p.kind === 'rating') { if (p.type === 'cancel') S.cancels++; if (p.type === 'top') S.tops++; }
      if (p.kind === 'editDone') { if (s.prod && s.prod.bloopers > 4) sim.extendEditing(); else sim.release(); }
      if (p.kind === 'gameover') return 'gameover';
    }
    for (const sh of s.shows.filter((x) => sim.isAiring(x) && x.ranks.length)) {
      const rk = sim.currentRank(sh);
      if (rk > 3 && !sim.canPromo(sh) && s.money > sim.promoCost(sh) * 4 && Math.random() < 0.3) { if (!sim.promo(sh)) S.promos++; }
      if (rk === 1 && !sim.canExtend(sh) && s.money > sim.extendCost(sh) * 3 && Math.random() < 0.3) sim.extend(sh);
      if (!sim.canTwist(sh) && Math.random() < (dumb ? 0.15 : 0.05)) { const c = sim.twistsUnlocked(); sim.playTwist(sh, c[R(c.length)]); }
    }
    // v5 decisions
    if (s.prod && s.prod.offers.length) for (const o of [...s.prod.offers]) {
      const w = v5.placementWeight({ genre: s.prod.genre, placements: s.prod.placements });
      if (dumb || (smart ? w < v5.PLACEMENT_SAFE - 0.4 : Math.random() < 0.3)) { if (!v5.acceptOffer(sim, o.id)) S.placements++; } else if (smart) v5.declineOffer(sim, o.id);
    }
    if (smart && s.kpi >= 50 && !v5.canSowan(s)) { if (!v5.sowan(sim)) S.sowan++; }
    if (smart && s.prod && s.kpi >= 35 && !s.prod.sensor) s.prod.sensor = true;
    if (!s.prod && !s.job) {
      for (const g of ['romansa','komedi','keluarga','azab','religi','remaja','horor','laga','siluman','kolosal']) if (!s.unlockedGenres.includes(g)) sim.unlockGenre(g);
      for (const t of ['kampung','kota','sekolah','pasar','pesantren','kantor','rumahsakit','kos','kampus','hutan','kerajaan','laut']) if (!s.unlockedThemes.includes(t)) sim.unlockTheme(t);
      for (const p of ['nasional','streaming']) if (!s.platforms.includes(p) && s.money > 150e6) sim.unlockPlatform(p);
      if (s.money > 300e6 || (s.studio === 1 && s.money > 110e6)) { if (!sim.upgradeStudio()) scene.buildStudio(); }
      for (const id of ['kamera', 'crane', 'editing', 'medsos', 'cgi', 'orkestra']) if (!sim.canBuyEquip(id) && s.money > sim.equipPrice(id) * 3) sim.buyEquip(id);
      if (s.staff.length < sim.maxStaff() && s.money > 30e6 && s.candidates.length) { if (!sim.hire(s.candidates[0])) scene.syncStaff(); }
      // v5 casting audition now and then
      if (s.staff.length < sim.maxStaff() && s.money > v5.auditionCost(s) * 6 && Math.random() < (dumb ? 0.05 : 0.02)) {
        if (!v5.startAudition(sim, Math.random() < 0.5 ? 'aktor' : 'aktris')) { v5.auditionScene(s, ['nangis','marah','romantis','lucu'][R(4)]); const a = s.audition; const b = a.scores.indexOf(Math.max(...a.scores)); if (!v5.auditionHire(sim, b)) { S.castings++; scene.rebuildAfterStaffChange(); } s.audition = null; }
      }
      if (s.staff.some((x) => x.energy < 40) && s.money > 5e6) sim.treat();
      if (smart && s.money < sim.monthlyCosts() * 1.2 && s.staff.length > 5) { const core = new Set(['sutradara','penulis','aktor','aktris'].map((r) => s.staff.find((x) => x.role === r)?.id)); const x = s.staff.filter((y) => !core.has(y.id)).sort((a, b) => b.salary - a.salary)[0]; if (x) { sim.fire(x); scene.rebuildAfterStaffChange(); } }
      const avail = great.filter(([g,t]) => s.unlockedGenres.includes(g) && s.unlockedThemes.includes(t));
      const last = s.shows[s.shows.length-1];
      const cands = avail.filter(([g]) => !last || last.genre !== g);
      const [g, t] = dumb ? [s.unlockedGenres[R(s.unlockedGenres.length)], s.unlockedThemes[R(s.unlockedThemes.length)]] : cands.length ? cands[R(cands.length)] : [s.unlockedGenres[0], s.unlockedThemes[1]];
      const pl = s.platforms.includes('streaming') && s.money > 250e6 ? 'streaming' : s.platforms.includes('nasional') && s.money > 60e6 ? 'nasional' : 'lokal';
      const eps = s.money > 150e6 ? 26 : 13;
      if (s.money > sim.prodCost(pl, eps, 'standar') + 3e6) {
        const m = s.staff.find((x) => x.role === 'aktor' && !x.strike), f = s.staff.find((x) => x.role === 'aktris' && !x.strike);
        const o = { title: 'Bot ' + s.shows.length, genre: g, theme: t, platform: pl, eps, budget: dumb && s.money > 200e6 ? 'mewah' : 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null, location: null, ost: null, parentId: null, spin: null };
        sim.startProduction(o);
      } else if (s.jobOffers.length) sim.startJob(s.jobOffers[0]);
    }
    sim.tick();
  }
  scene.syncStaff();
  scene.refreshHud();
  return null;
};`);

const UI = [
  'screens5.openFeed(scene)', 'screens5.openAchievements(scene)', 'screens5.openKpi(scene)', 'screens5.openPlacements(scene)',
  'screens5.openAudition(scene)', 'screens.openStaff(scene)', 'screens3.openRatingChart(scene)', 'screens.openMenu(scene)',
];
const t0 = Date.now();
let chunk = 0, shots = 0, endingShown = false;
for (; chunk < 3000; chunk++) {
  const r = await page.evaluate(() => window.__bot(16));
  await page.waitForTimeout(20);
  if (r === 'gameover') { console.log('GAME OVER at chunk', chunk); break; }
  if (chunk % 25 === 7) {
    const k = chunk % UI.length;
    // no new Function / eval: the page runs under the real CSP (script-src 'self')
    await page.evaluate((i) => { const { scene, screens, screens3, screens5 } = window.__sinetron; [() => screens5.openFeed(scene), () => screens5.openAchievements(scene), () => screens5.openKpi(scene), () => screens5.openPlacements(scene), () => screens5.openAudition(scene), () => screens.openStaff(scene), () => screens3.openRatingChart(scene), () => screens.openMenu(scene)][i](); }, Math.floor(chunk / 25) % UI.length);
    await page.waitForTimeout(250);
    if (shots < 3 && chunk % 75 === 7) { await shot(`ui-${shots++}`); }
    await page.evaluate(() => { const g = window.__sinetron.scene; while (g.modals.length) g.modals[g.modals.length - 1].close(); document.getElementById('sinetron-dom')?.remove(); });
  }
  const w = await page.evaluate(() => window.__sinetron.sim.s.absWeek);
  if (!endingShown && (await page.evaluate(() => !!window.__endingDue))) {
    endingShown = true;
    await page.evaluate(() => { const g = window.__sinetron.scene; window.__sinetron.screens5.showEnding(g, () => {}); });
    await page.waitForTimeout(1500);
    await shot('ending');
    await page.evaluate(() => { const g = window.__sinetron.scene; while (g.modals.length) g.modals[g.modals.length - 1].close(); window.__sinetron.sim.s.endingSeen = true; });
  }
  if (w >= 48 * YEARS + 2) break;
}
await page.waitForTimeout(600);
await shot('final');
// v5.1: the late-game save still passes the backup validation (size / array / string limits) and survives a reload
const rt = await page.evaluate(() => { const { sim, backup } = window.__sinetron; const code = backup.exportCode(sim.s); const r = backup.parseBackup(code); return { ok: r.ok, err: r.error ?? null, kb: Math.round(code.length / 1024) }; });
console.log('BACKUP round trip', JSON.stringify(rt));
if (!rt.ok) errors.push('[backup] late-game save rejected by parseBackup: ' + rt.err);
const sum = await page.evaluate(() => { const s = window.__sinetron.sim.s; return { stats: window.__stats, week: s.absWeek, year: Math.floor((s.absWeek - 1) / 48) + 1, gameOver: s.gameOver, money: Math.round(s.money / 1e6) + 'jt', fans: s.fans, shows: s.shows.length, hof: s.shows.filter((x) => x.hof).length, trophies: s.trophies, studio: s.studio, staff: s.staff.length, ach: Object.keys(s.achievements).length, kpiNow: Math.round(s.kpi), feed: s.feed.length }; });
console.log('SUMMARY', LABEL, JSON.stringify(sum), `chunks ${chunk} in ${Math.round((Date.now() - t0) / 1000)}s`);
console.log('errors:', errors.length); errors.slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 600)));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
