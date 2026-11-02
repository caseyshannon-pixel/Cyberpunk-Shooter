import { CONFIG } from '../config';
import { NEUTRAL_STATS, type RunStats } from '../run/mods';
import type { WeaponDef } from './types';

/**
 * A weapon as Rogue Run mods change it. Damage and fire rate apply to every
 * weapon; shot count, pierce and bounces only to projectile weapons; size to
 * projectiles and the rail's beam. Neutral stats return `def` itself.
 */
export function applyStats(def: WeaponDef, s: RunStats): WeaponDef {
  if (s === NEUTRAL_STATS) return def;
  const out: WeaponDef = { ...def, damage: def.damage * s.damageMult, fireRate: def.fireRate * s.fireRateMult };
  if (def.mode === 'rail') return { ...out, beamWidth: (def.beamWidth ?? 10) * s.sizeMult };
  if (def.mode !== 'projectile') return out;

  const base = def.count ?? 1;
  const count = base + s.extraProjectiles;
  // A ring or a fan keeps its shape (just denser); a single shot fans out.
  const arc = base > 1 ? (def.arc ?? 0) : CONFIG.run.splitSpacing * (count - 1);
  return {
    ...out,
    count,
    arc,
    projectileRadius: (def.projectileRadius ?? 4) * s.sizeMult,
    pierce: (def.pierce ?? 0) + s.pierce,
    bounces: (def.bounces ?? 0) + s.bounces,
  };
}
