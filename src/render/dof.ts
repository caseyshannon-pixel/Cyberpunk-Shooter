import { VIEW } from '../core/view';
import { blit, buffer, fit, postFxAvailable, type Buffer } from './bloom';

let quarter: Buffer | null = null;
let eighth: Buffer | null = null;
let mask: Buffer | null = null;

/**
 * Tilt-shift depth of field for the HD-2D camera: the top of the frame
 * (skyline and far wall) is blurred, fading to sharp by `topEnd`, and so is
 * the band below `bottomStart` (the near wall). The middle, where the game
 * is played, stays crisp. The blur comes from bilinear-upscaling a 1/8-size
 * copy of the frame; a gradient mask limits it to the two bands.
 */
export function applyTiltShift(ctx: CanvasRenderingContext2D, topEnd: number, bottomStart: number): void {
  if (!postFxAvailable()) return;
  const src = ctx.canvas;
  if (!quarter || !eighth || !mask) {
    quarter = buffer();
    eighth = buffer();
    mask = buffer();
  }
  fit(quarter, Math.max(1, src.width >> 2), Math.max(1, src.height >> 2));
  blit(quarter, src);
  fit(eighth, Math.max(1, src.width >> 3), Math.max(1, src.height >> 3));
  blit(eighth, quarter.canvas);

  // The mask only needs to be as sharp as the blur it carries: quarter size.
  const mw = quarter.canvas.width;
  const mh = quarter.canvas.height;
  fit(mask, mw, mh);
  blit(mask, eighth.canvas);
  const c = mask.ctx;
  const H = VIEW.height;
  const t1 = Math.min(0.49, Math.max(0.01, topEnd / H));
  const t2 = Math.max(t1 + 0.01, Math.min(0.99, bottomStart / H));
  const g = c.createLinearGradient(0, 0, 0, mh);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(t1, 'rgba(0,0,0,0)');
  g.addColorStop(t2, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  c.globalCompositeOperation = 'destination-in';
  c.fillStyle = g;
  c.fillRect(0, 0, mw, mh);
  c.globalCompositeOperation = 'source-over';

  // Only the two bands need compositing.
  const topPx = Math.ceil(t1 * src.height);
  const botPx = Math.floor(t2 * src.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  const k = mh / src.height;
  ctx.drawImage(mask.canvas, 0, 0, mw, topPx * k, 0, 0, src.width, topPx);
  ctx.drawImage(mask.canvas, 0, botPx * k, mw, mh - botPx * k, 0, botPx, src.width, src.height - botPx);
  ctx.restore();
}
