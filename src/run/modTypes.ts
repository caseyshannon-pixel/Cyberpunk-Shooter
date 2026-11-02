/**
 * Mod definition shape. Definitions live in config.ts (CONFIG.mods) so every
 * tunable number is in one place.
 */

/** What one stack of a mod does. */
export interface ModEffect {
  /** Added to the damage multiplier. */
  readonly damage?: number;
  /** Added to the fire-rate multiplier. */
  readonly fireRate?: number;
  /** Extra projectiles per shot (projectile weapons). */
  readonly projectiles?: number;
  /** Extra enemies a shot passes through (projectile weapons). */
  readonly pierce?: number;
  /** Extra wall bounces (projectile weapons). */
  readonly bounces?: number;
  /** Added to the shot-size multiplier (projectile radius, rail beam width). */
  readonly size?: number;
  /** Dash cooldown is multiplied by this per stack. */
  readonly dashCooldown?: number;
  /** Max HP gained (once, when taken). */
  readonly maxHealth?: number;
  /** Shield hits at the start of each room. */
  readonly shieldPerRoom?: number;
}

export interface ModDef {
  readonly name: string;
  /** ≤ 4 characters, for HUD chips and pedestals. */
  readonly short: string;
  readonly blurb: string;
  readonly color: string;
  /** Most stacks a run can hold. */
  readonly max: number;
  readonly effect: ModEffect;
}
