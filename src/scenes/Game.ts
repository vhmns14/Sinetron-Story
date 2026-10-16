import Phaser from 'phaser';
import { Sim, type SimEvent } from '../sim';
import { saveGame, dateOf, fmtMoney, fmtNum, fmtShort, TICKS_PER_WEEK, type GameState, type Staff, type RoomId } from '../state';
import { HUD_H } from '../art';
import { staffTextures, charTextures, CH, HI, iconFrame } from '../assets';
import { SPOTS, route, WALK_NODES, VENDOR, MUA, LIGHTS, STAGE_GLOW, SPOT_STANDS, TROPHY_Y, STUDIO_Y, L, type Spot } from '../studio';
import { GENRES, THEMES, POINT_LABEL, POINT_COLOR, POINT_KEYS, PLATFORMS, type PointKey } from '../data';
import { GW, GH, PW, WIDE, BAR_Y, COL, DISPLAY, ROUND, txt, button, bar, Modal, bubbleGfx, pill, woodStrip, type ModalOpts } from '../ui';
import { SidePanel, SIDE_W } from '../sidepanel';
import { sfx } from '../audio';
import * as screens from '../screens';
import * as screens3 from '../screens3';
import * as screens4 from '../screens4';
import * as screens5 from '../screens5';
import * as v5 from '../v5';
import * as backup from '../backup';
import { ACHIEVEMENTS } from '../achievements';
import { Tutorial } from '../tutorial';
import { locById } from '../locations';

class StaffSprite {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  path: { x: number; y: number }[] = [];
  room: RoomId;
  activity: string;
  spot: Spot | null = null;
  animT = 0;
  frame = 0;
  speed = 60;
  lastPop = 0;
  bubbleT = 0;
  bubble: Phaser.GameObjects.Container | null = null;
  constructor(public gs: GameScene, public st: Staff) {
    this.room = st.room;
    this.activity = st.activity;
    this.shadow = gs.add.ellipse(0, 0, 17, 6, 0x000000, 0.28);
    this.img = gs.add.image(0, 0, `st${st.id}_0`).setOrigin(0.5, 1).setScale(HI);
    this.img.setInteractive({ useHandCursor: true });
    this.img.on('pointerup', () => { if (!gs.modalOpen() && !gs.dragMoved) { sfx.click(); screens.openStaffDetail(gs, this.st); } });
    const sp = gs.claimSpot(this);
    this.setPos(sp.x, sp.y);
  }
  setPos(x: number, y: number) {
    this.img.setPosition(Math.round(x), Math.round(y));
    this.img.setDepth(Math.round(y) + 0.5);
    this.shadow.setPosition(Math.round(x), Math.round(y) - 1).setDepth(Math.round(y) - 0.6);
    if (this.bubble) this.bubble.setPosition(Math.round(x), Math.round(y) - 38);
  }
  get x() { return this.img.x; }
  get y() { return this.img.y; }
  destroy() { this.img.destroy(); this.shadow.destroy(); this.bubble?.destroy(); }
}

const SPEEDS = [0, 1, 2, 4];
const TICK_MS = 600;

interface Pop { c: Phaser.GameObjects.Container; x: number; y: number; w: number; h: number; owner: number }
interface Walker { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; key: string; target: number; wait: number; t: number }

const FAME = [300, 2000, 10000, 50000, 200000];
export { BAR_Y };
const VIEW_TOP = HUD_H;
/** world (studio) bounds in logical coords */
const WX0 = 0, WX1 = 360, WY0 = HUD_H, WY1 = 570;
const ZMAX = 2.6;

export class GameScene extends Phaser.Scene {
  sim!: Sim;
  get s(): GameState { return this.sim.s; }
  sprites = new Map<number, StaffSprite>();
  occupancy = new Map<Spot, number>();
  speedIdx = 1;
  acc = 0;
  modals: Modal[] = [];
  private furn: Phaser.GameObjects.GameObject[] = [];
  private bg!: Phaser.GameObjects.Image;
  private glows: Phaser.GameObjects.Image[] = [];
  private hud: Record<string, Phaser.GameObjects.Text> = {};
  private stars: Phaser.GameObjects.Image[] = [];
  private speedBtns: Phaser.GameObjects.Container[] = [];
  private status!: Phaser.GameObjects.Container;
  private statusKey = '';
  private pops: Pop[] = [];
  private toastQ: string[] = [];
  private toastBusy = false;
  private listener!: (e: SimEvent) => void;
  private builtLevel = 0;
  private lastStatusRefresh = 0;
  private trophyObjs: Phaser.GameObjects.GameObject[] = [];
  private npcTimer: Phaser.Time.TimerEvent | null = null;
  private hintArrow: Phaser.GameObjects.Graphics | null = null;
  private walkers: Walker[] = [];
  private statusBottom = 110;
  private muaTimer: Phaser.Time.TimerEvent | null = null;
  private talks = new Set<Phaser.GameObjects.Container>();
  private tripSign: Phaser.GameObjects.Container | null = null;
  private tripKey = '';
  tut: Tutorial | null = null;

  constructor() { super('Game'); }

  init(data: { state: GameState }) {
    this.sim = new Sim(data.state);
    this.sprites = new Map();
    this.occupancy = new Map();
    this.modals = [];
    this.speedIdx = 1;
    this.acc = 0;
    this.toastQ = []; this.toastBusy = false; this.pops = []; this.statusKey = ''; this.npcTimer = null;
    this.walkers = []; this.glows = []; this.furn = []; this.stars = []; this.talks = new Set(); this.muaTimer = null;
    this.tripSign = null; this.tripKey = '';
    this.worldCam = null; this.wz = 1; this.wcx = 180; this.wcy = (WY0 + WY1) / 2; this.sideL = null; this.sideR = null; this.chrome = [];
    this.drag = null; this.dragMoved = false; this.hud = {}; this.stars = []; this.speedBtns = [];
  }

  create() {
    const cam = this.cameras.main;
    cam.setZoom(this.registry.get('zoom') as number).centerOn(GW / 2, GH / 2);
    cam.setBackgroundColor('#140c06');
    charTextures(this, 'npc_vendor', CH.vendor);
    charTextures(this, 'npc_crew', CH.crew);
    charTextures(this, 'npc_ob', CH.officeBoy);
    charTextures(this, 'npc_courier', CH.courier);
    charTextures(this, 'npc_satpam', CH.satpam);
    charTextures(this, 'npc_mua', CH.makeupArtist);
    this.buildStudio();
    this.syncStaff();
    this.buildChrome();
    this.setupInput();
    this.listener = (e) => this.onSim(e);
    this.sim.on(this.listener);
    this.events.once('shutdown', () => { this.sim.off(this.listener); sfx.setPaused(false); sfx.setMusicOverride(null); });
    this.tut = new Tutorial(this);
    (window as unknown as { __sinetron?: unknown }).__sinetron = { scene: this, sim: this.sim, screens, screens3, screens4, screens5, v5, backup, achievements: ACHIEVEMENTS, sfx, tut: this.tut };
    if (this.s.tut === 0) {
      this.s.tutorialSeen = true;
      screens.showWelcome(this);
    } else this.s.tutorialSeen = true;
  }

