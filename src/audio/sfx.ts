import { VIEW } from '../core/view';
import type { AudioEngine } from './engine';

/** Every sound the game can play. Weapon shots are `shoot_<weaponId>`. */
export type SfxName =
  | 'shoot_pulse'
  | 'shoot_spread'
  | 'shoot_rail'
  | 'shoot_homing'
  | 'shoot_ricochet'
  | 'shoot_arc'
  | 'shoot_nova'
  | 'railCharge'
  | 'bounce'
  | 'empty'
  | 'swap'
  | 'enemyShoot'
  | 'hit'
  | 'enemyDie'
  | 'explosion'
  | 'bossExplosion'
  | 'playerHit'
  | 'playerDeath'
  | 'shieldHit'
  | 'dash'
  | 'pickupWeapon'
  | 'pickupBuff'
  | 'pickupHealth'
  | 'emp'
  | 'spawn'
  | 'charge'
  | 'stomp'
  | 'enrage'
  | 'waveStart'
  | 'bossAlarm'
  | 'waveClear'
  | 'gameOver'
  | 'uiMove'
  | 'uiSelect'
  | 'uiBack';

type Recipe = (a: AudioEngine, pan: number | undefined) => void;

/**
 * Minimum seconds between two plays of the same sound — stops rapid fire,
 * 20-bullet boss rings or multi-kills from stacking into a clipping wall.
 */
const MIN_GAP: Partial<Record<SfxName, number>> = {
  shoot_pulse: 0.045,
  shoot_spread: 0.06,
  shoot_homing: 0.06,
  shoot_arc: 0.05,
  enemyShoot: 0.07,
  hit: 0.035,
  enemyDie: 0.04,
  bounce: 0.05,
  spawn: 0.12,
  explosion: 0.08,
  uiMove: 0.03,
};

