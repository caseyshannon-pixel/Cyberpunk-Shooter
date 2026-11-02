import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { NEUTRAL_STATS, type RunStats } from '../run/mods';
import { WEAPON_IDS, WEAPONS } from './definitions';
import { applyStats } from './stats';

const TAU = Math.PI * 2;
const stats = (s: Partial<RunStats>): RunStats => ({ ...NEUTRAL_STATS, ...s });

describe('applyStats', () => {
  it('neutral stats change nothing', () => {
    for (const id of WEAPON_IDS) expect(applyStats(WEAPONS[id], NEUTRAL_STATS)).toBe(WEAPONS[id]);
  });

  it('damage and fire rate scale every weapon', () => {
    const s = stats({ damageMult: 1.5, fireRateMult: 1.2 });
    for (const id of WEAPON_IDS) {
      const d = applyStats(WEAPONS[id], s);
      expect(d.damage).toBeCloseTo(WEAPONS[id].damage * 1.5);
      expect(d.fireRate).toBeCloseTo(WEAPONS[id].fireRate * 1.2);
    }
  });

  it('a single-shot weapon fans out by splitSpacing', () => {
    const d = applyStats(WEAPONS.pulse, stats({ extraProjectiles: 1 }));
    expect(d.count).toBe(2);
    expect(d.arc).toBeCloseTo(CONFIG.run.splitSpacing);
  });

  it('spread keeps its fan width', () => {
    const d = applyStats(WEAPONS.spread, stats({ extraProjectiles: 1 }));
    expect(d.count).toBe(6);
    expect(d.arc).toBeCloseTo(0.62);
  });

  it('nova stays a full ring', () => {
    const d = applyStats(WEAPONS.nova, stats({ extraProjectiles: 1 }));
    expect(d.count).toBe(19);
    expect(d.arc).toBeCloseTo(TAU);
  });

  it('pierce, bounces and extra shots only touch projectile weapons', () => {
    const s = stats({ pierce: 2, bounces: 1, extraProjectiles: 2 });
    expect(applyStats(WEAPONS.ricochet, s)).toMatchObject({ pierce: 4, bounces: 4 });
    expect(applyStats(WEAPONS.pulse, s)).toMatchObject({ pierce: 2, bounces: 1 });
    const rail = applyStats(WEAPONS.rail, s);
    expect(rail.pierce).toBeUndefined();
    expect(rail.bounces).toBeUndefined();
    expect(rail.count).toBeUndefined();
  });

  it('size scales projectile radius and rail beam width', () => {
    const s = stats({ sizeMult: 1.3 });
    expect(applyStats(WEAPONS.pulse, s).projectileRadius).toBeCloseTo(4 * 1.3);
    expect(applyStats(WEAPONS.rail, s).beamWidth).toBeCloseTo(12 * 1.3);
  });
});