  // ------------------------------------------------------------ studio
  buildStudio() {
    for (const o of this.furn) o.destroy();
    for (const w of this.walkers) { w.img.destroy(); w.shadow.destroy(); }
    this.furn = []; this.glows = []; this.walkers = [];
    const lv = this.s.studio;
    this.builtLevel = lv;
    if (this.bg) this.bg.destroy();
    this.bg = this.add.image(0, STUDIO_Y, 'bg' + Math.min(3, lv)).setOrigin(0, 0).setScale(HI).setDepth(0);
    if (lv >= 4) this.premiumDecor(lv);
    // stage lighting: warm pool on the set + cones under each lamp (brighter while shooting)
    const pool = this.add.image(STAGE_GLOW.x, STAGE_GLOW.y, 'glow').setScale(3.4, 3.0).setAlpha(0.2).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.glows.push(pool); this.furn.push(pool);
    for (const [px, py] of LIGHTS) {
      const p = L(px, py);
      const ang = Math.atan2(STAGE_GLOW.y - p.y, STAGE_GLOW.x - p.x) - Math.PI / 2;
      const cone = this.add.image(p.x, p.y + 3, 'cone').setOrigin(0.5, 0).setRotation(ang).setAlpha(0.18).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
      this.glows.push(cone); this.furn.push(cone);
    }
    for (const [px, py] of SPOT_STANDS) {
      const p = L(px, py);
      const f = this.add.image(p.x, p.y, 'flare').setAlpha(0.5).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
      this.glows.push(f); this.furn.push(f);
    }
    // bakso vendor at the cart (levels 1-2; the level 3 canteen is a restaurant)
    this.npcTimer?.remove(false);
    if (lv < 3) {
      const sh = this.add.ellipse(VENDOR.x, VENDOR.y - 1, 17, 6, 0x000000, 0.28).setDepth(VENDOR.y - 0.6);
      const npc = this.add.image(VENDOR.x, VENDOR.y, 'npc_vendor_0').setOrigin(0.5, 1).setScale(HI).setFlipX(true).setDepth(VENDOR.y);
      this.furn.push(sh, npc);
      let k = 0;
      this.npcTimer = this.time.addEvent({ delay: 900, loop: true, callback: () => { if (npc.active) { k = (k + 1) % 4; npc.setTexture(k === 3 ? 'npc_vendor_3' : k === 1 ? 'npc_vendor_6' : 'npc_vendor_0'); } } });
    }
    // makeup artist busy at the mirrors
    {
      const sh = this.add.ellipse(MUA.x, MUA.y - 1, 17, 6, 0x000000, 0.28).setDepth(MUA.y - 0.6);
      const mua = this.add.image(MUA.x, MUA.y, 'npc_mua_0').setOrigin(0.5, 1).setScale(HI).setFlipX(true).setDepth(MUA.y);
      this.furn.push(sh, mua);
      let k = 0;
      this.muaTimer?.remove(false);
      this.muaTimer = this.time.addEvent({ delay: 650, loop: true, callback: () => { if (mua.active) { k = (k + 1) % 3; mua.setTexture(k === 0 ? 'npc_mua_0' : k === 1 ? 'npc_mua_3' : 'npc_mua_4'); } } });
    }
    // extras wandering the hallway (more as the studio grows)
    const extras = ['npc_ob', 'npc_courier', 'npc_satpam', 'npc_crew'].slice(0, lv + 1);
    for (let i = 0; i < extras.length; i++) {
      const key = extras[i];
      const n = WALK_NODES[(i * 3) % WALK_NODES.length];
      const shadow = this.add.ellipse(n.x, n.y - 1, 17, 6, 0x000000, 0.28);
      const img = this.add.image(n.x, n.y, key + '_0').setOrigin(0.5, 1).setScale(HI);
      this.walkers.push({ img, shadow, key, target: (i * 3 + 1) % WALK_NODES.length, wait: 600 * i, t: 0 });
    }
    this.drawTrophies();
    // re-place staff
    for (const sp of this.sprites.values()) { sp.spot = null; }
    this.occupancy.clear();
    for (const sp of this.sprites.values()) { const p = this.claimSpot(sp); sp.path = []; sp.setPos(p.x, p.y); }
  }

  /** Studio Bintang / Istana Sinetron: reuse the Lv3 room, add a gold marquee + red carpet + star lights */
  premiumDecor(lv: number) {
    const name = lv >= 5 ? 'ISTANA SINETRON' : 'STUDIO BINTANG';
    const c = this.add.container(262, 128).setDepth(40);
    const t = txt(this, 0, 0, name, 9, '#7a3a08', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#fff4c0', strokeW: 2, res: WIDE ? 2 : 1 });
    const w = t.width + 26, h = 18;
    const g = this.add.graphics();
    g.fillStyle(0x3a200c, 1); g.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 6);
    g.fillStyle(0xf6c440, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 5);
    g.fillStyle(0xfff09a, 1); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, 3, 2);
    // marquee bulbs
    const bulbs: Phaser.GameObjects.Arc[] = [];
    for (let x = -w / 2 + 4; x <= w / 2 - 4; x += 8) for (const y of [-h / 2 - 1, h / 2 + 1]) bulbs.push(this.add.circle(x, y, 1.6, 0xfff8d0));
    c.add([g, ...bulbs, t]);
    let k = 0;
    const ev = this.time.addEvent({ delay: 380, loop: true, callback: () => { k++; bulbs.forEach((b, i) => b.setFillStyle((i + k) % 2 ? 0xfff8d0 : 0xe0662a)); } });
    c.once('destroy', () => ev.remove(false));
    this.furn.push(c);
    if (lv >= 5) {
      // twinkling gold sparkles around the set chandelier
      const spots = [[150, 160], [196, 150], [120, 205], [230, 196], [172, 226], [258, 172]];
      spots.forEach(([x, y], i) => {
        const sp = this.add.image(x, y, 'flare').setDepth(41).setScale(0.35).setTint(0xffe27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.tweens.add({ targets: sp, alpha: { from: 0, to: 0.9 }, scale: { from: 0.2, to: 0.45 }, duration: 520, yoyo: true, repeat: -1, delay: i * 330, repeatDelay: 900 });
        sp.once('destroy', () => this.tweens.killTweensOf(sp));
        this.furn.push(sp);
      });
    }
  }

  drawTrophies() {
    for (const o of this.trophyObjs) o.destroy();
    this.trophyObjs = [];
    const n = Math.min(10, this.s.trophies);
    for (let i = 0; i < n; i++) {
      const im = this.add.image(6 + i * 11, TROPHY_Y, 'f_trophy').setOrigin(0, 1).setDepth(600);
      this.trophyObjs.push(im);
    }
  }

  claimSpot(sp: StaffSprite): Spot {
    if (sp.spot) { this.occupancy.delete(sp.spot); sp.spot = null; }
    const room = sp.st.room;
    const list = SPOTS[room];
    const prefs = this.spotPrefs(sp.st, room);
    let chosen: Spot | null = null;
    for (const tag of prefs) {
      chosen = list.find((s) => s.tags.includes(tag) && !this.occupancy.has(s)) ?? null;
      if (chosen) break;
    }
    if (!chosen) chosen = list.find((s) => !this.occupancy.has(s)) ?? null;
    if (!chosen) {
      const b = list[Math.floor(Math.random() * list.length)];
      chosen = { x: b.x + Math.round((Math.random() - 0.5) * 24), y: b.y + Math.round((Math.random() - 0.5) * 10), tags: [], flip: Math.random() < 0.5 };
    }
    this.occupancy.set(chosen, sp.st.id);
    sp.spot = chosen;
    return chosen;
  }

  spotPrefs(st: Staff, room: RoomId): string[] {
    const actor = st.role === 'aktor' || st.role === 'aktris';
    const working = st.activity === 'work';
    if (room === 'set') {
      if (!working) return ['any'];
      if (actor) return ['actor'];
      if (st.role === 'sutradara') return ['dir'];
      if (st.role === 'kameramen') return ['cam'];
      return ['any'];
    }
    if (room === 'desk') {
      if (working && this.s.prod?.phase === 'editing' && (st.role === 'kameramen' || st.role === 'sutradara')) return ['edit', 'write'];
      return working ? ['write', 'edit'] : ['any'];
    }
    if (room === 'makeup') return working ? ['chair'] : ['any', 'chair'];
    return st.activity === 'rest' ? ['sit'] : ['any', 'sit'];
  }

  makePath(sp: StaffSprite, from: RoomId, to: RoomId, target: Spot) {
    const pts = route(from, to).map((p) => ({ x: p.x, y: p.y }));
    pts.push({ x: target.x, y: target.y });
    sp.path = pts;
    // speed: arrive in about the sim travel time
    let len = 0, px = sp.x, py = sp.y;
    for (const p of pts) { len += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; }
    const travelSec = (3 * TICK_MS) / 1000;
    sp.speed = Math.max(45, len / travelSec);
  }

  syncStaff() {
    const ids = new Set(this.s.staff.map((x) => x.id));
    for (const [id, sp] of this.sprites) {
      if (!ids.has(id)) { if (sp.spot) this.occupancy.delete(sp.spot); sp.destroy(); this.sprites.delete(id); }
    }
    for (const st of this.s.staff) {
      if (!this.sprites.has(st.id)) {
        staffTextures(this, st);
        this.sprites.set(st.id, new StaffSprite(this, st));
      } else this.sprites.get(st.id)!.st = st;
    }
  }

