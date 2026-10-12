import { COLORS, CONFIG } from '../config';
import type { Arena } from '../world/arena';
import { VIEW } from '../core/view';
import { currentScale, makeLayer, type Layer } from './cache';

const A = CONFIG.arena;
const H = CONFIG.view.height;
/** The grid pattern repeats every 4 cells (every 4th line is bright). */
const GRID_PERIOD = A.gridSize * 4;

interface Keyed {
  layer: Layer;
  key: string;
}
let floor: Keyed | null = null;
let grid: Keyed | null = null;

/**
 * Floor gradient + scrolling neon grid. Both are cached: the floor is one
 * opaque full-view layer, and the grid is a tile one period larger than the
 * arena that we blit with an offset to make it scroll.
 */
export function renderBackground(ctx: CanvasRenderingContext2D, time: number, arena: Arena): void {
  const scale = currentScale(ctx);
  const b = arena.bounds;
  const key = `${scale}|${VIEW.width}|${b.w}x${b.h}`;
  if (!floor || floor.key !== key) floor = { layer: buildFloor(scale, arena), key };
  if (!grid || grid.key !== key) grid = { layer: buildGrid(scale, arena), key };

  ctx.drawImage(floor.layer.canvas, 0, 0, VIEW.width, H);

  const off = (time * A.gridScroll) % GRID_PERIOD;
  const s = grid.layer.scale;
  // Source rect starts one period in, minus the offset, so lines appear to move down-right.
  const sx = (GRID_PERIOD - off) * s;
  ctx.drawImage(grid.layer.canvas, sx, sx, b.w * s, b.h * s, b.x, b.y, b.w, b.h);
}

function buildFloor(scale: number, arena: Arena): Layer {
  const W = VIEW.width;
  const b = arena.bounds;
  const layer = makeLayer(W, H, scale);
  const c = layer.ctx;
  c.fillStyle = COLORS.bgDeep;
  c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#12052a');
  g.addColorStop(1, COLORS.bgDeep);
  c.fillStyle = g;
  c.fillRect(b.x, b.y, b.w, b.h);
  return layer;
}

function buildGrid(scale: number, arena: Arena): Layer {
  const w = arena.bounds.w + GRID_PERIOD;
  const h = arena.bounds.h + GRID_PERIOD;
  const layer = makeLayer(w, h, scale);
  const c = layer.ctx;
  const size = A.gridSize;
  c.lineWidth = 1;
  for (let pass = 0; pass < 2; pass++) {
    const bright = pass === 1;
    c.strokeStyle = bright ? COLORS.gridBright : COLORS.grid;
    c.globalAlpha = bright ? 0.5 : 0.55;
    c.beginPath();
    for (let i = 0; i * size <= w; i++) {
      if ((i % 4 === 0) !== bright) continue;
      const x = i * size + 0.5;
      c.moveTo(x, 0);
      c.lineTo(x, h);
    }
    for (let j = 0; j * size <= h; j++) {
      if ((j % 4 === 0) !== bright) continue;
      const y = j * size + 0.5;
      c.moveTo(0, y);
      c.lineTo(w, y);
    }
    c.stroke();
  }
  return layer;
}

let walls: { layer: Layer; arena: Arena; width: number } | null = null;

/**
 * Walls and obstacles never change, and canvas shadowBlur is expensive
 * (especially in Safari on iPhone/iPad), so they're drawn once into a cached
 * layer and blitted every frame with a slow alpha "breathing" pulse.
 */
export function renderArena(ctx: CanvasRenderingContext2D, arena: Arena, time: number): void {
  const scale = currentScale(ctx);
  const W = VIEW.width;
  if (!walls || walls.arena !== arena || walls.layer.scale !== scale || walls.width !== W) {
    const layer = makeLayer(W, H, scale);
    drawArena(layer.ctx, arena, scale);
    walls = { layer, arena, width: W };
  }
  ctx.save();
  ctx.globalAlpha = 0.82 + Math.sin(time * 2) * 0.18;
  ctx.drawImage(walls.layer.canvas, 0, 0, W, H);
  ctx.restore();
}

function drawArena(ctx: CanvasRenderingContext2D, arena: Arena, scale: number): void {
  const b = arena.bounds;
  // shadowBlur is in device pixels and ignores the transform; scale it so the glow matches on every DPR.
  ctx.save();
  ctx.shadowColor = COLORS.wall;
  ctx.shadowBlur = 10 * scale;
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3);

  for (const o of arena.obstacles) {
    const edge = o.kind === 'pillar' ? COLORS.obstacleEdge : COLORS.purple;
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.obstacleFill;
    ctx.fillRect(o.x, o.y, o.w, o.h);

    // Inner detail: diagonal hatching for crates, a core square for pillars.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (o.kind === 'crate') {
      for (let k = -o.h; k < o.w; k += 12) {
        const x0 = Math.max(o.x, o.x + k);
        const y0 = o.y + Math.max(0, -k);
        const x1 = Math.min(o.x + o.w, o.x + k + o.h);
        const y1 = o.y + Math.min(o.h, o.w - k);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
    } else {
      ctx.rect(o.x + 12, o.y + 12, o.w - 24, o.h - 24);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.shadowColor = edge;
    ctx.shadowBlur = 7 * scale;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  }
  ctx.restore();
}
