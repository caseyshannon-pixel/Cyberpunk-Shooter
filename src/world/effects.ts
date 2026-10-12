import { len } from '../core/math';

interface Beam {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Bolt {
  /** Flattened jagged polyline: x0, y0, x1, y1, … */
  pts: number[];
  color: string;
  life: number;
  maxLife: number;
}

/** Short-lived visuals for instant-hit weapons: rail beams and lightning bolts. */
export class Effects {
  private readonly beams: Beam[] = [];
  private readonly bolts: Bolt[] = [];

  beam(x0: number, y0: number, x1: number, y1: number, width: number, color: string, life = 0.22): void {
    this.beams.push({ x0, y0, x1, y1, width, color, life, maxLife: life });
  }

  /** A jagged lightning segment between two points. */
  bolt(x0: number, y0: number, x1: number, y1: number, color: string, life = 0.18): void {
    const d = len(x1 - x0, y1 - y0);
    const n = Math.max(3, Math.round(d / 18));
    const nx = -(y1 - y0) / (d || 1);
    const ny = (x1 - x0) / (d || 1);
    const pts: number[] = [x0, y0];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      // Bigger kinks in the middle, pinned at both ends.
      const off = (Math.random() - 0.5) * 26 * Math.sin(t * Math.PI);
      pts.push(x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off);
    }
    pts.push(x1, y1);
    this.bolts.push({ pts, color, life, maxLife: life });
  }

  update(dt: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) if ((this.beams[i].life -= dt) <= 0) this.beams.splice(i, 1);
    for (let i = this.bolts.length - 1; i >= 0; i--) if ((this.bolts[i].life -= dt) <= 0) this.bolts.splice(i, 1);
  }

  clear(): void {
    this.beams.length = 0;
    this.bolts.length = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.beams.length && !this.bolts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of this.beams) {
      const t = b.life / b.maxLife;
      // Beam narrows as it fades.
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.35 * t;
      ctx.lineWidth = b.width * 2.6 * t;
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.stroke();
      ctx.globalAlpha = 0.9 * t;
      ctx.lineWidth = b.width * t;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, b.width * 0.3 * t);
      ctx.stroke();
    }

    for (const b of this.bolts) {
      const t = b.life / b.maxLife;
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      // A touch of per-frame jitter so the bolt crackles.
      for (let i = 2; i < b.pts.length - 2; i += 2) ctx.lineTo(b.pts[i] + (Math.random() - 0.5) * 4, b.pts[i + 1] + (Math.random() - 0.5) * 4);
      ctx.lineTo(b.pts[b.pts.length - 2], b.pts[b.pts.length - 1]);
      // Glow, coloured body, white-hot core; fades with an ease so it stays bright for most of its life.
      const a = Math.sqrt(t);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.45 * a;
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.globalAlpha = 0.9 * a;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = a;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}
