import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('same seed → same sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) expect(a.next()).toBe(b.next());
  });

  it('different seeds differ', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next() stays in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int is inclusive and in range', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 3);
      expect([1, 2, 3]).toContain(v);
      seen.add(v);
    }
    expect(seen.size).toBe(3);
  });

  it('pick returns an element of the list', () => {
    const r = createRng(5);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items));
  });

  it('chance(0) is never true and chance(1) always is', () => {
    const r = createRng(9);
    for (let i = 0; i < 200; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it('shuffle keeps the same items', () => {
    const r = createRng(11);
    const items = [1, 2, 3, 4, 5, 6];
    const out = r.shuffle([...items]);
    expect([...out].sort()).toEqual(items);
  });
});
