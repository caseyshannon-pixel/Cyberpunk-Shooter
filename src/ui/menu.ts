import { COLORS } from '../config';
import { VIEW } from '../core/view';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { glowText } from './text';

export interface MenuItem {
  label: string;
  run: () => void;
  /** Optional one-line description shown under the menu while this item is selected. */
  hint?: string;
}

export interface MenuOptions {
  /** Y of the first item. */
  y: number;
  spacing?: number;
  /** Half-width of each item's hit box (mouse / touch). */
  halfWidth?: number;
  size?: number;
}

/**
 * Vertical text menu shared by the title, pause and game-over screens:
 * D-pad / stick / arrows to move, A / Enter / Space to choose, mouse hover +
 * click, touch tap — with UI sounds. Back/cancel is left to the owning screen.
 */
export class Menu {
  selected = 0;
  private readonly spacing: number;
  private readonly halfWidth: number;
  private readonly size: number;

  constructor(
    private readonly game: Game,
    readonly items: MenuItem[],
    private readonly opts: MenuOptions,
  ) {
    this.spacing = opts.spacing ?? 46;
    this.halfWidth = opts.halfWidth ?? 190;
    this.size = opts.size ?? 22;
  }

  itemY(i: number): number {
    return this.opts.y + i * this.spacing;
  }

  get bottom(): number {
    return this.itemY(this.items.length - 1);
  }

  private itemAt(x: number, y: number): number {
    if (Math.abs(x - VIEW.width / 2) > this.halfWidth) return -1;
    for (let i = 0; i < this.items.length; i++) if (Math.abs(y - this.itemY(i)) < this.spacing / 2) return i;
    return -1;
  }

  private choose(i: number): void {
    this.selected = i;
    this.game.audio.sfx.play('uiSelect');
    this.items[i].run();
  }

  /** Handle input for this tick. Returns true if an item was activated. */
  update(): boolean {
    const input = this.game.input;
    const n = this.items.length;

    if (input.mouseMoved && input.device === 'keyboard') {
      const hover = this.itemAt(input.mouse.x, input.mouse.y);
      if (hover >= 0 && hover !== this.selected) {
        this.selected = hover;
        this.game.audio.sfx.play('uiMove');
      }
    }
    for (const t of input.taps) {
      const hit = this.itemAt(t.x, t.y);
      if (hit >= 0) {
        this.choose(hit);
        return true;
      }
    }
    if (input.pressed(Action.MENU_UP)) {
      this.selected = (this.selected + n - 1) % n;
      this.game.audio.sfx.play('uiMove');
    }
    if (input.pressed(Action.MENU_DOWN)) {
      this.selected = (this.selected + 1) % n;
      this.game.audio.sfx.play('uiMove');
    }
    if (input.pressed(Action.CONFIRM)) {
      this.choose(this.selected);
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, alpha = 1, time = 0): void {
    const cx = VIEW.width / 2;
    this.items.forEach((item, i) => {
      const sel = i === this.selected;
      const y = this.itemY(i);
      if (sel) {
        // Pulsing selection bar.
        const w = this.halfWidth * 2;
        ctx.save();
        ctx.globalAlpha = alpha * (0.55 + 0.15 * Math.sin(time * 5));
        const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
        g.addColorStop(0, 'rgba(0,240,255,0)');
        g.addColorStop(0.5, 'rgba(0,240,255,0.16)');
        g.addColorStop(1, 'rgba(0,240,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - w / 2, y - this.spacing * 0.36, w, this.spacing * 0.72);
        ctx.restore();
      }
      glowText(ctx, sel ? `>  ${item.label}  <` : item.label, cx, y, {
        size: sel ? this.size + 4 : this.size,
        color: sel ? COLORS.cyan : '#8c7fb0',
        glow: sel ? COLORS.cyan : 'transparent',
        blur: sel ? 16 : 0,
        align: 'center',
        alpha,
      });
    });
    const hint = this.items[this.selected]?.hint;
    if (hint) {
      glowText(ctx, hint, cx, this.bottom + this.spacing * 0.95, { size: 14, color: '#a99bd1', align: 'center', alpha: alpha * 0.9, blur: 0 });
    }
  }
}
