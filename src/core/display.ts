import { CONFIG } from '../config';
import { onFullscreenChange } from './fullscreen';
import type { Vec2 } from './math';
import { VIEW } from './view';

/**
 * Owns the canvas. Scales the fixed logical resolution to fit the available
 * area (the #stage element, which is inset by iOS safe areas) while
 * preserving aspect ratio, and sizes the backing store by devicePixelRatio
 * (capped) so everything renders crisply on high-DPI screens.
 */
export class Display {
  readonly ctx: CanvasRenderingContext2D;
  /** Logical width (varies per run, see VIEW). */
  get width(): number {
    return VIEW.width;
  }
  get height(): number {
    return VIEW.height;
  }
  /** CSS pixels per logical pixel. */
  scale = 1;
  dpr = 1;
  /** Backing-store pixels per logical pixel. */
  pixelRatio = 1;

  private readonly stage: HTMLElement;
  private readonly resizeListeners: (() => void)[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.stage = canvas.parentElement ?? document.body;

    window.addEventListener('resize', this.resize);
    // iOS reports stale dimensions right after rotating; measure again shortly after.
    window.addEventListener('orientationchange', () => {
      this.resize();
      setTimeout(this.resize, 300);
    });
    // Safari's toolbars collapsing/expanding changes the visual viewport.
    window.visualViewport?.addEventListener('resize', this.resize);
    onFullscreenChange(this.resize);
    this.watchDpr();
    this.resize();
  }

  /** Listen for size changes; returns a function that removes the listener. */
  onResize(fn: () => void): () => void {
    this.resizeListeners.push(fn);
    return () => {
      const i = this.resizeListeners.indexOf(fn);
      if (i >= 0) this.resizeListeners.splice(i, 1);
    };
  }

  private watchDpr(): void {
    // Fires when the window moves between monitors with different DPR.
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const handler = () => {
      mq.removeEventListener('change', handler);
      this.resize();
      this.watchDpr();
    };
    mq.addEventListener('change', handler);
  }

  /** CSS size of the area the canvas may occupy (window minus safe-area insets). */
  private available(): { w: number; h: number } {
    const cs = getComputedStyle(this.stage);
    return {
      w: this.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      h: this.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
    };
  }

  /**
   * The logical width that would fill the current screen with no side bars:
   * 1280 for 16:9 or narrower, wider for phones in landscape (capped).
   */
  preferredWidth(): number {
    const { w, h } = this.available();
    if (w <= 0 || h <= 0 || h > w) return CONFIG.view.width;
    const ideal = Math.round((VIEW.height * w) / h / 2) * 2;
    return Math.max(CONFIG.view.width, Math.min(CONFIG.view.maxWidth, ideal));
  }

  /** Lock the logical width (done at the start of each run) and refit the canvas. */
  setLogicalWidth(width: number): void {
    if (width === VIEW.width) return;
    VIEW.width = width;
    this.resize();
  }

  resize = (): void => {
    const { w: availW, h: availH } = this.available();
    if (availW <= 0 || availH <= 0) return;

    const scale = Math.min(availW / this.width, availH / this.height);
    const cssW = Math.floor(this.width * scale);
    const cssH = Math.floor(this.height * scale);
    this.scale = cssW / this.width;
    this.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxDpr);

    const bw = Math.round(cssW * this.dpr);
    const bh = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.pixelRatio = bw / this.width;
    for (const fn of this.resizeListeners) fn();
  };

  /** Reset the transform so drawing uses logical coordinates. */
  beginFrame(): void {
    const s = this.pixelRatio;
    this.ctx.setTransform(s, 0, 0, s, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.shadowBlur = 0;
  }

  /** Convert a pointer client position into logical game coordinates (may fall outside the view). */
  clientToLogical(clientX: number, clientY: number, out: Vec2): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    out.x = ((clientX - rect.left) / rect.width) * this.width;
    out.y = ((clientY - rect.top) / rect.height) * this.height;
    return out;
  }
}
