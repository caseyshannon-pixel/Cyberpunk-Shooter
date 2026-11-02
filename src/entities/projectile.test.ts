import { describe, expect, it } from 'vitest';
import { World } from '../world/world';

const hooks = { toast() {}, rumble() {}, sound() {}, waveStarted() {} };

describe('Homing projectiles that pierce', () => {
  it('move on to the next enemy instead of circling the one they pierced', () => {
    const w = new World(hooks, 'arcade');
    const a = w.spawnEnemy('bruiser', 420, 360, false);
    const b = w.spawnEnemy('bruiser', 760, 360, false);
    a.hp = b.hp = 1000;
    w.projectiles.spawn({
      x: 300, y: 360, angle: 0, speed: 520, radius: 4, damage: 1, life: 2.2,
      team: 'player', color: '#7dff4d', behavior: 'homing', pierce: 3, turnRate: 7,
    });
    for (let i = 0; i < 132; i++) {
      w.grid.clear();
      for (const e of w.enemies) w.grid.insert(e);
      w.projectiles.update(1 / 60, w);
    }
    expect(a.hp).toBe(999);
    expect(b.hp).toBeLessThan(1000);
  });
});
