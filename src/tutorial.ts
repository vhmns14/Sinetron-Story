// v5 guided first run: a coach bubble + a pulsing highlight around the button to press, from the first hire until the
// first sinetron airs. State-derived (it watches the save + open dialogs), so it never blocks: the player can do things
// in any order, skip it (Lewati) or replay it from the Menu. Old saves start with tut = -1 (done).
import Phaser from 'phaser';
import type { GameScene } from './scenes/Game';
import { GW, GH, COL, ROUND, txt, button, bubbleGfx } from './ui';
import { sfx } from './audio';

interface Step { text: string; target: string | null }

export class Tutorial {
  private root: Phaser.GameObjects.Container | null = null;
  private hi: Phaser.GameObjects.Graphics;
  private key = '';
  private target: string | null = null;
  private nextCheck = 0;
  constructor(private gs: GameScene) {
    this.hi = gs.add.graphics().setDepth(4590).setName('tutHi');
  }
  get active() { return this.gs.s.tut > 0; }
  restart() { this.gs.s.tut = 1; this.key = ''; sfx.event(); this.gs.toast('Tutorial diulang dari awal!'); }
  skip() { this.gs.s.tut = -1; this.clear(); this.gs.toast('Tutorial dilewati. Bisa diulang dari Menu.'); }
  relayout() { this.key = ''; }
  private clear() { this.root?.destroy(); this.root = null; this.hi.clear(); this.target = null; this.key = ''; }

  /** find a named object (searching into containers); prefers the last match (topmost) */
  private find(name: string): Phaser.GameObjects.GameObject | null {
    let found: Phaser.GameObjects.GameObject | null = null;
    const walk = (list: Phaser.GameObjects.GameObject[]) => {
      for (const o of list) {
        if (o.name === name && (o as unknown as { visible?: boolean }).visible !== false && o.active) found = o;
        const c = o as Phaser.GameObjects.Container;
        if (c.list && Array.isArray(c.list)) walk(c.list);
      }
    };
    walk(this.gs.children.list);
    return found;
  }
  /** the object sits in the top dialog (or on the screen when no dialog is open) */
  private inTop(o: Phaser.GameObjects.GameObject): boolean {
    const top = this.gs.modals[this.gs.modals.length - 1];
    let p: Phaser.GameObjects.Container | null = (o as unknown as { parentContainer: Phaser.GameObjects.Container | null }).parentContainer;
    let root: Phaser.GameObjects.GameObject = o;
    while (p) { root = p; p = p.parentContainer; }
    return top ? root === top.root : !this.gs.modals.length;
  }

  private step(): Step | null {
    const s = this.gs.s;
    const top = this.gs.modals[this.gs.modals.length - 1];
    const title = top?.opts.title ?? '';
    // advance by state
    if (s.tut === 1 && s.staff.some((x) => x.role === 'kameramen')) s.tut = 2;
    if (s.tut <= 2 && s.tut > 0 && (s.prod || s.shows.length)) s.tut = 3;
    if (s.tut === 3 && (s.prod?.phase === 'syuting' || s.prod?.phase === 'editing' || s.shows.length)) s.tut = 4;
    if (s.tut === 4 && s.shows.length && !s.prod) s.tut = 5;
    switch (s.tut) {
      case 1:
        if (title === 'REKRUT') return this.find('tut_hire') ? { text: 'Pilih KAMERAMEN, lalu tekan REKRUT. Kameramen bikin poin Visual!', target: 'tut_hire' } : { text: 'Belum ada kameramen bulan ini. Tekan "Cari Kandidat Lain".', target: 'tut_refresh' };
        if (title === 'STAF') return { text: 'Tekan REKRUT STAF buat lihat kandidat.', target: 'tut_rekrut' };
        if (top) return { text: 'Tutup dulu jendela ini, lalu tekan STAF.', target: null };
        return { text: 'Langkah 1/3: Studio kita belum punya KAMERAMEN. Tekan STAF di bawah.', target: 'btn_staf' };
      case 2:
        if (title === 'SINETRON BARU') {
          if (this.find('tut_mulai')) return { text: 'Pilih pemeran utama (cek chemistry-nya!), lalu tekan MULAI!', target: 'tut_mulai' };
          if (this.find('tut_next2')) return { text: 'Pilih platform, jumlah episode & budget. Lalu LANJUT.', target: 'tut_next2' };
          return { text: 'Pilih genre & tema. Combo yang cocok bikin rating meledak! Lalu LANJUT.', target: 'tut_next1' };
        }
        if (title === 'PRODUKSI') return { text: 'Tekan SINETRON BARU!', target: 'tut_new' };
        if (top) return { text: 'Tutup dulu jendela ini, lalu tekan PRODUKSI.', target: null };
        return { text: 'Langkah 2/3: Saatnya bikin sinetron pertama! Tekan PRODUKSI.', target: 'btn_produksi' };
      case 3:
        if (top) return null;
        return { text: 'Langkah 3/3: Penulis lagi nulis naskah. Percepat waktu pakai tombol 2x / 4x di kanan atas.', target: 'speed2' };
      case 4:
        if (top) return null;
        return { text: 'Syuting jalan! Poin Drama, Air Mata, Komedi & Visual naik. Tunggu sampai sinetronnya TAYANG.', target: null };
      case 5:
        if (top) return null;
        return { text: 'Sinetron pertama TAYANG! Pantau Tangga Rating, cek Linimasa Netizen, kejar Prestasi. Tutorial selesai, semangat Bos!', target: 'btn_netizen' };
    }
    return null;
  }

