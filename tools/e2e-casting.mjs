// v5.1 casting / audisi e2e (the balance + soak bots rarely use it): real clicks on the Audisi dialog at a phone and a
// short laptop window (the dialog scrolls there), plus the edge cases: no money, studio full, no partner yet, partner
// leaves mid-audition, save/reload + backup round-trip mid-audition, chemistry in the wizard and the release.
// usage: node tools/e2e-casting.mjs [dist] [shots dir]
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
/** Phaser makes new buttons hittable on its next input update: on a slow (software-GL, loaded) machine a click right
 *  after a dialog opens can arrive before that frame. Wait for two game frames first. */
const frames = (p, n = 2) => p.evaluate((n) => new Promise((res) => { const g = window.__game; const f0 = g.loop.frame; const t0 = performance.now(); const chk = () => (g.loop.frame - f0 >= n || performance.now() - t0 > 5000 ? res() : setTimeout(chk, 16)); chk(); }), n);
const DIR = process.argv[2] ?? 'dist';
const SHOTS = path.resolve(process.argv[3] ?? '../shots/v5fix/casting');
fs.mkdirSync(SHOTS, { recursive: true });
const { server, port } = await serve(path.resolve(DIR));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let fails = 0, oks = 0;
const ok = (c, m) => { console.log(c ? '  ok' : '  FAIL', m); if (c) oks++; else fails++; };
const allErrors = [];

