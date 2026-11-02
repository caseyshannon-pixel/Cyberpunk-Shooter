import { CONFIG } from '../config';
import type { Rect } from '../core/collision';
import type { Rng } from '../core/rng';

const R = CONFIG.run;

export type WallSide = 'top' | 'bottom' | 'left' | 'right';
export type RoomType = 'combat' | 'boss';
export type RoomReward = 'weapon' | 'mod' | 'none';
export type LayoutId = 'classic' | 'open' | 'cross' | 'ring' | 'lanes' | 'scatter' | 'bunkers' | 'diagonal' | 'gates';

/** An obstacle relative to the arena centre; `dx` is scaled by the arena's width (wide screens get wider layouts). */
export interface LayoutBlock {
  dx: number;
  dy: number;
  w: number;
  h: number;
  kind: 'pillar' | 'crate';
}

/** One room of a run. `room` counts 1..roomsPerFloor; the boss room is roomsPerFloor + 1. */
export interface RoomSpec {
  floor: number;
  room: number;
  type: RoomType;
  reward: RoomReward;
  layout: LayoutId;
  /** Wall the player comes in through. */
  entry: WallSide;
}

/** What a door leads to. */
export interface DoorOption {
  type: RoomType;
  reward: RoomReward;
  label: string;
}

const pillar = (dx: number, dy: number, s = 56): LayoutBlock => ({ dx, dy, w: s, h: s, kind: 'pillar' });
const crate = (dx: number, dy: number, w: number, h: number): LayoutBlock => ({ dx, dy, w, h, kind: 'crate' });
/** The same block in all four quadrants. */
const quad = (make: (sx: number, sy: number) => LayoutBlock): LayoutBlock[] =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => make(sx, sy));

/**
 * Obstacle layouts. `classic` is the Arcade/Zen arena; the rest keep the wall
 * centres (doors) and the arena centre (reward pedestals) clear.
 */
export const LAYOUTS: Record<LayoutId, readonly LayoutBlock[]> = {
  classic: [
    ...quad((sx, sy) => pillar(260 * sx, 150 * sy)),
    crate(-470, 0, 40, 140),
    crate(470, 0, 40, 140),
    crate(0, -235, 150, 36),
    crate(0, 235, 150, 36),
  ],
  open: quad((sx, sy) => pillar(440 * sx, 220 * sy, 48)),
  cross: [...quad((sx, sy) => pillar(170 * sx, 125 * sy)), crate(-380, 0, 100, 36), crate(380, 0, 100, 36), crate(0, -130, 36, 70), crate(0, 130, 36, 70)],
  ring: [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return pillar(Math.round(300 * Math.cos(a)), Math.round(180 * Math.sin(a)), 50);
  }),
  lanes: quad((sx, sy) => crate(220 * sx, 115 * sy, 240, 30)),
  scatter: [
    ...quad((sx, sy) => pillar(380 * sx, 200 * sy)),
    pillar(-220, 0),
    pillar(220, 0),
    crate(-120, -200, 80, 30),
    crate(120, 200, 80, 30),
  ],
  bunkers: [...quad((sx, sy) => crate(330 * sx, 170 * sy, 140, 30)), crate(-250, 0, 30, 120), crate(250, 0, 30, 120)],
  diagonal: [pillar(-300, -180), pillar(-160, -95), pillar(160, 95), pillar(300, 180), crate(300, -180, 100, 36), crate(-300, 180, 100, 36)],
  gates: [...quad((sx, sy) => crate(420 * sx, 150 * sy, 36, 140)), ...quad((sx, sy) => pillar(160 * sx, 165 * sy, 48))],
};

/** Layouts for ordinary rooms in a run (`open` is for boss rooms; `classic` blocks the doors). */
export const COMBAT_LAYOUTS: readonly LayoutId[] = ['cross', 'ring', 'lanes', 'scatter', 'bunkers', 'diagonal', 'gates'];
/** Every layout a run can use. */
export const RUN_LAYOUTS: readonly LayoutId[] = [...COMBAT_LAYOUTS, 'open'];

const OPPOSITE: Record<WallSide, WallSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

export function opposite(side: WallSide): WallSide {
  return OPPOSITE[side];
}

export function wavesFor(floor: number, rng: Rng): number {
  const [min, max] = R.wavesPerRoom[floor - 1];
  return rng.int(min, max);
}

export function budgetFor(floor: number, room: number): number {
  return R.budgetBase + floor * R.budgetPerFloor + room * R.budgetPerRoom;
}

export function hpScaleFor(floor: number, room: number): number {
  return 1 + (floor - 1) * R.hpPerFloor + room * R.hpPerRoom;
}

export function speedScaleFor(floor: number): number {
  return 1 + (floor - 1) * R.speedPerFloor;
}

/** A door gate: centred on its wall, just inside the arena. */
export function doorRect(side: WallSide, b: Rect): Rect {
  const { width, depth } = R.door;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  switch (side) {
    case 'top':
      return { x: cx - width / 2, y: b.y, w: width, h: depth };
    case 'bottom':
      return { x: cx - width / 2, y: b.y + b.h - depth, w: width, h: depth };
    case 'left':
      return { x: b.x, y: cy - width / 2, w: depth, h: width };
    case 'right':
      return { x: b.x + b.w - depth, y: cy - width / 2, w: depth, h: width };
  }
}

/** Where the player appears when entering through `side`. */
export function entryPoint(side: WallSide, b: Rect): { x: number; y: number } {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const i = R.entryInset;
  switch (side) {
    case 'top':
      return { x: cx, y: b.y + i };
    case 'bottom':
      return { x: cx, y: b.y + b.h - i };
    case 'left':
      return { x: b.x + i, y: cy };
    case 'right':
      return { x: b.x + b.w - i, y: cy };
  }
}
