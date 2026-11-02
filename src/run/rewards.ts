import type { Rng } from '../core/rng';
import { DEFAULT_WEAPON, WEAPON_IDS, type WeaponId } from '../weapons/definitions';

/** Up to `n` distinct weapons the player doesn't already carry (never the Pulse Pistol). */
export function rollWeaponChoices(rng: Rng, held: readonly WeaponId[], n: number): WeaponId[] {
  const pool = WEAPON_IDS.filter((id) => id !== DEFAULT_WEAPON && !held.includes(id));
  return rng.shuffle(pool).slice(0, n);
}
