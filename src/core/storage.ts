/**
 * localStorage wrapper that never throws (Safari private browsing, disabled
 * storage, quota errors) — the game just doesn't persist in those cases.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  getNumber(key: string, fallback = 0): number {
    const v = Number(this.get(key));
    return Number.isFinite(v) ? v : fallback;
  },
};
