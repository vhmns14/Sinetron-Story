// v5 end-to-end: every new feature through the real page (clicks on the canvas + debug hooks), with assertions and
// screenshots. usage: node tools/e2e-v5.mjs <dist dir> <shots dir> [part=a|b|all] [WxH]
//   part a: backup (title export/import + validation), guided tutorial until the first sinetron airs, feed, prestasi
//   part b: gosip/boikot, casting audition, rewel/mogok, product placement, KPI, year-10 ending, v4 save migration
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
/** Phaser makes new buttons hittable on its next input update: on a slow (software-GL, loaded) machine a click right
 *  after a dialog opens can arrive before that frame. Wait for two game frames first. */
const frames = (p, n = 2) => p.evaluate((n) => new Promise((res) => { const g = window.__game; const f0 = g.loop.frame; const t0 = performance.now(); const chk = () => (g.loop.frame - f0 >= n || performance.now() - t0 > 5000 ? res() : setTimeout(chk, 16)); chk(); }), n);
const DIR = process.argv[2] ?? 'dist';
const SHOTS = path.resolve(process.argv[3] ?? '../shots/v5');
const PART = process.argv[4] ?? 'all';
const [VW, VH] = (process.argv[5] ?? '390x844').split('x').map(Number);
const TAG = `${VW}x${VH}`;
fs.mkdirSync(SHOTS, { recursive: true });
const { server, port } = await serve(path.resolve(DIR));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
const errors = []; let fails = 0, oks = 0;
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
const ok = (c, m) => { console.log(c ? '  ok' : '  FAIL', m); if (c) oks++; else fails++; };
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: path.join(SHOTS, `e2e-${name}-${TAG}.png`) }); };
/** click a named canvas object (searching into containers) with the real mouse */
async function tapName(name, sceneKey = 'Game', after = 350) {
  await frames(page);
  const r = await ev(([name, sceneKey]) => {
    const sc = window.__game.scene.getScene(sceneKey);
    let found = null;
    const walk = (list) => { for (const o of list) { if (o.name === name && o.visible !== false && o.active) found = o; if (o.list) walk(o.list); } };
    walk(sc.children.list);
    if (!found) return null;
    const b = found.getBounds();
    const g = window.__game; const c = g.canvas.getBoundingClientRect();
    const lw = g.scale.gameSize.width / g.registry.get('zoom');
    const s = c.width / lw;
    return { x: c.left + b.centerX * s, y: c.top + b.centerY * s };
  }, [name, sceneKey]);
  if (!r) { ok(false, `tap target "${name}" exists`); return false; }
  await page.mouse.click(r.x, r.y); await wait(after);
  return true;
}
// drop the pending popups in the same frame: an unresolved event stays queued and would re-open on the next frame
const closeAll = () => ev(() => { const sc = window.__sinetron.scene; sc.s.queue = sc.s.queue.filter((p) => p.kind !== 'event' && p.kind !== 'info' && p.kind !== 'rating'); while (sc.modals.length) sc.modals[sc.modals.length - 1].close(); });
const topTitle = () => ev(() => { const m = window.__sinetron.scene.modals; return m.length ? m[m.length - 1].opts.title ?? '(nopanel)' : null; });
async function boot() {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 45000 });
  await wait(900);
}
async function startState(mod) {
  await ev((src) => { const t = window.__game.scene.getScene('Title'); const s = window.__newGameForTests(); s.tut = -1; if (src) (new Function('s', src))(s); t.scene.start('Game', { state: s }); }, mod ?? '');
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron && window.__sinetron.scene.sys.isActive(), null, { timeout: 30000 });
  await wait(1200);
}
/** run sim ticks resolving pending items with a chooser (kept off-screen) */
const runTicks = (n) => ev((n) => { const { sim, scene } = window.__sinetron; const s = sim.s; for (let i = 0; i < n; i++) { while (s.queue.length) { const p = sim.shift(); if (p.kind === 'editDone') sim.release(); else if (p.kind === 'event') sim.resolveEvent(p, 0); } sim.tick(); } scene.syncStaff(); scene.refreshHud(); }, n);
const produce = (o) => ev((o) => { const { sim } = window.__sinetron; const s = sim.s; const m = s.staff.find((x) => x.role === 'aktor'), f = s.staff.find((x) => x.role === 'aktris'); return sim.startProduction({ title: 'Tes', genre: 'azab', theme: 'kampung', platform: 'lokal', eps: 13, budget: 'standar', leadM: m ? m.id : null, leadF: f ? f.id : null, ...o }); }, o ?? {});

