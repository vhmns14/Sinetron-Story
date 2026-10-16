// Real-browser audio check: music levels per track vs SFX, pause, override, no console errors.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve('dist');
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 780 } })).newPage();
const errors = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
const b = await page.locator('canvas').boundingBox(); const s = b.width / 360;
await page.mouse.click(b.x + 180 * s, b.y + 322 * s); await page.waitForTimeout(1500);
await page.mouse.click(b.x + 180 * s, b.y + 435 * s); await page.waitForTimeout(800);
await page.evaluate(() => { const { sfx } = window.__sinetron; const a = sfx.ctx.createAnalyser(); a.fftSize = 2048; sfx.master.connect(a); window.__an = a; });
const measure = (ms) => page.evaluate((ms) => new Promise((res) => { const a = window.__an; const buf = new Float32Array(a.fftSize); let peak = 0, sum = 0, n = 0; const t0 = performance.now(); const iv = setInterval(() => { a.getFloatTimeDomainData(buf); for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; } if (performance.now() - t0 > ms) { clearInterval(iv); res({ peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) }); } }, 20); }), ms);
const st = (fn, arg) => page.evaluate(fn, arg);
const out = {};
out.state = await st(() => ({ ctx: window.__sinetron.sfx.ctx.state, track: window.__sinetron.sfx.musicTrack }));
out.studio = await measure(4000);
for (const t of ['crunch', 'award', 'title']) { await st((t) => window.__sinetron.sfx.setMusicOverride(t), t); await page.waitForTimeout(1500); out[t] = await measure(4000); }
await st(() => window.__sinetron.sfx.setMusicOverride('silent')); await page.waitForTimeout(1500);
out.silent = await measure(800);
for (const k of ['roll', 'great', 'flop', 'drama', 'good']) { await st((k) => window.__sinetron.sfx.sting(k), k); out['sting_' + k] = await measure(k === 'roll' ? 1500 : 2500); await page.waitForTimeout(300); }
await st(() => window.__sinetron.sfx.setMusic(false)); await page.waitForTimeout(400);
await st(() => { const x = window.__sinetron.sfx; x.coin(); setTimeout(() => x.click(), 300); setTimeout(() => x.levelup(), 600); }); out.sfx_only = await measure(1200);
await st(() => { const x = window.__sinetron.sfx; x.setMusic(true); x.setMusicOverride(null); });
await page.waitForTimeout(1500);
await st(() => window.__sinetron.scene.setSpeed(0)); await page.waitForTimeout(1200);
out.paused = await measure(1500); out.pausedState = await st(() => ({ track: window.__sinetron.sfx.musicTrack }));
await st(() => window.__sinetron.scene.setSpeed(1)); await page.waitForTimeout(1200);
out.resumed = await measure(2000);
console.log(JSON.stringify(out, null, 1));
const filtered = errors.filter((e) => !/GPU stall|swiftshader|WebGL|GL Driver|Automatic fallback/i.test(e));
console.log('console errors:', filtered.length, filtered.slice(0, 5));
await browser.close(); server.close();
