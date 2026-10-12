import { segmentRect, type Rect } from '../core/collision';
import { len, type Vec2 } from '../core/math';
import type { Arena } from './arena';

const probeRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Bend a desired direction around obstacles: probe ahead, and if the probe
 * hits a (radius-expanded) obstacle, add a sideways push toward whichever side
 * of the obstacle is closer. Cheap and good enough for a handful of crates.
 * Writes a unit vector into `out`.
 */
export function avoidObstacles(arena: Arena, x: number, y: number, r: number, dx: number, dy: number, out: Vec2, probe = 56): Vec2 {
  let ax = dx;
  let ay = dy;
  for (const o of arena.obstacles) {
    probeRect.x = o.x - r - 4;
    probeRect.y = o.y - r - 4;
    probeRect.w = o.w + r * 2 + 8;
    probeRect.h = o.h + r * 2 + 8;
    if (!segmentRect(x, y, x + dx * probe, y + dy * probe, probeRect)) continue;
    const cx = o.x + o.w / 2 - x;
    const cy = o.y + o.h / 2 - y;
    // Obstacle centre to the left of our heading → steer right, and vice versa.
    const side = dx * cy - dy * cx > 0 ? -1 : 1;
    ax += -dy * side * 1.6;
    ay += dx * side * 1.6;
  }
  const l = len(ax, ay) || 1;
  out.x = ax / l;
  out.y = ay / l;
  return out;
}
