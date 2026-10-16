// v5 responsive check: title + in-game + side panels + a dialog at phone / laptop / desktop sizes, plus a live resize
// mid-game (state kept, dialog kept). Checks canvas centring, the KodeKecil credit, Esc / Space / wheel / keyboard pan.
// usage: node tools/shot-resp.mjs <dist dir> <shots dir> [prefix] [only=WxH,...|resize]
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const target = process.argv[2] ?? 'dist';
const SHOTS = path.resolve(process.argv[3] ?? '../shots/v5');
const PRE = process.argv[4] ?? 'resp';
const ONLY = process.argv[5] ? process.argv[5].split(',') : null;
fs.mkdirSync(SHOTS, { recursive: true });
const { server, port } = await serve(path.resolve(target));
const url = `http://localhost:${port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = []; let fails = 0;
const ok = (c, m) => { console.log(c ? '  ok' : '  FAIL', m); if (!c) fails++; };
const SIZES = [[375, 812, 3], [390, 844, 3], [1280, 720, 1], [1366, 768, 1], [1920, 1080, 1], [900, 560, 1], [768, 1024, 2],
  // v5.1 short windows: logical height shrinks instead of a uniform downscale
  [1366, 600, 1], [1280, 560, 1], [844, 390, 3]];
async function boot(page) {
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 45000 });
  await page.waitForTimeout(1200);
}
async function startGame(page, tut = -1) {
  await page.evaluate((tut) => { localStorage.clear(); const t = window.__game.scene.getScene('Title'); const s = window.__newGameForTests(); s.tut = tut; t.scene.start('Game', { state: s }); }, tut);
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
}
/** a lived-in studio: a production running, two shows airing, some netizen posts, a KPI warning level */
async function liveIn(page) {
  await page.evaluate(() => {
    const { sim, scene } = window.__sinetron;
    const s = sim.s;
    s.money = 400e6; s.fans = 30000; s.platforms.push('nasional'); s.studio = 2; scene.buildStudio();
    for (let k = 0; k < 2; k++) {
      const m = s.staff.find((x) => x.role === 'aktor'), f = s.staff.find((x) => x.role === 'aktris');
      sim.startProduction({ title: k ? 'Azab Juragan Pelit Tertimpa Kulkas' : 'Cinta Di Ujung Sajadah', genre: k ? 'azab' : 'romansa', theme: k ? 'kampung' : 'sekolah', platform: k ? 'nasional' : 'lokal', eps: k ? 13 : 52, budget: 'standar', leadM: m.id, leadF: f.id });
      let g = 0; while (s.prod && g++ < 2000) { sim.tick(); while (s.queue.length) { const p = sim.shift(); if (p.kind === 'editDone') sim.release(); else if (p.kind === 'event') sim.resolveEvent(p, 0); } }
      for (let w = 0; w < 8; w++) { sim.tick(); while (s.queue.length) { const p = sim.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); } }
    }
    const m = s.staff.find((x) => x.role === 'aktor'), f = s.staff.find((x) => x.role === 'aktris');
    sim.startProduction({ title: 'Kuntilanak Kos Putri', genre: 'horor', theme: 'kampus', platform: 'nasional', eps: 13, budget: 'standar', leadM: m.id, leadF: f.id });
    for (let i = 0; i < 12; i++) sim.tick();
    s.queue = []; s.kpi = 42; s.boikot = 38;
    scene.syncStaff(); scene.refreshHud(); scene.refreshStatus(true);
  });
  await page.waitForTimeout(1500);
}
const info = (page) => page.evaluate(() => { const g = window.__game; const c = g.canvas.getBoundingClientRect(); return { gw: g.scale.gameSize.width, gh: g.scale.gameSize.height, zoom: g.registry.get('zoom'), css: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)], vw: innerWidth, vh: innerHeight }; });
const closeAll = (page) => page.evaluate(() => { const sc = window.__sinetron.scene; sc.s.queue = []; while (sc.modals.length) sc.modals[sc.modals.length - 1].close(); });
for (const [w, h, dpr] of SIZES) {
  if (ONLY && !ONLY.includes(`${w}x${h}`)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${w}] [${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${w}] [pageerror] ${e.message}`));
  await boot(page);
  const I = await info(page);
  const cx = I.css[0] + I.css[2] / 2, cy = I.css[1] + I.css[3] / 2;
  ok(Math.abs(cx - w / 2) <= 1 && Math.abs(cy - h / 2) <= 1, `${w}x${h} canvas centred ${JSON.stringify(I)}`);
  const credit = await page.evaluate(() => { const t = window.__game.scene.getScene('Title').children.getByName('creditKK'); return t ? t.text : null; });
  ok(credit === 'by KodeKecil', `${w}x${h} title credit`);
  // v5.1 readability: CSS px per logical px (10 px text renders at 10 * scale CSS px)
  const scale = I.css[3] / (I.gh / I.zoom);
  ok(w < 700 && h > w ? true : scale >= 1.0 || h >= 640, `${w}x${h} text scale ${scale.toFixed(2)} css px / logical px (logical ${Math.round(I.gw / I.zoom)}x${Math.round(I.gh / I.zoom)})`);
  if (h < 640) ok(scale >= 1.15, `${w}x${h} short window keeps text readable: 10px -> ${(10 * scale).toFixed(1)}px, 9px -> ${(9 * scale).toFixed(1)}px`);
  // every title button on screen
  const tb = await page.evaluate(() => { const t = window.__game.scene.getScene('Title'); const H = window.__game.scale.gameSize.height / window.__game.registry.get('zoom'); return t.children.list.filter((o) => (o.name ?? '').startsWith('title_')).map((o) => { const b = o.getBounds(); return [o.name, Math.round(b.y), Math.round(b.bottom), b.bottom <= H + 1 && b.y >= -1]; }); });
  ok(tb.length >= 4 && tb.every((x) => x[3]), `${w}x${h} title buttons on screen ${JSON.stringify(tb.map((x) => x[0] + ':' + x[1] + '-' + x[2]))}`);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-title-${w}x${h}.png`) });
  await startGame(page);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-game-${w}x${h}.png`) });
  await liveIn(page);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-live-${w}x${h}.png`) });
  // pause + drain the pending popups first, so nothing pops up behind the menu while the test runs
  await page.evaluate(() => { const { scene } = window.__sinetron; scene.setSpeed(0); scene.s.queue = []; while (scene.modals.length) scene.modals.at(-1).close(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const { scene, screens } = window.__sinetron; scene.s.queue = []; screens.openMenu(scene); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-menu-${w}x${h}.png`) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__sinetron.scene.modals.length === 0), `${w}x${h} Esc closes the menu`);
  // v5.1: a tall dialog (production wizard 540) on this window: fits, or scrolls with the wheel / drag; a toast while
  // it is open never overlaps it
  {
    await page.evaluate(() => { const { scene, screens } = window.__sinetron; scene.s.queue = []; screens.openProduction(scene); });
    await page.waitForTimeout(500);
    const m0 = await page.evaluate(() => { const m = window.__sinetron.scene.modals.at(-1); return { y: m.y, h: m.h, max: m.maxScroll, gh: window.__game.scale.gameSize.height / window.__game.registry.get('zoom') }; });
    ok(m0.max > 0 || (m0.y - 12 >= 0 && m0.y + m0.h <= m0.gh), `${w}x${h} wizard dialog fits or scrolls ${JSON.stringify(m0)}`);
    if (m0.max > 0) {
      await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, 400); await page.waitForTimeout(250);
      const sc1 = await page.evaluate(() => window.__sinetron.scene.modals.at(-1).scroll);
      ok(sc1 > 0, `${w}x${h} wheel scrolls the dialog (${sc1}/${m0.max})`);
      await page.screenshot({ path: path.join(SHOTS, `${PRE}-wizard-scrolled-${w}x${h}.png`) });
      await page.mouse.move(w / 2, h / 2); await page.mouse.down(); await page.mouse.move(w / 2, h / 2 + 120, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(250);
      const sc2 = await page.evaluate(() => window.__sinetron.scene.modals.at(-1).scroll);
      ok(sc2 < sc1, `${w}x${h} drag scrolls the dialog back (${sc1} -> ${sc2}), modals ${await page.evaluate(() => window.__sinetron.scene.modals.length)}`);
    }
    await page.evaluate(() => window.__sinetron.scene.toast('Tes toast: nggak boleh nutupin dialog ya!'));
    await page.waitForTimeout(700);
    const ov = await page.evaluate(() => { const sc = window.__sinetron.scene; const r = sc.modals.at(-1).rect(); const t = sc.children.list.filter((o) => o.name === 'toast' && o.visible); return { n: t.length, hit: t.some((o) => { const b = o.getBounds(); return b.right > r.x0 && b.x < r.x1 && b.bottom > r.y0 && b.y < r.y1; }), q: sc.toastQ.length }; });
    ok(!ov.hit, `${w}x${h} toast with a dialog open does not overlap it ${JSON.stringify(ov)}`);
    await page.screenshot({ path: path.join(SHOTS, `${PRE}-wizard-toast-${w}x${h}.png`) });
    await closeAll(page); await page.waitForTimeout(2600);
  }
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  const sp = await page.evaluate(() => window.__sinetron.scene.speedIdx);
  ok(sp === 1, `${w}x${h} Space toggles pause (speed ${sp})`);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  if (w >= 700) {
    const z0 = await page.evaluate(() => window.__sinetron.scene.wz);
    for (let k = 0; k < 6; k++) { await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, -200); await page.waitForTimeout(120); }
    await page.waitForTimeout(300);
    const z1 = await page.evaluate(() => window.__sinetron.scene.wz);
    ok(z1 > z0, `${w}x${h} wheel zooms the studio ${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
    // pan: horizontal and / or vertical (a short window's fit is height-limited, so it may only pan up / down)
    const pos = () => page.evaluate(() => [window.__sinetron.scene.wcx, window.__sinetron.scene.wcy]);
    const c0 = await pos();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
    const c1 = await pos();
    ok(c1[0] !== c0[0] || c1[1] !== c0[1], `${w}x${h} arrow keys pan ${c0.map((v) => v.toFixed(0))} -> ${c1.map((v) => v.toFixed(0))}`);
    // drag pan
    await page.mouse.move(w / 2, h / 2); await page.mouse.down(); await page.mouse.move(w / 2 - 80, h / 2 + 50, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(300);
    const c2 = await pos();
    ok(Math.abs(c2[0] - c1[0]) + Math.abs(c2[1] - c1[1]) > 5, `${w}x${h} drag pans ${c1.map((v) => v.toFixed(0))} -> ${c2.map((v) => v.toFixed(0))}`);
    await page.screenshot({ path: path.join(SHOTS, `${PRE}-zoomed-${w}x${h}.png`) });
    await page.evaluate(() => { const sc = window.__sinetron.scene; sc.wz = 1; sc.zoomAt(1, sc.vcx(), 300); });
  }
  // the rating screen (full-screen show) and the netizen feed on this size
  await page.evaluate(() => { const { scene, screens } = window.__sinetron; const sh = scene.s.shows[scene.s.shows.length - 1]; screens.showRating(scene, sh, () => {}, true); });
  await page.waitForTimeout(6500);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-rating-${w}x${h}.png`) });
  await closeAll(page);
  await page.evaluate(() => { const { scene, screens5 } = window.__sinetron; screens5.openFeed(scene); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-feed-${w}x${h}.png`) });
  await closeAll(page);
  await ctx.close();
}
// live resize: phone portrait -> landscape window mid-game, with a dialog open, then back
if (!ONLY || ONLY.includes('resize')) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[resize] [${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[resize] [pageerror] ${e.message}`));
  await boot(page);
  await startGame(page);
  await liveIn(page);
  const before = await page.evaluate(() => ({ week: window.__sinetron.sim.s.absWeek, money: window.__sinetron.sim.s.money, shows: window.__sinetron.sim.s.shows.length, prod: !!window.__sinetron.sim.s.prod }));
  await page.evaluate(() => { const { scene, screens } = window.__sinetron; scene.setSpeed(0); screens.openStaff(scene); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-resize-0-portrait.png`) });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(1500);
  const I = await info(page);
  ok(I.gw > 360 * I.zoom, `resize -> landscape widened ${JSON.stringify(I)}`);
  const after = await page.evaluate(() => ({ week: window.__sinetron.sim.s.absWeek, money: window.__sinetron.sim.s.money, shows: window.__sinetron.sim.s.shows.length, prod: !!window.__sinetron.sim.s.prod, modals: window.__sinetron.scene.modals.length, game: window.__game.scene.isActive('Game'), modalX: window.__sinetron.scene.modals[0]?.root.x }));
  ok(after.game && after.modals === 1 && after.shows === before.shows && after.prod === before.prod && after.week === before.week, `state kept across resize ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-resize-1-landscape-dialog.png`) });
  await closeAll(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-resize-2-landscape.png`) });
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(1500);
  const I2 = await info(page);
  ok(Math.round(I2.gw / I2.zoom) === 360, `resize back -> portrait 360 ${JSON.stringify(I2)}`);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-resize-3-portrait.png`) });
  // v5.1: into a short window with a dialog open, then back
  await page.evaluate(() => { const { scene, screens } = window.__sinetron; screens.openStaff(scene); });
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.waitForTimeout(1500);
  const I3 = await info(page);
  const st3 = await page.evaluate(() => { const m = window.__sinetron.scene.modals.at(-1); return { modals: window.__sinetron.scene.modals.length, y: m?.y, max: m?.maxScroll, gh: window.__game.scale.gameSize.height / window.__game.registry.get('zoom') }; });
  ok(Math.round(I3.gh / I3.zoom) < 640 && st3.modals === 1 && st3.y >= 0, `resize -> short 1366x600: logical height ${Math.round(I3.gh / I3.zoom)}, dialog kept ${JSON.stringify(st3)}`);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-resize-5-short-dialog.png`) });
  await closeAll(page);
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__sinetron.scene.scene.start('Title'));
  await page.waitForTimeout(1200);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, `${PRE}-resize-4-title-landscape.png`) });
  await ctx.close();
}
console.log('errors/warnings:', errors.length); errors.slice(0, 15).forEach((e) => console.log('  ', e.slice(0, 300)));
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); server.close();
process.exit(errors.length || fails ? 1 : 0);
