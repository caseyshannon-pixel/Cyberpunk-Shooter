import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { Pedestal, rewardInfo } from './pedestal';

const PR = CONFIG.player.radius;

/** A pedestal the player has already been away from (the usual case). */
function armed(): Pedestal {
  const p = new Pedestal({ kind: 'weapon', id: 'spread' }, 100, 100);
  p.update(0.1, 400, 400, PR);
  return p;
}

describe('Pedestal', () => {
  it('is taken after standing on it for takeTime', () => {
    const p = armed();
    expect(p.update(0.3, 100, 100, PR)).toBe(false);
    expect(p.update(0.3, 100, 100, PR)).toBe(true);
  });

  it('is not taken just short of takeTime', () => {
    const p = armed();
    expect(p.update(CONFIG.run.takeTime - 0.01, 100, 100, PR)).toBe(false);
  });

  it('stepping off resets the progress', () => {
    const p = armed();
    p.update(0.4, 100, 100, PR);
    p.update(0.1, 400, 400, PR);
    expect(p.hold).toBe(0);
    expect(p.update(0.3, 100, 100, PR)).toBe(false);
  });

  it('is not taken by a player who was already standing on it when it appeared', () => {
    const p = new Pedestal({ kind: 'weapon', id: 'spread' }, 100, 100);
    for (let i = 0; i < 10; i++) expect(p.update(0.3, 100, 100, PR)).toBe(false);
    p.update(0.1, 400, 400, PR);
    p.update(0.3, 100, 100, PR);
    expect(p.update(0.3, 100, 100, PR)).toBe(true);
  });

  it('rewardInfo names a mod with its next stack', () => {
    expect(rewardInfo({ kind: 'mod', id: 'overvolt' }, { overvolt: 1 }).name).toBe('OVERVOLT 2/4');
    expect(rewardInfo({ kind: 'mod', id: 'hull' }, {}).name).toBe('REINFORCED HULL 1/3');
    expect(rewardInfo({ kind: 'weapon', id: 'rail' }, {}).name).toBe('PLASMA RAIL');
  });
});
