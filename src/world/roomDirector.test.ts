import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { Door } from '../entities/door';
import type { ModId } from '../run/mods';
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

  it('a run room starts with the run\'s stats', () => {
    const run = new Run(1280, 20);
    run.addMod('blink');
    run.addMod('aegis');
    run.addMod('aegis');
    const { w } = setup(run);
    expect(w.stats.dashCooldownMult).toBeCloseTo(0.8);
    expect(w.player.dashCooldownMult).toBeCloseTo(0.8);
    expect(w.player.shield).toBe(2);
  });

  it('rewardPedestals: a cleared weapon room offers 3 weapons the player does not hold', () => {
    const run = new Run(1280, 2);
    run.carry.weapons = ['pulse', 'spread'];
    const { w, d } = setup(run);
    clearRoom(w, d);
    expect(d.stage).toBe('reward');
    expect(d.pedestals).toHaveLength(3);
    for (const p of d.pedestals) {
      expect(p.reward.kind).toBe('weapon');
      expect(['pulse', 'spread']).not.toContain(p.reward.id);
    }
    expect(run.roomsCleared).toBe(1);
  });

  it('taking a pedestal equips the weapon and removes all pedestals', () => {
    const { w, d } = setup(new Run(1280, 3));
    clearRoom(w, d);
    const target = d.pedestals[1];
    w.player.x = target.x;
    w.player.y = target.y;
    for (let i = 0; i < 40; i++) d.update(DT, w);
    expect(w.player.arsenal.current.id).toBe(target.reward.id);
    expect(d.pedestals).toHaveLength(0);
  });

  /** A cleared MOD room whose middle pedestal is `id`, with the player standing next to it. */
  function modRoom(seed: number, id: ModId) {
    const run = new Run(1280, seed);
    run.advance({ type: 'combat', reward: 'mod', label: 'MOD' }, 'top');
    const ctx = setup(run);
    clearRoom(ctx.w, ctx.d);
    const ped = ctx.d.pedestals[1];
    ped.reward = { kind: 'mod', id };
    return { ...ctx, run, ped };
  }

  function standOn(w: World, d: RoomDirector, x: number, y: number): void {
    w.player.x = x + 200;
    w.player.y = y;
    d.update(DT, w); // off it first (pedestals arm once you've been away)
    w.player.x = x;
    for (let i = 0; i < 40; i++) d.update(DT, w);
  }

  it('a MOD room offers mods', () => {
    const run = new Run(1280, 21);
    run.advance({ type: 'combat', reward: 'mod', label: 'MOD' }, 'top');
    const { w, d } = setup(run);
    clearRoom(w, d);
    expect(d.pedestals).toHaveLength(3);
    for (const p of d.pedestals) expect(p.reward.kind).toBe('mod');
  });

  it('taking a mod applies it immediately', () => {
    const { w, d, run, ped } = modRoom(22, 'overvolt');
    standOn(w, d, ped.x, ped.y);
    expect(run.carry.mods.overvolt).toBe(1);
    expect(w.stats.damageMult).toBeCloseTo(1.25);
    expect(d.pedestals).toHaveLength(0);
  });

  it('taking BLINK DRIVE refreshes the dash cooldown at once', () => {
    const { w, d, ped } = modRoom(23, 'blink');
    standOn(w, d, ped.x, ped.y);
    expect(w.player.dashCooldownMult).toBeCloseTo(0.8);
  });

  it('hull raises max HP and heals', () => {
    const a = modRoom(24, 'hull');
    a.w.player.health = 3;
    standOn(a.w, a.d, a.ped.x, a.ped.y);
    expect([a.w.player.health, a.w.player.maxHealth]).toEqual([4, 6]);
    const b = modRoom(25, 'hull');
    standOn(b.w, b.d, b.ped.x, b.ped.y);
    expect([b.w.player.health, b.w.player.maxHealth]).toEqual([6, 6]);
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

  function finalBoss(seed: number) {
    const run = new Run(1280, seed);
    while (!run.isFinalBoss) run.advance(run.exits()[0], 'top');
    return setup(run);
  }

  it('finalBossWins: clearing the last boss wins the run after the victory delay, with no doors', () => {
    const { w, d, calls } = finalBoss(6);
    expect(d.isBossWave).toBe(true);
    expect(d.label).toBe('F3 · BOSS');
    clearRoom(w, d);
    expect(calls.won).toBe(0);
    for (let i = 0; i < 60 * (CONFIG.run.victoryDelay + 0.1); i++) d.update(DT, w);
    expect(calls.won).toBe(1);
    expect(d.doors).toHaveLength(0);
    expect(d.pedestals).toHaveLength(0);
  });

  it('a dead player never wins, even if the last boss falls after they died', () => {
    const { w, d, calls } = finalBoss(7);
    w.player.alive = false;
    clearRoom(w, d);
    for (let i = 0; i < 60 * 5; i++) d.update(DT, w);
    expect(calls.won).toBe(0);
  });

  it('dying during the victory delay cancels the win', () => {
    const { w, d, calls } = finalBoss(9);
    clearRoom(w, d);
    d.update(DT, w);
    w.player.alive = false;
    for (let i = 0; i < 60 * 5; i++) d.update(DT, w);
    expect(calls.won).toBe(0);
  });

  it('the banner names the wave that is about to start', () => {
    const run = new Run(1280, 10);
    run.advance(run.exits()[0], 'top'); // floor rooms always have waves; floor 2 has exactly 2
    while (run.room.floor < 2) run.advance(run.exits()[0], 'top');
    const { w, d } = setup(run);
    const started: number[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 60 * 60 && d.stage === 'fighting'; i++) {
      d.update(DT, w);
      if (d.phase === 'intro' && !seen.includes(d.bannerText)) {
        seen.push(d.bannerText);
        started.push(d.wave);
      }
      for (const e of [...w.enemies]) w.damageEnemy(e, 9999, 1, 0);
      w.enemies.length = 0; // World.update compacts out the dead; the director alone doesn't
    }
    expect(seen).toEqual(['FLOOR 2 · ROOM 1', 'WAVE 2/2']);
    expect(started).toEqual([1, 2]);
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
