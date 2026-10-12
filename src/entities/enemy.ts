import { COLORS, CONFIG } from '../config';
import { lerp, lerpAngle, TAU } from '../core/math';

export type EnemyKind = keyof typeof CONFIG.enemies;
export type EnemyDef = (typeof CONFIG.enemies)[EnemyKind];

/** Extra state only the boss uses (see boss.ts). */
export interface BossState {
  pattern: BossPattern;
  lastPattern: BossPattern | null;
  phase: 'move' | 'windup' | 'attack' | 'recover';
  timer: number;
  shotsLeft: number;
  shotTimer: number;
  spiralAngle: number;
  summonTimer: number;
  enraged: boolean;
  /** Trailing value for the health bar's "damage taken" ghost. */
  displayHp: number;
}
export type BossPattern = 'ring' | 'volley' | 'charge' | 'spiral';

export type EnemyState = 'idle' | 'telegraph' | 'charge' | 'recover';

export class Enemy {
  readonly def: EnemyDef;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx = 0;
  vy = 0;
  /** Knockback velocity, decays independently of steering. */
  kbx = 0;
  kby = 0;
  /** Velocity the AI wants this tick; integrated with `accel`. */
  desiredX = 0;
  desiredY = 0;
  accel: number;
  readonly radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  /** Facing (radians), for rendering and aiming. */
  angle = 0;
  prevAngle = 0;
  age = 0;
  flash = 0;
  stun = 0;
  dead = false;
  /** Set by the arena resolver when the enemy touched a wall/obstacle this tick. */
  blocked = false;

  // Generic AI scratch state.
  state: EnemyState = 'idle';
  timer = 0;
  cooldown = 0;
  dirX = 0;
  dirY = 0;
  strafe = 1;
  readonly seed = Math.random() * 1000;

  boss: BossState | null = null;

  constructor(
    readonly kind: EnemyKind,
    x: number,
    y: number,
    hpScale = 1,
    speedScale = 1,
  ) {
    this.def = CONFIG.enemies[kind];
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.radius = this.def.radius;
    this.hp = this.maxHp = this.def.hp * hpScale;
    this.speed = this.def.speed * speedScale;
    this.accel = this.def.accel;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
  }

  /** Set desired velocity toward a unit direction at `speedFactor` × base speed. */
  steer(dx: number, dy: number, speedFactor = 1): void {
    this.desiredX = dx * this.speed * speedFactor;
    this.desiredY = dy * this.speed * speedFactor;
  }
}

// ------------------------------------------------------------------ render

/** Stroke the current path as a neon line: wide faint halo + bright core (cheaper than shadowBlur). */
export function neonStroke(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = width * 3.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = width;
  ctx.stroke();
}

function polygon(ctx: CanvasRenderingContext2D, sides: number, r: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy, alpha: number): void {
  const x = lerp(e.prevX, e.x, alpha);
  const y = lerp(e.prevY, e.y, alpha);
  const angle = lerpAngle(e.prevAngle, e.angle, alpha);
  const r = e.radius;
  const color = e.flash > 0 ? '#ffffff' : e.def.color;
  const t = e.age;

  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (e.kind) {
    case 'drone': {
      ctx.rotate(t * 4 + e.seed);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = (i / 8) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 43, 214, 0.15)';
      ctx.fill();
      neonStroke(ctx, color, 2);
      break;
    }
    case 'gunner': {
      ctx.rotate(angle);
      polygon(ctx, 6, r, 0);
      ctx.fillStyle = 'rgba(255, 154, 31, 0.14)';
      ctx.fill();
      neonStroke(ctx, color, 2);
      // Barrel.
      ctx.beginPath();
      ctx.moveTo(r * 0.3, 0);
      ctx.lineTo(r * 1.45, 0);
      neonStroke(ctx, color, 3);
      // Charging core while telegraphing a shot.
      const charge = e.state === 'telegraph' ? 1 - e.timer / CONFIG.enemies.gunner.telegraph : 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = e.def.color;
      ctx.globalAlpha = 0.5 + charge * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.25 + charge * 0.35), 0, TAU);
      ctx.fill();
      break;
    }
    case 'splitter': {
      ctx.rotate(t * 1.2 + e.seed);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = 'rgba(125, 255, 77, 0.12)';
      ctx.fill();
      neonStroke(ctx, color, 2);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      neonStroke(ctx, color, 1.5);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-r * 0.45, 0, r * 0.2, 0, TAU);
      ctx.arc(r * 0.45, 0, r * 0.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'splitling': {
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0);
      ctx.lineTo(-r * 0.8, r * 0.85);
      ctx.lineTo(-r * 0.8, -r * 0.85);
      ctx.closePath();
      ctx.fillStyle = 'rgba(184, 255, 77, 0.15)';
      ctx.fill();
      neonStroke(ctx, color, 2);
      break;
    }
    case 'bruiser': {
      const B = CONFIG.enemies.bruiser;
      if (e.state === 'telegraph') {
        // Aim line showing where the charge will go.
        const k = 1 - e.timer / B.chargeTelegraph;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = B.color;
        ctx.globalAlpha = 0.25 + 0.5 * k * (0.5 + 0.5 * Math.sin(t * 40));
        ctx.lineWidth = r * 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(e.dirX * B.chargeRange, e.dirY * B.chargeRange);
        ctx.stroke();
        ctx.restore();
      }
      ctx.rotate(angle);
      const shake = e.state === 'telegraph' ? Math.sin(t * 60) * 2 : 0;
      ctx.translate(shake, 0);
      polygon(ctx, 8, r, Math.PI / 8);
      ctx.fillStyle = 'rgba(255, 51, 85, 0.16)';
      ctx.fill();
      neonStroke(ctx, color, 3);
      // Armour plates + "eye" slit facing forward.
      polygon(ctx, 8, r * 0.62, Math.PI / 8);
      neonStroke(ctx, color, 1.5);
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.35);
      ctx.lineTo(r * 0.85, 0);
      ctx.lineTo(r * 0.5, r * 0.35);
      neonStroke(ctx, e.state === 'charge' ? '#ffffff' : color, 2.5);
      break;
    }
    case 'boss':
      // Drawn by boss.ts.
      break;
  }
  ctx.restore();

  if (e.stun > 0) {
    ctx.save();
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}
