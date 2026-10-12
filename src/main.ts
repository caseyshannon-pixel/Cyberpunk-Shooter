import './core/polyfills';
import { Display } from './core/display';
import { FixedLoop } from './core/loop';
import { Game } from './game';
import { Input } from './input/input';
import { TitleState } from './states/title';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const display = new Display(canvas);
const input = new Input(display);
const game = new Game(display, input);

game.set(new TitleState(game));

const loop = new FixedLoop(
  (dt) => game.update(dt),
  (alpha, frameDt) => game.render(alpha, frameDt),
);
loop.start();
canvas.focus();

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
