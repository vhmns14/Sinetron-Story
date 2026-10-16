// End-to-end smoke test: serves a build dir, plays through with clicks + debug hooks, takes screenshots.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadHeaders, headersFor } from './serve.mjs';
/** Phaser makes new buttons hittable on its next input update: on a slow (software-GL, loaded) machine a click right
 *  after a dialog opens can arrive before that frame. Wait for two game frames first. */
const frames = (p, n = 2) => p.evaluate((n) => new Promise((res) => { const g = window.__game; const f0 = g.loop.frame; const t0 = performance.now(); const chk = () => (g.loop.frame - f0 >= n || performance.now() - t0 > 5000 ? res() : setTimeout(chk, 16)); chk(); }), n);

const ROOT = path.resolve(process.argv[2] ?? 'dist');
const SHOTS = path.resolve(process.argv[3] ?? '../shots');
const MODE = process.argv[4] ?? '';
const SINGLE = MODE === 'single' || MODE === 'preview';
const HTML = MODE === 'preview' ? 'sinetron-story-preview.html' : 'sinetron-story-single.html';
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const RULES = loadHeaders(ROOT);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.endsWith('/')) p += SINGLE ? HTML : 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  // v5.1: the dist build is served with its real _headers (CSP etc.); HSTS dropped for plain http
  const hh = SINGLE ? {} : headersFor(RULES, (req.url ?? '/').split('?')[0]); delete hh['Strict-Transport-Security'];
  res.writeHead(200, { ...hh, 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = SINGLE ? 'file://' + path.join(ROOT, HTML) : `http://localhost:${port}/`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: false });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
const log = (...a) => console.log('>', ...a);

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
await page.waitForTimeout(800);

async function box() { return page.locator('canvas').boundingBox(); }
async function tap(x, y, wait = 350) {
  await frames(page);
  const b = await box();
  const s = b.width / 360;
  await page.mouse.click(b.x + x * s, b.y + y * s);
  await page.waitForTimeout(wait);
}
/** v5: click a named canvas object (buttons moved / bar has 6 buttons now) */
async function tapName(name, wait = 350, sceneKey) {
  await frames(page);
  const r = await page.evaluate(([name, sceneKey]) => {
    const sc = window.__game.scene.getScene(sceneKey ?? (window.__game.scene.isActive('Game') ? 'Game' : 'Title'));
    let found = null;
    const walk = (list) => { for (const o of list) { if (o.name === name && o.visible !== false && o.active) found = o; if (o.list) walk(o.list); } };
    walk(sc.children.list);
    if (!found) return null;
    const b = found.getBounds(); const g = window.__game; const c = g.canvas.getBoundingClientRect();
    const s = c.width / (g.scale.gameSize.width / g.registry.get('zoom'));
    return { x: c.left + b.centerX * s, y: c.top + b.centerY * s };
  }, [name, sceneKey]);
  if (!r) { errors.push('[e2e] missing tap target ' + name); return; }
  await page.mouse.click(r.x, r.y); await page.waitForTimeout(wait);
}
async function shot(name) {
  const b = await box();
  await page.screenshot({ path: path.join(SHOTS, name), clip: b });
  log('shot', name);
}
const ev = (fn, arg) => page.evaluate(fn, arg);

const suffix = MODE === 'preview' ? '-preview' : SINGLE ? '-single' : '';
await shot(`01-title${suffix}.png`);
// Main Baru (no save => first button)
await tapName('title_main_baru', 900);
await shot(`02-welcome${suffix}.png`);
await tapName('tutNo', 600);
await page.waitForTimeout(2500);
await shot(`03-studio${suffix}.png`);

if (!SINGLE) {
  // Staff menu
  await tapName('btn_staf', 500);
  await shot('04-staf.png');
  await tap(328, 77, 400); // close X (modal x0=10,y0=62 -> X at 10+340-26+11, 62+4+10)
}

