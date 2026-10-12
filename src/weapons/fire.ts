import type { Projectiles, Team } from '../entities/projectile';
import type { WeaponDef } from './definitions';

/** Emit one "shot" of a weapon (which may be several projectiles). */
export function fireWeapon(def: WeaponDef, projectiles: Projectiles, x: number, y: number, angle: number, team: Team): void {
  const n = def.count;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const a = angle + t * def.arc + (Math.random() - 0.5) * 2 * def.spread;
    projectiles.spawn({
      x,
      y,
      angle: a,
      speed: def.projectileSpeed,
      radius: def.projectileRadius,
      damage: def.damage,
      life: def.lifetime,
      team,
      color: def.color,
      behavior: def.behavior,
    });
  }
}
