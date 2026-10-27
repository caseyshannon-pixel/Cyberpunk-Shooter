import { COLORS, CONFIG } from '../config';
import { settings } from '../settings';
import type { Arena, Obstacle } from '../world/arena';
import { currentScale, makeLayer, type Layer } from './cache';

/**
 * HD 2.5D rendering. The camera stays straight top-down, but a virtual camera
 * sits `cameraHeight` above an "eye" point on the floor: anything with height
 * is scaled away from the eye (walls lean outward and show the faces turned
 * toward it). The eye drifts with the player, so the geometry shifts with a
 * gentle parallax. Gameplay is unchanged: collisions use the floor footprint.
 */

const D = CONFIG.depth;

export interface Eye {
  x: number;
  y: number;
}

export function hdEnabled(): boolean {
  return settings.get().hd;
}

/** Screen-space scale (around the eye) of a point `h` above the floor. */
export function lift(h: number): number {
  return D.cameraHeight / (D.cameraHeight - h);
}

// ------------------------------------------------------------------ colour helpers

const rgbCache = new Map<string, string>();

/** `#rrggbb` → `r,g,b` (cached), for building rgba() strings. */
function rgb(hex: string): string {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    rgbCache.set(hex, v);
  }
  return v;
}

function rgba(hex: string, a: number): string {
  return `rgba(${rgb(hex)},${a.toFixed(3)})`;
}

// Light comes from the upper left; a face's brightness follows its normal.
const LX = -D.shadowX / Math.hypot(D.shadowX, D.shadowY);
const LY = -D.shadowY / Math.hypot(D.shadowX, D.shadowY);
function shade(nx: number, ny: number): number {
  return 0.1 + 0.42 * Math.max(0, nx * LX + ny * LY);
}

// ------------------------------------------------------------------ sprites

const spriteCache = new Map<string, Layer>();
const SPRITE = 64;

/** A soft radial blob sprite (colour → transparent), cached per colour and pixel scale. */
function blob(ctx: CanvasRenderingContext2D, color: string, falloff: number): Layer {
  const scale = currentScale(ctx);
  const key = `${color}|${falloff}|${scale}`;
  let layer = spriteCache.get(key);
  if (!layer) {
    layer = makeLayer(SPRITE, SPRITE, scale);
    const m = SPRITE / 2;
    const g = layer.ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(falloff, rgba(color, 0.35));
    g.addColorStop(1, rgba(color, 0));
    layer.ctx.fillStyle = g;
    layer.ctx.fillRect(0, 0, SPRITE, SPRITE);
    if (spriteCache.size > 96) spriteCache.clear();
    spriteCache.set(key, layer);
  }
  return layer;
}

/** Coloured light pooled on the floor. Call with `globalCompositeOperation = 'lighter'`. */
export function drawLight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.drawImage(blob(ctx, color, 0.3).canvas, x - r, y - r, r * 2, r * 2);
}

/** Soft contact shadow for something of radius `r` hovering `h` above the floor. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, alpha = 1): void {
  // Higher things cast larger, fainter, further-offset shadows.
  const R = r * (1.15 + h * 0.012);
  ctx.globalAlpha = alpha * Math.max(0.25, 0.75 - h * 0.008);
  ctx.drawImage(blob(ctx, '#000000', 0.55).canvas, x + D.shadowX * h - R, y + D.shadowY * h - R, R * 2, R * 2);
}

// ------------------------------------------------------------------ static ground shading

let ground: { layer: Layer; arena: Arena; key: string } | null = null;

/**
 * Cached floor overlay for HD mode: shadows cast by the walls and obstacles,
 * plus faint neon reflections where they meet the floor.
 */
export function renderGroundShading(ctx: CanvasRenderingContext2D, arena: Arena, viewW: number, viewH: number): void {
  const scale = currentScale(ctx);
  const key = `${scale}|${viewW}`;
  if (!ground || ground.arena !== arena || ground.key !== key) {
    const layer = makeLayer(viewW, viewH, scale);
    buildGround(layer.ctx, arena, scale);
    ground = { layer, arena, key };
  }
  ctx.drawImage(ground.layer.canvas, 0, 0, viewW, viewH);
}