// Production wizard via UI
await tapName('btn_produksi', 500); // Produksi (5-button bar: Menu, Staf, Produksi, Peta, Studio)
await shot(`05-produksi-menu${suffix}.png`);
await tap(180, 210, 500);
await shot(`06-wizard-konsep${suffix}.png`);
await tap(240, 551, 500);
await shot(`07-wizard-platform${suffix}.png`);
await tap(240, 551, 500);
await shot(`08-wizard-cast${suffix}.png`);
await tap(240, 551, 800);
const started = await ev(() => !!window.__sinetron.sim.s.prod);
log('production started via UI:', started);
// speed 4x and watch work
await tap(196 + 3 * 40.5 + 19, 37, 200);
await page.waitForTimeout(3500);
await shot(`09-producing${suffix}.png`);

// fast-forward helper inside page
await page.evaluate(`
window.__ff = function (maxTicks, stopOn) {
  const { sim, scene } = window.__sinetron;
  const s = sim.s;
  for (let i = 0; i < maxTicks; i++) {
    while (s.queue.length) {
      const p = s.queue[0];
      if (stopOn.includes(p.kind)) return { stopped: p.kind, i };
      sim.shift();
      if (p.kind === 'event') sim.resolveEvent(p, 0);
      if (p.kind === 'editDone') sim.release();
      if (p.kind === 'gameover') return { stopped: 'gameover', i };
    }
    sim.tick();
  }
  scene.refreshHud();
  return { stopped: null, i: maxTicks };
};`);

async function playToRelease(tag) {
  const r = await ev(() => window.__ff(4000, ['release']));
  log('ff', tag, JSON.stringify(r));
  await page.waitForTimeout(1200);
  await shot(`10-rating-anim-${tag}${suffix}.png`);
  await page.waitForTimeout(5000);
  const info = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { title: sh.title, total: sh.total, scores: sh.scores, rating: sh.rating, compat: sh.compat, hof: sh.hof, money: s.money, fans: s.fans }; });
  log('release', tag, JSON.stringify(info));
  await shot(`11-rating-${tag}${suffix}.png`);
  await tap(180, 602, 800); // Lanjut
  return info;
}

const r1 = await playToRelease('1');

// second production: scripted start with a known-great combo, from the debug hook (keeps UI path tested above)
const err2 = await ev(() => {
  const { sim, scene } = window.__sinetron;
  const s = sim.s;
  const m = s.staff.find((x) => x.role === 'aktor'); const f = s.staff.find((x) => x.role === 'aktris');
  const genre = s.shows[0].genre === 'azab' ? 'keluarga' : 'azab';
  const e = sim.startProduction({ title: 'Azab Juragan Empang Pelit', genre, theme: 'kampung', platform: 'lokal', eps: 13, budget: 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null });
  scene.refreshHud();
  return e;
});
log('prod2 start err:', err2);
await page.waitForTimeout(1500);
const r2 = await playToRelease('2');

// event modal screenshot: force an event
await ev(() => { const { sim } = window.__sinetron; sim.push({ kind: 'event', eventId: 'gaji', data: { staffId: sim.s.staff[2].id, amount: 300000 } }); });
await page.waitForTimeout(900);
await shot(`12-event${suffix}.png`);
await tap(107, 390, 500); // first choice ("Naikin deh")
await shot(`13-event-result${suffix}.png`);
await tap(180, 390, 600);

