import { CONFIG } from '../config';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { renderCrosshair, renderDashRing, renderHud, renderPadReticle, renderWaveBanner } from '../ui/hud';
import type { Door } from '../entities/door';
import { Run, type RunOutcome } from '../run/run';
import { renderTouchHud } from '../ui/touchHud';
import { RoomDirector } from '../world/roomDirector';
import { World, type GameMode } from '../world/world';
import { GameOverState } from './gameover';
import { PauseState } from './pause';
import { RunOverState } from './runOver';
import type { GameState } from './state';

/** The core gameplay state: owns the World for one run. */
export class PlayState implements GameState {
  readonly overlay = false;
  readonly touchControls = true;
  world!: World;
  private gameOverShown = false;
  /** Rogue Run: seconds until the victory screen after the final boss falls (0 = not won). */
  private winTimer = 0;
  private readonly unsubscribeResize: () => void;

  constructor(
    private readonly game: Game,
    readonly mode: GameMode = 'arcade',
    /** Rogue Run only: the run this room belongs to. */
    readonly run?: Run,
  ) {
    this.reset();
    // If the screen changes shape before the first wave starts (e.g. the page
    // loaded in portrait and the phone was then rotated), re-fit the arena.
    // A run keeps the width it started with for every room.
    this.unsubscribeResize = game.display.onResize(() => {
      if (this.run) return;
      const w = this.world;
      const fresh = w.score.kills === 0 && (w.zen ? w.time < 3 : w.waves.wave === 0);
      if (fresh && game.display.preferredWidth() !== w.viewWidth) this.reset();
    });
  }

  exit(): void {
    this.unsubscribeResize();
    this.game.input.pointerToWorld = null;
  }

  /** Start a fresh run. The view width is locked here so the arena never changes shape mid-run. */
  reset(): void {
    this.game.display.setLogicalWidth(this.run ? this.run.viewWidth : this.game.display.preferredWidth());
    const audio = this.game.audio;
    const zen = this.mode === 'zen';
    this.world = new World(
      {
        toast: (text, color) => this.game.toasts.show(text, color),
        rumble: (s, w, ms) => this.game.input.rumble(s, w, ms),
        sound: (name, x) => audio.sfx.play(name, x),
        waveStarted: (_wave, boss) => audio.music.setIntensity(boss ? 2 : 1),
        roomExited: (door) => this.leaveRoom(door),
        runWon: () => (this.winTimer = CONFIG.run.victoryDelay),
      },
      this.mode,
      this.run,
    );
    // Mouse aim targets the floor point under the pointer, whatever the camera.
    this.game.input.pointerToWorld = this.world.screenToFloor;
    this.gameOverShown = false;
    this.winTimer = 0;
    // Zen keeps the soundtrack calm: pads and bass, no drums.
    audio.music.setIntensity(zen ? 0 : 1);
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

    if (this.run && this.game.debug) this.debugKeys(this.run);

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

    if (this.winTimer > 0) {
      this.winTimer -= dt;
      if (this.winTimer <= 0) this.endRun('victory');
    }

    if (!this.world.player.alive && !this.gameOverShown && this.world.deathTime >= CONFIG.player.deathDelay) {
      if (this.run) {
        this.endRun('dead');
      } else {
        this.gameOverShown = true;
        this.game.push(new GameOverState(this.game, this));
      }
    }
  }

  /** Debug overlay on: K clears the room, B skips to this floor's boss. */
  private debugKeys(run: Run): void {
    const input = this.game.input;
    if (input.pressed(Action.DEBUG_CLEAR) && this.world.waves instanceof RoomDirector) this.world.waves.debugClear(this.world);
    if (input.pressed(Action.DEBUG_BOSS) && !run.isBossRoom && !this.game.transitioning) {
      run.captureFrom(this.world.player, this.world.score);
      run.debugSkipToBoss();
      this.game.transition(() => new PlayState(this.game, 'run', run));
    }
  }

  /** Rogue Run: carry the player through the door into the next room. */
  private leaveRoom(door: Door): void {
    const run = this.run;
    if (!run || this.game.transitioning) return;
    run.captureFrom(this.world.player, this.world.score);
    run.advance(door.option, door.side);
    this.game.audio.sfx.play('swap');
    this.game.transition(() => new PlayState(this.game, 'run', run));
  }

  /** Rogue Run: the run is over (death, victory or abandoned) — show the summary. */
  endRun(outcome: Exclude<RunOutcome, 'active'>): void {
    const run = this.run;
    if (!run || this.gameOverShown) return;
    this.gameOverShown = true;
    run.captureFrom(this.world.player, this.world.score);
    run.finish(outcome);
    this.game.push(new RunOverState(this.game, run));
  }

  /** Zen: finish the session and show its summary (there's no death to end it). */
  endSession(): void {
    if (this.gameOverShown) return;
    this.gameOverShown = true;
    this.game.push(new GameOverState(this.game, this));
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
    const p = w.player;
    w.render(
      ctx,
      alpha,
      p.alive
        ? (c) => {
            renderDashRing(c, p, alpha);
            renderPadReticle(c, p, input, alpha);
          }
        : undefined,
    );
    if (p.alive) renderCrosshair(ctx, input, w.time);
    if (w.player.alive) renderWaveBanner(ctx, w);
    renderHud(ctx, w, input);
    if (w.player.alive) renderTouchHud(ctx, input, w.player);
  }
}
