import { CONFIG } from '../config';
import { TAU } from '../core/math';
import { Pool } from '../core/pool';

const Kind = { Spark: 0, Ring: 1 } as const;
type Kind = (typeof Kind)[keyof typeof Kind];

/** Pooled particle; `kind` decides how it's drawn. */
class Particle {
  kind: Kind = Kind.Spark;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 1;
  size = 2;
  /** Ring: final radius. */
  radius = 0;
  drag = 0;
  color = '#fff';
}

export class Particles {
  private readonly pool = new Pool(() => new Particle(), CONFIG.particles.poolSize, CONFIG.particles.poolSize * 2);

  get count(): number {
    return this.pool.count;
  }

  /** Streaky sparks flying outward from a point. */
  burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speedMin = 80,
    speedMax = 380,
    lifeMin = 0.25,
    lifeMax = 0.6,
    size = 2,
    angle = 0,
    arc = TAU,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) return;
      const a = angle + (Math.random() - 0.5) * arc;
      const sp = speedMin + Math.random() * (speedMax - speedMin);
      p.kind = Kind.Spark;
      p.x = p.prevX = x;
      p.y = p.prevY = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = p.maxLife = lifeMin + Math.random() * (lifeMax - lifeMin);
      p.size = size * (0.7 + Math.random() * 0.6);
      p.drag = 3.5;
      p.color = color;
    }
  }

  /** Expanding shockwave ring. */
  ring(x: number, y: number, color: string, radius: number, life = 0.35, width = 3): void {
    const p = this.pool.acquire();
    if (!p) return;
    p.kind = Kind.Ring;
    p.x = p.prevX = x;
    p.y = p.prevY = y;
    p.vx = p.vy = 0;
    p.radius = radius;
    p.life = p.maxLife = life;
    p.size = width;
    p.color = color;
  }

  update(dt: number): void {
    const pool = this.pool;
    for (let i = pool.count - 1; i >= 0; i--) {
      const p = pool.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        pool.releaseAt(i);
        continue;
      }
      p.prevX = p.x;
      p.prevY = p.y;
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  clear(): void {
    this.pool.clear();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const pool = this.pool;
    if (pool.count === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[i];
      const t = p.life / p.maxLife; // 1 → 0
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;
      ctx.strokeStyle = p.color;
      if (p.kind === Kind.Spark) {
        ctx.globalAlpha = t;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(x - p.vx * 0.03, y - p.vy * 0.03);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        // Ease-out cubic expansion: fast at first, settling at the full radius.
        const grow = 1 - t * t * t;
        ctx.globalAlpha = t * 0.9;
        ctx.lineWidth = p.size * t + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, p.radius * grow, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
