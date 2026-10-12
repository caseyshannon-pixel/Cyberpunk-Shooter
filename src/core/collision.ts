export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Contact {
  /** Unit normal pointing from the rect toward the circle. */
  nx: number;
  ny: number;
  /** Penetration depth (>0 when overlapping). */
  depth: number;
}

/**
 * Circle vs axis-aligned rect. Returns contact info when overlapping (writing
 * into `out`), else null. Handles the circle centre being inside the rect.
 */
export function circleRect(cx: number, cy: number, r: number, rect: Rect, out: Contact): Contact | null {
  const qx = cx < rect.x ? rect.x : cx > rect.x + rect.w ? rect.x + rect.w : cx;
  const qy = cy < rect.y ? rect.y : cy > rect.y + rect.h ? rect.y + rect.h : cy;
  const dx = cx - qx;
  const dy = cy - qy;
  const d2 = dx * dx + dy * dy;

  if (d2 > 0) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    out.nx = dx / d;
    out.ny = dy / d;
    out.depth = r - d;
    return out;
  }

  // Centre is inside the rect: push out along the axis of least penetration.
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  out.nx = 0;
  out.ny = 0;
  if (m === left) out.nx = -1;
  else if (m === right) out.nx = 1;
  else if (m === top) out.ny = -1;
  else out.ny = 1;
  out.depth = m + r;
  return out;
}

export function circleCircle(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * Swept test: does a circle of radius `r` moving from (x0,y0) to (x1,y1)
 * touch the circle at (cx,cy) with radius `cr`? Prevents fast bullets
 * tunnelling through small enemies between ticks.
 */
export function segmentCircle(x0: number, y0: number, x1: number, y1: number, r: number, cx: number, cy: number, cr: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = x0 + dx * t - cx;
  const py = y0 + dy * t - cy;
  const rr = r + cr;
  return px * px + py * py <= rr * rr;
}

/** Does the segment (x0,y0)→(x1,y1) intersect the rect? (Slab method.) */
export function segmentRect(x0: number, y0: number, x1: number, y1: number, rect: Rect): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [p, d, lo, hi] of [
    [x0, dx, rect.x, rect.x + rect.w],
    [y0, dy, rect.y, rect.y + rect.h],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}
