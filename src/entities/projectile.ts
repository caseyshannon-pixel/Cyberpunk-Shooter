import { CONFIG } from '../config';
import { Pool } from '../core/pool';
import { drawOrb } from '../render/cache';
import type { ProjectileBehavior } from '../weapons/definitions';
import type { Arena } from '../world/arena';

/** What projectiles need from the world: walls, plus hit tests against entities. */
export interface ProjectileHost {
  readonly arena: Arena;
  /** Return true if the projectile hit something and should be removed. */
  projectileHit(b: Projectile): boolean;
  projectileWall(b: Projectile): void;
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
  radius = 4;
  damage = 1;
  life = 0;
  maxLife = 1;
  team: Team = 'player';
  color = '#fff';
  behavior: ProjectileBehavior = 'basic';
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
}

export class Projectiles {
  readonly pool = new Pool(() => new Projectile(), CONFIG.projectiles.poolSize);

  spawn(p: SpawnParams): Projectile | null {
    const b = this.pool.acquire();
    if (!b) return null;
    b.x = b.prevX = p.x;
    b.y = b.prevY = p.y;
    b.vx = Math.cos(p.angle) * p.speed;
    b.vy = Math.sin(p.angle) * p.speed;
    b.radius = p.radius;
    b.damage = p.damage;
    b.life = b.maxLife = p.life;
    b.team = p.team;
    b.color = p.color;
    b.behavior = p.behavior;
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
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
      else if (host.projectileHit(b)) b.dead = true;
      else if (arena.hitTestCircle(b.x, b.y, b.radius)) {
        host.projectileWall(b);
        b.dead = true;
      }
      if (b.dead) pool.releaseAt(i);
    }
  }

  clear(): void {
    this.pool.clear();
  }
}

/** Draw every live projectile as a glowing streak (additive blending). */
export function renderProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectiles, alpha: number): void {
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
    // Trail length scales with speed (~1.5 ticks of travel), shorter while freshly spawned.
    const trail = Math.min(0.025, b.maxLife - b.life);
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
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = b.radius * 0.9;
    ctx.beginPath();
    ctx.moveTo((tx + x) / 2, (ty + y) / 2);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.restore();
}
