import { CONFIG } from '../config';
import type { Rng } from '../core/rng';
import type { DoorOption, RoomSpec, WallSide } from './rooms';

const R = CONFIG.run;

/** Rooms a door can lead to before the boss. Later phases add mods, elites, shops and rests. */
export const OFFERABLE: readonly DoorOption[] = [{ type: 'combat', reward: 'weapon', label: 'WEAPON' }];

const BOSS_DOOR: DoorOption = { type: 'boss', reward: 'none', label: 'BOSS' };
const NEXT_FLOOR_DOOR: DoorOption = { type: 'combat', reward: 'weapon', label: 'NEXT FLOOR' };

/** The doors that open when `spec` is cleared. Empty after the final boss (the run is won). */
export function exitsFor(spec: RoomSpec, rng: Rng): DoorOption[] {
  if (spec.type === 'boss') return spec.floor < R.floors ? [NEXT_FLOOR_DOOR] : [];
  if (spec.room >= R.roomsPerFloor) return [BOSS_DOOR];
  const count = rng.chance(R.extraDoorChance) ? 3 : 2;
  return rng.shuffle([...OFFERABLE]).slice(0, count);
}

const SIDES: readonly WallSide[] = ['top', 'bottom', 'left', 'right'];

/** Distinct walls for `count` doors, never the one the player came in through. */
export function assignWalls(count: number, entry: WallSide, rng: Rng): WallSide[] {
  return rng.shuffle(SIDES.filter((s) => s !== entry)).slice(0, count);
}
