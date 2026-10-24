import type { IntroAudio, IntroCues } from "../introMusic/synth";

const VOLUME = 0.55;
const REVERB_WET = 0.32;
const REVERB_SECONDS = 3.2;
const REVERB_PREDELAY = 0.02;
const FADE_IN_SECONDS = 0.06;
const TAIL_SECONDS = 2.5;
const MUTE_FADE_SECONDS = 0.25;
const CURVE_POINTS = 32;

type Playing = { context: AudioContext; master: GainNode };

let session = 0;
let muted = false;
let playing: Playing | null = null;

function synthesizeOffThread(cues: Partial<IntroCues>): Promise<IntroAudio | null> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../introMusic/worker.ts", import.meta.url), { type: "module", name: "astro-intro-music" });
    } catch {
      return resolve(null);
    }
    worker.onmessage = ({ data }: MessageEvent<IntroAudio>) => {
      worker.terminate();
      resolve(data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    worker.postMessage(cues);
  });
}

function hallImpulse(context: AudioContext): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.trunc((REVERB_SECONDS + REVERB_PREDELAY) * rate);
  const impulse = context.createBuffer(2, length, rate);
  let seed = 0x2545f491;
  const noise = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return (seed >>> 8) / (1 << 23) - 1;
  };
  const delay = Math.trunc(REVERB_PREDELAY * rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let low = 0;
    for (let i = delay; i < length; i++) {
      const t = (i - delay) / rate;
      const damping = 0.35 + 0.6 * Math.exp(-t / 0.6);
      low += damping * (noise() - low);
      data[i] = low * Math.exp((-6.9 * t) / REVERB_SECONDS);
    }
  }
  return impulse;
}

function smoothCurve(from: number, to: number) {
  const curve = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i++) {
    const t = i / (CURVE_POINTS - 1);
    curve[i] = from + (to - from) * t * t * (3 - 2 * t);
  }
  return curve;
}

function fade(target: number, seconds: number, done?: () => void) {
  const current = playing;
  if (!current) return done?.();
  const { context, master } = current;
  const now = context.currentTime;
  const from = master.gain.value;
  master.gain.cancelScheduledValues(now);
  if (seconds <= 0 || from === target) master.gain.setValueAtTime(target, now);
  else master.gain.setValueCurveAtTime(smoothCurve(from, target), now, seconds);
  if (done) setTimeout(done, Math.max(0, seconds) * 1000);
}

function stopNow() {
  const current = playing;
  playing = null;
  if (current) void current.context.close().catch(() => {});
}

function start(audio: IntroAudio, offset: number, current: number) {
  const skip = Math.trunc(Math.max(0, offset) * audio.sampleRate);
  const frames = audio.left.length - skip;
  if (frames <= 0) return;
  const context = new AudioContext({ sampleRate: audio.sampleRate, latencyHint: "playback" });
  const buffer = context.createBuffer(2, frames, audio.sampleRate);
  const fadeIn = skip > 0 ? Math.min(frames, Math.trunc(FADE_IN_SECONDS * audio.sampleRate)) : 0;
  [audio.left, audio.right].forEach((samples, channel) => {
    const data = buffer.getChannelData(channel);
    data.set(samples.subarray(skip));
    for (let i = 0; i < fadeIn; i++) data[i] = data[i]! * (i / fadeIn);
  });
  const source = context.createBufferSource();
  source.buffer = buffer;
  const dry = context.createGain();
  dry.gain.value = 1 - REVERB_WET;
  const wet = context.createGain();
  wet.gain.value = REVERB_WET;
  const reverb = context.createConvolver();
  reverb.buffer = hallImpulse(context);
  const master = context.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  source.connect(dry).connect(master);
  source.connect(reverb).connect(wet).connect(master);
  master.connect(context.destination);
  source.onended = () =>
    setTimeout(() => {
      if (session === current) stopNow();
    }, TAIL_SECONDS * 1000);
  playing = { context, master };
  void context.resume().catch(() => {});
  source.start();
}

function play(cues: Partial<IntroCues>, mute: boolean) {
  const requestedAt = performance.now();
  stopNow();
  const current = ++session;
  muted = mute;
  void synthesizeOffThread(cues).then((audio) => {
    if (session !== current || !audio) return;
    start(audio, (performance.now() - requestedAt) / 1000, current);
  });
}

export const introMusicServices = {
  playIntroMusic: async (cues: Partial<IntroCues>, mute: boolean) => play(cues, mute),
  setIntroMusicMuted: async (mute: boolean) => {
    muted = mute;
    fade(mute ? 0 : VOLUME, MUTE_FADE_SECONDS);
  },
  stopIntroMusic: async (seconds: number) => {
    if (!playing) return void session++;
    const current = session;
    fade(0, seconds, () => {
      if (session === current) stopNow();
    });
  },
};
