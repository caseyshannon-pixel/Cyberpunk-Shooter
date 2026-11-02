import { CONFIG } from '../config';
import { TAU } from '../core/math';
import { MODS, stacksOf, type ModStacks } from '../run/mods';
import type { Reward } from '../run/rewards';
import { font } from '../ui/text';
import { WEAPONS } from '../weapons/definitions';
import { neonStroke } from './enemy';

const RADIUS = 22;

/** Display details of a reward. A mod's name carries the stack it would become, e.g. 'OVERVOLT 2/4'. */
export function rewardInfo(r: Reward, stacks: ModStacks): { name: string; blurb: string; color: string; short: string } {
  if (r.kind === 'weapon') {
    const d = WEAPONS[r.id];
    return { name: d.name, blurb: d.blurb ?? '', color: d.color, short: d.short };
  }
  const m = MODS[r.id];
  return { name: `${m.name} ${stacksOf(stacks, r.id) + 1}/${m.max}`, blurb: m.blurb, color: m.color, short: m.short };
}

/**
 * A reward on the floor: stand on it for `CONFIG.run.takeTime` seconds to
 * take it (a ring fills up). Works the same for every input device.
 */
export class Pedestal {
  /** Seconds the player has stood on it without stepping off. */
  hold = 0;
  age = 0;
  /** Only counts once the player has been off it, so standing where it appears doesn't pick it. */
  private armed = false;
  readonly radius = RADIUS;

  constructor(
    public reward: Reward,
    public x: number,
    public y: number,
  ) {}

  /** Advance by `dt` with the player at (px, py); returns true once it has been taken. */
  update(dt: number, px: number, py: number, pr: number): boolean {
    this.age += dt;
    const r = this.radius + pr;
    if ((px - this.x) ** 2 + (py - this.y) ** 2 > r * r) {
      this.hold = 0;
      this.armed = true;
      return false;
    }
    if (!this.armed) return false;
    this.hold += dt;
    return this.hold >= CONFIG.run.takeTime;
  }

  /** True if the player is close enough to read what it is. */
  near(px: number, py: number): boolean {
    return (px - this.x) ** 2 + (py - this.y) ** 2 < 90 * 90;
  }
}

/** Hexagonal plate with the reward hovering over it (weapons as diamonds, mods as chips), and the take ring. */
export function renderPedestal(ctx: CanvasRenderingContext2D, p: Pedestal): void {
  const info = rewardInfo(p.reward, {});
  const r = p.radius;
  const bob = Math.sin(p.age * 3 + p.x) * 3;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Plate.
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(8, 2, 22, 0.85)';
  ctx.fill();
  ctx.globalAlpha = 0.6;
  neonStroke(ctx, info.color, 1.5);

  // Take ring.
  const k = Math.min(1, p.hold / CONFIG.run.takeTime);
  if (k > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, -Math.PI / 2, -Math.PI / 2 + k * TAU);
    neonStroke(ctx, '#ffffff', 3);
  }

  ctx.translate(0, bob - 4);
  const d = r * 0.75;
  ctx.beginPath();
  if (p.reward.kind === 'weapon') {
    ctx.moveTo(0, -d);
    ctx.lineTo(d, 0);
    ctx.lineTo(0, d);
    ctx.lineTo(-d, 0);
    ctx.closePath();
  } else {
    ctx.rect(-d * 1.15, -d * 0.7, d * 2.3, d * 1.4);
  }
  ctx.fillStyle = 'rgba(8, 2, 22, 0.9)';
  ctx.fill();
  neonStroke(ctx, info.color, 2);
  ctx.fillStyle = info.color;
  ctx.font = font(9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.short, 0, 1);
  ctx.restore();
}
