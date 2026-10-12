import { COLORS, CONFIG } from '../config';
import { font } from './text';

interface Toast {
  text: string;
  color: string;
  age: number;
  duration: number;
}

/** Small stacked notifications at the top of the screen ("Controller connected", …). */
export class Toasts {
  private readonly items: Toast[] = [];

  show(text: string, color: string = COLORS.cyan, duration: number = CONFIG.ui.toastDuration): void {
    // Replace an identical toast rather than stacking duplicates.
    const existing = this.items.find((t) => t.text === text);
    if (existing) {
      existing.age = 0;
      return;
    }
    this.items.push({ text, color, age: 0, duration });
    if (this.items.length > 4) this.items.shift();
  }

  /** Uses real (unscaled) time so toasts still fade while the game is paused. */
  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].age += dt;
      if (this.items[i].age >= this.items[i].duration) this.items.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const cx = CONFIG.view.width / 2;
    let y: number = CONFIG.ui.toastY;
    ctx.save();
    ctx.font = font(15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.items) {
      const fadeIn = Math.min(1, t.age / 0.15);
      const fadeOut = Math.min(1, (t.duration - t.age) / 0.4);
      const a = Math.min(fadeIn, fadeOut);
      const w = ctx.measureText(t.text).width + 40;
      const slide = (1 - fadeIn) * -10;

      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8, 0, 24, 0.88)';
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, y - 16 + slide, w, 32, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 6;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, cx, y + 1 + slide);
      y += 40;
    }
    ctx.restore();
  }
}
