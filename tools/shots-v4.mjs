// v4 visual check + feature smoke test: plot twist picker/popup, Ramadan banner, OST pick, spin-off option,
// rating chart actions, Peralatan, Agensi Bintang, Keuangan, premium studio, map with abroad pins.
// usage: node tools/shots-v4.mjs [dist|..] [../shots] [|single|preview]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? 'dist');
const SHOTS = path.resolve(process.argv[3] ?? '../shots');
const MODE = process.argv[4] ?? '';
const SINGLE = MODE === 'single' || MODE === 'preview';
const HTML = MODE === 'preview' ? 'sinetron-story-preview.html' : 'sinetron-story-single.html';
const SUF = MODE === 'preview' ? '-preview' : SINGLE ? '-single' : '';
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = SINGLE ? 'file://' + path.join(ROOT, HTML) : `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
await page.goto(base);
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
await page.waitForTimeout(600);
const bx = await page.locator('canvas').boundingBox(); const sc = bx.width / 360;
const tap = async (x, y, w = 450) => { await page.mouse.click(bx.x + x * sc, bx.y + y * sc); await page.waitForTimeout(w); };
const shot = async (n) => { await page.screenshot({ path: path.join(SHOTS, `v4-${n}${SUF}.png`), clip: bx }); console.log('shot', n); };
const ev = (fn, a) => page.evaluate(fn, a);
await tap(180, 322, 900); await tap(180, 435, 900);
await page.waitForTimeout(800);
const R = {};
const closeAll = () => ev(() => { const g = window.__sinetron.scene; g.toastQ.length = 0; while (g.modals.length) g.modals[g.modals.length - 1].close(); g.s.queue = []; g.setSpeed(0); });

// --- set up a mid-game studio with a hit show (debug), streaming not needed
await ev(() => {
  const { sim, scene } = window.__sinetron; const s = sim.s;
  s.money = 900e6; s.fans = 160000; s.rp = 200;
  for (const g of ['religi', 'remaja', 'horor']) if (!s.unlockedGenres.includes(g)) s.unlockedGenres.push(g);
  for (const t of ['pesantren', 'kos']) if (!s.unlockedThemes.includes(t)) s.unlockedThemes.push(t);
  if (!s.platforms.includes('nasional')) s.platforms.push('nasional');
  s.studio = 3; scene.buildStudio();
  // hire a camera operator if missing
  if (!s.staff.some((x) => x.role === 'kameramen')) { const c = s.candidates.find((x) => x.role === 'kameramen') ?? s.candidates[0]; sim.hire(c); }
  scene.rebuildAfterStaffChange();
  // a finished hit to continue
  const m = s.staff.find((x) => x.role === 'aktor'), f = s.staff.find((x) => x.role === 'aktris');
  sim.startProduction({ title: 'Azab Juragan Empang Pelit', genre: 'azab', theme: 'pesantren', platform: 'nasional', eps: 13, budget: 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null });
  for (let i = 0; i < 5000 && s.prod; i++) { while (s.queue.length) { const p = s.queue.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); if (p.kind === 'editDone') sim.release(); } if (s.prod) sim.tick(); }
  s.queue = [];
  const sh = s.shows[s.shows.length - 1]; sh.total = Math.max(sh.total, 34); sh.hof = true; sh.weeksAired = sh.airWeeks;
  scene.refreshHud();
});
await closeAll();

// --- spin-off option in the wizard (step 1) + picker
await tap(180, 606, 500); await tap(180, 210, 600);
await shot('01-wizard-spinoff-button');
await tap(172, 56 + 426 + 13, 700); // "Bikin Sekuel / Spin-off" (wizard y0 = 56)
await shot('02-spinoff-picker');
await tap(8 + 204 + 62, 56 + 56 + 6 + 12, 700); // first row "Sekuel (sama)" (picker x0=8, y0=56)
R.spinDraft = await ev(() => { const g = window.__sinetron.scene; return g.modals.length; });
await shot('03-wizard-sekuel');
// --- step 2: OST pick
await tap(240, 56 + 470 + 25, 600); // Lanjut
await shot('04-wizard-step2');
await tap(8 + 108 + 113, 56 + 222 + 12, 700); // OST button
await shot('05-ost-picker');
await tap(180, 22 + 36 + 1 * 53 + 25, 700); // Bang Romi Kumis (row 2)
await shot('06-wizard-ost-picked');
await tap(240, 56 + 470 + 25, 600); // Lanjut to cast
await shot('07-wizard-cast-cost');
await tap(240, 56 + 470 + 25, 900); // MULAI
R.prodStart = await ev(() => { const p = window.__sinetron.sim.s.prod; return p ? { title: p.title, ost: p.ost, parent: p.parentId, spin: p.spin } : null; });
console.log('prod', JSON.stringify(R.prodStart));
// release it
await ev(() => { const { sim } = window.__sinetron; const s = sim.s; for (let i = 0; i < 5000 && s.prod; i++) { while (s.queue.length) { const p = s.queue.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); if (p.kind === 'editDone') sim.release(); } if (s.prod) sim.tick(); } s.queue = s.queue.filter((p) => p.kind === 'release'); });
await page.waitForTimeout(7600);
await shot('08-rating-sequel-ost');
R.sequel = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { title: sh.title, part: sh.part, parentId: sh.parentId, fanBase: sh.fanBase, ost: sh.ost }; });
await closeAll();
// a week of airing so the chart has data
await ev(() => { const { sim, scene } = window.__sinetron; const s = sim.s; for (let i = 0; i < 8 * 2; i++) { s.queue = []; sim.tick(); } s.queue = []; scene.refreshHud(); });

// --- rating chart with the 4 actions, then the twist picker + popup
await ev(() => { const g = window.__sinetron; const s = g.sim.s; const sh = s.shows[s.shows.length - 1]; g.screens3.openRatingChart(g.scene, sh.platform, sh.id); });
await page.waitForTimeout(500);
await shot('09-rating-chart-actions');
await closeAll();
await ev(() => { const g = window.__sinetron; const s = g.sim.s; const sh = s.shows[s.shows.length - 1]; g.screens4.openTwistPicker(g.scene, sh); });
await page.waitForTimeout(500);
await shot('10-twist-picker');
await tap(8 + 10 + 80, 34 + 54 + 84 * 1 + 40, 250); // row 2 left = Anak Tertukar (fits azab)
await page.waitForTimeout(80);
await shot('11-twist-flash');
await page.waitForTimeout(1300);
await shot('12-twist-popup');
R.twist1 = await ev(() => { const s = window.__sinetron.sim.s; const sh = s.shows[s.shows.length - 1]; return { twists: sh.twists, tBoost: sh.tBoost, muak: sh.muak }; });
await closeAll();
// overuse: force 2 more twists quickly (bypass cooldown) -> netizen muak popup
R.overuse = await ev(() => {
  const g = window.__sinetron; const s = g.sim.s; const sh = s.shows[s.shows.length - 1];
  sh.twistCd = 0; g.sim.playTwist(sh, 'zoom'); sh.twistCd = 0;
  const r = g.sim.playTwist(sh, 'zoom'); sh.twistCd = 0;
  g.screens4.showTwistPopup(g.scene, sh, { id: 'zoom', name: 'Zoom-in 3x', line: 'Kamera zoom ke muka kaget. Zoom lagi. ZOOM LAGI! Jeng jeng jeng!', sting: 'drama', fit: [], icon: [], boost: 0, unlockShows: 0, unlockYear: 1, mock: '' }, r);
  return { r, muak: sh.muak, mock: s.twistMock };
});
await page.waitForTimeout(1400);
await shot('13-twist-muak');
await closeAll();

// --- Ramadan banner: jump to 2 weeks before Ramadan, then into Ramadan
await ev(() => { const { sim, scene } = window.__sinetron; const s = sim.s; const w = sim.weeksToRamadan(); s.absWeek += w - 8; s.tick = 0; scene.refreshHud(); scene.refreshStatus(true); });
// Ramadan slot in the wizard step 2 (8 weeks before Ramadan)
await tap(180, 606, 500); await tap(180, 210, 600);
await tap(8 + 10 + 109 + 53, 56 + 98 + 26 + 12, 400); // genre Religi (row 2, col 2)
await tap(240, 56 + 470 + 25, 600);
await tap(8 + 108 + 113, 56 + 252 + 12, 500); // toggle Ramadan slot
await shot('16-wizard-ramadan-slot');
R.slotOn = await ev(() => { const g = window.__sinetron.scene; return g.modals.length; });
await closeAll();
await ev(() => { const { sim, scene } = window.__sinetron; const s = sim.s; s.absWeek += 6; scene.refreshHud(); scene.refreshStatus(true); });
await page.waitForTimeout(400);
await shot('14-ramadan-soon');
await ev(() => { const { sim, scene } = window.__sinetron; const s = sim.s; s.absWeek += 2; scene.refreshHud(); scene.refreshStatus(true); scene.toast('Marhaban ya Ramadan! Penonton sahur & ngabuburit depan TV.'); });
await page.waitForTimeout(600);
await shot('15-ramadan-banner');
R.ramadan = await ev(() => { const { sim } = window.__sinetron; return { now: sim.isRamadan(), slotNow: sim.canRamadanSlot('religi'), slotKomedi: sim.canRamadanSlot('komedi') }; });
await ev(() => { const { sim } = window.__sinetron; sim.push({ kind: 'event', eventId: 'sahur', data: { cost: 600000 } }); });
await page.waitForTimeout(800);
await shot('17-sahur-event');
await closeAll();

// --- Studio menu, Peralatan, Agensi Bintang, Keuangan
await tap(312, 606, 500);
await shot('18-studio-menu');
await closeAll();
await ev(() => { const g = window.__sinetron; g.screens4.openEquipment(g.scene); });
await page.waitForTimeout(400);
await shot('19-peralatan');
await tap(8 + 236 + 45, 34 + 38 + 40 + 15, 600); // buy camera
R.equip = await ev(() => window.__sinetron.sim.s.equipment.slice());
await shot('19b-peralatan-beli');
await closeAll();
await ev(() => { const g = window.__sinetron; g.sim.refreshStarOffers(); g.screens4.openStarAgency(g.scene); });
await page.waitForTimeout(400);
await shot('20-agensi-bintang');
await closeAll();
await ev(() => { const g = window.__sinetron; g.screens4.openFinance(g.scene); });
await page.waitForTimeout(400);
await shot('21-keuangan');
await closeAll();
// premium studio + map with abroad pins
await ev(() => { const { sim, scene } = window.__sinetron; const s = sim.s; s.studio = 4; scene.buildStudio(); s.fans = 500000; s.absWeek += 48 * 3; scene.refreshHud(); scene.refreshStatus(true); });
await page.waitForTimeout(900);
await shot('22-studio-bintang');
await ev(() => { const { sim, scene } = window.__sinetron; sim.s.studio = 5; scene.buildStudio(); });
await page.waitForTimeout(900);
await shot('23-istana-sinetron');
await tap(251, 606, 600);
await tap(180, 18 + 280 + 3 * 24 + 11, 500); // Istanbul chip (row 4, col 2)
await shot('24-map-luar-negeri');
await closeAll();
// old-save migration check (strip v4 fields)
R.migrate = await ev(() => {
  const { sim } = window.__sinetron; const o = JSON.parse(JSON.stringify(sim.s));
  for (const k of ['equipment', 'twistLog', 'twistMock', 'starOffers', 'starOfferWeek', 'ramadanSlotYear', 'ramadanNoticeYear', 'ledger']) delete o[k];
  for (const sh of o.shows) for (const k of ['twists', 'twistCd', 'tBoost', 'tWeeks', 'muak', 'ost', 'ramadan', 'parentId', 'franchise', 'part', 'spin', 'fanBase', 'promoKind']) delete sh[k];
  localStorage.setItem('sinetron-story-save-v1', JSON.stringify(o));
  return true;
});
await page.reload(); await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 }); await page.waitForTimeout(600);
await tap(180, 322, 1200);
R.migrated = await ev(() => { const { sim } = window.__sinetron; const s = sim.s; for (let i = 0; i < 8 * 6; i++) { s.queue = []; sim.tick(); } return { equip: Array.isArray(s.equipment), ledger: !!s.ledger, parts: s.shows.every((x) => x.part >= 1 && Array.isArray(x.twists)), money: isFinite(s.money) }; });
console.log('R', JSON.stringify(R));
const filtered = errors.filter((e) => !/GPU stall|swiftshader|WebGL|GL Driver|Automatic fallback/i.test(e));
console.log('console errors/warnings:', filtered.length); filtered.slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 500)));
const ok = R.prodStart && R.prodStart.parent != null && R.prodStart.ost && R.sequel.part >= 2 && R.twist1.twists.length === 1 && R.overuse.muak > 0 && R.ramadan.now && R.ramadan.slotNow && R.equip.includes('kamera') && R.migrated.equip && R.migrated.parts && filtered.length === 0;
console.log('V4 OK:', !!ok);
await browser.close(); server.close();
