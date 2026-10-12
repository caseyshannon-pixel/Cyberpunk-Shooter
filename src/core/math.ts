export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function vec(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angle interpolation. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/** Move `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Radial deadzone with rescaling: inputs inside `deadzone` become zero, and the
 * remaining range is remapped to 0..1 so movement ramps smoothly from the edge
 * of the deadzone instead of jumping to 20% speed.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone: number, out: Vec2): Vec2 {
  const mag = len(x, y);
  if (mag <= deadzone || mag === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  out.x = (x / mag) * scaled;
  out.y = (y / mag) * scaled;
  return out;
}
