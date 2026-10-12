import { AudioEngine } from './engine';
import { Music } from './music';
import { Sfx } from './sfx';

export type { SfxName } from './sfx';

/** Everything audio: the engine (context + mix), sound effects and music. */
export class GameAudio {
  readonly engine = new AudioEngine();
  readonly sfx = new Sfx(this.engine);
  readonly music = new Music(this.engine);
}