const RECIPES: Record<SfxName, Recipe> = {
  shoot_pulse: (a, pan) => {
    a.tone({ type: 'square', freq: 1100, freqEnd: 420, dur: 0.07, vol: 0.07, pan, filter: { type: 'lowpass', freq: 3200 } });
  },
  shoot_spread: (a, pan) => {
    a.noise({ dur: 0.07, vol: 0.09, pan, filter: { type: 'bandpass', freq: 2400, freqEnd: 900, q: 1.2 } });
    a.tone({ type: 'sawtooth', freq: 640, freqEnd: 260, dur: 0.09, vol: 0.06, pan, filter: { type: 'lowpass', freq: 2200 } });
  },
  shoot_rail: (a, pan) => {
    a.tone({ type: 'sawtooth', freq: 1500, freqEnd: 70, dur: 0.42, vol: 0.18, pan, filter: { type: 'lowpass', freq: 6000, freqEnd: 300 } });
    a.tone({ type: 'sine', freq: 140, freqEnd: 40, dur: 0.35, vol: 0.25, pan });
    a.noise({ dur: 0.25, vol: 0.12, pan, filter: { type: 'highpass', freq: 2500 } });
  },
  shoot_homing: (a, pan) => {
    a.tone({ type: 'triangle', freq: 520, freqEnd: 1300, dur: 0.11, vol: 0.08, pan });
  },
  shoot_ricochet: (a, pan) => {
    a.tone({ type: 'square', freq: 300, freqEnd: 720, dur: 0.09, vol: 0.07, pan, filter: { type: 'lowpass', freq: 2500 } });
  },
  shoot_arc: (a, pan) => {
    a.noise({ dur: 0.12, vol: 0.13, pan, filter: { type: 'highpass', freq: 3000 } });
    a.tone({ type: 'sawtooth', freq: 90 + Math.random() * 60, dur: 0.1, vol: 0.08, pan, filter: { type: 'bandpass', freq: 1800, q: 4 } });
  },
  shoot_nova: (a, pan) => {
    a.tone({ type: 'sawtooth', freq: 180, freqEnd: 1400, dur: 0.22, vol: 0.1, pan, filter: { type: 'lowpass', freq: 3500 } });
    a.noise({ dur: 0.2, vol: 0.08, pan, filter: { type: 'bandpass', freq: 1500, freqEnd: 5000, q: 0.8 } });
  },
  railCharge: (a, pan) => {
    a.tone({ type: 'sine', freq: 220, freqEnd: 1100, dur: 0.4, vol: 0.06, attack: 0.05, pan });
  },
  bounce: (a, pan) => {
    a.tone({ type: 'sine', freq: 1500, freqEnd: 1100, dur: 0.06, vol: 0.06, pan });
  },
  empty: (a) => {
    a.tone({ type: 'square', freq: 180, freqEnd: 90, dur: 0.12, vol: 0.06, filter: { type: 'lowpass', freq: 900 } });
  },
  swap: (a) => {
    a.tone({ type: 'square', freq: 700, dur: 0.035, vol: 0.05 });
    a.tone({ type: 'square', freq: 1050, dur: 0.05, vol: 0.05, delay: 0.035 });
  },
  enemyShoot: (a, pan) => {
    a.tone({ type: 'triangle', freq: 640, freqEnd: 230, dur: 0.16, vol: 0.06, pan });
  },
  hit: (a, pan) => {
    a.noise({ dur: 0.035, vol: 0.06, pan, filter: { type: 'bandpass', freq: 3200, q: 2 } });
  },
  enemyDie: (a, pan) => {
    a.noise({ dur: 0.26, vol: 0.13, pan, filter: { type: 'lowpass', freq: 2200, freqEnd: 180 } });
    a.tone({ type: 'sine', freq: 240, freqEnd: 50, dur: 0.2, vol: 0.12, pan });
  },
  explosion: (a, pan) => {
    a.noise({ dur: 0.7, vol: 0.24, pan, filter: { type: 'lowpass', freq: 1400, freqEnd: 80 } });
    a.tone({ type: 'sine', freq: 110, freqEnd: 28, dur: 0.6, vol: 0.3, pan });
  },
  bossExplosion: (a) => {
    a.noise({ dur: 2.0, vol: 0.35, filter: { type: 'lowpass', freq: 2000, freqEnd: 50 } });
    a.tone({ type: 'sine', freq: 90, freqEnd: 20, dur: 1.8, vol: 0.4 });
    a.tone({ type: 'sawtooth', freq: 400, freqEnd: 30, dur: 1.4, vol: 0.12, filter: { type: 'lowpass', freq: 1200 } });
    for (let i = 1; i <= 3; i++) a.noise({ dur: 0.5, vol: 0.18, delay: i * 0.22, filter: { type: 'lowpass', freq: 1800, freqEnd: 120 } });
  },
  playerHit: (a) => {
    a.tone({ type: 'square', freq: 260, freqEnd: 70, dur: 0.28, vol: 0.16, filter: { type: 'lowpass', freq: 2200 } });
    a.noise({ dur: 0.18, vol: 0.14, filter: { type: 'bandpass', freq: 1200, q: 1 } });
  },
  playerDeath: (a) => {
    a.tone({ type: 'sawtooth', freq: 600, freqEnd: 30, dur: 1.2, vol: 0.2, filter: { type: 'lowpass', freq: 3000, freqEnd: 100 } });
    a.noise({ dur: 1.0, vol: 0.25, filter: { type: 'lowpass', freq: 1800, freqEnd: 60 } });
  },
  shieldHit: (a) => {
    a.tone({ type: 'sine', freq: 1600, freqEnd: 620, dur: 0.18, vol: 0.12 });
    a.tone({ type: 'triangle', freq: 2400, freqEnd: 1800, dur: 0.25, vol: 0.05 });
  },
  dash: (a, pan) => {
    a.noise({ dur: 0.2, vol: 0.12, pan, attack: 0.02, filter: { type: 'bandpass', freq: 500, freqEnd: 2600, q: 1.5 } });
  },
  pickupWeapon: (a) => {
    [660, 880, 1320].forEach((f, i) => a.tone({ type: 'square', freq: f, dur: 0.09, vol: 0.07, delay: i * 0.055, filter: { type: 'lowpass', freq: 4000 } }));
  },
  pickupBuff: (a) => {
    [523, 659, 784, 1047].forEach((f, i) => a.tone({ type: 'triangle', freq: f, dur: 0.14, vol: 0.09, delay: i * 0.045 }));
  },
  pickupHealth: (a) => {
    a.tone({ type: 'sine', freq: 520, freqEnd: 1040, dur: 0.25, vol: 0.14 });
    a.tone({ type: 'sine', freq: 780, freqEnd: 1560, dur: 0.25, vol: 0.07, delay: 0.06 });
  },
  emp: (a) => {
    a.tone({ type: 'sawtooth', freq: 1800, freqEnd: 50, dur: 0.7, vol: 0.18, filter: { type: 'lowpass', freq: 5000, freqEnd: 200 } });
    a.noise({ dur: 0.6, vol: 0.18, filter: { type: 'highpass', freq: 1500, freqEnd: 200 } });
    a.tone({ type: 'sine', freq: 60, dur: 0.5, vol: 0.25 });
  },
  spawn: (a, pan) => {
    a.tone({ type: 'sine', freq: 300, freqEnd: 900, dur: 0.16, vol: 0.035, attack: 0.03, pan });
  },
  charge: (a, pan) => {
    a.tone({ type: 'sawtooth', freq: 70, freqEnd: 140, dur: 0.6, vol: 0.12, attack: 0.1, pan, filter: { type: 'lowpass', freq: 600 } });
  },
  stomp: (a) => {
    a.tone({ type: 'sine', freq: 90, freqEnd: 25, dur: 0.5, vol: 0.35 });
    a.noise({ dur: 0.4, vol: 0.2, filter: { type: 'lowpass', freq: 900, freqEnd: 60 } });
  },
  enrage: (a) => {
    a.tone({ type: 'sawtooth', freq: 55, freqEnd: 110, dur: 1.0, vol: 0.2, attack: 0.1, filter: { type: 'lowpass', freq: 800 } });
    a.tone({ type: 'sawtooth', freq: 57, freqEnd: 113, dur: 1.0, vol: 0.2, attack: 0.1, filter: { type: 'lowpass', freq: 800 } });
  },
  waveStart: (a) => {
    a.tone({ type: 'sawtooth', freq: 220, dur: 0.18, vol: 0.1, filter: { type: 'lowpass', freq: 1800 } });
    a.tone({ type: 'sawtooth', freq: 330, dur: 0.3, vol: 0.1, delay: 0.16, filter: { type: 'lowpass', freq: 2200 } });
  },
  bossAlarm: (a) => {
    for (let i = 0; i < 3; i++) {
      a.tone({ type: 'sawtooth', freq: 440, freqEnd: 300, dur: 0.38, vol: 0.12, delay: i * 0.45, filter: { type: 'lowpass', freq: 2400 } });
    }
  },
  waveClear: (a) => {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      a.tone({ type: 'square', freq: f, dur: 0.16, vol: 0.06, delay: i * 0.07, filter: { type: 'lowpass', freq: 3500 } }),
    );
  },
  gameOver: (a) => {
    [440, 349, 294, 220].forEach((f, i) =>
      a.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.97, dur: 0.45, vol: 0.1, delay: i * 0.3, filter: { type: 'lowpass', freq: 1600 } }),
    );
  },
  uiMove: (a) => {
    a.tone({ type: 'square', freq: 1200, dur: 0.03, vol: 0.04, filter: { type: 'lowpass', freq: 3000 } });
  },
  uiSelect: (a) => {
    a.tone({ type: 'square', freq: 880, dur: 0.06, vol: 0.06 });
    a.tone({ type: 'square', freq: 1320, dur: 0.09, vol: 0.06, delay: 0.05 });
  },
  uiBack: (a) => {
    a.tone({ type: 'square', freq: 660, freqEnd: 440, dur: 0.1, vol: 0.05 });
  },
};

/** Plays named sounds with rate limiting and optional stereo position. */
export class Sfx {
  private readonly last = new Map<SfxName, number>();

  constructor(private readonly audio: AudioEngine) {}

  /** Play `name`; pass the source's logical x to pan it across the stereo field. */
  play(name: SfxName, x?: number): void {
    const ctx = this.audio.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.02;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    this.last.set(name, now);
    const pan = x === undefined ? undefined : ((x / VIEW.width) * 2 - 1) * 0.7;
    // New weapons without their own recipe fall back to the Pulse Pistol sound.
    const recipe = RECIPES[name] ?? (name.startsWith('shoot_') ? RECIPES.shoot_pulse : undefined);
    if (!recipe) return;
    try {
      recipe(this.audio, pan);
    } catch {
      /* never let audio break the game */
    }
  }
}
