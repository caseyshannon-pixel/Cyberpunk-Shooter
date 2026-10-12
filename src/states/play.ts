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
    // If the screen changes shape before the first wave starts (e.g. the page
    // loaded in portrait and the phone was then rotated), re-fit the arena.
    game.display.onResize(() => {
      const w = this.world;
      if (w.waves.wave === 0 && w.score.kills === 0 && game.display.preferredWidth() !== w.viewWidth) this.reset();
    });
  }

  /** Start a fresh run. The view width is locked here so the arena never changes shape mid-run. */
  reset(): void {
    this.game.display.setLogicalWidth(this.game.display.preferredWidth());
    const audio = this.game.audio;
    this.world = new World({
      toast: (text, color) => this.game.toasts.show(text, color),
      rumble: (s, w, ms) => this.game.input.rumble(s, w, ms),
      sound: (name, x) => audio.sfx.play(name, x),
      waveStarted: (_wave, boss) => audio.music.setIntensity(boss ? 2 : 1),
    });
    this.gameOverShown = false;
    audio.music.setIntensity(1);
    audio.music.start();
    audio.engine.duckMusic(1);
  }

  update(dt: number): void {
    const input = this.game.input;
    if (input.pressed(Action.PAUSE) && this.world.player.alive) {
      input.consume(Action.PAUSE);
      input.consume(Action.BACK);
      this.pause();
      return;
    }

    const w = this.world;
    // Hit-stop: hold the frame for a moment on big impacts.
    if (w.freeze > 0) {
      w.freeze -= dt;
      return;
    }
    let scale = 1;
    if (w.slowMo > 0) {
      w.slowMo -= dt;
      scale = w.slowMoScale;
      if (w.slowMo <= 0) w.slowMoScale = 1;
    }
    w.update(dt * scale, input);

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
