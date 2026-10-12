/**
 * Weapon definition shape. Definitions themselves live in config.ts
 * (CONFIG.weapons) so every tunable number is in one place.
 */

/** How a weapon delivers damage. */
export type FireMode =
  /** Spawns projectiles (see ProjectileBehavior). */
  | 'projectile'
  /** Charges up, then fires an instant piercing beam. */
  | 'rail'
  /** Instant lightning that chains between nearby enemies. */
  | 'arc';

/** How a projectile moves once fired. */
export type ProjectileBehavior = 'basic' | 'homing' | 'bounce';

export interface WeaponDef {
  readonly name: string;
  /** Short label for pickups / HUD slots. */
  readonly short: string;
  readonly color: string;
  readonly mode: FireMode;
  /** Shots per second. */
  readonly fireRate: number;
  readonly damage: number;
  /** Shots per pickup; null = infinite. */
  readonly ammo: number | null;

  // --- projectile mode
  readonly behavior?: ProjectileBehavior;
  readonly projectileSpeed?: number;
  readonly projectileRadius?: number;
  /** Projectiles per shot. */
  readonly count?: number;
  /** Total fan angle (radians) across `count` projectiles; ≥ 2π = full ring. */
  readonly arc?: number;
  /** Random per-projectile jitter (radians). */
  readonly spread?: number;
  /** Seconds before a projectile expires. */
  readonly lifetime?: number;
  /** Enemies a projectile can pass through before stopping. */
  readonly pierce?: number;
  /** Wall bounces (behavior 'bounce'). */
  readonly bounces?: number;
  /** Max turn speed in rad/s (behavior 'homing'). */
  readonly turnRate?: number;

  // --- rail mode
  /** Seconds of holding fire before the beam discharges. */
  readonly chargeTime?: number;
  readonly beamWidth?: number;

  // --- arc mode
  /** Max distance to the first target. */
  readonly range?: number;
  /** Half-angle (radians) of the cone the first target must be in. */
  readonly cone?: number;
  /** Extra jumps after the first target. */
  readonly chains?: number;
  /** Max distance between chained targets. */
  readonly chainRange?: number;
  /** Damage multiplier per jump. */
  readonly falloff?: number;
}
