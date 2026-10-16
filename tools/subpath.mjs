// Serve dist under a GitHub-Pages-like subpath (/sinetron-story/) and verify boot + SW + manifest.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve('dist'); const PREFIX = '/sinetron-story/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end('outside subpath: ' + p); }
  p = p.slice(PREFIX.length - 1); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
page.on('pageerror', (e) => bad.push('pageerror ' + e.message));
await page.goto(`http://localhost:${server.address().port}${PREFIX}`);
await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const l = document.querySelector('link[rel=manifest]'); const m = await (await fetch(l.href)).json(); return { scope: r && r.scope, manifest: m.name, start: m.start_url, display: m.display, orientation: m.orientation, icons: m.icons.map((i) => i.sizes + (i.purpose ? '/' + i.purpose : '')) }; });
console.log('SUBPATH', JSON.stringify(info), 'bad responses:', JSON.stringify(bad));
// offline reload from service worker cache
await page.context().setOffline(true);
await page.reload();
const offline = await page.waitForFunction(() => window.__game && window.__game.scene.isActive('Title'), null, { timeout: 20000 }).then(() => true).catch(() => false);
console.log('OFFLINE BOOT', offline);
await b.close(); server.close();