// ================================================================ v3: Peta, Perang Rating, Selebgram
const V3 = {};
const v3shot = (n) => shot(`v3-${n}${suffix}.png`);
// close whatever popup is up and consume the queue (events -> first choice)
async function drain() {
  for (let k = 0; k < 8; k++) {
    const open = await ev(() => window.__sinetron.scene.modals.length + window.__sinetron.sim.s.queue.length);
    if (!open) break;
    await ev(() => { const g = window.__sinetron.scene; g.toastQ.length = 0; while (g.modals.length) g.modals[g.modals.length - 1].close(); const q = g.s.queue[0]; if (q) { g.sim.shift(); if (q.kind === 'event') g.sim.resolveEvent(q, 0); if (q.kind === 'editDone') g.sim.release(); } });
    await page.waitForTimeout(150);
  }
  await ev(() => { const g = window.__sinetron.scene; g.toastQ.length = 0; g.setSpeed(0); });
  await page.waitForTimeout(2300); // let a visible toast fade
}
await drain();
await v3shot('01-studio-peta');
// --- Peta from the bottom bar
await tapName('btn_peta', 600);
V3.mapOpen = await ev(() => window.__sinetron.scene.modals.length === 1);
await v3shot('02-map');
await tap(180, 317, 400); // chip "Pasar"
await v3shot('02b-map-pasar');
await tap(337, 40, 400); // close
await drain();
// --- wizard step 2: pick a location through the map (select mode)
await tapName('btn_produksi', 500); await tap(180, 210, 500); await tap(240, 551, 500);
await tap(229, 260, 600); // "Lokasi Syuting" button -> map
await tap(180, 317, 700); // Pasar
for (let k = 0; k < 3 && (await ev(() => window.__sinetron.scene.modals.length)) > 1; k++) await tap(236, 560, 700); // Pilih
await v3shot('03-wizard-lokasi');
V3.wizardLoc = await ev(() => window.__sinetron.scene.modals.length === 1);
await tap(337, 70, 400); // close wizard
await drain();
// --- location shoot (scripted start keeps the test deterministic)
V3.locStart = await ev(() => {
  const { sim, scene } = window.__sinetron; const s = sim.s;
  s.job = null; if (s.money < 60e6) s.money = 60e6; // v4 economy: a location shoot needs some savings
  const m = s.staff.find((x) => x.role === 'aktor'); const f = s.staff.find((x) => x.role === 'aktris');
  const e = sim.startProduction({ title: 'Juragan Cilok Jatuh Cinta', genre: 'komedi', theme: 'kampung', platform: 'lokal', eps: 13, budget: 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null, location: 'pasar' });
  scene.refreshHud();
  return e;
});
await ev(() => { const { sim } = window.__sinetron; const s = sim.s; for (let i = 0; i < 3000 && s.prod && s.prod.phase !== 'syuting'; i++) { while (s.queue.length) { const p = s.queue[0]; sim.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); } sim.tick(); } window.__sinetron.scene.refreshHud(); });
await page.waitForTimeout(600);
if (await ev(() => window.__sinetron.scene.modals.length)) await v3shot('04c-lokasi-event');
await drain();
await page.waitForTimeout(2000);
V3.away = await ev(() => { const { sim, scene } = window.__sinetron; return sim.s.staff.filter((x) => sim.onLocation(x)).map((x) => !scene.sprites.get(x.id).img.visible); });
await v3shot('04-syuting-lokasi');
await drain();
await tapName('btn_peta', 600); // Peta during the trip
await v3shot('04b-map-during-trip');
await tap(337, 40, 400);
await drain();
const rl = await ev(() => window.__ff(4000, ['release']));
await page.waitForTimeout(7500);
V3.locShow = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { loc: sh.location, matches: sh.locMatches, known: s.locCombos.pasar, total: sh.total }; });
await tap(180, 602, 800);
// --- weekly rating chart
await drain();
await ev(() => window.__ff(8 * 3, ['release', 'award']));
await drain();
await tapName('btn_menu', 400); await tapName('menu_tangga_rating', 700); // Menu > Tangga Rating
V3.chart = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { hist: sh.hist, ranks: sh.ranks, rivals: s.rivals.length, modal: window.__sinetron.scene.modals.length }; });
await v3shot('05-rating-chart');
await tap(337, 64, 400);
// helper: start + release a show right away (debug), returns show id
async function quickShow(title, eps) {
  return ev(({ title, eps }) => {
    const { sim } = window.__sinetron; const s = sim.s;
    s.queue = [];
    for (const sh of s.shows) if (sh.weeksAired < sh.airWeeks) { sh.airWeeks = sh.weeksAired; }
    const m = s.staff.find((x) => x.role === 'aktor'); const f = s.staff.find((x) => x.role === 'aktris');
    s.job = null; s.prod = null;
    if (s.money < 80e6) s.money = 80e6;
    const err = sim.startProduction({ title, genre: 'keluarga', theme: 'kota', platform: 'lokal', eps, budget: 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null });
    if (err) throw new Error('quickShow: ' + err);
    for (let i = 0; i < 4000 && s.prod; i++) { while (s.queue.length) { const p = s.queue[0]; sim.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); if (p.kind === 'editDone') sim.release(); } if (s.prod) sim.tick(); }
    s.queue = s.queue.filter((p) => p.kind !== 'release');
    const sh = s.shows[s.shows.length - 1]; sh.hof = false; // HoF shows are immune; this test needs a mortal one
    return sh.id;
  }, { title, eps });
}
async function ffUntilRating(type) {
  return ev((type) => {
    const { sim, scene } = window.__sinetron; const s = sim.s;
    for (let i = 0; i < 8 * 20; i++) {
      while (s.queue.length) { const p = s.queue[0]; if (p.kind === 'rating' && p.type === type) { scene.refreshHud(); return { ok: true, i }; } sim.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); if (p.kind === 'editDone') sim.release(); }
      sim.tick();
    }
    return { ok: false };
  }, type);
}
// --- cancel path: rivals x5 -> warning, then "Distop stasiun TV!"
await drain();
const cId = await quickShow('Mertua Galak Pindah Apartemen', 26);
await ev(() => window.__sinetron.sim.debugRivals(5));
V3.warn = await ffUntilRating('warn');
await page.waitForTimeout(900);
await v3shot('06-warn');
await tap(180, 185 + 232, 500); // "Biarin dulu" (modal y0 = 185)
V3.cancel = await ffUntilRating('cancel');
await page.waitForTimeout(1600);
await v3shot('07-distop');
await tap(180, 431, 700);
V3.cancelled = await ev((id) => { const sh = window.__sinetron.sim.s.shows.find((x) => x.id === id); return { cancelled: sh.cancelled, aired: sh.weeksAired, air: sh.airWeeks, revWeeks: sh.revWeeks }; }, cId);
// --- #1 path: rivals x0.05 -> 3 weeks at #1 -> bonus + fanfare
await drain();
const tId = await quickShow('Cinta Abang Ojol', 26);
await ev(() => window.__sinetron.sim.debugRivals(0.05));
const before1 = await ev(() => ({ money: window.__sinetron.sim.s.money, fans: window.__sinetron.sim.s.fans }));
V3.top = await ffUntilRating('top');
await page.waitForTimeout(1200);
await v3shot('08-puncak-rating');
await tap(253, 429, 600); // Mantap!
V3.topMoney = await ev((b) => ({ dMoney: window.__sinetron.sim.s.money - b.money, dFans: window.__sinetron.sim.s.fans - b.fans }), before1);
// promo + extension while #1
V3.actions = await ev((id) => { const { sim } = window.__sinetron; const sh = sim.s.shows.find((x) => x.id === id); sim.s.money += 200e6; const a = sim.promo(sh); const w0 = sh.airWeeks; const b = sim.extend(sh); return { promoErr: a, extErr: b, boostWeeks: sh.boostWeeks, airWeeksBefore: w0, airWeeksAfter: sh.airWeeks, eps: sh.eps }; }, tId);
await drain();
await ev(() => window.__ff(8 * 2, ['award']));
await drain();
await ev((id) => { const g = window.__sinetron; g.screens3.openRatingChart(g.scene, 'lokal', id); }, tId);
await page.waitForTimeout(500);
await v3shot('09-rating-chart-top');
await tap(337, 64, 400);
await ev(() => window.__sinetron.sim.debugRivals(1));
// --- Selebgram + Dibajak
await drain();
V3.seleb = await ev(() => {
  const { sim, scene } = window.__sinetron; const s = sim.s;
  const f = s.staff.find((x) => x.role === 'aktris'); const mm = s.staff.find((x) => x.role === 'aktor');
  sim.debugFollowers(f.id, 1250000); if (mm) sim.debugFollowers(mm.id, 154000);
  scene.refreshHud();
  return { f: f.id, idx: s.staff.indexOf(f) };
});
await tapName('btn_staf', 500);
await v3shot('10-staff-selebgram');
if (V3.seleb.idx < 5) { await tap(180, 62 + 38 + V3.seleb.idx * 70 + 33, 600); await v3shot('11-staff-detail'); await tap(180, 70 + 445, 500); }
await tap(328, 77, 400);
// a famous freelancer in the hire pool
await ev(() => { const s = window.__sinetron.sim.s; const c = s.candidates[s.candidates.length - 1]; if (c) { c.role = 'aktris'; c.look.female = true; c.name = 'Neng Bunga Citra'; c.star = true; c.followers = 820000; c.salary = 9_500_000; } });
await tapName('btn_staf', 500); await tap(88, 519, 600); // Staf > Rekrut Staf
await v3shot('12-recruit-star');
await tap(328, 77, 400);
// Dibajak: each choice
async function dibajak(role, choice, name) {
  await drain();
  const info = await ev((role) => { const { sim } = window.__sinetron; const s = sim.s; let st = s.staff.find((x) => x.role === role && x.followers >= 50000) ?? s.staff.find((x) => x.role === role); if (!st) return null; st.followers = Math.max(st.followers, 120000); sim.push(sim.dibajakEvent(st)); return { id: st.id, salary: st.salary, n: s.staff.length, loyalty: st.loyalty }; }, role);
  if (!info) return { skipped: true };
  await page.waitForTimeout(900);
  if (name) await v3shot(name);
  await tap(180, [331, 379, 427][choice], 600);
  if (name) await v3shot(name + '-hasil');
  await tap(180, 430, 600);
  const after = await ev((id) => { const s = window.__sinetron.sim.s; const st = s.staff.find((x) => x.id === id); return { here: !!st, salary: st ? st.salary : null, n: s.staff.length, sprite: !!window.__sinetron.scene.sprites.get(id) }; }, info.id);
  return { before: info, after };
}
V3.dibajak0 = await dibajak('aktris', 0, '13-dibajak');
V3.dibajak2 = await dibajak('aktris', 2, null);
V3.dibajak1 = await dibajak('aktor', 1, null);
V3.endorse = await ev(() => { const { sim } = window.__sinetron; const s = sim.s; const st = s.staff.find((x) => x.followers >= 30000); if (!st) return null; const m0 = s.money; const r = sim.resolveEvent({ eventId: 'endorse', data: { staffId: st.id, pay: 10_000_000 } }, 0); return { r, got: s.money - m0 }; });
const okv3 = V3.mapOpen && V3.wizardLoc && !V3.locStart && V3.away.length > 0 && V3.away.every(Boolean) && V3.locShow.loc === 'pasar' && V3.locShow.matches.includes('komedi') && V3.chart.hist.length > 0 && V3.warn.ok && V3.cancel.ok && V3.cancelled.cancelled && V3.top.ok && V3.topMoney.dMoney > 0 && !V3.actions.promoErr && !V3.actions.extErr && V3.dibajak0.after.here && V3.dibajak0.after.salary > V3.dibajak0.before.salary && (V3.dibajak1.skipped || (!V3.dibajak1.after.here && !V3.dibajak1.after.sprite));
log('V3', JSON.stringify(V3));
log('V3 OK:', okv3);
await drain();

