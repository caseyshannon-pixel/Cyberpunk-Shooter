/**
 * Data-driven weapon definitions. Adding a weapon = adding an entry here
 * (plus a new `behavior` in projectile logic if it needs bespoke movement).
 */

export type ProjectileBehavior = 'basic';

export interface WeaponDef {
  id: string;
  name: string;
  color: string;
  /** Shots per second. */
  fireRate: number;
  damage: number;
  projectileSpeed: number;
  projectileRadius: number;
  /** Projectiles spawned per shot. */
  count: number;
  /** Total fan angle (radians) the `count` projectiles are spread across. */
  arc: number;
  /** Random angular jitter per projectile (radians). */
  spread: number;
  /** Seconds before a projectile expires. */
  lifetime: number;
  behavior: ProjectileBehavior;
  /** Shots available; null = infinite. */
  ammo: number | null;
}

export const WEAPONS = {
  pulse: {
    id: 'pulse',
    name: 'PULSE PISTOL',
    color: '#00f0ff',
    fireRate: 7,
    damage: 1,
    projectileSpeed: 900,
    projectileRadius: 4,
    count: 1,
    arc: 0,
    spread: 0.03,
    lifetime: 1.2,
    behavior: 'basic',
    ammo: null,
  },
} satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;
export const DEFAULT_WEAPON: WeaponId = 'pulse';