await boot();

// =================================================================== PART A
if (PART === 'a' || PART === 'all') {
  console.log('== backup (title)');
  // a save to export: start a game, play a bit, go back to title
  await startState('s.money = 77_700_000;');
  await ev(() => { const { sim } = window.__sinetron; sim.s.fans = 4321; window.__sinetronNoDownload = true; });
  await ev(() => { const { scene } = window.__sinetron; scene.s.queue = []; window.__sinetron.scene.scene.start('Title'); });
  await page.waitForFunction(() => window.__game.scene.isActive('Title')); await wait(800);
  // saveGame happens on 'Ke Layar Judul' only via the menu; save explicitly
  await ev(() => { localStorage.setItem('sinetron-story-save-v1', JSON.stringify(Object.assign(window.__newGameForTests(), { money: 77_700_000, fans: 4321, tut: -1 }))); window.__game.scene.getScene('Title').scene.restart(); });
  await wait(900);
  ok(await tapName('title_backup_save', 'Title'), 'title Backup Save button');
  await shot('a01-title-backup');
  await tapName('titleExport', 'Title', 500);
  const code = await ev(() => document.getElementById('sinetron-code')?.value ?? '');
  ok(code.startsWith('SINETRON:') && code.length > 500, `export code shown (${code.length} chars)`);
  await shot('a02-export-panel');
  await page.click('#sinetron-copy'); await wait(300);
  const msg = await ev(() => document.getElementById('sinetron-msg')?.textContent ?? '');
  ok(msg.length > 0, `copy feedback "${msg}"`);
  await page.click('#sinetron-dl'); await wait(200);
  ok((await ev(() => document.getElementById('sinetron-msg')?.textContent ?? '')).includes('Salin'), 'blocked download falls back to copy hint');
  await page.click('#sinetron-close'); await wait(200);
  // import: invalid text -> error, valid code -> confirmation -> game with that state
  await tapName('titleImport', 'Title', 500);
  await page.fill('#sinetron-code', '{"app":"juragan-kos","save":{}}');
  await page.click('#sinetron-import'); await wait(300);
  ok((await ev(() => document.getElementById('sinetron-msg')?.textContent ?? '')).includes('game lain'), 'import rejects another game\'s backup');
  await page.fill('#sinetron-code', 'ini bukan backup');
  await page.click('#sinetron-import'); await wait(300);
  ok((await ev(() => document.getElementById('sinetron-msg')?.textContent ?? '')).length > 5, 'import rejects garbage');
  await shot('a03-import-error');
  const tweaked = await ev((code) => { const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.slice(9)), (c) => c.charCodeAt(0)))); json.save.money = 123_456_789; return 'SINETRON:' + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(json)))); }, code);
  await page.fill('#sinetron-code', tweaked);
  await page.click('#sinetron-import'); await wait(500);
  ok(await ev(() => !document.getElementById('sinetron-dom')), 'valid import closes the panel');
  await shot('a04-import-confirm');
  await tapName('titleConfirmImport', 'Title', 1500);
  await page.waitForFunction(() => window.__game.scene.isActive('Game'), null, { timeout: 20000 }); await wait(800);
  ok(await ev(() => window.__sinetron.sim.s.money === 123_456_789), 'imported save is live');
  // in-game backup panel
  await ev(() => { const { scene, screens5 } = window.__sinetron; scene.s.queue = []; screens5.openBackup(scene); }); await wait(400);
  await shot('a05-backup-ingame');
  await tapName('backupExport', 'Game', 500);
  ok(await ev(() => (document.getElementById('sinetron-code')?.value ?? '').startsWith('SINETRON:')), 'in-game export');
  await page.click('#sinetron-close'); await closeAll();

  console.log('== tutorial');
  await ev(() => { localStorage.clear(); const sc = window.__sinetron.scene; sc.scene.start('Title'); });
  await page.waitForFunction(() => window.__game.scene.isActive('Title')); await wait(700);
  await tapName('title_main_baru', 'Title', 1500);
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron); await wait(900);
  ok((await topTitle()) === 'SELAMAT DATANG', 'welcome dialog on a new game');
  await shot('a10-welcome');
  await tapName('tutYes', 'Game', 700);
  ok(await ev(() => window.__sinetron.sim.s.tut === 1), 'tutorial started (step 1)');
  await wait(400);
  const bubble = await ev(() => { const c = window.__sinetron.scene.children.getByName('tutBubble'); return c ? c.list.find((o) => o.type === 'Text' && o.text.length > 20)?.text : null; });
  ok(!!bubble && bubble.includes('STAF'), `coach bubble points at STAF: "${bubble}"`);
  await shot('a11-tut-staf');
  await tapName('btn_staf'); await wait(300);
  await shot('a12-tut-rekrut');
  await tapName('tut_rekrut'); await wait(400);
  // make sure a camera operator is on offer (fresh game always has one)
  const hasCam = await ev(() => window.__sinetron.sim.s.candidates.some((c) => c.role === 'kameramen'));
  ok(hasCam, 'a kameramen candidate is on offer');
  await shot('a13-tut-hire');
  await tapName('tut_hire'); await wait(500);
  ok(await ev(() => window.__sinetron.sim.s.staff.some((x) => x.role === 'kameramen')), 'kameramen hired via the tutorial');
  await closeAll(); await wait(500);
  ok(await ev(() => window.__sinetron.sim.s.tut === 2), 'tutorial step 2 (produksi)');
  await tapName('btn_produksi'); await tapName('tut_new');
  await shot('a14-tut-wizard1');
  await tapName('tut_next1'); await tapName('tut_next2');
  await shot('a15-tut-wizard3');
  await tapName('tut_mulai', 'Game', 800);
  ok(await ev(() => !!window.__sinetron.sim.s.prod), 'first production started via the tutorial');
  await wait(500);
  ok(await ev(() => window.__sinetron.sim.s.tut === 3), 'tutorial step 3 (speed up)');
  await shot('a16-tut-speed');
  // fast-forward to the release, close the rating show
  await ev(() => { const { sim } = window.__sinetron; let g = 0; while (sim.s.prod && g++ < 3000) { if (sim.s.queue.length) { const p = sim.s.queue[0]; if (p.kind === 'editDone') { sim.shift(); sim.release(); } else if (p.kind === 'release') break; else { sim.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); } } else sim.tick(); } });
  await wait(1500);
  await shot('a16b-first-rating');
  // tap to skip the reveal, then press Lanjut like a player
  const vb = await page.locator('canvas').boundingBox();
  await page.mouse.click(vb.x + vb.width / 2, vb.y + vb.height * 0.2); await wait(600);
  ok(await tapName('ratingNext', 'Game', 800), 'rating show Lanjut button');
  for (let k = 0; k < 5 && (await ev(() => window.__sinetron.scene.modals.length)); k++) { await ev(() => { const sc = window.__sinetron.scene; const m = sc.modals[sc.modals.length - 1]; if (m.opts.noPanel) return; m.close(); sc.sim.shift(); }); await wait(500); }
  await wait(800);
  ok(await ev(() => window.__sinetron.sim.s.tut === 5), `tutorial final step after the first release (tut=${await ev(() => window.__sinetron.sim.s.tut)})`);
  await shot('a17-tut-done');
  await tapName('tutDone', 'Game', 400);
  ok(await ev(() => window.__sinetron.sim.s.tut === -1), 'tutorial finished');
  // replay from the menu
  await ev(() => { window.__sinetron.sim.s.queue = []; window.__sinetron.scene.setSpeed(0); }); await closeAll();
  await ev(() => { const { scene, screens } = window.__sinetron; screens.openMenu(scene); }); await wait(300);
  await tapName('menu_ulang_tutorial'); await wait(400);
  ok(await ev(() => window.__sinetron.sim.s.tut >= 1), 'tutorial replay from the menu');
  await ev(() => window.__sinetron.tut.skip()); await wait(200);
  ok(await ev(() => window.__sinetron.sim.s.tut === -1), 'tutorial skip');

  console.log('== feed + prestasi');
  await runTicks(8 * 6);
  const feedN = await ev(() => window.__sinetron.sim.s.feed.length);
  ok(feedN >= 2, `netizen posts generated from events (${feedN})`);
  ok(await ev(() => window.__sinetron.scene.feedBadge?.c.visible === true), 'unread badge on the Netizen button');
  await ev(() => { window.__sinetron.sim.s.queue = []; }); await closeAll(); await wait(300);
  await shot('a20-badge');
  await tapName('btn_netizen', 'Game', 600);
  ok((await topTitle()) === 'LINIMASA NETIZEN', 'feed opens from the bottom bar');
  ok(await ev(() => window.__sinetron.sim.s.feedRead === window.__sinetron.sim.s.feedSeq), 'feed marked read');
  await shot('a21-feed');
  await closeAll();
  await ev(() => { const { sim } = window.__sinetron; sim.s.trophies = 1; sim.checkAch(); }); await wait(700);
  await shot('a22-ach-toast');
  ok(await ev(() => window.__sinetron.sim.s.achievements.trophy1 !== undefined && window.__sinetron.sim.s.achievements.first_show !== undefined), 'achievements unlock (first_show, trophy1)');
  await ev(() => { const { scene, screens5 } = window.__sinetron; screens5.openAchievements(scene); }); await wait(500);
  await shot('a23-prestasi');
  await closeAll();
}

