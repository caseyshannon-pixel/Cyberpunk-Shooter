import { COLORS, CONFIG } from '../config';
import { VIEW } from '../core/view';
import type { Arena } from '../world/arena';
import { makeLayer, type Layer } from './cache';
import { renderNearWall, renderOuterWalls, renderStructures, rgba, type Projector, type Pt } from './depth';

const T = CONFIG.tilt;
const DEG = Math.PI / 180;

/**
 * HD-2D camera: a perspective camera south of the arena, pitched down at it,
 * auto-fitted so the whole arena is on screen with a skyline above.
 *
 * Canvas 2D has no perspective transforms, so the floor (and everything
 * flat on it: grid, lights, shadows, ships, bullets, particles) is first
 * drawn top-down into an offscreen layer, then copied to the screen in thin
 * horizontal strips, each scaled for its depth ("Mode 7"). Walls and blocks
 * are drawn on top with true 3D projection.
 */
export class TiltCamera implements Projector {
  /** Floor position under the camera. */
  gx = 0;
  gy = 0;
  /** Screen y of the top of the far wall, and of the bottom of the near wall. */
  farTop = 0;
  nearBottom = 0;
  private cos = 1;
  private sin = 0;
  private camZ = 1;
  private S = 1;
  private ox = 0;
  private oy = 0;
  private shift = 0;
  private sway = 0;
  private floor: Layer | null = null;
  private readonly p: Pt = { x: 0, y: 0 };

  /** Fit the camera to the arena for this frame, drifted `sway` units sideways. */
  setup(arena: Arena, sway: number): void {
    const b = arena.bounds;
    const pitch = T.pitch * DEG;
    this.cos = Math.cos(pitch);
    this.sin = Math.sin(pitch);
    this.camZ = T.distance * this.sin;
    const tx = b.x + b.w / 2;
    const ty = b.y + b.h / 2;
    this.gy = ty + T.distance * this.cos;

    // Fit: project the walls' outer box at unit scale, no drift, then scale and place it.
    this.gx = tx;
    this.S = 1;
    this.ox = 0;
    this.oy = 0;
    this.shift = 0;
    const t = CONFIG.depth.wallThickness;
    const h = CONFIG.depth.wallHeight;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const z of [0, h]) {
      for (const [x, y] of [
        [b.x - t, b.y - t],
        [b.x + b.w + t, b.y - t],
        [b.x - t, b.y + b.h + t],
        [b.x + b.w + t, b.y + b.h + t],
      ]) {
        this.project(x, y, z, this.p);
        minX = Math.min(minX, this.p.x);
        maxX = Math.max(maxX, this.p.x);
        minY = Math.min(minY, this.p.y);
        maxY = Math.max(maxY, this.p.y);
      }
    }
    const W = VIEW.width;
    const H = VIEW.height;
    const S = Math.min((W - 2 * T.marginSide) / (maxX - minX), (H - T.marginTop - T.marginBottom) / (maxY - minY));
    this.S = S;
    this.ox = W / 2 - (S * (minX + maxX)) / 2;
    this.oy = H - T.marginBottom - S * maxY;

