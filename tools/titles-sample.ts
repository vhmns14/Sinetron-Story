// Prints random sinetron titles across genre x theme and sanity-checks the pools.
// Run: npx rolldown tools/titles-sample.ts --file .titles.mjs --platform node && node .titles.mjs [count] [seed]
import { makeTitle, WHOLE, THEME_WHOLE, TEMPLATES, VOCAB, RIVAL_TITLES, criticComment, __critics, __favCritics } from '../src/titles';
import { GENRES, THEMES } from '../src/data';

const N = Number(process.argv[2] ?? 40);
let seed = Number(process.argv[3] ?? Date.now() % 100000);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// Real titles we must never output verbatim (spot list, lowercase)
const REAL = ['ikatan cinta', 'tukang ojek pengkolan', 'dari jendela smp', 'anak jalanan', 'para pencari tuhan', 'preman pensiun', 'bidadari',
  'cinta fitri', 'tukang bubur naik haji', 'putri yang ditukar', 'suami pengganti', 'anak langit', 'samudra cinta', 'kumenangis', 'magic 5',
  'bawang merah bawang putih', 'si doel anak sekolahan', 'tersanjung', 'cinta setelah cinta', 'buku harian seorang istri', 'tutur tinular',
  'suster ngesot', 'hidayah', 'azab', 'kisah nyata', 'mermaid in love', 'malam satu suro', 'tetangga masa gitu', '7 manusia harimau', 'pabrik gula',
  'jodoh wasiat bapak', 'di antara dua cinta', 'pintu berkah', 'istikharah cinta', 'juragan jengkol', 'kemilau cinta kamila', 'cinta suci'];

let fails = 0;
const fail = (m: string) => { fails++; console.log('  !! ' + m); };

// pool sizes
for (const g of GENRES) {
  const n = WHOLE[g.id]?.length ?? 0;
  if (n < 25) fail(`genre ${g.id}: only ${n} whole titles`);
  if (!TEMPLATES[g.id]) fail(`genre ${g.id}: no templates`);
}
for (const t of THEMES) if (!VOCAB[t.id]) fail(`theme ${t.id}: no vocab`); else if (!THEME_WHOLE[t.id]) fail(`theme ${t.id}: no themed titles`);

// samples
console.log(`--- ${N} random titles (seed ${seed}) ---`);
for (let i = 0; i < N; i++) {
  const g = GENRES[Math.floor(rnd() * GENRES.length)], t = THEMES[Math.floor(rnd() * THEMES.length)];
  const s = makeTitle(g.id, t.id, rnd);
  console.log(`${(g.name + ' x ' + t.name).padEnd(28)} ${s}`);
}

// exhaustive-ish checks
const all = new Set<string>();
for (const g of GENRES) for (const t of THEMES) for (let i = 0; i < 300; i++) {
  const s = makeTitle(g.id, t.id, rnd);
  all.add(s);
  if (/[{}]/.test(s)) fail('unfilled slot: ' + s);
  if (/\s{2,}|^\s|\s$/.test(s)) fail('spacing: ' + JSON.stringify(s));
  if (REAL.includes(s.toLowerCase())) fail('real title verbatim: ' + s);
  if (s.length > 64) fail('too long: ' + s);
}
console.log(`distinct titles reachable (sampled): ${all.size}`);

// no-repeat against history
const used: string[] = [];
for (let i = 0; i < 60; i++) used.push(makeTitle('azab', 'kampung', rnd, { used }));
if (new Set(used.map((x) => x.toLowerCase())).size !== used.length) fail('repeat despite used list');

// sequels only for hits
const hist = [{ title: 'Jagoan Pasar Subuh', genre: 'laga', theme: 'pasar', total: 33 }];
const seqs = new Set<string>();
for (let i = 0; i < 400; i++) { const s = makeTitle('laga', 'pasar', rnd, { history: hist }); if (s.startsWith('Jagoan Pasar Subuh ')) seqs.add(s); }
console.log('sequels for a hit:', [...seqs].join(' | ') || '(none)');
const flop = [{ title: 'Jagoan Pasar Subuh', genre: 'laga', theme: 'pasar', total: 14 }];
for (let i = 0; i < 400; i++) { const s = makeTitle('laga', 'pasar', rnd, { history: flop }); if (/ (2|Season 2|Reborn)$/.test(s) && s.startsWith('Jagoan Pasar Subuh')) { fail('sequel of a flop: ' + s); break; } }
for (const r of RIVAL_TITLES) if (REAL.includes(r.toLowerCase())) fail('rival is real: ' + r);

console.log('--- critic lines ---');
for (const [band, lines] of Object.entries(__critics)) {
  if (lines.length < 6) fail(`band ${band}: ${lines.length} lines`);
  console.log(`band ${band}: ${lines.join(' / ')}`);
}
for (const [k, [lo, hi]] of Object.entries(__favCritics)) console.log(`fav ${k}: low ${lo.join(' / ')} | high ${hi.join(' / ')}`);
const four = [9, 9, 9, 9].reduce<string[]>((a, v) => { a.push(criticComment(v, rnd, a, 'drama')); return a; }, []);
if (new Set(four).size !== 4) fail('duplicate critic lines in one review');
console.log(fails ? `FAILED: ${fails}` : 'title checks OK');
process.exitCode = fails ? 1 : 0;
