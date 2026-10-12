import { CONFIG } from '../config';
import type { Vec2 } from './math';

/**
 * Owns the canvas. Scales the fixed logical resolution to fit the window while
 * preserving aspect ratio (letterboxed), and sizes the backing store by
 * devicePixelRatio so everything renders crisply on high-DPI screens.
 */
export class Display {
  readonly ctx: CanvasRenderingContext2D;
  readonly width = CONFIG.view.width;
  readonly height = CONFIG.view.height;
  /** CSS pixels per logical pixel. */
  scale = 1;
  dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    window.addEventListener('resize', this.resize);
    // Fires when the window moves between monitors with different DPR.
    this.watchDpr();
    this.resize();
  }

  private watchDpr(): void {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener(
      'change',
      () => {
        this.resize();
        this.watchDpr();
      },
      { once: true },
    );
  }

  resize = (): void => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const scale = Math.min(winW / this.width, winH / this.height);
    const cssW = Math.floor(this.width * scale);
    const cssH = Math.floor(this.height * scale);
    this.scale = cssW / this.width;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
  };

  /** Reset the transform so drawing uses logical coordinates. */
  beginFrame(): void {
    const s = (this.canvas.width / this.width);
    this.ctx.setTransform(s, 0, 0, s, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.shadowBlur = 0;
  }

  /** Convert a mouse/pointer client position into logical game coordinates. */
  clientToLogical(clientX: number, clientY: number, out: Vec2): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    out.x = ((clientX - rect.left) / rect.width) * this.width;
    out.y = ((clientY - rect.top) / rect.height) * this.height;
    return out;
  }
}