  // ------------------------------------------------------------ v5 responsive chrome (HUD, bottom bar, side panels)
  worldCam: Phaser.Cameras.Scene2D.Camera | null = null;
  /** studio camera zoom relative to the fitted view (1 = whole studio) and its centre (world coords) */
  wz = 1; wcx = 180; wcy = (WY0 + WY1) / 2;
  /** left / right edge of the studio view (logical px) */
  vx0 = 0; vx1 = PW;
  sideL: SidePanel | null = null;
  sideR: SidePanel | null = null;
  private chrome: Phaser.GameObjects.GameObject[] = [];
  private drag: { x: number; y: number; cx: number; cy: number } | null = null;
  dragMoved = false;
  /** centre x of the studio view */
  vcx() { return Math.round((this.vx0 + this.vx1) / 2); }
  /** x offset of the 360-wide studio column drawn in UI space (status card, toasts) */
  colX() { return this.vcx() - PW / 2; }

  private buildChrome() {
    const before = new Set(this.children.list);
    this.sideL = null; this.sideR = null;
    this.vx0 = 0; this.vx1 = GW;
    if (GW >= 880) {
      this.sideL = new SidePanel(this, 'left', 8, VIEW_TOP + 6, SIDE_W, BAR_Y - VIEW_TOP - 12);
      this.sideR = new SidePanel(this, 'right', GW - 8 - SIDE_W, VIEW_TOP + 6, SIDE_W, BAR_Y - VIEW_TOP - 12);
      this.vx0 = SIDE_W + 16; this.vx1 = GW - SIDE_W - 16;
    } else if (GW >= 640) {
      this.sideL = new SidePanel(this, 'both', 8, VIEW_TOP + 6, SIDE_W, BAR_Y - VIEW_TOP - 12);
      this.vx0 = SIDE_W + 16;
    }
    this.buildHud();
    this.buildBottom();
    this.chrome = this.children.list.filter((o) => !before.has(o));
    this.setupWorldCam();
    this.sideL?.refresh(true); this.sideR?.refresh(true);
  }

  /** v5: wide screens draw the studio through its own camera (zoom / pan) inside the view between the side panels */
  private setupWorldCam() {
    if (this.worldCam) { this.cameras.remove(this.worldCam, true); this.worldCam = null; }
    for (const o of this.children.list) o.cameraFilter = 0;
    if (!WIDE) return;
    const Z = this.registry.get('zoom') as number;
    const wc = this.cameras.add(Math.round(this.vx0 * Z), Math.round(VIEW_TOP * Z), Math.round((this.vx1 - this.vx0) * Z), Math.round((BAR_Y - VIEW_TOP) * Z), false, 'world');
    wc.setBackgroundColor('#140c06');
    // the studio renders first, the UI camera (main, transparent) on top of it
    const arr = this.cameras.cameras;
    arr.splice(arr.indexOf(wc), 1); arr.unshift(wc);
    // Phaser 4: a camera is transparent when its background alpha is 0
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.worldCam = wc;
    this.applyWorldCam();
    this.assignCams();
  }
  /** fit zoom: the whole 360 x 520 studio inside the view */
  private fitZoom() { return Math.min((this.vx1 - this.vx0) / (WX1 - WX0), (BAR_Y - VIEW_TOP) / (WY1 - WY0)); }
  /** max relative zoom: on short windows the fit is height-limited, so allow zooming further (same detail as a tall one) */
  private zMax() { return Math.min(6, ZMAX * Math.max(1, ((this.vx1 - this.vx0) / (WX1 - WX0)) / ((BAR_Y - VIEW_TOP) / (WY1 - WY0)) / 1.2)); }
  private applyWorldCam() {
    const wc = this.worldCam;
    if (!wc) return;
    const Z = this.registry.get('zoom') as number;
    this.wz = Math.max(1, Math.min(this.zMax(), this.wz));
    const z = this.fitZoom() * this.wz;
    const visW = (this.vx1 - this.vx0) / z, visH = (BAR_Y - VIEW_TOP) / z;
    const clamp = (v: number, lo: number, hi: number, vis: number) => (vis >= hi - lo ? (lo + hi) / 2 : Math.max(lo + vis / 2, Math.min(hi - vis / 2, v)));
    this.wcx = clamp(this.wcx, WX0, WX1, visW);
    this.wcy = clamp(this.wcy, WY0, WY1, visH);
    wc.setZoom(Z * z).centerOn(this.wcx, this.wcy);
  }
  /** pan the studio by screen (logical) px */
  panBy(dx: number, dy: number) { const z = this.fitZoom() * this.wz; this.wcx += dx / z; this.wcy += dy / z; this.applyWorldCam(); }
  /** zoom the studio keeping the world point under (sx, sy) (logical screen px) in place */
  zoomAt(wz: number, sx: number, sy: number) {
    if (!this.worldCam) return;
    const cx = this.vcx(), cy = (VIEW_TOP + BAR_Y) / 2;
    const z0 = this.fitZoom() * this.wz;
    const wx = this.wcx + (sx - cx) / z0, wy = this.wcy + (sy - cy) / z0;
    this.wz = Math.max(1, Math.min(this.zMax(), wz));
    const z1 = this.fitZoom() * this.wz;
    this.wcx = wx - (sx - cx) / z1; this.wcy = wy - (sy - cy) / z1;
    this.applyWorldCam();
  }
  /** every top-level object goes to exactly one camera: depth < 990 = studio world, the rest = UI */
  private assignCams() {
    const wc = this.worldCam;
    if (!wc) return;
    const mid = this.cameras.main.id, wid = wc.id;
    for (const o of this.children.list) {
      const ui = ((o as unknown as { depth?: number }).depth ?? 0) >= 990;
      o.cameraFilter = ui ? wid : mid;
    }
  }
  private inView(x: number, y: number) { return x >= this.vx0 && x <= this.vx1 && y >= VIEW_TOP && y <= BAR_Y; }

