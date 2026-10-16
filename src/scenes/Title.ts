import Phaser from 'phaser';
import { GW, GH, PW, CX0, COL, DISPLAY, txt, button, Modal } from '../ui';
import { hasSave, loadGame, newGame, clearSave, saveGame, type GameState } from '../state';
import { exportPanel, importPanel } from '../backup';
import { charTextures, CH, HI } from '../assets';
import { ROUND } from '../ui';
import { sfx } from '../audio';
import { TIPS } from '../data';

export class TitleScene extends Phaser.Scene {
  private modal: Modal | null = null;
  constructor() { super('Title'); }

  /** v5: window resized / rotated -> rebuild the title for the new width */
  relayout() {
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height);
    document.getElementById('sinetron-dom')?.remove();
    this.scene.restart();
  }

  create() {
    (window as unknown as { __newGameForTests?: () => unknown }).__newGameForTests = () => newGame();
    const cam = this.cameras.main;
    cam.setZoom(this.registry.get('zoom') as number).centerOn(GW / 2, GH / 2);
    cam.setBackgroundColor('#1a120c');
    this.modal = null;
    // v5 responsive: wide screens put the logo + menu on the left and the studio diorama on the right
    const land = GW >= 760;
    // v5.1 short landscape window (GH < 560): logo on the left, the menu buttons in a column to its right
    const short = GH < 560 && GW >= 610;
    const sx = Math.round((GW - 600) / 2);
    let ox = land ? Math.round(GW / 2 - 380) : CX0; // left edge of the 360 menu column
    const bx = land ? Math.round(GW / 2 + 20) : CX0;  // left edge of the studio backdrop
    if (short) ox = sx - 22;
    const ly = short ? Math.round((GH - 240) / 2) - 44 : 0; // logo block vertical offset
    this.add.image(bx, short ? 0 : 70, 'bg3').setOrigin(0, 0).setScale(HI).setAlpha(land ? 0.95 : 0.8);
    const shade = this.add.graphics();
    shade.fillStyle(0x1a0e06, land ? 0.25 : 0.45); shade.fillRect(0, 0, GW, GH);
    if (land) { shade.fillStyle(0x1a0e06, 0.55); shade.fillRect(0, 0, bx - 6, GH); }
    if (!short) { shade.fillStyle(0x1a0e06, 1); shade.fillRect(0, 0, GW, 70); }
    // walkers along the hallway
    const walkIdx = [CH.actressPink, CH.dirCap, CH.camCap, CH.actorBlazer, CH.writerHijab, CH.vendor];
    for (let i = 0; i < 6; i++) {
      const key = 'title_w' + i;
      charTextures(this, key, walkIdx[i]);
      const y = Math.round((250 + (i % 3) * 110 + (i > 2 ? 30 : 0)) * GH / 640);
      const im = this.add.image(-20 - i * 70, y, key + '_1').setOrigin(0.5, 1).setScale(0.75).setDepth(y);
      const dir = i % 2 === 0 ? 1 : -1;
      if (dir < 0) { im.x = GW + 20 + i * 70; im.setFlipX(true); }
      let f = 0;
      this.time.addEvent({ delay: 170, loop: true, callback: () => { f ^= 1; im.setTexture(key + (f ? '_2' : '_1')); } });
      this.tweens.add({ targets: im, x: dir > 0 ? GW + 40 : -40, duration: (9000 + i * 1300) * (GW / 360) ** 0.6, repeat: -1, delay: i * 400 });
    }
    // logo
    const lg = this.add.graphics().setDepth(900);
    lg.fillStyle(0x000000, 0.35); lg.fillRoundedRect(ox + 26, 60 + ly, 312, 142, 16);
    lg.fillStyle(0x4a2508, 1); lg.fillRoundedRect(ox + 22, 54 + ly, 316, 144, 16);
    lg.fillStyle(0xfbecc8, 1); lg.fillRoundedRect(ox + 26, 58 + ly, 308, 136, 13);
    lg.fillStyle(0xc0392b, 1); lg.fillRoundedRect(ox + 38, 66 + ly, 284, 6, 3);
    const cx = ox + PW / 2;
    const t1 = txt(this, cx, 108 + ly, 'SINETRON', 40, '#f6c440', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 6 }).setDepth(901);
    txt(this, cx, 150 + ly, 'STORY', 26, '#e8601a', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#4a1e0a', strokeW: 5 }).setDepth(901);
    txt(this, cx, 180 + ly, 'Pabrik Air Mata Nasional', 13, COL.text, { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' }).setDepth(901);
    txt(this, cx, 214 + ly, 'by KodeKecil', 11, '#f6d9a8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#2b1a10', strokeW: 3 }).setDepth(901).setName('creditKK');
    this.tweens.add({ targets: t1, y: 104 + ly, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // buttons
    const save = hasSave();
    const nBtn = 4 + (save ? 1 : 0) + (window.__installPrompt ? 1 : 0);
    const step = short ? 44 : 48, bh = short ? 38 : 40;
    let y = short ? Math.max(14, Math.round((GH - 30 - nBtn * step) / 2)) : 236;
    const btnX = short ? sx + 360 : ox + 60;
    const mk = (label: string, fn: () => void, kind: 'primary' | 'btn' | 'green' = 'btn', disabled = false) => {
      const b = button(this, btnX, y, 240, bh, label, () => { sfx.unlock(); fn(); }, { kind, size: 14, disabled });
      b.setDepth(1000).setName('title_' + label.split(':')[0].toLowerCase().replace(/ /g, '_'));
      y += step;
      return b;
    };
    if (save) mk('Lanjutkan', () => this.continueGame(), 'primary');
    mk('Main Baru', () => this.newGameConfirm(save), save ? 'btn' : 'primary');
    mk('Backup Save', () => this.backupMenu(save), 'green');
    mk('Cara Main', () => this.tips());
    const soundBtn = mk('Suara: ' + (sfx.muted ? 'MATI' : 'NYALA'), () => {
      sfx.setMuted(!sfx.muted);
      soundBtn.setLabel?.('Suara: ' + (sfx.muted ? 'MATI' : 'NYALA'));
    });
    if (window.__installPrompt) {
      mk('Pasang di HP', () => { try { window.__installPrompt?.prompt(); window.__installPrompt = null; } catch { /* ignore */ } }, 'green');
    }
    // crew lineup on a red carpet
    const cg = this.add.graphics().setDepth(1001);
    const cy0 = GH - 68; // carpet top (572 at the design height)
    const cw = short ? sx + 350 : GW; // short layout: carpet only under the logo column, the buttons stay clear
    cg.fillStyle(0x2b1a10, 1); cg.fillRect(0, cy0, cw, 32);
    cg.fillStyle(0xa02a3a, 1); cg.fillRect(0, cy0 + 2, cw, 28);
    cg.fillStyle(0xf6c440, 1); cg.fillRect(0, cy0 + 4, cw, 1); cg.fillRect(0, cy0 + 27, cw, 1);
    const crew = [CH.dirOld, CH.writerGlasses, CH.actorTee, CH.actressHijab, CH.camPony];
    const crewX = short ? sx : land ? bx : CX0;
    crew.forEach((idx, i) => {
      const k = 'title_crew' + i;
      charTextures(this, k, idx);
      const im = this.add.image(crewX + 52 + i * 64, cy0 + 22, k + '_0').setOrigin(0.5, 1).setScale(0.75).setDepth(1002);
      let on = false;
      this.time.addEvent({ delay: 520 + i * 61, loop: true, callback: () => { on = !on; im.setTexture(k + (on ? '_3' : '_0')); } });
    });
    txt(this, GW / 2, GH - 22, 'v5.1  -  Tiru gaya Kairosoft, rasa sinetron  -  Dibuat oleh KodeKecil', 9, '#d8c8a8', { ox: 0.5, oy: 0.5 }).setDepth(1000);
    this.input.once('pointerdown', () => sfx.unlock());
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && this.modal && !this.modal.closed && this.modal.closeBtn) this.modal.close(); });
    sfx.setPaused(false);
    sfx.setMusicOverride(null);
    sfx.playMusic('title');
  }

  continueGame() {
    const s = loadGame();
    if (!s) { this.scene.start('Game', { state: newGame() }); return; }
    this.scene.start('Game', { state: s });
  }

  newGameConfirm(save: boolean) {
    if (!save) { clearSave(); this.scene.start('Game', { state: newGame() }); return; }
    if (this.modal && !this.modal.closed) return;
    const m = new Modal(this, 3000, { w: 290, h: 180, title: 'MAIN BARU?' });
    this.modal = m;
    m.build((m) => {
      m.text(145, 34, 'Save lama bakal ditimpa.\nYakin mulai dari nol?\n(Tips: Backup Save dulu!)', 12, COL.text, { ox: 0.5, align: 'center' });
      m.btn(16, 116, 122, 44, 'Batal', () => m.close());
      m.btn(152, 116, 122, 44, 'Mulai!', () => { clearSave(); this.scene.start('Game', { state: newGame() }); }, { kind: 'red' });
    });
  }

  /** v5: backup export / import from the title screen */
  backupMenu(save: boolean) {
    if (this.modal && !this.modal.closed) return;
    const m = new Modal(this, 3000, { w: 290, h: 230, title: 'BACKUP SAVE', closable: true });
    this.modal = m;
    m.build((m) => {
      m.text(145, 26, 'Simpan progres ke file / kode, atau\nbalikin progres dari backup.', 11, COL.text, { ox: 0.5, align: 'center' });
      m.btn(25, 74, 240, 42, save ? 'Ekspor Backup' : 'Ekspor (belum ada save)', () => { const s = loadGame(); if (s) exportPanel(s); }, { kind: save ? 'primary' : 'disabled', disabled: !save, size: 13 }).setName('titleExport');
      m.btn(25, 126, 240, 42, 'Impor Backup', () => {
        importPanel((st, summary) => this.confirmImport(st, summary, save));
      }, { kind: 'green', size: 13 }).setName('titleImport');
      m.btn(25, 178, 240, 34, 'Tutup', () => m.close(), { size: 12 });
    });
  }
  private confirmImport(st: GameState, summary: string, save: boolean) {
    this.modal?.close();
    const m = new Modal(this, 3000, { w: 300, h: 236, title: 'PAKAI BACKUP?' });
    this.modal = m;
    m.build((m) => {
      m.text(150, 26, summary, 11, COL.text, { ox: 0.5, align: 'center', wrap: 270, lineSpacing: 2 });
      m.text(150, 100, save ? 'Save yang sekarang bakal DITIMPA.' : 'Langsung lanjut main dari backup ini.', 10, save ? COL.red : COL.muted, { ox: 0.5, align: 'center', wrap: 270 });
      m.btn(16, 164, 128, 44, 'Batal', () => m.close(), { size: 12 });
      m.btn(156, 164, 128, 44, 'Pakai!', () => { saveGame(st); sfx.sting('great'); this.scene.start('Game', { state: st }); }, { kind: 'red', size: 12 }).setName('titleConfirmImport');
    });
  }

  tips() {
    if (this.modal && !this.modal.closed) return;
    let p = 0;
    const m = new Modal(this, 3000, { w: 320, h: 300, title: 'CARA MAIN', closable: true });
    this.modal = m;
    m.build((m) => {
      m.text(20, 24, `Tips ${p + 1}/${TIPS.length}`, 10, COL.muted);
      m.panel(14, 42, 292, 180, 'paper');
      m.text(26, 54, TIPS[p], 12, COL.text, { wrap: 268, lineSpacing: 4 });
      m.btn(14, 240, 90, 34, '< Prev', () => { p = (p + TIPS.length - 1) % TIPS.length; m.rebuild(); });
      m.btn(115, 240, 90, 34, 'Tutup', () => m.close(), { kind: 'primary' });
      m.btn(216, 240, 90, 34, 'Next >', () => { p = (p + 1) % TIPS.length; m.rebuild(); });
    });
  }
}
