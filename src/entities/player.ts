import { COLORS, CONFIG } from '../config';
import { approach, lerp, lerpAngle, len, vec, type Vec2 } from '../core/math';
import { Action } from '../input/bindings';
import type { Input } from '../input/input';
import { DEFAULT_WEAPON, WEAPONS, type WeaponId } from '../weapons/definitions';
import { fireWeapon } from '../weapons/fire';
import type { Arena } from '../world/arena';
import type { Projectiles } from './projectile';

const P = CONFIG.player;

interface Ghost {
  x: number;
  y: number;
  angle: number;
  life: number;
}

export class Player {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx = 0;
  vy = 0;
  readonly radius = P.radius;

  aimAngle = -Math.PI / 2;
  prevAimAngle = -Math.PI / 2;
  /** True while the player is actively aiming (stick pushed / mouse) — used for the reticle. */
  aiming = false;

  health: number = P.maxHealth;
  maxHealth: number = P.maxHealth;

  dashTime = 0;
  dashCooldown = 0;
  invulnTime = 0;
  private dashDirX = 0;
  private dashDirY = 0;
  readonly ghosts: Ghost[] = [];

  weapon: WeaponId = DEFAULT_WEAPON;
  fireCooldown = 0;
  /** Seconds since last shot; drives muzzle flash. */
  sinceShot = 1;

  private readonly aimDir: Vec2 = vec();

  constructor(x: number, y: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
  }

  get dashing(): boolean {
    return this.dashTime > 0;
  }

  get invulnerable(): boolean {
    return this.invulnTime > 0;
  }

  /** 0..1, 1 = dash ready. */
  get dashReady(): number {
    return 1 - this.dashCooldown / P.dash.cooldown;
  }

  update(dt: number, input: Input, arena: Arena, projectiles: Projectiles): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAimAngle = this.aimAngle;

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnTime = Math.max(0, this.invulnTime - dt);
    this.sinceShot += dt;

    // --- Aim
    this.aiming = input.getAimDirection(this.x, this.y, this.aimDir);
    if (this.aiming) {
      this.aimAngle = Math.atan2(this.aimDir.y, this.aimDir.x);
    } else if (len(input.move.x, input.move.y) > 0.25) {
      // Right stick at rest: face where we're running, like most twin-sticks.
      this.aimAngle = lerpAngle(this.aimAngle, Math.atan2(input.move.y, input.move.x), Math.min(1, dt * 12));
    }

    // --- Dash
    if (input.pressed(Action.DASH) && this.dashCooldown <= 0 && !this.dashing) {
      const ml = len(input.move.x, input.move.y);
      if (ml > 0.1) {
        this.dashDirX = input.move.x / ml;
        this.dashDirY = input.move.y / ml;
      } else {
        this.dashDirX = Math.cos(this.aimAngle);
        this.dashDirY = Math.sin(this.aimAngle);
      }
      this.dashTime = P.dash.duration;
      this.dashCooldown = P.dash.cooldown;
      this.invulnTime = Math.max(this.invulnTime, P.dash.duration + P.dash.iframeExtra);
      input.rumble(0.15, 0.35, 90);
    }

    // --- Movement
    if (this.dashing) {
      this.dashTime -= dt;
      this.vx = this.dashDirX * P.dash.speed;
      this.vy = this.dashDirY * P.dash.speed;
      this.ghosts.push({ x: this.x, y: this.y, angle: this.aimAngle, life: 0.22 });
      if (this.dashTime <= 0) {
        // Exit the dash carrying normal running speed so it doesn't feel like hitting a wall.
        this.vx = this.dashDirX * P.speed;
        this.vy = this.dashDirY * P.speed;
      }
    } else {
      const tx = input.move.x * P.speed;
      const ty = input.move.y * P.speed;
      const step = P.accel * dt;
      this.vx = approach(this.vx, tx, step);
      this.vy = approach(this.vy, ty, step);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    arena.resolveCircle(this, this.radius);

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].life -= dt;
      if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    }

    // --- Fire
    const def = WEAPONS[this.weapon];
    this.fireCooldown -= dt;
    if (input.isDown(Action.FIRE) && !this.dashing) {
      const interval = 1 / def.fireRate;
      while (this.fireCooldown <= 0) {
        const mx = this.x + Math.cos(this.aimAngle) * P.muzzleOffset;
        const my = this.y + Math.sin(this.aimAngle) * P.muzzleOffset;
        fireWeapon(def, projectiles, mx, my, this.aimAngle, 'player');
        this.fireCooldown += interval;
        this.sinceShot = 0;
      }
    } else if (this.fireCooldown < 0) {
      this.fireCooldown = 0;
    }
  }

  render(ctx: CanvasRenderingContext2D, alpha: number, time: number): void {
    const x = lerp(this.prevX, this.x, alpha);
    const y = lerp(this.prevY, this.y, alpha);
    const angle = lerpAngle(this.prevAimAngle, this.aimAngle, alpha);

    // Dash afterimages.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.ghosts) {
      ctx.globalAlpha = (g.life / 0.22) * 0.5;
      drawShip(ctx, g.x, g.y, g.angle, COLORS.magenta, this.radius);
    }
    ctx.restore();

    // Flicker while invulnerable after a dash.
    if (this.invulnerable && !this.dashing && Math.floor(time * 30) % 2 === 0) return;

    ctx.save();
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 18;
    drawShip(ctx, x, y, angle, this.dashing ? COLORS.magenta : COLORS.cyan, this.radius);
    ctx.restore();

    // Muzzle flash.
    if (this.sinceShot < 0.05) {
      const mx = x + Math.cos(angle) * (P.muzzleOffset + 2);
      const my = y + Math.sin(angle) * (P.muzzleOffset + 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = WEAPONS[this.weapon].color;
      ctx.globalAlpha = 1 - this.sinceShot / 0.05;
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Body: an angular arrowhead.
  ctx.beginPath();
  ctx.moveTo(r * 1.35, 0);
  ctx.lineTo(-r * 0.8, r * 0.95);
  ctx.lineTo(-r * 0.35, 0);
  ctx.lineTo(-r * 0.8, -r * 0.95);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Core.
  ctx.beginPath();
  ctx.arc(r * 0.15, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.magenta;
  ctx.fill();
  ctx.restore();
}
