/**
 * Small polyfills for older Safari (iOS/iPadOS/macOS 14–15). Import once,
 * before anything draws.
 */

type RoundRect = (x: number, y: number, w: number, h: number, radii?: number | DOMPointInit | (number | DOMPointInit)[]) => void;

const proto = CanvasRenderingContext2D.prototype as unknown as { roundRect?: RoundRect };

// CanvasRenderingContext2D.roundRect arrived in Safari 16.
if (typeof proto.roundRect !== 'function') {
  proto.roundRect = function (this: CanvasRenderingContext2D, x, y, w, h, radii = 0) {
    const first = Array.isArray(radii) ? radii[0] : radii;
    let r = typeof first === 'number' ? first : (first?.x ?? 0);
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}
