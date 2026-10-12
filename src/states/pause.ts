import { COLORS, CONFIG } from '../config';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { renderPrompts } from '../ui/prompts';
import { glowText } from '../ui/text';
import type { PlayState } from './play';
import type { GameState } from './state';

interface MenuItem {
  label: string;
  run: () => void;
}

export class PauseState implements GameState {
  readonly overlay = true;
  private selected = 0;
  private readonly items: MenuItem[];
  private age = 0;

  constructor(
    private readonly game: Game,
    private readonly play: PlayState,
    private readonly reason?: string,
  ) {
    this.items = [
      { label: 'RESUME', run: () => this.resume() },
      {
        label: 'RESTART',
        run: () => {
          this.play.reset();
          this.resume();
        },
      },
    ];
  }

  private resume(): void {
    this.game.pop();
  }

  update(dt: number): void {
    this.age += dt;
    const input = this.game.input;
    if (input.pressed(Action.MENU_UP)) this.selected = (this.selected + this.items.length - 1) % this.items.length;
    if (input.pressed(Action.MENU_DOWN)) this.selected = (this.selected + 1) % this.items.length;

    if (input.pressed(Action.CONFIRM)) {
      this.items[this.selected].run();
    } else if (input.pressed(Action.PAUSE) || input.pressed(Action.BACK)) {
      this.resume();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    const fade = Math.min(1, this.age / 0.12);

    ctx.save();
    ctx.globalAlpha = 0.72 * fade;
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    glowText(ctx, 'PAUSED', W / 2, H / 2 - 110, { size: 56, color: COLORS.white, glow: COLORS.magenta, blur: 24, align: 'center', alpha: fade });
    if (this.reason) {
      const blink = 0.6 + Math.sin(this.age * 5) * 0.4;
      glowText(ctx, this.reason, W / 2, H / 2 - 60, { size: 16, color: COLORS.magenta, align: 'center', alpha: fade * blink });
    }

    this.items.forEach((item, i) => {
      const sel = i === this.selected;
      const y = H / 2 + i * 46;
      glowText(ctx, sel ? `>  ${item.label}  <` : item.label, W / 2, y, {
        size: sel ? 26 : 22,
        color: sel ? COLORS.cyan : '#8c7fb0',
        glow: sel ? COLORS.cyan : 'transparent',
        blur: sel ? 16 : 0,
        align: 'center',
        alpha: fade,
      });
    });

    renderPrompts(
      ctx,
      [
        { navigate: true, label: 'NAVIGATE' },
        { action: Action.CONFIRM, label: 'SELECT' },
        { action: Action.PAUSE, label: 'RESUME' },
      ],
      this.game.input,
      W / 2,
      H / 2 + 150,
      'center',
      13,
      fade,
    );
  }
}
