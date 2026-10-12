import { storage } from './core/storage';

/** Player-adjustable options, persisted to localStorage. */
export interface Settings {
  /** 0..1 */
  master: number;
  music: number;
  sfx: number;
  /** Screen-shake strength, 0 (off) .. 1 (full). */
  shake: number;
  crt: boolean;
  rumble: boolean;
  /** iPhone/iPad: keep playing sound when the ring/silent switch is set to silent. */
  soundInSilentMode: boolean;
}

const KEY = 'neongrid.settings';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  master: 0.8,
  music: 0.55,
  sfx: 0.8,
  shake: 1,
  crt: true,
  rumble: true,
  soundInSilentMode: true,
};

type Listener = (s: Readonly<Settings>) => void;

/** Loads once, saves on every change, and notifies subscribers (audio, input…). */
class SettingsStore {
  private value: Settings = { ...DEFAULT_SETTINGS };
  private readonly listeners: Listener[] = [];

  constructor() {
    const raw = storage.get(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      // Keep only known keys with the right types.
      for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
        if (typeof parsed[k] === typeof DEFAULT_SETTINGS[k]) (this.value as unknown as Record<string, unknown>)[k] = parsed[k];
      }
    } catch {
      /* corrupt — keep defaults */
    }
  }

  get(): Readonly<Settings> {
    return this.value;
  }

  set<K extends keyof Settings>(key: K, v: Settings[K]): void {
    if (this.value[key] === v) return;
    this.value = { ...this.value, [key]: v };
    storage.set(KEY, JSON.stringify(this.value));
    for (const fn of this.listeners) fn(this.value);
  }

  /** Call `fn` now and whenever settings change. */
  subscribe(fn: Listener): void {
    this.listeners.push(fn);
    fn(this.value);
  }
}

export const settings = new SettingsStore();
