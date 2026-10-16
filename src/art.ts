// Procedural pixel art: everything is drawn into canvases at boot.
import Phaser from 'phaser';
import type { Look } from './state';

export const OUT = '#2b1a10';

export function hex(n: number): string { return '#' + (n & 0xffffff).toString(16).padStart(6, '0'); }
export function shade(n: number, f: number): number {
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export class P {
  constructor(public ctx: CanvasRenderingContext2D, public ox = 0, public oy = 0) {}
  r(x: number, y: number, w: number, h: number, col: string | number) {
    this.ctx.fillStyle = typeof col === 'number' ? hex(col) : col;
    this.ctx.fillRect(x + this.ox, y + this.oy, w, h);
  }
  p(x: number, y: number, col: string | number) { this.r(x, y, 1, 1, col); }
  /** rect with 1px dark outline */
  box(x: number, y: number, w: number, h: number, fill: string | number, out: string | number = OUT) {
    this.r(x, y, w, h, out);
    this.r(x + 1, y + 1, w - 2, h - 2, fill);
  }
}

/** add a 1px outline around all opaque pixels */
export function outline(c: HTMLCanvasElement, col = OUT) {
  const ctx = c.getContext('2d')!;
  const w = c.width, h = c.height;
  const d = ctx.getImageData(0, 0, w, h);
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d.data[i * 4 + 3] > 40 ? 1 : 0;
  const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (a[i]) continue;
    if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) {
      d.data[i * 4] = r; d.data[i * 4 + 1] = g; d.data[i * 4 + 2] = b; d.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(d, 0, 0);
}

export function addTex(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

// ---------------------------------------------------------------- characters
export type Face = 'normal' | 'cry' | 'laugh' | 'bored' | 'shock' | 'shout';
export interface ChibiOpts { face?: Face; pattern?: 'batik' | 'stripe' | null; old?: boolean }

export const CH_W = 18, CH_H = 24;

/** frame: 0 idle, 1 walkA, 2 walkB, 3 workA, 4 workB */
export function chibi(look: Look, frame: number, o: ChibiOpts = {}): HTMLCanvasElement {
  const [c, ctx] = mk(CH_W, CH_H);
  const q = new P(ctx, 0, 2);
  const S = look.skin, SS = shade(S, 0.86);
  const H = look.hair, HH = shade(H, 1.45), HD = shade(H, 0.75);
  const C = look.shirt, C2 = shade(C, 0.78);
  const PN = look.pants, PN2 = shade(PN, 0.8);
  const shoe = '#3a2418';
  const st = look.style;

  // back hair
  if (st === 'long') q.r(2, 2, 14, 12, HD);
  if (st === 'bob') q.r(2, 2, 14, 8, HD);
  if (st === 'ponytail') { q.r(14, 2, 3, 3, H); q.r(15, 4, 2, 6, HD); }

  // legs / skirt
  const lA = frame === 1, lB = frame === 2;
  if (look.female && st !== 'hijab') {
    q.r(4, 16, 10, 3, PN); q.r(4, 18, 10, 1, PN2);
    q.r(6, 19, 2, lA ? 0 : 1, S); q.r(10, 19, 2, lB ? 0 : 1, S);
    q.r(5, lA ? 19 : 20, 3, 1, shoe); q.r(10, lB ? 19 : 20, 3, 1, shoe);
  } else if (look.female) {
    // long gamis skirt
    q.r(4, 16, 10, 4, PN); q.r(4, 19, 10, 1, PN2);
    q.r(5, lA ? 19 : 20, 3, 1, shoe); q.r(10, lB ? 19 : 20, 3, 1, shoe);
  } else {
    q.r(5, 16, 8, 1, PN2);
    q.r(5, 17, 3, lA ? 2 : 3, PN); q.r(10, 17, 3, lB ? 2 : 3, PN);
    q.r(5, lA ? 19 : 20, 3, 1, shoe); q.r(10, lB ? 19 : 20, 3, 1, shoe);
  }
  // body
  q.r(5, 11, 8, 5, C); q.r(12, 11, 1, 5, C2); q.r(5, 15, 8, 1, C2);
  if (o.pattern === 'batik') { for (let y = 11; y < 16; y++) for (let x = 5 + (y % 2); x < 13; x += 2) q.p(x, y, shade(C, 0.6)); q.r(5, 11, 8, 1, shade(C, 1.25)); }
  if (o.pattern === 'stripe') { q.r(5, 12, 8, 1, '#ffffff'); q.r(5, 14, 8, 1, '#ffffff'); }
  // collar
  q.p(8, 11, shade(C, 1.25)); q.p(9, 11, shade(C, 1.25));
  // arms
  if (frame === 3) {
    q.p(4, 11, C); q.p(3, 10, C); q.p(2, 9, S); q.r(13, 12, 1, 3, C); q.p(13, 15, S);
  } else if (frame === 4) {
    q.r(4, 12, 1, 3, C); q.p(4, 15, S); q.p(13, 11, C); q.p(14, 10, C); q.p(15, 9, S);
  } else {
    const sw = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    q.r(4, 12, 1, 3 + (sw < 0 ? -1 : 0), C2); q.p(4, sw < 0 ? 14 : 15, S);
    q.r(13, 12, 1, 3 + (sw > 0 ? -1 : 0), C2); q.p(13, sw > 0 ? 14 : 15, S);
  }
  // head
  q.r(5, 0, 8, 1, S); q.r(4, 1, 10, 1, S); q.r(3, 2, 12, 7, S); q.r(4, 9, 10, 1, S); q.r(5, 10, 8, 1, S);
  q.r(4, 9, 10, 1, SS); q.r(13, 3, 1, 6, SS);
  // ears
  q.p(2, 5, S); q.p(15, 5, S);

  // hijab goes before face features
  if (st === 'hijab') {
    q.r(4, -1, 10, 1, H); q.r(3, 0, 12, 1, H); q.r(2, 1, 14, 11, H);
    q.r(5, 3, 8, 7, S); q.r(6, 10, 6, 1, S); q.r(12, 3, 1, 6, SS); q.r(5, 9, 8, 1, SS);
    q.r(3, 11, 12, 2, H); q.r(4, 13, 10, 1, shade(H, 0.85));
    q.r(5, 0, 4, 1, HH);
  }

  // face
  const face = o.face ?? 'normal';
  const E = OUT;
  if (face === 'normal' || face === 'shout') {
    q.r(6, 5, 1, 2, E); q.r(11, 5, 1, 2, E);
    q.p(5, 7, '#f29a8a'); q.p(12, 7, '#f29a8a');
    if (face === 'shout') { q.r(7, 8, 4, 2, '#7a1e14'); q.r(8, 9, 2, 1, '#e05a5a'); q.r(5, 4, 2, 1, E); q.r(11, 4, 2, 1, E); }
    else q.r(8, 8, 2, 1, '#b8503c');
  } else if (face === 'cry') {
    q.r(5, 5, 2, 1, E); q.r(11, 5, 2, 1, E);
    q.r(6, 6, 1, 4, '#4aa8ff'); q.r(11, 6, 1, 4, '#4aa8ff'); q.p(6, 6, '#bfe4ff'); q.p(11, 6, '#bfe4ff');
    q.r(7, 8, 4, 1, '#7a1e14'); q.p(7, 9, '#7a1e14'); q.p(10, 9, '#7a1e14');
  } else if (face === 'laugh') {
    q.p(5, 6, E); q.p(6, 5, E); q.p(7, 6, E); q.p(10, 6, E); q.p(11, 5, E); q.p(12, 6, E);
    q.r(7, 8, 4, 2, '#7a1e14'); q.r(8, 9, 2, 1, '#e05a5a');
    q.p(5, 7, '#f29a8a'); q.p(12, 7, '#f29a8a');
  } else if (face === 'bored') {
    q.r(5, 5, 3, 1, SS); q.p(6, 6, E); q.r(10, 5, 3, 1, SS); q.p(11, 6, E);
    q.r(8, 8, 2, 1, E);
  } else if (face === 'shock') {
    q.r(5, 4, 2, 3, '#ffffff'); q.r(11, 4, 2, 3, '#ffffff'); q.p(6, 5, E); q.p(11, 5, E);
    q.r(8, 8, 2, 2, '#7a1e14');
  }
  if (look.glasses) {
    const G = '#2a2a3a';
    q.r(5, 4, 3, 1, G); q.r(10, 4, 3, 1, G); q.p(5, 5, G); q.p(7, 5, G); q.p(10, 5, G); q.p(12, 5, G);
    q.r(8, 5, 2, 1, G); q.r(5, 6, 3, 1, G); q.r(10, 6, 3, 1, G);
    if (face === 'normal' || face === 'shout') { q.p(6, 5, E); q.p(11, 5, E); }
  }

  // front hair
  if (st === 'short' || st === 'spiky' || st === 'long' || st === 'bob' || st === 'bun' || st === 'ponytail') {
    q.r(5, -1, 8, 1, H); q.r(4, 0, 10, 1, H); q.r(3, 1, 12, 2, H);
    if (st === 'short' || st === 'spiky') {
      q.r(3, 3, 4, 1, H); q.r(9, 3, 6, 1, H); q.r(3, 4, 1, 2, H); q.r(14, 4, 1, 2, H);
      if (st === 'spiky') { q.p(5, -2, H); q.p(8, -2, H); q.p(11, -2, H); q.p(14, 0, H); q.p(3, 0, H); }
    } else {
      q.r(3, 3, 5, 1, H); q.r(10, 3, 5, 1, H); q.r(3, 3, 1, 6, H); q.r(14, 3, 1, 6, H);
      if (st === 'long') { q.r(2, 4, 1, 9, H); q.r(15, 4, 1, 9, H); }
      if (st === 'bob') { q.r(2, 4, 1, 5, H); q.r(15, 4, 1, 5, H); }
      if (st === 'bun') { q.r(6, -2, 6, 1, H); q.r(7, -2, 4, 1, HD); }
    }
    q.r(6, 0, 3, 1, HH); q.p(5, 1, HH);
  } else if (st === 'cap') {
    const K = shade(C, 0.9);
    q.r(3, 3, 1, 3, H); q.r(14, 3, 1, 3, H);
    q.r(5, -1, 8, 1, K); q.r(4, 0, 10, 1, K); q.r(3, 1, 12, 2, K); q.r(3, 3, 14, 1, shade(K, 0.7));
    q.r(7, 0, 3, 1, shade(K, 1.3));
  } else if (st === 'bald') {
    q.r(3, 2, 1, 4, H); q.r(14, 2, 1, 4, H); q.p(4, 2, H); q.p(13, 2, H);
    q.p(7, 1, '#ffffff'); q.p(8, 1, shade(S, 1.15));
  }
  outline(c);
  return c;
}

// ---------------------------------------------------------------- furniture
type Draw = (q: P) => void;
function sprite(w: number, h: number, f: Draw, ol = true): HTMLCanvasElement {
  const [c, ctx] = mk(w + 2, h + 2);
  f(new P(ctx, 1, 1));
  if (ol) outline(c);
  return c;
}

const WOOD = '#b0703c', WOOD2 = '#8a5228', WOOD3 = '#d08e52';

export const FURN: Record<string, () => HTMLCanvasElement> = {
  sofa: () => sprite(46, 22, (q) => {
    q.r(0, 4, 46, 14, '#c88a4a'); q.r(2, 0, 42, 10, '#e2b06a');
    for (let x = 3; x < 43; x += 5) for (let y = 1; y < 9; y += 4) { q.p(x, y, '#c0603a'); q.p(x + 2, y + 2, '#7a9a4a'); }
    q.r(0, 4, 5, 14, '#d89a56'); q.r(41, 4, 5, 14, '#d89a56');
    q.r(5, 11, 36, 6, '#eabf7a'); q.r(22, 11, 1, 6, '#c88a4a');
    q.r(1, 18, 2, 4, WOOD2); q.r(43, 18, 2, 4, WOOD2);
  }),
  lamp: () => sprite(12, 30, (q) => {
    q.r(1, 0, 10, 8, '#26262e'); q.r(2, 1, 8, 6, '#3a3a46'); q.r(3, 6, 6, 2, '#fff6b0'); q.r(4, 7, 4, 1, '#ffffff');
    q.r(5, 8, 2, 16, '#3a3a46'); q.p(4, 23, '#3a3a46'); q.p(7, 23, '#3a3a46');
    q.r(1, 24, 2, 6, '#3a3a46'); q.r(9, 24, 2, 6, '#3a3a46'); q.r(5, 24, 2, 5, '#3a3a46');
  }),
  camera: () => sprite(18, 24, (q) => {
    q.r(2, 2, 12, 8, '#2e2e38'); q.r(3, 3, 10, 2, '#4a4a58'); q.r(14, 4, 4, 4, '#2e2e38'); q.r(15, 5, 2, 2, '#7ac0ff');
    q.r(4, 0, 6, 2, '#2e2e38'); q.p(5, 4, '#e04040');
    q.r(7, 10, 2, 8, '#55555f'); q.r(3, 18, 2, 6, '#55555f'); q.r(11, 18, 2, 6, '#55555f'); q.r(7, 18, 2, 5, '#55555f');
  }),
  dirchair: () => sprite(16, 18, (q) => {
    q.r(1, 0, 14, 6, '#3a3a40'); q.r(2, 1, 12, 4, '#4a4a52');
    q.r(1, 8, 14, 3, '#8a5228'); q.r(2, 11, 2, 7, WOOD2); q.r(12, 11, 2, 7, WOOD2); q.r(1, 0, 2, 11, WOOD2); q.r(13, 0, 2, 11, WOOD2);
  }),
  plant: () => sprite(12, 18, (q) => {
    q.r(2, 11, 8, 7, '#b0603a'); q.r(2, 11, 8, 2, '#c87a4a');
    q.r(1, 3, 4, 6, '#3a8a3a'); q.r(7, 2, 4, 7, '#3a8a3a'); q.r(4, 0, 4, 10, '#4aa64a'); q.r(5, 1, 2, 3, '#7acc6a');
  }),
  makeup: () => sprite(34, 30, (q) => {
    // mirror on wall with bulbs
    q.r(5, 0, 24, 17, '#e8d7b0'); q.r(8, 3, 18, 11, '#a8d4e8'); q.r(10, 4, 4, 8, '#d8f0ff');
    for (let x = 6; x < 29; x += 4) { q.r(x, 0, 2, 2, '#fff7a0'); }
    for (let y = 4; y < 16; y += 4) { q.r(5, y, 2, 2, '#fff7a0'); q.r(27, y, 2, 2, '#fff7a0'); }
    // table
    q.r(0, 18, 34, 5, WOOD3); q.r(0, 23, 34, 5, WOOD2); q.r(2, 28, 3, 2, WOOD2); q.r(29, 28, 3, 2, WOOD2);
    q.r(6, 15, 3, 4, '#e070a0'); q.r(12, 16, 4, 3, '#7ac0e0'); q.r(22, 15, 2, 4, '#f0f0f0'); q.r(26, 16, 3, 3, '#c050c0');
  }),
  salon: () => sprite(14, 14, (q) => {
    q.r(1, 0, 12, 7, '#d04a5a'); q.r(2, 1, 10, 5, '#e06a7a'); q.r(0, 7, 14, 3, '#b03a4a');
    q.r(6, 10, 2, 2, '#55555f'); q.r(2, 12, 10, 2, '#55555f');
  }),
  gerobak: () => sprite(44, 38, (q) => {
    q.r(0, 0, 44, 6, '#5a5a62'); q.r(2, 1, 40, 2, '#7a7a84'); for (let x = 2; x < 44; x += 6) q.r(x, 4, 3, 2, '#3a3a42');
    q.r(3, 6, 2, 10, WOOD2); q.r(39, 6, 2, 10, WOOD2);
    q.r(1, 16, 42, 14, WOOD); q.r(1, 16, 42, 2, WOOD3);
    q.r(6, 19, 22, 8, '#f6e2a0'); q.r(8, 21, 18, 4, '#d84030');
    q.r(31, 9, 9, 8, '#d8d8e0'); q.r(32, 10, 7, 2, '#ffffff'); q.r(33, 6, 2, 3, '#e0e0e0'); q.r(36, 5, 2, 4, '#f0f0f0');
    q.r(2, 30, 3, 6, WOOD2); q.r(30, 28, 10, 10, '#3a3a42'); q.r(32, 30, 6, 6, '#6a6a72'); q.r(34, 32, 2, 2, '#3a3a42');
  }),
  table: () => sprite(34, 16, (q) => {
    q.r(0, 0, 34, 8, WOOD3); q.r(0, 8, 34, 3, WOOD2); q.r(2, 11, 3, 5, WOOD2); q.r(29, 11, 3, 5, WOOD2);
    q.r(6, 2, 6, 4, '#f0f0f0'); q.r(7, 3, 4, 2, '#d8a050'); q.r(21, 2, 6, 4, '#f0f0f0'); q.r(22, 3, 4, 2, '#d86a40');
  }),
  stool: () => sprite(8, 8, (q) => { q.r(0, 0, 8, 4, '#c0503a'); q.r(1, 0, 6, 1, '#e07a5a'); q.r(1, 4, 2, 4, WOOD2); q.r(5, 4, 2, 4, WOOD2); }),
  desk: () => sprite(34, 20, (q) => {
    q.r(0, 6, 34, 7, WOOD3); q.r(0, 13, 34, 4, WOOD2); q.r(1, 17, 3, 3, WOOD2); q.r(30, 17, 3, 3, WOOD2);
    q.r(10, 0, 12, 8, '#4a5a4a'); q.r(11, 1, 10, 3, '#6a7a6a'); q.r(12, 5, 8, 2, '#2a2a2a'); q.r(13, 0, 6, 1, '#f8f8f0');
    q.r(24, 4, 7, 5, '#f8f8f0'); q.r(25, 5, 5, 1, '#a0a0a0'); q.r(25, 7, 4, 1, '#a0a0a0'); q.r(3, 5, 4, 3, '#e0e0d8');
  }),
  editdesk: () => sprite(40, 24, (q) => {
    q.r(0, 10, 40, 7, '#7a7a84'); q.r(0, 17, 40, 4, '#55555f'); q.r(1, 21, 3, 3, '#3a3a42'); q.r(36, 21, 3, 3, '#3a3a42');
    q.r(3, 0, 15, 11, '#26262e'); q.r(4, 1, 13, 8, '#3a8ad0'); q.r(5, 2, 6, 3, '#8ad0ff');
    q.r(21, 0, 15, 11, '#26262e'); q.r(22, 1, 13, 8, '#d06a3a'); q.r(24, 3, 8, 4, '#f0c040');
    q.r(10, 12, 18, 3, '#3a3a42');
  }),
  dispenser: () => sprite(10, 22, (q) => { q.r(1, 0, 8, 8, '#8ad0f0'); q.r(2, 1, 3, 5, '#c8f0ff'); q.r(0, 8, 10, 14, '#e8e8f0'); q.r(2, 11, 2, 2, '#3a7ad0'); q.r(6, 11, 2, 2, '#d03a3a'); }),
  tv: () => sprite(22, 20, (q) => { q.r(0, 0, 22, 15, '#3a3a42'); q.r(2, 2, 18, 11, '#5ab0d0'); q.r(3, 3, 6, 4, '#a8e8ff'); q.r(4, 15, 14, 5, WOOD2); }),
  shelf: () => sprite(30, 22, (q) => { q.r(0, 0, 30, 22, WOOD2); q.r(2, 2, 26, 8, '#5a3418'); q.r(2, 12, 26, 8, '#5a3418'); }),
  trophy: () => sprite(8, 10, (q) => { q.r(1, 0, 6, 4, '#f6c440'); q.p(0, 1, '#f6c440'); q.p(7, 1, '#f6c440'); q.r(3, 4, 2, 3, '#e0a020'); q.r(1, 7, 6, 3, '#8a5228'); q.p(2, 1, '#fff2b0'); }),
  board: () => sprite(30, 18, (q) => { q.r(0, 0, 30, 18, WOOD2); q.r(2, 2, 26, 14, '#d8b070'); q.r(4, 4, 6, 6, '#f8f8f0'); q.r(12, 3, 7, 5, '#f0e070'); q.r(21, 5, 5, 7, '#a0d0f0'); q.r(13, 10, 8, 4, '#f8f8f0'); }),
  whiteboard: () => sprite(34, 18, (q) => { q.r(0, 0, 34, 18, '#9a9aa4'); q.r(2, 2, 30, 14, '#f8f8f8'); q.r(5, 5, 14, 1, '#3a6ad0'); q.r(5, 8, 18, 1, '#d03a3a'); q.r(5, 11, 10, 1, '#3a3a3a'); }),
  poster: () => sprite(14, 18, (q) => { q.r(0, 0, 14, 18, '#f6e2b0'); q.r(1, 1, 12, 11, '#d04a5a'); q.r(4, 3, 6, 6, '#f6c440'); q.r(2, 13, 10, 1, '#3a3a3a'); q.r(3, 15, 8, 1, '#3a3a3a'); }),
  chandelier: () => sprite(20, 12, (q) => { q.r(9, 0, 2, 4, '#c0a040'); q.r(2, 4, 16, 3, '#f6c440'); for (let x = 2; x < 18; x += 4) { q.r(x, 7, 2, 3, '#fff6c0'); } }),
  boom: () => sprite(30, 34, (q) => {
    q.r(2, 0, 26, 2, '#55555f'); q.r(0, 0, 4, 6, '#3a3a42'); q.r(1, 1, 2, 4, '#6a6a74');
    for (let x = 0; x < 4; x++) q.r(x, 6, 1, 1, '#2a2a2a');
    q.r(20, 2, 2, 22, '#55555f'); q.r(15, 24, 2, 10, '#55555f'); q.r(25, 24, 2, 10, '#55555f'); q.r(20, 24, 2, 9, '#55555f');
  }),
  crate: () => sprite(16, 12, (q) => { q.r(0, 0, 16, 12, '#a86a3a'); q.r(1, 1, 14, 2, '#c88a52'); q.r(0, 5, 16, 1, '#7a4a22'); q.r(3, 0, 1, 12, '#7a4a22'); q.r(12, 0, 1, 12, '#7a4a22'); q.r(5, 7, 6, 3, '#f0e0b0'); }),
  clapper: () => sprite(12, 10, (q) => { q.r(0, 3, 12, 7, '#2a2a2a'); q.r(0, 0, 12, 3, '#f0f0f0'); for (let x = 0; x < 12; x += 4) q.r(x, 0, 2, 3, '#2a2a2a'); q.r(2, 5, 8, 1, '#f0f0f0'); }),
};

// ---------------------------------------------------------------- icons (UI)
export const ICONS: Record<string, () => HTMLCanvasElement> = {
  money: () => sprite(16, 10, (q) => { q.r(0, 0, 16, 10, '#4aa64a'); q.r(1, 1, 14, 8, '#6ac46a'); q.r(6, 2, 4, 6, '#3a8a3a'); q.r(7, 3, 2, 4, '#9ae08a'); q.r(2, 2, 2, 2, '#3a8a3a'); q.r(12, 6, 2, 2, '#3a8a3a'); }),
  heart: () => sprite(11, 10, (q) => { q.r(1, 0, 3, 1, '#e04060'); q.r(7, 0, 3, 1, '#e04060'); q.r(0, 1, 11, 4, '#e04060'); q.r(1, 5, 9, 2, '#e04060'); q.r(3, 7, 5, 2, '#e04060'); q.r(5, 9, 1, 1, '#e04060'); q.r(2, 1, 2, 2, '#ff9ab0'); }),
  bulb: () => sprite(9, 12, (q) => { q.r(2, 0, 5, 1, '#ffe060'); q.r(1, 1, 7, 6, '#ffe060'); q.r(2, 7, 5, 1, '#ffe060'); q.r(3, 8, 3, 2, '#9a9aa4'); q.r(3, 10, 3, 1, '#6a6a74'); q.r(2, 2, 2, 2, '#fff8c0'); }),
  star: () => sprite(11, 11, (q) => { q.r(5, 0, 1, 2, '#ffd040'); q.r(4, 2, 3, 2, '#ffd040'); q.r(0, 4, 11, 2, '#ffd040'); q.r(2, 6, 7, 2, '#ffd040'); q.r(1, 8, 3, 2, '#ffd040'); q.r(7, 8, 3, 2, '#ffd040'); q.p(5, 3, '#fff2a0'); }),
  menu: () => sprite(18, 16, (q) => { for (let y = 0; y < 16; y += 6) { q.r(0, y, 18, 4, '#e0a020'); q.r(1, y, 16, 1, '#ffd060'); } }),
  staff: () => sprite(16, 18, (q) => {
    q.r(3, 0, 10, 2, '#5a3418'); q.r(2, 2, 12, 7, '#f0c08a'); q.r(2, 2, 12, 2, '#5a3418'); q.p(5, 5, OUT); q.p(10, 5, OUT);
    q.r(1, 10, 14, 8, '#3a5ab0'); q.r(7, 10, 2, 5, '#f0f0f0'); q.r(7, 11, 2, 4, '#d03a3a');
  }),
  film: () => sprite(18, 16, (q) => {
    q.r(0, 0, 18, 16, '#3a3a42'); for (let x = 1; x < 18; x += 4) { q.r(x, 1, 2, 2, '#d8d8e0'); q.r(x, 13, 2, 2, '#d8d8e0'); }
    q.r(1, 4, 7, 8, '#f6c440'); q.r(10, 4, 7, 8, '#e06a8a');
  }),
  house: () => sprite(18, 16, (q) => {
    q.r(8, 0, 2, 1, '#c04030'); q.r(6, 1, 6, 2, '#c04030'); q.r(3, 3, 12, 2, '#c04030'); q.r(0, 5, 18, 2, '#c04030');
    q.r(2, 7, 14, 9, '#f2e2b8'); q.r(7, 10, 4, 6, '#8a5228'); q.r(3, 9, 3, 3, '#7ac0e0'); q.r(12, 9, 3, 3, '#7ac0e0');
  }),
  pause: () => sprite(8, 9, (q) => { q.r(0, 0, 3, 9, '#5a3418'); q.r(5, 0, 3, 9, '#5a3418'); }),
  sound: () => sprite(12, 10, (q) => { q.r(0, 3, 3, 4, '#5a3418'); q.r(3, 2, 2, 6, '#5a3418'); q.r(5, 0, 1, 10, '#5a3418'); q.r(8, 2, 1, 6, '#5a3418'); q.r(10, 1, 1, 8, '#5a3418'); }),
  mute: () => sprite(12, 10, (q) => { q.r(0, 3, 3, 4, '#5a3418'); q.r(3, 2, 2, 6, '#5a3418'); q.r(5, 0, 1, 10, '#5a3418'); q.p(8, 3, '#c03030'); q.p(9, 4, '#c03030'); q.p(10, 5, '#c03030'); q.p(11, 6, '#c03030'); q.p(11, 3, '#c03030'); q.p(10, 4, '#c03030'); q.p(9, 5, '#c03030'); q.p(8, 6, '#c03030'); }),
  lock: () => sprite(9, 11, (q) => { q.r(2, 0, 5, 1, '#6a6a74'); q.r(1, 1, 1, 4, '#6a6a74'); q.r(7, 1, 1, 4, '#6a6a74'); q.r(0, 5, 9, 6, '#d0a030'); q.r(4, 7, 1, 2, '#5a3418'); }),
  bigtrophy: () => sprite(30, 36, (q) => {
    q.r(4, 0, 22, 4, '#ffd84a'); q.r(5, 4, 20, 10, '#f6c440'); q.r(7, 14, 16, 4, '#e8b030'); q.r(10, 18, 10, 3, '#d8a020');
    q.r(0, 3, 4, 2, '#f6c440'); q.r(0, 5, 2, 6, '#f6c440'); q.r(2, 10, 4, 2, '#f6c440');
    q.r(26, 3, 4, 2, '#f6c440'); q.r(28, 5, 2, 6, '#f6c440'); q.r(24, 10, 4, 2, '#f6c440');
    q.r(13, 21, 4, 6, '#e0a020'); q.r(7, 27, 16, 3, '#f6c440'); q.r(5, 30, 20, 6, '#8a5228'); q.r(8, 32, 14, 2, '#f6c440');
    q.r(8, 2, 3, 9, '#fff4c0');
  }),
  peta: () => sprite(30, 26, (q) => {
    // folded paper map: three panels, islands, a red pin
    const panels: [number, string, string][] = [[0, '#f4e2b0', '#e2c88a'], [10, '#fbecc4', '#ead39a'], [20, '#f0dba4', '#dcc080']];
    for (const [x, c1, c2] of panels) { q.r(x, (x / 10) % 2 ? 3 : 0, 10, 23, c1); q.r(x, (x / 10) % 2 ? 24 : 21, 10, 2, c2); }
    q.r(0, 4, 30, 15, '#7cc4e8'); q.r(10, 6, 10, 15, '#8ed0f0');
    q.r(2, 6, 6, 4, '#6ab04a'); q.r(4, 9, 5, 3, '#6ab04a'); q.r(12, 13, 9, 3, '#6ab04a'); q.r(15, 11, 4, 2, '#6ab04a'); q.r(23, 8, 5, 5, '#6ab04a'); q.r(3, 6, 2, 1, '#9ad870'); q.r(13, 13, 3, 1, '#9ad870');
    q.r(1, 16, 3, 1, '#ffffff'); q.r(24, 16, 3, 1, '#ffffff');
    q.r(10, 0, 1, 26, '#c8a870'); q.r(20, 0, 1, 26, '#c8a870');
    // pin
    q.r(17, 2, 6, 6, '#2b1a10'); q.r(18, 3, 4, 4, '#e0402a'); q.r(18, 3, 2, 2, '#ff9a80'); q.r(19, 8, 2, 4, '#2b1a10');
  }),
  bus: () => sprite(26, 14, (q) => {
    q.r(0, 1, 26, 10, '#e8a020'); q.r(1, 0, 23, 2, '#f6c440'); q.r(0, 7, 26, 2, '#c0392b');
    for (let x = 2; x < 22; x += 5) q.r(x, 2, 4, 4, '#a8e0f8');
    q.r(22, 2, 3, 5, '#a8e0f8'); q.r(3, 3, 1, 2, '#ffffff');
    q.r(3, 10, 5, 4, '#2a2a2a'); q.r(18, 10, 5, 4, '#2a2a2a'); q.r(5, 11, 1, 2, '#9a9aa4'); q.r(20, 11, 1, 2, '#9a9aa4');
  }),
  tvicon: () => sprite(16, 14, (q) => { q.r(0, 0, 16, 11, '#3a3a42'); q.r(1, 1, 14, 9, '#5ab0d0'); q.r(5, 11, 6, 3, '#8a5228'); q.r(3, 2, 4, 3, '#a8e8ff'); }),
  // ---- v5 ----
  /** phone with a chat bubble + heart (Netizen feed) */
  feed: () => sprite(26, 26, (q) => {
    q.r(4, 0, 15, 26, '#2b1a10'); q.r(5, 1, 13, 24, '#3a3a48'); q.r(6, 3, 11, 18, '#e8f4ff'); q.r(10, 22, 3, 2, '#9a9aa4');
    q.r(7, 5, 9, 2, '#4a90e0'); q.r(7, 8, 7, 1, '#9ab0c8'); q.r(7, 10, 8, 1, '#9ab0c8'); q.r(7, 13, 9, 2, '#e0508a'); q.r(7, 16, 6, 1, '#9ab0c8');
    q.r(15, 9, 11, 9, '#2b1a10'); q.r(16, 10, 9, 7, '#ffffff'); q.r(16, 17, 3, 3, '#2b1a10'); q.r(17, 17, 1, 1, '#ffffff');
    q.r(17, 11, 2, 1, '#e04060'); q.r(21, 11, 2, 1, '#e04060'); q.r(17, 12, 6, 2, '#e04060'); q.r(18, 14, 4, 1, '#e04060'); q.r(19, 15, 2, 1, '#e04060');
  }),
  /** gold medal on a red ribbon (Prestasi) */
  medal: () => sprite(20, 26, (q) => {
    q.r(3, 0, 6, 11, '#2b1a10'); q.r(11, 0, 6, 11, '#2b1a10'); q.r(4, 0, 4, 10, '#d0402e'); q.r(12, 0, 4, 10, '#2d6cb0'); q.r(5, 0, 1, 9, '#f07a5a'); q.r(13, 0, 1, 9, '#6aa0e0');
    q.r(3, 9, 14, 16, '#2b1a10'); q.r(2, 11, 16, 12, '#2b1a10'); q.r(4, 10, 12, 14, '#f6c440'); q.r(3, 12, 14, 10, '#f6c440');
    q.r(5, 11, 4, 3, '#fff09a'); q.r(6, 14, 8, 8, '#e0a020'); q.r(9, 15, 2, 6, '#fff09a'); q.r(7, 17, 6, 2, '#fff09a');
  }),
  /** whistle (KPI teguran) */
  kpi: () => sprite(22, 16, (q) => {
    q.r(2, 4, 14, 11, '#2b1a10'); q.r(14, 4, 8, 6, '#2b1a10'); q.r(3, 5, 12, 9, '#c8ccd8'); q.r(15, 5, 6, 4, '#c8ccd8'); q.r(4, 6, 5, 3, '#ffffff');
    q.r(9, 8, 4, 4, '#2b1a10'); q.r(0, 0, 3, 3, '#e0402a'); q.r(3, 1, 4, 1, '#e0402a'); q.r(7, 2, 2, 3, '#e0402a');
  }),
  /** shopping bag (product placement) */
  bag: () => sprite(18, 20, (q) => {
    q.r(5, 0, 8, 2, '#2b1a10'); q.r(4, 2, 2, 5, '#2b1a10'); q.r(12, 2, 2, 5, '#2b1a10');
    q.r(1, 5, 16, 15, '#2b1a10'); q.r(2, 6, 14, 13, '#f08a3a'); q.r(3, 7, 12, 3, '#ffbe7a'); q.r(6, 11, 6, 5, '#fff3d6'); q.r(7, 12, 4, 3, '#e04060');
  }),
  /** infotainment microphone */
  mic: () => sprite(14, 22, (q) => {
    q.r(3, 0, 8, 10, '#2b1a10'); q.r(4, 1, 6, 8, '#9a9aa4'); q.r(5, 2, 2, 2, '#e8e8f0'); q.r(2, 9, 10, 4, '#2b1a10'); q.r(3, 10, 8, 2, '#e0402a');
    q.r(5, 13, 4, 9, '#2b1a10'); q.r(6, 13, 2, 8, '#4a4a58');
  }),
  /** clapper with a star (audisi) */
  audisi: () => sprite(22, 20, (q) => {
    q.r(0, 6, 22, 14, '#2b1a10'); q.r(1, 7, 20, 12, '#3a3a42'); q.r(0, 0, 22, 6, '#2b1a10'); q.r(1, 1, 20, 4, '#f0f0f0');
    for (let x = 2; x < 21; x += 5) q.r(x, 1, 2, 4, '#2a2a2a');
    q.r(10, 9, 2, 2, '#ffd040'); q.r(8, 11, 6, 2, '#ffd040'); q.r(9, 13, 4, 2, '#ffd040'); q.r(8, 15, 2, 2, '#ffd040'); q.r(12, 15, 2, 2, '#ffd040');
  }),
};

export const HUD_H = 50;

export function confettiTex(): HTMLCanvasElement {
  const [c, ctx] = mk(3, 3);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 3, 3);
  return c;
}

/** light cone pointing down (origin top-centre) */
export function coneTex(): HTMLCanvasElement {
  const [c, ctx] = mk(64, 120);
  ctx.imageSmoothingEnabled = true;
  const g = ctx.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, 'rgba(255,236,170,0.85)');
  g.addColorStop(0.6, 'rgba(255,220,140,0.25)');
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(38, 0); ctx.lineTo(64, 120); ctx.lineTo(0, 120); ctx.closePath(); ctx.fill();
  return c;
}

export function flareTex(): HTMLCanvasElement {
  const [c, ctx] = mk(48, 48);
  const g = ctx.createRadialGradient(24, 24, 1, 24, 24, 24);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.25, 'rgba(255,240,170,0.6)');
  g.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 48, 48);
  return c;
}

export function glowTex(): HTMLCanvasElement {
  const [c, ctx] = mk(64, 32);
  const g = ctx.createRadialGradient(32, 16, 2, 32, 16, 32);
  g.addColorStop(0, 'rgba(255,240,170,0.9)');
  g.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = g;
  ctx.save(); ctx.scale(1, 0.5); ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  return c;
}

/** Generate all static textures once */
export function generateAll(scene: Phaser.Scene, level: number) {
  for (const k of Object.keys(FURN)) addTex(scene, 'f_' + k, FURN[k]());
  for (const k of Object.keys(ICONS)) addTex(scene, 'i_' + k, ICONS[k]());
  addTex(scene, 'cone', coneTex());
  addTex(scene, 'flare', flareTex());
  addTex(scene, 'px', confettiTex());
  addTex(scene, 'glow', glowTex());
  void level;
}

