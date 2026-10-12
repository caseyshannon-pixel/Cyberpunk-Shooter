import { segmentCircle } from '../core/collision';
import { len, TAU } from '../core/math';
import type { Enemy } from '../entities/enemy';
import type { Projectiles, Team } from '../entities/projectile';
import type { World } from '../world/world';
import type { WeaponDef } from './definitions';

/** Emit one "shot" of a projectile weapon (which may be several projectiles). */
export function fireProjectiles(def: WeaponDef, projectiles: Projectiles, x: number, y: number, angle: number, team: Team): void {
  const n = def.count ?? 1;
  const arc = def.arc ?? 0;
  const spread = def.spread ?? 0;
  const ring = arc >= TAU - 1e-6;
  for (let i = 0; i < n; i++) {
    // Fan: spread evenly across `arc` centred on the aim. Ring: n equal slices of 360°.
    const offset = ring ? (i / n) * TAU : n === 1 ? 0 : (i / (n - 1) - 0.5) * arc;
    const a = angle + offset + (Math.random() - 0.5) * 2 * spread;
    projectiles.spawn({
      x,
      y,
      angle: a,
      speed: def.projectileSpeed ?? 800,
      radius: def.projectileRadius ?? 4,
      damage: def.damage,
      life: def.lifetime ?? 1,
      team,
      color: def.color,
      behavior: def.behavior ?? 'basic',
      pierce: def.pierce,
      bounces: def.bounces,
      turnRate: def.turnRate,
    });
  }
}

/**
 * Plasma rail: an instant beam to the first wall. It pierces every enemy on
 * the line and also erases enemy bullets it passes through.
 */
export function fireRail(def: WeaponDef, w: World, x: number, y: number, angle: number): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const dist = w.arena.raycast(x, y, dx, dy, 3000);
  const ex = x + dx * dist;
  const ey = y + dy * dist;
  const half = (def.beamWidth ?? 10) / 2;

  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (e.dead || !segmentCircle(x, y, ex, ey, half, e.x, e.y, e.radius)) continue;
    w.damageEnemy(e, def.damage, dx, dy);
    w.particles.burst(e.x, e.y, def.color, 8, 80, 300, 0.15, 0.35, 2, angle, 1.2);
  }

  const pool = w.projectiles.pool;
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i];
    if (b.team !== 'enemy' || !segmentCircle(x, y, ex, ey, half, b.x, b.y, b.radius)) continue;
    w.particles.burst(b.x, b.y, b.color, 3, 40, 140, 0.12, 0.25, 1.5);
    pool.releaseAt(i);
  }

  w.effects.beam(x, y, ex, ey, def.beamWidth ?? 10, def.color);
  w.particles.burst(ex, ey, def.color, 14, 80, 320, 0.2, 0.45, 2, angle + Math.PI, 2.4);
  w.particles.ring(x, y, def.color, 26, 0.2, 2);
  w.shake(5);
}

/**
 * Arc lightning: zap the nearest enemy in a cone in front of the player, then
 * chain to the nearest not-yet-hit enemy, losing a little damage per jump.
 * Returns false if there was nothing to hit (the shot fizzles, costing no ammo).
 */
export function fireArc(def: WeaponDef, w: World, x: number, y: number, angle: number): boolean {
  const range = def.range ?? 280;
  const cone = def.cone ?? 0.6;
  let first: Enemy | null = null;
  let best = Infinity;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = len(dx, dy) - e.radius;
    if (d > range || d >= best) continue;
    let diff = Math.atan2(dy, dx) - angle;
    diff = Math.abs(((diff + Math.PI) % TAU + TAU) % TAU - Math.PI);
    if (diff > cone || !w.arena.lineOfSight(x, y, e.x, e.y)) continue;
    best = d;
    first = e;
  }

  if (!first) {
    // Fizzle: a short harmless spark so the trigger still feels responsive.
    const fx = x + Math.cos(angle) * 60;
    const fy = y + Math.sin(angle) * 60;
    w.effects.bolt(x, y, fx, fy, def.color, 0.08);
    return false;
  }

  const hit: Enemy[] = [];
  let cur: Enemy = first;
  let fromX = x;
  let fromY = y;
  let dmg = def.damage;
  const chains = def.chains ?? 3;
  const chainRange = def.chainRange ?? 160;
  for (let jump = 0; jump <= chains; jump++) {
    hit.push(cur);
    w.effects.bolt(fromX, fromY, cur.x, cur.y, def.color);
    w.particles.burst(cur.x, cur.y, def.color, 5, 60, 220, 0.12, 0.3, 1.5);
    w.damageEnemy(cur, dmg, cur.x - fromX, cur.y - fromY);
    fromX = cur.x;
    fromY = cur.y;
    dmg *= def.falloff ?? 0.8;

    let next: Enemy | null = null;
    let nd = chainRange;
    for (const e of w.enemies) {
      if (e.dead || hit.includes(e)) continue;
      const d = len(e.x - fromX, e.y - fromY) - e.radius;
      if (d < nd && w.arena.lineOfSight(fromX, fromY, e.x, e.y)) {
        nd = d;
        next = e;
      }
    }
    if (!next) break;
    cur = next;
  }
  return true;
}
