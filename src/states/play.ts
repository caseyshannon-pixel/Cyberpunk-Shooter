import { CONFIG } from '../config';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { renderDashRing, renderHud, renderReticle, renderWaveBanner } from '../ui/hud';
import { renderTouchHud } from '../ui/touchHud';
import { World } from '../world/world';
import { GameOverState } from './gameover';
import { PauseState } from './pause';
import type { GameState } from './state';

/** The core gameplay state: owns the World for one run. */
export class PlayState implements GameState {
  readonly overlay = false;
  readonly touchControls = true;
  world!: World;
  private gameOverShown = false;

  constructor(private readonly game: Game) {
    this.reset();
  }

  reset(): void {
    this.world = new World({
      toast: (text, color) => this.game.toasts.show(text, color),
      rumble: (s, w, ms) => this.game.input.rumble(s, w, ms),
    });
    this.gameOverShown = false;
  }

  update(dt: number): void {
    const input = this.game.input;
    if (input.pressed(Action.PAUSE) && this.world.player.alive) {
      input.consume(Action.PAUSE);
      input.consume(Action.BACK);
      this.pause();
      return;
    }

    this.world.update(dt, input);

    if (!this.world.player.alive && !this.gameOverShown && this.world.deathTime >= CONFIG.player.deathDelay) {
      this.gameOverShown = true;
      this.game.push(new GameOverState(this.game, this));
    }
  }

  pause(reason?: string): void {
    this.game.push(new PauseState(this.game, this, reason));
  }

  onControllerLost(): void {
    if (this.world.player.alive) this.pause('CONTROLLER DISCONNECTED');
  }

  onFocusLost(): void {
    if (this.world.player.alive) this.pause();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const w = this.world;
    const input = this.game.input;
    w.render(ctx, alpha);
    if (w.player.alive) {
      renderDashRing(ctx, w.player, alpha);
      renderReticle(ctx, w.player, input, alpha, w.time);
    }
    renderWaveBanner(ctx, w);
    renderHud(ctx, w, input);
    if (w.player.alive) renderTouchHud(ctx, input, w.player);
  }
}
