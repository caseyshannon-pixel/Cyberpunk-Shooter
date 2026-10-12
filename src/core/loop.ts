import { CONFIG, STEP } from '../config';

/**
 * Fixed-timestep loop: simulation always advances in STEP increments (60 Hz),
 * while rendering runs at the display's refresh rate and receives an
 * interpolation factor `alpha` (0..1) between the last two simulation states.
 */
export class FixedLoop {
  private accumulator = 0;
  private last = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let frameTime = (now - this.last) / 1000;
    this.last = now;
    if (frameTime > CONFIG.loop.maxFrameTime) frameTime = CONFIG.loop.maxFrameTime;
    if (frameTime < 0) frameTime = 0;

    this.accumulator += frameTime;
    while (this.accumulator >= STEP) {
      this.update(STEP);
      this.accumulator -= STEP;
    }

    this.render(this.accumulator / STEP, frameTime);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
