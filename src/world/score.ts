import { CONFIG } from '../config';

const S = CONFIG.score;

/**
 * Score with a stepped combo multiplier: every `killsPerLevel` kills in a
 * chain raise it by one (up to `maxMultiplier`). If you stop killing for
 * `comboWindow` seconds it starts dropping one level at a time.
 */
export class ScoreKeeper {
  score = 0;
  kills = 0;
  /** Kills in the current chain. */
  chain = 0;
  /** Seconds left before the multiplier drops a level. */
  timer = 0;
  /** Length of the current timer (window or decay step), for the HUD bar. */
  timerMax: number = S.comboWindow;

  get multiplier(): number {
    return Math.min(S.maxMultiplier, 1 + Math.floor(this.chain / S.killsPerLevel));
  }

  /** 0..1 progress toward the next multiplier level. */
  get levelProgress(): number {
    if (this.multiplier >= S.maxMultiplier) return 1;
    return (this.chain % S.killsPerLevel) / S.killsPerLevel;
  }

  /** Register a kill worth `base` points; returns the points actually awarded. */
  addKill(base: number): number {
    const pts = base * this.multiplier;
    this.score += pts;
    this.kills++;
    this.chain++;
    this.timer = this.timerMax = S.comboWindow;
    return pts;
  }

  addBonus(pts: number): void {
    this.score += pts;
  }

  /** Taking a hit breaks the chain. */
  onPlayerHit(): void {
    if (S.hitResetsCombo) {
      this.chain = 0;
      this.timer = 0;
    }
  }

  update(dt: number): void {
    if (this.chain === 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    // Drop to the start of the previous level.
    const level = this.multiplier;
    this.chain = level <= 1 ? 0 : (level - 2) * S.killsPerLevel;
    this.timer = this.timerMax = S.decayStepTime;
  }
}
