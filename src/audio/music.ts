import type { AudioEngine } from './engine';

const BPM = 104;
const STEP = 60 / BPM / 4; // one 16th note
const LOOKAHEAD = 0.12;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** i–VI–III–VII in A minor: Am, F, C, G (MIDI notes). */
const CHORDS = [
  { root: 45, notes: [57, 60, 64] },
  { root: 41, notes: [53, 57, 60] },
  { root: 48, notes: [60, 64, 67] },
  { root: 43, notes: [55, 59, 62] },
];
/** Driving 8th-note bass: octave jumps on some steps. */
const BASS = [0, 0, 12, 0, 0, 12, 0, 12];
/** Arp walks up and down the chord across two octaves. */
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5];

/**
 * Procedural synthwave loop with a lookahead scheduler (notes are queued on
 * the audio clock slightly ahead of time, so timing stays tight even if the
 * main thread hiccups).
 *
 * Intensity: 0 = calm (pad + soft bass), 1 = gameplay (+ drums, sparse arp),
 * 2 = boss (open filters, 16th hats, full arp).
 */
export class Music {
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private bar = 0;
  private next = 0;
  private intensity = 1;
  private fxBus: GainNode | null = null;

  constructor(private readonly audio: AudioEngine) {}

  start(): void {
    if (this.playing) return;
    this.playing = true;
    this.audio.onReady(() => this.begin());
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setIntensity(level: 0 | 1 | 2): void {
    this.intensity = level;
  }

  private begin(): void {
    const ctx = this.audio.ctx;
    if (!this.playing || this.timer || !ctx) return;
    this.ensureFx();
    this.step = 0;
    this.bar = 0;
    this.next = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 25);
  }

  /** Dotted-8th echo for the arp and snare. */
  private ensureFx(): void {
    const ctx = this.audio.ctx;
    if (!ctx || this.fxBus) return;
    const send = ctx.createGain();
    send.connect(this.audio.musicBus);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.33;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    send.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(wet);
    wet.connect(this.audio.musicBus);
    this.fxBus = send;
  }

  private tick(): void {
    const ctx = this.audio.ctx;
    if (!ctx || !this.playing) return;
    // Don't machine-gun missed notes after a stall.
    if (this.next < ctx.currentTime - 0.05) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      this.schedule(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  private schedule(step: number, t: number): void {
    const a = this.audio;
    const bus = a.musicBus;
    const fx = this.fxBus ?? bus;
    const chord = CHORDS[this.bar % CHORDS.length];
    const lvl = this.intensity;

    // Pad: once per bar.
    if (step === 0) this.pad(t, chord.notes, STEP * 16, lvl);

    // Bass on 8ths.
    if (step % 2 === 0) {
      const n = chord.root + BASS[step / 2];
      const cutoff = lvl === 2 ? 1600 : lvl === 1 ? 1000 : 600;
      a.toneAt(t, { type: 'sawtooth', freq: hz(n), dur: STEP * 1.8, vol: lvl === 0 ? 0.05 : 0.08, bus, filter: { type: 'lowpass', freq: cutoff, freqEnd: 180, q: 6 } });
      a.toneAt(t, { type: 'square', freq: hz(n - 12), dur: STEP * 1.6, vol: 0.04, bus, filter: { type: 'lowpass', freq: 300 } });
    }

    if (lvl >= 1) {
      // Kick on 1 and 3 (plus a push before 3), snare on 2 and 4.
      if (step === 0 || step === 8 || (lvl === 2 && step === 10)) {
        a.toneAt(t, { type: 'sine', freq: 150, freqEnd: 40, dur: 0.28, vol: 0.32, bus });
      }
      if (step === 4 || step === 12) {
        a.noiseAt(t, { dur: 0.22, vol: 0.12, bus: fx, filter: { type: 'bandpass', freq: 1900, q: 0.8 } });
        a.toneAt(t, { type: 'triangle', freq: 200, freqEnd: 140, dur: 0.1, vol: 0.08, bus });
      }
      // Hats: off-beat 8ths, 16ths during boss fights.
      if ((lvl === 2 && step % 2 === 1) || step % 4 === 2) {
        a.noiseAt(t, { dur: 0.04, vol: step % 4 === 2 ? 0.05 : 0.03, bus, filter: { type: 'highpass', freq: 8000 } });
      }
      // Arp: sparse in normal play, every 16th in boss fights.
      const arpOn = lvl === 2 || (this.bar % 2 === 1 && step % 2 === 0);
      if (arpOn) {
        const idx = ARP[step];
        const n = chord.notes[idx % 3] + 12 * Math.floor(idx / 3) + 12;
        a.toneAt(t, { type: 'square', freq: hz(n), dur: STEP * 0.9, vol: lvl === 2 ? 0.035 : 0.025, bus: fx, filter: { type: 'lowpass', freq: lvl === 2 ? 4200 : 2600 } });
      }
    }
  }

  /** Warm detuned-saw chord with a slow attack and release. */
  private pad(t: number, notes: number[], dur: number, lvl: number): void {
    const ctx = this.audio.ctx;
    if (!ctx) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lvl === 2 ? 1600 : 900, t);
    filter.frequency.linearRampToValueAtTime(lvl === 2 ? 2400 : 1300, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(lvl === 2 ? 1600 : 900, t + dur);
    const g = ctx.createGain();
    const vol = 0.022;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.5);
    g.gain.setValueAtTime(vol, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    filter.connect(g);
    g.connect(this.audio.musicBus);
    for (const n of notes) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = det;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 0.5);
      }
    }
  }
}
