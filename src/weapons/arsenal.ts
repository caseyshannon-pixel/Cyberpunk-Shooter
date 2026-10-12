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
export class Arsenal {
  readonly slots: WeaponSlot[] = [{ id: DEFAULT_WEAPON, ammo: Infinity, capacity: Infinity }];
  index = 0;

  get current(): WeaponSlot {
    return this.slots[this.index];
  }

  get def(): WeaponDef {
    return WEAPONS[this.current.id];
  }

  /** Add (or refill) a weapon and equip it. */
  add(id: WeaponId): void {
    const per = WEAPONS[id].ammo ?? Infinity;
    const i = this.slots.findIndex((s) => s.id === id);
    if (i >= 0) {
      const slot = this.slots[i];
      slot.ammo = Math.min(per * CONFIG.buffs.weaponAmmoCap, slot.ammo + per);
      slot.capacity = Math.max(slot.capacity, slot.ammo);
      this.index = i;
    } else {
      this.slots.push({ id, ammo: per, capacity: per });
      this.index = this.slots.length - 1;
    }
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