// ================================================================ v4: plot twist, OST, Ramadan, spin-off, economy sinks
const V4 = {};
await ev(() => { const g = window.__sinetron.scene; window.__toasts = []; const t = g.toast.bind(g); g.toast = (x) => { window.__toasts.push(x); t(x); }; });
const v4shot = (n) => shot(`v4-e2e-${n}${suffix}.png`);
await drain();
await ev(() => window.__sinetron.sim.debugRivals(1));
// a hit that just finished airing -> eligible for a sequel
V4.setup = await ev(() => {
  const { sim, scene } = window.__sinetron; const s = sim.s;
  s.queue = []; s.money = Math.max(s.money, 400e6); s.fans = Math.max(s.fans, 30000); s.job = null; s.prod = null;
  for (const sh of s.shows) if (sh.weeksAired < sh.airWeeks) sh.airWeeks = sh.weeksAired;
  const sh = s.shows[s.shows.length - 1]; sh.total = Math.max(sh.total, 33); sh.hof = true; sh.cancelled = false;
  scene.refreshHud();
  return { eligible: sim.spinoffCandidates().map((x) => x.id), id: sh.id };
});
// wizard: Sekuel via the picker, OST via the picker, then MULAI
const modals = () => ev(() => window.__sinetron.scene.modals.length);
const waitModals = (n) => page.waitForFunction((n) => window.__sinetron.scene.modals.length === n, n, { timeout: 5000 }).catch(() => log('waitModals timeout', n));
await tapName('btn_produksi', 500); await waitModals(1); await tap(180, 210, 600); await waitModals(1);
for (let k = 0; k < 3 && (await modals()) < 2; k++) await tap(172, 56 + 426 + 13, 700); // Sekuel / Spin-off button
await v4shot('01-spinoff-picker');
for (let k = 0; k < 3 && (await modals()) > 1; k++) await tap(8 + 204 + 62, 56 + 56 + 6 + 12, 700); // first hit: "Sekuel (sama)"
V4.titleSeq = await modals();
await tap(240, 56 + 470 + 25, 600); // Lanjut -> step 2
for (let k = 0; k < 3 && (await modals()) < 2; k++) await tap(8 + 108 + 113, 56 + 222 + 12, 700); // OST
await v4shot('02-ost-picker');
for (let k = 0; k < 3 && (await modals()) > 1; k++) await tap(180, 22 + 36 + 0 * 53 + 25, 700); // first singer
await tap(240, 56 + 470 + 25, 700); // Lanjut -> step 3
await v4shot('02b-wizard-cast');
for (let k = 0; k < 3 && !(await ev(() => !!window.__sinetron.sim.s.prod)); k++) await tap(240, 56 + 470 + 25, 900); // MULAI
V4.toasts = await ev(() => window.__toasts.slice(-4));
V4.prod = await ev(() => { const p = window.__sinetron.sim.s.prod; return p ? { title: p.title, ost: p.ost, parent: p.parentId, spin: p.spin, honor: p.honor } : null; });
await ev(() => window.__ff(4000, ['release']));
await page.waitForTimeout(7600);
await v4shot('03-rating-sekuel');
V4.seq = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { title: sh.title, part: sh.part, fanBase: sh.fanBase, ost: !!sh.ost }; });
await tap(180, 602, 800);
await drain();
await ev(() => window.__ff(8 * 2, ['award']));
await drain();
V4.seqState = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; const st = { aired: sh.weeksAired, air: sh.airWeeks, cancelled: sh.cancelled, hist: sh.hist.length, week: s.absWeek, rel: sh.releaseWeek, over: s.gameOver };
  // keep the twist test about twists: make sure the sequel is on air (random events can't end it, but a test-time jump might)
  if (sh.cancelled || sh.weeksAired >= sh.airWeeks || !sh.hist.length) { sh.cancelled = false; sh.airWeeks = sh.weeksAired + 6; if (!sh.hist.length) { sh.hist.push(sh.rating); sh.ranks.push(2); sh.rivalHist.push(sh.rating); } }
  return st; });
