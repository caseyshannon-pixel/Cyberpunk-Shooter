import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { Pedestal } from './pedestal';

const PR = CONFIG.player.radius;

describe('Pedestal', () => {
  it('is taken after standing on it for takeTime', () => {
    const p = new Pedestal('spread', 100, 100);
    expect(p.update(0.3, 100, 100, PR)).toBe(false);
    expect(p.update(0.3, 100, 100, PR)).toBe(true);
  });

  it('is not taken just short of takeTime', () => {
    const p = new Pedestal('spread', 100, 100);
    expect(p.update(CONFIG.run.takeTime - 0.01, 100, 100, PR)).toBe(false);
  });

  it('stepping off resets the progress', () => {
    const p = new Pedestal('spread', 100, 100);
    p.update(0.4, 100, 100, PR);
    p.update(0.1, 400, 400, PR);
    expect(p.hold).toBe(0);
    expect(p.update(0.3, 100, 100, PR)).toBe(false);
  });
});
