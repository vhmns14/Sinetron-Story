import Phaser from 'phaser';
import { generateAll } from '../art';
import { preloadAssets } from '../assets';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    preloadAssets(this);
  }
  create() {
    generateAll(this, 1);
    this.scene.start('Title');
  }
}
