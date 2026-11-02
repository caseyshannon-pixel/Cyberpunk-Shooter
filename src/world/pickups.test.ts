import { describe, expect, it } from 'vitest';
import { createBossState } from '../entities/boss';
import { Enemy } from '../entities/enemy';
import { isWeaponPickup } from '../entities/pickup';
import { Run } from '../run/run';
import { World } from './world';

const hooks = { toast() {}, rumble() {}, sound() {}, waveStarted() {} };

describe('PickupManager in Rogue Run', () => {
  it('never rolls a weapon drop', () => {
    const w = new World(hooks, 'run', new Run(1280, 1));
    for (let i = 0; i < 500; i++) expect(isWeaponPickup(w.pickups.roll(w))).toBe(false);
  });

  it('a boss drops only a health chip', () => {
    const w = new World(hooks, 'run', new Run(1280, 1));
    const boss = new Enemy('boss', 600, 300);
    boss.boss = createBossState();
    w.pickups.onEnemyKilled(boss, w);
    expect(w.pickups.items.map((p) => p.kind)).toEqual(['health']);
  });

  it('Arcade still rolls weapons', () => {
    const w = new World(hooks, 'arcade');
    let weapons = 0;
    for (let i = 0; i < 500; i++) if (isWeaponPickup(w.pickups.roll(w))) weapons++;
    expect(weapons).toBeGreaterThan(0);
  });
});