  update() {
    const gs = this.gs;
    if (!this.active) { if (this.root || this.target) this.clear(); return; }
    const now = gs.time.now;
    if (now >= this.nextCheck) {
      this.nextCheck = now + 200;
      const st = this.step();
      const key = st ? `${gs.s.tut}|${st.text}|${st.target}|${GW}|${gs.modalOpen()}` : '';
      if (key !== this.key) { this.key = key; this.show(st); }
    }
    this.drawHi();
  }

  private show(st: Step | null) {
    const gs = this.gs;
    this.root?.destroy(); this.root = null;
    this.target = st?.target ?? null;
    if (!st) return;
    const t = this.target ? this.find(this.target) : null;
    const tb = t ? (t as unknown as { getBounds: () => Phaser.Geom.Rectangle }).getBounds() : null;
    // a dialog is open: dock the coach over the HUD (inert while a dialog is up) so it never hides the dialog;
    // otherwise float it away from the highlighted button
    const docked = gs.modalOpen();
    const W = docked ? Math.min(356, GW - 4) : Math.min(320, GW - 24);
    const done = gs.s.tut === 5;
    const label = txt(gs, 0, 0, st.text, docked ? 10 : 11, COL.text, { wrap: W - (docked ? 124 : 74), font: ROUND, weight: '700', lineSpacing: docked ? 0 : 1 });
    const h = docked ? Math.max(44, label.height + 12) : Math.max(54, label.height + 34);
    let y = docked ? h / 2 + 3 : tb && tb.centerY < GH / 2 ? GH - 76 - h / 2 : 112;
    let x = docked ? GW / 2 : gs.vcx();
    if (docked) {
      // v5.1: on short windows a dialog can reach the top edge; prefer a spot that does not cover it
      const sl = gs.toastSlot(W, h, 'above');
      if (sl && (!sl.wrap || sl.wrap + 24 >= W)) { x = sl.x; y = sl.y; }
    }
    const c = gs.add.container(Math.round(x), Math.round(y)).setDepth(4600).setName('tutBubble');
    const g = gs.add.graphics();
    bubbleGfx(g, W, h, 0xfff8e2, 0x7a3a10, false, 10);
    c.add(g);
    // coach: the studio's director
    const dir = gs.s.staff.find((x) => x.role === 'sutradara');
    if (dir && gs.textures.exists(`st${dir.id}_0`)) c.add(gs.add.image(-W / 2 + 26, h / 2 - (docked ? 3 : 8), `st${dir.id}_3`).setOrigin(0.5, 1).setScale(docked ? 0.5 : 0.62));
    label.setPosition(-W / 2 + (docked ? 48 : 54), docked ? -label.height / 2 : -h / 2 + 8);
    c.add(label);
    const bw = done ? 68 : 62;
    const b = button(gs, docked ? W / 2 - bw - 8 : W / 2 - bw - 8, docked ? -11 : h / 2 - 24, bw, 22, done ? 'Siap!' : 'Lewati', () => { if (done) { gs.s.tut = -1; this.clear(); sfx.levelup(); } else this.skip(); }, { size: 9, kind: done ? 'primary' : 'btn' });
    b.setName(done ? 'tutDone' : 'tutSkip');
    c.add(b);
    c.setScale(0.6).setAlpha(0);
    gs.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.root = c;
    // a toast already on screen must not cover the coach (or its button)
    gs.hideToastsIn({ x0: c.x - W / 2, x1: c.x + W / 2, y0: c.y - h / 2, y1: c.y + h / 2 });
  }

  private drawHi() {
    const g = this.hi;
    g.clear();
    if (!this.target) return;
    const t = this.find(this.target);
    if (!t || !this.inTop(t)) return;
    const b = (t as unknown as { getBounds: () => Phaser.Geom.Rectangle }).getBounds();
    if (!b || b.width < 2) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.gs.time.now / 180);
    const pad = 3 + pulse * 3;
    g.lineStyle(3, 0xffe066, 0.95); g.strokeRoundedRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2, 9);
    g.lineStyle(1.5, 0xe0402a, 0.9); g.strokeRoundedRect(b.x - pad - 2.5, b.y - pad - 2.5, b.width + pad * 2 + 5, b.height + pad * 2 + 5, 11);
    // bouncing arrow above (or below when there is no room)
    const ax = b.centerX, above = b.y > 70;
    const ay = above ? b.y - pad - 6 - pulse * 5 : b.bottom + pad + 6 + pulse * 5;
    g.fillStyle(0x2b1a10, 1);
    if (above) g.fillTriangle(ax - 10, ay - 12, ax + 10, ay - 12, ax, ay + 1); else g.fillTriangle(ax - 10, ay + 12, ax + 10, ay + 12, ax, ay - 1);
    g.fillStyle(0xffe066, 1);
    if (above) g.fillTriangle(ax - 7, ay - 10, ax + 7, ay - 10, ax, ay - 1); else g.fillTriangle(ax - 7, ay + 10, ax + 7, ay + 10, ax, ay + 1);
  }
}