// =================================================================== PART B
if (PART === 'b' || PART === 'all') {
  console.log('== gosip & boikot');
  await startState('s.money = 300_000_000; s.fans = 20000;');
  await produce({ title: 'Air Mata Mertua' });
  await runTicks(8 * 14);
  const airing = await ev(() => window.__sinetron.sim.s.shows.filter((x) => window.__sinetron.sim.isAiring(x)).length);
  ok(airing >= 1, 'a show is airing');
  for (const kind of ['cinlok', 'skandal', 'cerai', 'viral']) {
    await ev((kind) => { const { sim, scene } = window.__sinetron; scene.setSpeed(0); let g = null; for (let i = 0; i < 40 && (!g || g.data.kind !== kind); i++) g = window.__sinetron.v5.makeGosip(sim); sim.s.queue = [g]; }, kind);
    await wait(900);
    const t = await topTitle();
    ok(!!t && t !== 'SELAMAT DATANG', `gosip ${kind} dialog (${t})`);
    await shot(`b01-gosip-${kind}`);
    // pick "goreng" (index 1; viral: 0)
    const before = await ev(() => ({ boikot: window.__sinetron.sim.s.boikot, g: window.__sinetron.sim.s.shows.map((x) => x.gBoost).join(), fans: window.__sinetron.sim.s.fans }));
    await ev((kind) => { const sc = window.__sinetron.scene; const m = sc.modals[sc.modals.length - 1]; const btns = []; const walk = (l) => { for (const o of l) { if (o.type === 'Container' && o.list?.some((c) => c.type === 'Zone')) btns.push(o); if (o.list) walk(o.list); } }; walk(m.content.list); const b = btns[kind === 'viral' ? 0 : 1]; const z = b.list.find((c) => c.type === 'Zone'); z.emit('pointerdown'); z.emit('pointerup'); }, kind);
    await wait(400);
    await shot(`b02-gosip-${kind}-result`);
    const after = await ev(() => ({ boikot: window.__sinetron.sim.s.boikot, g: window.__sinetron.sim.s.shows.map((x) => x.gBoost).join(), fans: window.__sinetron.sim.s.fans }));
    // viral + goreng: fans / followers always grow (the rating boost can be hidden by a bigger one still running)
    ok(after.g !== before.g || kind === 'cinlok' || after.boikot !== before.boikot || after.fans > before.fans, `gosip ${kind} goreng had an effect (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
    await closeAll(); await ev(() => { window.__sinetron.sim.s.queue = []; });
  }
  await ev(() => { const { sim } = window.__sinetron; sim.s.boikot = 90; for (let i = 0; i < 30 && !sim.s.queue.some((p) => p.eventId === 'boikot'); i++) window.__sinetron.v5.boikotWeek(sim); sim.s.queue = sim.s.queue.filter((p) => p.eventId === 'boikot').slice(0, 1); });
  await wait(900);
  ok((await topTitle()) === 'BOIKOT!', 'boikot event when netizen anger boils over');
  await shot('b03-boikot');
  await ev(() => { const sc = window.__sinetron.scene; sc.sim.s.queue = []; const m = sc.modals[sc.modals.length - 1]; m.close(); const p = { eventId: 'boikot', data: { showId: sc.s.shows[0].id, cost: 1 } }; sc.sim.resolveEvent(p, 1); });
  ok(await ev(() => window.__sinetron.sim.s.shows.some((x) => x.bWeeks > 0)), 'boikot penalty applied to the show');

  console.log('== audisi');
  await closeAll();
  await ev(() => { const { scene, screens5 } = window.__sinetron; screens5.openAudition(scene, 'aktris'); }); await wait(400);
  await shot('b10-audisi-start');
  await tapName('auditionStart', 'Game', 500);
  ok(await ev(() => window.__sinetron.sim.s.audition?.cands.length === 3), 'audition with 3 candidates');
  await shot('b11-audisi-cands');
  await tapName('scene_nangis', 'Game', 1800);
  ok(await ev(() => window.__sinetron.sim.s.audition?.scores.length === 3), 'test scene revealed scores');
  await shot('b12-audisi-scene');
  const n0 = await ev(() => window.__sinetron.sim.s.staff.length);
  await tapName('auditionHire0', 'Game', 600);
  const hired = await ev(() => { const s = window.__sinetron.sim.s; const st = s.staff[s.staff.length - 1]; return { n: s.staff.length, trait: st.trait, chem: Object.keys(s.chem).length }; });
  ok(hired.n === n0 + 1 && !!hired.trait && hired.chem >= 1, `hired from audition with trait + chemistry ${JSON.stringify(hired)}`);

  console.log('== rewel / mogok + product placement + KPI');
  await closeAll();
  await produce({ title: 'Kuntilanak Sekolah', genre: 'horor', theme: 'sekolah' });
  ok(await ev(() => window.__sinetron.sim.s.prod?.offers.length >= 2), 'sponsors offer placements on a new production');
  await ev(() => { const { scene, screens } = window.__sinetron; screens.openProduction(scene); }); await wait(400);
  await shot('b20-prod-status');
  await tapName('btn_sponsor', 'Game', 500);
  await shot('b21-sponsor');
  await tapName('placeAccept', 'Game', 400); await tapName('placeAccept', 'Game', 400);
  ok(await ev(() => window.__sinetron.sim.s.prod.placements.length === 2), 'two placements accepted');
  await closeAll();
  await ev(() => { const { sim } = window.__sinetron; const p = sim.s.prod; const o = window.__sinetron.v5.makeOffer(sim.s, p, p.placements); sim.s.queue = [{ kind: 'event', eventId: 'placement', data: { id: o.id, pay: o.pay } }]; });
  await wait(900);
  ok((await topTitle()) === 'PRODUCT PLACEMENT', 'placement offer event');
  await shot('b22-placement-event');
  await closeAll(); await ev(() => { window.__sinetron.sim.s.queue = []; });
  // mogok (lead during production) + rewel
  await ev(() => { const { sim } = window.__sinetron; const p = sim.s.prod; const st = sim.s.staff.find((x) => x.id === p.leadF || x.id === p.leadM); st.trait = 'rewel'; sim.s.queue = [{ kind: 'event', eventId: 'mogok', data: { staffId: st.id, cost: 2000000, demand: 'trailer ber-AC' } }]; });
  await wait(900);
  ok((await topTitle()) === 'MOGOK SYUTING!', 'mogok event');
  await shot('b23-mogok');
  await closeAll();
  await ev(() => { const { sim } = window.__sinetron; const st = sim.s.staff.find((x) => x.role === 'aktor'); sim.s.queue = []; const r = sim.resolveEvent({ eventId: 'mogok', data: { staffId: st.id, cost: 1, demand: 'x' } }, 2); window.__mog = r; });
  await ev(() => { const { sim } = window.__sinetron; const st = sim.s.staff.find((x) => x.role === 'aktor'); st.strike = 2; window.__sinetron.scene.refreshStatus(true); });
  await runTicks(4);
  ok(await ev(() => { const st = window.__sinetron.sim.s.staff.find((x) => x.role === 'aktor'); return st.strike > 0 && st.activity === 'idle' && st.room === 'kantin'; }), 'striking actor sulks in the canteen (no work)');
  await wait(600);
  await shot('b24-strike-status');
  await ev(() => { const { sim } = window.__sinetron; const st = sim.s.staff.find((x) => x.role === 'aktris'); sim.s.queue = [{ kind: 'event', eventId: 'rewel', data: { staffId: st.id, amount: 500000 } }]; });
  await wait(900);
  ok((await topTitle()) === 'ARTIS REWEL', 'rewel event');
  await closeAll(); await ev(() => { window.__sinetron.sim.s.queue = []; });
  // KPI: warning at 40, sanction at 70
  await ev(() => { const { sim, v5 } = window.__sinetron; sim.s.kpi = 35; sim.s.kpiStage = 0; v5.addKpi(sim, 8); });
  await wait(900);
  ok((await topTitle()) === 'SURAT TEGURAN', 'KPI warning at 40%');
  await shot('b30-kpi-warn');
  await closeAll(); await ev(() => { window.__sinetron.sim.s.queue = []; });
  await ev(() => { const { sim, v5 } = window.__sinetron; v5.addKpi(sim, 30); });
  await wait(900);
  ok((await topTitle()) === 'SANKSI KPI!', 'KPI sanction at 70%');
  await shot('b31-kpi-sanction');
  // resolve the sanction event directly (same frame as closing its dialog, so it can't re-open)
  await ev(() => { const { sim, scene } = window.__sinetron; while (scene.modals.length) scene.modals.at(-1).close(); const p = sim.s.queue.shift(); sim.s.queue = []; window.__kr = sim.resolveEvent(p, 0); });
  ok(await ev(() => window.__sinetron.sim.s.kpi <= 45 && (window.__sinetron.sim.s.shows.some((x) => x.slotWeeks > 0) || window.__sinetron.sim.s.stats5.kpiFines > 0)), 'sanction applied (slot move or fine), meter drops');
  await ev(() => { const { scene, screens5 } = window.__sinetron; scene.s.kpi = 60; screens5.openKpi(scene); }); await wait(400);
  await shot('b32-kpi-screen');
  const k0 = await ev(() => window.__sinetron.sim.s.kpi);
  await tapName('sowanBtn', 'Game', 400);
  const k1 = await ev(() => window.__sinetron.sim.s.kpi);
  ok(k1 < k0, `sowan lowers the KPI meter ${k0} -> ${k1}`);
  await closeAll();
  // release with too many placements -> protest penalty + feed post
  await ev(() => { const { sim } = window.__sinetron; const p = sim.s.prod; p.placements = ['mi', 'kopi', 'bank', 'cat', 'ojol']; });
  await runTicks(8 * 14);
  ok(await ev(() => { const sh = window.__sinetron.sim.s.shows.find((x) => x.title === 'Kuntilanak Sekolah'); return sh && sh.placements === 5 && sh.comments.some((c) => /iklan/i.test(c)); }), 'placement overload: critic mocks the ads');
  ok(await ev(() => window.__sinetron.sim.s.feed.some((p) => /iklan/i.test(p.t))), 'netizen protest post about ads');

  console.log('== ending (year 10)');
  await ev(() => { const { sim } = window.__sinetron; const s = sim.s; s.queue = []; s.absWeek = 48 * 10 - 1; s.tick = 7; s.money = 2e9; sim.tick(); s.queue = s.queue.filter((p) => p.kind === 'ending'); });
  await wait(1200);
  ok((await topTitle()) === 'SATU DEKADE!', 'career recap at the end of year 10');
  await shot('b40-ending');
  await tapName('endingContinue', 'Game', 600);
  ok(await ev(() => window.__sinetron.sim.s.endingSeen && !window.__sinetron.scene.modals.length), 'free play continues after the ending');
  ok(await ev(() => window.__sinetron.sim.s.achievements.tamat !== undefined), 'Satu Dekade achievement');
  await runTicks(8 * 3);
  ok(await ev(() => window.__sinetron.sim.s.absWeek > 480 && !window.__sinetron.sim.s.gameOver), 'year 11 plays on');

  console.log('== v4 save migration');
  const mig = await ev(() => {
    const s = window.__newGameForTests();
    for (const k of ['achievements', 'stats5', 'endingSeen', 'feed', 'feedSeq', 'feedRead', 'kpi', 'kpiStage', 'kpiSowanWeek', 'kpiLastSanction', 'boikot', 'tut', 'chem', 'audition']) delete s[k];
    for (const st of s.staff) { delete st.trait; delete st.strike; }
    s.tutorialSeen = true; s.shows = [];
    localStorage.setItem('sinetron-story-save-v1', JSON.stringify(s));
    return true;
  });
  await ev(() => window.__sinetron.scene.scene.start('Title'));
  await page.waitForFunction(() => window.__game.scene.isActive('Title')); await wait(600);
  await tapName('title_lanjutkan', 'Title', 1500);
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron); await wait(900);
  const m2 = await ev(() => { const s = window.__sinetron.sim.s; return { tut: s.tut, ach: typeof s.achievements, feed: Array.isArray(s.feed), traits: s.staff.filter((x) => x.role === 'aktor' || x.role === 'aktris').every((x) => !!x.trait), kpi: s.kpi, modals: window.__sinetron.scene.modals.length }; });
  ok(mig && m2.tut === -1 && m2.ach === 'object' && m2.feed && m2.traits && m2.kpi === 0 && m2.modals === 0, `old save migrated (no tutorial, fields filled) ${JSON.stringify(m2)}`);
  await runTicks(8 * 4);
  await shot('b50-migrated');
}

console.log(`checks ok ${oks}, failed ${fails}; console errors/warnings: ${errors.length}`);
errors.slice(0, 12).forEach((e) => console.log('   ', e.slice(0, 1500)));
await browser.close(); server.close();
process.exit(errors.length || fails ? 1 : 0);
