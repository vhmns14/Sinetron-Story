// Bitmap assets (generated pixel art, processed by tools/assets.py) and helpers built on them.
// Every bitmap here is authored at 2x the logical resolution and drawn with setScale(0.5)
// (HI), so it maps 1:1 onto the canvas at zoom 2.
import Phaser from 'phaser';
import type { Look, Staff } from './state';
import type { Role } from './data';
import { mk, addTex } from './art';
import bg1 from './assets/bg1.png';
import bg2 from './assets/bg2.png';
import bg3 from './assets/bg3.png';
import chars from './assets/chars.png';
import icons from './assets/icons.png';
import critics from './assets/critics.png';
import banner from './assets/banner.png';
import rosetteGold from './assets/rosette_gold.png';
import rosetteSilver from './assets/rosette_silver.png';
import livingCry from './assets/living_cry.png';
import livingLaugh from './assets/living_laugh.png';
import livingShock from './assets/living_shock.png';
import livingBored from './assets/living_bored.png';
import livingNormal from './assets/living_normal.png';
import meta from './assets/meta.json';

export const HI = 0.5;
export const CELL_W = meta.charCell[0], CELL_H = meta.charCell[1];
export const ICON = 64;
export const ICON_NAMES = meta.icons as string[];

export function preloadAssets(scene: Phaser.Scene) {
  const L = scene.load;
  L.image('bg1', bg1); L.image('bg2', bg2); L.image('bg3', bg3);
  L.spritesheet('chars', chars, { frameWidth: CELL_W, frameHeight: CELL_H });
  L.spritesheet('icons', icons, { frameWidth: ICON, frameHeight: ICON });
  L.spritesheet('critics', critics, { frameWidth: 120, frameHeight: 120 });
  L.image('banner', banner);
  L.image('rosette_gold', rosetteGold); L.image('rosette_silver', rosetteSilver);
  L.image('living_cry', livingCry); L.image('living_laugh', livingLaugh); L.image('living_shock', livingShock);
  L.image('living_bored', livingBored); L.image('living_normal', livingNormal);
}

export function iconFrame(name: string): number { return Math.max(0, ICON_NAMES.indexOf(name)); }

// ------------------------------------------------------------------ characters
// atlas rows (3 poses each: idle, walk, action)
export const CH = {
  dirOld: 0, writerGlasses: 1, actorTee: 2, actressPink: 3,
  camCap: 4, dirBeret: 5, writerHijab: 6, camPony: 7,
  actorBlazer: 8, actressHijab: 9, actressBob: 10, actorBatik: 11,
  writerBald: 12, dirCap: 13, vendor: 14, crew: 15,
  satpam: 16, officeBoy: 17, makeupArtist: 18, courier: 19,
} as const;

const POOL: Record<Role, { m: number[]; f: number[]; h: number[] }> = {
  sutradara: { m: [CH.dirOld, CH.dirCap], f: [CH.dirBeret], h: [CH.dirBeret] },
  penulis: { m: [CH.writerGlasses, CH.writerBald], f: [CH.writerHijab], h: [CH.writerHijab] },
  aktor: { m: [CH.actorTee, CH.actorBlazer, CH.actorBatik], f: [CH.actressPink], h: [CH.actressHijab] },
  aktris: { m: [CH.actorTee], f: [CH.actressPink, CH.actressBob], h: [CH.actressHijab] },
  kameramen: { m: [CH.camCap, CH.crew], f: [CH.camPony], h: [CH.camPony] },
};

export function charFor(role: Role, look: Look, seed: number): number {
  const p = POOL[role];
  const list = look.female ? (look.style === 'hijab' ? p.h : p.f) : p.m;
  return list[Math.abs(seed) % list.length];
}

/** draw one pose of an atlas character into a canvas (2px of headroom for bobbing) */
export function charCanvas(scene: Phaser.Scene, idx: number, pose: number, lift = 0): HTMLCanvasElement {
  const [c, ctx] = mk(CELL_W, CELL_H + 2);
  const src = scene.textures.get('chars').getSourceImage() as HTMLImageElement;
  const f = idx * 3 + pose;
  ctx.drawImage(src, (f % 3) * CELL_W, Math.floor(f / 3) * CELL_H, CELL_W, CELL_H, 0, 2 - lift, CELL_W, CELL_H);
  return c;
}

/**
 * Per-character texture set, keyed `${key}_${n}`:
 * 0 idle, 1 walk, 2 idle lifted (walk bounce), 3 action, 4 action lifted, 5 idle (alias), 6 idle lifted, shout = action
 */
export function charTextures(scene: Phaser.Scene, key: string, idx: number) {
  addTex(scene, `${key}_0`, charCanvas(scene, idx, 0));
  addTex(scene, `${key}_1`, charCanvas(scene, idx, 1));
  addTex(scene, `${key}_2`, charCanvas(scene, idx, 0, 2));
  addTex(scene, `${key}_3`, charCanvas(scene, idx, 2));
  addTex(scene, `${key}_4`, charCanvas(scene, idx, 2, 2));
  addTex(scene, `${key}_5`, charCanvas(scene, idx, 0));
  addTex(scene, `${key}_6`, charCanvas(scene, idx, 0, 2));
  addTex(scene, `${key}_shout`, charCanvas(scene, idx, 2));
}

export function staffTextures(scene: Phaser.Scene, st: Staff) {
  charTextures(scene, `st${st.id}`, charFor(st.role, st.look, st.id));
}
