import { COLORS, CONFIG } from '../config';
import { settings, type GraphicsMode } from '../settings';
import type { Arena, Obstacle } from '../world/arena';
import { currentScale, makeLayer, type Layer } from './cache';

/**
 * Depth rendering shared by the two 3D-looking graphics modes:
 *
 * - **2.5D**: the camera stays straight top-down, but a virtual camera sits
 *   `cameraHeight` above an "eye" point on the floor, so anything with height
 *   is scaled away from the eye (walls lean outward and show the faces turned
 *   toward it). The eye drifts with the player for a gentle parallax.
 * - **HD-2D**: a tilted perspective camera (see tilt.ts).
 *
 * Both describe their camera as a `Projector`, and the walls/blocks here are
 * drawn through it. Gameplay is unchanged: collisions use floor footprints.
 */

const D = CONFIG.depth;

export function graphicsMode(): GraphicsMode {
  return settings.get().graphics;
}

/** Shadows, floor lighting and bloom are on (2.5D and HD-2D). */
export function hdEnabled(): boolean {
  return settings.get().graphics !== 'flat';
}

export interface Pt {
  x: number;
  y: number;
}

/** A camera, for drawing upright geometry. */
export interface Projector {
  /** Floor position under the camera: decides which vertical faces are visible. */
  readonly gx: number;
  readonly gy: number;
  /** Screen position of world point (x, y) at height z; writes into and returns `out`. */
  project(x: number, y: number, z: number, out: Pt): Pt;
}

/** Screen-space scale (around the eye) of a point `h` above the floor, in 2.5D. */
export function lift(h: number): number {
  return D.cameraHeight / (D.cameraHeight - h);
}

/** The 2.5D camera: heights scale away from the eye. */
export function eyeProjector(eye: Pt): Projector {
  return {
    gx: eye.x,
    gy: eye.y,
    project(x, y, z, out) {
      const s = lift(z);
      out.x = eye.x + (x - eye.x) * s;
      out.y = eye.y + (y - eye.y) * s;
      return out;
    },
  };
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

export function rgba(hex: string, a: number): string {
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
 * Cached floor overlay: shadows cast by the walls and obstacles, plus faint
 * neon reflections where they meet the floor.
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

// Scratch points so per-frame projection doesn't allocate.
const A: Pt = { x: 0, y: 0 };
const B: Pt = { x: 0, y: 0 };
const C: Pt = { x: 0, y: 0 };
const E: Pt = { x: 0, y: 0 };

/** Path through four world points at height z. */
function quadAt(ctx: CanvasRenderingContext2D, P: Projector, z: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
  P.project(x0, y0, z, A);
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  P.project(x1, y1, z, A);
  ctx.lineTo(A.x, A.y);
  P.project(x2, y2, z, A);
  ctx.lineTo(A.x, A.y);
  P.project(x3, y3, z, A);
  ctx.lineTo(A.x, A.y);
  ctx.closePath();
}

/** Path around an axis-aligned floor rect raised to height z. */
function rectAt(ctx: CanvasRenderingContext2D, P: Projector, z: number, x0: number, y0: number, x1: number, y1: number): void {
  quadAt(ctx, P, z, x0, y0, x1, y0, x1, y1, x0, y1);
}

/**
 * One vertical face from floor edge (x0,y0)-(x1,y1) up to height h: a dark
 * slab lit by its normal, fading darker toward the floor, with neon light
 * strips across it. `alpha` < 1 makes it see-through (the HD-2D near wall).
 */
function face(
  ctx: CanvasRenderingContext2D,
  P: Projector,
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
  alpha = 1,
): void {
  P.project(x0, y0, 0, A);
  P.project(x1, y1, 0, B);
  P.project(x1, y1, h, C);
  P.project(x0, y0, h, E);
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.lineTo(B.x, B.y);
  ctx.lineTo(C.x, C.y);
  ctx.lineTo(E.x, E.y);
  ctx.closePath();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0a0318';
  ctx.fill();
  const g = ctx.createLinearGradient((A.x + B.x) / 2, (A.y + B.y) / 2, (C.x + E.x) / 2, (C.y + E.y) / 2);
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
      P.project(x0, y0, h * f, A);
      ctx.moveTo(A.x, A.y);
      P.project(x1, y1, h * f, A);
      ctx.lineTo(A.x, A.y);
    }
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7 * glow;
    ctx.stroke();
  }
}

const PILLAR_STRIPS = [0.3, 0.62] as const;
const CRATE_STRIPS = [0.5] as const;
const NO_STRIPS: readonly number[] = [];

