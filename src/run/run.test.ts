import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { Player } from '../entities/player';
import { Arsenal } from '../weapons/arsenal';
import { ScoreKeeper } from '../world/score';
import { COMBAT_LAYOUTS } from './rooms';
import { Run } from './run';

const R = CONFIG.run;

/** Take the first door out of every room until the final boss. */
function walk(run: Run): string[] {
  const seen = [`${run.room.floor}.${run.room.room}`];
  while (!run.isFinalBoss) {
    run.advance(run.exits()[0], 'top');
    seen.push(`${run.room.floor}.${run.room.room}`);
  }
  return seen;
}

describe('Run', () => {
  it('starts on floor 1, room 1, a weapon combat room, full health with the Pistol', () => {
    const run = new Run(1280, 1);
    expect(run.room).toMatchObject({ floor: 1, room: 1, type: 'combat', reward: 'weapon', entry: 'bottom' });
    expect(COMBAT_LAYOUTS).toContain(run.room.layout);
    expect(run.carry).toEqual({ health: 5, maxHealth: 5, weapons: ['pulse'], equipped: 0 });
    expect(run.outcome).toBe('active');
  });

  it('walks 3 floors of 6 rooms and a boss, ending at the final boss', () => {
    const run = new Run(1280, 7);
    const seen = walk(run);
    const boss = R.roomsPerFloor + 1;
    const expected: string[] = [];
    for (let f = 1; f <= R.floors; f++) for (let r = 1; r <= boss; r++) expected.push(`${f}.${r}`);
    expect(seen).toEqual(expected);
    expect(run.isBossRoom).toBe(true);
    expect(run.exits()).toEqual([]);
  });

  it('only the last floor boss is the final boss', () => {
    const run = new Run(1280, 3);
    while (!run.isBossRoom) run.advance(run.exits()[0], 'left');
    expect(run.isFinalBoss).toBe(false);
  });

  it('boss rooms use the open layout and the next room enters opposite the exit', () => {
    const run = new Run(1280, 5);
    run.advance(run.exits()[0], 'left');
    expect(run.room.entry).toBe('right');
    while (!run.isBossRoom) run.advance(run.exits()[0], 'top');
    expect(run.room.layout).toBe('open');
    expect(run.room.entry).toBe('bottom');
  });

  it('beating a boss heals bossHeal, capped at max health', () => {
    const run = new Run(1280, 2);
    while (!run.isBossRoom) run.advance(run.exits()[0], 'top');
    run.carry.health = 2;
    run.advance(run.exits()[0], 'top');
    expect(run.room).toMatchObject({ floor: 2, room: 1 });
    expect(run.carry.health).toBe(2 + R.bossHeal);

    while (!run.isBossRoom) run.advance(run.exits()[0], 'top');
    run.carry.health = run.carry.maxHealth;
    run.advance(run.exits()[0], 'top');
    expect(run.carry.health).toBe(run.carry.maxHealth);
  });

  it('the same seed gives the same layouts', () => {
    const layouts = (seed: number) => {
      const run = new Run(1280, seed);
      const out = [run.room.layout];
      while (!run.isFinalBoss) {
        run.advance(run.exits()[0], 'top');
        out.push(run.room.layout);
      }
      return out;
    };
    expect(layouts(99)).toEqual(layouts(99));
  });

  it('captureFrom and applyTo carry HP, weapons, score and kills into the next room', () => {
    const run = new Run(1280, 4);
    const p1 = new Player(0, 0, new Arsenal({ infiniteAmmo: true, maxExtra: 2 }));
    const s1 = new ScoreKeeper();
    run.applyTo(p1, s1);
    p1.health = 3;
    p1.arsenal.add('spread');
    p1.arsenal.add('homing');
    p1.arsenal.index = 1;
    s1.addKill(100);
    s1.addKill(100);
    run.captureFrom(p1, s1);

    const p2 = new Player(0, 0, new Arsenal({ infiniteAmmo: true, maxExtra: 2 }));
    const s2 = new ScoreKeeper();
    run.applyTo(p2, s2);
    expect(p2.health).toBe(3);
    expect(p2.maxHealth).toBe(5);
    expect(p2.arsenal.ids()).toEqual(['pulse', 'spread', 'homing']);
    expect(p2.arsenal.current.id).toBe('spread');
    expect(s2.score).toBe(200);
    expect(s2.kills).toBe(2);
  });

  it('finish records the outcome; onRoomCleared counts rooms', () => {
    const run = new Run(1280, 1);
    run.onRoomCleared();
    run.onRoomCleared();
    expect(run.roomsCleared).toBe(2);
    run.finish('dead');
    expect(run.outcome).toBe('dead');
  });
});
