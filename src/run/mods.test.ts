import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { canStack, computeStats, MOD_IDS, NEUTRAL_STATS } from './mods';

describe('computeStats', () => {
  it('no mods → neutral stats', () => {
    expect(computeStats({})).toEqual(NEUTRAL_STATS);
  });

  it('damage and size bonuses add up', () => {
    const s = computeStats({ overvolt: 2, heavy: 1 });
    expect(s.damageMult).toBeCloseTo(1.65);
    expect(s.sizeMult).toBeCloseTo(1.3);
  });

  it('dash cooldown multiplies per stack', () => {
    expect(computeStats({ blink: 2 }).dashCooldownMult).toBeCloseTo(0.64);
  });

  it('counts add up', () => {
    const s = computeStats({ split: 3, phase: 2, bounce: 1, aegis: 2, rapid: 1 });
    expect(s.extraProjectiles).toBe(3);
    expect(s.pierce).toBe(2);
    expect(s.bounces).toBe(1);
    expect(s.shieldPerRoom).toBe(2);
    expect(s.fireRateMult).toBeCloseTo(1.2);
  });

  it('stacks above max are clamped', () => {
    expect(computeStats({ overvolt: 9 }).damageMult).toBeCloseTo(2);
  });
});

describe('canStack', () => {
  it('is false at max', () => {
    expect(canStack({}, 'overvolt')).toBe(true);
    expect(canStack({ overvolt: 3 }, 'overvolt')).toBe(true);
    expect(canStack({ overvolt: 4 }, 'overvolt')).toBe(false);
  });
});

describe('MOD_DEFS', () => {
  it('has short HUD labels and a positive max for every mod', () => {
    expect(MOD_IDS).toHaveLength(9);
    for (const id of MOD_IDS) {
      expect(CONFIG.mods[id].short.length).toBeLessThanOrEqual(4);
      expect(CONFIG.mods[id].max).toBeGreaterThanOrEqual(1);
    }
  });
});