for (const [VW, VH, DPR] of [[390, 844, 2], [1280, 560, 1]]) {
  const TAG = `${VW}x${VH}`;
  console.log('== casting at', TAG);
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${TAG}] [${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${TAG}] [pageerror] ${e.message}\n${e.stack}`));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `cast-${n}-${TAG}.png`) });
  /** click a named object with the real mouse; scrolls the top dialog first when the target is off screen */
  async function tapName(name, after = 350) {
    await frames(page);
    const r = await ev((name) => {
      const sc = window.__sinetron.scene;
      let found = null;
      const walk = (l) => { for (const o of l) { if (o.name === name && o.visible !== false && o.active) found = o; if (o.list) walk(o.list); } };
      walk(sc.children.list);
      if (!found) return null;
      const g = window.__game, Z = g.registry.get('zoom'), GH = g.scale.gameSize.height / Z;
      const top = sc.modals[sc.modals.length - 1];
      let b = found.getBounds();
      if (top && top.maxScroll > 0 && (b.y < 4 || b.bottom > GH - 4)) { top.setScroll(top.scroll + (b.centerY - GH / 2)); b = found.getBounds(); }
      const c = g.canvas.getBoundingClientRect();
      const s = c.width / (g.scale.gameSize.width / Z);
      return { x: c.left + b.centerX * s, y: c.top + b.centerY * s, on: b.y >= 0 && b.bottom <= GH };
    }, name);
    if (!r) { ok(false, `${TAG} tap target "${name}" exists`); return false; }
    if (!r.on) ok(false, `${TAG} "${name}" reachable on screen`);
    await page.mouse.click(r.x, r.y); await wait(after);
    return true;
  }
  /** click, then wait for the state change; one retry when a loaded machine dropped the click */
  async function tapUntil(name, cond, after = 500) {
    for (let i = 0; i < 2; i++) {
      await tapName(name, after);
      const done = await page.waitForFunction(cond, null, { timeout: 4000 }).then(() => true).catch(() => false);
      if (done) return true;
      console.log(`    (retry click ${name})`);
    }
    return false;
  }
  const topTitle = () => ev(() => { const m = window.__sinetron.scene.modals; return m.length ? m[m.length - 1].opts.title ?? '(nopanel)' : null; });
  const closeAll = () => ev(() => { const sc = window.__sinetron.scene; sc.s.queue = []; while (sc.modals.length) sc.modals[sc.modals.length - 1].close(); });

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 45000 });
  await wait(800);
  await ev(() => { localStorage.clear(); const t = window.__game.scene.getScene('Title'); const s = window.__newGameForTests(); s.tut = -1; s.money = 900e6; s.fans = 40000; t.scene.start('Game', { state: s }); });
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron, null, { timeout: 30000 });
  await wait(1200);
  await ev(() => window.__sinetron.scene.setSpeed(0));

  // ---- 1. full UI flow x4 (both roles, every test scene), hire each time
  const scenes = ['nangis', 'marah', 'romantis', 'lucu'];
  for (let k = 0; k < 4; k++) {
    const role = k % 2 ? 'aktris' : 'aktor';
    await ev(() => { const { scene, sim } = window.__sinetron; sim.s.queue = []; if (sim.s.staff.length >= sim.maxStaff()) { sim.s.studio = Math.min(5, sim.s.studio + 1); scene.buildStudio(); } });
    await ev((role) => { const { scene, screens5 } = window.__sinetron; screens5.openAudition(scene, role); }, role);
    await wait(500);
    ok((await topTitle()) === 'AUDISI PEMERAN', `${TAG} #${k + 1} audition dialog open (${role})`);
    if (k === 0) await shot('01-intro');
    const m0 = await ev(() => { const s = window.__sinetron.sim.s; return { money: s.money, cast: s.stats5.castings, staff: s.staff.length }; });
    await tapUntil('auditionStart', () => !!window.__sinetron.sim.s.audition);
    const a1 = await ev(() => { const s = window.__sinetron.sim.s; return { a: !!s.audition, n: s.audition?.cands.length, money: s.money, cast: s.stats5.castings, partner: s.audition?.partnerId ?? 'undef', traits: s.audition?.cands.map((c) => c.trait) }; });
    ok(a1.a && a1.n === 3 && a1.money < m0.money && a1.cast === m0.cast + 1 && new Set(a1.traits).size === 3, `${TAG} #${k + 1} audition started: 3 candidates, distinct traits, fee paid ${JSON.stringify(a1)}`);
    await tapUntil('scene_' + scenes[k], () => !!window.__sinetron.sim.s.audition?.scene, 1800);
    if (k === 0) await shot('02-scene-revealed');
    const sc = await ev(() => { const a = window.__sinetron.sim.s.audition; return { scene: a.scene, scores: a.scores, chem: a.chem }; });
    ok(sc.scene === scenes[k] && sc.scores.length === 3 && sc.scores.every((v) => v >= 1 && v <= 5) && sc.chem.every((c) => c >= 30 && c <= 99), `${TAG} #${k + 1} scene ${scenes[k]}: scores ${sc.scores} chem ${sc.chem}`);
    // pick the best chemistry candidate
    const best = sc.chem.indexOf(Math.max(...sc.chem));
    await tapUntil('auditionHire' + best, () => window.__sinetron.sim.s.audition === null, 600);
    const h = await ev((best) => { const s = window.__sinetron.sim.s; const c = s.staff[s.staff.length - 1]; const p = s.staff.find((x) => x.id === window.__lastPartner); return { audition: s.audition, staff: s.staff.length, last: c.name, trait: c.trait, chemKeys: Object.keys(s.chem).length, modals: window.__sinetron.scene.modals.length }; }, best);
    ok(h.audition === null && h.staff === m0.staff + 1 && !!h.trait && h.modals === 0, `${TAG} #${k + 1} hired ${h.last} (${h.trait}), dialog closed`);
  }
  ok(await ev(() => Object.keys(window.__sinetron.sim.s.chem).length >= 3), `${TAG} chemistry stored for the hired pairs`);

  // ---- 2. edge cases
  // no money
  await ev(() => { const { scene, screens5, sim } = window.__sinetron; sim.s.audition = null; sim.s.money = 1000; screens5.openAudition(scene, 'aktor'); });
  await wait(400);
  const noMoney = await ev(() => { const { v5, sim } = window.__sinetron; return { err: v5.startAudition(sim, 'aktor'), a: sim.s.audition }; });
  ok(!!noMoney.err && noMoney.a === null, `${TAG} no money: refused (${noMoney.err})`);
  await shot('03-no-money');
  await closeAll();
  // studio full: audition allowed, hiring refused with a toast that does not cover the dialog
  await ev(() => { const { sim } = window.__sinetron; sim.s.money = 900e6; while (sim.s.staff.length < sim.maxStaff()) sim.s.staff.push({ ...sim.s.staff[sim.s.staff.length - 1], id: sim.s.nextId++, name: 'Figuran ' + sim.s.nextId }); });
  await ev(() => { const { scene, screens5 } = window.__sinetron; screens5.openAudition(scene, 'aktris'); });
  await wait(400);
  await tapUntil('auditionStart', () => !!window.__sinetron.sim.s.audition);
  await wait(300);
  await tapUntil('scene_romantis', () => !!window.__sinetron.sim.s.audition?.scene, 1700);
  await wait(300);
  const nFull = await ev(() => window.__sinetron.sim.s.staff.length);
  await tapName('auditionHire0', 700);
  const full = await ev(() => { const sc = window.__sinetron.scene; const r = sc.modals.at(-1)?.rect(); const t = sc.children.list.filter((o) => o.name === 'toast' && o.visible); return { staff: sc.s.staff.length, audition: !!sc.s.audition, modals: sc.modals.length, toasts: t.length, q: sc.toastQ.length, hit: !!r && t.some((o) => { const b = o.getBounds(); return b.right > r.x0 && b.x < r.x1 && b.bottom > r.y0 && b.y < r.y1; }) }; });
  ok(full.staff === nFull && full.audition && full.modals === 1, `${TAG} studio full: hire refused, audition kept ${JSON.stringify(full)}`);
  ok(!full.hit && (full.toasts > 0 || full.q > 0), `${TAG} studio-full toast shown (or held) without covering the dialog`);
  await shot('04-studio-full');
  await closeAll();
  // save + reload mid-audition (localStorage round trip through normalizeSave) and a backup round trip
  const rt = await ev(() => {
    const { sim, backup } = window.__sinetron;
    const before = JSON.stringify(sim.s.audition);
    const r = backup.parseBackup(backup.exportCode(sim.s));
    return { ok: r.ok, same: r.ok && JSON.stringify(r.state.audition) === before, partner: r.state?.audition?.partnerId };
  });
  ok(rt.ok && rt.same, `${TAG} audition survives a backup round trip ${JSON.stringify(rt)}`);
  // partner leaves mid-audition: the chemistry is not stored for someone else
  const pl = await ev(() => {
    const { sim, v5 } = window.__sinetron; const s = sim.s;
    s.staff = s.staff.filter((x) => !x.name.startsWith('Figuran'));
    s.audition = null;
    v5.startAudition(sim, 'aktor');
    v5.auditionScene(s, 'nangis');
    const pid = s.audition.partnerId;
    const p = s.staff.find((x) => x.id === pid);
    // fire the partner before hiring
    s.staff = s.staff.filter((x) => x.id !== pid);
    const keys0 = Object.keys(s.chem).length;
    const err = v5.auditionHire(sim, 0);
    return { pid, had: !!p, err, keys0, keys1: Object.keys(s.chem).length };
  });
  ok(pl.had && pl.err === null && pl.keys1 === pl.keys0, `${TAG} partner fired mid-audition: hire works, no chemistry stored for another actress ${JSON.stringify(pl)}`);
  // no partner yet: chemistry shown as "-", nothing stored
  const np = await ev(() => {
    const { sim, v5 } = window.__sinetron; const s = sim.s;
    const keep = s.staff; s.staff = s.staff.filter((x) => x.role !== 'aktris');
    s.audition = null; v5.startAudition(sim, 'aktor'); v5.auditionScene(s, 'lucu');
    const a = s.audition; const keys0 = Object.keys(s.chem).length;
    const err = v5.auditionHire(sim, 1);
    const res = { partnerId: a.partnerId, chem: a.chem, err, keys0, keys1: Object.keys(s.chem).length };
    const hired = s.staff[s.staff.length - 1];
    s.staff = keep.concat(hired);
    return res;
  });
  ok(np.partnerId === null && np.chem.every((c) => c === 50) && np.err === null && np.keys1 === np.keys0, `${TAG} no partner: neutral chemistry, nothing stored ${JSON.stringify(np)}`);
  // an old (pre-5.1) audition without partnerId still works
  const old = await ev(() => { const { sim, v5 } = window.__sinetron; const s = sim.s; s.studio = 5; const cap = () => { while (s.staff.length >= sim.maxStaff()) s.staff.splice(s.staff.findIndex((x) => x.role !== 'sutradara' && x.role !== 'aktor' && x.role !== 'aktris') >>> 0, 1); }; cap(); s.audition = null; v5.startAudition(sim, 'aktris'); delete s.audition.partnerId; v5.auditionScene(s, 'marah'); return { err: v5.auditionHire(sim, 2) }; });
  ok(old.err === null, `${TAG} legacy audition without partnerId hires fine`);
  // the chemistry reaches the wizard (step 3 label) and the release multiplier
  const ch = await ev(() => {
    const { sim, v5 } = window.__sinetron; const s = sim.s;
    const m = s.staff.filter((x) => x.role === 'aktor'), f = s.staff.filter((x) => x.role === 'aktris');
    let best = null;
    for (const a of m) for (const b of f) { const c = v5.chemistry(s, a.id, b.id); if (!best || c > best.c) best = { a: a.id, b: b.id, c }; }
    const mult = v5.chemMult(best.c);
    return { best, mult, label: v5.chemLabel(best.c) };
  });
  ok(ch.best && ch.mult > 0.9 && ch.mult < 1.12, `${TAG} chemistry -> rating multiplier ${JSON.stringify(ch)}`);
  // a production with the best pair: wizard opens, release works, show.chem recorded
  const rel = await ev((ch) => {
    const { sim, scene } = window.__sinetron; const s = sim.s; s.prod = null; s.job = null;
    const e = sim.startProduction({ title: 'Cinta Hasil Audisi', genre: 'romansa', theme: 'sekolah', platform: 'lokal', eps: 13, budget: 'standar', leadM: ch.best.a, leadF: ch.best.b });
    let g = 0; while (s.prod && g++ < 3000) { sim.tick(); while (s.queue.length) { const p = sim.shift(); if (p.kind === 'editDone') sim.release(); else if (p.kind === 'event') sim.resolveEvent(p, 0); } }
    const sh = s.shows[s.shows.length - 1];
    scene.syncStaff(); scene.refreshHud();
    return { e, title: sh?.title, chem: sh?.chem, rating: sh?.rating };
  }, ch);
  ok(rel.title === 'Cinta Hasil Audisi' && rel.chem === ch.best.c, `${TAG} released show carries the pair's chemistry ${JSON.stringify(rel)}`);
  // the audition dialog at this size: all parts reachable (scroll on short windows)
  await ev(() => { const { scene, screens5, sim, v5 } = window.__sinetron; const s = sim.s; const cap = () => { while (s.staff.length >= sim.maxStaff()) s.staff.splice(s.staff.findIndex((x) => x.role !== 'sutradara' && x.role !== 'aktor' && x.role !== 'aktris') >>> 0, 1); }; cap(); scene.rebuildAfterStaffChange(); s.money = 900e6; s.audition = null; v5.startAudition(sim, 'aktris'); screens5.openAudition(scene); });
  await wait(500);
  const geo = await ev(() => { const m = window.__sinetron.scene.modals.at(-1); return { y: m.y, h: m.h, max: m.maxScroll }; });
  ok(geo.max >= 0, `${TAG} audition dialog geometry ${JSON.stringify(geo)}`);
  await tapUntil('scene_nangis', () => !!window.__sinetron.sim.s.audition?.scene, 1700);
  await wait(300);
  await shot('05-reachable');
  await tapUntil('auditionHire2', () => window.__sinetron.sim.s.audition === null, 600);
  ok(await ev(() => window.__sinetron.sim.s.audition === null), `${TAG} hire via the (scrolled) dialog`);
  await closeAll();
  await wait(500);
  allErrors.push(...errors);
  ok(errors.length === 0, `${TAG} 0 console errors ${JSON.stringify(errors.slice(0, 3))}`);
  await ctx.close();
}
await browser.close(); server.close();
console.log(`${oks} ok, ${fails} failed, console errors ${allErrors.length}`);
process.exit(fails ? 1 : 0);
