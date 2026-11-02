import { CONFIG } from '../config';
import type { ModDef } from './modTypes';

export type ModId = keyof typeof CONFIG.mods;
export const MODS: Record<ModId, ModDef> = CONFIG.mods;
export const MOD_IDS = Object.keys(MODS) as ModId[];

/** How many of each mod a run holds. */
export type ModStacks = Partial<Record<ModId, number>>;

/** Every mod folded into the numbers the weapons, dash and room start read. */
export interface RunStats {
  damageMult: number;
  fireRateMult: number;
  extraProjectiles: number;
  pierce: number;
  bounces: number;
  sizeMult: number;
  dashCooldownMult: number;
  shieldPerRoom: number;
}

/** No mods: Arcade, Zen, and a run before its first mod. */
export const NEUTRAL_STATS: Readonly<RunStats> = Object.freeze({
  damageMult: 1,
  fireRateMult: 1,
  extraProjectiles: 0,
  pierce: 0,
  bounces: 0,
  sizeMult: 1,
  dashCooldownMult: 1,
  shieldPerRoom: 0,
});

export function stacksOf(stacks: ModStacks, id: ModId): number {
  return Math.min(MODS[id].max, stacks[id] ?? 0);
}

export function computeStats(stacks: ModStacks): RunStats {
  const s: RunStats = { ...NEUTRAL_STATS };
  for (const id of MOD_IDS) {
    const n = stacksOf(stacks, id);
    if (n <= 0) continue;
    const e = MODS[id].effect;
    s.damageMult += (e.damage ?? 0) * n;
    s.fireRateMult += (e.fireRate ?? 0) * n;
    s.extraProjectiles += (e.projectiles ?? 0) * n;
    s.pierce += (e.pierce ?? 0) * n;
    s.bounces += (e.bounces ?? 0) * n;
    s.sizeMult += (e.size ?? 0) * n;
    s.dashCooldownMult *= (e.dashCooldown ?? 1) ** n;
    s.shieldPerRoom += (e.shieldPerRoom ?? 0) * n;
  }
  return s;
}

/** True if the run can take another stack of `id`. */
export function canStack(stacks: ModStacks, id: ModId): boolean {
  return (stacks[id] ?? 0) < MODS[id].max;
}
