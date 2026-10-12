import { COLORS, CONFIG } from '../config';
import { storage } from '../core/storage';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { renderPrompts } from '../ui/prompts';
import { glowText } from '../ui/text';
import type { PlayState } from './play';
import type { GameState } from './state';
import { VIEW } from '../core/view';

/** Shown over the frozen arena after the player dies. Saves the high score. */
export class GameOverState implements GameState {
  readonly overlay = true;
  private age = 0;
  private readonly best: number;
  private readonly isNewBest: boolean;

  constructor(
    private readonly game: Game,
    private readonly play: PlayState,
  ) {
    const score = play.world.score.score;
    const prev = storage.getNumber(CONFIG.score.storageKey, 0);
    this.isNewBest = score > prev;
    this.best = Math.max(prev, score);
    if (this.isNewBest) storage.set(CONFIG.score.storageKey, String(score));
  }

  enter(): void {
    this.game.audio.music.stop();
    this.game.audio.sfx.play('gameOver');
  }

  private retry(): void {
    this.game.audio.sfx.play('uiSelect');
    this.play.reset();
    this.game.pop();
  }

  update(dt: number): void {
    this.age += dt;
    if (this.age < 0.8) return; // ignore inputs still held from the moment of death
    const input = this.game.input;
    if (input.pressed(Action.CONFIRM) || input.pressed(Action.PAUSE) || input.taps.length) this.retry();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = VIEW.width;
    const H = VIEW.height;
    const fade = Math.min(1, this.age / 0.4);
    const w = this.play.world;

    ctx.save();
    ctx.globalAlpha = 0.78 * fade;
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const glitch = this.age < 0.6 ? (Math.random() - 0.5) * 14 : 0;
    glowText(ctx, 'FLATLINED', W / 2 + glitch, H / 2 - 130, { size: 64, color: COLORS.white, glow: COLORS.red, blur: 26, align: 'center', alpha: fade });

    const rows: [string, string][] = [
      ['SCORE', w.score.score.toLocaleString('en-US')],
      ['WAVE', String(w.waves.wave)],
      ['KILLS', String(w.score.kills)],
      ['BEST', this.best.toLocaleString('en-US')],
    ];
    rows.forEach(([label, value], i) => {
      const y = H / 2 - 50 + i * 34;
      glowText(ctx, label, W / 2 - 20, y, { size: 18, color: '#8c7fb0', align: 'right', blur: 0, alpha: fade });
      glowText(ctx, value, W / 2 + 20, y, { size: 22, color: i === 0 ? COLORS.cyan : COLORS.white, align: 'left', alpha: fade });
    });

    if (this.isNewBest) {
      const blink = 0.55 + 0.45 * Math.sin(this.age * 8);
      glowText(ctx, '★ NEW HIGH SCORE ★', W / 2, H / 2 + 100, { size: 20, color: COLORS.yellow, align: 'center', alpha: fade * blink, blur: 14 });
    }

    if (this.age < 0.8) return;
    const input = this.game.input;
    if (input.device === 'touch') {
      glowText(ctx, 'TAP TO RETRY', W / 2, H / 2 + 160, { size: 16, color: COLORS.white, align: 'center', blur: 0 });
    } else {
      renderPrompts(ctx, [{ action: Action.CONFIRM, label: 'RETRY' }], input, W / 2, H / 2 + 160, 'center', 14);
    }
  }
}