/** Neon rim along the current path: faint wide halo + bright core (no shadowBlur, it's per frame). */
function rim(ctx: CanvasRenderingContext2D, color: string, width: number, alpha: number): void {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.25 * alpha;
  ctx.lineWidth = width * 3.5;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The neon breathing pulse shared by walls and blocks. */
function pulse(time: number): number {
  return 0.82 + Math.sin(time * 2) * 0.18;
}

/** True when the camera can see the arena's south wall from the inside (2.5D, not HD-2D). */
function southInnerVisible(arena: Arena, P: Projector): boolean {
  return P.gy < arena.bounds.y + arena.bounds.h;
}

/**
 * The arena's outer walls, seen from inside: inward faces rising from the
 * arena edge, topped with a neon-rimmed cap. They lean away from the camera,
 * so they never cover the play area and are drawn under everything.
 *
 * In HD-2D the camera is south of the arena and sees the south wall from
 * behind: that one is left to `renderNearWall`, drawn last and see-through.
 */
export function renderOuterWalls(ctx: CanvasRenderingContext2D, arena: Arena, P: Projector, time: number): void {
  const b = arena.bounds;
  const h = D.wallHeight;
  const t = D.wallThickness;
  const glow = pulse(time);
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const wall = COLORS.wall;
  const south = southInnerVisible(arena, P);

  ctx.save();
  ctx.lineJoin = 'round';
  // North wall faces south, and so on.
  face(ctx, P, x0, y0, x1, y0, h, 0, 1, wall, NO_STRIPS, glow);
  face(ctx, P, x0, y0, x0, y1, h, 1, 0, wall, NO_STRIPS, glow);
  face(ctx, P, x1, y0, x1, y1, h, -1, 0, wall, NO_STRIPS, glow);
  if (south) face(ctx, P, x0, y1, x1, y1, h, 0, -1, wall, NO_STRIPS, glow);

  // Panel seams up each wall and a light strip at mid-height.
  ctx.beginPath();
  const seam = (x: number, y: number) => {
    P.project(x, y, 0, A);
    ctx.moveTo(A.x, A.y);
    P.project(x, y, h, A);
    ctx.lineTo(A.x, A.y);
  };
  for (let x = x0 + 80; x < x1 - 20; x += 80) {
    seam(x, y0);
    if (south) seam(x, y1);
  }
  for (let y = y0 + 80; y < y1 - 20; y += 80) {
    seam(x0, y);
    seam(x1, y);
  }
  ctx.strokeStyle = wall;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.22 * glow;
  ctx.stroke();
  ctx.beginPath();
  const zm = h * 0.55;
  P.project(x0, y1, zm, A);
  ctx.moveTo(A.x, A.y);
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x1, y1],
  ]) {
    P.project(x, y, zm, A);
    ctx.lineTo(A.x, A.y);
  }
  if (south) ctx.closePath();
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35 * glow;
  ctx.stroke();

  // Caps: a band from each wall's top edge outward.
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#14062e';
  quadAt(ctx, P, h, x0 - t, y0 - t, x1 + t, y0 - t, x1 + t, y0, x0 - t, y0);
  ctx.fill();
  quadAt(ctx, P, h, x0 - t, y0, x0, y0, x0, y1 + (south ? 0 : t), x0 - t, y1 + (south ? 0 : t));
  ctx.fill();
  quadAt(ctx, P, h, x1, y0, x1 + t, y0, x1 + t, y1 + (south ? 0 : t), x1, y1 + (south ? 0 : t));
  ctx.fill();
  if (south) {
    quadAt(ctx, P, h, x0 - t, y1, x1 + t, y1, x1 + t, y1 + t, x0 - t, y1 + t);
    ctx.fill();
  }

  // Inner top rim (open on the south in HD-2D), then the outer edge of the cap.
  ctx.beginPath();
  P.project(x0, y1, h, A);
  ctx.moveTo(A.x, A.y);
  P.project(x0, y0, h, A);
  ctx.lineTo(A.x, A.y);
  P.project(x1, y0, h, A);
  ctx.lineTo(A.x, A.y);
  P.project(x1, y1, h, A);
  ctx.lineTo(A.x, A.y);
  if (south) ctx.closePath();
  rim(ctx, wall, 2.5, glow);
  rectAt(ctx, P, h, x0 - t, y0 - t, x1 + t, y1 + t);
  ctx.strokeStyle = wall;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35 * glow;
  ctx.stroke();

  // Base line where the walls meet the floor.
  rectAt(ctx, P, 0, x0, y0, x1, y1);
  ctx.strokeStyle = wall;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7 * glow;
  ctx.stroke();
  ctx.restore();
}

/**
 * HD-2D only: the south wall, between the camera and the floor. Drawn last
 * and mostly transparent ("glass") so it never hides the action.
 */
