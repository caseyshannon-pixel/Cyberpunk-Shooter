import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { Input } from '../input/input';
import { Arena } from '../world/arena';
import { Player } from './player';

/** Just enough Input for Player.update: standing still, pressing dash. */
const dashInput = {
  move: { x: 0, y: 0 },
  getAimDirection: () => false,
  pressed: (a: string) => a === 'DASH',
  isDown: () => false,
  rumble() {},
} as unknown as Input;

describe('Player dash cooldown', () => {
  it('is scaled by dashCooldownMult', () => {
    const p = new Player(640, 360);
    p.dashCooldownMult = 0.5;
    p.update(1 / 60, dashInput, new Arena(1280));
    expect(p.dashCooldown).toBeCloseTo(CONFIG.player.dash.cooldown * 0.5);
  });

  it('dashReady uses the scaled cooldown', () => {
    const p = new Player(640, 360);
    p.dashCooldownMult = 0.5;
    p.dashCooldown = CONFIG.player.dash.cooldown * 0.25;
    expect(p.dashReady).toBeCloseTo(0.5);
  });
});
