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
    expect(run.carry).toEqual({ health: 5, maxHealth: 5, weapons: ['pulse'], equipped: 0, newest: 0, mods: {} });
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

  it('with the Pistol equipped, the most recently taken weapon is replaced, even across rooms', () => {
    const run = new Run(1280, 12);
    const room = (take: 'spread' | 'homing' | 'nova' | 'arc', equip?: number) => {
      const p = new Player(0, 0, new Arsenal({ infiniteAmmo: true, maxExtra: 2 }));
      const s = new ScoreKeeper();
      run.applyTo(p, s);
      if (equip !== undefined) p.arsenal.index = equip;
      p.arsenal.add(take);
      run.captureFrom(p, s);
      return p;
    };
    room('spread'); // [P, spread]
    room('homing'); // [P, spread, homing]
    room('nova', 1); // spread equipped → replaced: [P, nova, homing]; nova is newest
    const p = room('arc', 0); // Pistol equipped → replaces nova (newest), not homing
    expect(p.arsenal.ids()).toEqual(['pulse', 'arc', 'homing']);
  });

  it('mods survive captureFrom, applyTo and advancing through a boss', () => {
    const run = new Run(1280, 13);
    expect(run.addMod('overvolt')).toBe(true);
    expect(run.addMod('overvolt')).toBe(true);
    const p = new Player(0, 0, new Arsenal({ infiniteAmmo: true, maxExtra: 2 }));
    const s = new ScoreKeeper();
    run.applyTo(p, s);
    run.captureFrom(p, s);
    while (!run.isBossRoom) run.advance(run.exits()[0], 'top');
    run.advance(run.exits()[0], 'top');
    expect(run.carry.mods).toEqual({ overvolt: 2 });
  });

  it('addMod refuses past max', () => {
    const run = new Run(1280, 14);
    for (let i = 0; i < 3; i++) expect(run.addMod('blink')).toBe(true);
    expect(run.addMod('blink')).toBe(false);
    expect(run.carry.mods.blink).toBe(3);
  });

  it('room 1 of floor 2 is a MOD room', () => {
    const run = new Run(1280, 16);
    while (run.room.floor < 2) run.advance(run.exits()[0], 'top');
    expect(run.room).toMatchObject({ floor: 2, room: 1, reward: 'mod' });
  });

  it('debugSkipToBoss keeps mods', () => {
    const run = new Run(1280, 15);
    run.addMod('split');
    run.debugSkipToBoss();
    expect(run.carry.mods).toEqual({ split: 1 });
  });

  it('debugSkipToBoss jumps to the current floor boss room', () => {
    const run = new Run(1280, 1);
    run.advance(run.exits()[0], 'left');
    run.debugSkipToBoss();
    expect(run.room).toMatchObject({ floor: 1, room: R.roomsPerFloor + 1, type: 'boss', reward: 'none', layout: 'open' });
    expect(run.isBossRoom).toBe(true);
    expect(run.isFinalBoss).toBe(false);
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
