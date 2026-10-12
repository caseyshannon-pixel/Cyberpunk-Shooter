/**
 * Offscreen-canvas helpers. Anything static (floor, grid, walls, glow sprites)
 * is drawn once at the current pixel ratio and blitted every frame — far
 * cheaper than re-filling gradients or using shadowBlur, especially on
 * fill-rate-limited mobile GPUs.
 */

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
}

/** Create a canvas sized `w×h` logical units at `scale` device pixels per unit, with the transform preset. */
export function makeLayer(w: number, h: number, scale: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { canvas, ctx, scale };
}

/** Current device-pixels-per-logical-unit of a context (its transform's x scale). */
export function currentScale(ctx: CanvasRenderingContext2D): number {
  return ctx.getTransform().a;
}

const orbCache = new Map<string, Layer>();

/**
 * A soft glowing orb sprite (halo + body + white core), cached per
 * colour/radius/scale. Draw it centred with `drawOrb`.
 */
export function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const scale = currentScale(ctx);
  const key = `${color}|${radius}|${scale}`;
  let layer = orbCache.get(key);
  if (!layer) {
    const size = radius * 4.4;
    layer = makeLayer(size, size, scale);
    const c = layer.ctx;
    const m = size / 2;
    const g = c.createRadialGradient(m, m, radius * 0.5, m, m, radius * 2.2);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.55;
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    c.globalAlpha = 1;
    c.fillStyle = color;
    c.beginPath();
    c.arc(m, m, radius, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(m, m, radius * 0.5, 0, Math.PI * 2);
    c.fill();
    if (orbCache.size > 64) orbCache.clear();
    orbCache.set(key, layer);
  }
  const s = radius * 4.4;
  ctx.drawImage(layer.canvas, x - s / 2, y - s / 2, s, s);
}
