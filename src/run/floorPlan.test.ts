import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { createRng } from '../core/rng';
import { assignWalls, exitsFor } from './floorPlan';
import type { RoomSpec, WallSide } from './rooms';

const R = CONFIG.run;
const SIDES: WallSide[] = ['top', 'bottom', 'left', 'right'];

function spec(floor: number, room: number): RoomSpec {
  const boss = room > R.roomsPerFloor;
  return { floor, room, type: boss ? 'boss' : 'combat', reward: boss ? 'none' : 'weapon', layout: 'cross', entry: 'bottom' };
}

describe('exitsFor', () => {
  it('room 6 exits only to the boss', () => {
    const exits = exitsFor(spec(1, R.roomsPerFloor), createRng(1));
    expect(exits).toEqual([{ type: 'boss', reward: 'none', label: 'BOSS' }]);
  });

  it('a boss room before the last floor leads to the next floor', () => {
    const exits = exitsFor(spec(1, R.roomsPerFloor + 1), createRng(1));
    expect(exits).toEqual([{ type: 'combat', reward: 'weapon', label: 'NEXT FLOOR' }]);
  });

  it('the final boss has no exits', () => {
    expect(exitsFor(spec(R.floors, R.roomsPerFloor + 1), createRng(1))).toEqual([]);
  });

  it('exits never repeat an option and always offer at least one', () => {
    for (let seed = 0; seed < 500; seed++) {
      const rng = createRng(seed);
      for (let room = 1; room < R.roomsPerFloor; room++) {
        const exits = exitsFor(spec(1 + (seed % 3), room), rng);
        expect(exits.length).toBeGreaterThan(0);
        const keys = exits.map((e) => `${e.type}/${e.reward}`);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });
});

describe('assignWalls', () => {
  it('never uses the entry wall and never repeats', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = createRng(seed);
      for (const entry of SIDES) {
        for (let count = 1; count <= 3; count++) {
          const walls = assignWalls(count, entry, rng);
          expect(walls).toHaveLength(count);
          expect(walls).not.toContain(entry);
          expect(new Set(walls).size).toBe(count);
        }
      }
    }
  });
});
