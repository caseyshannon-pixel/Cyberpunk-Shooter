import { VIEW } from '../core/view';
import { currentScale, makeLayer, type Layer } from './cache';

let cached: { layer: Layer; key: string } | null = null;

/**
 * Subtle CRT overlay drawn over the finished frame: scanlines + vignette
 * (cached as one layer), a faint flicker, and a slow rolling bright band.
 */
export function renderCrt(ctx: CanvasRenderingContext2D, time: number): void {
  const W = VIEW.width;
  const H = VIEW.height;
  const scale = currentScale(ctx);
  const key = `${W}|${scale}`;
  if (!cached || cached.key !== key) cached = { layer: buildOverlay(W, H, scale), key };

  ctx.save();
  // Tiny brightness flicker, like an old tube.
  ctx.globalAlpha = 0.92 + Math.sin(time * 60) * 0.04 + Math.sin(time * 7.3) * 0.04;
  ctx.drawImage(cached.layer.canvas, 0, 0, W, H);

  // Rolling refresh band.
  const bandH = 140;
  const y = ((time * 70) % (H + bandH * 2)) - bandH;
  const g = ctx.createLinearGradient(0, y, 0, y + bandH);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(180,220,255,0.035)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, bandH);
  ctx.restore();
}

function buildOverlay(W: number, H: number, scale: number): Layer {
  const layer = makeLayer(W, H, scale);
  const c = layer.ctx;
  // Scanlines: a dark line every 3 logical pixels.
  c.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  // Vignette: darker, slightly purple corners.
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.58);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(8,0,20,0.55)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  return layer;
}
