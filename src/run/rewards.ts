import type { Rng } from '../core/rng';
import { DEFAULT_WEAPON, WEAPON_IDS, type WeaponId } from '../weapons/definitions';
import { canStack, MOD_IDS, type ModId, type ModStacks } from './mods';
import type { RoomReward } from './rooms';

/** Something a reward pedestal holds. */
export type Reward = { kind: 'weapon'; id: WeaponId } | { kind: 'mod'; id: ModId };

/** Up to `n` distinct weapons the player doesn't already carry (never the Pulse Pistol). */
export function rollWeaponChoices(rng: Rng, held: readonly WeaponId[], n: number): WeaponId[] {
  const pool = WEAPON_IDS.filter((id) => id !== DEFAULT_WEAPON && !held.includes(id));
  return rng.shuffle(pool).slice(0, n);
}

/** Up to `n` distinct mods the run can still stack. */
export function rollModChoices(rng: Rng, stacks: ModStacks, n: number): ModId[] {
  return rng.shuffle(MOD_IDS.filter((id) => canStack(stacks, id))).slice(0, n);
}

/**
 * The pedestals for a cleared room. A room whose kind of reward has run out
 * offers the other kind instead; if both have run out there's nothing to take.
 */
export function rollRewards(rng: Rng, reward: RoomReward, held: readonly WeaponId[], stacks: ModStacks, n: number): Reward[] {
  if (reward === 'none') return [];
  const weapons = (): Reward[] => rollWeaponChoices(rng, held, n).map((id) => ({ kind: 'weapon', id }));
  const mods = (): Reward[] => rollModChoices(rng, stacks, n).map((id) => ({ kind: 'mod', id }));
  const [first, second] = reward === 'mod' ? [mods, weapons] : [weapons, mods];
  const picks = first();
  return picks.length ? picks : second();
}
