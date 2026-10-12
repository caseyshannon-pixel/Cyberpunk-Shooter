/**
 * A screen / mode of the game (title, playing, paused, game over…). States
 * live on a stack: only the top state updates, and overlay states (like
 * pause) let the states beneath them keep rendering.
 */
export interface GameState {
  /** If true, the state below is rendered first (this one draws on top). */
  readonly overlay: boolean;
  /** Overlay that hides other overlays beneath it (the base screen still shows through). */
  readonly covers?: boolean;
  /** If true, touches drive the virtual sticks/buttons; otherwise they're menu taps. */
  readonly touchControls?: boolean;
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  /** The active controller was unplugged while this state was on top. */
  onControllerLost?(): void;
  /** The tab/window lost focus while this state was on top. */
  onFocusLost?(): void;
}
