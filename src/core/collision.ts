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
