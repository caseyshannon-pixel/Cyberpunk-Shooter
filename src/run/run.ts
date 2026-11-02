import { CONFIG } from '../config';
import { createRng, randomSeed, type Rng } from '../core/rng';
import type { Player } from '../entities/player';
import type { WeaponId } from '../weapons/definitions';
import type { ScoreKeeper } from '../world/score';
import { exitsFor } from './floorPlan';
import { COMBAT_LAYOUTS, opposite, type DoorOption, type RoomSpec, type WallSide } from './rooms';

const R = CONFIG.run;

/** What the player takes from one room into the next. */
export interface Carry {
  health: number;
  maxHealth: number;
  weapons: WeaponId[];
  equipped: number;
  /** Slot of the weapon taken last (replaced first when the Pistol is equipped). */
  newest: number;
}

export type RunOutcome = 'active' | 'dead' | 'victory' | 'abandoned';

/**
 * One Rogue Run: which room you're in, and everything that survives from room
 * to room. Each room gets a fresh World; the Run outlives them all.
 */
export class Run {
  readonly rng: Rng;
  room: RoomSpec;
  carry: Carry = { health: CONFIG.player.maxHealth, maxHealth: CONFIG.player.maxHealth, weapons: ['pulse'], equipped: 0, newest: 0 };
  score = 0;
  kills = 0;
  roomsCleared = 0;
  outcome: RunOutcome = 'active';

  /** `viewWidth` is locked for the whole run so the arena never changes shape between rooms. */
  constructor(
    readonly viewWidth: number,
    readonly seed: number = randomSeed(),
  ) {
    this.rng = createRng(seed);
    this.room = { floor: 1, room: 1, type: 'combat', reward: 'weapon', layout: this.rng.pick(COMBAT_LAYOUTS), entry: 'bottom' };
  }

  get isBossRoom(): boolean {
    return this.room.type === 'boss';
  }

  get isFinalBoss(): boolean {
    return this.isBossRoom && this.room.floor >= R.floors;
  }

  /** Doors out of the current room. */
  exits(): DoorOption[] {
    return exitsFor(this.room, this.rng);
  }

  /** Go through a door on `exitWall` into the room it leads to. */
  advance(option: DoorOption, exitWall: WallSide): void {
    let { floor, room } = this.room;
    if (this.isBossRoom) {
      floor++;
      room = 1;
      this.carry.health = Math.min(this.carry.maxHealth, this.carry.health + R.bossHeal);
    } else {
      room++;
    }
    const layout = option.type === 'boss' ? 'open' : this.rng.pick(COMBAT_LAYOUTS);
    this.room = { floor, room, type: option.type, reward: option.reward, layout, entry: opposite(exitWall) };
  }

  /** Remember the player's state when they leave a room (or the run ends). */
  captureFrom(player: Player, score: ScoreKeeper): void {
    this.carry = {
      health: player.health,
      maxHealth: player.maxHealth,
      weapons: player.arsenal.ids(),
      equipped: player.arsenal.index,
      newest: player.arsenal.newest,
    };
    this.score = score.score;
    this.kills = score.kills;
  }

  /** Put the carried state into a fresh room's player and score. */
  applyTo(player: Player, score: ScoreKeeper): void {
    player.health = this.carry.health;
    player.maxHealth = this.carry.maxHealth;
    player.arsenal.restore(this.carry.weapons, this.carry.equipped, this.carry.newest);
    score.score = this.score;
    score.kills = this.kills;
  }

  /** Debug: jump straight to this floor's boss room. */
  debugSkipToBoss(): void {
    this.room = { ...this.room, room: R.roomsPerFloor + 1, type: 'boss', reward: 'none', layout: 'open', entry: 'bottom' };
  }

  onRoomCleared(): void {
    this.roomsCleared++;
  }

  finish(outcome: Exclude<RunOutcome, 'active'>): void {
    this.outcome = outcome;
  }
}
