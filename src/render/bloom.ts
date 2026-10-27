/**
 * Cheap bloom for Canvas 2D (no shaders, no ctx.filter — Safari lacks it):
 * shrink the frame to 1/4 size, multiply it by itself so only bright neon
 * survives (a soft threshold), shrink again to 1/8 and 1/16, sum the three
 * levels at 1/4 size and add that over the frame. Bilinear upscaling of the
 * small buffers does the blurring; only the final blit touches every pixel.
 */

export interface Buffer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function buffer(): Buffer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  return { canvas, ctx };
}

let levels: Buffer[] | null = null;
let raw: Buffer | null = null;
let sum: Buffer | null = null;

export function fit(b: Buffer, w: number, h: number): void {
  if (b.canvas.width === w && b.canvas.height === h) return;
  b.canvas.width = w;
  b.canvas.height = h;
}

/** Copy `src` into `dst`, scaled to fill it. */
export function blit(dst: Buffer, src: HTMLCanvasElement): void {
  const c = dst.ctx;
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.clearRect(0, 0, dst.canvas.width, dst.canvas.height);
  c.drawImage(src, 0, 0, dst.canvas.width, dst.canvas.height);
}

/**
 * Safety net for weak GPUs: if frames keep running long (below ~40 fps) for a
 * couple of seconds, the full-screen post effects (bloom, and the HD-2D
 * depth of field) switch themselves off for the rest of the session.
 */
let slowFrames = 0;
let disabled = false;

/** False once the frame-pace safety net has switched post effects off. */
export function postFxAvailable(): boolean {
  return !disabled;
}

export function trackFramePace(frameDt: number): void {
  // Ignore single hitches and returning from a background tab.
  if (disabled || frameDt <= 0 || frameDt > 0.25) return;
  slowFrames = frameDt > 1 / 40 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
  if (slowFrames > 120) disabled = true;
}

/** Weight of each level (1/4, 1/8, 1/16) — the wider the blur, the stronger. */
const WEIGHTS = [0.32, 0.45, 0.55];

export function applyBloom(ctx: CanvasRenderingContext2D, strength: number): void {
  if (strength <= 0 || disabled) return;
  const src = ctx.canvas;
  if (!levels || !raw || !sum) {
    raw = buffer();
    sum = buffer();
    levels = [buffer(), buffer(), buffer()];
  }
  const w = Math.max(1, Math.round(src.width / 4));
  const h = Math.max(1, Math.round(src.height / 4));
  fit(raw, w, h);
  blit(raw, src);

  // Soft threshold: x² keeps saturated neon and crushes the dark floor.
  const l0 = levels[0];
  fit(l0, w, h);
  blit(l0, raw.canvas);
  l0.ctx.globalCompositeOperation = 'multiply';
  l0.ctx.drawImage(raw.canvas, 0, 0);
  l0.ctx.globalCompositeOperation = 'source-over';

  for (let i = 1; i < levels.length; i++) {
    fit(levels[i], Math.max(1, w >> i), Math.max(1, h >> i));
    blit(levels[i], levels[i - 1].canvas);
  }

  fit(sum, w, h);
  const c = sum.ctx;
  c.clearRect(0, 0, w, h);
  c.globalCompositeOperation = 'lighter';
  c.imageSmoothingEnabled = true;
  for (let i = 0; i < levels.length; i++) {
    c.globalAlpha = Math.min(1, WEIGHTS[i] * strength);
    c.drawImage(levels[i].canvas, 0, 0, w, h);
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sum.canvas, 0, 0, src.width, src.height);
  ctx.restore();
}
