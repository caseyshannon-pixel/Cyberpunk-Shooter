import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Display } from './core/display';
import type { Input } from './input/input';
import type { GameState } from './states/state';

/** Window listeners Game registers, so tests can fire 'blur'. */
const listeners: Record<string, (() => void)[]> = {};

beforeEach(() => {
  for (const k of Object.keys(listeners)) delete listeners[k];
  const on = (ev: string, fn: () => void) => (listeners[ev] ??= []).push(fn);
  vi.stubGlobal('window', { addEventListener: on, matchMedia: () => ({ matches: false, addEventListener() {} }) });
  vi.stubGlobal('document', { addEventListener() {}, hidden: false });
});

afterEach(() => vi.unstubAllGlobals());

async function makeGame() {
  const { Game } = await import('./game');
  const input = {
    device: 'keyboard',
    onPadConnected() {},
    onPadDisconnected() {},
    setTouchGameplay() {},
    update() {},
    pressed: () => false,
  } as unknown as Input;
  return new Game({} as Display, input);
}

function state(log: string[], name: string): GameState {
  return {
    overlay: false,
    update() {},
    render() {},
    enter: () => log.push(`${name}.enter`),
    exit: () => log.push(`${name}.exit`),
    onFocusLost: () => log.push(`${name}.focusLost`),
  };
}

/** Run the fade until it finishes. */
function finishFade(game: { update(dt: number): void; transitioning: boolean }): void {
  for (let i = 0; i < 200 && game.transitioning; i++) game.update(1 / 60);
}

describe('Game.transition', () => {
  it('exits the old screen before building the new one', async () => {
    const game = await makeGame();
    const log: string[] = [];
    game.set(state(log, 'old'));
    log.length = 0;
    game.transition(() => {
      log.push('make');
      return state(log, 'new');
    });
    finishFade(game);
    expect(log).toEqual(['old.exit', 'make', 'new.enter']);
  });

  it('a focus loss during the fade-out reaches the new screen', async () => {
    const game = await makeGame();
    const log: string[] = [];
    game.set(state(log, 'old'));
    game.transition(() => state(log, 'new'));
    game.update(1 / 60); // fading out
    log.length = 0;
    for (const fn of listeners.blur ?? []) fn();
    finishFade(game);
    expect(log).toContain('new.focusLost');
    expect(log).not.toContain('old.focusLost');
  });
});
