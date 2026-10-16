// Node-level test of the music sequencer with a mocked AudioContext.
// Run: npx rolldown tools/audio-test.ts --file .audio-test.mjs --platform node && node .audio-test.mjs
let fails = 0;
const fail = (m: string) => { fails++; console.log('  !! ' + m); };

// ---- minimal WebAudio mock
let nodes = 0, maxFutureStart = 0;
const clock = { t: 0 };
class Param { value = 0; setValueAtTime(v: number) { this.value = v; return this; } linearRampToValueAtTime(v: number) { this.value = v; return this; }
  exponentialRampToValueAtTime(v: number) { if (!(v > 0)) throw new Error('exp ramp to non-positive'); this.value = v; return this; }
  setTargetAtTime(v: number) { this.value = v; return this; } cancelScheduledValues() { return this; } }
class Node { connect(n: unknown) { return n; } disconnect() { /* */ } }
class Osc extends Node { type = 'sine'; frequency = new Param(); detune = new Param(); start(t = 0) { if (!Number.isFinite(t)) throw new Error('bad start'); maxFutureStart = Math.max(maxFutureStart, t - clock.t); } stop(t = 0) { if (!Number.isFinite(t)) throw new Error('bad stop'); } }
class Gain extends Node { gain = new Param(); }
class Filter extends Node { type = 'lowpass'; frequency = new Param(); Q = new Param(); }
class Src extends Node { buffer: unknown = null; start(t = 0) { if (!Number.isFinite(t)) throw new Error('bad start'); } stop() { /* */ } }
class Comp extends Node { threshold = new Param(); ratio = new Param(); attack = new Param(); release = new Param(); }
class MockCtx {
  state = 'running'; sampleRate = 8000; destination = new Node();
  get currentTime() { return clock.t; }
  createGain() { nodes++; return new Gain(); } createOscillator() { nodes++; return new Osc(); } createBiquadFilter() { nodes++; return new Filter(); }
  createBufferSource() { nodes++; return new Src(); } createDynamicsCompressor() { return new Comp(); }
  createBuffer(_c: number, n: number) { const d = new Float32Array(n); return { getChannelData: () => d }; }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
const intervals: (() => void)[] = [];
const listeners: Record<string, (() => void)[]> = {};
const doc = { hidden: false, addEventListener: (k: string, f: () => void) => { (listeners[k] ??= []).push(f); } };
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = { getItem: () => null, setItem: () => undefined };
g.document = doc;
g.window = { setInterval: (f: () => void) => { intervals.push(f); return intervals.length; } };

async function main() {
  // 1) no AudioContext available: everything must be a silent no-op
  const { sfx: s0 } = await import('../src/audio');
  try {
    s0.unlock(); s0.playMusic('studio'); s0.setMusicOverride('award'); s0.sting('roll'); s0.sting('flop'); s0.stopStings(); s0.setPaused(true);
    s0.click(); s0.fanfare(); s0.setMusic(false); s0.setMuted(true); s0.setMuted(false); s0.setMusic(true); s0.setPaused(false); s0.setMusicOverride(null);
    console.log('no-AudioContext path: OK');
  } catch (e) { fail('crash without AudioContext: ' + (e as Error).message); }

  // 2) with a mocked AudioContext
  g.AudioContext = MockCtx;
  const { sfx, __music } = await import('../src/audio');
  // track structure
  for (const [id, spec] of Object.entries(__music.SPECS)) {
    const tr = __music.compile(spec);
    const secs = (tr.total / 16) * (60 / tr.bpm) * 4;
    const loopSecs = ((tr.total - tr.loopStart) / 16) * (60 / tr.bpm) * 4;
    const notes = tr.steps.reduce((a, s) => a + s.length, 0);
    console.log(`track ${id.padEnd(7)} ${tr.bpm} bpm, ${tr.total / 16} bars, ${secs.toFixed(1)}s (loop ${loopSecs.toFixed(1)}s), ${notes} events`);
    for (const [name, sec] of Object.entries(spec.sections)) {
      for (const key of ['lead', 'counter'] as const) {
        const str = sec[key]; if (!str) continue;
        const n = str.trim().split(/\s+/).length;
        if (n !== sec.bars * 8 && n !== sec.bars * 16) fail(`${id}.${name}.${key}: ${n} tokens for ${sec.bars} bars`);
        for (const t of str.trim().split(/\s+/)) if (t !== '.' && t !== '-' && !__music.noteNum(t)) fail(`${id}.${name}: bad note ${t}`);
      }
    }
    if (tr.steps.some((s) => s.some((e) => !e.drum && !(e.midi > 20 && e.midi < 110)))) fail(`${id}: midi out of range`);
  }
  sfx.unlock();
  if (!intervals.length) fail('scheduler not started');
  const tick = (sec: number) => { for (let x = 0; x < sec; x += 0.025) { clock.t += 0.025; intervals.forEach((f) => f()); } };
  sfx.playMusic('title'); tick(3);
  if (sfx.musicTrack !== 'title') fail('title not playing');
  const n0 = nodes; tick(5); if (nodes === n0) fail('title produced no nodes');
  if (maxFutureStart > 0.25) fail(`lookahead too far: ${maxFutureStart}`);
  sfx.playMusic('studio'); tick(2); sfx.playMusic('crunch'); tick(2); sfx.playMusic('studio'); tick(60); // full loop incl. wrap
  if (sfx.musicTrack !== 'studio') fail('studio not current');
  if (maxFutureStart > 0.25) fail(`loop lookahead too far: ${maxFutureStart}`);
  const loopLook = maxFutureStart;
  sfx.setMusicOverride('silent'); sfx.sting('roll'); tick(1.4); sfx.stopStings(); sfx.sting('great'); tick(3); sfx.sting('good'); sfx.sting('flop'); sfx.sting('drama'); tick(3);
  try { (sfx.sting as (x: unknown) => void)('nope'); } catch { fail('sting with unknown id crashed'); }
  if (sfx.musicTrack !== null) fail('silent override not silent');
  sfx.setMusicOverride('award'); tick(45); sfx.setMusicOverride(null); tick(2);
  if (sfx.musicTrack !== 'studio') fail('override did not restore studio');
  // pause: no new nodes while paused
  sfx.setPaused(true); tick(0.5); const p0 = nodes; tick(4); if (nodes !== p0) fail(`nodes created while paused: ${nodes - p0}`);
  sfx.setPaused(false); tick(2); if (nodes === p0) fail('did not resume after pause');
  // music off: no music nodes
  sfx.setMusic(false); tick(0.3); const m0 = nodes; tick(3); if (nodes !== m0) fail('music nodes while music off');
  sfx.sting('great'); // falls back to SFX (some nodes OK)
  sfx.setMusic(true);
  // tab hidden -> context suspended, scheduler idles
  doc.hidden = true; listeners.visibilitychange?.forEach((f) => f()); await Promise.resolve();
  const h0 = nodes; tick(3); if (nodes !== h0) fail('scheduling while tab hidden');
  doc.hidden = false; listeners.visibilitychange?.forEach((f) => f()); await Promise.resolve(); tick(1);
  if (nodes === h0) fail('not resumed after tab visible');
  // a long stall must not burst-schedule
  clock.t += 10; const b0 = nodes; intervals.forEach((f) => f()); if (nodes - b0 > 400) fail(`burst after stall: ${nodes - b0}`);
  console.log(`total mock nodes created: ${nodes}, loop lookahead ${loopLook.toFixed(3)}s`);
  console.log(fails ? `FAILED: ${fails}` : 'audio checks OK');
  process.exitCode = fails ? 1 : 0;
}
void main();
