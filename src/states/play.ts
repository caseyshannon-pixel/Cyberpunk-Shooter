import { Player } from '../entities/player';
import { Projectiles, renderProjectiles } from '../entities/projectile';
import type { Game } from '../game';
import { Action } from '../input/bindings';
import { renderArena, renderBackground } from '../render/background';
import { renderDashRing, renderHud, renderReticle } from '../ui/hud';
import { Arena } from '../world/arena';
import { PauseState } from './pause';
import type { GameState } from './state';

/** The core gameplay state: owns the world for one run. */
export class PlayState implements GameState {
  readonly overlay = false;
  arena!: Arena;
  player!: Player;
  readonly projectiles = new Projectiles();
  /** Simulation time of this run (stops while paused). */
  time = 0;

  constructor(private readonly game: Game) {
    this.reset();
  }

  reset(): void {
    this.arena = new Arena();
    this.player = new Player(this.arena.centerX, this.arena.centerY + 120);
    this.projectiles.clear();
    this.time = 0;
  }

  update(dt: number): void {
    const input = this.game.input;
    if (input.pressed(Action.PAUSE)) {
      input.consume(Action.PAUSE);
      input.consume(Action.BACK);
      this.pause();
      return;
    }

    this.time += dt;
    this.player.update(dt, input, this.arena, this.projectiles);
    this.projectiles.update(dt, this.arena);
  }

  pause(reason?: string): void {
    this.game.push(new PauseState(this.game, this, reason));
  }

  onControllerLost(): void {
    this.pause('CONTROLLER DISCONNECTED');
  }

  onFocusLost(): void {
    this.pause();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    renderBackground(ctx, this.time);
    renderArena(ctx, this.arena, this.time);
    renderProjectiles(ctx, this.projectiles, alpha);
    renderDashRing(ctx, this.player, alpha);
    this.player.render(ctx, alpha, this.time);
    renderReticle(ctx, this.player, this.game.input, alpha, this.time);
    renderHud(ctx, this.player, this.game.input);
  }
}
