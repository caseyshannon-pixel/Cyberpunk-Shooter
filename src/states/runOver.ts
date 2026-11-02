import { COLORS, CONFIG } from '../config';
import type { Game } from '../game';
import { Run } from '../run/run';
import { Menu } from '../ui/menu';
import { glowText } from '../ui/text';
import { VIEW } from '../core/view';
import { PlayState } from './play';
import type { GameState } from './state';
import { TitleState } from './title';

const TITLES = {
  dead: { text: 'FLATLINED', glow: COLORS.red },
  victory: { text: 'RUN COMPLETE', glow: COLORS.cyan },
  abandoned: { text: 'RUN ABANDONED', glow: COLORS.magenta },
} as const;

/** Rogue Run summary over the frozen room: how far you got, then a new run or the title. */
export class RunOverState implements GameState {
  readonly overlay = true;
  private age = 0;
  private readonly menu: Menu;

  constructor(
    private readonly game: Game,
    private readonly run: Run,
  ) {
    this.menu = new Menu(
      game,
      [
        { label: 'NEW RUN', run: () => game.transition(() => new PlayState(game, 'run', new Run(game.display.preferredWidth()))) },
        { label: 'MAIN MENU', run: () => game.transition(() => new TitleState(game)) },
      ],
      { y: VIEW.height / 2 + 150, spacing: 44 },
    );
  }

  enter(): void {
    this.game.audio.music.stop();
    this.game.audio.sfx.play(this.run.outcome === 'victory' ? 'waveClear' : 'gameOver');
  }

  update(dt: number): void {
    this.age += dt;
    if (this.age < 0.8) return; // ignore inputs still held from the moment the run ended
    this.menu.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = VIEW.width;
    const H = VIEW.height;
    const fade = Math.min(1, this.age / 0.4);
    const run = this.run;
    const outcome = run.outcome === 'active' ? 'abandoned' : run.outcome;
    const title = TITLES[outcome];

    ctx.save();
    ctx.globalAlpha = 0.78 * fade;
    ctx.fillStyle = '#05010d';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const glitch = outcome === 'dead' && this.age < 0.6 ? (Math.random() - 0.5) * 14 : 0;
    glowText(ctx, title.text, W / 2 + glitch, H / 2 - 140, { size: 60, color: COLORS.white, glow: title.glow, blur: 26, align: 'center', alpha: fade });

    const { floor, room } = run.room;
    const reached = run.isBossRoom ? `FLOOR ${floor} · BOSS` : `FLOOR ${floor} · ROOM ${room}`;
    const rows: [string, string][] = [
      ['REACHED', outcome === 'victory' ? `ALL ${CONFIG.run.floors} FLOORS` : reached],
      ['SCORE', run.score.toLocaleString('en-US')],
      ['KILLS', String(run.kills)],
      ['ROOMS CLEARED', String(run.roomsCleared)],
    ];
    rows.forEach(([label, value], i) => {
      const y = H / 2 - 60 + i * 34;
      glowText(ctx, label, W / 2 - 20, y, { size: 18, color: '#8c7fb0', align: 'right', blur: 0, alpha: fade });
      glowText(ctx, value, W / 2 + 20, y, { size: 22, color: i === 0 ? COLORS.cyan : COLORS.white, align: 'left', alpha: fade });
    });

    if (this.age < 0.8) return;
    this.menu.render(ctx, Math.min(1, (this.age - 0.8) / 0.2), this.age);
  }
}
