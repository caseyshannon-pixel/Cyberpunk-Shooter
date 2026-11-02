import { CONFIG } from '../config';
import { DEFAULT_WEAPON, WEAPONS, type WeaponDef, type WeaponId } from './definitions';

export interface WeaponSlot {
  id: WeaponId;
  /** Shots left (Infinity for the default weapon). */
  ammo: number;
  /** Ammo when this slot was last filled — the ammo bar's 100%. */
  capacity: number;
}

/**
 * The weapons the player is carrying. Slot 0 is always the infinite Pulse
 * Pistol; picking up a weapon adds a slot (or tops it up) and equips it, and a
 * weapon that runs dry is dropped, falling back to the Pulse Pistol.
 */
export interface ArsenalOptions {
  /** Rogue Run: weapons never run dry. */
  infiniteAmmo?: boolean;
  /** Most weapons carried besides the Pulse Pistol. */
  maxExtra?: number;
}

export class Arsenal {
  readonly slots: WeaponSlot[] = [{ id: DEFAULT_WEAPON, ammo: Infinity, capacity: Infinity }];
  index = 0;
  private readonly infiniteAmmo: boolean;
  private readonly maxExtra: number;
  /** Slot of the weapon added last (replaced first when full and the Pistol is equipped). */
  private lastAdded = 0;

  constructor(opts: ArsenalOptions = {}) {
    this.infiniteAmmo = opts.infiniteAmmo ?? false;
    this.maxExtra = opts.maxExtra ?? Infinity;
  }

  get current(): WeaponSlot {
    return this.slots[this.index];
  }

  get def(): WeaponDef {
    return WEAPONS[this.current.id];
  }

  /**
   * Add (or refill) a weapon and equip it. When the extra slots are full the
   * equipped weapon is replaced — or, with the Pistol equipped, the newest one.
   */
  add(id: WeaponId): void {
    const per = this.infiniteAmmo ? Infinity : (WEAPONS[id].ammo ?? Infinity);
    const i = this.slots.findIndex((s) => s.id === id);
    if (i >= 0) {
      const slot = this.slots[i];
      slot.ammo = Math.min(per * CONFIG.buffs.weaponAmmoCap, slot.ammo + per);
      slot.capacity = Math.max(slot.capacity, slot.ammo);
      this.index = i;
    } else if (this.slots.length - 1 >= this.maxExtra) {
      const at = this.index > 0 ? this.index : this.lastAdded;
      this.slots[at] = { id, ammo: per, capacity: per };
      this.index = this.lastAdded = at;
    } else {
      this.slots.push({ id, ammo: per, capacity: per });
      this.index = this.lastAdded = this.slots.length - 1;
    }
  }

  /** Slot of the newest weapon (carried between rooms so the replacement rule holds). */
  get newest(): number {
    return this.lastAdded;
  }

  /** Carried weapon ids, Pistol first. */
  ids(): WeaponId[] {
    return this.slots.map((s) => s.id);
  }

  /** Re-equip a loadout saved with `ids()`, `index` and `newest` (the Pistol entry is implied). */
  restore(ids: readonly WeaponId[], index: number, newest = ids.length - 1): void {
    this.slots.length = 1;
    for (const id of ids) if (id !== DEFAULT_WEAPON) this.add(id);
    const clamp = (i: number) => Math.min(Math.max(0, i), this.slots.length - 1);
    this.index = clamp(index);
    this.lastAdded = clamp(newest);
  }

  /** Cycle held weapons; returns true if the equipped weapon changed. */
  cycle(dir: 1 | -1): boolean {
    if (this.slots.length < 2) return false;
    this.index = (this.index + dir + this.slots.length) % this.slots.length;
    return true;
  }

  /**
   * Spend one shot. If that empties the weapon it's discarded and the Pulse
   * Pistol is equipped; returns the id of the weapon that ran dry, if any.
   */
  consume(): WeaponId | null {
    const slot = this.current;
    if (!Number.isFinite(slot.ammo)) return null;
    slot.ammo -= 1;
    if (slot.ammo > 0) return null;
    this.slots.splice(this.index, 1);
    this.index = 0;
    return slot.id;
  }
}
