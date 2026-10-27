import { COLORS, CONFIG } from '../config';
import { approach, lerp, lerpAngle, len, vec, type Vec2 } from '../core/math';
import { Action } from '../input/bindings';
import type { Input } from '../input/input';
import { Arsenal } from '../weapons/arsenal';
import type { Arena } from '../world/arena';

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

  alive = true;
  health: number = P.maxHealth;
  maxHealth: number = P.maxHealth;

  dashTime = 0;
  dashCooldown = 0;
  invulnTime = 0;
  private dashDirX = 0;
  private dashDirY = 0;
  readonly ghosts: Ghost[] = [];
  /** True on the tick a dash started (for sound / effects). */
  justDashed = false;

  /** Carried weapons + ammo (fired by weapons/weaponSystem.ts). */
  readonly arsenal = new Arsenal();
  fireCooldown = 0;
  /** Seconds since last shot; drives muzzle flash. */
  sinceShot = 1;
  /** Plasma rail charge, 0..1. */
  charge = 0;

  /** Seconds of Overclock (double fire rate) left. */
  overclock = 0;
  /** Hits the Shield Matrix can still absorb. */
  shield = 0;
  /** Seconds since the shield last absorbed a hit (for the flash). */
  shieldHitAge = 1;

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

  /** Apply one hit of damage from direction (nx, ny). Returns true if it was fatal. */
  takeHit(nx: number, ny: number): boolean {
    this.health = Math.max(0, this.health - 1);
    this.invulnTime = P.hitInvuln;
    this.vx += nx * P.hitKnockback;
    this.vy += ny * P.hitKnockback;
    if (this.health <= 0) {
      this.alive = false;
      this.vx = this.vy = 0;
      this.ghosts.length = 0;
      return true;
    }
    return false;
  }

  update(dt: number, input: Input, arena: Arena): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAimAngle = this.aimAngle;
    this.justDashed = false;

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnTime = Math.max(0, this.invulnTime - dt);
    this.sinceShot += dt;
    this.overclock = Math.max(0, this.overclock - dt);
    this.shieldHitAge += dt;

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
      this.justDashed = true;
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
  }

  render(ctx: CanvasRenderingContext2D, alpha: number, time: number): void {
    if (!this.alive) return;
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

    const def = this.arsenal.def;

    if (this.shield > 0) drawShield(ctx, x, y, this.radius, this.shield, this.shieldHitAge, time);

    // Flicker while invulnerable after a hit (not during the dash itself).
    if (this.invulnerable && !this.dashing && Math.floor(time * 30) % 2 === 0) return;

    const oc = this.overclock > 0;
    ctx.save();
    ctx.shadowColor = oc ? COLORS.yellow : COLORS.cyan;
    ctx.shadowBlur = 18;
    drawShip(ctx, x, y, angle, this.dashing ? COLORS.magenta : oc ? COLORS.yellow : COLORS.cyan, this.radius);
    ctx.restore();

    // Rail charge: a growing orb at the muzzle plus a faint aim line.
    if (this.charge > 0) {
      const mx = x + Math.cos(angle) * (P.muzzleOffset + 4);
      const my = y + Math.sin(angle) * (P.muzzleOffset + 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.15 + this.charge * 0.35;
      ctx.lineWidth = 1 + this.charge * 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(angle) * 420, my + Math.sin(angle) * 420);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.5 + this.charge * 0.5;
      ctx.beginPath();
      ctx.arc(mx, my, 3 + this.charge * 7 + Math.sin(time * 50) * this.charge, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Muzzle flash.
    if (this.sinceShot < 0.05) {
      const mx = x + Math.cos(angle) * (P.muzzleOffset + 2);
      const my = y + Math.sin(angle) * (P.muzzleOffset + 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 1 - this.sinceShot / 0.05;
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** HD 2.5D: a faint outline drawn over the obstacle that's hiding the ship. */
  renderXray(ctx: CanvasRenderingContext2D, alpha: number): void {
    const x = lerp(this.prevX, this.x, alpha);
    const y = lerp(this.prevY, this.y, alpha);
    const angle = lerpAngle(this.prevAimAngle, this.aimAngle, alpha);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    drawShip(ctx, x, y, angle, COLORS.cyan, this.radius);
    ctx.restore();
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

/** Shield Matrix: a slowly rotating hexagon; brighter/thicker with more charges, flashes when hit. */
function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, charges: number, hitAge: number, time: number): void {
  const R = r + 12;
  const flash = Math.max(0, 1 - hitAge / 0.25);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.rotate(time * 0.8);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    else ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
  }
  ctx.closePath();
  ctx.fillStyle = COLORS.cyan;
  ctx.globalAlpha = 0.06 + 0.04 * charges + flash * 0.3;
  ctx.fill();
  ctx.strokeStyle = flash > 0 ? '#ffffff' : COLORS.cyan;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 0.55 + 0.15 * charges;
  ctx.lineWidth = 1 + charges * 0.7;
  ctx.stroke();
  ctx.restore();
}