    // Drift: move the camera sideways but keep the arena centre where it is,
    // so near and far things slide past each other (parallax).
    this.sway = sway;
    this.gx = tx + sway;
    this.shift = (S * sway) / T.distance;
    this.farTop = this.project(b.x, b.y - t, h, this.p).y;
    this.nearBottom = this.project(b.x, b.y + b.h + t, 0, this.p).y;
  }

  project(x: number, y: number, z: number, out: Pt): Pt {
    const D = this.gy - y;
    const V = z - this.camZ;
    const depth = D * this.cos - V * this.sin;
    const up = D * this.sin + V * this.cos;
    out.x = this.ox + (this.S * (x - this.gx)) / depth + this.shift;
    out.y = this.oy - (this.S * up) / depth;
    return out;
  }

  /** Floor point under a screen position (e.g. the mouse). */
  unproject(sx: number, sy: number, out: Pt): Pt {
    const r = (this.oy - sy) / this.S;
    // Clamp at just below the horizon so pointing at the sky aims far away, not backwards.
    const den = Math.max(0.02, this.sin - r * this.cos);
    const D = (this.camZ * (this.cos + r * this.sin)) / den;
    const depth = D * this.cos + this.camZ * this.sin;
    out.y = this.gy - D;
    out.x = this.gx + ((sx - this.ox - this.shift) * depth) / this.S;
    return out;
  }

  private depthAt(y: number): number {
    return (this.gy - y) * this.cos + this.camZ * this.sin;
  }

  /** Screen pixels per world unit (horizontally) on the floor at row y. */
  scaleAt(y: number): number {
    return this.S / this.depthAt(y);
  }

  /**
   * Multiply onto `ctx` the affine transform that best matches the camera
   * around floor point (x, y), so top-down drawing code placed there comes
   * out correctly foreshortened.
   */
  applyLocal(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const depth = this.depthAt(y);
    const a = this.S / depth;
    const c = (this.S * (x - this.gx) * this.cos) / (depth * depth);
    const d = (this.S * this.camZ) / (depth * depth);
    const p = this.project(x, y, 0, this.p);
    ctx.transform(a, 0, c, d, p.x - a * x - c * y, p.y - d * y);
  }

  /**
   * Draw the whole scene: backdrop, the warped floor (`drawFloor` draws the
   * flat world in world coordinates into an offscreen layer), then the walls
   * and blocks.
   */
  render(ctx: CanvasRenderingContext2D, arena: Arena, time: number, drawFloor: (c: CanvasRenderingContext2D) => void): void {
    const m = ctx.getTransform();
    const scale = Math.hypot(m.a, m.b);
    const W = VIEW.width;
    const H = VIEW.height;
    renderBackdrop(ctx, this.farTop, this.sway, scale);

    if (!this.floor || this.floor.scale !== scale || this.floor.canvas.width !== Math.ceil(W * scale)) {
      this.floor = makeLayer(W, H, scale);
    }
    const L = this.floor;
    L.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawFloor(L.ctx);

    // Mode 7: one strip per few screen rows, each source row band scaled for its depth.
    const b = arena.bounds;
    const top = this.project(b.x, b.y, 0, this.p).y;
    const bottom = this.project(b.x, b.y + b.h, 0, this.p).y;
    const q = this.p;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    let wa = b.y;
    for (let s = top; s < bottom; s += T.strip) {
      const s1 = Math.min(s + T.strip, bottom);
      const wb = s1 >= bottom ? b.y + b.h : this.unproject(W / 2, s1, q).y;
      const k = this.scaleAt((wa + wb) / 2);
      const dx = this.ox + k * (b.x - this.gx) + this.shift;
      // A little vertical overlap hides seams between strips.
      ctx.drawImage(L.canvas, b.x * scale, wa * scale, b.w * scale, Math.max(0.5, (wb - wa) * scale), dx, s, k * b.w, s1 - s + 0.6);
      wa = wb;
    }
    ctx.restore();

    renderOuterWalls(ctx, arena, this, time);
    renderStructures(ctx, arena, this, time);
    renderNearWall(ctx, arena, this, time, T.nearWallAlpha);
  }
}

// ------------------------------------------------------------------ backdrop

/** Small seeded PRNG so the skyline is the same every time. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Extra width on each side of the skyline layers, so they can slide for parallax. */
const PAD = 60;

let backdrop: { key: string; sky: Layer; far: Layer; near: Layer } | null = null;

/**
 * Synthwave backdrop behind the arena: starry sky, striped sun, two rows of
 * city skyline (which slide at different speeds as the camera drifts), and a
 * neon grid plane running to the horizon. Cached; rebuilt only on resize.
 */
function renderBackdrop(ctx: CanvasRenderingContext2D, farTop: number, sway: number, scale: number): void {
  const W = VIEW.width;
  const H = VIEW.height;
  const horizon = Math.round(farTop + 26);
  const key = `${W}|${scale}|${horizon}`;
  if (!backdrop || backdrop.key !== key) {
    backdrop = { key, sky: buildSky(W, H, horizon, scale), far: buildSkyline(W, horizon, scale, 7, 0.55), near: buildSkyline(W, horizon, scale, 13, 1) };
  }
  ctx.drawImage(backdrop.sky.canvas, 0, 0, W, H);
  ctx.drawImage(backdrop.far.canvas, -PAD - sway * 0.04, 0, W + PAD * 2, horizon);
  ctx.drawImage(backdrop.near.canvas, -PAD - sway * 0.1, 0, W + PAD * 2, horizon);
}

