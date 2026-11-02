import type { WavePhase } from './waves';
import type { World } from './world';

/**
 * Decides what spawns and when. Arcade/Zen use the WaveDirector; Rogue Run
 * uses a RoomDirector per room. The HUD and World only talk to this.
 */
export interface Director {
  readonly wave: number;
  readonly phase: WavePhase;
  readonly phaseAge: number;
  readonly timer: number;
  readonly isBossWave: boolean;
  /** Enemy stat scales for the current wave/room. */
  readonly hpScale: number;
  readonly speedScale: number;
  /** HP scale for a boss spawned now. */
  readonly bossHpScale: number;
  /** Which boss this is (the HUD boss bar's number). */
  readonly bossNumber: number;
  /** Enemies still to come (queued or telegraphed). */
  readonly remaining: number;
  /** HUD label next to the health pips ('' = none). */
  readonly label: string;
  /** Centre banner while a wave is announced. */
  readonly bannerText: string;
  /** Centre banner after a wave is cleared. */
  readonly clearText: string;
  update(dt: number, w: World): void;
  /** Spawn telegraphs on the floor. */
  renderMarkers(ctx: CanvasRenderingContext2D, time: number): void;
  /** Extra floor-level things the director owns (doors, pedestals). */
  renderRoom?(ctx: CanvasRenderingContext2D, w: World): void;
}