function buildGround(c: CanvasRenderingContext2D, arena: Arena, scale: number): void {
  const b = arena.bounds;
  c.save();
  c.beginPath();
  c.rect(b.x, b.y, b.w, b.h);
  c.clip();

  // Outer walls shade the floor along the top and left edges.
  const hw = D.wallHeight;
  const top = c.createLinearGradient(0, b.y, 0, b.y + D.shadowY * hw * 1.6);
  top.addColorStop(0, 'rgba(0,0,0,0.6)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = top;
  c.fillRect(b.x, b.y, b.w, D.shadowY * hw * 1.6);
  const left = c.createLinearGradient(b.x, 0, b.x + D.shadowX * hw * 1.8, 0);
  left.addColorStop(0, 'rgba(0,0,0,0.5)');
  left.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = left;
  c.fillRect(b.x, b.y, D.shadowX * hw * 1.8, b.h);

  // Neon reflection hugging the base of the walls.
  c.globalCompositeOperation = 'lighter';
  const glow = 26;
  const edges: [number, number, number, number, number, number, number, number][] = [
    [b.x, b.y, b.w, glow, 0, b.y, 0, b.y + glow],
    [b.x, b.y + b.h - glow, b.w, glow, 0, b.y + b.h, 0, b.y + b.h - glow],
    [b.x, b.y, glow, b.h, b.x, 0, b.x + glow, 0],
    [b.x + b.w - glow, b.y, glow, b.h, b.x + b.w, 0, b.x + b.w - glow, 0],
  ];
  for (const [x, y, w, h, gx0, gy0, gx1, gy1] of edges) {
    const g = c.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, rgba(COLORS.wall, 0.16));
    g.addColorStop(1, rgba(COLORS.wall, 0));
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }
  c.globalCompositeOperation = 'source-over';

  // Obstacle drop shadows: the footprint swept along the light direction, blurred once here.
  c.shadowColor = 'rgba(0,0,0,0.85)';
  c.shadowBlur = 14 * scale;
  c.fillStyle = 'rgba(0,0,0,0.55)';
  for (const o of arena.obstacles) {
    const h = obstacleHeight(o);
    const sx = D.shadowX * h;
    const sy = D.shadowY * h;
    c.beginPath();
    c.moveTo(o.x, o.y);
    c.lineTo(o.x + o.w, o.y);
    c.lineTo(o.x + o.w + sx, o.y + sy);
    c.lineTo(o.x + o.w + sx, o.y + o.h + sy);
    c.lineTo(o.x + sx, o.y + o.h + sy);
    c.lineTo(o.x, o.y + o.h);
    c.closePath();
    c.fill();
  }

  // Each obstacle's neon edge reflects faintly on the floor around it.
  c.globalCompositeOperation = 'lighter';
  for (const o of arena.obstacles) {
    const edge = obstacleEdge(o);
    c.shadowColor = edge;
    c.shadowBlur = 22 * scale;
    c.strokeStyle = rgba(edge, 0.35);
    c.lineWidth = 3;
    c.strokeRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4);
  }
  c.restore();
}

// ------------------------------------------------------------------ extruded geometry

export function obstacleHeight(o: Obstacle): number {
  return o.kind === 'pillar' ? D.pillarHeight : D.crateHeight;
}

function obstacleEdge(o: Obstacle): string {
  return o.kind === 'pillar' ? COLORS.obstacleEdge : COLORS.purple;
}

/** Point (x, y) on the floor raised by height h, as seen from the eye. */
function px(eye: Eye, x: number, s: number): number {
  return eye.x + (x - eye.x) * s;
}
function py(eye: Eye, y: number, s: number): number {
  return eye.y + (y - eye.y) * s;
}

function quad(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx, dy);
  ctx.closePath();
}

/**
 * One vertical face from floor edge (x0,y0)-(x1,y1) up to height h: a dark
 * slab lit by its normal, fading darker toward the floor, with neon light
 * strips across it.
 */
