import { COLORS, CONFIG } from '../config';
import { circleCircle, segmentCircle } from '../core/collision';
import { approach, len, TAU } from '../core/math';
import { SpatialGrid } from '../core/spatialGrid';
import { createBossState, renderBoss } from '../entities/boss';
import { Enemy, renderEnemy, type EnemyKind } from '../entities/enemy';
import { ENEMY_AI } from '../entities/enemyAI';
import { Particles } from '../entities/particles';
import { Player } from '../entities/player';
import { Projectiles, renderProjectiles, type Projectile, type ProjectileHost } from '../entities/projectile';
import type { Input } from '../input/input';
import { renderArena, renderBackground } from '../render/background';
import { Arena } from './arena';
import { Popups } from './popups';
import { ScoreKeeper } from './score';
import { WaveDirector } from './waves';

const C = CONFIG.combat;

/** Side effects the world asks the outside (game/UI/audio) to perform. */
export interface WorldHooks {
  toast(text: string, color?: string): void;
  rumble(strong: number, weak: number, ms: number): void;
}

/**
 * Everything in one run: arena, player, enemies, projectiles, effects, waves
 * and score. States own a World; the World owns the simulation rules.
 */
export class World implements ProjectileHost {
  readonly arena = new Arena();
  readonly player: Player;
  readonly enemies: Enemy[] = [];
  readonly projectiles = new Projectiles();
  readonly particles = new Particles();
  readonly popups = new Popups();
  readonly score = new ScoreKeeper();
  readonly waves = new WaveDirector();
  readonly grid: SpatialGrid<Enemy>;

  /** Simulation time of this run. */
  time = 0;
  /** Seconds since the player died (0 while alive). */
  deathTime = 0;
  /** Red full-screen flash after taking damage (seconds remaining). */
  damageFlash = 0;
  private shakeAmt = 0;
  private readonly near: Enemy[] = [];

  constructor(private readonly hooks: WorldHooks) {
    const b = this.arena.bounds;
    this.grid = new SpatialGrid<Enemy>(b.x, b.y, b.w, b.h, C.spatialCell);
    this.player = new Player(this.arena.centerX, this.arena.centerY + 120);
  }

  get boss(): Enemy | null {
    for (const e of this.enemies) if (e.boss) return e;
    return null;
  }

  // ---------------------------------------------------------------- update

  update(dt: number, input: Input): void {
    this.time += dt;
    const p = this.player;
    if (p.alive) p.update(dt, input, this.arena, this.projectiles);
    else this.deathTime += dt;

    this.waves.update(dt, this);
    this.updateEnemies(dt);

    this.grid.clear();
    for (const e of this.enemies) this.grid.insert(e);

    this.projectiles.update(dt, this);
    this.score.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    this.shakeAmt *= Math.exp(-10 * dt);
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const kbDecay = Math.exp(-C.knockbackDrag * dt);

    for (const e of this.enemies) {
      if (e.dead) continue;
      e.prevX = e.x;
      e.prevY = e.y;
      e.prevAngle = e.angle;
      e.age += dt;
      e.flash -= dt;

      if (e.stun > 0) {
        e.stun -= dt;
        e.accel = e.def.accel;
        e.steer(0, 0);
      } else if (p.alive) {
        ENEMY_AI[e.kind](e, this, dt);
      } else {
        e.steer(0, 0);
      }

      const step = e.accel * dt;
      e.vx = approach(e.vx, e.desiredX, step);
      e.vy = approach(e.vy, e.desiredY, step);
      e.kbx *= kbDecay;
      e.kby *= kbDecay;
      e.x += (e.vx + e.kbx) * dt;
      e.y += (e.vy + e.kby) * dt;

      // Soft separation so swarms spread out instead of stacking.
      if (e.def.knockback > 0) {
        this.grid.query(e.x, e.y, e.radius, this.near);
        for (const o of this.near) {
          if (o === e || o.dead) continue;
          const dx = e.x - o.x;
          const dy = e.y - o.y;
          const rr = e.radius + o.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          const d = Math.sqrt(d2);
          // Push fully away from immovable enemies (the boss), half otherwise.
          const share = o.def.knockback === 0 ? 1 : C.separation;
          const push = (rr - d) * share;
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
        }
      }

      e.blocked = this.arena.resolveCircle(e, e.radius);

      // Body contact damages the player and bounces the enemy off.
      if (p.alive && circleCircle(e.x, e.y, e.radius, p.x, p.y, p.radius * CONFIG.player.hitboxScale)) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = len(dx, dy) || 1;
        if (!p.invulnerable) this.damagePlayer(e.x, e.y);
        if (e.def.knockback > 0) {
          e.kbx += (dx / d) * 260;
          e.kby += (dy / d) * 260;
        }
      }
    }

