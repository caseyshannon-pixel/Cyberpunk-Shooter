import { CONFIG } from '../config';
import { vec } from '../core/math';
import { Door, renderDoor } from '../entities/door';
import type { EnemyKind } from '../entities/enemy';
import { Pedestal, renderPedestal } from '../entities/pedestal';
import { assignWalls } from '../run/floorPlan';
import { rollWeaponChoices } from '../run/rewards';
import { budgetFor, hpScaleFor, speedScaleFor, wavesFor } from '../run/rooms';
import type { Run } from '../run/run';
import { WEAPONS } from '../weapons/definitions';
import type { Director } from './director';
import { pickKind, queueSpawn, renderMarkers, updateMarkers, type SpawnMarker, type WavePhase } from './waves';
import type { World } from './world';

const R = CONFIG.run;
const W = CONFIG.waves;

/** fighting → reward (pedestals + open doors) → leaving (walked through a door). */
export type RoomStage = 'fighting' | 'reward' | 'leaving';

/**
 * One room of a Rogue Run: announce the room, spawn its waves, then put out
 * the reward pedestals and open the doors to the next rooms.
 */
export class RoomDirector implements Director {
  wave = 0;
  /** Starts 'cleared' with no wave yet, like Arcade: the first wave (and its banner) begins at once. */
  phase: WavePhase = 'cleared';
  timer = 0;
  phaseAge = 0;
  stage: RoomStage = 'fighting';
  readonly isBossWave: boolean;
  readonly hpScale: number;
  readonly speedScale: number;
  readonly bossHpScale: number;
  readonly markers: SpawnMarker[] = [];
  readonly pedestals: Pedestal[] = [];
  readonly doors: Door[] = [];
  private readonly totalWaves: number;
  private queue: EnemyKind[] = [];
  private spawnTimer = 0;
  private roomDone = false;
  /** Final boss down: seconds until the run is won (cancelled if the player dies first). */
  private winTimer = 0;
  private readonly pt = vec();

  constructor(private readonly run: Run) {
    const { floor, room } = run.room;
    this.isBossWave = run.isBossRoom;
    this.totalWaves = this.isBossWave ? 1 : wavesFor(floor, run.rng);
    this.hpScale = hpScaleFor(floor, room);
    this.speedScale = speedScaleFor(floor);
    this.bossHpScale = R.bossHp[floor - 1] / CONFIG.enemies.boss.hp;
  }

  get bossNumber(): number {
    return this.run.room.floor;
  }

  get remaining(): number {
    return this.queue.length + this.markers.length;
  }

  get label(): string {
    const { floor, room } = this.run.room;
    return this.isBossWave ? `F${floor} · BOSS` : `F${floor} · R${room}`;
  }

  get bannerText(): string {
    const { floor, room } = this.run.room;
    if (this.isBossWave) return `FLOOR ${floor} · WARDEN`;
    return this.wave <= 1 ? `FLOOR ${floor} · ROOM ${room}` : `WAVE ${this.wave}/${this.totalWaves}`;
  }

  get clearText(): string {
    return this.roomDone ? 'ROOM CLEAR' : 'WAVE CLEAR';
  }

  update(dt: number, w: World): void {
    this.phaseAge += dt;
    updateMarkers(this.markers, dt, w);
    if (this.stage === 'fighting') this.updateFighting(dt, w);
    else if (this.stage === 'reward') this.updateReward(dt, w);
  }

  private updateFighting(dt: number, w: World): void {
    switch (this.phase) {
      case 'cleared':
        this.timer -= dt;
        if (this.timer <= 0) this.startWave(w);
        break;
      case 'intro':
        this.timer -= dt;
        if (this.timer <= 0) this.setPhase('active', 0);
        break;
      case 'active':
        this.spawnTimer -= dt;
        if (this.queue.length && this.spawnTimer <= 0 && w.enemies.length + this.markers.length < W.maxAlive) {
          const kind = this.queue.shift();
          if (kind) queueSpawn(kind, w, this.markers, this.pt);
          this.spawnTimer = Math.max(W.spawnIntervalMin, W.spawnIntervalStart - this.run.room.floor * W.spawnIntervalPerWave * 2);
        }
        if (!this.queue.length && !this.markers.length && !w.enemies.length) this.waveCleared(w);
        break;
    }
  }

  /** Announce the next wave (banner, alarm, music); it spawns when the intro ends. */
  private startWave(w: World): void {
    this.wave++;
    this.queue = this.buildQueue();
    this.spawnTimer = 0;
    this.setPhase('intro', R.introTime);
    w.onWaveStarted(this.wave, this.isBossWave);
  }

