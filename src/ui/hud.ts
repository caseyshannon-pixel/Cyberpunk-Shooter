import { COLORS, CONFIG } from '../config';
import { lerp } from '../core/math';
import type { Player } from '../entities/player';
import { Action, Axis } from '../input/bindings';
import type { Input } from '../input/input';
import { WEAPONS } from '../weapons/definitions';
import { renderPrompts, type PromptEntry } from './prompts';
import { glowText } from './text';

const GAMEPLAY_PROMPTS_PAD: PromptEntry[] = [
  { axis: Axis.MOVE, label: 'MOVE' },
  { axis: Axis.AIM, label: 'AIM + FIRE' },
  { action: Action.FIRE, label: 'FIRE' },
  { action: Action.DASH, label: 'DASH' },
  { action: Action.PAUSE, label: 'PAUSE' },
];

const GAMEPLAY_PROMPTS_KB: PromptEntry[] = [
  { axis: Axis.MOVE, label: 'MOVE' },
  { axis: Axis.AIM, label: 'AIM' },
  { action: Action.FIRE, label: 'FIRE' },
  { action: Action.DASH, label: 'DASH' },
  { action: Action.PAUSE, label: 'PAUSE' },
];

export function renderHud(ctx: CanvasRenderingContext2D, player: Player, input: Input): void {
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;

  // Health pips (top-left).
  ctx.save();
  for (let i = 0; i < player.maxHealth; i++) {
    const x = 56 + i * 22;
    const y = 20;
    const full = i < player.health;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 7);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = full ? 10 : 0;
    if (full) {
      ctx.fillStyle = COLORS.magenta;
      ctx.fill();
    }
    ctx.stroke();
  }
  ctx.restore();

  // Weapon (top-right).
  const def = WEAPONS[player.weapon];
  glowText(ctx, `${def.name}  ${def.ammo === null ? '∞' : def.ammo}`, W - 56, 20, { size: 15, color: def.color, align: 'right' });

  // Control prompts (bottom).
  renderPrompts(ctx, input.device === 'gamepad' ? GAMEPLAY_PROMPTS_PAD : GAMEPLAY_PROMPTS_KB, input, W / 2, H - 20, 'center', 12, 0.75);
}

/** Dash cooldown arc drawn around the player while recharging. */
export function renderDashRing(ctx: CanvasRenderingContext2D, player: Player, alpha: number): void {
  const ready = player.dashReady;
  if (ready >= 1) return;
  const x = lerp(player.prevX, player.x, alpha);
  const y = lerp(player.prevY, player.y, alpha);
  ctx.save();
  ctx.strokeStyle = COLORS.purple;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, player.radius + 9, -Math.PI / 2, -Math.PI / 2 + ready * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Mouse crosshair, or a stick-driven reticle in front of the player. */
export function renderReticle(ctx: CanvasRenderingContext2D, player: Player, input: Input, alpha: number, time: number): void {
  ctx.save();
  ctx.shadowBlur = 10;
  if (input.device === 'keyboard') {
    if (!input.mouseInside) {
      ctx.restore();
      return;
    }
    const { x, y } = input.mouse;
    ctx.strokeStyle = COLORS.cyan;
    ctx.shadowColor = COLORS.cyan;
    ctx.lineWidth = 2;
    const r = 9 + Math.sin(time * 6) * 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3));
      ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  } else {
    const px = lerp(player.prevX, player.x, alpha);
    const py = lerp(player.prevY, player.y, alpha);
    const d = CONFIG.input.padReticleDistance;
    const a = player.aimAngle;
    const x = px + Math.cos(a) * d;
    const y = py + Math.sin(a) * d;
    ctx.globalAlpha = player.aiming ? 0.95 : 0.3;
    ctx.strokeStyle = COLORS.magenta;
    ctx.shadowColor = COLORS.magenta;
    ctx.lineWidth = 2;
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(4, 0);
    ctx.lineTo(-6, 8);
    ctx.stroke();
  }
  ctx.restore();
}
