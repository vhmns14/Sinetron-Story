// Studio layout over the isometric background bitmaps (bg1..bg3, 720x1040 px drawn at 0.5 from y=STUDIO_Y).
// Coordinates below are authored in background pixels and converted to logical coordinates with L().
import type { RoomId } from './state';

export const STUDIO_Y = 50;
export const STUDIO_H = 520;
export function L(px: number, py: number) { return { x: px / 2, y: STUDIO_Y + py / 2 }; }

export interface Spot { x: number; y: number; tags: string[]; flip?: boolean }
const S = (px: number, py: number, tag: string, flip = false): Spot => ({ ...L(px, py), tags: [tag], flip });

export const SPOTS: Record<RoomId, Spot[]> = {
  set: [
    S(245, 450, 'actor'), S(310, 475, 'actor', true), S(375, 450, 'actor', true), S(300, 428, 'actor'),
    S(235, 598, 'dir', true), S(330, 630, 'cam', true), S(440, 558, 'cam', true),
    S(140, 560, 'any'), S(460, 612, 'any', true), S(245, 525, 'any'),
  ],
  makeup: [
    S(560, 700, 'chair', true), S(640, 700, 'chair', true), S(700, 668, 'chair', true),
    S(600, 762, 'any'), S(525, 752, 'any'), S(690, 740, 'any', true),
  ],
  kantin: [
    S(160, 878, 'sit'), S(207, 850, 'sit'), S(257, 925, 'sit', true), S(297, 893, 'sit', true),
    S(57, 832, 'any'), S(95, 880, 'any'), S(240, 830, 'any', true),
  ],
  desk: [
    S(535, 872, 'write', true), S(395, 905, 'write'), S(585, 940, 'write', true),
    S(450, 1000, 'edit'), S(515, 1010, 'edit', true),
    S(360, 960, 'any'), S(480, 975, 'any', true),
  ],
};

const P = (px: number, py: number) => L(px, py);
const HUB = P(400, 655);
/** waypoints from inside a room out to the central hub */
const EXIT: Record<RoomId, { x: number; y: number }[]> = {
  set: [P(360, 615)],
  makeup: [P(505, 705), P(450, 690)],
  kantin: [P(250, 815), P(300, 650)],
  desk: [P(360, 935), P(300, 915), P(250, 815), P(300, 650)],
};

export function route(from: RoomId, to: RoomId): { x: number; y: number }[] {
  if (from === to) return [];
  const a = EXIT[from], b = EXIT[to];
  // shared prefix (desk goes through the kantin door)
  const pts = [...a];
  const back = [...b].reverse();
  // if the target's exit path contains our path's tail, cut at the junction
  for (let i = 0; i < pts.length; i++) {
    const j = back.findIndex((q) => q.x === pts[i].x && q.y === pts[i].y);
    if (j >= 0) return [...pts.slice(0, i + 1), ...back.slice(j + 1)];
  }
  return [...pts, HUB, ...back];
}

/** decorative walkers wander between these */
export const WALK_NODES = [P(140, 600), P(300, 650), P(400, 655), P(450, 690), P(360, 615), P(250, 815), P(57, 832)];

/** bakso vendor next to the cart (levels with a cart) */
export const VENDOR = L(205, 795);

/** makeup artist NPC (always in the makeup room) */
export const MUA = L(668, 735);

/** stage lights for the syuting glow: [px, py, scale] */
export const LIGHTS: [number, number, number][] = [
  [135, 300, 1], [195, 268, 1], [255, 238, 1], [305, 210, 1], [365, 212, 1], [420, 240, 1], [482, 276, 1],
];
export const STAGE_GLOW = L(310, 420);
export const SPOT_STANDS: [number, number][] = [[118, 388], [500, 372]];

/** trophy shelf in the empty bottom-left corner */
export const TROPHY_Y = STUDIO_Y + STUDIO_H - 6;
