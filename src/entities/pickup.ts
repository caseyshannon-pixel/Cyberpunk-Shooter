import { CONFIG } from '../config';
import { TAU } from '../core/math';
import { WEAPONS, type WeaponId } from '../weapons/definitions';
import { neonStroke } from './enemy';

export type SpecialPickup = 'overclock' | 'shield' | 'health' | 'emp';
export type PickupKind = Exclude<WeaponId, 'pulse'> | SpecialPickup;

const SPECIAL_LABELS: Record<SpecialPickup, string> = { overclock: '2X', shield: 'SHLD', health: '+HP', emp: 'EMP' };
export const SPECIAL_NAMES: Record<SpecialPickup, string> = {
  overclock: 'OVERCLOCK',
  shield: 'SHIELD MATRIX',
  health: 'HEALTH CHIP',
  emp: 'EMP',
};

export function isWeaponPickup(kind: PickupKind): kind is Exclude<WeaponId, 'pulse'> {
  return kind in WEAPONS;
}

export function pickupColor(kind: PickupKind): string {
  return isWeaponPickup(kind) ? WEAPONS[kind].color : CONFIG.pickups.colors[kind];
}

export function pickupName(kind: PickupKind): string {
  return isWeaponPickup(kind) ? WEAPONS[kind].name : SPECIAL_NAMES[kind];
}

export class Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age = 0;
  life: number = CONFIG.pickups.lifetime;
  readonly radius = CONFIG.pickups.radius;
  readonly seed = Math.random() * TAU;

  constructor(
    readonly kind: PickupKind,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    // Pop out of the enemy a little.
    const a = Math.random() * TAU;
    const s = 90 + Math.random() * 90;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
  }

  /** Blink when about to vanish, faster as the end nears. */
  get visible(): boolean {
    const f = CONFIG.pickups.flashTime;
    if (this.life > f) return true;
    const rate = 4 + (1 - this.life / f) * 14;
    return Math.sin(this.age * rate * Math.PI) > -0.2;
  }
}

/**
 * Weapons are drawn as diamonds, specials as hexagons, each with a short label
 * and a pulsing glow ring so they read clearly against the grid.
 */
export function renderPickup(ctx: CanvasRenderingContext2D, p: Pickup): void {
  if (!p.visible) return;
  const color = pickupColor(p.kind);
  const t = p.age;
  const bob = Math.sin(t * 3 + p.seed) * 3;
  const r = p.radius;
  const x = p.x;
  const y = p.y + bob;
  const pulse = 0.5 + 0.5 * Math.sin(t * 5 + p.seed);
  const weapon = isWeaponPickup(p.kind);

  ctx.save();
  // Ground glow + expanding pulse ring.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.12 + pulse * 0.1;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1, 0, TAU);
  ctx.fill();
  const ringK = (t * 0.9 + p.seed) % 1;
  ctx.strokeStyle = color;
  ctx.globalAlpha = (1 - ringK) * 0.6;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.2 + ringK * 1.4), 0, TAU);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.beginPath();
  if (weapon) {
    ctx.moveTo(0, -r * 1.25);
    ctx.lineTo(r * 1.25, 0);
    ctx.lineTo(0, r * 1.25);
    ctx.lineTo(-r * 1.25, 0);
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      if (i === 0) ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
      else ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
    }
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 2, 22, 0.85)';
  ctx.fill();
  ctx.lineJoin = 'round';
  neonStroke(ctx, color, 2);

  const label = weapon ? WEAPONS[p.kind as Exclude<WeaponId, 'pulse'>].short : SPECIAL_LABELS[p.kind as SpecialPickup];
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.font = `bold ${label.length > 3 ? 8 : 9}px Consolas, Menlo, 'DejaVu Sans Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}
