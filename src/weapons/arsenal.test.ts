import { describe, expect, it } from 'vitest';
import { Arsenal } from './arsenal';

describe('Arsenal (default, Arcade rules)', () => {
  it('a weapon pickup gives its ammo and runs dry back to the Pistol', () => {
    const a = new Arsenal();
    a.add('spread');
    expect(a.current.ammo).toBe(60);
    let emptied = null;
    for (let i = 0; i < 60; i++) emptied = a.consume();
    expect(emptied).toBe('spread');
    expect(a.ids()).toEqual(['pulse']);
    expect(a.current.id).toBe('pulse');
  });
});

describe('Arsenal (run rules)', () => {
  const run = () => new Arsenal({ infiniteAmmo: true, maxExtra: 2 });

  it('weapons never run dry', () => {
    const a = run();
    a.add('rail');
    for (let i = 0; i < 1000; i++) expect(a.consume()).toBeNull();
    expect(a.current.id).toBe('rail');
  });

  it('a third extra replaces the equipped weapon', () => {
    const a = run();
    a.add('spread');
    a.add('homing');
    a.index = 1; // spread equipped
    a.add('nova');
    expect(a.ids()).toEqual(['pulse', 'nova', 'homing']);
    expect(a.current.id).toBe('nova');
  });

  it('with the Pistol equipped, a third extra replaces the most recently added', () => {
    const a = run();
    a.add('spread');
    a.add('homing');
    a.index = 0;
    a.add('nova');
    expect(a.ids()).toEqual(['pulse', 'spread', 'nova']);
    expect(a.current.id).toBe('nova');
  });

  it('ids() and restore() round-trip the loadout and equipped slot', () => {
    const a = run();
    a.add('spread');
    a.add('arc');
    a.index = 1;
    const b = run();
    b.restore(a.ids(), a.index);
    expect(b.ids()).toEqual(['pulse', 'spread', 'arc']);
    expect(b.current.id).toBe('spread');
    expect(b.current.ammo).toBe(Infinity);
  });
});
