import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { circleRect, type Rect } from '../core/collision';
import { createRng } from '../core/rng';
import { Arena } from '../world/arena';
import {
  budgetFor,
  doorRect,
  entryPoint,
  hpScaleFor,
  opposite,
  RUN_LAYOUTS,
  speedScaleFor,
  wavesFor,
  type WallSide,
} from './rooms';

const SIDES: WallSide[] = ['top', 'bottom', 'left', 'right'];
const WIDTHS = [1280, CONFIG.view.maxWidth];

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** The door plus the space in front of it that must stay walkable. */
function clearZone(side: WallSide, bounds: Rect): Rect {
  const d = doorRect(side, bounds);
  const extra = CONFIG.run.door.clearDepth;
  if (side === 'top') return { ...d, h: d.h + extra };
  if (side === 'bottom') return { ...d, y: d.y - extra, h: d.h + extra };
  if (side === 'left') return { ...d, w: d.w + extra };
  return { ...d, x: d.x - extra, w: d.w + extra };
}

describe('Arena layouts', () => {
  it('classic layout matches the original arena', () => {
    const a = new Arena(1280);
    expect(a.obstacles).toEqual([
      { x: 352, y: 182, w: 56, h: 56, kind: 'pillar' },
      { x: 872, y: 182, w: 56, h: 56, kind: 'pillar' },
      { x: 352, y: 482, w: 56, h: 56, kind: 'pillar' },
      { x: 872, y: 482, w: 56, h: 56, kind: 'pillar' },
      { x: 150, y: 290, w: 40, h: 140, kind: 'crate' },
      { x: 1090, y: 290, w: 40, h: 140, kind: 'crate' },
      { x: 565, y: 107, w: 150, h: 36, kind: 'crate' },
      { x: 565, y: 577, w: 150, h: 36, kind: 'crate' },
    ]);
  });

  it('door zones are clear in every run layout', () => {
    for (const id of RUN_LAYOUTS) {
      for (const width of WIDTHS) {
        const a = new Arena(width, id);
        for (const side of SIDES) {
          const zone = clearZone(side, a.bounds);
          for (const o of a.obstacles) expect(overlaps(zone, o), `${id} @${width} ${side}`).toBe(false);
        }
      }
    }
  });

  it('entry points are free in every run layout', () => {
    for (const id of RUN_LAYOUTS) {
      for (const width of WIDTHS) {
        const a = new Arena(width, id);
        for (const side of SIDES) {
          const p = entryPoint(side, a.bounds);
          expect(a.isFree(p.x, p.y, CONFIG.player.radius + 4), `${id} @${width} ${side}`).toBe(true);
        }
      }
    }
  });

  it('the centre stays free for reward pedestals', () => {
    for (const id of RUN_LAYOUTS) {
      for (const width of WIDTHS) {
        const a = new Arena(width, id);
        for (const dx of [-CONFIG.run.pedestalSpacing, 0, CONFIG.run.pedestalSpacing]) {
          const hit = a.obstacles.some((o) => circleRect(a.centerX + dx, a.centerY, 34, o, { nx: 0, ny: 0, depth: 0 }));
          expect(hit, `${id} @${width} dx=${dx}`).toBe(false);
        }
      }
    }
  });
});

describe('room scaling', () => {
  it('budget grows with floor and room', () => {
    expect(budgetFor(1, 1)).toBe(11.5);
    expect(budgetFor(3, 6)).toBe(27);
  });

  it('enemy HP and speed scale', () => {
    expect(hpScaleFor(1, 0)).toBe(1);
    expect(hpScaleFor(3, 6)).toBeCloseTo(1.94);
    expect(speedScaleFor(1)).toBe(1);
    expect(speedScaleFor(2)).toBeCloseTo(1.05);
  });

  it('waves per room come from the floor range', () => {
    const r = createRng(1);
    for (let i = 0; i < 100; i++) {
      expect([1, 2]).toContain(wavesFor(1, r));
      expect(wavesFor(2, r)).toBe(2);
      expect([2, 3]).toContain(wavesFor(3, r));
    }
  });

  it('opposite is its own inverse', () => {
    for (const s of SIDES) {
      expect(opposite(s)).not.toBe(s);
      expect(opposite(opposite(s))).toBe(s);
    }
  });
});
