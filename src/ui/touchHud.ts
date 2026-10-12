import { COLORS, CONFIG } from '../config';
import { isFullscreen } from '../core/fullscreen';
import { len } from '../core/math';
import type { Player } from '../entities/player';
import type { Input } from '../input/input';
import type { TouchButton, TouchStick } from '../input/touch';
import { font } from './text';

const T = CONFIG.touch;
const KNOB_R = 26;

/** Draw the virtual sticks and buttons. Only shown while the last input was touch. */
export function renderTouchHud(ctx: CanvasRenderingContext2D, input: Input, player: Player): void {
  if (input.device !== 'touch') return;
  const tc = input.touch;
  ctx.save();
  drawStick(ctx, tc.left, T.moveHint, 'MOVE', COLORS.cyan);
  drawStick(ctx, tc.right, T.aimHint, 'AIM', COLORS.magenta);
  for (const b of tc.buttons) {
    if (!b.visible) continue;
    drawButton(ctx, b, tc.isButtonDown(b.id), player);
  }
  ctx.restore();
}

function drawStick(ctx: CanvasRenderingContext2D, s: TouchStick, hint: { x: number; y: number }, label: string, color: string): void {
  const R = T.stickRadius;
  if (!s.active) {
    // Faint hint so first-time players know where to put their thumbs.
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(hint.x, hint.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.font = font(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, hint.x, hint.y);
    ctx.globalAlpha = 1;
    return;
  }

  let kx = s.knobX - s.baseX;
  let ky = s.knobY - s.baseY;
  const d = len(kx, ky);
  if (d > R) {
    kx = (kx / d) * R;
    ky = (ky / d) * R;
  }

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(20, 5, 45, 0.6)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.baseX, s.baseY, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.75;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(s.baseX + kx, s.baseY + ky, KNOB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawButton(ctx: CanvasRenderingContext2D, b: TouchButton, down: boolean, player: Player): void {
  const color = b.id === 'dash' ? COLORS.purple : COLORS.cyan;
  ctx.globalAlpha = down ? 0.9 : 0.5;
  ctx.fillStyle = down ? 'rgba(157, 77, 255, 0.35)' : 'rgba(20, 5, 45, 0.55)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (b.id) {
    case 'dash': {
      const ready = player.dashReady;
      if (ready < 1) {
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 5, -Math.PI / 2, -Math.PI / 2 + ready * Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = ready >= 1 ? 0.95 : 0.45;
      ctx.font = font(15);
      ctx.fillText('DASH', b.x, b.y + 1);
      break;
    }
    case 'weapon':
      ctx.globalAlpha = 0.85;
      ctx.font = font(11);
      ctx.fillText('SWAP', b.x, b.y + 1);
      break;
    case 'pause':
      ctx.globalAlpha = 0.85;
      ctx.fillRect(b.x - 5, b.y - 6, 3.5, 12);
      ctx.fillRect(b.x + 1.5, b.y - 6, 3.5, 12);
      break;
    case 'fullscreen': {
      // Corner brackets: arms point inward to "expand", outward to "collapse".
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      const o = 6;
      const k = 3.5;
      const collapse = isFullscreen();
      ctx.beginPath();
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        const reach = collapse ? o - k : o;
        const cx = b.x + sx * reach;
        const cy = b.y + sy * reach;
        const arm = collapse ? k : -k;
        ctx.moveTo(cx + sx * arm, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * arm);
      }
      ctx.stroke();
      break;
    }
  }
  ctx.globalAlpha = 1;
}
