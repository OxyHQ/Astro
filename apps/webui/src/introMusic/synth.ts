export type IntroCues = { icon: number; letters: number; letterStep: number; letterCount: number; tagline: number; exit: number; end: number };
export type IntroAudio = { sampleRate: number; left: Float32Array; right: Float32Array };

export const SAMPLE_RATE = 44_100;

const DEFAULT_CUES: IntroCues = { icon: 0.25, letters: 1.2, letterStep: 0.055, letterCount: 9, tagline: 2.4, exit: 4.1, end: 4.75 };

const TABLE = (() => {
  const size = 4096;
  const table = new Float32Array(size + 1);
  for (let i = 0; i <= size; i++) {
    const x = (2 * Math.PI * i) / size;
    let v = 0;
    for (let k = 1; k <= 8; k++) v += Math.sin(k * x) / k ** 1.7;
    table[i] = v / 1.5;
  }
  return table;
})();

const smooth = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(x, 0), 1));

function envelope(t: number, length: number, attack: number, release: number) {
  if (t < attack) return smooth(t / attack);
  if (t > length) return 1 - smooth((t - length) / release);
  return 1;
}

function panned(p: number): [number, number] {
  const angle = ((p + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

class Rotation {
  private sin: number;
  cos = 0;
  private cosStep: number;
  private sinStep: number;
  private nextCos: number;

  constructor(omega: number, t0: number, phase: number, sr: number) {
    this.sin = Math.sin(omega * t0 + phase);
    this.nextCos = Math.cos(omega * t0 + phase);
    this.cosStep = Math.cos(omega / sr);
    this.sinStep = Math.sin(omega / sr);
  }

  next() {
    const sin = this.sin;
    this.cos = this.nextCos;
    this.sin = sin * this.cosStep + this.nextCos * this.sinStep;
    this.nextCos = this.nextCos * this.cosStep - sin * this.sinStep;
    return sin;
  }
}

class Decay {
  private value: number;
  private readonly step: number;

  constructor(tau: number, t0: number, sr: number) {
    this.value = Math.exp(-t0 / tau);
    this.step = Math.exp(-1 / (tau * sr));
  }

  next() {
    const value = this.value;
    this.value *= this.step;
    return value;
  }
}

class Mix {
  readonly left: Float32Array;
  readonly right: Float32Array;
  readonly sr: number;

  constructor(left: Float32Array, right: Float32Array, sr: number) {
    this.left = left;
    this.right = right;
    this.sr = sr;
  }

  private range(from: number, to: number): [number, number] {
    const a = Math.max(0, Math.trunc(from * this.sr));
    const b = Math.min(this.left.length, Math.trunc(to * this.sr));
    return [a, Math.max(a, b)];
  }

  pad(freq: number, from: number, to: number, attack: number, release: number, gain: number) {
    const detune = 2 ** (4 / 1200);
    let phase0 = Math.random();
    let phase1 = Math.random();
    const inc0 = freq / detune / this.sr;
    const inc1 = (freq * detune) / this.sr;
    const cutoff = Math.min(1600, freq * 5);
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / this.sr);
    let lp0 = 0;
    let lp1 = 0;
    const length = to - from;
    const size = TABLE.length - 1;
    const lookup = (x: number) => {
      const i = Math.trunc(x);
      const f = x - i;
      return TABLE[i]! + (TABLE[i + 1]! - TABLE[i]!) * f;
    };
    const [start, stop] = this.range(from, to + release);
    const wobble = new Rotation(2 * Math.PI * 0.23, start / this.sr - from, freq, this.sr);
    for (let i = start; i < stop; i++) {
      const t = i / this.sr - from;
      const env = envelope(t, length, attack, release) * gain;
      const shimmer = 1 + 0.04 * wobble.next();
      lp0 += a * (lookup(phase0 * size) - lp0);
      lp1 += a * (lookup(phase1 * size) - lp1);
      this.left[i] = this.left[i]! + lp0 * env * shimmer;
      this.right[i] = this.right[i]! + lp1 * env * (2 - shimmer);
      phase0 += inc0;
      if (phase0 >= 1) phase0 -= 1;
      phase1 += inc1;
      if (phase1 >= 1) phase1 -= 1;
    }
  }

  sine(freq: number, from: number, to: number, attack: number, release: number, gain: number) {
    const length = to - from;
    const [start, stop] = this.range(from, to + release);
    const wave = new Rotation(2 * Math.PI * freq, start / this.sr - from, 0, this.sr);
    for (let i = start; i < stop; i++) {
      const t = i / this.sr - from;
      const v = wave.next() * envelope(t, length, attack, release) * gain;
      this.left[i] = this.left[i]! + v;
      this.right[i] = this.right[i]! + v;
    }
  }

  bell(freq: number, at: number, gain: number, pan: number) {
    const [gl, gr] = panned(pan);
    const [start, stop] = this.range(at, at + 4.5);
    const t0 = start / this.sr - at;
    const modulator = new Rotation(2 * Math.PI * freq * 1.4, t0, 0, this.sr);
    const index = new Decay(0.35, t0, this.sr);
    const decay = new Decay(1.4, t0, this.sr);
    for (let i = start; i < stop; i++) {
      const t = i / this.sr - at;
      const v = Math.sin(2 * Math.PI * freq * t + 2.6 * index.next() * modulator.next());
      const env = Math.min(1, t / 0.004) * decay.next() * gain;
      this.left[i] = this.left[i]! + v * env * gl;
      this.right[i] = this.right[i]! + v * env * gr;
    }
  }

  pluck(freq: number, at: number, gain: number, pan: number) {
    const [gl, gr] = panned(pan);
    const [start, stop] = this.range(at, at + 2);
    const t0 = start / this.sr - at;
    const wave = new Rotation(2 * Math.PI * freq, t0, 0, this.sr);
    const second = new Decay(0.12, t0, this.sr);
    const third = new Decay(0.06, t0, this.sr);
    const decay = new Decay(0.42, t0, this.sr);
    for (let i = start; i < stop; i++) {
      const t = i / this.sr - at;
      const sin = wave.next();
      const cos = wave.cos;
      const v = sin + 0.25 * (2 * sin * cos) * second.next() + 0.08 * (3 * sin - 4 * sin * sin * sin) * third.next();
      const env = Math.min(1, t / 0.005) * decay.next() * gain;
      this.left[i] = this.left[i]! + v * env * gl;
      this.right[i] = this.right[i]! + v * env * gr;
    }
  }

  air(from: number, peak: number, to: number, gain: number) {
    let seed = 0x9e3779b9;
    const noise = () => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return (seed >>> 8) / (1 << 23) - 1;
    };
    let lp0 = 0;
    let lp1 = 0;
    const [start, stop] = this.range(from, to);
    for (let i = start; i < stop; i++) {
      const t = i / this.sr;
      const rise = t < peak ? (t - from) / (peak - from) : 1 - (t - peak) / (to - peak);
      const shape = Math.max(0, rise) * Math.max(0, rise);
      const cutoff = 250 + 2800 * shape;
      const a = 1 - Math.exp((-2 * Math.PI * cutoff) / this.sr);
      lp0 += a * (noise() - lp0);
      lp1 += a * (noise() - lp1);
      this.left[i] = this.left[i]! + lp0 * shape * gain;
      this.right[i] = this.right[i]! + lp1 * shape * gain;
    }
  }

  normalize(target: number) {
    let peak = 0;
    for (let i = 0; i < this.left.length; i++) peak = Math.max(peak, Math.abs(this.left[i]!), Math.abs(this.right[i]!));
    if (peak <= 0) return;
    const k = target / peak;
    for (let i = 0; i < this.left.length; i++) {
      this.left[i] = this.left[i]! * k;
      this.right[i] = this.right[i]! * k;
    }
  }

  fadeOut(seconds: number) {
    const count = this.left.length;
    const frames = Math.min(count, Math.trunc(seconds * this.sr));
    for (let j = 0; j < frames; j++) {
      const i = count - frames + j;
      const g = 0.5 + 0.5 * Math.cos((Math.PI * j) / frames);
      this.left[i] = this.left[i]! * g;
      this.right[i] = this.right[i]! * g;
    }
  }
}

export function synthesize(given: Partial<IntroCues>): IntroAudio {
  const c = { ...DEFAULT_CUES, ...given };
  const sr = SAMPLE_RATE;
  const n = Math.trunc((c.end + 4.5) * sr);
  const mix = new Mix(new Float32Array(n), new Float32Array(n), sr);

  const d2 = 73.416, g2 = 97.999, d3 = 146.832, g3 = 195.998, a3 = 220.0, b3 = 246.942, d4 = 293.665;
  const e4 = 329.628, fs4 = 369.994, a4 = 440.0, cs5 = 554.365, e5 = 659.255;
  const first = c.tagline + 0.35;
  const second = c.exit + 0.25;
  for (const f of [d3, a3, e4, a4]) mix.pad(f, 0, first, 1.8, 1.2, 0.15);
  for (const f of [g3, b3, d4, fs4]) mix.pad(f, c.tagline - 0.2, second, 1.1, 1.0, 0.14);
  for (const f of [d3, a3, fs4, cs5, e5]) mix.pad(f, c.exit - 0.1, c.end + 1.2, 0.6, 2.8, 0.13);
  mix.sine(d2, 0, first, 2.0, 1.2, 0.08);
  mix.sine(g2, c.tagline - 0.2, second, 1.0, 1.0, 0.07);
  mix.sine(d2, c.exit - 0.1, c.end + 1.2, 0.6, 2.8, 0.08);

  const land = c.icon + 0.35;
  mix.bell(587.33, land, 0.1, -0.15);
  mix.bell(880.0, land + 0.012, 0.07, 0.2);

  let midi = 69;
  const pentatonic = new Set([2, 4, 6, 9, 11]);
  const letterCount = Math.max(0, Math.trunc(c.letterCount));
  for (let i = 0; i < letterCount; i++) {
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const pan = (i % 2 === 0 ? -0.35 : 0.35) * (0.4 + (0.6 * i) / Math.max(1, letterCount - 1));
    mix.pluck(freq, c.letters + i * c.letterStep + 0.03, 0.075 - 0.003 * i, pan);
    do midi += 1;
    while (!pentatonic.has(midi % 12));
  }

  mix.air(c.exit - 0.35, c.end, c.end + 1.4, 0.035);
  mix.bell(739.99, c.end - 0.05, 0.06, 0.25);
  mix.bell(1174.66, c.end + 0.03, 0.04, -0.25);

  mix.normalize(0.5);
  mix.fadeOut(1.5);
  return { sampleRate: sr, left: mix.left, right: mix.right };
}
