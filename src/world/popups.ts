import { font } from '../ui/text';

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

/** Floating score numbers ("+400"). Few at a time, so a plain array is fine. */
export class Popups {
  private readonly items: Popup[] = [];

  add(x: number, y: number, text: string, color: string, size = 14, life = 0.8): void {
    if (this.items.length > 40) this.items.shift();
    // Stack above fresh popups at the same spot instead of overlapping them.
    for (const p of this.items) {
      if (p.maxLife - p.life < 0.35 && Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 16) y = p.y - 18;
    }
    this.items.push({ x, y, text, color, size, life, maxLife: life });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      p.y -= 40 * dt;
      if (p.life <= 0) this.items.splice(i, 1);
    }
  }

  clear(): void {
    this.items.length = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.items.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.items) {
      const t = p.life / p.maxLife;
      const pop = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = font(Math.round(p.size * pop));
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(p.text, p.x + 1.5, p.y + 1.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();
  }
}
