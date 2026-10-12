import { CONFIG } from '../config';
import { circleRect, segmentRect, type Contact, type Rect } from '../core/collision';

export interface Obstacle extends Rect {
  kind: 'pillar' | 'crate';
}

const A = CONFIG.arena;

/**
 * The play field: an outer wall rectangle plus neon crates/pillars that block
 * both movement and projectiles.
 */
export class Arena {
  readonly bounds: Rect = { x: A.x, y: A.y, w: A.width, h: A.height };
  readonly obstacles: Obstacle[] = [];
  private readonly contact: Contact = { nx: 0, ny: 0, depth: 0 };

  constructor() {
    this.buildLayout();
  }

  private buildLayout(): void {
    const cx = A.x + A.width / 2;
    const cy = A.y + A.height / 2;
    const add = (x: number, y: number, w: number, h: number, kind: Obstacle['kind']) =>
      this.obstacles.push({ x: x - w / 2, y: y - h / 2, w, h, kind });

    // Four pillars around the centre.
    const px = 260;
    const py = 150;
    add(cx - px, cy - py, 56, 56, 'pillar');
    add(cx + px, cy - py, 56, 56, 'pillar');
    add(cx - px, cy + py, 56, 56, 'pillar');
    add(cx + px, cy + py, 56, 56, 'pillar');

    // Crate walls near the flanks for cover.
    add(cx - 470, cy, 40, 140, 'crate');
    add(cx + 470, cy, 40, 140, 'crate');
    add(cx, cy - 235, 150, 36, 'crate');
    add(cx, cy + 235, 150, 36, 'crate');
  }

  get centerX(): number {
    return this.bounds.x + this.bounds.w / 2;
  }

  get centerY(): number {
    return this.bounds.y + this.bounds.h / 2;
  }

  /**
   * Push a circle out of walls and obstacles. Returns the circle's corrected
   * position via the `pos` object and true if any collision happened.
   */
  resolveCircle(pos: { x: number; y: number }, r: number): boolean {
    let hit = false;
    const b = this.bounds;
    if (pos.x - r < b.x) {
      pos.x = b.x + r;
      hit = true;
    } else if (pos.x + r > b.x + b.w) {
      pos.x = b.x + b.w - r;
      hit = true;
    }
    if (pos.y - r < b.y) {
      pos.y = b.y + r;
      hit = true;
    } else if (pos.y + r > b.y + b.h) {
      pos.y = b.y + b.h - r;
      hit = true;
    }
    for (const o of this.obstacles) {
      const c = circleRect(pos.x, pos.y, r, o, this.contact);
      if (c) {
        pos.x += c.nx * c.depth;
        pos.y += c.ny * c.depth;
        hit = true;
      }
    }
    return hit;
  }

  /** True if nothing blocks a straight line between the two points. */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    for (const o of this.obstacles) if (segmentRect(x0, y0, x1, y1, o)) return false;
    return true;
  }

  /** True if a circle at (x, y) overlaps no obstacle and sits inside the walls. */
  isFree(x: number, y: number, r: number): boolean {
    const b = this.bounds;
    if (x - r < b.x || x + r > b.x + b.w || y - r < b.y || y + r > b.y + b.h) return false;
    for (const o of this.obstacles) if (circleRect(x, y, r, o, this.contact)) return false;
    return true;
  }

  /**
   * Random free point near the arena edge, at least `minDist` from (avoidX, avoidY).
   * Falls back to the farthest candidate found if none qualify.
   */
  spawnPoint(avoidX: number, avoidY: number, minDist: number, r: number, out: { x: number; y: number }): void {
    const b = this.bounds;
    const inset = r + 14;
    let bestD = -1;
    for (let i = 0; i < 24; i++) {
      // Mostly near the edges (where enemies "enter"), sometimes anywhere.
      let x: number;
      let y: number;
      const side = Math.floor(Math.random() * 5);
      const u = Math.random();
      if (side === 0) [x, y] = [b.x + inset, b.y + inset + u * (b.h - inset * 2)];
      else if (side === 1) [x, y] = [b.x + b.w - inset, b.y + inset + u * (b.h - inset * 2)];
      else if (side === 2) [x, y] = [b.x + inset + u * (b.w - inset * 2), b.y + inset];
      else if (side === 3) [x, y] = [b.x + inset + u * (b.w - inset * 2), b.y + b.h - inset];
      else [x, y] = [b.x + inset + Math.random() * (b.w - inset * 2), b.y + inset + Math.random() * (b.h - inset * 2)];
      if (!this.isFree(x, y, r)) continue;
      const d = Math.hypot(x - avoidX, y - avoidY);
      if (d > bestD) {
        bestD = d;
        out.x = x;
        out.y = y;
      }
      if (d >= minDist) return;
    }
    if (bestD < 0) {
      out.x = this.centerX;
      out.y = b.y + inset;
    }
  }

  /**
   * Collision test for a projectile. Returns a contact (with the surface
   * normal, for bouncing) or null. The returned object is reused — copy it if
   * you need to keep it.
   */
  hitTestCircle(x: number, y: number, r: number): Contact | null {
    const b = this.bounds;
    const c = this.contact;
    if (x - r < b.x) return set(c, 1, 0, b.x - (x - r));
    if (x + r > b.x + b.w) return set(c, -1, 0, x + r - (b.x + b.w));
    if (y - r < b.y) return set(c, 0, 1, b.y - (y - r));
    if (y + r > b.y + b.h) return set(c, 0, -1, y + r - (b.y + b.h));
    for (const o of this.obstacles) {
      if (circleRect(x, y, r, o, c)) return c;
    }
    return null;
  }
}

function set(c: Contact, nx: number, ny: number, depth: number): Contact {
  c.nx = nx;
  c.ny = ny;
  c.depth = depth;
  return c;
}