  private setupInput() {
    // v5 desktop: drag to pan / wheel to zoom the studio (wide layout), keyboard shortcuts everywhere
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragMoved = false;
      const Z = this.registry.get('zoom') as number;
      if (!this.worldCam || this.modalOpen() || !this.inView(p.x / Z, p.y / Z)) { this.drag = null; return; }
      this.drag = { x: p.x, y: p.y, cx: this.wcx, cy: this.wcy };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown || this.modalOpen()) return;
      const Z = this.registry.get('zoom') as number;
      const zx = (p.x - d.x) / Z, zy = (p.y - d.y) / Z;
      if (!this.dragMoved && Math.hypot(zx, zy) < 6) return;
      this.dragMoved = true;
      const z = this.fitZoom() * this.wz;
      this.wcx = d.cx - zx / z; this.wcy = d.cy - zy / z; this.applyWorldCam();
    });
    this.input.on('pointerup', () => { this.drag = null; this.time.delayedCall(0, () => { this.dragMoved = false; }); });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (!this.worldCam || this.modalOpen()) return;
      const Z = this.registry.get('zoom') as number;
      const sx = p.x / Z, sy = p.y / Z;
      if (!this.inView(sx, sy)) return;
      const ev = p.event as WheelEvent | undefined;
      if (ev?.shiftKey && Math.abs(dx) < 1) { dx = dy; dy = 0; }
      if (Math.abs(dx) > Math.abs(dy)) { this.panBy(dx / 2, 0); return; }
      if (!dy) return;
      this.zoomAt(this.wz * (dy > 0 ? 0.88 : 1.14), sx, sy);
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }
  private onKey(e: KeyboardEvent) {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.getElementById('sinetron-dom')) return;
    const top = this.modals[this.modals.length - 1];
    if (e.key === 'Escape') {
      if (top) { if (top.closeBtn) top.close(); }
      return;
    }
    if (this.modalOpen()) return;
    const step = 60;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': this.panBy(-step, 0); break;
      case 'ArrowRight': case 'd': case 'D': this.panBy(step, 0); break;
      case 'ArrowUp': case 'w': case 'W': this.panBy(0, -step); break;
      case 'ArrowDown': case 's': case 'S': this.panBy(0, step); break;
      case '+': case '=': this.zoomAt(this.wz * 1.2, this.vcx(), (VIEW_TOP + BAR_Y) / 2); break;
      case '-': case '_': this.zoomAt(this.wz / 1.2, this.vcx(), (VIEW_TOP + BAR_Y) / 2); break;
      case ' ': this.setSpeed(this.speedIdx === 0 ? 1 : 0); break;
      default: return;
    }
    e.preventDefault?.();
  }

  /** the window was resized / rotated and the logical width changed: re-lay out the screen, keep everything else
   *  (sim, staff, open dialogs) */
  relayout(oldGW: number, oldGH = GH) {
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height).centerOn(GW / 2, GH / 2);
    for (const o of this.chrome) o.destroy();
    for (const b of this.speedBtns) b?.destroy();
    this.sideL?.destroy(); this.sideR?.destroy();
    this.hud = {}; this.stars = []; this.speedBtns = []; this.hintArrow = null;
    this.status?.destroy();
    this.statusKey = '';
    this.wz = 1; this.wcx = 180; this.wcy = (WY0 + WY1) / 2;
    if (!WIDE) cam.setBackgroundColor('#140c06');
    this.buildChrome();
    const dx = Math.round((GW - oldGW) / 2);
    for (const m of this.modals) { m.root.x += dx; m.refit(oldGH); }
    // toasts of the old layout: just drop them (their slot may now overlap a dialog or be off screen)
    for (const o of [...this.children.list]) if (o.name === 'toast') (o as unknown as { setVisible: (v: boolean) => void }).setVisible(false);
    this.tut?.relayout();
    this.refreshHud();
  }

  buildHud() {
    const g = this.add.graphics().setDepth(1000);
    woodStrip(g, 0, 0, GW, HUD_H);
    g.fillStyle(0x2a1608, 1); g.fillRect(0, HUD_H - 2, GW, 2);
    const R = GW - PW; // the right group (date + speed) hugs the right edge on wide screens
    pill(g, 4, 4, 187, 20);
    pill(g, 197 + R, 4, 159, 20);
    pill(g, 4, 28, 104, 18);
    pill(g, 113, 28, 78, 18);
    const ic = (x: number, y: number, name: string, sc: number) => this.add.image(x, y, 'icons', iconFrame(name)).setScale(sc).setDepth(1001);
    ic(17, 14, 'money', 0.42);
    ic(124, 37, 'bulb', 0.3);
    this.stars = [];
    for (let i = 0; i < 5; i++) this.stars.push(ic(15 + i * 11.5, 37, 'star', 0.2));
    const big = { weight: '800', font: ROUND };
    this.hud.money = txt(this, 186, 14, '', 15, '#4a2208', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
    this.hud.date = txt(this, 276 + R, 14, '', 13, '#4a2208', { ox: 0.5, oy: 0.5, ...big }).setDepth(1001);
    this.hud.fans = txt(this, 104, 37, '', 10, '#7a3a10', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
    this.hud.rp = txt(this, 186, 37, '', 12, '#4a2208', { ox: 1, oy: 0.5, ...big }).setDepth(1001);
    if (GW >= 640) {
      txt(this, GW / 2, 16, 'SINETRON STORY', 15, '#f6c440', { ox: 0.5, oy: 0.5, font: DISPLAY, stroke: '#3a1c08', strokeW: 4 }).setDepth(1001);
      txt(this, GW / 2, 36, 'Pabrik Air Mata Nasional', 10, '#fff0c8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#3a1c08', strokeW: 3 }).setDepth(1001);
    }
    const labels = ['II', '1x', '2x', '4x'];
    this.speedBtns = [];
    for (let i = 0; i < 4; i++) this.makeSpeedBtn(i, labels[i]);
    this.status = this.add.container(0, 0).setDepth(990);
    this.statusKey = '';
    this.refreshHud();
  }

  makeSpeedBtn(i: number, label: string) {
    const old = this.speedBtns[i];
    if (old) old.destroy();
    const b = button(this, 196 + (GW - PW) + i * 40.5, 27, 39, 20, label, () => this.setSpeed(i), { kind: this.speedIdx === i ? 'sel' : 'btn', size: 10, font: DISPLAY });
    b.setDepth(1001).setName('speed' + i);
    this.speedBtns[i] = b;
  }

  setSpeed(i: number) {
    const prev = this.speedIdx;
    this.speedIdx = i;
    this.makeSpeedBtn(prev, ['II', '1x', '2x', '4x'][prev]);
    this.makeSpeedBtn(i, ['II', '1x', '2x', '4x'][i]);
  }

  /** bottom bar buttons (x, w) - also used by the tutorial to point at them */
  bottomLayout(n: number) {
    const w = WIDE ? Math.min(108, Math.floor((GW - 16) / n) - 6) : 56;
    const step = WIDE ? w + 8 : 59;
    const x0 = WIDE ? Math.round(GW / 2 - (n * step - 8) / 2) : 3;
    return { w, step, x0 };
  }

  buildBottom() {
    const g = this.add.graphics().setDepth(1000);
    woodStrip(g, 0, BAR_Y, GW, GH - BAR_Y);
    g.fillStyle(0x2a1608, 1); g.fillRect(0, BAR_Y, GW, 2);
    const defs: [string, string, () => void][] = [
      ['Menu', 'menu', () => screens.openMenu(this)],
      ['Staf', 'staff', () => screens.openStaff(this)],
      ['Produksi', 'film', () => screens.openProduction(this)],
      ['Peta', 'peta', () => screens3.openMap(this)],
      ['Netizen', 'feed', () => screens5.openFeed(this)],
      ['Studio', 'house', () => screens.openStudio(this)],
    ];
    const L = this.bottomLayout(defs.length);
    defs.forEach(([label, icon, fn], i) => {
      const x = L.x0 + i * L.step, y = BAR_Y + 7, w = L.w, h = 58;
      const c = this.add.container(x, y).setDepth(1001).setName('btn_' + label.toLowerCase());
      const bg = this.add.graphics();
      const draw = (down: boolean) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.35); bg.fillRoundedRect(1, 3, w - 2, h - 1, 9);
        bg.fillStyle(0x4a2508, 1); bg.fillRoundedRect(0, down ? 2 : 0, w, h - 2, 9);
        bg.fillStyle(down ? 0xe2b66e : 0xf5d595, 1); bg.fillRoundedRect(2, (down ? 2 : 0) + 2, w - 4, h - 6, 7);
        bg.fillStyle(0xfff0c8, 1); bg.fillRoundedRect(5, (down ? 2 : 0) + 4, w - 10, 6, 3);
        bg.fillStyle(0xd09a50, 1); bg.fillRoundedRect(4, (down ? 2 : 0) + h - 16, w - 8, 10, 4);
      };
      draw(false);
      const im = icon === 'peta' ? this.add.image(w / 2, 22, 'i_peta').setScale(1) : icon === 'feed' ? this.add.image(w / 2, 22, 'i_feed').setScale(1) : this.add.image(w / 2, 22, 'icons', iconFrame(icon)).setScale(0.5);
      const t = txt(this, w / 2, h - 11, label, WIDE ? 12 : 11, '#4a2208', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#fff4d8', strokeW: 3 });
      const z = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      c.add([bg, im, t, z]);
      if (icon === 'feed') {
        // unread badge
        const b = this.add.container(w - 9, 7).setName('feedBadge');
        const bgc = this.add.circle(0, 0, 7, 0xe0402a).setStrokeStyle(1.5, 0x5a1408);
        const bt = txt(this, 0, 0, '', 9, '#ffffff', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800' });
        b.add([bgc, bt]); b.setVisible(false); c.add(b);
        this.feedBadge = { c: b, t: bt };
      }
      let pressed = false;
      const up = () => { pressed = false; draw(false); im.y = 22; t.y = h - 11; };
      z.on('pointerdown', () => { pressed = true; draw(true); im.y = 24; t.y = h - 9; });
      z.on('pointerout', () => { if (pressed) up(); });
      z.on('pointerup', () => { if (!pressed) return; up(); sfx.click(); if (!this.modalOpen()) fn(); });
    });
    // first-time hint arrow above "Produksi"
    const arrow = this.add.graphics().setDepth(1002);
    arrow.fillStyle(COL.out, 1); arrow.fillTriangle(-9, -1, 9, -1, 0, 11);
    arrow.fillStyle(0xf6c440, 1); arrow.fillTriangle(-7, 0, 7, 0, 0, 9);
    arrow.setPosition(L.x0 + 2 * L.step + L.w / 2, BAR_Y - 8);
    this.tweens.add({ targets: arrow, y: BAR_Y - 2, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hintArrow = arrow;
  }
  feedBadge: { c: Phaser.GameObjects.Container; t: Phaser.GameObjects.Text } | null = null;

  refreshHud() {
    const s = this.s;
    const d = dateOf(s.absWeek);
    this.hud.money.setText(fmtMoney(s.money)).setColor(s.money < 0 ? COL.red : '#4a2208');
    this.hud.date.setText(`Th ${d.year}  Bln ${d.month}  Mg ${d.week}`);
    this.hud.fans.setText(fmtShort(s.fans).replace(/^Rp ?/, ''));
    this.hud.rp.setText(fmtNum(s.rp));
    // fame meter: one star per threshold, partial star dimmed
    FAME.forEach((th, i) => {
      const prev = i ? FAME[i - 1] : 0;
      const f = Math.max(0, Math.min(1, (s.fans - prev) / (th - prev)));
      this.stars[i].setAlpha(f >= 1 ? 1 : 0.25 + f * 0.5).setTint(f >= 1 ? 0xffffff : 0x8a7a6a);
    });
    this.refreshStatus();
  }

  refreshStatus(force = false) {
    const s = this.s;
    const p = s.prod;
    const airing = s.shows.filter((x) => x.weeksAired < x.airWeeks);
    const key = JSON.stringify([
      p ? [p.phase, Math.floor((p.phaseTick / p.phaseTicks[this.sim.phaseIndex(p.phase)]) * 40), POINT_KEYS.map((k) => Math.round(p.points[k])), p.bloopers, Math.round(p.hype)] : null,
      s.job ? [s.job.name, s.job.ticksLeft, Math.round(s.job.progress)] : null,
      airing.map((x) => [x.id, x.weeksAired, x.ranks.length ? x.ranks[x.ranks.length - 1] : 0, x.boostWeeks, x.cancelled, x.tWeeks]), s.trend, Math.round(s.kpi / 5), Math.round(s.boikot / 5), s.staff.map((x) => x.strike ?? 0).join(''), this.sim.isRamadan(), this.sim.weeksToRamadan() <= 4 ? this.sim.weeksToRamadan() : -1, p ? p.location : null, s.staff.length, s.staff.filter((x) => x.energy < 40).length,
    ]);
    if (!force && key === this.statusKey) return;
    this.statusKey = key;
    this.status.removeAll(true);
    this.status.x = this.colX();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { this.status.add(o); return o; };
    const X = 12, Y = 56, R = 348;
    const card = add(this.add.graphics());
    const lines: (() => void)[] = [];
    let y = Y + 4;
    const rmd = this.sim.isRamadan(), rwk = this.sim.weeksToRamadan();
    if (rmd || rwk <= 4) {
      const y0 = y;
      lines.push(() => {
        const gg = add(this.add.graphics());
        gg.fillStyle(0x1e5a2a, 1); gg.fillRoundedRect(X - 3, y0 - 1, R - X + 6, 15, 6);
        gg.fillStyle(rmd ? 0x2e8b3a : 0x4a7a3a, 1); gg.fillRoundedRect(X - 2, y0, R - X + 4, 13, 5);
        // crescent + star
        gg.fillStyle(0xffd23a, 1); gg.fillCircle(X + 6, y0 + 6.5, 5);
        gg.fillStyle(rmd ? 0x2e8b3a : 0x4a7a3a, 1); gg.fillCircle(X + 8.5, y0 + 5, 4.4);
        gg.fillStyle(0xffd23a, 1); gg.fillRect(X + 12, y0 + 3, 2, 2);
        // ketupat on the right
        for (let i = 0; i < 2; i++) { const kx = R - 10 - i * 12, ky = y0 + 6.5; gg.fillStyle(0x1e5a2a, 1); gg.fillTriangle(kx - 5, ky, kx, ky - 5, kx + 5, ky); gg.fillTriangle(kx - 5, ky, kx, ky + 5, kx + 5, ky); gg.fillStyle(0xe8c040, 1); gg.fillTriangle(kx - 3.5, ky, kx, ky - 3.5, kx + 3.5, ky); gg.fillTriangle(kx - 3.5, ky, kx, ky + 3.5, kx + 3.5, ky); }
        const label = rmd ? 'BULAN RAMADAN  ·  Religi & Keluarga naik daun!' : `RAMADAN ${rwk} MINGGU LAGI  ·  slot Sinetron Ramadan kebuka`;
        T(X + 19, y0 + 7, label, 9, '#fff8e0', { oy: 0.5, font: ROUND, weight: '800' });
      });
      y += 17;
    }
    const T = (x: number, yy: number, str: string, size: number, color: string = COL.text, o: Parameters<typeof txt>[6] = {}) => add(txt(this, x, yy, str, size, color, o));
    if (p) {
      const g = GENRES.find((x) => x.id === p.genre)!, t = THEMES.find((x) => x.id === p.theme)!;
      const pi = this.sim.phaseIndex(p.phase);
      const ttl = p.title.length > 26 ? p.title.slice(0, 25) + '…' : p.title;
      const yy = y;
      lines.push(() => {
        T(X, yy, ttl, 11, '#4a2208', { font: ROUND, weight: '800' });
        const names = ['Naskah', 'Syuting', 'Editing'];
        let cx = R;
        for (let i = 2; i >= 0; i--) {
          const lab = txt(this, 0, 0, names[i], 9, i === pi ? '#ffffff' : i < pi ? '#2e7a2e' : '#9a8a70', { font: ROUND, weight: '800', oy: 0.5 });
          const w = lab.width + 10;
          cx -= w;
          const gg = add(this.add.graphics());
          gg.fillStyle(i === pi ? 0xe0662a : i < pi ? 0xcdeec0 : 0xe8dcc0, 1); gg.fillRoundedRect(cx, yy + 1, w, 13, 6);
          lab.setPosition(cx + 5, yy + 8); add(lab);
          cx -= 3;
        }
      });
      y += 16;
      const yb = y;
      lines.push(() => {
        add(bar(this, X, yb + 1, R - X, 6, p.phaseTick / p.phaseTicks[pi], 0xf6a020));
      });
      y += 10;
      const yp = y;
      lines.push(() => {
        let cx = X;
        const chip = (label: string, val: string, col: string) => {
          const gg = add(this.add.graphics());
          gg.fillStyle(COL.out, 1); gg.fillCircle(cx + 4, yp + 7, 4.5);
          gg.fillStyle(Phaser.Display.Color.HexStringToColor(col).color, 1); gg.fillCircle(cx + 4, yp + 7, 3.5);
          const a = T(cx + 11, yp, label, 9, COL.muted, { font: ROUND, weight: '600' });
          const b = T(cx + 13 + a.width, yp - 1, val, 11, '#4a2208', { font: ROUND, weight: '800' });
          cx += 18 + a.width + b.width;
        };
        POINT_KEYS.forEach((k) => chip(POINT_LABEL[k], fmtNum(p.points[k]), POINT_COLOR[k]));
        chip('Blooper', String(p.bloopers), '#ff6a5a');
        chip('Hype', fmtNum(p.hype), '#ff9ad8');
        void g; void t;
      });
      y += 15;
    } else if (s.job) {
      const j = s.job;
      const total = j.weeks * TICKS_PER_WEEK;
      const y0 = y;
      lines.push(() => {
        T(X, y0, 'Job: ' + j.name, 11, '#4a2208', { font: ROUND, weight: '800' });
        T(R, y0 + 1, `Bayaran ${fmtShort(j.pay)}`, 10, COL.green, { ox: 1, font: ROUND, weight: '800' });
        T(X, y0 + 16, 'Waktu', 9, COL.muted, { font: ROUND, weight: '600' });
        add(bar(this, X + 34, y0 + 19, 128, 7, 1 - j.ticksLeft / total, 0xf6c440));
        T(X + 172, y0 + 16, 'Hasil', 9, COL.muted, { font: ROUND, weight: '600' });
        add(bar(this, X + 202, y0 + 19, R - X - 202, 7, j.progress / j.need, 0x6ac46a));
      });
      y += 31;
    } else {
      const y0 = y;
      const tg = GENRES.find((x) => x.id === s.trend);
      const tired = s.staff.filter((x) => x.energy < 40).length;
      lines.push(() => {
        T(X, y0, 'Studio lagi santai... tekan PRODUKSI!', 11, '#4a2208', { font: ROUND, weight: '800' });
        const info = `${tg ? `Tren: ${tg.name}  ·  ` : ''}Staf ${s.staff.length}/${this.sim.maxStaff()}  ·  Biaya ${fmtShort(this.sim.monthlyCosts())}/bln${tired ? `  ·  ${tired} capek` : ''}`;
        T(X, y0 + 16, info, 9, tired ? COL.red : COL.muted, { font: ROUND, weight: '600' });
      });
      y += 30;
    }
    // v5: KPI / netizen / strike warnings (tap -> KPI & Netizen)
    const strikers = s.staff.filter((x) => x.strike && x.strike > 0);
    if (s.kpi >= 25 || s.boikot >= 35 || strikers.length) {
      const y0 = y;
      const parts: string[] = [];
      if (s.kpi >= 25) parts.push(`Teguran KPI ${Math.round(s.kpi)}%`);
      if (s.boikot >= 35) parts.push(s.boikot >= 55 ? 'Netizen NGAMUK' : 'Netizen panas');
      if (strikers.length) parts.push(`${strikers[0].name.split(' ').slice(-1)[0]} mogok`);
      const hot = s.kpi >= 40 || s.boikot >= 55;
      lines.push(() => {
        add(this.add.image(X + 7, y0 + 7, 'i_kpi').setScale(0.55));
        T(X + 17, y0, parts.join('  ·  '), 9, hot ? COL.red : '#9a6a10', { font: ROUND, weight: '800' });
        const z = add(this.add.zone(X - 4, y0 - 2, R - X + 8, 16).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
        z.on('pointerup', () => { if (!this.modalOpen()) { sfx.click(); screens5.openKpi(this); } });
      });
      y += 15;
    }
    const onAir = airing.filter((x) => !x.cancelled);
    if (onAir.length) {
      const a = onAir[onAir.length - 1];
      const pl = PLATFORMS.find((x) => x.id === a.platform)!;
      const y0 = y;
      const ttl = a.title.length > 18 ? a.title.slice(0, 17) + '…' : a.title;
      const rank = a.ranks.length ? a.ranks[a.ranks.length - 1] : 0;
      const prev = a.ranks.length > 1 ? a.ranks[a.ranks.length - 2] : 0;
      const cur = a.hist.length ? a.hist[a.hist.length - 1] : a.rating;
      lines.push(() => {
        let cx = X;
        if (rank) {
          const col = rank === 1 ? 0xe0402a : rank <= 3 ? 0x4a9a3a : 0x8a6a4a;
          const lab = txt(this, 0, 0, '#' + rank, 10, '#ffffff', { font: ROUND, weight: '800', oy: 0.5 });
          const w = lab.width + (prev && prev !== rank ? 18 : 9);
          const gg = add(this.add.graphics());
          gg.fillStyle(col, 1); gg.fillRoundedRect(cx, y0 + 1, w, 13, 6);
          if (prev && prev !== rank) {
            const ax = cx + lab.width + 10, ay = y0 + 7.5;
            gg.fillStyle(0xffffff, 1);
            if (rank < prev) gg.fillTriangle(ax - 3.5, ay + 2.5, ax + 3.5, ay + 2.5, ax, ay - 3); else gg.fillTriangle(ax - 3.5, ay - 2.5, ax + 3.5, ay - 2.5, ax, ay + 3);
          }
          lab.setPosition(cx + 4.5, y0 + 8); add(lab);
          cx += w + 4;
        } else { add(this.add.image(X + 7, y0 + 7, 'i_tvicon').setScale(0.75)); cx = X + 17; }
        T(cx, y0, `${ttl}  ${cur}%`, 10, COL.blue, { font: ROUND, weight: '800' });
        T(R, y0 + 1, `${pl.short} ${a.weeksAired}/${a.airWeeks}mg  +${fmtShort(this.sim.weeklyRevenue(a))}${onAir.length > 1 ? ` (+${onAir.length - 1})` : ''}`, 9, COL.green, { ox: 1, font: ROUND, weight: '600' });
        const z = add(this.add.zone(X - 4, y0 - 2, R - X + 8, 17).setOrigin(0, 0).setInteractive({ useHandCursor: true }));
        z.on('pointerup', () => { if (!this.modalOpen()) { sfx.click(); screens3.openRatingChart(this, a.platform, a.id); } });
      });
      y += 15;
    }
    const h = y - Y + 2;
    card.fillStyle(0x000000, 0.25); card.fillRoundedRect(5, Y + 2, PW - 10, h, 8);
    card.fillStyle(0x5a3010, 0.95); card.fillRoundedRect(4, Y - 1, PW - 8, h + 2, 9);
    card.fillStyle(0xfff3d6, 0.93); card.fillRoundedRect(6, Y + 1, PW - 12, h - 2, 7);
    lines.forEach((f) => f());
    this.statusBottom = Y + h;
  }

  // ------------------------------------------------------------ modal stack
  modalOpen() { return this.modals.length > 0; }
  modal(o: ModalOpts = {}): Modal {
    const m = new Modal(this, 2000 + this.modals.length * 20, o);
    this.modals.push(m);
    // a toast already on screen must not sit on top of the new dialog: hide it (its timer still runs the queue on)
    this.hideToastsUnder(m);
    m.onClosed = () => {
      this.modals = this.modals.filter((x) => x !== m);
      this.refreshHud();
    };
    return m;
  }

  toast(text: string) {
    this.toastQ.push(text);
    if (this.toastQ.length > 3) this.toastQ.splice(0, this.toastQ.length - 3);
    if (!this.toastBusy) { this.toastBusy = true; this.time.delayedCall(30, () => this.nextToast()); }
  }
  /** v5.1: where a toast / banner of this size can go without touching an open dialog (screen coords), or null =
   *  nowhere (hold it until the dialog closes). Order: under the dialog, above it, then the side gutter (wide). */
  toastSlot(w: number, h: number, prefer: 'below' | 'above' = 'below'): { x: number; y: number; wrap?: number } | null {
    const m = this.modals[this.modals.length - 1];
    if (!m) {
      let y = prefer === 'above' ? Math.min(BAR_Y - 30, this.statusBottom + 16 + h / 2) : this.statusBottom + 16;
      // v5.1: never on top of the tutorial coach bubble (it has a button): go under it, or above it when it is low
      const tb = this.children.getByName('tutBubble') as Phaser.GameObjects.Container | null;
      if (tb && tb.visible) {
        const b = tb.getBounds();
        if (y + h / 2 > b.y - 4 && y - h / 2 < b.bottom + 4) y = b.bottom + 6 + h / 2 <= BAR_Y - 4 ? Math.round(b.bottom + 6 + h / 2) : Math.round(b.y - 6 - h / 2);
      }
      return { x: this.vcx(), y };
    }
    const r = m.rect();
    if (m.opts.noPanel) return null;
    const pad = 6;
    const below = GH - r.y1 >= h + pad * 2 ? { x: GW / 2, y: Math.round(GH - pad - h / 2) } : null;
    const above = r.y0 >= h + pad * 2 ? { x: GW / 2, y: Math.round(pad + h / 2) } : null;
    const pick = prefer === 'below' ? below ?? above : above ?? below;
    if (pick) return pick;
    // side gutters (wide layouts): the toast gets a narrower wrap to fit
    const gut = Math.min(r.x0, GW - r.x1) - pad * 2;
    if (gut >= Math.min(w, 150)) return { x: Math.round(r.x1 + pad + gut / 2), y: Math.round(GH / 2), wrap: Math.min(300, gut - 24) };
    return null;
  }
  /** hide toasts that a newly opened dialog would cover */
  private hideToastsUnder(m: Modal) { this.hideToastsIn(m.rect()); }
  /** hide toasts overlapping a rect (screen coords): a new dialog, the tutorial coach */
  hideToastsIn(r: { x0: number; x1: number; y0: number; y1: number }) {
    for (const o of this.children.list) {
      if (o.name !== 'toast') continue;
      const c = o as Phaser.GameObjects.Container;
      const b = c.getBounds();
      if (b.right > r.x0 && b.x < r.x1 && b.bottom > r.y0 && b.y < r.y1) c.setVisible(false);
    }
  }
  private nextToast() {
    if (!this.sys.isActive()) { this.toastQ = []; this.toastBusy = false; return; }
    const t = this.toastQ[0];
    if (!t) { this.toastBusy = false; return; }
    this.toastBusy = true;
    const label = txt(this, 0, 0, t, 12, '#4a2208', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', align: 'center', wrap: 300 });
    let slot = this.toastSlot(Math.min(330, label.width + 24), label.height + 10);
    if (slot?.wrap && slot.wrap < 300) {
      label.setWordWrapWidth(slot.wrap, true);
      slot = this.toastSlot(label.width + 24, label.height + 10);
      if (slot && !slot.wrap) slot = null;
    }
    // no free spot next to the open dialog (full-screen rating show, a dialog filling a short window): hold it
    if (!slot) { label.destroy(); this.time.delayedCall(400, () => this.nextToast()); return; }
    this.toastQ.shift();
    const top = slot.y;
    const c = this.add.container(slot.x, top).setDepth(5000).setName('toast');
    const w = Math.min(330, label.width + 24), h = label.height + 10;
    const g = this.add.graphics(); bubbleGfx(g, w, h, 0xffe27a, 0x7a4a08, false, 10);
    c.add([g, label]);
    c.setAlpha(0); c.y = top - 10;
    this.tweens.add({ targets: c, alpha: 1, y: top, duration: 180 });
    this.time.delayedCall(1900, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 220, onComplete: () => { c.destroy(); this.nextToast(); } });
    });
  }

  /** rounded label bubble ("+Drama") that stacks above its owner and never overlaps another */
  popup(x: number, y: number, text: string, color: string, size = 10, owner = -1) {
    if (this.pops.length > 14) return;
    const mine = this.pops.filter((p) => p.owner === owner && owner >= 0);
    if (mine.length >= 2) return;
    const t = txt(this, 0, 0, text, size, '#3a1e08', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: WIDE ? 2 : 1 });
    const dot = color !== '#ffffff';
    const w = Math.round(t.width + (dot ? 18 : 12)), h = Math.round(t.height - 1);
    if (dot) t.x = 4;
    let py = y - h / 2;
    if (mine.length) py = Math.min(...mine.map((p) => p.c.y)) - h - 3;
    const rects = [...this.pops.map((p) => ({ x: p.x, y: p.c.y, w: p.w, h: p.h }))];
    for (const c of this.talks) { if (c.active) rects.push({ x: c.x, y: c.y - 8, w: (c.getData('w') as number) + 4, h: (c.getData('h') as number) + 8 }); }
    const hit = (yy: number) => rects.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 2 && Math.abs(p.y - yy) < (p.h + h) / 2 + 2);
    let tries = 0;
    while (hit(py) && tries < 3) { py -= h + 3; tries++; }
    if (hit(py) || py < this.popTop()) return;
    const c = this.add.container(Math.round(x), Math.round(py)).setDepth(900);
    const g = this.add.graphics();
    bubbleGfx(g, w, h, 0xffffff, 0x3a1e08, mine.length === 0, Math.min(8, h / 2));
    if (dot) {
      g.fillStyle(0x3a1e08, 1); g.fillCircle(-w / 2 + 8, 0, 4.5);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1); g.fillCircle(-w / 2 + 8, 0, 3.5);
    }
    c.add([g, t]);
    const pop: Pop = { c, x: Math.round(x), y: Math.round(py), w, h, owner };
    this.pops.push(pop);
    c.setScale(0.4);
    this.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, y: c.y - 5, duration: 1100, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: c, alpha: 0, delay: 950, duration: 250,
      onComplete: () => { c.destroy(); this.pops = this.pops.filter((p) => p !== pop); },
    });
  }

  /** popups never go above this world y (under the status card; just under the HUD while the studio is zoomed in) */
  private popTop() { return this.worldCam && this.wz > 1.05 ? WY0 + 4 : this.statusBottom + 4; }

  speech(sp: StaffSprite, text: string, ms = 1400) {
    sp.bubble?.destroy();
    const c = this.add.container(sp.x, sp.y - 38).setDepth(950);
    const t = txt(this, 0, -8, text, 11, '#3a1e08', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', res: WIDE ? 2 : 1 });
    const w = Math.round(t.width + 14), h = Math.round(t.height);
    const g = this.add.graphics();
    g.setPosition(0, -8);
    bubbleGfx(g, w, h, 0xffffff, 0x3a1e08, true, 8);
    c.add([g, t]);
    c.setData('w', w).setData('h', h);
    c.setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, duration: 160, ease: 'Back.easeOut' });
    sp.bubble = c;
    this.talks.add(c);
    c.once('destroy', () => this.talks.delete(c));
    this.time.delayedCall(ms, () => { if (sp.bubble === c) { c.destroy(); sp.bubble = null; } });
  }

  // ------------------------------------------------------------ sim events
  onSim(e: SimEvent) {
    switch (e.type) {
      case 'work': {
        const sp = this.sprites.get(e.staffId);
        if (!sp || this.sim.onLocation(sp.st)) return;
        const now = this.time.now;
        if (e.key !== 'blooper' && now - sp.lastPop < 420 / Math.max(1, SPEEDS[this.speedIdx])) return;
        sp.lastPop = now;
        const yy = sp.y - 38;
        const id = sp.st.id;
        if (e.key === 'blooper') { this.popup(sp.x, yy, 'Blooper!', '#ff6a5a', 10, id); sfx.blooper(); }
        else if (e.key === 'fix') this.popup(sp.x, yy, 'Beres!', '#6ad04a', 10, id);
        else if (e.key === 'hype') this.popup(sp.x, yy, '+Hype', '#ff9ad8', 10, id);
        else if (e.key === 'riset') { this.popup(sp.x, yy, '+Riset', '#ffd84a', 10, id); sfx.coin(); }
        else if (e.key === 'job') this.popup(sp.x, yy, '+Kerja', '#ffb070', 10, id);
        else { this.popup(sp.x, yy, '+' + POINT_LABEL[e.key as PointKey], POINT_COLOR[e.key as PointKey], 10, id); if (Math.random() < 0.3) sfx.pop(); }
        break;
      }
      case 'money': {
        const t = (e.amount >= 0 ? '+' : '') + fmtShort(e.amount);
        // wide: float it in the free HUD space right of the money pill (the side panel sits under the HUD)
        const tt = WIDE ? txt(this, 198, 14, t, 12, e.amount >= 0 ? '#9af07a' : '#ff7a6a', { oy: 0.5, stroke: '#2b1a10', strokeW: 3, font: ROUND, weight: '800' }).setDepth(1200)
          : txt(this, 186, 54, t, 12, e.amount >= 0 ? '#9af07a' : '#ff7a6a', { ox: 1, stroke: '#2b1a10', strokeW: 3, font: ROUND, weight: '800' }).setDepth(1200);
        this.tweens.add({ targets: tt, y: WIDE ? 2 : 70, alpha: 0, duration: 1400, onComplete: () => tt.destroy() });
        if (e.amount > 0) sfx.coin();
        break;
      }
      case 'phase': {
        sfx.phase();
        const names = { naskah: 'Tahap NASKAH dimulai! Penulis ngebut nulis.', syuting: 'Tahap SYUTING! Lampu, kamera...', editing: 'Tahap EDITING! Beresin blooper.' };
        this.toast(names[e.phase]);
        if (e.phase === 'syuting') this.time.delayedCall(1500, () => this.directorShout());
        break;
      }
      case 'levelup': {
        const st = this.s.staff.find((x) => x.id === e.staffId);
        const sp = this.sprites.get(e.staffId);
        if (st && sp) { this.popup(sp.x, sp.y - 38, 'LEVEL UP!', '#ffe066', 11, st.id); this.toast(`${st.name} naik ke Lv ${st.level}!`); sfx.levelup(); }
        break;
      }
      case 'toast': this.toast(e.text); break;
      case 'achv': screens5.achToast(this, e.id); break;
      case 'week': saveGame(this.s); break;
      case 'month': break;
      case 'queue': break;
    }
  }

  directorShout() {
    const d = [...this.sprites.values()].find((x) => x.st.role === 'sutradara' && x.st.activity === 'work' && !this.sim.onLocation(x.st));
    if (!d || !this.s.prod) return;
    this.speech(d, Phaser.Math.RND.pick(['Aksi!', 'Cut! Ulang!', 'Lebih sedih!', 'Zoom in!', 'Mantap!']));
    d.img.setTexture(`st${d.st.id}_shout`);
  }

  processQueue() {
    if (this.modalOpen() || this.s.queue.length === 0) return;
    const p = this.s.queue[0];
    screens.showPending(this, p, () => {
      this.sim.shift();
      this.refreshHud();
      saveGame(this.s);
    });
  }

  /** "Lagi syuting di Bali" sign over the empty set while the crew is away */
  updateTrip() {
    const p = this.s.prod;
    const l = p && p.phase === 'syuting' ? locById(p.location) : undefined;
    const key = l ? l.id : '';
    if (key === this.tripKey) return;
    this.tripKey = key;
    this.tripSign?.destroy(); this.tripSign = null;
    if (!l) return;
    const c = this.add.container(150, 236).setDepth(800);
    const lab1 = txt(this, 0, -7, 'LAGI SYUTING DI', 9, '#fff4d8', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#3a1e08', strokeW: 3, res: WIDE ? 2 : 1 });
    const lab2 = txt(this, 0, 8, l.name.toUpperCase() + '!', 12, '#ffe066', { ox: 0.5, oy: 0.5, font: ROUND, weight: '800', stroke: '#3a1e08', strokeW: 3, res: WIDE ? 2 : 1 });
    const w = Math.max(lab1.width, lab2.width) + 46, h = 34;
    const g = this.add.graphics();
    g.fillStyle(0x3a200c, 1); g.fillRect(-w / 2 + 10, -h / 2 - 14, 2, 14); g.fillRect(w / 2 - 12, -h / 2 - 14, 2, 14);
    g.fillStyle(0x000000, 0.3); g.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 8);
    g.fillStyle(0x3a200c, 1); g.fillRoundedRect(-w / 2 - 1.5, -h / 2 - 1.5, w + 3, h + 3, 9);
    g.fillStyle(0xa8662f, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.fillStyle(0xc88446, 1); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, 4, 2);
    const bus = this.add.image(-w / 2 + 18, 1, 'i_bus').setScale(0.9);
    c.add([g, bus, lab1, lab2]);
    lab1.x += 10; lab2.x += 10;
    c.setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: bus, y: 0, duration: 260, yoyo: true, repeat: -1 });
    c.once('destroy', () => { this.tweens.killTweensOf(c); this.tweens.killTweensOf(bus); });
    this.tripSign = c;
  }

  // ------------------------------------------------------------ update
  update(_t: number, dtRaw: number) {
    const dt = Math.min(100, dtRaw);
    const spd = SPEEDS[this.speedIdx];
    if (this.builtLevel !== this.s.studio) this.buildStudio();
    if (!this.modalOpen()) {
      if (this.s.queue.length) this.processQueue();
      else if (spd > 0 && !this.s.gameOver) {
        this.acc += dt * spd;
        let n = 0;
        while (this.acc >= TICK_MS && n < 8) {
          this.acc -= TICK_MS; n++;
          this.sim.tick();
          if (this.sim.blocked) { this.acc = 0; break; }
        }
        if (this.acc > TICK_MS * 2) this.acc = TICK_MS * 2; // don't bank a backlog after a lag spike
        if (n) this.refreshHud();
      }
    }
    // background music follows the production state; speed II pauses it
    sfx.playMusic(this.s.prod?.phase === 'syuting' ? 'crunch' : 'studio');
    sfx.setPaused(spd === 0 && !sfx.hasOverride() && !this.s.gameOver);
    const eff = this.modalOpen() ? 0 : Math.max(spd, 0);
    this.updateTrip();
    this.updateSprites(dt, eff);
    this.updateWalkers(dt, eff);
    // stage lights: soft glow always, bright pulsing while shooting
    const syuting = this.s.prod?.phase === 'syuting';
    const pulse = Math.sin(this.time.now / 260);
    this.glows.forEach((gl, i) => {
      const base = i === 0 ? (syuting ? 0.42 : 0.16) : (syuting ? 0.34 + 0.08 * Math.sin(this.time.now / 300 + i) : 0.12);
      const target = base + (syuting ? pulse * 0.04 : 0);
      gl.setAlpha(Phaser.Math.Linear(gl.alpha, target, 0.06));
    });
    if (syuting && Math.random() < 0.002 * Math.max(1, spd)) this.directorShout();
    if (this.hintArrow) this.hintArrow.setVisible(!this.s.prod && !this.s.job && this.s.shows.length === 0 && !this.modalOpen());
    if (this.time.now - this.lastStatusRefresh > 500) { this.lastStatusRefresh = this.time.now; this.refreshStatus(); this.sideL?.refresh(); this.sideR?.refresh(); this.refreshBadge(); }
    this.tut?.update();
    this.assignCams();
  }

  /** unread netizen posts on the bottom-bar button */
  refreshBadge() {
    const b = this.feedBadge;
    if (!b) return;
    const n = screens5.unreadFeed(this.s);
    b.c.setVisible(n > 0);
    if (n > 0) b.t.setText(n > 9 ? '9+' : String(n));
  }

  updateWalkers(dt: number, spd: number) {
    for (const w of this.walkers) {
      if (spd <= 0) { w.img.setTexture(w.key + '_0'); continue; }
      if (w.wait > 0) { w.wait -= dt * spd; w.img.setTexture(w.key + '_0'); continue; }
      const tg = WALK_NODES[w.target];
      const dx = tg.x - w.img.x, dy = tg.y - w.img.y, dist = Math.hypot(dx, dy);
      const step = (26 * Math.min(spd, 2) * dt) / 1000;
      if (dist <= step) {
        w.img.setPosition(tg.x, tg.y);
        w.target = (w.target + 1 + Math.floor(Math.random() * (WALK_NODES.length - 1))) % WALK_NODES.length;
        w.wait = 800 + Math.random() * 2500;
      } else {
        w.img.setPosition(w.img.x + (dx / dist) * step, w.img.y + (dy / dist) * step);
        if (Math.abs(dx) > 0.5) w.img.setFlipX(dx < 0);
      }
      w.t += dt * spd;
      if (dist > step) w.img.setTexture(w.key + (Math.floor(w.t / 170) % 2 ? '_1' : '_2'));
      w.img.setDepth(Math.round(w.img.y) + 0.4);
      w.shadow.setPosition(Math.round(w.img.x), Math.round(w.img.y) - 1).setDepth(Math.round(w.img.y) - 0.7);
    }
  }

  updateSprites(dt: number, spd: number) {
    for (const sp of this.sprites.values()) {
      const st = sp.st;
      const away = this.sim.onLocation(st);
      if (sp.img.visible === away) { sp.img.setVisible(!away); sp.shadow.setVisible(!away); if (away && sp.bubble) { sp.bubble.destroy(); sp.bubble = null; } }
      if (away) continue;
      if (st.room !== sp.room || (st.activity !== sp.activity)) {
        const from = sp.room;
        sp.activity = st.activity;
        if (st.room !== sp.room || !sp.spot) {
          sp.room = st.room;
          const target = this.claimSpot(sp);
          this.makePath(sp, from, st.room, target);
        } else {
          const target = this.claimSpot(sp);
          this.makePath(sp, from, st.room, target);
        }
        if (st.activity === 'rest') this.speech(sp, 'Laper...', 1000);
      }
      sp.animT += dt * Math.max(spd, 0.0001);
      if (sp.path.length && spd > 0) {
        const tgt = sp.path[0];
        const dx = tgt.x - sp.x, dy = tgt.y - sp.y;
        const dist = Math.hypot(dx, dy);
        const step = (sp.speed * spd * dt) / 1000;
        if (dist <= step) { sp.setPos(tgt.x, tgt.y); sp.path.shift(); }
        else { sp.setPos(sp.x + (dx / dist) * step, sp.y + (dy / dist) * step); }
        if (Math.abs(dx) > 0.5) sp.img.setFlipX(dx < 0);
        const f = Math.floor(sp.animT / 140) % 2 === 0 ? 1 : 2;
        sp.img.setTexture(`st${st.id}_${f}`);
      } else if (!sp.path.length) {
        if (sp.spot) sp.img.setFlipX(!!sp.spot.flip);
        if (st.activity === 'work' && spd > 0) {
          const actor = st.role === 'aktor' || st.role === 'aktris';
          const acting = st.room === 'set' || st.role === 'penulis';
          const ph = Math.floor(sp.animT / 320);
          let f: number;
          if (!acting) f = ph % 2 === 0 ? 5 : 6;
          else if (actor) f = [0, 3, 3, 4][ph % 4];
          else f = ph % 2 === 0 ? 3 : 4;
          const key = sp.img.texture.key;
          if (!key.endsWith('_shout') || ph % 6 === 0) sp.img.setTexture(`st${st.id}_${f}`);
        } else {
          sp.img.setTexture(`st${st.id}_0`);
        }
        if (st.activity === 'rest' && spd > 0) {
          sp.bubbleT += dt * spd;
          if (sp.bubbleT > 2600) { sp.bubbleT = 0; this.speech(sp, Phaser.Math.RND.pick(['Nyam!', 'Bakso!', 'Enak!', 'Zzz']), 1000); }
        } else if (st.activity === 'idle' && spd > 0) {
          sp.bubbleT += dt * spd;
          if (sp.bubbleT > 7000 + (st.id % 5) * 900) { sp.bubbleT = 0; if (Math.random() < 0.35) this.speech(sp, Phaser.Math.RND.pick(['...', 'Hmm~', 'Gabut', 'Libur?', 'Kopi dulu']), 1200); }
        }
      }
    }
  }

  rebuildAfterStaffChange() { this.syncStaff(); this.refreshHud(); }
}
