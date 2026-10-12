import { COLORS } from '../config';

export const FONT_FAMILY = `'Consolas', 'Menlo', 'DejaVu Sans Mono', 'Courier New', monospace`;

/** Seconds → "m:ss" (or "h:mm:ss" past an hour). */
export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function font(size: number, weight: 'normal' | 'bold' = 'bold'): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

export interface GlowTextOptions {
  size?: number;
  color?: string;
  glow?: string;
  blur?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  weight?: 'normal' | 'bold';
}

export function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: GlowTextOptions = {}): void {
  ctx.save();
  ctx.font = font(o.size ?? 16, o.weight ?? 'bold');
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color ?? COLORS.white;
  ctx.shadowColor = o.glow ?? o.color ?? COLORS.cyan;
  ctx.shadowBlur = o.blur ?? 10;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw a key-cap / button glyph box with a label. Returns the width used so
 * callers can lay out prompt rows.
 */
export function keyCap(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, color: string = COLORS.cyan, size = 14): number {
  ctx.save();
  ctx.font = font(size);
  const w = Math.max(size * 1.7, ctx.measureText(label).width + size * 0.9);
  const h = size * 1.6;
  ctx.fillStyle = 'rgba(10, 2, 30, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(x, y - h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + 1);
  ctx.restore();
  return w;
}
