// Visual check screenshots for the v2 art pass: title, studio lv1 + lv3 with staff working,
// production wizard, producing, rating screen (good show + flop). Usage: node tools/shots-v2.mjs dist ../shots
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? 'dist');
const SHOTS = path.resolve(process.argv[3] ?? '../shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
const log = (...a) => console.log('>', ...a);
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
await page.waitForTimeout(1500);
const box = () => page.locator('canvas').boundingBox();
async function tap(x, y, wait = 350) { const b = await box(); const s = b.width / 360; await page.mouse.click(b.x + x * s, b.y + y * s); await page.waitForTimeout(wait); }
async function shot(name) { const b = await box(); await page.screenshot({ path: path.join(SHOTS, name), clip: b }); log('shot', name); }
const ev = (fn, arg) => page.evaluate(fn, arg);

await shot('v2-01-title.png');
await tap(180, 322, 900);   // Main Baru
await tap(180, 435, 600);   // close welcome
// hire a cameraman + extra staff so every room is busy
await ev(() => {
  const { sim, scene } = window.__sinetron;
  sim.s.money += 300_000_000;
  for (const c of [...sim.s.candidates]) { if (sim.s.staff.length < sim.maxStaff()) sim.hire(c); }
  scene.rebuildAfterStaffChange();
});
await tap(180, 606, 500);   // Produksi
await tap(180, 210, 500);   // Sinetron baru
await shot('v2-03-wizard-konsep.png');
await tap(240, 551, 500);
await shot('v2-04-wizard-platform.png');
await tap(240, 551, 500);
await shot('v2-05-wizard-cast.png');
await tap(240, 551, 800);   // Mulai
await page.waitForTimeout(3200);
await shot('v2-06-producing.png');
await page.evaluate(`
window.__toPhase = function (phase) {
  const { sim, scene } = window.__sinetron;
  for (let i = 0; i < 3000; i++) {
    for (const m of [...scene.modals]) m.close();
    while (sim.s.queue.length) { const q = sim.s.queue[0]; sim.shift(); if (q.kind === 'event') sim.resolveEvent(q, 0); if (q.kind === 'editDone') sim.release(); }
    if (phase === 'none' ? !sim.s.prod : (sim.s.prod && sim.s.prod.phase === phase)) break;
    sim.tick();
  }
  scene.refreshHud();
};`);
await ev(() => window.__toPhase('syuting'));
await page.waitForTimeout(8000);
await shot('v2-02-studio-lv1.png');
// level 3 studio with a bigger crew shooting the next show
await ev(() => {
  window.__toPhase('none');
  const { sim, scene } = window.__sinetron;
  for (const m of [...scene.modals]) m.close();
  sim.s.studio = 3;
  sim.s.money += 800_000_000;
});
await page.waitForTimeout(500);
await ev(() => {
  const { sim, scene } = window.__sinetron;
  for (const c of [...sim.s.candidates]) { if (sim.s.staff.length < sim.maxStaff()) sim.hire(c); }
  scene.rebuildAfterStaffChange();
  for (const st of sim.s.staff) st.energy = 100;
  const m = sim.s.staff.find((x) => x.role === 'aktor'); const f = sim.s.staff.find((x) => x.role === 'aktris');
  sim.startProduction({ title: 'Azab Juragan Empang', genre: 'azab', theme: 'kampung', platform: 'lokal', eps: 13, budget: 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null });
  window.__toPhase('syuting');
});
await page.waitForTimeout(8000);
await shot('v2-07-studio-lv3.png');
// rating screen: a great combo show (family cries) and a flop
await ev(() => {
  const { sim, scene, screens } = window.__sinetron;
  for (const m of [...scene.modals]) m.close();
  const base = sim.s.shows[sim.s.shows.length - 1] ?? {};
  const show = { ...base, id: 999, title: 'Air Mata Ibu Tiri di Ujung Sajadah', genre: 'keluarga', theme: 'kampung', platform: 'lokal', total: 35, scores: [9, 9, 8, 9], comments: ['Bikin nangis!', 'Ya Allah, sedih!', 'Kocak dikit', 'Gambarnya cakep'], rating: 38.6, compat: 'great', hof: true, fansGained: 12000, rp: 24, bloopers: 1, trendBonus: true, repeatPenalty: false, weeksAired: 0, airWeeks: 13 };
  screens.showRating(scene, show, () => {});
});
await page.waitForTimeout(1300);
await shot('v2-08-rating-anim.png');
await page.waitForTimeout(6500);
await shot('v2-09-rating-great.png');
await ev(() => { const { scene } = window.__sinetron; for (const m of [...scene.modals]) m.close(); });
for (const [mood, genre, total] of [['laugh', 'komedi', 33], ['shock', 'horor', 31], ['flop', 'romansa', 14]]) {
  await ev(([genre, total]) => {
    const { sim, scene, screens } = window.__sinetron;
    const base = sim.s.shows[sim.s.shows.length - 1] ?? {};
    const show = { ...base, id: 998, title: 'Tes ' + genre, genre, theme: 'kota', total, scores: [Math.round(total / 4), Math.round(total / 4), Math.round(total / 4), Math.round(total / 4)], comments: ['Hmm...', 'Lumayan', 'Oke', 'Biasa'], rating: total / 2, compat: total > 30 ? 'good' : 'bad', hof: false, fansGained: 100, rp: 3, bloopers: 5 };
    screens.showRating(scene, show, () => {}, true);
  }, [genre, total]);
  await page.waitForTimeout(7200);
  await shot(`v2-10-rating-${mood}.png`);
  await ev(() => { const { scene } = window.__sinetron; for (const m of [...scene.modals]) m.close(); });
}
const filtered = errors.filter((e) => !/GPU stall|swiftshader|WebGL|GL Driver|Automatic fallback/i.test(e));
log('console errors/warnings:', filtered.length);
for (const e of filtered) console.log('   ', e.slice(0, 400));
await browser.close();
server.close();