function face(
  ctx: CanvasRenderingContext2D,
  eye: Eye,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  h: number,
  nx: number,
  ny: number,
  color: string,
  strips: readonly number[],
  glow: number,
): void {
  const s = lift(h);
  const tx0 = px(eye, x0, s);
  const ty0 = py(eye, y0, s);
  const tx1 = px(eye, x1, s);
  const ty1 = py(eye, y1, s);
  quad(ctx, x0, y0, x1, y1, tx1, ty1, tx0, ty0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0318';
  ctx.fill();
  const g = ctx.createLinearGradient((x0 + x1) / 2, (y0 + y1) / 2, (tx0 + tx1) / 2, (ty0 + ty1) / 2);
  g.addColorStop(0, rgba(color, 0.02));
  g.addColorStop(1, rgba(color, shade(nx, ny)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.55 * glow;
  ctx.stroke();

  if (strips.length) {
    ctx.beginPath();
    for (const f of strips) {
      const k = lift(h * f);
      ctx.moveTo(px(eye, x0, k), py(eye, y0, k));
      ctx.lineTo(px(eye, x1, k), py(eye, y1, k));
    }
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7 * glow;
    ctx.stroke();
  }
}

const PILLAR_STRIPS = [0.3, 0.62] as const;
const CRATE_STRIPS = [0.5] as const;
const NO_STRIPS: readonly number[] = [];

/** Neon rim: faint wide halo + bright core (no shadowBlur, it's per frame). */
function rim(ctx: CanvasRenderingContext2D, color: string, width: number, alpha: number): void {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.25 * alpha;
  ctx.lineWidth = width * 3.5;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * The arena's outer walls, seen from inside: four inward faces rising from
 * the arena edge, topped with a neon-rimmed cap. They lean outward, so they
 * never cover the play area and can be drawn under everything.
 */
export function renderOuterWalls(ctx: CanvasRenderingContext2D, arena: Arena, eye: Eye, time: number): void {
  const b = arena.bounds;
  const h = D.wallHeight;
  const s = lift(h);
  const glow = 0.82 + Math.sin(time * 2) * 0.18;
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const wall = COLORS.wall;

  ctx.save();
  ctx.lineJoin = 'round';
  // North wall faces south, and so on.
  face(ctx, eye, x0, y0, x1, y0, h, 0, 1, wall, NO_STRIPS, glow);
  face(ctx, eye, x0, y1, x1, y1, h, 0, -1, wall, NO_STRIPS, glow);
  face(ctx, eye, x0, y0, x0, y1, h, 1, 0, wall, NO_STRIPS, glow);
  face(ctx, eye, x1, y0, x1, y1, h, -1, 0, wall, NO_STRIPS, glow);

  // Panel seams up each wall and a light strip at mid-height.
  const k = lift(h * 0.55);
  ctx.beginPath();
  for (let x = x0 + 80; x < x1 - 20; x += 80) {
    ctx.moveTo(x, y0);
    ctx.lineTo(px(eye, x, s), py(eye, y0, s));
    ctx.moveTo(x, y1);
    ctx.lineTo(px(eye, x, s), py(eye, y1, s));
  }
  for (let y = y0 + 80; y < y1 - 20; y += 80) {
    ctx.moveTo(x0, y);
    ctx.lineTo(px(eye, x0, s), py(eye, y, s));
    ctx.moveTo(x1, y);
    ctx.lineTo(px(eye, x1, s), py(eye, y, s));
  }
  ctx.strokeStyle = wall;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.22 * glow;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(px(eye, x0, k), py(eye, y0, k), (x1 - x0) * k, (y1 - y0) * k);
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35 * glow;
  ctx.stroke();

  // Cap: a band from the top edge outward.
  const tx = px(eye, x0, s);
  const ty = py(eye, y0, s);
  const tw = (x1 - x0) * s;
  const th = (y1 - y0) * s;
  const t = D.wallThickness;
  ctx.beginPath();
  ctx.rect(tx - t, ty - t, tw + t * 2, th + t * 2);
  ctx.rect(tx, ty, tw, th);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#14062e';
  ctx.fill('evenodd');
  ctx.beginPath();
  ctx.rect(tx, ty, tw, th);
  rim(ctx, wall, 2.5, glow);
  ctx.beginPath();
  ctx.rect(tx - t, ty - t, tw + t * 2, th + t * 2);
  ctx.strokeStyle = wall;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35 * glow;
  ctx.stroke();

  // Base line where the wall meets the floor.
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = wall;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7 * glow;
  ctx.stroke();
  ctx.restore();
}

/** Screen rect of an obstacle's top face. */
function topRect(o: Obstacle, eye: Eye): { x: number; y: number; w: number; h: number; s: number } {
  const s = lift(obstacleHeight(o));
  return { x: px(eye, o.x, s), y: py(eye, o.y, s), w: o.w * s, h: o.h * s, s };
}

/**
 * Pillars and crates as extruded blocks. Drawn after the entities so their
 * raised tops correctly cover whatever is behind them (seen from the eye).
 */
export function renderStructures(ctx: CanvasRenderingContext2D, arena: Arena, eye: Eye, time: number): void {
  const glow = 0.82 + Math.sin(time * 2) * 0.18;
  ctx.save();
  ctx.lineJoin = 'round';
  for (const o of arena.obstacles) {
    const h = obstacleHeight(o);
    const edge = obstacleEdge(o);
    const strips = o.kind === 'pillar' ? PILLAR_STRIPS : CRATE_STRIPS;
    const x0 = o.x;
    const y0 = o.y;
    const x1 = o.x + o.w;
    const y1 = o.y + o.h;

    // Only the faces turned toward the eye are visible.
    if (eye.y < y0) face(ctx, eye, x0, y0, x1, y0, h, 0, -1, edge, strips, glow);
    if (eye.y > y1) face(ctx, eye, x0, y1, x1, y1, h, 0, 1, edge, strips, glow);
    if (eye.x < x0) face(ctx, eye, x0, y0, x0, y1, h, -1, 0, edge, strips, glow);
    if (eye.x > x1) face(ctx, eye, x1, y0, x1, y1, h, 1, 0, edge, strips, glow);

    // Top face: same artwork as the flat version, scaled about the eye.
    const t = topRect(o, eye);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.obstacleFill;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    const lit = ctx.createLinearGradient(t.x, t.y, t.x + t.w, t.y + t.h);
    lit.addColorStop(0, rgba(edge, 0.16));
    lit.addColorStop(1, rgba(edge, 0.02));
    ctx.fillStyle = lit;
    ctx.fillRect(t.x, t.y, t.w, t.h);

    ctx.save();
    ctx.translate(eye.x, eye.y);
    ctx.scale(t.s, t.s);
    ctx.translate(-eye.x, -eye.y);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (o.kind === 'crate') {
      for (let k = -o.h; k < o.w; k += 12) {
        ctx.moveTo(Math.max(x0, x0 + k), y0 + Math.max(0, -k));
        ctx.lineTo(Math.min(x1, x0 + k + o.h), y0 + Math.min(o.h, o.w - k));
      }
    } else {
      ctx.rect(x0 + 12, y0 + 12, o.w - 24, o.h - 24);
    }
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.rect(t.x + 1, t.y + 1, t.w - 2, t.h - 2);
    rim(ctx, edge, 2, glow);
  }
  ctx.restore();
}

/** True if a circle on the floor is (partly) hidden under a raised obstacle top. */
export function hiddenByStructure(arena: Arena, eye: Eye, x: number, y: number, r: number): boolean {
  for (const o of arena.obstacles) {
    const t = topRect(o, eye);
    const minX = Math.min(o.x, t.x);
    const minY = Math.min(o.y, t.y);
    const maxX = Math.max(o.x + o.w, t.x + t.w);
    const maxY = Math.max(o.y + o.h, t.y + t.h);
    if (x + r > minX && x - r < maxX && y + r > minY && y - r < maxY) return true;
  }
  return false;
}
