import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { rollWeaponChoices } from './rewards';

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
