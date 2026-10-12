import { COLORS, CONFIG } from '../config';
import { lerp } from '../core/math';
import { BOSS_NAME } from '../entities/boss';
import type { Player } from '../entities/player';
import { Action, Axis } from '../input/bindings';
import type { Input } from '../input/input';
import { WEAPONS } from '../weapons/definitions';
import type { World } from '../world/world';
import { renderPrompts, type PromptEntry } from './prompts';
import { font, glowText } from './text';

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

export function renderHud(ctx: CanvasRenderingContext2D, world: World, input: Input): void {
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;
  const player = world.player;

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

  // Wave number next to the health pips.
  if (world.waves.wave > 0) {
    glowText(ctx, `WAVE ${world.waves.wave}`, 56 + player.maxHealth * 22 + 10, 20, { size: 14, color: COLORS.purple, blur: 6 });
  }

  renderScore(ctx, world);
  renderBossBar(ctx, world);

  // Weapon (top-right).
  const def = WEAPONS[player.weapon];
  glowText(ctx, `${def.name}  ${def.ammo === null ? '∞' : def.ammo}`, W - 56, 20, { size: 15, color: def.color, align: 'right' });

  // Control prompts (bottom). Touch players get the on-screen controls instead.
  if (input.device === 'touch') return;
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

/** Score (top centre) with the combo multiplier and its countdown bar. */
function renderScore(ctx: CanvasRenderingContext2D, world: World): void {
  const W = CONFIG.view.width;
  const sc = world.score;
  const text = String(sc.score).padStart(7, '0');
  glowText(ctx, text, W / 2, 18, { size: 22, color: COLORS.white, glow: COLORS.cyan, blur: 10, align: 'center' });

  const mult = sc.multiplier;
  const x = W / 2 + 76;
  ctx.save();
  ctx.font = font(18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = mult > 1 ? COLORS.yellow : '#6f5f99';
  ctx.shadowColor = COLORS.yellow;
  ctx.shadowBlur = mult > 1 ? 10 : 0;
  ctx.fillText(`x${mult}`, x, 19);
  ctx.shadowBlur = 0;

  // Countdown until the multiplier drops, plus pips toward the next level.
  if (sc.chain > 0) {
    const bw = 44;
    const k = Math.max(0, sc.timer / sc.timerMax);
    ctx.fillStyle = 'rgba(255, 225, 77, 0.2)';
    ctx.fillRect(x, 31, bw, 3);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x, 31, bw * k, 3);
  }
  const lvl = sc.levelProgress;
  ctx.fillStyle = COLORS.yellow;
  for (let i = 0; i < CONFIG.score.killsPerLevel; i++) {
    ctx.globalAlpha = i < Math.round(lvl * CONFIG.score.killsPerLevel) ? 0.9 : 0.2;
    ctx.fillRect(x + 46 + i * 6, 15, 4, 8);
  }
  ctx.restore();
}

function renderBossBar(ctx: CanvasRenderingContext2D, world: World): void {
  const boss = world.boss;
  if (!boss || !boss.boss) return;
  const s = boss.boss;
  // Ghost bar trails behind the real one to show chunks of damage.
  s.displayHp += (boss.hp - s.displayHp) * 0.06;
  const W = CONFIG.view.width;
  const bw = 520;
  const x = (W - bw) / 2;
  const y = 64;
  const k = Math.max(0, boss.hp / boss.maxHp);
  const g = Math.max(0, s.displayHp / boss.maxHp);
  const color = s.enraged ? COLORS.red : COLORS.purple;
  const bossNo = Math.max(1, Math.round(world.waves.wave / CONFIG.waves.bossEvery));

  ctx.save();
  ctx.fillStyle = 'rgba(10, 2, 25, 0.8)';
  ctx.fillRect(x - 4, y - 4, bw + 8, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(x, y, bw * g, 10);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillRect(x, y, bw * k, 10);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 4, y - 4, bw + 8, 18);
  ctx.restore();
  glowText(ctx, `${BOSS_NAME}${bossNo}`, W / 2, y + 26, { size: 13, color, align: 'center', blur: 6 });
}

/** Big centre-screen "WAVE X" banner during the intro, "WAVE CLEAR" after. */
export function renderWaveBanner(ctx: CanvasRenderingContext2D, world: World): void {
  const waves = world.waves;
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;
  const t = waves.phaseAge;

  if (waves.phase === 'intro') {
    const total = CONFIG.waves.bannerTime;
    const inK = Math.min(1, t / 0.25);
    const outK = Math.min(1, waves.timer / 0.3);
    const a = Math.min(inK, outK);
    const scale = 1 + (1 - inK) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    // Horizontal scan bars.
    ctx.fillStyle = 'rgba(10, 2, 25, 0.65)';
    ctx.fillRect(0, H / 2 - 62, W, 124);
    ctx.fillStyle = waves.isBossWave ? COLORS.red : COLORS.magenta;
    const sweep = ((t / total) * W * 1.4) % (W * 1.4);
    ctx.fillRect(0, H / 2 - 62, W, 2);
    ctx.fillRect(0, H / 2 + 60, W, 2);
    ctx.fillRect(sweep - 200, H / 2 - 62, 200, 2);
    ctx.restore();
    glowText(ctx, `WAVE ${waves.wave}`, W / 2, H / 2 - 10, {
      size: Math.round(64 * scale),
      color: COLORS.white,
      glow: waves.isBossWave ? COLORS.red : COLORS.magenta,
      blur: 24,
      align: 'center',
      alpha: a,
    });
    const sub = waves.isBossWave ? '⚠ WARNING // BOSS SIGNATURE DETECTED ⚠' : 'INCOMING HOSTILES';
    const blink = waves.isBossWave ? 0.6 + 0.4 * Math.sin(t * 12) : 1;
    glowText(ctx, sub, W / 2, H / 2 + 38, {
      size: 16,
      color: waves.isBossWave ? COLORS.red : COLORS.cyan,
      align: 'center',
      alpha: a * blink,
    });
  } else if (waves.phase === 'cleared' && waves.wave > 0 && t < 1.6) {
    const a = Math.min(1, t / 0.2, (1.6 - t) / 0.4);
    glowText(ctx, 'WAVE CLEAR', W / 2, H / 2 - 10, { size: 44, color: COLORS.cyan, blur: 18, align: 'center', alpha: a });
  }
}