// plot twist from the Tangga Rating panel
await tapName('btn_menu', 400); await tapName('menu_tangga_rating', 700); // Menu > Tangga Rating
V4.twistBtn = await ev(() => { const { sim } = window.__sinetron; const s = sim.s; const sh = s.shows[s.shows.length - 1]; return sim.canTwist(sh); });
await ev(() => { const g = window.__sinetron; const s = g.sim.s; const sh = s.shows[s.shows.length - 1]; while (g.scene.modals.length) g.scene.modals[g.scene.modals.length - 1].close(); g.screens4.openTwistPicker(g.scene, sh); });
await page.waitForTimeout(400);
await v4shot('04-twist-picker');
await tap(8 + 10 + 80, 34 + 54 + 40, 1500); // first card (Zoom-in 3x)
await v4shot('05-twist-popup');
V4.twist = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { twists: sh.twists.slice(), tBoost: sh.tBoost, cd: sh.twistCd, modals: window.__sinetron.scene.modals.length }; });
await drain();
// overuse -> netizen muak + critics mock the next review
V4.muak = await ev(() => { const { sim } = window.__sinetron; const s = sim.s; const sh = s.shows[s.shows.length - 1]; const out = []; for (let i = 0; i < 3; i++) { sh.twistCd = 0; const r = sim.playTwist(sh, 'zoom'); out.push(typeof r === 'string' ? r : r.muak); } return { out, muak: sh.muak, mock: s.twistMock }; });
// kampanye akbar (needs studio Lv2)
V4.camp = await ev(() => { const { sim, scene } = window.__sinetron; const s = sim.s; if (s.studio < 2) { s.studio = 2; scene.buildStudio(); } const sh = s.shows[s.shows.length - 1]; sh.boostWeeks = 0; sh.airWeeks = Math.max(sh.airWeeks, sh.weeksAired + 5); const m0 = s.money; const e = sim.campaign(sh); return { err: e, cost: m0 - s.money, boost: sh.boost, kind: sh.promoKind }; });
// Ramadan: 8 weeks before -> slot bookable for Religi, banner in HUD during Ramadan
V4.ramadan = await ev(() => {
  const { sim, scene } = window.__sinetron; const s = sim.s;
  s.absWeek += sim.weeksToRamadan() - 8;
  const before = { slotReligi: sim.canRamadanSlot('religi'), slotKomedi: sim.canRamadanSlot('komedi') };
  s.absWeek += 8; scene.refreshHud(); scene.refreshStatus(true);
  return { ...before, now: sim.isRamadan(), slotNow: sim.canRamadanSlot('religi') };
});
await page.waitForTimeout(400);
await v4shot('06-ramadan-banner');
// economy sinks: equipment, star contract, finance screen
V4.sinks = await ev(() => {
  const { sim, scene } = window.__sinetron; const s = sim.s;
  s.money += 8e9; s.fans = Math.max(s.fans, 200000);
  const eq = sim.buyEquip('kamera');
  sim.refreshStarOffers();
  if (s.staff.length >= sim.maxStaff()) { s.studio = Math.max(s.studio, 3); scene.buildStudio(); }
  const n0 = s.staff.length; const star = s.starOffers[0]; const se = sim.signStar(star);
  scene.rebuildAfterStaffChange();
  const up = []; while (s.studio < 5) { s.fans = Math.max(s.fans, 2e6); const e = sim.upgradeStudio(); if (e) { up.push(e); break; } up.push(s.studio); }
  scene.buildStudio();
  return { eq, equipment: s.equipment.slice(), se, staffAdded: s.staff.length - n0, studio: s.studio, up, costs: sim.monthlyCosts() };
});
await ev(() => { const g = window.__sinetron; g.screens4.openFinance(g.scene); });
await page.waitForTimeout(400);
await v4shot('07-keuangan');
await drain();
await page.waitForTimeout(800);
await v4shot('08-istana-sinetron');
const okv4 = V4.setup.eligible.length > 0 && V4.prod && V4.prod.parent != null && V4.prod.ost && V4.seq.part >= 2 && V4.twist.twists.length === 1 && V4.twist.tBoost > 0 && V4.muak.muak > 0 && V4.muak.mock === 'zoom' && !V4.camp.err && V4.camp.cost > 0 && V4.ramadan.slotReligi === null && V4.ramadan.slotKomedi && V4.ramadan.now && V4.sinks.equipment.includes('kamera') && !V4.sinks.se && V4.sinks.staffAdded === 1 && V4.sinks.studio === 5;
log('V4', JSON.stringify(V4));
log('V4 OK:', okv4);
await ev(() => { const s = window.__sinetron.sim.s; s.absWeek = Math.ceil((s.absWeek + 1) / 48) * 48 - 2; });
await drain();
await ev(() => window.__sinetron.scene.setSpeed(1));

