/**
 * Procedural sound for transitions (ADR-060, plan 3.8): no audio files, a
 * handful of WebAudio voices scheduled per transition. Loaded lazily, only
 * when the `sound` option is on; muted until the visitor has interacted with
 * the page (browsers refuse audio before a gesture) and never under reduced
 * motion (the runtime does not call it then).
 */

/** What the transition about to play sounds like. */
export interface SoundCue {
  /** Base motion name (`'shatter'`, `'explode'`, …; a reverse names its base). */
  readonly motion: string;
  /** Material name; unknown ones sound like glass. */
  readonly material: string;
  /** Crack phase, ms (0 without one). */
  readonly crackMs: number;
  /** Motion phase, ms. */
  readonly durationMs: number;
  readonly shardCount: number;
  /** 0..1: how hard the page was hit (hold to charge); 0.5 by default. */
  readonly intensity: number;
  /** Back's reverse: the pieces come together. */
  readonly reverse: boolean;
  /** -1 (left) .. 1 (right): where the impact is. */
  readonly pan: number;
}

/** The voice of a material: pitch range of its pings, how they ring, how bright its noise is. */
interface Voice {
  readonly low: number;
  readonly high: number;
  readonly decay: number;
  /** Frequency ratios of each ping's partials (inharmonic for metal). */
  readonly partials: readonly number[];
  /** Centre of the crack and burst noise, Hz. */
  readonly bright: number;
  /** Paper does not ring. */
  readonly rings: boolean;
}

const GLASS: Voice = {
  low: 2400,
  high: 6000,
  decay: 0.35,
  partials: [1],
  bright: 4200,
  rings: true,
};

const VOICES: Readonly<Record<string, Voice>> = {
  glass: GLASS,
  ice: { low: 3500, high: 8000, decay: 0.2, partials: [1], bright: 6000, rings: true },
  mirror: { low: 3000, high: 7000, decay: 0.45, partials: [1, 2.01], bright: 5000, rings: true },
  obsidian: { low: 1500, high: 3200, decay: 0.3, partials: [1], bright: 2600, rings: true },
  paper: { low: 0, high: 0, decay: 0, partials: [], bright: 1800, rings: false },
  metal: { low: 600, high: 1600, decay: 1.1, partials: [1, 2.76, 5.4], bright: 3000, rings: true },
  holo: { low: 2600, high: 6500, decay: 0.5, partials: [1, 1.006], bright: 5000, rings: true },
};

/** Motions whose pieces fall and tinkle as they go. */
const FALLING = new Set(['shatter', 'crumble', 'rain', 'domino', 'explode', 'assemble']);

export class SoundEngine {
  private readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly noise: AudioBuffer;
  private random = Math.random;

  constructor(win: Window, volume: number) {
    const Context = audioContextOf(win);
    if (!Context) throw new Error('Web Audio is not available');
    this.context = new Context();
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.connect(this.context.destination);
    this.master = this.context.createGain();
    this.master.gain.value = Math.min(1, Math.max(0, volume));
    this.master.connect(limiter);
    // One second of white noise, shared by every noise voice.
    const length = this.context.sampleRate;
    this.noise = this.context.createBuffer(1, length, length);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Resumes the audio context; call from a user gesture. */
  resume(): void {
    // A resume that fails (the page is leaving) is silent: sound never
    // affects navigation, and an unhandled rejection is a console error in
    // Firefox (its e2e test reloads right after the toggle).
    if (this.context.state === 'suspended') this.context.resume().catch(() => undefined);
  }

  /** True once the browser lets the page make sound. */
  get running(): boolean {
    return this.context.state === 'running';
  }

  /** Makes the timing deterministic (tests). */
  useRandom(random: () => number): void {
    this.random = random;
  }

  /** Schedules every sound of one transition, starting now. */
  play(cue: SoundCue): void {
    if (!this.running) return;
    const voice = VOICES[cue.material] ?? GLASS;
    const now = this.context.currentTime + 0.01;
    const loud = 0.4 + 1.2 * Math.min(1, Math.max(0, cue.intensity));
    const crack = Math.max(0, cue.crackMs) / 1000;
    const motion = Math.max(0.05, cue.durationMs / 1000);
    const pan = Math.min(1, Math.max(-1, cue.pan));
    const start = now + crack;
    const pieces = Math.min(14, 4 + Math.round(cue.shardCount / 20));

    // The crack: dry ticks racing out, faster and faster.
    if (crack > 0) {
      for (let i = 0; i < 10; i++) {
        const at = now + crack * Math.sqrt(i / 10);
        this.noiseHit(at, 0.008, 'bandpass', voice.bright * 1.2, 8, 0.25 * loud, pan);
      }
    }

    if (cue.reverse) {
      // The pieces come together: pings gather toward the end, then one soft click.
      for (let i = 0; i < pieces; i++) {
        this.ping(now + motion * (0.55 + 0.4 * this.random()), voice, 0.12 * loud, pan);
      }
      this.noiseHit(now + motion, 0.02, 'bandpass', voice.bright, 4, 0.3 * loud, pan);
      return;
    }

    switch (cue.motion) {
      case 'explode':
        this.thump(start, 0.45, 0.9 * loud);
        this.noiseHit(start, 0.25, 'highpass', 900, 0.7, 0.7 * loud, pan);
        break;
      case 'implode':
        this.sweep(start, motion * 0.7, 1400, 180, 0.5 * loud, pan);
        break;
      case 'vortex':
        this.sweep(start, motion * 0.7, 250, 3200, 0.5 * loud, pan);
        break;
      case 'wind':
        this.sweep(start, motion * 0.9, 300, 1300, 0.45 * loud, pan);
        break;
      case 'melt':
        this.sweep(start, motion, 700, 160, 0.4 * loud, pan);
        break;
      case 'glitch':
        for (let i = 0; i < 9; i++) {
          this.blip(
            start + (i / 24) * (1 + this.random()),
            200 + 1800 * this.random(),
            0.15 * loud,
          );
        }
        return;
      case 'ripple':
        for (let i = 0; i < 6; i++) this.drop(start + motion * 0.12 * i, 0.3 * loud, pan);
        return;
      case 'flip':
      case 'blinds':
      case 'slide':
      case 'fold':
        for (let i = 0; i < 6; i++) {
          this.noiseHit(start + motion * 0.1 * i, 0.06, 'bandpass', 900, 1.5, 0.18 * loud, pan);
        }
        break;
      default:
        // The break: a burst of breaking glass.
        this.noiseHit(start, 0.12, 'highpass', voice.bright * 0.6, 0.8, 0.5 * loud, pan);
    }

    // The break rings, then falling pieces tinkle (or paper rustles).
    for (let i = 0; i < pieces; i++)
      this.ping(start + 0.08 * this.random(), voice, 0.16 * loud, pan);
    if (FALLING.has(cue.motion)) {
      const falls = cue.motion === 'rain' ? pieces * 2 : pieces;
      for (let i = 0; i < falls; i++) {
        const at = start + motion * (0.2 + 0.7 * this.random());
        this.ping(at, voice, 0.07 * loud, pan * this.random());
      }
    }
    if (!voice.rings)
      this.noiseHit(start, motion * 0.6, 'lowpass', voice.bright, 0.5, 0.25 * loud, pan);
  }

  destroy(): void {
    void this.context.close();
  }

  private out(pan: number): AudioNode {
    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.master);
    return panner;
  }

