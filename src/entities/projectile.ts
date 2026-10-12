import { CONFIG } from '../config';
import type { Contact } from '../core/collision';
import { TAU } from '../core/math';
import { Pool } from '../core/pool';
import { drawOrb } from '../render/cache';
import type { ProjectileBehavior } from '../weapons/definitions';
import type { Arena } from '../world/arena';

/** Anything a homing projectile can chase. */
export interface HomingTarget {
  x: number;
  y: number;
  dead: boolean;
}

/** What projectiles need from the world: walls, hit tests and targets. */
export interface ProjectileHost {
  readonly arena: Arena;
  /** Return true if the projectile hit something and should be removed. */
  projectileHit(b: Projectile): boolean;
  /** Called on wall impact (both for bounces and for the final hit). */
  projectileWall(b: Projectile, contact: Contact): void;
  nearestEnemy(x: number, y: number, maxDist: number): HomingTarget | null;
}

export type Team = 'player' | 'enemy';

/** Pooled projectile. Never construct directly — use `Projectiles.spawn`. */
export class Projectile {
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  speed = 0;
  radius = 4;
  damage = 1;
  life = 0;
  maxLife = 1;
  team: Team = 'player';
  color = '#fff';
  behavior: ProjectileBehavior = 'basic';
  /** Enemies it can still pass through. */
  pierce = 0;
  /** Wall bounces left. */
  bounces = 0;
  turnRate = 0;
  target: HomingTarget | null = null;
  retarget = 0;
  /** Enemies already hit (so piercing shots don't hit the same one every tick). */
  readonly hits: unknown[] = [];
  dead = false;
}

export interface SpawnParams {
  x: number;
  y: number;
  angle: number;
  speed: number;
  radius: number;
  damage: number;
  life: number;
  team: Team;
  color: string;
  behavior: ProjectileBehavior;
  pierce?: number;
  bounces?: number;
  turnRate?: number;
}

/** Homing missiles fly straight for this long before they start steering. */
const HOMING_DELAY = 0.12;
const HOMING_RANGE = 650;

export class Projectiles {
  readonly pool = new Pool(() => new Projectile(), CONFIG.projectiles.poolSize);

  spawn(p: SpawnParams): Projectile | null {
    const b = this.pool.acquire();
    if (!b) return null;
    b.x = b.prevX = p.x;
    b.y = b.prevY = p.y;
    b.vx = Math.cos(p.angle) * p.speed;
    b.vy = Math.sin(p.angle) * p.speed;
    b.speed = p.speed;
    b.radius = p.radius;
    b.damage = p.damage;
    b.life = b.maxLife = p.life;
    b.team = p.team;
    b.color = p.color;
    b.behavior = p.behavior;
    b.pierce = p.pierce ?? 0;
    b.bounces = p.bounces ?? 0;
    b.turnRate = p.turnRate ?? 0;
    b.target = null;
    b.retarget = 0;
    b.hits.length = 0;
    b.dead = false;
    return b;
  }

  update(dt: number, host: ProjectileHost): void {
    const pool = this.pool;
    const arena = host.arena;
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      b.prevX = b.x;
      b.prevY = b.y;
      if (b.behavior === 'homing' && b.maxLife - b.life > HOMING_DELAY) steerHoming(b, host, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0) b.dead = true;
      else if (host.projectileHit(b)) b.dead = true;
      else {
        const c = arena.hitTestCircle(b.x, b.y, b.radius);
        if (c) {
          host.projectileWall(b, c);
          if (b.bounces > 0) {
            // Reflect off the surface and keep going.
            b.bounces--;
            const dot = b.vx * c.nx + b.vy * c.ny;
            if (dot < 0) {
              b.vx -= 2 * dot * c.nx;
              b.vy -= 2 * dot * c.ny;
            }
            b.x += c.nx * c.depth;
            b.y += c.ny * c.depth;
            b.hits.length = 0;
          } else {
            b.dead = true;
          }
        }
      }
      if (b.dead) pool.releaseAt(i);
    }
  }

  clear(): void {
    this.pool.clear();
  }
}

function steerHoming(b: Projectile, host: ProjectileHost, dt: number): void {
  b.retarget -= dt;
  if (!b.target || b.target.dead || b.retarget <= 0) {
    b.target = host.nearestEnemy(b.x, b.y, HOMING_RANGE);
    b.retarget = 0.25;
  }
  const t = b.target;
  if (!t) return;
  const cur = Math.atan2(b.vy, b.vx);
  let diff = Math.atan2(t.y - b.y, t.x - b.x) - cur;
  diff = ((diff + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const maxTurn = b.turnRate * dt;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
  b.vx = Math.cos(a) * b.speed;
  b.vy = Math.sin(a) * b.speed;
}

/** Draw every live projectile (additive blending). */
export function renderProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectiles, alpha: number, time: number): void {
  const pool = projectiles.pool;
  if (pool.count === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i];
    const x = b.prevX + (b.x - b.prevX) * alpha;
    const y = b.prevY + (b.y - b.prevY) * alpha;

    if (b.team === 'enemy') {
      // Enemy shots: slow, fat glowing orbs that are easy to read (cached sprite).
      drawOrb(ctx, x, y, b.radius, b.color);
      continue;
    }

    if (b.behavior === 'bounce') {
      // Spinning disc.
      const r = b.radius;
      const spin = time * 18;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r, spin, spin + Math.PI * 0.7);
      ctx.moveTo(x + Math.cos(spin + Math.PI) * r, y + Math.sin(spin + Math.PI) * r);
      ctx.arc(x, y, r, spin + Math.PI, spin + Math.PI * 1.7);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, TAU);
      ctx.fill();
      continue;
    }

    // Streak: trail length scales with speed (~1.5 ticks of travel), shorter while freshly spawned.
    const trailT = b.behavior === 'homing' ? 0.05 : 0.025;
    const trail = Math.min(trailT, b.maxLife - b.life);
    const tx = x - b.vx * trail;
    const ty = y - b.vy * trail;

    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = b.radius * 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = b.behavior === 'homing' ? b.color : '#ffffff';
    ctx.lineWidth = b.radius * 0.9;
    ctx.beginPath();
    ctx.moveTo((tx + x) / 2, (ty + y) / 2);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}
