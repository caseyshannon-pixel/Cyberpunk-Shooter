import { CONFIG } from '../config';
import { len } from '../core/math';
import type { Enemy } from '../entities/enemy';
import { isWeaponPickup, Pickup, pickupColor, pickupName, renderPickup, type PickupKind } from '../entities/pickup';
import type { World } from './world';

const PK = CONFIG.pickups;
const B = CONFIG.buffs;
const KINDS = Object.keys(PK.weights) as PickupKind[];

/** Spawns drops from enemies, animates them, and applies their effects on collection. */
export class PickupManager {
  readonly items: Pickup[] = [];

  /** Roll an enemy's drop chance (bosses always drop several). */
  onEnemyKilled(e: Enemy, w: World): void {
    if (e.boss) {
      this.spawn('health', e.x, e.y, w);
      for (let i = 0; i < PK.bossDrops; i++) this.spawn(this.roll(w), e.x, e.y, w);
      return;
    }
    if (this.items.length >= PK.maxOnField) return;
    if (Math.random() < e.def.dropChance) this.spawn(this.roll(w), e.x, e.y, w);
  }

  /** Weighted-random pickup kind (health chips get rare while at full health). */
  roll(w: World): PickupKind {
    const fullHp = w.player.health >= w.player.maxHealth;
    let total = 0;
    for (const k of KINDS) total += this.weight(k, fullHp);
    let r = Math.random() * total;
    for (const k of KINDS) {
      r -= this.weight(k, fullHp);
      if (r <= 0) return k;
    }
    return KINDS[0];
  }

  private weight(k: PickupKind, fullHp: boolean): number {
    return k === 'health' && fullHp ? PK.healthWeightAtFull : PK.weights[k];
  }

  spawn(kind: PickupKind, x: number, y: number, w: World): Pickup {
    const p = new Pickup(kind, x, y);
    w.arena.resolveCircle(p, p.radius + 4);
    this.items.push(p);
    return p;
  }

  update(dt: number, w: World): void {
    const pl = w.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      p.life -= dt;

      // Initial pop, with friction.
      const k = Math.exp(-6 * dt);
      p.vx *= k;
      p.vy *= k;

      if (pl.alive) {
        const dx = pl.x - p.x;
        const dy = pl.y - p.y;
        const d = len(dx, dy);
        if (d < p.radius + pl.radius + 4) {
          this.items.splice(i, 1);
          this.collect(p.kind, w);
          continue;
        }
        if (d < PK.magnetRange) {
          const pull = PK.magnetSpeed * (1 - d / PK.magnetRange) + 60;
          p.vx += (dx / d) * pull * dt * 8;
          p.vy += (dy / d) * pull * dt * 8;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      w.arena.resolveCircle(p, p.radius + 4);

      if (p.life <= 0) {
        this.items.splice(i, 1);
        w.particles.burst(p.x, p.y, pickupColor(p.kind), 6, 30, 110, 0.2, 0.4, 1.5);
      }
    }
  }

  /** Apply a pickup's effect to the player / world. */
  collect(kind: PickupKind, w: World): void {
    const p = w.player;
    const color = pickupColor(kind);
    let label = pickupName(kind);

    if (isWeaponPickup(kind)) {
      p.arsenal.add(kind);
      p.charge = 0;
    } else {
      switch (kind) {
        case 'overclock':
          p.overclock = B.overclockDuration;
          break;
        case 'shield':
          p.shield = B.shieldHits;
          p.shieldHitAge = 1;
          break;
        case 'health':
          if (p.health < p.maxHealth) {
            p.health = Math.min(p.maxHealth, p.health + B.healthAmount);
          } else {
            w.score.addBonus(B.fullHealthBonus);
            label = `+${B.fullHealthBonus}`;
          }
          break;
        case 'emp':
          w.emp();
          break;
      }
    }

    if (kind !== 'emp') w.sound(isWeaponPickup(kind) ? 'pickupWeapon' : kind === 'health' ? 'pickupHealth' : 'pickupBuff');
    w.popups.add(p.x, p.y - 34, label, color, 15, 1.0);
    w.particles.ring(p.x, p.y, color, 46, 0.35, 3);
    w.particles.burst(p.x, p.y, color, 14, 60, 240, 0.2, 0.45, 2);
    w.rumble(0.25, 0.5, 120);
  }

  clear(): void {
    this.items.length = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.items) renderPickup(ctx, p);
  }
}

