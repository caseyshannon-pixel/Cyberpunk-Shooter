import { COLORS, CONFIG } from '../config';
import type { Arena } from '../world/arena';

const A = CONFIG.arena;

/** Scrolling neon grid floor, arena walls and obstacles. */
export function renderBackground(ctx: CanvasRenderingContext2D, time: number): void {
  const W = CONFIG.view.width;
  const H = CONFIG.view.height;

  ctx.fillStyle = COLORS.bgDeep;
  ctx.fillRect(0, 0, W, H);

  // Floor tint.
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, '#12052a');
  g.addColorStop(1, COLORS.bgDeep);
  ctx.fillStyle = g;
  ctx.fillRect(A.x, A.y, A.width, A.height);

  // Grid lines, scrolling diagonally. Every 4th line is brighter.
  const size = A.gridSize;
  const off = (time * A.gridScroll) % (size * 4);
  ctx.save();
  ctx.beginPath();
  ctx.rect(A.x, A.y, A.width, A.height);
  ctx.clip();
  ctx.lineWidth = 1;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? COLORS.grid : COLORS.gridBright;
    ctx.globalAlpha = pass === 0 ? 0.55 : 0.5;
    ctx.beginPath();
    for (let i = -4; i * size < A.width + size * 4; i++) {
      const bright = ((i % 4) + 4) % 4 === 0;
      if (bright !== (pass === 1)) continue;
      const x = Math.round(A.x + i * size + off) + 0.5;
      ctx.moveTo(x, A.y);
      ctx.lineTo(x, A.y + A.height);
    }
    for (let j = -4; j * size < A.height + size * 4; j++) {
      const bright = ((j % 4) + 4) % 4 === 0;
      if (bright !== (pass === 1)) continue;
      const y = Math.round(A.y + j * size + off) + 0.5;
      ctx.moveTo(A.x, y);
      ctx.lineTo(A.x + A.width, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function renderArena(ctx: CanvasRenderingContext2D, arena: Arena, time: number): void {
  const b = arena.bounds;
  const pulse = 0.75 + Math.sin(time * 2) * 0.25;

  ctx.save();
  // Outer walls.
  ctx.shadowColor = COLORS.wall;
  ctx.shadowBlur = 20 * pulse;
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 3;
  ctx.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3);

  // Obstacles.
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
    ctx.shadowBlur = 14 * pulse;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
  }
  ctx.restore();
}
