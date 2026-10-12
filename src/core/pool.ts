/**
 * Dense object pool. Live objects occupy `items[0..count)`; releasing swaps the
 * last live object into the freed slot, so iteration is a tight loop with no
 * holes and nothing is allocated after warm-up.
 *
 * Iterate backwards when releasing during iteration:
 *   for (let i = pool.count - 1; i >= 0; i--) { if (dead) pool.releaseAt(i); }
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;

  constructor(
    private readonly factory: () => T,
    initialCapacity: number,
    private readonly maxCapacity = initialCapacity * 4,
  ) {
    for (let i = 0; i < initialCapacity; i++) this.items.push(factory());
  }

  /** Returns a recycled object, or null if the pool is at its hard cap. Caller must fully re-initialise it. */
  acquire(): T | null {
    if (this.count >= this.items.length) {
      if (this.items.length >= this.maxCapacity) return null;
      this.items.push(this.factory());
    }
    return this.items[this.count++];
  }

  releaseAt(index: number): void {
    const last = this.count - 1;
    if (index !== last) {
      const tmp = this.items[index];
      this.items[index] = this.items[last];
      this.items[last] = tmp;
    }
    this.count--;
  }

  clear(): void {
    this.count = 0;
  }
}
