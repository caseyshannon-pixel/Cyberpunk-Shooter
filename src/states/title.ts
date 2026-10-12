import { COLORS, CONFIG } from '../config';
import { storage } from '../core/storage';
import { VIEW } from '../core/view';
import { Enemy, renderEnemy, type EnemyKind } from '../entities/enemy';
import { Particles } from '../entities/particles';
import type { Game } from '../game';
import { actionGlyph } from '../input/glyphs';
import { Action } from '../input/bindings';
import { renderArena, renderBackground } from '../render/background';
import { Menu } from '../ui/menu';
import { font, glowText } from '../ui/text';
import { Arena } from '../world/arena';
import { ControlsState } from './controls';
import { PlayState } from './play';
import { SettingsState } from './settings';
import type { GameState } from './state';

const ATTRACT: EnemyKind[] = ['drone', 'gunner', 'splitter', 'drone', 'bruiser', 'drone', 'splitling', 'gunner'];

/**
 * Title screen: animated logo over the live grid with a few enemies drifting
 * past. First "press any button" (which also unlocks audio), then the main menu.
 */
export class TitleState implements GameState {
  readonly overlay = false;
  private arena: Arena;
  private readonly particles = new Particles();
  private readonly attract: Enemy[] = [];
  private time = 0;
  private phase: 'press' | 'menu' = 'press';
  private readonly menu: Menu;
  private best = 0;
  private zenBest = 0;
  private glitch = 0;
  private readonly unsubscribeResize: () => void;

  constructor(private readonly game: Game) {
    this.arena = this.fitArena();
    this.menu = new Menu(
      game,
      [
        {
          label: 'START',
          hint: 'Waves, bosses and 5 hits — chase the high score.',
          run: () => game.transition(() => new PlayState(game, 'arcade')),
        },
        {
          label: 'ZEN MODE',
          hint: 'No damage, no bosses — an endless, calm flow. Unwind.',
          run: () => game.transition(() => new PlayState(game, 'zen')),
        },
        { label: 'CONTROLS', run: () => game.push(new ControlsState(game)) },
        { label: 'SETTINGS', run: () => game.push(new SettingsState(game)) },
      ],
      { y: VIEW.height / 2 + 56, spacing: 46, size: 24 },
    );
    ATTRACT.forEach((kind) => this.attract.push(new Enemy(kind, 0, 0)));
    this.unsubscribeResize = game.display.onResize(() => {
      // The title isn't mid-run, so it can always follow the screen's shape.
      if (game.display.preferredWidth() !== VIEW.width) this.arena = this.fitArena();
    });
  }

  private fitArena(): Arena {
    this.game.display.setLogicalWidth(this.game.display.preferredWidth());
    return new Arena(VIEW.width);
  }

  enter(): void {
    this.best = storage.getNumber(CONFIG.score.storageKey, 0);
    this.zenBest = storage.getNumber(CONFIG.zen.storageKey, 0);
    const music = this.game.audio.music;
    music.setIntensity(0);
    music.start();
    this.game.audio.engine.duckMusic(1);
  }

  exit(): void {
    this.unsubscribeResize();
  }

