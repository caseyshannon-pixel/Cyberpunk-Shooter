import { COLORS, CONFIG } from '../config';
import { storage } from '../core/storage';
import type { Game } from '../game';
import { Menu } from '../ui/menu';
import { formatTime, glowText } from '../ui/text';
import type { PlayState } from './play';
import type { GameState } from './state';
import { TitleState } from './title';
import { VIEW } from '../core/view';

/**
 * Shown over the frozen arena when a run ends: after dying (Arcade) or when a
 * Zen session is ended from the pause menu. Saves the mode's best score.
 */
export class GameOverState implements GameState {
  readonly overlay = true;
  private age = 0;
  private readonly best: number;
  private readonly isNewBest: boolean;
  private readonly menu: Menu;

  constructor(
    private readonly game: Game,
    private readonly play: PlayState,
  ) {
    const score = play.world.score.score;
    // Arcade and Zen keep separate bests.
    const key = play.world.zen ? CONFIG.zen.storageKey : CONFIG.score.storageKey;
    const prev = storage.getNumber(key, 0);
    this.isNewBest = score > prev;
    this.best = Math.max(prev, score);
    if (this.isNewBest) storage.set(key, String(score));
    this.menu = new Menu(
      game,
      [
        { label: play.world.zen ? 'NEW SESSION' : 'RETRY', run: () => this.retry() },
        { label: 'MAIN MENU', run: () => game.transition(() => new TitleState(game)) },
      ],
      { y: VIEW.height / 2 + 150, spacing: 44 },
    );
  }

  enter(): void {
    this.game.audio.music.stop();
    this.game.audio.sfx.play(this.play.world.zen ? 'waveClear' : 'gameOver');
  }

  private retry(): void {
    this.play.reset();
    this.game.pop();
  }

  update(dt: number): void {
    this.age += dt;
    if (this.age < 0.8) return; // ignore inputs still held from the moment of death
    this.menu.update();
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

    if (w.zen) {
      glowText(ctx, 'SESSION COMPLETE', W / 2, H / 2 - 140, { size: 52, color: COLORS.white, glow: COLORS.cyan, blur: 26, align: 'center', alpha: fade });
    } else {
      const glitch = this.age < 0.6 ? (Math.random() - 0.5) * 14 : 0;
      glowText(ctx, 'FLATLINED', W / 2 + glitch, H / 2 - 140, { size: 64, color: COLORS.white, glow: COLORS.red, blur: 26, align: 'center', alpha: fade });
    }

    const rows: [string, string][] = [
      ['SCORE', w.score.score.toLocaleString('en-US')],
      w.zen ? ['TIME', formatTime(w.time)] : ['WAVE', String(w.waves.wave)],
      ['KILLS', String(w.score.kills)],
      ['BEST', this.best.toLocaleString('en-US')],
    ];
    rows.forEach(([label, value], i) => {
      const y = H / 2 - 60 + i * 34;
      glowText(ctx, label, W / 2 - 20, y, { size: 18, color: '#8c7fb0', align: 'right', blur: 0, alpha: fade });
      glowText(ctx, value, W / 2 + 20, y, { size: 22, color: i === 0 ? COLORS.cyan : COLORS.white, align: 'left', alpha: fade });
    });

    if (this.isNewBest) {
      const blink = 0.55 + 0.45 * Math.sin(this.age * 8);
      glowText(ctx, '★ NEW HIGH SCORE ★', W / 2, H / 2 + 90, { size: 20, color: COLORS.yellow, align: 'center', alpha: fade * blink, blur: 14 });
    }

    if (this.age < 0.8) return;
    this.menu.render(ctx, Math.min(1, (this.age - 0.8) / 0.2), this.age);
  }
}