  private buildQueue(): EnemyKind[] {
    const { floor, room } = this.run.room;
    const pool = R.floorPools[floor - 1] as readonly EnemyKind[];
    let budget = budgetFor(floor, room);
    const queue: EnemyKind[] = [];
    if (this.isBossWave) {
      queue.push('boss');
      budget = Math.round(budget * W.bossEscortBudget);
    }
    for (let k = pickKind(pool, budget); k && budget > 0; k = pickKind(pool, budget)) {
      queue.push(k);
      budget -= CONFIG.enemies[k].cost;
    }
    return queue;
  }

  private waveCleared(w: World): void {
    if (this.wave < this.totalWaves) {
      w.sound('waveClear');
      this.setPhase('cleared', R.waveBreather);
      return;
    }
    this.roomCleared(w);
  }

  private roomCleared(w: World): void {
    this.roomDone = true;
    this.setPhase('cleared', 0);
    this.run.onRoomCleared();
    w.sound('waveClear');
    this.stage = 'reward';
    if (this.run.isFinalBoss) {
      // A corpse can't win: a boss killed by bullets still in flight after death doesn't count.
      if (w.player.alive) this.winTimer = R.victoryDelay;
      return;
    }
    if (this.run.room.reward === 'weapon') {
      const picks = rollWeaponChoices(this.run.rng, w.player.arsenal.ids(), R.rewardChoices);
      const a = w.arena;
      picks.forEach((id, i) => {
        const x = a.centerX + (i - (picks.length - 1) / 2) * R.pedestalSpacing;
        this.pedestals.push(new Pedestal(id, x, a.centerY));
        w.particles.ring(x, a.centerY, WEAPONS[id].color, 60, 0.4, 3);
      });
    }
    const exits = this.run.exits();
    const walls = assignWalls(exits.length, this.run.room.entry, this.run.rng);
    exits.forEach((o, i) => this.doors.push(new Door(o, walls[i], w.arena.bounds)));
  }

  private updateReward(dt: number, w: World): void {
    const p = w.player;
    for (const d of this.doors) d.open = Math.min(1, d.open + dt * 2.5);
    if (!p.alive) {
      this.winTimer = 0;
      return;
    }
    if (this.winTimer > 0) {
      this.winTimer -= dt;
      if (this.winTimer <= 0) w.onRunWon();
      return;
    }
    for (const ped of this.pedestals) {
      if (!ped.update(dt, p.x, p.y, p.radius)) continue;
      this.take(ped, w);
      break;
    }
    for (const d of this.doors) {
      if (d.open < 1 || !d.touches(p.x, p.y, p.radius)) continue;
      this.stage = 'leaving';
      w.onRoomExited(d);
      return;
    }
  }

  private take(ped: Pedestal, w: World): void {
    const p = w.player;
    const def = WEAPONS[ped.weapon];
    p.arsenal.add(ped.weapon);
    p.charge = 0;
    for (const o of this.pedestals) if (o !== ped) w.particles.burst(o.x, o.y, WEAPONS[o.weapon].color, 10, 30, 140, 0.2, 0.4, 1.5);
    this.pedestals.length = 0;
    w.sound('pickupWeapon');
    w.popups.add(p.x, p.y - 34, def.name, def.color, 15, 1.2);
    w.particles.ring(p.x, p.y, def.color, 60, 0.4, 3);
    w.rumble(0.25, 0.5, 120);
  }

  /** Debug / tests: finish the room now (all waves), without drops. */
  debugClear(w: World): void {
    if (this.stage !== 'fighting') return;
    this.queue.length = 0;
    this.markers.length = 0;
    for (const e of w.enemies) e.dead = true;
    w.enemies.length = 0;
    this.wave = this.totalWaves;
    this.roomCleared(w);
  }

  private setPhase(phase: WavePhase, timer: number): void {
    this.phase = phase;
    this.timer = timer;
    this.phaseAge = 0;
  }

  renderMarkers(ctx: CanvasRenderingContext2D, time: number): void {
    renderMarkers(ctx, this.markers, time);
  }

  renderRoom(ctx: CanvasRenderingContext2D, w: World): void {
    for (const d of this.doors) renderDoor(ctx, d, w.time);
    for (const p of this.pedestals) renderPedestal(ctx, p);
  }

  /** The pedestal the player is standing near, for the HUD's name + description. */
  nearPedestal(w: World): Pedestal | null {
    const p = w.player;
    for (const ped of this.pedestals) if (ped.near(p.x, p.y)) return ped;
    return null;
  }
}