  update(dt: number): void {
    this.time += dt;
    this.particles.update(dt);
    this.glitch = Math.max(0, this.glitch - dt);
    if (Math.random() < dt * 0.6) this.glitch = 0.12;

    // Attract mode: enemies drift along slow Lissajous paths.
    const b = this.arena.bounds;
    this.attract.forEach((e, i) => {
      const t = this.time * (0.12 + i * 0.013) + i * 1.7;
      e.prevX = e.x;
      e.prevY = e.y;
      e.prevAngle = e.angle;
      e.x = b.x + b.w / 2 + Math.cos(t * 1.3) * (b.w * 0.42);
      e.y = b.y + b.h / 2 + Math.sin(t * 2.1 + i) * (b.h * 0.36);
      e.angle = Math.atan2(e.y - e.prevY, e.x - e.prevX);
      e.age += dt;
      if (Math.random() < dt * 0.08) this.particles.burst(e.x, e.y, e.def.color, 10, 40, 160, 0.3, 0.7, 2);
    });

    const input = this.game.input;
    if (this.phase === 'press') {
      if (input.anyPressed()) {
        this.phase = 'menu';
        this.game.audio.sfx.play('uiSelect');
        this.particles.ring(VIEW.width / 2, VIEW.height / 2 - 70, COLORS.cyan, 420, 0.6, 3);
      }
      return;
    }
    this.menu.update();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    const W = VIEW.width;
    const H = VIEW.height;
    renderBackground(ctx, this.time, this.arena);
    renderArena(ctx, this.arena, this.time);

    ctx.save();
    ctx.globalAlpha = 0.45;
    for (const e of this.attract) renderEnemy(ctx, e, alpha);
    ctx.restore();
    this.particles.render(ctx, alpha);

    // Dim the middle so the logo and menu read clearly.
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.55);
    g.addColorStop(0, 'rgba(2,0,8,0.78)');
    g.addColorStop(1, 'rgba(2,0,8,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    this.renderLogo(ctx, W / 2, H / 2 - 120);

    if (this.phase === 'press') {
      const blink = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 2.4));
      glowText(ctx, this.pressText(), W / 2, H / 2 + 90, { size: 22, color: COLORS.white, glow: COLORS.magenta, blur: 14, align: 'center', alpha: blink });
    } else {
      this.menu.render(ctx, 1, this.time);
    }

    const bests = [
      this.best > 0 ? `BEST  ${this.best.toLocaleString('en-US')}` : '',
      this.zenBest > 0 ? `ZEN BEST  ${this.zenBest.toLocaleString('en-US')}` : '',
    ].filter(Boolean);
    if (bests.length) {
      glowText(ctx, bests.join('     ·     '), W / 2, H - 66, { size: 15, color: COLORS.yellow, align: 'center', blur: 8 });
    }
    glowText(ctx, 'v1.0  //  SURVIVE THE GRID', W / 2, H - 38, { size: 11, color: '#6f5f99', align: 'center', blur: 0 });
  }

  private pressText(): string {
    const input = this.game.input;
    if (input.device === 'touch') return 'TAP TO START';
    if (input.device === 'gamepad') return `PRESS ${actionGlyph(Action.CONFIRM, 'gamepad', input.pad?.style)}`;
    return 'PRESS ANY KEY';
  }

  /** Big chromatic-split logo with occasional horizontal glitch slices. */
  private renderLogo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const text = 'NEON//GRID';
    const size = 104;
    const jitter = this.glitch > 0 ? (Math.random() - 0.5) * 14 : 0;
    ctx.save();
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'lighter';
    // Colour-split copies.
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = COLORS.magenta;
    ctx.fillText(text, x - 4 + jitter, y + 2);
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText(text, x + 4 - jitter, y - 2);
    // Main white text with glow.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.shadowColor = COLORS.purple;
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;

    // Glitch: shift a couple of horizontal bands sideways.
    if (this.glitch > 0) {
      for (let i = 0; i < 3; i++) {
        const by = y - size / 2 + Math.random() * size;
        const bh = 4 + Math.random() * 10;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, by, VIEW.width, bh);
        ctx.clip();
        ctx.fillStyle = Math.random() < 0.5 ? COLORS.cyan : COLORS.magenta;
        ctx.fillText(text, x + (Math.random() - 0.5) * 40, y);
        ctx.restore();
      }
    }

    // Underline bar.
    const w = ctx.measureText(text).width;
    const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    grad.addColorStop(0, COLORS.cyan);
    grad.addColorStop(1, COLORS.magenta);
    ctx.fillStyle = grad;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 14;
    ctx.fillRect(x - w / 2, y + size / 2 + 4, w, 3);
    ctx.restore();

    glowText(ctx, 'CYBER-RUNNER  //  TWIN-STICK SURVIVAL', x, y + size / 2 + 34, { size: 16, color: COLORS.cyan, align: 'center', blur: 8 });
  }
}
