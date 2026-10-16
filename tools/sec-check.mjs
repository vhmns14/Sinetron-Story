// v5.1 security check (real Chromium):
//  1. dist served with its real _headers: headers present, 0 CSP violations / console errors while playing
//  2. backup import fuzzing: prototype pollution, oversize, deep nesting, bad ids, NaN/Infinity, HTML in names
//  3. sinetron-story-single.html + -preview.html inside a sandboxed iframe (allow-scripts only): boots, 0 errors
//  4. static checks: no inline <script> in dist/index.html, no third-party URLs in the bundle, SW precaches same-origin only
// usage: node tools/sec-check.mjs [dist] [dir with the single/preview html]
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const DIST = path.resolve(process.argv[2] ?? 'dist');
const HTML_DIR = path.resolve(process.argv[3] ?? '..');
let fails = 0, oks = 0;
const ok = (c, m) => { console.log(c ? '  ok' : '  FAIL', m); if (c) oks++; else fails++; };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

// ---------------------------------------------------------------- 4. static
{
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'dist/index.html has no inline <script>');
  const js = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8')).join('\n');
  ok(!/\beval\s*\(|new Function\s*\(/.test(js), 'bundle has no eval / new Function');
  const urls = [...new Set([...js.matchAll(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0]))];
  const third = urls.filter((u) => !/(w3\.org|kodekecil\.my\.id|github\.com\/phaserjs|phaser\.io|localhost|example\.)/i.test(u));
  console.log('    URLs in bundle:', urls.join(' ') || '-');
  ok(!/<script[^>]+src=["']https?:/i.test(html) && !/import\(["']https?:/.test(js), 'no third-party scripts loaded (html / dynamic import)');
  ok(third.length === 0, `no unexpected third-party hosts in the bundle ${JSON.stringify(third)}`);
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  ok(!/registerRoute\([^)]*https?:/.test(sw) && !/https?:\/\//.test(sw.replace(/https?:\/\/(www\.)?w3\.org[^"']*/g, '')), 'service worker: no cross-origin routes / URLs');
  ok(!/runtimeCaching|NetworkFirst|StaleWhileRevalidate|CacheFirst/.test(sw), 'service worker: precache only (no runtime caching of arbitrary responses)');
  const hdr = fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
  ok(!hdr.includes('__STYLE_HASHES__') && /style-src 'self' 'sha256-/.test(hdr), '_headers: CSP style hash filled in');
  ok(!/unsafe-inline|unsafe-eval/.test(hdr.split('\n').find((l) => l.includes('Content-Security-Policy')) ?? ''), 'CSP has no unsafe-inline / unsafe-eval');
  const repo = ['wrangler.embed.jsonc', 'package.json', 'vite.config.ts', 'vite.single.config.ts'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  // literal credentials only (Phaser's loader has empty user/password XHR options)
  const secretRe = /(api[_-]?token|CLOUDFLARE_API_TOKEN|bearer\s+[A-Za-z0-9._-]{12,}|password\s*[:=]\s*["'`][^"'`]{4,}|secret\s*[:=]\s*["'`][^"'`]{4,}|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/i;
  const wr = fs.readFileSync('wrangler.embed.jsonc', 'utf8');
  ok(!secretRe.test(repo + js), 'no tokens / secrets in config or bundle');
  ok(/"account_id"/.test(wr) && !/(api_token|token|secret|key)"?\s*:/i.test(wr.replace(/"account_id"[^,\n]*/, '')), 'wrangler config: only account_id (no token / secret / key)');
}

const browser = await chromium.launch({ args: ARGS });
// ---------------------------------------------------------------- 1. headers + CSP while playing
{
  const { server, port } = await serve(DIST);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  const resp = await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  const h = resp.headers();
  ok(/default-src 'self'/.test(h['content-security-policy'] ?? '') && /frame-ancestors/.test(h['content-security-policy']), 'CSP header served');
  ok(h['x-content-type-options'] === 'nosniff' && h['referrer-policy'] === 'no-referrer' && /camera=\(\)/.test(h['permissions-policy'] ?? ''), 'nosniff / Referrer-Policy / Permissions-Policy served');
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const t = window.__game.scene.getScene('Title'); const s = window.__newGameForTests(); s.tut = -1; t.scene.start('Game', { state: s }); });
  await page.waitForFunction(() => window.__game.scene.isActive('Game') && !!window.__sinetron, null, { timeout: 30000 });
  // play a little + open the screens that build textures at runtime (map, charts, feed), backup overlay
  await page.evaluate(async () => {
    const { scene, screens, screens3, screens5, sim, backup } = window.__sinetron;
    const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 300; i++) { sim.tick(); while (sim.s.queue.length) { const p = sim.shift(); if (p.kind === 'event') sim.resolveEvent(p, 0); else if (p.kind === 'editDone') sim.release(); } }
    screens.openMenu(scene); await sl(300); scene.modals.at(-1).close();
    screens3.openMap?.(scene); await sl(400); while (scene.modals.length) scene.modals.at(-1).close();
    screens5.openFeed(scene); await sl(300); scene.modals.at(-1).close();
    const p = backup.exportPanel(sim.s); await sl(300); p.close();
    const q = backup.importPanel(() => {}); await sl(200); q.close();
  });
  await page.waitForTimeout(2500);
  // the service worker registers under CSP (worker-src 'self')
  const sw = await page.evaluate(async () => { try { const r = await navigator.serviceWorker.getRegistration(); return r ? r.scope : 'none'; } catch (e) { return 'err ' + e.message; } });
  console.log('    SW scope:', sw);
  ok(sw.startsWith(`http://localhost:${port}/`), 'service worker registered with the app scope under the CSP');
  const csp = await page.evaluate(() => window.__csp);
  ok(csp.length === 0, `0 CSP violations ${JSON.stringify(csp.slice(0, 5))}`);
  ok(errors.length === 0, `0 console errors / warnings ${JSON.stringify(errors.slice(0, 5))}`);

  // ------------------------------------------------------------ 2. backup import fuzzing (same page, game running)
  const res = await page.evaluate(() => {
    const { backup, sim } = window.__sinetron;
    const good = JSON.parse(backup.exportJSON(sim.s));
    const enc = (o) => 'SINETRON:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
    const clone = () => JSON.parse(JSON.stringify(good));
    const out = {};
    const t = (name, text) => { let r; try { r = backup.parseBackup(text); } catch (e) { r = { ok: false, threw: e.message }; } out[name] = { ok: r.ok, err: r.error ?? r.threw ?? null, st: r.state ?? null }; };
    t('good', JSON.stringify(good));
    t('goodCode', enc(good));
    // prototype pollution via __proto__ / constructor.prototype at the top level and nested
    t('protoTop', JSON.stringify(good).replace('{"app"', '{"__proto__":{"polluted":1},"app"'));
    t('protoSave', JSON.stringify(good).replace('"save":{', '"save":{"__proto__":{"polluted":2},"constructor":{"prototype":{"polluted":3}},'));
    t('protoNested', JSON.stringify(good).replace('"staff":[{', '"staff":[{"__proto__":{"polluted":4},'));
    // html / script in a name: must stay plain text (canvas + textContent only)
    const h = clone(); h.save.staff[0].name = '<img src=x onerror="window.__xss=1">'; h.save.shows = []; t('htmlName', JSON.stringify(h));
    // numbers: Infinity via 1e999, NaN-ish, huge
    t('inf', JSON.stringify(good).replace(/"money":[-0-9.e]+/, '"money":1e999'));
    const n = clone(); n.save.fans = -5; n.save.staff[0].energy = 1e9; n.save.staff[0].stats = Object.fromEntries(Object.keys(n.save.staff[0].stats).map((k) => [k, 1e300])); t('clamp', JSON.stringify(n));
    // wrong ids / types
    const g = clone(); if (g.save.shows[0]) g.save.shows[0].genre = 'hacked'; else g.save.shows.push({ id: 999, title: 'x', genre: 'hacked', theme: 'x', platform: 'x' }); t('badGenre', JSON.stringify(g));
    const r = clone(); r.save.staff[0].role = 'admin'; t('badRole', JSON.stringify(r));
    const ty = clone(); ty.save.staff = 'nope'; t('badType', JSON.stringify(ty));
    t('array', '[1,2,3]');
    t('null', 'null');
    t('notJson', '{"app": sinetron');
    t('badB64', 'SINETRON:%%%$$$');
    t('otherApp', JSON.stringify({ app: 'other', save: good.save }));
    t('newer', JSON.stringify({ ...good, save: { ...good.save, version: 2 } }));
    // deep nesting + oversize
    let deep = '1'; for (let i = 0; i < 5000; i++) deep = '[' + deep + ']';
    const d = JSON.stringify(good).replace('"save":{', `"save":{"deep":${deep},`); t('deep', d);
    t('huge', JSON.stringify(good) + ' '.repeat(5 * 1024 * 1024));
    const big = clone(); big.save.feed = Array.from({ length: 20000 }, () => ({ t: 'x' })); t('bigArray', JSON.stringify(big));
    const polluted = ({}).polluted !== undefined || Object.prototype.polluted !== undefined;
    const sum = (v) => ({ ok: v.ok, err: v.err, money: v.st?.money, fans: v.st?.fans, energy: v.st?.staff?.[0]?.energy, stat: v.st ? Math.max(...Object.values(v.st.staff[0].stats)) : null, name: v.st?.staff?.[0]?.name,
      ownProto: v.st ? Object.prototype.hasOwnProperty.call(v.st, '__proto__') || Object.getPrototypeOf(v.st) !== Object.prototype || Object.prototype.hasOwnProperty.call(v.st, 'constructor') || Object.prototype.hasOwnProperty.call(v.st.staff[0], '__proto__') : null });
    return { out: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, sum(v)])), polluted };
  });
  const o = res.out;
  for (const [k, v] of Object.entries(o)) console.log(`    ${k}: ${JSON.stringify(v)}`);
  ok(o.good.ok && o.goodCode.ok, 'valid backup (JSON + code) accepted');
  ok(!res.polluted, 'Object.prototype not polluted');
  ok(['protoTop', 'protoSave', 'protoNested'].every((k) => !o[k].ok || o[k].ownProto === false), '__proto__ / constructor keys dropped (no own __proto__ / constructor, plain prototype)');
  ok(o.htmlName.ok && o.htmlName.name.includes('<img'), 'HTML in a name stays a plain string (rendered as canvas text)');
  ok(o.inf.ok && Number.isFinite(o.inf.money), `Infinity money clamped -> ${o.inf.money}`);
  ok(o.clamp.ok && o.clamp.fans === 0 && o.clamp.energy === 100 && o.clamp.stat <= 1e5, `numbers clamped ${JSON.stringify(o.clamp)}`);
  ok(!o.badGenre.ok && !o.badRole.ok && !o.badType.ok, 'unknown genre / role / wrong types rejected');
  ok(['array', 'null', 'notJson', 'badB64', 'otherApp', 'newer'].every((k) => !o[k].ok), 'garbage / other app / newer version rejected');
  ok(!o.deep.ok && !o.huge.ok && !o.bigArray.ok, 'deep nesting / oversize / huge arrays rejected');
  const xss = await page.evaluate(async () => {
    const { backup } = window.__sinetron;
    // the confirmation summary goes through the DOM overlay too: render a panel with HTML text and look for elements
    const p = backup.domPanel({ title: '<b id="xx">t</b>', text: '<img id="yy" src=x onerror="window.__xss=1">', buttons: [] });
    await new Promise((r) => setTimeout(r, 300));
    const found = !!document.getElementById('xx') || !!document.getElementById('yy');
    p.close();
    return { found, xss: window.__xss ?? 0 };
  });
  ok(!xss.found && !xss.xss, 'DOM overlay renders text, never HTML (textContent)');
  // localStorage: corrupted save is kept aside, the title still boots
  await page.evaluate(() => { localStorage.setItem('sinetron-story-save-v1', '{"version":1,"staff":"x"'); window.__game.scene.getScene('Game').scene.start('Title'); });
  await page.waitForTimeout(1500);
  const ls = await page.evaluate(() => ({ title: window.__game.scene.isActive('Title'), load: (() => { try { return window.__game.scene.getScene('Title').continueGame ? 'ok' : 'none'; } catch (e) { return e.message; } })() }));
  ok(ls.title, 'corrupted localStorage save: title still boots');
  await ctx.close(); server.close();
  ok(errors.length === 0, `0 console errors after fuzzing ${JSON.stringify(errors.slice(0, 5))}`);
}
// ---------------------------------------------------------------- 3. single / preview in a sandboxed iframe
for (const f of ['sinetron-story-single.html', 'sinetron-story-preview.html']) {
  const file = path.join(HTML_DIR, f);
  if (!fs.existsSync(file)) { ok(false, `${f} exists`); continue; }
  const srv = http.createServer((req, res) => {
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(`<!doctype html><body style="margin:0;background:#000"><iframe id="f" sandbox="allow-scripts" src="/game.html" style="border:0;width:1280px;height:600px"></iframe></body>`); return; }
    if (req.url === '/game.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); fs.createReadStream(file).pipe(res); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => srv.listen(0, r));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(`http://localhost:${srv.address().port}/`, { waitUntil: 'load' });
  const frame = await (await page.$('#f')).contentFrame();
  let booted = false;
  try { await frame.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 45000 }); booted = true; } catch { /* reported below */ }
  if (booted) {
    await frame.waitForTimeout(800);
    // start a game through the real button (localStorage is blocked in an opaque-origin sandbox: must not crash)
    await frame.evaluate(() => { const t = window.__game.scene.getScene('Title'); const s = window.__newGameForTests(); s.tut = -1; t.scene.start('Game', { state: s }); });
    await frame.waitForTimeout(2500);
  }
  const st = booted ? await frame.evaluate(() => ({ game: window.__game.scene.isActive('Game'), origin: location.origin })) : {};
  await page.screenshot({ path: path.join(path.resolve('../shots/v5fix'), `sec-iframe-${f.replace('.html', '')}.png`) });
  ok(booted && st.game, `${f} in <iframe sandbox="allow-scripts"> boots and starts a game (origin ${st.origin})`);
  ok(errors.length === 0, `${f} sandboxed: 0 console errors ${JSON.stringify(errors.slice(0, 4))}`);
  await ctx.close(); srv.close();
}
await browser.close();
console.log(`${oks} ok, ${fails} failed`);
process.exit(fails ? 1 : 0);