// award: fast forward to end of year
const r3 = await ev(() => window.__ff(48 * 8 * 2, ['award']));
log('ff to award', JSON.stringify(r3));
await page.waitForTimeout(3600);
await shot(`14-award${suffix}.png`);
await tap(180, 80 + 437, 700); // Lanjut (modal y0 = 80)

// studio + research screens
if (!SINGLE) {
  await tapName('btn_studio', 500);
  await shot('15-studio-menu.png');
  await tapName('studio_riset', 500); // Riset
  await shot('16-riset.png');
  await tap(328, 77, 400);
  // history
  await tapName('btn_menu', 400);
  await shot('17-menu.png');
  await tapName('menu_riwayat_sinetron', 500); // Riwayat
  await shot('18-riwayat.png');
  await tap(328, 77, 400);
}

// Save / reload test
const before = await ev(() => { const s = window.__sinetron.sim.s; window.__sinetron.scene.sim.s && localStorage; return { w: s.absWeek, shows: s.shows.length, money: s.money }; });
await ev(() => { const g = window.__sinetron; return g.scene.scene.isActive('Game'); });
await ev(() => {
  // store it as a pre-v3 save (no rivals / followers / rating history) to test the migration
  const { sim } = window.__sinetron; const o = JSON.parse(JSON.stringify(sim.s));
  delete o.rivals; delete o.rivalSeq; delete o.locCombos; delete o.rivalMult;
  for (const st of [...o.staff, ...o.candidates]) { delete st.followers; delete st.loyalty; delete st.star; }
  for (const sh of o.shows) for (const k of ['hist', 'ranks', 'rivalHist', 'lowStreak', 'topStreak', 'topBonuses', 'warned', 'cancelled', 'boost', 'boostWeeks', 'ext', 'decayShift', 'revWeeks', 'leads', 'location', 'locMatches']) delete sh[k];
  if (o.prod) for (const k of ['location', 'locCost', 'locEvent', 'locAnnounced', 'ost', 'ostFee', 'ramadan', 'ramadanPay', 'parentId', 'spin', 'honor']) delete o.prod[k];
  // ... and as a pre-v4 save (no economy / twist / OST / Ramadan / spin-off fields)
  for (const k of ['equipment', 'twistLog', 'twistMock', 'starOffers', 'starOfferWeek', 'ramadanSlotYear', 'ramadanNoticeYear', 'ledger']) delete o[k];
  for (const sh of o.shows) for (const k of ['twists', 'twistCd', 'tBoost', 'tWeeks', 'muak', 'ost', 'ramadan', 'parentId', 'franchise', 'part', 'spin', 'fanBase', 'promoKind']) delete sh[k];
  localStorage.setItem('sinetron-story-save-v1', JSON.stringify(o));
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
await page.waitForTimeout(800);
await shot(`19-title-continue${suffix}.png`);
await tapName('title_lanjutkan', 1200); // Lanjutkan
const after = await ev(() => { const s = window.__sinetron.sim.s; return { w: s.absWeek, shows: s.shows.length, money: s.money }; });
log('save/load', JSON.stringify(before), '->', JSON.stringify(after));
const mig = await ev(() => { const { sim } = window.__sinetron; const s = sim.s; for (let i = 0; i < 8 * 6; i++) { s.queue = []; sim.tick(); } return { rivals: s.rivals.length, followersOk: s.staff.every((x) => typeof x.followers === 'number'), showsOk: s.shows.every((x) => Array.isArray(x.hist)), v4: Array.isArray(s.equipment) && !!s.ledger && s.shows.every((x) => Array.isArray(x.twists) && x.part >= 1) && isFinite(s.money) }; });
log('migration', JSON.stringify(mig));

// longer soak at 4x in real time to catch runtime errors in sprite/modal code
await tap(196 + 3 * 40.5 + 19, 37, 200);
await ev(() => { const { sim } = window.__sinetron; if (!sim.s.prod && !sim.s.job && sim.s.jobOffers.length) sim.startJob(sim.s.jobOffers[0]); });
await page.waitForTimeout(6000);
await shot(`20-studio-later${suffix}.png`);
// close whatever popped up (events -> first choice, then OK) and look at the studio
for (let k = 0; k < 4; k++) {
  const open = await ev(() => window.__sinetron.scene.modals.length);
  if (!open) break;
  await ev(() => { const g = window.__sinetron.scene; const q = g.s.queue[0]; const m = g.modals[g.modals.length - 1]; m.close(); if (q) { g.sim.shift(); if (q.kind === 'event') g.sim.resolveEvent(q, 0); if (q.kind === 'editDone') g.sim.release(); } });
  await page.waitForTimeout(300);
}
await page.waitForTimeout(2500);
await shot(`21-studio-job${suffix}.png`);

let sw = null;
if (!SINGLE) {
  sw = await ev(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? { scope: r.scope, active: !!(r.active || r.installing || r.waiting) } : null; });
  const man = await ev(async () => { const l = document.querySelector('link[rel=manifest]'); if (!l) return null; const r = await fetch(l.href); return r.ok ? (await r.json()).name : null; });
  log('service worker:', JSON.stringify(sw), 'manifest:', man);
}

const filtered = errors.filter((e) => !/GPU stall|swiftshader|WebGL|GL Driver|Automatic fallback/i.test(e));
log('console errors/warnings:', filtered.length);
for (const e of filtered) console.log('   ', e.slice(0, 600));
log('ALL', JSON.stringify({ started, r1: r1.total, r2: r2.total, v3: okv3, v4: okv4, migration: mig.rivals === 15 && mig.followersOk && mig.showsOk && mig.v4, sw: !!sw, errors: filtered.length }));
await browser.close();
server.close();