function buildSky(W: number, H: number, horizon: number, scale: number): Layer {
  const layer = makeLayer(W, H, scale);
  const c = layer.ctx;
  const sky = c.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#020008');
  sky.addColorStop(0.6, '#12042e');
  sky.addColorStop(1, '#3a0a4a');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, horizon);

  const r = rng(3);
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    c.globalAlpha = 0.2 + r() * 0.6;
    const s = r() < 0.15 ? 2 : 1;
    c.fillRect(r() * W, r() * horizon * 0.8, s, s);
  }
  c.globalAlpha = 1;

  // Striped synthwave sun, sitting on the horizon.
  const R = Math.min(130, horizon * 0.75);
  const cx = W / 2;
  const cy = horizon - 4;
  const sun = makeLayer(R * 2, R * 2, scale);
  const sc = sun.ctx;
  const g = sc.createLinearGradient(0, 0, 0, R * 2);
  g.addColorStop(0, COLORS.yellow);
  g.addColorStop(0.55, COLORS.orange);
  g.addColorStop(1, COLORS.magenta);
  sc.fillStyle = g;
  sc.beginPath();
  sc.arc(R, R, R, 0, Math.PI * 2);
  sc.fill();
  sc.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const y = R * (0.95 + i * 0.16);
    sc.fillRect(0, y, R * 2, 2 + i * 1.4);
  }
  c.save();
  c.shadowColor = COLORS.magenta;
  c.shadowBlur = 40 * scale;
  c.globalAlpha = 0.9;
  c.drawImage(sun.canvas, cx - R, cy - R, R * 2, R * 2);
  c.restore();

  // Glow along the horizon.
  const glow = c.createLinearGradient(0, horizon - 60, 0, horizon + 30);
  glow.addColorStop(0, 'rgba(255,43,214,0)');
  glow.addColorStop(0.7, 'rgba(255,43,214,0.22)');
  glow.addColorStop(1, 'rgba(255,43,214,0)');
  c.fillStyle = glow;
  c.fillRect(0, horizon - 60, W, 90);

  // Below the horizon: a dark plane with a neon grid running away to it.
  c.fillStyle = '#04010c';
  c.fillRect(0, horizon, W, H - horizon);
  c.strokeStyle = COLORS.magenta;
  c.lineWidth = 1;
  c.globalAlpha = 0.22;
  c.beginPath();
  for (let i = -24; i <= 24; i++) {
    c.moveTo(cx + i * 6, horizon);
    c.lineTo(cx + i * 150, H);
  }
  for (let k = 1; k < 14; k++) {
    const y = horizon + (H - horizon) * Math.pow(k / 13, 2.2);
    c.moveTo(0, y);
    c.lineTo(W, y);
  }
  c.stroke();
  c.globalAlpha = 1;
  return layer;
}

/** One row of buildings standing on the horizon, with lit windows and neon roof lines. */
function buildSkyline(W: number, horizon: number, scale: number, seed: number, depth: number): Layer {
  const w = W + PAD * 2;
  const layer = makeLayer(w, horizon, scale);
  const c = layer.ctx;
  const r = rng(seed);
  const body = depth < 1 ? '#1a0838' : '#0b0320';
  const windows = [COLORS.cyan, COLORS.magenta, COLORS.yellow];
  let x = -10;
  while (x < w) {
    const bw = 26 + r() * 60;
    // Taller toward the edges, leaving a gap around the sun.
    const edge = Math.abs(x + bw / 2 - w / 2) / (w / 2);
    const bh = (18 + r() * 50 + edge * edge * 110) * depth;
    const top = horizon - bh;
    c.fillStyle = body;
    c.fillRect(x, top, bw, bh);
    if (r() < 0.35) {
      // Antenna.
      c.fillRect(x + bw * 0.5 - 1, top - 14 * depth, 2, 14 * depth);
    }
    const accent = windows[Math.floor(r() * windows.length)];
    for (let wy = top + 6; wy < horizon - 4; wy += 7) {
      for (let wx = x + 4; wx < x + bw - 4; wx += 6) {
        if (r() < 0.22) {
          c.fillStyle = rgba(accent, (0.35 + r() * 0.5) * depth);
          c.fillRect(wx, wy, 2, 3);
        }
      }
    }
    if (r() < 0.5) {
      c.strokeStyle = rgba(accent, 0.8 * depth);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, top + 0.5);
      c.lineTo(x + bw, top + 0.5);
      c.stroke();
    }
    x += bw + 2 + r() * 8;
  }
  return layer;
}
