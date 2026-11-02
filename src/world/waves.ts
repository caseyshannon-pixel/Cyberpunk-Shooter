import { CONFIG } from '../config';
import { TAU, vec } from '../core/math';
import type { EnemyKind } from '../entities/enemy';
import type { Director } from './director';
import type { World } from './world';

const W = CONFIG.waves;

export type WavePhase = 'cleared' | 'intro' | 'active';

export interface SpawnMarker {
  kind: EnemyKind;
  x: number;
  y: number;
  timer: number;
  total: number;
}

/**
 * Drives the run: banner → spawn the wave (telegraphed) → wait for the arena
 * to be clear → breather → next wave. Each wave gets a growing point budget
 * spent on weighted-random enemy picks; every `bossEvery` waves a boss shows up.
 */
export class WaveDirector implements Director {
  /** Arcade: wave number. Zen: the current difficulty tier (which enemy types are in the mix). */
  wave = 0;
  phase: WavePhase = 'cleared';
  /** Time left in the current phase (cleared/intro). */
  timer: number = W.firstWaveDelay;
  /** Time since the phase started (for banner animation). */
  phaseAge = 0;
  isBossWave = false;
  readonly markers: SpawnMarker[] = [];
  private queue: EnemyKind[] = [];
  private spawnTimer = 0;
  private readonly pt = vec();
  /** Zen mode: seconds of continuous flow so far. */
  private zenTime = 0;

  /** In Zen mode there are no waves: enemies trickle in continuously instead. */
  constructor(private readonly zen = false) {
    if (zen) {
      this.phase = 'active';
      this.wave = 1;
      this.spawnTimer = 1.2;
    }
  }

  get hpScale(): number {
    return this.zen ? 1 : 1 + (this.wave - 1) * W.hpScalePerWave;
  }

  get speedScale(): number {
    return this.zen ? 1 : 1 + (this.wave - 1) * W.speedScalePerWave;
  }

  get remaining(): number {
    return this.queue.length + this.markers.length;
  }

  /** Each boss is tougher than the last. */
  get bossNumber(): number {
    return Math.max(1, Math.round(this.wave / W.bossEvery));
  }

  get bossHpScale(): number {
    return 1 + (this.bossNumber - 1) * CONFIG.enemies.boss.hpPerBoss;
  }

  get label(): string {
    return this.wave > 0 ? `WAVE ${this.wave}` : '';
  }

  get bannerText(): string {
    return `WAVE ${this.wave}`;
  }

  get clearText(): string {
    return 'WAVE CLEAR';
  }

  update(dt: number, w: World): void {
    this.phaseAge += dt;
    this.updateMarkers(dt, w);
    if (this.zen) {
      this.updateZen(dt, w);
      return;
    }

    switch (this.phase) {
      case 'cleared':
        this.timer -= dt;
        if (this.timer <= 0) this.startWave(this.wave + 1, w);
        break;
      case 'intro':
        this.timer -= dt;
        if (this.timer <= 0) this.setPhase('active');
        break;
      case 'active': {
        this.spawnTimer -= dt;
        const alive = w.enemies.length + this.markers.length;
        if (this.queue.length && this.spawnTimer <= 0 && alive < W.maxAlive) {
          this.spawnNext(w);
          this.spawnTimer = Math.max(W.spawnIntervalMin, W.spawnIntervalStart - (this.wave - 1) * W.spawnIntervalPerWave);
        }
        if (!this.queue.length && !this.markers.length && !w.enemies.length) {
          w.onWaveCleared(this.wave);
          this.setPhase('cleared');
          this.timer = W.breather;
        }
        break;
      }
    }
  }

  /**
   * Zen flow: keep the arena at a target population that slowly rises and falls
   * (a sine "breath"), creeps up over time, and unlocks enemy types gradually.
   */
  private updateZen(dt: number, w: World): void {
    const Z = CONFIG.zen;
    this.zenTime += dt;
    this.wave = Math.min(Z.maxTier, 1 + Math.floor(this.zenTime / Z.tierSeconds));
    const target = Math.min(
      Z.maxAlive,
      // -cos: the cycle starts at its quietest point and swells from there.
      Math.max(2, Z.baseAlive - Z.aliveSwing * Math.cos((this.zenTime / Z.cyclePeriod) * TAU) + (Z.alivePerMinute * this.zenTime) / 60),
    );
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Z.spawnInterval;
    if (w.enemies.length + this.markers.length >= target) return;
    const kind = this.pickKind(this.wave, Infinity);
    if (!kind) return;
    this.queue = [kind];
    this.spawnNext(w);
  }