  /** A burst of filtered noise with a sharp attack and an exponential tail. */
  private noiseHit(
    at: number,
    length: number,
    type: BiquadFilterType,
    frequency: number,
    q: number,
    gain: number,
    pan: number,
  ): void {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const envelope = this.envelope(at, length, gain);
    source.connect(filter).connect(envelope).connect(this.out(pan));
    source.start(at, this.random() * 0.5, length + 0.05);
  }

  /** A struck piece: a decaying sine per partial, at a random pitch in the material's range. */
  private ping(at: number, voice: Voice, gain: number, pan: number): void {
    if (!voice.rings) return;
    const frequency = voice.low + (voice.high - voice.low) * this.random();
    const decay = voice.decay * (0.6 + 0.8 * this.random());
    for (let i = 0; i < voice.partials.length; i++) {
      const oscillator = this.context.createOscillator();
      oscillator.frequency.value = frequency * (voice.partials[i] ?? 1);
      const envelope = this.envelope(at, decay, gain / (i + 1));
      oscillator.connect(envelope).connect(this.out(pan));
      oscillator.start(at);
      oscillator.stop(at + decay + 0.05);
    }
  }

  /** A low thump with a falling pitch (the blast). */
  private thump(at: number, length: number, gain: number): void {
    const oscillator = this.context.createOscillator();
    oscillator.frequency.setValueAtTime(110, at);
    oscillator.frequency.exponentialRampToValueAtTime(40, at + length);
    oscillator.connect(this.envelope(at, length, gain)).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + length + 0.05);
  }

  /** Noise through a band-pass filter whose centre glides (whoosh, suction, wind). */
  private sweep(
    at: number,
    length: number,
    from: number,
    to: number,
    gain: number,
    pan: number,
  ): void {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + length);
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + length * 0.3);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(envelope).connect(this.out(pan));
    source.start(at);
    source.stop(at + length + 0.05);
  }

  /** A short square-wave blip (glitch). */
  private blip(at: number, frequency: number, gain: number): void {
    const oscillator = this.context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    oscillator.connect(this.envelope(at, 0.03, gain)).connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + 0.06);
  }

  /** A water drop: a sine whose pitch falls quickly. */
  private drop(at: number, gain: number, pan: number): void {
    const oscillator = this.context.createOscillator();
    oscillator.frequency.setValueAtTime(1400 + 600 * this.random(), at);
    oscillator.frequency.exponentialRampToValueAtTime(380, at + 0.09);
    oscillator.connect(this.envelope(at, 0.12, gain)).connect(this.out(pan));
    oscillator.start(at);
    oscillator.stop(at + 0.15);
  }

  /** A gain node that opens in 2 ms and decays exponentially over `length` s. */
  private envelope(at: number, length: number, gain: number): GainNode {
    const node = this.context.createGain();
    node.gain.setValueAtTime(0.0001, at);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.002);
    node.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.01, length));
    return node;
  }
}

/** The page's AudioContext constructor (prefixed in older WebKit), if any. */
export function audioContextOf(win: Window): typeof AudioContext | undefined {
  const scope = win as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/** Entry for the lazy chunk. */
export function createSoundEngine(win: Window, volume: number): SoundEngine {
  return new SoundEngine(win, volume);
}