    // Compact out the dead.
    let n = 0;
    for (const e of this.enemies) if (!e.dead) this.enemies[n++] = e;
    this.enemies.length = n;
  }

  // ---------------------------------------------------------------- projectiles

  projectileHit(b: Projectile): boolean {
    if (b.team === 'player') {
      const mx = (b.prevX + b.x) / 2;
      const my = (b.prevY + b.y) / 2;
      const reach = b.radius + len(b.x - b.prevX, b.y - b.prevY) / 2;
      this.grid.query(mx, my, reach, this.near);
      for (const e of this.near) {
        if (e.dead) continue;
        if (!segmentCircle(b.prevX, b.prevY, b.x, b.y, b.radius, e.x, e.y, e.radius)) continue;
        this.damageEnemy(e, b.damage, b.vx, b.vy);
        this.particles.burst(b.x, b.y, b.color, 4, 60, 240, 0.12, 0.25, 1.5, Math.atan2(-b.vy, -b.vx), 1.6);
        return true;
      }
      return false;
    }
    const p = this.player;
    if (!p.alive || p.invulnerable) return false;
    if (segmentCircle(b.prevX, b.prevY, b.x, b.y, b.radius, p.x, p.y, p.radius * CONFIG.player.hitboxScale)) {
      this.damagePlayer(b.x - b.vx, b.y - b.vy);
      return true;
    }
    return false;
  }

  projectileWall(b: Projectile): void {
    this.particles.burst(b.x, b.y, b.color, 3, 40, 160, 0.1, 0.22, 1.5);
  }

  fireEnemyBullet(x: number, y: number, angle: number, speed: number, radius: number): void {
    this.projectiles.spawn({
      x,
      y,
      angle,
      speed,
      radius,
      damage: 1,
      life: 6,
      team: 'enemy',
      color: C.enemyBulletColor,
      behavior: 'basic',
    });
  }

  // ---------------------------------------------------------------- spawning / damage

  /** Create an enemy now, scaled to the current wave. `fx` adds a spawn flash. */
  spawnEnemy(kind: EnemyKind, x: number, y: number, fx = true): Enemy {
    const waves = this.waves;
    let hpScale = waves.hpScale;
    if (kind === 'boss') {
      const bossNumber = Math.max(1, Math.round(waves.wave / CONFIG.waves.bossEvery));
      hpScale = 1 + (bossNumber - 1) * CONFIG.enemies.boss.hpPerBoss;
    }
    const e = new Enemy(kind, x, y, hpScale, kind === 'boss' ? 1 : waves.speedScale);
    if (kind === 'boss') {
      e.boss = createBossState();
      e.boss.displayHp = e.hp;
      this.shake(10);
      this.hooks.rumble(0.5, 0.5, 400);
    }
    e.cooldown = 0.8 + Math.random() * 1.2;
    e.angle = e.prevAngle = Math.atan2(this.player.y - y, this.player.x - x);
    this.enemies.push(e);
    if (fx) this.particles.ring(x, y, e.def.color, e.radius * 2.4, 0.3, 2);
    return e;
  }

  damageEnemy(e: Enemy, dmg: number, dirX: number, dirY: number): void {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = C.hitFlash;
    const d = len(dirX, dirY) || 1;
    const nx = dirX / d;
    const ny = dirY / d;
    const kb = C.knockbackPerDamage * dmg * e.def.knockback;
    e.kbx += nx * kb;
    e.kby += ny * kb;
    if (e.hp <= 0) this.killEnemy(e, nx, ny);
  }

  private killEnemy(e: Enemy, nx: number, ny: number): void {
    e.dead = true;
    const def = e.def;
    const pts = this.score.addKill(def.score);
    const mult = this.score.multiplier;
    this.popups.add(e.x, e.y - e.radius, `+${pts}`, mult > 1 ? COLORS.yellow : COLORS.white, 12 + Math.min(10, mult * 1.5));

    const big = e.radius >= 20;
    this.particles.burst(e.x, e.y, def.color, 10 + e.radius, 80, 260 + e.radius * 8, 0.3, 0.7, 2.5);
    this.particles.burst(e.x, e.y, '#ffffff', 4 + (e.radius >> 2), 60, 200, 0.15, 0.3, 2);
    this.particles.ring(e.x, e.y, def.color, e.radius * 3, 0.35, big ? 4 : 2);
    if (big) {
      this.shake(e.kind === 'boss' ? 20 : 5);
      this.hooks.rumble(0.4, 0.6, 140);
    }

    if (e.kind === 'splitter') {
      const S = CONFIG.enemies.splitter;
      // Children fly out sideways relative to the killing shot.
      for (let i = 0; i < S.splitCount; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const a = Math.atan2(ny, nx) + side * (Math.PI / 2) + (Math.random() - 0.5) * 0.6;
        const c = this.spawnEnemy('splitling', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, false);
        c.kbx = Math.cos(a) * S.splitSpeed;
        c.kby = Math.sin(a) * S.splitSpeed;
      }
    }

    if (e.kind === 'boss') {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * TAU;
        const r = Math.random() * e.radius;
        this.particles.burst(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, i % 2 ? COLORS.magenta : COLORS.purple, 40, 120, 600, 0.5, 1.2, 3);
      }
      this.particles.ring(e.x, e.y, '#ffffff', 320, 0.8, 6);
      this.hooks.rumble(1, 1, 600);
      this.hooks.toast('WARDEN DESTROYED', COLORS.yellow);
      // Clear the boss's remaining bullets so the win feels clean.
      this.clearEnemyBullets();
    }
  }

  damagePlayer(fromX: number, fromY: number): void {
    const p = this.player;
    if (!p.alive || p.invulnerable) return;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = len(dx, dy) || 1;
    const fatal = p.takeHit(dx / d, dy / d);
    this.score.onPlayerHit();
    this.damageFlash = 0.35;
    this.particles.burst(p.x, p.y, COLORS.cyan, 18, 80, 320, 0.25, 0.5, 2);
    this.shake(9);
    this.hooks.rumble(0.8, 0.9, 220);
    if (fatal) {
      this.particles.burst(p.x, p.y, COLORS.cyan, 60, 100, 520, 0.5, 1.2, 3);
      this.particles.burst(p.x, p.y, COLORS.magenta, 40, 80, 420, 0.5, 1.0, 2.5);
      this.particles.ring(p.x, p.y, '#ffffff', 220, 0.7, 5);
      this.shake(18);
      this.hooks.rumble(1, 1, 700);
    }
  }

  clearEnemyBullets(): void {
    const pool = this.projectiles.pool;
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      if (b.team !== 'enemy') continue;
      this.particles.burst(b.x, b.y, b.color, 2, 30, 120, 0.15, 0.3, 1.5);
      pool.releaseAt(i);
    }
  }

  onWaveCleared(wave: number): void {
    const bonus = CONFIG.waves.clearBonusPerWave * wave;
    this.score.addBonus(bonus);
    this.popups.add(this.arena.centerX, this.arena.centerY + 70, `CLEAR BONUS +${bonus}`, COLORS.cyan, 18, 1.6);
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  toast(text: string, color?: string): void {
    this.hooks.toast(text, color);
  }

  // ---------------------------------------------------------------- render

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.save();
    if (this.shakeAmt > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shakeAmt, (Math.random() - 0.5) * this.shakeAmt);
    }
    renderBackground(ctx, this.time);
    renderArena(ctx, this.arena, this.time);
    this.waves.renderMarkers(ctx, this.time);
    for (const e of this.enemies) {
      if (e.boss) renderBoss(ctx, e, alpha);
      else renderEnemy(ctx, e, alpha);
    }
    renderProjectiles(ctx, this.projectiles, alpha);
    this.particles.render(ctx, alpha);
    this.player.render(ctx, alpha, this.time);
    this.popups.render(ctx);
    ctx.restore();

    if (this.damageFlash > 0) {
      ctx.save();
      const W = CONFIG.view.width;
      const H = CONFIG.view.height;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(255, 30, 70, 0)');
      g.addColorStop(1, `rgba(255, 30, 70, ${(this.damageFlash / 0.35) * 0.45})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}
