import { describe, expect, it } from 'vitest';
import type { Door } from '../entities/door';
import { Run } from '../run/run';
import { RoomDirector } from './roomDirector';
import { WaveDirector } from './waves';
import { World, type WorldHooks } from './world';

const DT = 1 / 60;

function setup(run: Run, extra: Partial<WorldHooks> = {}) {
  const calls = { exited: [] as Door[], won: 0 };
  const w = new World(
    {
      toast() {},
      rumble() {},
      sound() {},
      waveStarted() {},
      roomExited: (d) => calls.exited.push(d),
      runWon: () => calls.won++,
      ...extra,
    },
    'run',
    run,
  );
  const d = w.waves as RoomDirector;
  return { w, d, calls };
}

function clearRoom(w: World, d: RoomDirector): void {
  d.debugClear(w);
  d.update(DT, w);
}

describe('RoomDirector', () => {
  it('uses a RoomDirector in run mode and labels the room', () => {
    const { d } = setup(new Run(1280, 1));
    expect(d).toBeInstanceOf(RoomDirector);
    expect(d.label).toBe('F1 · R1');
    expect(d.bannerText).toBe('FLOOR 1 · ROOM 1');
  });

  it('rewardPedestals: a cleared weapon room offers 3 weapons the player does not hold', () => {
    const run = new Run(1280, 2);
    run.carry.weapons = ['pulse', 'spread'];
    const { w, d } = setup(run);
    clearRoom(w, d);
    expect(d.stage).toBe('reward');
    expect(d.pedestals).toHaveLength(3);
    for (const p of d.pedestals) expect(['pulse', 'spread']).not.toContain(p.weapon);
    expect(run.roomsCleared).toBe(1);
  });

  it('taking a pedestal equips the weapon and removes all pedestals', () => {
    const { w, d } = setup(new Run(1280, 3));
    clearRoom(w, d);
    const target = d.pedestals[1];
    w.player.x = target.x;
    w.player.y = target.y;
    for (let i = 0; i < 40; i++) d.update(DT, w);
    expect(w.player.arsenal.current.id).toBe(target.weapon);
    expect(d.pedestals).toHaveLength(0);
  });

  it('doorEnteredOnce: walking into a door exits exactly once', () => {
    const { w, d, calls } = setup(new Run(1280, 4));
    clearRoom(w, d);
    expect(d.doors.length).toBeGreaterThan(0);
    const door = d.doors[0];
    w.player.x = door.rect.x + door.rect.w / 2;
    w.player.y = door.rect.y + door.rect.h / 2;
    // A full second: the gate opens (0.4 s), then the player stays in it.
    for (let i = 0; i < 60; i++) d.update(DT, w);
    expect(calls.exited).toEqual([door]);
    expect(d.stage).toBe('leaving');
  });

  it('noExitWhenDead: a dead player on a door never leaves', () => {
    const { w, d, calls } = setup(new Run(1280, 5));
    clearRoom(w, d);
    const door = d.doors[0];
    w.player.alive = false;
    w.player.x = door.rect.x + door.rect.w / 2;
    w.player.y = door.rect.y + door.rect.h / 2;
    for (let i = 0; i < 60; i++) d.update(DT, w);
    expect(calls.exited).toEqual([]);
  });

  it('finalBossWins: clearing the last boss wins the run and opens no doors', () => {
    const run = new Run(1280, 6);
    while (!run.isFinalBoss) run.advance(run.exits()[0], 'top');
    const { w, d, calls } = setup(run);
    expect(d.isBossWave).toBe(true);
    expect(d.label).toBe('F3 · BOSS');
    clearRoom(w, d);
    expect(calls.won).toBe(1);
    expect(d.doors).toHaveLength(0);
    expect(d.pedestals).toHaveLength(0);
  });

  it('a floor boss room spawns the Warden with the floor HP', () => {
    const run = new Run(1280, 8);
    while (!run.isBossRoom) run.advance(run.exits()[0], 'top');
    const { w, d } = setup(run);
    for (let i = 0; i < 600 && !w.boss; i++) {
      d.update(DT, w);
    }
    expect(w.boss?.maxHp).toBe(280);
  });
});

describe('WaveDirector labels (Arcade unchanged)', () => {
  it('says WAVE n and WAVE CLEAR', () => {
    const d = new WaveDirector(false);
    d.wave = 3;
    expect(d.label).toBe('WAVE 3');
    expect(d.bannerText).toBe('WAVE 3');
    expect(d.clearText).toBe('WAVE CLEAR');
  });
});
