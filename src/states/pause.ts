import { COLORS } from '../config';
import { VIEW } from '../core/view';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { Menu } from '../ui/menu';
import { renderPrompts } from '../ui/prompts';
import { glowText } from '../ui/text';
import { ControlsState } from './controls';
import type { PlayState } from './play';
import { SettingsState } from './settings';
import type { GameState } from './state';
import { TitleState } from './title';

export class PauseState implements GameState {
  readonly overlay = true;
  private readonly menu: Menu;
  private age = 0;

  constructor(
    private readonly game: Game,
    private readonly play: PlayState,
    private readonly reason?: string,
  ) {
    this.menu = new Menu(
      game,
      [
        { label: 'RESUME', run: () => this.resume() },
        { label: 'SETTINGS', run: () => game.push(new SettingsState(game)) },
        { label: 'CONTROLS', run: () => game.push(new ControlsState(game)) },
        {
          label: 'RESTART',
          run: () => {
            this.play.reset();
            this.resume();
          },
        },
        { label: 'QUIT TO TITLE', run: () => game.transition(() => new TitleState(game)) },
      ],
      { y: VIEW.height / 2 - 30, spacing: 44 },
    );
  }

  enter(): void {
    this.game.audio.engine.duckMusic(0.35);
    this.game.audio.sfx.play('uiSelect');
  }

  exit(): void {
    this.game.audio.engine.duckMusic(1);
  }

  private resume(): void {
    this.game.audio.sfx.play('uiBack');
    this.game.pop();
  }

  update(dt: number): void {
    this.age += dt;
    if (this.menu.update()) return;
    const input = this.game.input;
    if (input.pressed(Action.PAUSE) || input.pressed(Action.BACK)) this.resume();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = VIEW.width;
    const H = VIEW.height;
    const fade = Math.min(1, this.age / 0.12);

    ctx.save();
    ctx.globalAlpha = 0.72 * fade;
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    glowText(ctx, 'PAUSED', W / 2, H / 2 - 150, { size: 56, color: COLORS.white, glow: COLORS.magenta, blur: 24, align: 'center', alpha: fade });
    if (this.reason) {
      const blink = 0.6 + Math.sin(this.age * 5) * 0.4;
      glowText(ctx, this.reason, W / 2, H / 2 - 100, { size: 16, color: COLORS.magenta, align: 'center', alpha: fade * blink });
    }

    this.menu.render(ctx, fade, this.age);

    const py = this.menu.bottom + 64;
    if (this.game.input.device === 'touch') {
      glowText(ctx, 'TAP AN OPTION', W / 2, py, { size: 14, color: COLORS.white, align: 'center', alpha: fade * 0.8, blur: 0 });
      return;
    }
    renderPrompts(
      ctx,
      [
        { navigate: true, label: 'NAVIGATE' },
        { action: Action.CONFIRM, label: 'SELECT' },
        { action: Action.PAUSE, label: 'RESUME' },
      ],
      this.game.input,
      W / 2,
      py,
      'center',
      13,
      fade,
    );
  }
}
