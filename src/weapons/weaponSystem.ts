import { CONFIG } from '../config';
import { Action } from '../input/bindings';
import type { Input } from '../input/input';
import type { World } from '../world/world';
import type { SfxName } from '../audio';
import { WEAPONS } from './definitions';
import { fireArc, fireProjectiles, fireRail } from './fire';

/**
 * Per-tick player weapon logic: cycling, fire rate (with Overclock), the
 * rail's charge-up, ammo use and falling back to the Pulse Pistol.
 */
export function updateWeapons(w: World, input: Input, dt: number): void {
  const p = w.player;
  if (!p.alive) return;
  const ars = p.arsenal;

  let switched = false;
  if (input.pressed(Action.WEAPON_NEXT)) switched = ars.cycle(1);
  if (input.pressed(Action.WEAPON_PREV)) switched = ars.cycle(-1) || switched;
  if (switched) {
    p.charge = 0;
    p.fireCooldown = Math.max(p.fireCooldown, 0.08);
    w.popups.add(p.x, p.y - 30, ars.def.name, ars.def.color, 13, 0.7);
    w.sound('swap');
  }

  const def = ars.def;
  const overclocked = p.overclock > 0;
  const rate = def.fireRate * (overclocked ? CONFIG.buffs.overclockRate : 1);
  const interval = 1 / rate;
  const wantFire = input.isDown(Action.FIRE) && !p.dashing;
  const mx = p.x + Math.cos(p.aimAngle) * CONFIG.player.muzzleOffset;
  const my = p.y + Math.sin(p.aimAngle) * CONFIG.player.muzzleOffset;

  p.fireCooldown -= dt;

  if (def.mode === 'rail') {
    // Hold to charge; the beam discharges automatically when full (works with stick auto-fire).
    if (wantFire && p.fireCooldown <= 0) {
      if (p.charge === 0) w.sound('railCharge', p.x);
      p.charge += (dt / (def.chargeTime ?? 0.4)) * (overclocked ? CONFIG.buffs.overclockRate : 1);
      if (p.charge >= 1) {
        p.charge = 0;
        fireRail(def, w, mx, my, p.aimAngle);
        w.sound('shoot_rail', p.x);
        afterShot(w, interval);
        input.rumble(0.35, 0.2, 90);
      }
    } else {
      p.charge = Math.max(0, p.charge - dt * 3);
      if (p.fireCooldown < 0) p.fireCooldown = 0;
    }
    return;
  }

  if (!wantFire) {
    if (p.fireCooldown < 0) p.fireCooldown = 0;
    return;
  }
  while (p.fireCooldown <= 0) {
    if (def.mode === 'arc') {
      if (!fireArc(def, w, mx, my, p.aimAngle)) {
        // Nothing in range: no ammo spent, short retry delay.
        p.fireCooldown += interval;
        p.sinceShot = 0;
        break;
      }
    } else {
      fireProjectiles(def, w.projectiles, mx, my, p.aimAngle, 'player');
      // A couple of muzzle sparks per shot.
      w.particles.burst(mx, my, def.color, 2, 80, 240, 0.05, 0.12, 1.5, p.aimAngle, 0.9);
    }
    w.sound(`shoot_${ars.current.id}` as SfxName, p.x);
    if (afterShot(w, interval)) break;
  }
}

/** Book-keeping after a shot. Returns true if the weapon ran dry (and was swapped out). */
function afterShot(w: World, interval: number): boolean {
  const p = w.player;
  p.fireCooldown += interval;
  p.sinceShot = 0;
  const emptied = p.arsenal.consume();
  if (!emptied) return false;
  p.charge = 0;
  w.popups.add(p.x, p.y - 30, `${WEAPONS[emptied].short} EMPTY`, '#8c7fb0', 12, 0.8);
  w.sound('empty');
  return true;
}
