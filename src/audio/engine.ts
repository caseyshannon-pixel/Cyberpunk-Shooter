import { settings } from '../settings';

type Ctx = AudioContext;

interface AudioSessionNav {
  audioSession?: { type: string };
}

/** Options for a single enveloped oscillator voice. */
export interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  /** Pitch at the end of the note (exponential glide). */
  freqEnd?: number;
  dur: number;
  vol?: number;
  attack?: number;
  /** Detune in cents (e.g. for a second, slightly sharp voice). */
  detune?: number;
  delay?: number;
  filter?: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number };
  pan?: number;
  bus?: AudioNode;
}

export interface NoiseOpts {
  dur: number;
  vol?: number;
  attack?: number;
  delay?: number;
  filter?: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number };
  pan?: number;
  bus?: AudioNode;
}

/**
 * Owns the AudioContext and the mix: sfx + music buses → master → compressor.
 *
 * Browsers (iOS Safari especially) only allow audio to start from a user
 * gesture, so the context is created/resumed on the first tap, click or key
 * press, and resumed again after iOS interruptions (calls, backgrounding).
 */
export class AudioEngine {
  ctx: Ctx | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private duck!: GainNode;
  private noiseBuf!: AudioBuffer;
  private readonly readyListeners: (() => void)[] = [];

  constructor() {
    const unlock = () => this.unlock();
    // Capture phase so overlays that stop propagation can't block the unlock.
    for (const ev of ['pointerup', 'pointerdown', 'touchend', 'keydown', 'mousedown']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
    settings.subscribe(() => this.applySettings());
  }

  /** True once the context is running (sound can actually be heard). */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Called with no arguments once audio is available (immediately if it already is). */
  onReady(fn: () => void): void {
    if (this.running) fn();
    else this.readyListeners.push(fn);
  }

  unlock(): void {
    try {
      if (!this.ctx) this.create();
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state !== 'running') {
        ctx
          .resume()
          .then(() => this.fireReady())
          .catch(() => {});
        // iOS: playing a buffer inside the gesture fully unlocks output.
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      } else {
        this.fireReady();
      }
    } catch {
      /* Web Audio unavailable — stay silent */
    }
  }

  private fireReady(): void {
    if (!this.running) return;
    const fns = this.readyListeners.splice(0);
    for (const fn of fns) fn();
  }

  private create(): void {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.duck);

    // 1 s of white noise, reused by every noise voice.
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // iOS 'interrupted' state (phone call, Siri…): try to come back afterwards.
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') this.fireReady();
    });
    this.applySettings();
  }

  private applySettings(): void {
    const s = settings.get();
    const nav = navigator as Navigator & AudioSessionNav;
    try {
      // Safari 16.4+: 'playback' ignores the ring/silent switch; 'ambient' respects it.
      if (nav.audioSession) nav.audioSession.type = s.soundInSilentMode ? 'playback' : 'ambient';
    } catch {
      /* unsupported */
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.music * 0.7, t, 0.02);
  }

  /** Lower the music (e.g. while paused); 1 = normal. */
  duckMusic(level: number, time = 0.25): void {
    if (!this.ctx) return;
    this.duck.gain.setTargetAtTime(level, this.ctx.currentTime, time / 3);
  }

  // ------------------------------------------------------------ primitives

  private output(bus: AudioNode | undefined, pan: number | undefined): AudioNode {
    const ctx = this.ctx as Ctx;
    const dest = bus ?? this.sfxBus;
    if (pan === undefined || !ctx.createStereoPanner) return dest;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(dest);
    return p;
  }

  private filtered(src: AudioNode, f: ToneOpts['filter'], t0: number, dur: number): AudioNode {
    if (!f) return src;
    const ctx = this.ctx as Ctx;
    const bq = ctx.createBiquadFilter();
    bq.type = f.type;
    bq.frequency.setValueAtTime(f.freq, t0);
    if (f.freqEnd) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f.freqEnd), t0 + dur);
    if (f.q !== undefined) bq.Q.value = f.q;
    src.connect(bq);
    return bq;
  }

  /** One oscillator with an attack/exponential-decay envelope and optional pitch glide + filter. */
  tone(o: ToneOpts): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const dur = o.dur;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.freqEnd), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    const atk = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    this.filtered(osc, o.filter, t0, dur).connect(g);
    g.connect(this.output(o.bus, o.pan));
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered white-noise burst (explosions, hats, whooshes). */
  noise(o: NoiseOpts): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    this.filtered(src, o.filter, t0, o.dur).connect(g);
    g.connect(this.output(o.bus, o.pan));
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.dur + 0.02);
  }

  /** Scheduled versions for the music sequencer (absolute start time). */
  toneAt(t0: number, o: ToneOpts): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.tone({ ...o, delay: Math.max(0, t0 - ctx.currentTime) });
  }

  noiseAt(t0: number, o: NoiseOpts): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.noise({ ...o, delay: Math.max(0, t0 - ctx.currentTime) });
  }
}
