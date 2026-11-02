import { COLORS } from '../config';
import { circleRect, type Contact, type Rect } from '../core/collision';
import { doorRect, type DoorOption, type WallSide } from '../run/rooms';
import { font } from '../ui/text';
import { neonStroke } from './enemy';

const contact: Contact = { nx: 0, ny: 0, depth: 0 };

function doorColor(o: DoorOption): string {
  if (o.type === 'boss') return COLORS.red;
  if (o.label === 'NEXT FLOOR') return COLORS.cyan;
  return COLORS.yellow;
}

/** A gate in the arena wall that opens once a room is cleared; walk into it to leave. */
export class Door {
  readonly rect: Rect;
  /** Opening animation, 0 → 1. */
  open = 0;

  constructor(
    readonly option: DoorOption,
    readonly side: WallSide,
    bounds: Rect,
  ) {
    this.rect = doorRect(side, bounds);
  }

  touches(x: number, y: number, r: number): boolean {
    return circleRect(x, y, r, this.rect, contact) !== null;
  }
}

/** Glowing gate on the floor with chevrons pointing out and the destination label in front. */
export function renderDoor(ctx: CanvasRenderingContext2D, d: Door, time: number): void {
  const { x, y, w, h } = d.rect;
  const color = doorColor(d.option);
  const k = d.open;
  const horizontal = d.side === 'top' || d.side === 'bottom';
  ctx.save();

  // Gate slab, growing open from the middle.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gw = horizontal ? w * k : w;
  const gh = horizontal ? h : h * k;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 6);
  ctx.fillRect(cx - gw / 2, cy - gh / 2, gw, gh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = k;
  ctx.beginPath();
  ctx.rect(cx - gw / 2, cy - gh / 2, gw, gh);
  neonStroke(ctx, color, 2);

  // Chevrons pointing out through the wall, and the label just inside.
  const out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[d.side];
  const inX = cx - out[0] * 46;
  const inY = cy - out[1] * 46;
  ctx.globalAlpha = k;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const t = (time * 1.5 + i / 3) % 1;
    const px = cx - out[0] * (34 - t * 24);
    const py = cy - out[1] * (34 - t * 24);
    const s = 8;
    ctx.globalAlpha = k * (1 - t);
    ctx.beginPath();
    ctx.moveTo(px - out[1] * s - out[0] * s * 0.6, py - out[0] * s - out[1] * s * 0.6);
    ctx.lineTo(px, py);
    ctx.lineTo(px + out[1] * s - out[0] * s * 0.6, py + out[0] * s - out[1] * s * 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = k;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.font = font(14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.option.label, inX - out[0] * 20, inY - out[1] * 6);
  ctx.restore();
}