  /** Weighted-random enemy kind among those unlocked by `wave` and costing at most `budget`. */
  private pickKind(wave: number, budget: number): EnemyKind | null {
    return pickKind((Object.keys(CONFIG.enemies) as EnemyKind[]).filter((k) => CONFIG.enemies[k].minWave <= wave), budget);
  }

  private setPhase(phase: WavePhase): void {
    this.phase = phase;
    this.phaseAge = 0;
  }

  private startWave(n: number, w: World): void {
    this.wave = n;
    this.isBossWave = n % W.bossEvery === 0;
    this.queue = this.buildQueue(n);
    this.spawnTimer = 0;
    this.setPhase('intro');
    this.timer = W.bannerTime;
    w.onWaveStarted(n, this.isBossWave);
  }

  /** Spend the wave's budget on weighted-random picks from the unlocked enemy kinds. */
  private buildQueue(n: number): EnemyKind[] {
    let budget = W.budgetBase + (n - 1) * W.budgetPerWave;
    const queue: EnemyKind[] = [];
    if (this.isBossWave) {
      queue.push('boss');
      budget = Math.round(budget * W.bossEscortBudget);
    }

    for (let pick = this.pickKind(n, budget); pick && budget > 0; pick = this.pickKind(n, budget)) {
      queue.push(pick);
      budget -= CONFIG.enemies[pick].cost;
    }
    return queue;
  }

  private spawnNext(w: World): void {
    const kind = this.queue.shift();
    if (kind) queueSpawn(kind, w, this.markers, this.pt);
  }

  private updateMarkers(dt: number, w: World): void {
    updateMarkers(this.markers, dt, w);
  }

  renderMarkers(ctx: CanvasRenderingContext2D, time: number): void {
    renderMarkers(ctx, this.markers, time);
  }
}

/** Weighted-random pick among `kinds` the spawner may use (weight and cost > 0) costing at most `budget`. */
export function pickKind(kinds: readonly EnemyKind[], budget: number): EnemyKind | null {
  const usable = kinds.filter((k) => {
    const d = CONFIG.enemies[k];
    // cost > 0 keeps budget loops finite; weight 0 = never spawned by a director.
    return d.weight > 0 && d.cost > 0 && d.cost <= budget;
  });
  if (!usable.length) return null;
  let total = 0;
  for (const k of usable) total += CONFIG.enemies[k].weight;
  let r = Math.random() * total;
  for (const k of usable) {
    r -= CONFIG.enemies[k].weight;
    if (r <= 0) return k;
  }
  return usable[0];
}

/** Telegraph an enemy: a marker that turns into the enemy when its timer runs out. */
export function queueSpawn(kind: EnemyKind, w: World, markers: SpawnMarker[], pt: { x: number; y: number }): void {
  const r = CONFIG.enemies[kind].radius;
  if (kind === 'boss') {
    pt.x = w.arena.centerX;
    pt.y = w.arena.bounds.y + 110;
    if (Math.abs(w.player.y - pt.y) < 160) pt.y = w.arena.bounds.y + w.arena.bounds.h - 110;
  } else {
    w.arena.spawnPoint(w.player.x, w.player.y, W.minSpawnDistance, r, pt);
  }
  const total = kind === 'boss' ? W.bossTelegraph : W.spawnTelegraph;
  markers.push({ kind, x: pt.x, y: pt.y, timer: total, total });
}

export function updateMarkers(markers: SpawnMarker[], dt: number, w: World): void {
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i];
    m.timer -= dt;
    if (m.timer <= 0) {
      markers.splice(i, 1);
      w.spawnEnemy(m.kind, m.x, m.y);
    }
  }
}

export function renderMarkers(ctx: CanvasRenderingContext2D, markers: readonly SpawnMarker[], time: number): void {
  if (!markers.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of markers) {
    const def = CONFIG.enemies[m.kind];
    const k = 1 - m.timer / m.total; // 0 → 1
    const r = def.radius * (2.6 - k * 1.6);
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = 0.25 + 0.5 * k * (0.6 + 0.4 * Math.sin(time * 30));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, TAU);
    ctx.stroke();
    // Rotating crosshair ticks.
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = time * 3 + (i * TAU) / 4;
      ctx.moveTo(m.x + Math.cos(a) * (r + 4), m.y + Math.sin(a) * (r + 4));
      ctx.lineTo(m.x + Math.cos(a) * (r + 12), m.y + Math.sin(a) * (r + 12));
    }
    ctx.stroke();
  }
  ctx.restore();
}
