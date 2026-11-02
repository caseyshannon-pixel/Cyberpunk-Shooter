import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { MOD_IDS, MODS } from './mods';
import { rollModChoices, rollRewards, rollWeaponChoices } from './rewards';

describe('rollWeaponChoices', () => {
  it('excludes the Pistol and held weapons, with distinct picks', () => {
    for (let seed = 0; seed < 200; seed++) {
      const picks = rollWeaponChoices(createRng(seed), ['pulse', 'spread'], 3);
      expect(picks).toHaveLength(3);
      expect(picks).not.toContain('pulse');
      expect(picks).not.toContain('spread');
      expect(new Set(picks).size).toBe(3);
    }
  });

  it('returns fewer when the pool is small', () => {
    const picks = rollWeaponChoices(createRng(1), ['pulse', 'spread', 'rail', 'homing', 'ricochet', 'arc'], 3);
    expect(picks).toEqual(['nova']);
  });

  it('returns nothing when everything is held', () => {
    expect(rollWeaponChoices(createRng(1), ['pulse', 'spread', 'rail', 'homing', 'ricochet', 'arc', 'nova'], 3)).toEqual([]);
  });
});

describe('mod rewards', () => {
  it('mod choices exclude maxed mods and are distinct', () => {
    for (let seed = 0; seed < 200; seed++) {
      const picks = rollModChoices(createRng(seed), { overvolt: 4, split: 3 }, 3);
      expect(picks).toHaveLength(3);
      expect(picks).not.toContain('overvolt');
      expect(picks).not.toContain('split');
      expect(new Set(picks).size).toBe(3);
    }
  });

  const allMaxed = Object.fromEntries(MOD_IDS.map((id) => [id, MODS[id].max]));

  it('a MOD room falls back to weapons when every mod is maxed', () => {
    const r = rollRewards(createRng(1), 'mod', ['pulse'], allMaxed, 3);
    expect(r).toHaveLength(3);
    for (const x of r) expect(x.kind).toBe('weapon');
  });

  it('nothing left at all gives no rewards', () => {
    const held = ['pulse', 'spread', 'rail', 'homing', 'ricochet', 'arc', 'nova'] as const;
    expect(rollRewards(createRng(1), 'mod', held, allMaxed, 3)).toEqual([]);
    expect(rollRewards(createRng(1), 'weapon', held, allMaxed, 3)).toEqual([]);
  });

  it('a WEAPON room rolls weapons', () => {
    const r = rollRewards(createRng(2), 'weapon', ['pulse'], {}, 3);
    expect(r.map((x) => x.kind)).toEqual(['weapon', 'weapon', 'weapon']);
  });
});