export function renderNearWall(ctx: CanvasRenderingContext2D, arena: Arena, P: Projector, time: number, alpha: number): void {
  if (southInnerVisible(arena, P)) return;
  const b = arena.bounds;
  const h = D.wallHeight;
  const t = D.wallThickness;
  const glow = pulse(time);
  const x0 = b.x - t;
  const x1 = b.x + b.w + t;
  const yi = b.y + b.h;
  const yo = yi + t;
  ctx.save();
  ctx.lineJoin = 'round';
  // Outer face (the side the camera sees), then the cap on top.
  face(ctx, P, x0, yo, x1, yo, h, 0, 1, COLORS.wall, NO_STRIPS, glow, alpha);
  quadAt(ctx, P, h, x0, yi, x1, yi, x1, yo, x0, yo);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#14062e';
  ctx.fill();
  P.project(x0, yi, h, A);
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  P.project(x1, yi, h, A);
  ctx.lineTo(A.x, A.y);
  rim(ctx, COLORS.wall, 2.5, glow);
  ctx.beginPath();
  P.project(x0, yo, h, A);
  ctx.moveTo(A.x, A.y);
  P.project(x1, yo, h, A);
  ctx.lineTo(A.x, A.y);
  rim(ctx, COLORS.wall, 1.5, glow * 0.8);
  ctx.restore();
}

/**
 * Pillars and crates as extruded blocks, back to front. Drawn after the
 * entities so their raised parts correctly cover whatever is behind them.
 */
export function renderStructures(ctx: CanvasRenderingContext2D, arena: Arena, P: Projector, time: number): void {
  const glow = pulse(time);
  const order = arena.obstacles.slice().sort((a, b) => a.y + a.h - (b.y + b.h));
  ctx.save();
  ctx.lineJoin = 'round';
  for (const o of order) {
    const h = obstacleHeight(o);
    const edge = obstacleEdge(o);
    const strips = o.kind === 'pillar' ? PILLAR_STRIPS : CRATE_STRIPS;
    const x0 = o.x;
    const y0 = o.y;
    const x1 = o.x + o.w;
    const y1 = o.y + o.h;

    // Only the faces turned toward the camera are visible.
    if (P.gy < y0) face(ctx, P, x0, y0, x1, y0, h, 0, -1, edge, strips, glow);
    if (P.gy > y1) face(ctx, P, x0, y1, x1, y1, h, 0, 1, edge, strips, glow);
    if (P.gx < x0) face(ctx, P, x0, y0, x0, y1, h, -1, 0, edge, strips, glow);
    if (P.gx > x1) face(ctx, P, x1, y0, x1, y1, h, 1, 0, edge, strips, glow);

    // Top face.
    rectAt(ctx, P, h, x0, y0, x1, y1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.obstacleFill;
    ctx.fill();
    P.project(x0, y0, h, B);
    P.project(x1, y1, h, C);
    const lit = ctx.createLinearGradient(B.x, B.y, C.x, C.y);
    lit.addColorStop(0, rgba(edge, 0.16));
    lit.addColorStop(1, rgba(edge, 0.02));
    ctx.fillStyle = lit;
    ctx.fill();
    ctx.save();
    rim(ctx, edge, 2, glow);
    ctx.restore();

    // Detail: diagonal hatching for crates, a core square for pillars.
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    if (o.kind === 'crate') {
      ctx.beginPath();
      for (let k = -o.h; k < o.w; k += 12) {
        P.project(Math.max(x0, x0 + k), y0 + Math.max(0, -k), h, A);
        ctx.moveTo(A.x, A.y);
        P.project(Math.min(x1, x0 + k + o.h), y0 + Math.min(o.h, o.w - k), h, A);
        ctx.lineTo(A.x, A.y);
      }
    } else {
      rectAt(ctx, P, h, x0 + 12, y0 + 12, x1 - 12, y1 - 12);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * True if a circle on the floor is (partly) hidden behind a raised obstacle:
 * its screen position overlaps the block's projection and it's farther from
 * the camera than the block.
 */
export function hiddenByStructure(arena: Arena, P: Projector, x: number, y: number, r: number): boolean {
  const p = P.project(x, y, 0, E);
  const px = p.x;
  const py = p.y;
  for (const o of arena.obstacles) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    if ((x - P.gx) ** 2 + (y - P.gy) ** 2 <= (cx - P.gx) ** 2 + (cy - P.gy) ** 2) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const h = obstacleHeight(o);
    for (const z of [0, h]) {
      for (const [qx, qy] of [
        [o.x, o.y],
        [o.x + o.w, o.y],
        [o.x, o.y + o.h],
        [o.x + o.w, o.y + o.h],
      ]) {
        P.project(qx, qy, z, A);
        minX = Math.min(minX, A.x);
        maxX = Math.max(maxX, A.x);
        minY = Math.min(minY, A.y);
        maxY = Math.max(maxY, A.y);
      }
    }
    if (px + r > minX && px - r < maxX && py + r > minY && py - r < maxY) return true;
  }
  return false;
}
