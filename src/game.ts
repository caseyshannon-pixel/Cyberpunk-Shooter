import { COLORS } from './config';
import type { Display } from './core/display';
import { Action } from './input/bindings';
import type { Input } from './input/input';
import type { GameState } from './states/state';
import { Toasts } from './ui/toast';
import { font } from './ui/text';

const STYLE_NAMES = { xbox: 'Xbox-style', playstation: 'PlayStation', generic: 'Generic' } as const;

/** Top-level container: owns the state stack and the shared services. */
export class Game {
  readonly toasts = new Toasts();
  private readonly stack: GameState[] = [];
  /** Real seconds since boot (keeps running while paused). */
  time = 0;
  debug = false;
  private fps = 60;

  constructor(
    readonly display: Display,
    readonly input: Input,
  ) {
    input.onPadConnected((pad) => {
      const style = STYLE_NAMES[pad.style];
      this.toasts.show(`Controller connected · ${style}${pad.standard ? '' : ' (non-standard mapping)'}`, COLORS.cyan);
    });
    input.onPadDisconnected((_pad, wasInUse) => {
      this.toasts.show('Controller disconnected', COLORS.magenta);
      if (wasInUse) this.top?.onControllerLost?.();
    });

    const lost = () => this.top?.onFocusLost?.();
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) lost();
    });
    // Phones/tablets rotated to portrait get a "rotate" overlay (see index.html); pause underneath it.
    const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
    portrait.addEventListener('change', () => {
      if (portrait.matches) lost();
    });
  }

  get top(): GameState | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(state: GameState): void {
    this.stack.push(state);
    state.enter?.();
  }

  pop(): void {
    this.stack.pop()?.exit?.();
  }

  /** Replace the whole stack with a single state. */
  set(state: GameState): void {
    while (this.stack.length) this.pop();
    this.push(state);
  }

  update(dt: number): void {
    this.time += dt;
    this.input.setTouchGameplay(this.top?.touchControls === true);
    this.input.update();
    if (this.input.pressed(Action.DEBUG)) this.debug = !this.debug;
    this.toasts.update(dt);
    this.top?.update(dt);
  }

  render(alpha: number, frameDt: number): void {
    const ctx = this.display.ctx;
    this.display.beginFrame();
    if (frameDt > 0) this.fps += (1 / frameDt - this.fps) * 0.05;

    let from = this.stack.length - 1;
    while (from > 0 && this.stack[from].overlay) from--;
    for (let i = Math.max(0, from); i < this.stack.length; i++) this.stack[i].render(ctx, alpha);

    this.toasts.render(ctx);
    if (this.debug) this.renderDebug(ctx);
  }

  private renderDebug(ctx: CanvasRenderingContext2D): void {
    const i = this.input;
    const lines = [
      `fps ${this.fps.toFixed(0)}  dpr ${this.display.dpr}  scale ${this.display.scale.toFixed(2)}`,
      `device ${i.device}`,
      `pad ${i.pad ? `#${i.pad.index} ${i.pad.style} ${i.pad.standard ? 'standard' : 'NON-standard'}` : 'none'}`,
      i.pad ? `id ${i.pad.id.slice(0, 48)}` : '',
      `move ${i.move.x.toFixed(2)}, ${i.move.y.toFixed(2)}`,
      `aim  ${i.aimStick.x.toFixed(2)}, ${i.aimStick.y.toFixed(2)}`,
      `fire ${i.isDown(Action.FIRE) ? 'ON' : '--'}  dash ${i.isDown(Action.DASH) ? 'ON' : '--'}`,
    ].filter(Boolean);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(8, 8, 380, lines.length * 16 + 10);
    ctx.font = font(12, 'normal');
    ctx.fillStyle = '#9fffa0';
    ctx.textBaseline = 'top';
    lines.forEach((l, n) => ctx.fillText(l, 14, 14 + n * 16));
    ctx.restore();
  }
}
