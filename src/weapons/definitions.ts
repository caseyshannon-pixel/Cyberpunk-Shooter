import { CONFIG } from '../config';
import type { WeaponDef } from './types';

export type { FireMode, ProjectileBehavior, WeaponDef } from './types';

export type WeaponId = keyof typeof CONFIG.weapons;

/** All weapons, keyed by id (data lives in CONFIG.weapons). */
export const WEAPONS: Record<WeaponId, WeaponDef> = CONFIG.weapons;
export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];
export const DEFAULT_WEAPON: WeaponId = 'pulse';
